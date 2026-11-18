/**
 * JELAJAH DESA KERTA - LOGIKA GALERI DOKUMENTASI
 * Menampilkan grid foto dokumentasi faktual, modal lightbox, dan atribusi sumber
 */

document.addEventListener('DOMContentLoaded', async () => {
  const galleryGrid = document.getElementById('gallery-grid');
  if (!galleryGrid) return;

  const list = await DataService.getDestinations();
  const photos = [];

  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const isPagesDir = typeof window !== 'undefined' && window.location.pathname.includes('/pages/');

  list.forEach(dest => {
    if (dest.photos && Array.isArray(dest.photos)) {
      dest.photos.forEach(p => {
        let url = p.url;
        if (!url.startsWith('http')) {
          const cleanPath = url.replace(/^(\.\.\/|\.\/|\/)/, '');
          url = isFileProto ? (isPagesDir ? '../' : '') + cleanPath : '/' + cleanPath;
        }
        photos.push({
          url: url,
          caption: p.caption || dest.name,
          source: p.source || 'Dokumentasi Tim KKN',
          destinationName: dest.name,
          destinationSlug: dest.slug,
          category: dest.category
        });
      });
    }
  });

  renderGallery(galleryGrid, photos, isPagesDir);
  initGalleryFilters(galleryGrid, photos, isPagesDir);
  initLightbox();
});

function renderGallery(container, photos, isPagesDir) {
  if (photos.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3 class="empty-state-title">Galeri Belum Terisi</h3>
        <p class="empty-state-desc">Dokumentasi foto lapangan sedang dihimpun oleh tim mahasiswa KKN di Desa Kerta.</p>
      </div>
    `;
    return;
  }

  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';

  container.innerHTML = photos.map((item, index) => {
    const cat = formatCategoryLabel(item.category);
    const detailHref = isFileProto
      ? (isPagesDir ? `detail.html?slug=${encodeURIComponent(item.destinationSlug)}` : `pages/detail.html?slug=${encodeURIComponent(item.destinationSlug)}`)
      : `/detail?slug=${encodeURIComponent(item.destinationSlug)}`;

    return `
      <div class="gallery-item-card" data-category="${item.category}" style="
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: var(--shadow-sm);
        transition: transform var(--transition-fast), box-shadow var(--transition-fast);
      ">
        <div style="position:relative; aspect-ratio: 16/10; overflow:hidden; background:var(--color-bg-alt); cursor:pointer;" class="lightbox-trigger" data-index="${index}">
          <img 
            src="${item.url}" 
            alt="${escapeHtml(item.caption)}" 
            loading="lazy"
            style="width:100%; height:100%; object-fit:cover; transition:transform var(--transition-smooth);"
            onmouseover="this.style.transform='scale(1.04)'"
            onmouseout="this.style.transform='scale(1)'"
          />
          <span class="badge ${cat.class}" style="position:absolute; top:0.75rem; left:0.75rem; z-index:2;">${cat.name}</span>
        </div>
        <div style="padding:1.25rem; display:flex; flex-direction:column; flex-grow:1;">
          <h4 style="font-size:1.05rem; font-weight:700; color:var(--color-primary-dark); margin-bottom:0.35rem;">
            <a href="${detailHref}" style="color:inherit; text-decoration:none;">${escapeHtml(item.destinationName)}</a>
          </h4>
          <p style="font-size:0.8125rem; color:var(--color-text-muted); line-height:1.45; margin-bottom:0.75rem; flex-grow:1;">
            ${escapeHtml(item.caption)}
          </p>
          <div style="border-top:1px solid var(--color-border-light); padding-top:0.65rem; font-size:0.75rem; color:var(--color-text-subtle); display:flex; justify-content:space-between; align-items:center;">
            <span>Sumber: <strong>${escapeHtml(item.source)}</strong></span>
            <a href="${detailHref}" style="color:var(--color-primary); font-weight:600;">Lihat Detail &rarr;</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initGalleryFilters(container, allPhotos, isPagesDir) {
  const filterPills = document.querySelectorAll('[data-gallery-filter]');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.getAttribute('data-gallery-filter');

      const filtered = cat === 'all' 
        ? allPhotos 
        : allPhotos.filter(p => p.category === cat);

      renderGallery(container, filtered, isPagesDir);
    });
  });
}

function initLightbox() {
  const modal = document.getElementById('lightbox-modal');
  const modalImg = document.getElementById('lightbox-img');
  const modalCaption = document.getElementById('lightbox-caption');
  const modalClose = document.getElementById('lightbox-close');

  if (!modal || !modalImg) return;

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.lightbox-trigger');
    if (trigger) {
      const img = trigger.querySelector('img');
      const card = trigger.closest('.gallery-item-card');
      const captionText = card ? card.querySelector('p').textContent : '';

      modalImg.src = img.src;
      modalCaption.textContent = captionText;
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  });

  const closeModal = () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
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
