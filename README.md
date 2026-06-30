# Media Vault

A self-hosted website for sharing images and videos that anyone can download for free. You upload files from a password-protected admin page; everyone else sees a public gallery with a download button on each item. Files are stored permanently and separately from the web server, so they're safe even if the server restarts or sleeps.

## How it's built

- **Public gallery** (`/`) — searchable grid of every file you've uploaded, with a download button and a click-to-preview modal.
- **Admin page** (`/admin.html`) — password-protected. Drag and drop files to add them, delete files you no longer want to host.
- A small Node.js/Express server, with the actual files stored on **Cloudinary** (a free media-hosting service) so they persist forever, independent of whatever is running the website itself.

---

## Setting this up entirely from your phone (free, no terminal)

You'll create three free accounts, then connect them together. Total time: about 15–20 minutes.

### 1. Cloudinary — where your files actually live

1. On your phone, go to **cloudinary.com** and sign up for a free account (no credit card required).
2. Once logged in, go to your **Dashboard**. You'll see three values: **Cloud name**, **API Key**, and **API Secret**. Tap to reveal the secret. Keep this tab open or copy these three values into your phone's Notes app — you'll need them in step 3.

### 2. GitHub — where your code lives

1. Go to **github.com** and sign up for a free account.
2. Tap **+** (top right) → **New repository**. Name it `media-vault`, keep it **Public**, and tap **Create repository**.
3. You now need to get all the files from the zip I gave you into this repository. Unzip `media-vault.zip` using your phone's file manager app first (most Android file managers can extract zips — tap the file and choose "Extract").
4. In your new GitHub repo, tap **Add file → Upload files**. Select these 6 files from the unzipped folder's root and upload them together: `server.js`, `package.json`, `.env.example`, `.gitignore`, `README.md`. Scroll down and tap **Commit changes**.
   - Note: GitHub's mobile upload may hide files starting with a dot (like `.gitignore` and `.env.example`) depending on your file manager. If you can't select them, it's fine to skip them for now — they're optional for deployment to work.
5. Now for the `public` folder. Tap **Add file → Create new file**. In the file name box, type `public/index.html` (typing the slash creates the folder automatically). Open `index.html` from the unzipped folder in a text editor app, copy all its content, and paste it into GitHub's editor. Commit.
6. Your repo now has a `public` folder. Tap into it, then **Add file → Upload files**, and this time select the remaining 4 files together: `admin.html`, `style.css`, `gallery.js`, `admin.js`. Commit.

Your repo should now contain `server.js`, `package.json`, and a `public` folder with 5 files inside it.

### 3. Render — what actually runs the website

1. Go to **render.com** and sign up free (you can sign up directly with your GitHub account, which makes the next step easier).
2. Tap **New → Web Service**.
3. Connect your GitHub account if prompted, then select your `media-vault` repository.
4. Render should auto-detect it as a Node app. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Scroll to **Environment Variables** and add each of these one at a time (Key on the left, Value on the right):
   - `ADMIN_PASSWORD` → a password only you know
   - `SESSION_SECRET` → any long random string (mash your keyboard)
   - `CLOUDINARY_CLOUD_NAME` → from step 1
   - `CLOUDINARY_API_KEY` → from step 1
   - `CLOUDINARY_API_SECRET` → from step 1
   - `SITE_NAME` → whatever you want the site to be called
6. Tap **Create Web Service**. Render will install everything and deploy — this takes a few minutes the first time. When it's done, you'll get a URL like `https://media-vault-xxxx.onrender.com`.

That URL is your public gallery. Add `/admin.html` to the end of it to reach your upload page.

---

## Using it day to day

- Visit `your-url.onrender.com/admin.html`, enter your `ADMIN_PASSWORD`, and drag/tap to upload images or videos. Upload as many, as often as you like — there's no limit other than your Cloudinary storage (see below).
- Visitors go to `your-url.onrender.com` to browse and download. They never see or need the admin page.
- The free Render service "sleeps" after 15 minutes with no visitors, and takes about 30–60 seconds to wake up on the next visit — that's normal and only affects load time, never your stored files.

## Storage limits

Cloudinary's free tier includes a generous monthly allowance of storage and bandwidth (check your Cloudinary dashboard for your current usage and exact limits, since these are occasionally adjusted). If you outgrow it, Cloudinary's paid tiers are inexpensive and you wouldn't need to change any code — just upgrade the account.

## If something goes wrong

- **Site loads but gallery is empty / errors**: double check the three `CLOUDINARY_` environment variables in Render exactly match your Cloudinary dashboard.
- **Can't log into admin**: double check `ADMIN_PASSWORD` in Render's Environment Variables matches what you're typing.
- **Changes not showing up**: after editing files on GitHub, Render redeploys automatically within a minute or two — check the "Events" or "Logs" tab in Render to see deployment status.

## Security note

Treat `ADMIN_PASSWORD` like any other password — anyone who has it can upload or delete files. Never share your Cloudinary API Secret publicly (only paste it into Render's environment variables, never into a file you upload to GitHub).
