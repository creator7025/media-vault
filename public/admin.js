(() => {
  const loginScreen = document.getElementById('loginScreen');
  const adminScreen = document.getElementById('adminScreen');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const filePillRow = document.getElementById('filePillRow');
  const descriptionInput = document.getElementById('descriptionInput');
  const uploadBtn = document.getElementById('uploadBtn');

  const adminListBody = document.getElementById('adminListBody');
  const adminCount = document.getElementById('adminCount');
  const toastRoot = document.getElementById('toastRoot');

  let selectedFiles = [];

  function showToast(msg) {
    toastRoot.innerHTML = `<div class="toast">${msg}</div>`;
    setTimeout(() => (toastRoot.innerHTML = ''), 2500);
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---------- Auth ----------
  async function checkAuth() {
    const res = await fetch('/api/admin/check');
    const data = await res.json();
    if (data.isAdmin) {
      showAdmin();
    } else {
      loginScreen.style.display = 'block';
    }
  }

  async function login() {
    loginError.style.display = 'none';
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    if (res.ok) {
      showAdmin();
    } else {
      loginError.style.display = 'block';
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    adminScreen.style.display = 'none';
    loginScreen.style.display = 'block';
    passwordInput.value = '';
  }

  function showAdmin() {
    loginScreen.style.display = 'none';
    adminScreen.style.display = 'block';
    loadFileList();
  }

  loginBtn.addEventListener('click', login);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
  logoutBtn.addEventListener('click', logout);

  // ---------- Upload: drag & drop / file picker ----------
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => addFiles(fileInput.files));

  function addFiles(fileList) {
    Array.from(fileList).forEach((f) => selectedFiles.push(f));
    renderPills();
  }

  function renderPills() {
    filePillRow.innerHTML = '';
    selectedFiles.forEach((f, idx) => {
      const pill = document.createElement('span');
      pill.className = 'file-pill';
      pill.textContent = `${f.name} (${formatBytes(f.size)}) ×`;
      pill.style.cursor = 'pointer';
      pill.title = 'Click to remove';
      pill.addEventListener('click', () => {
        selectedFiles.splice(idx, 1);
        renderPills();
      });
      filePillRow.appendChild(pill);
    });
    uploadBtn.disabled = selectedFiles.length === 0;
  }

  uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading…';

    const formData = new FormData();
    selectedFiles.forEach((f) => {
      formData.append('files', f);
      formData.append('titles', f.name.replace(/\.[^/.]+$/, ''));
    });
    formData.append('description', descriptionInput.value);

    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        showToast(`Uploaded ${data.added.length} file${data.added.length === 1 ? '' : 's'}`);
        selectedFiles = [];
        renderPills();
        descriptionInput.value = '';
        fileInput.value = '';
        loadFileList();
      } else {
        showToast(data.error || 'Upload failed');
      }
    } catch (e) {
      showToast('Upload failed — check your connection');
    } finally {
      uploadBtn.disabled = selectedFiles.length === 0;
      uploadBtn.textContent = 'Upload';
    }
  });

  // ---------- File list / delete ----------
  async function loadFileList() {
    adminListBody.innerHTML = '<p class="search-count">Loading…</p>';
    try {
      const res = await fetch('/api/files?limit=100');
      const data = await res.json();
      adminCount.textContent = `${data.total} file${data.total === 1 ? '' : 's'} total`;
      adminListBody.innerHTML = '';

      if (data.files.length === 0) {
        adminListBody.innerHTML = '<p class="search-count">No files yet — upload your first one above.</p>';
        return;
      }

      data.files.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'admin-row';
        const thumbEl =
          item.type === 'video'
            ? `<video class="thumb" src="${item.url}" muted></video>`
            : `<img class="thumb" src="${item.url}" alt="" />`;
        row.innerHTML = `
          ${thumbEl}
          <div class="info">
            <p class="frame-title">${escapeHtml(item.title)}</p>
            <p class="frame-sub mono">${item.type.toUpperCase()} · ${formatBytes(item.size)}</p>
          </div>
          <button class="delete-btn" data-id="${item.id}">Delete</button>
        `;
        row.querySelector('.delete-btn').addEventListener('click', () => deleteFile(item.id, item.title, item.type));
        adminListBody.appendChild(row);
      });
    } catch (e) {
      adminListBody.innerHTML = '<p class="search-count">Could not load files.</p>';
    }
  }

  async function deleteFile(id, title, type) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const params = new URLSearchParams({ id, type });
    const res = await fetch(`/api/admin/files?${params}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Deleted');
      loadFileList();
    } else {
      showToast('Could not delete file');
    }
  }

  checkAuth();
})();
