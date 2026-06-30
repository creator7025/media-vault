require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const { Readable } = require('stream');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'insecure-default-secret-change-me';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '1024', 10);
const SITE_NAME = process.env.SITE_NAME || 'My Media Vault';
const CLOUDINARY_FOLDER = 'media-vault';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
  })
);
app.use(express.static(require('path').join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// ---------- Multer (file upload) config — buffers in memory, never touches local disk ----------
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

function uploadBufferToCloudinary(buffer, { resourceType, context }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: CLOUDINARY_FOLDER, context },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    Readable.from(buffer).pipe(stream);
  });
}

function mapResource(r) {
  let meta = {};
  try {
    const raw = (r.context && (r.context.custom ? r.context.custom.meta : r.context.meta)) || '{}';
    meta = JSON.parse(raw);
  } catch (e) {
    meta = {};
  }
  return {
    id: r.public_id,
    resourceType: r.resource_type,
    type: r.resource_type === 'video' ? 'video' : 'image',
    url: r.secure_url,
    mimetype: meta.mimetype || (r.resource_type === 'video' ? 'video/mp4' : 'image/jpeg'),
    originalName: meta.originalName || `${r.public_id.split('/').pop()}.${r.format || ''}`,
    title: meta.title || r.public_id.split('/').pop(),
    description: meta.description || '',
    size: r.bytes,
    uploadedAt: r.created_at,
  };
}

// ---------- Small in-memory cache to avoid hammering Cloudinary on every page view ----------
let resourceCache = { data: null, expiresAt: 0 };

async function fetchAllResources(forceFresh) {
  if (!forceFresh && resourceCache.data && Date.now() < resourceCache.expiresAt) {
    return resourceCache.data;
  }
  let all = [];
  let cursor = undefined;
  const SAFETY_CAP = 3000; // generous ceiling per request cycle
  do {
    const res = await cloudinary.search
      .expression(`folder:${CLOUDINARY_FOLDER}`)
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(500)
      .next_cursor(cursor)
      .execute();
    all = all.concat(res.resources.map(mapResource));
    cursor = res.next_cursor;
  } while (cursor && all.length < SAFETY_CAP);

  resourceCache = { data: all, expiresAt: Date.now() + 30 * 1000 };
  return all;
}

function invalidateCache() {
  resourceCache = { data: null, expiresAt: 0 };
}

// ---------- Public API ----------
app.get('/api/config', (req, res) => {
  res.json({ siteName: SITE_NAME });
});

app.get('/api/files', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '24', 10), 1), 100);
    const search = (req.query.search || '').toLowerCase().trim();

    let files = await fetchAllResources(false);
    if (search) {
      files = files.filter(
        (f) =>
          f.title.toLowerCase().includes(search) ||
          (f.description || '').toLowerCase().includes(search)
      );
    }

    const total = files.length;
    const start = (page - 1) * limit;
    const pageItems = files.slice(start, start + limit);

    res.json({ files: pageItems, total, page, totalPages: Math.max(Math.ceil(total / limit), 1) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load files. Check your Cloudinary credentials in .env.' });
  }
});

// Force-download with the original filename, proxied through this server
app.get('/api/download', async (req, res) => {
  try {
    const files = await fetchAllResources(false);
    const item = files.find((f) => f.id === req.query.id);
    if (!item) return res.status(404).send('File not found');

    const upstream = await fetch(item.url);
    if (!upstream.ok || !upstream.body) return res.status(502).send('Could not fetch file');

    res.setHeader('Content-Disposition', `attachment; filename="${item.originalName.replace(/"/g, '')}"`);
    res.setHeader('Content-Type', item.mimetype);
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).send('Download failed');
  }
});

// ---------- Admin auth ----------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Incorrect password' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------- Admin: upload ----------
app.post('/api/admin/upload', requireAuth, upload.array('files', 20), async (req, res) => {
  try {
    const titles = Array.isArray(req.body.titles) ? req.body.titles : [req.body.titles];
    const description = (req.body.description || '').trim();
    const added = [];

    for (let idx = 0; idx < (req.files || []).length; idx++) {
      const file = req.files[idx];
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const title = (titles[idx] || file.originalname).trim() || file.originalname;
      const meta = JSON.stringify({
        title,
        description,
        originalName: file.originalname,
        mimetype: file.mimetype,
      });
      const result = await uploadBufferToCloudinary(file.buffer, {
        resourceType,
        context: { meta },
      });
      added.push(mapResource(result));
    }

    invalidateCache();
    res.json({ ok: true, added });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

// ---------- Admin: delete ----------
app.delete('/api/admin/files', requireAuth, async (req, res) => {
  try {
    const resourceType = req.query.type === 'video' ? 'video' : 'image';
    await cloudinary.uploader.destroy(req.query.id, { resource_type: resourceType });
    invalidateCache();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not delete file' });
  }
});

// ---------- Error handler (e.g. multer file-too-large) ----------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Media Vault running at http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin.html`);
});
