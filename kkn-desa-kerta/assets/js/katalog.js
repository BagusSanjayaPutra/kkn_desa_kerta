/**
 * JELAJAH DESA KERTA - LOGIKA KATALOG DESTINASI
 * Menangani filter kategori, pencarian teks, status verifikasi, dan render kartu
 */

document.addEventListener('DOMContentLoaded', async () => {
  const catalogGrid = document.getElementById('catalog-cards-grid');
  const featuredGrid = document.getElementById('featured-cards-grid');

  if (catalogGrid) {
    initFullCatalog(catalogGrid);
  }

  if (featuredGrid) {
    initFeaturedSection(featuredGrid);
  }
});

/**
 * Render Kartu Destinasi Unggulan / Awal pada Halaman Beranda (index.html)
 */
async function initFeaturedSection(container) {
  try {
    const list = await DataService.getDestinations();
    // Ambil destinasi yang memiliki informasi terdokumentasi (misal status partially_verified atau teratas)
    const featured = list.slice(0, 3);
    container.innerHTML = featured.map(item => createCardHTML(item, false)).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-muted">Gagal memuat data destinasi.</p>`;
  }
}

/**
 * Inisialisasi Halaman Katalog Penuh dengan Filter & Search (pages/katalog.html)
 */
async function initFullCatalog(container) {
  const searchInput = document.getElementById('catalog-search-input');
  const categoryPills = document.querySelectorAll('[data-filter-category]');
  const statusPills = document.querySelectorAll('[data-filter-status]');
  const resultCountEl = document.getElementById('catalog-result-count');

  let currentCategory = 'all';
  let currentStatus = 'all';
  let currentQuery = '';

  // Render awal
  await updateCatalogView();

  // Event listener search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentQuery = e.target.value;
      updateCatalogView();
    });
  }

  // Event listener category pills
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-filter-category');
      updateCatalogView();
    });
  });

  // Event listener status pills
  statusPills.forEach(pill => {
    pill.addEventListener('click', () => {
      statusPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentStatus = pill.getAttribute('data-filter-status');
      updateCatalogView();
    });
  });

  async function updateCatalogView() {
    const filtered = await DataService.filterDestinations({
      query: currentQuery,
      category: currentCategory,
      verificationStatus: currentStatus
    });

    if (resultCountEl) {
      resultCountEl.textContent = `${filtered.length} Destinasi Ditemukan`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <h3 class="empty-state-title">Tidak Ada Destinasi yang Sesuai</h3>
          <p class="empty-state-desc">
            Tidak ditemukan objek wisata dengan kata kunci <strong>"${escapeHtml(currentQuery)}"</strong> 
            pada filter terpilih. Kami hanya menyajikan data yang telah terdata nyata.
          </p>
          <button class="btn btn-outline btn-sm" id="btn-reset-filters">Reset Pencarian &amp; Filter</button>
        </div>
      `;

      const resetBtn = document.getElementById('btn-reset-filters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          currentQuery = '';
          currentCategory = 'all';
          currentStatus = 'all';
          categoryPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-filter-category') === 'all'));
          statusPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-filter-status') === 'all'));
          updateCatalogView();
        });
      }
      return;
    }

    const isPagesDir = window.location.pathname.includes('/pages/');
    container.innerHTML = filtered.map(item => createCardHTML(item, isPagesDir)).join('');
  }
}

/**
 * Membentuk HTML Kartu Destinasi
 */
function createCardHTML(item, isInsidePagesDir = false) {
  const cat = formatCategoryLabel(item.category);
  const status = formatStatusLabel(item.verificationStatus);
  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
  
  const detailUrl = isFileProto
    ? `${isInsidePagesDir ? '' : 'pages/'}detail.html?slug=${encodeURIComponent(item.slug)}`
    : `/detail?slug=${encodeURIComponent(item.slug)}`;
  
  // Format jalur gambar (absolut pada web server, relatif bila file://)
  let rawPhoto = (item.photos && item.photos[0] && item.photos[0].url) || 'assets/images/destinations/munduk-asri-1.svg';
  let photoUrl = rawPhoto;
  let fallbackSrc = '/assets/images/destinations/munduk-asri-1.svg';

  if (!rawPhoto.startsWith('http')) {
    const cleanPath = rawPhoto.replace(/^(\.\.\/|\.\/|\/)/, '');
    if (isFileProto) {
      photoUrl = (isInsidePagesDir ? '../' : '') + cleanPath;
      fallbackSrc = (isInsidePagesDir ? '../' : '') + 'assets/images/destinations/munduk-asri-1.svg';
    } else {
      photoUrl = '/' + cleanPath;
      fallbackSrc = '/assets/images/destinations/munduk-asri-1.svg';
    }
  }

  // Cek apakah koordinat sudah terverifikasi
  const hasCoords = DataService.isValidCoordinate(item.coordinates);
  const coordBadge = hasCoords 
    ? `<span style="color:#2E7D32; font-weight:600;">● Koordinat GPS Terverifikasi</span>` 
    : `<span style="color:#B25E1B; font-size:0.775rem;">○ Titik GPS Menunggu Survei Lapangan</span>`;

  return `
    <article class="destination-card">
      <div class="card-media">
        <span class="card-badge-top badge ${cat.class}">${cat.name}</span>
        <img 
          src="${photoUrl}" 
          alt="${escapeHtml(item.name)}" 
          class="card-img" 
          loading="lazy"
          onerror="this.src='${fallbackSrc}'"
        />
      </div>
      <div class="card-body">
        <div style="margin-bottom: 0.5rem;">
          <span class="badge-status ${status.class}">${status.text}</span>
        </div>
        <h3 class="card-title">
          <a href="${detailUrl}">${escapeHtml(item.name)}</a>
        </h3>
        <p class="card-desc">${escapeHtml(item.shortDescription || '')}</p>
        
        <div class="card-meta">
          <div class="card-meta-row">
            <span>Status Lokasi:</span>
            ${coordBadge}
          </div>
          <div class="card-meta-row" style="color:var(--color-text-subtle);">
            <span>Kode Inventaris:</span>
            <span><code>${item.id}</code></span>
          </div>
        </div>

        <div class="card-footer">
          <a href="${detailUrl}" class="btn btn-outline btn-sm">Lihat Detail Faktual &rarr;</a>
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
