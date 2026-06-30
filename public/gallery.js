(() => {
  const grid = document.getElementById('galleryGrid');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const loadMoreRow = document.getElementById('loadMoreRow');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const searchInput = document.getElementById('searchInput');
  const resultCount = document.getElementById('resultCount');
  const sprocketStrip = document.getElementById('sprocketStrip');
  const modalRoot = document.getElementById('modalRoot');

  let page = 1;
  let totalPages = 1;
  let total = 0;
  let search = '';
  let searchTimer = null;
  let renderedCount = 0;

  // Decorative sprocket strip — fill width with ticks
  function buildSprocketStrip() {
    const count = Math.ceil(window.innerWidth / 16);
    sprocketStrip.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const tick = document.createElement('span');
      sprocketStrip.appendChild(tick);
    }
  }
  buildSprocketStrip();
  window.addEventListener('resize', () => {
    clearTimeout(window._sprocketResize);
    window._sprocketResize = setTimeout(buildSprocketStrip, 150);
  });

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

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.siteName) {
        document.getElementById('siteTitle').textContent = data.siteName;
        document.title = data.siteName;
      }
    } catch (e) {
      /* non-fatal */
    }
  }

  function frameCard(item, index) {
    const card = document.createElement('div');
    card.className = 'frame-card';

    const frameNum = String(index + 1).padStart(3, '0');

    const mediaEl =
      item.type === 'video'
        ? `<video src="${item.url}" preload="metadata" muted playsinline></video><span class="video-badge">VIDEO</span>`
        : `<img src="${item.url}" alt="${escapeHtml(item.title)}" loading="lazy" />`;

    card.innerHTML = `
      <div class="frame-thumb" data-id="${item.id}">
        <span class="frame-number mono">${frameNum}</span>
        ${mediaEl}
      </div>
      <div class="frame-meta">
        <p class="frame-title">${escapeHtml(item.title)}</p>
        <p class="frame-sub mono">${item.type.toUpperCase()} · ${formatBytes(item.size)}</p>
        <a class="btn-download" href="/api/download?id=${encodeURIComponent(item.id)}">Download</a>
      </div>
    `;

    card.querySelector('.frame-thumb').addEventListener('click', () => openModal(item));
    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function openModal(item) {
    const mediaEl =
      item.type === 'video'
        ? `<video src="${item.url}" controls autoplay></video>`
        : `<img src="${item.url}" alt="${escapeHtml(item.title)}" />`;

    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="modalBackdrop">
        <div class="modal-box">
          <button class="modal-close" id="modalClose">×</button>
          <div class="modal-media">${mediaEl}</div>
          <div class="modal-footer">
            <div>
              <p class="frame-title">${escapeHtml(item.title)}</p>
              <p class="frame-sub mono">${item.type.toUpperCase()} · ${formatBytes(item.size)}</p>
            </div>
            <a class="btn-download" style="width:auto;padding:10px 18px;" href="/api/download?id=${encodeURIComponent(item.id)}">Download</a>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') closeModal();
    });
    document.addEventListener('keydown', escCloser);
  }

  function escCloser(e) {
    if (e.key === 'Escape') closeModal();
  }

  function closeModal() {
    modalRoot.innerHTML = '';
    document.removeEventListener('keydown', escCloser);
  }

  async function loadFiles(reset) {
    if (reset) {
      page = 1;
      renderedCount = 0;
      grid.innerHTML = '';
    }
    loadingState.style.display = 'block';
    loadMoreRow.style.display = 'none';

    try {
      const params = new URLSearchParams({ page, limit: 24, search });
      const res = await fetch(`/api/files?${params}`);
      const data = await res.json();

      total = data.total;
      totalPages = data.totalPages;

      data.files.forEach((item) => {
        grid.appendChild(frameCard(item, renderedCount));
        renderedCount++;
      });

      resultCount.textContent = total === 0 ? '' : `${total} file${total === 1 ? '' : 's'}`;
      emptyState.style.display = total === 0 ? 'block' : 'none';
      loadMoreRow.style.display = page < totalPages ? 'block' : 'none';
    } catch (e) {
      resultCount.textContent = '';
      emptyState.style.display = renderedCount === 0 ? 'block' : 'none';
      if (renderedCount === 0) {
        emptyState.querySelector('p').textContent = 'Could not load files. Try refreshing the page.';
      }
    } finally {
      loadingState.style.display = 'none';
    }
  }

  loadMoreBtn.addEventListener('click', () => {
    page++;
    loadFiles(false);
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      search = searchInput.value.trim();
      loadFiles(true);
    }, 300);
  });

  loadConfig();
  loadFiles(true);
})();
