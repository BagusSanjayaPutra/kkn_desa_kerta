/**
 * JELAJAH DESA KERTA - LOGIKA HALAMAN DETAIL DESTINASI
 * Menampilkan rincian faktual lengkap dengan penanganan jujur untuk data yang belum terverifikasi
 */

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('detail-page-content');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const id = urlParams.get('id');

  let destination = null;
  if (slug) {
    destination = await DataService.getBySlug(slug);
  } else if (id) {
    destination = await DataService.getById(id);
  }

  // Jika tidak ada parameter atau tidak ditemukan, default ke item pertama sebagai fallback informatif
  if (!destination) {
    const all = await DataService.getDestinations();
    if (all.length > 0) {
      destination = all[0];
    } else {
      renderNotFound(container);
      return;
    }
  }

  renderDetail(container, destination);
});

function renderNotFound(container) {
  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const katalogLink = isFileProto ? 'katalog.html' : '/katalog';
  container.innerHTML = `
    <div class="empty-state">
      <h3 class="empty-state-title">Destinasi Tidak Ditemukan</h3>
      <p class="empty-state-desc">Data objek wisata yang dicari tidak tersedia dalam inventaris survei kami.</p>
      <a href="${katalogLink}" class="btn btn-primary">Kembali ke Katalog Wisata</a>
    </div>
  `;
}

function renderDetail(container, item) {
  const cat = formatCategoryLabel(item.category);
  const status = formatStatusLabel(item.verificationStatus);
  const hasCoords = DataService.isValidCoordinate(item.coordinates);
  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const katalogLink = isFileProto ? 'katalog.html' : '/katalog';
  const berandaLink = isFileProto ? '../index.html' : '/';
  
  // Format jalur foto (di server absolut /assets/..., di file:// relatif ../assets/...)
  let photo = (item.photos && item.photos[0]) || {
    url: 'assets/images/destinations/munduk-asri-1.svg',
    caption: 'Dokumentasi belum tersedia',
    source: 'Tim KKN Desa Kerta'
  };
  let photoUrl = photo.url;
  let fallbackSrc = '/assets/images/destinations/munduk-asri-1.svg';

  if (!photoUrl.startsWith('http')) {
    const cleanPath = photoUrl.replace(/^(\.\.\/|\.\/|\/)/, '');
    photoUrl = isFileProto ? '../' + cleanPath : '/' + cleanPath;
    fallbackSrc = isFileProto ? '../assets/images/destinations/munduk-asri-1.svg' : '/assets/images/destinations/munduk-asri-1.svg';
  }

  // Bangun komponen koordinat & peta
  let coordinateSectionHTML = '';
  if (hasCoords) {
    const lat = item.coordinates.latitude;
    const lng = item.coordinates.longitude;
    coordinateSectionHTML = `
      <div class="info-item">
        <span class="info-item-label">Koordinat GPS (Terverifikasi)</span>
        <span class="info-item-value"><code>${lat}, ${lng}</code></span>
        <div id="detail-mini-map" style="width:100%; height:200px; border-radius:var(--radius-md); margin-top:0.65rem; border:1px solid var(--color-border);"></div>
        <a 
          href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="btn btn-primary btn-sm" 
          style="margin-top:0.75rem; width:100%;"
        >
          Buka Petunjuk Arah Google Maps &rarr;
        </a>
      </div>
    `;
  } else {
    coordinateSectionHTML = `
      <div class="info-item" style="background:#FFF9E6; border:1px solid #FFE082; padding:1rem; border-radius:var(--radius-md);">
        <span class="info-item-label" style="color:#8D6E18;">Status Titik Koordinat</span>
        <p style="font-size:0.8125rem; color:#705309; line-height:1.5; margin:0.35rem 0 0.5rem;">
          <strong>Menunggu Survei Lapangan GPS:</strong> Sesuai aturan integritas data, tombol petunjuk arah dan titik peta presisi belum diaktifkan sebelum titik gerbang diukur langsung oleh tim survei KKN untuk mencegah disinformasi.
        </p>
        <span style="font-size:0.75rem; color:#8D6E18; font-style:italic;">
          Catatan: ${escapeHtml(item.coordinates?.source || 'Menunggu penentuan titik koordinat.')}
        </span>
      </div>
    `;
  }

  // Fasilitas
  let facilitiesHTML = '';
  if (item.facilities && item.facilities.length > 0) {
    facilitiesHTML = `
      <ul class="facilities-checklist">
        ${item.facilities.map(f => `
          <li>
            <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${escapeHtml(f)}</span>
          </li>
        `).join('')}
      </ul>
    `;
  } else {
    facilitiesHTML = `<p class="info-item-unconfirmed">Informasi fasilitas sedang diverifikasi tim survei KKN.</p>`;
  }

  // Sumber referensi
  const sourcesList = (item.sources && item.sources.length > 0)
    ? item.sources.map(s => `<li>${escapeHtml(s)}</li>`).join('')
    : '<li>Dokumentasi observasi awal KKN</li>';

  container.innerHTML = `
    <!-- Breadcrumbs -->
    <nav class="detail-breadcrumbs" aria-label="Breadcrumb">
      <a href="${berandaLink}">Beranda</a>
      <span>/</span>
      <a href="${katalogLink}">Katalog Wisata</a>
      <span>/</span>
      <span style="color:var(--color-primary); font-weight:600;">${escapeHtml(item.name)}</span>
    </nav>

    <!-- Header Meta -->
    <div class="detail-header-meta">
      <span class="badge ${cat.class}">${cat.name}</span>
      <span class="badge-status ${status.class}">${status.text}</span>
      <span style="font-size:0.8125rem; color:var(--color-text-subtle);">
        Pembaruan Data: ${item.lastUpdated || 'Oktober 2026'}
      </span>
    </div>

    <h1 class="detail-title">${escapeHtml(item.name)}</h1>

    <!-- Foto & Galeri -->
    <div class="detail-gallery-main">
      <img 
        src="${photoUrl}" 
        alt="${escapeHtml(item.name)}" 
        onerror="this.src='${fallbackSrc}'"
      />
    </div>
    <p class="detail-gallery-caption">
      ${escapeHtml(photo.caption || 'Dokumentasi lapangan')} 
      <span style="display:inline-block; margin-left:0.5rem; font-weight:600;">[Sumber: ${escapeHtml(photo.source || 'Tim KKN')}]</span>
    </p>

    <!-- Layout Dua Kolom: Artikel vs Sidebar Teknis -->
    <div class="detail-layout-grid">
      <!-- Kolom Kiri: Deskripsi Faktual -->
      <div class="detail-main-article">
        <article class="article-block">
          <h3>Ringkasan Faktual Potensi</h3>
          <p style="font-size:1.0625rem; line-height:1.75; color:var(--color-text-main);">
            ${escapeHtml(item.description)}
          </p>
        </article>

        <article class="article-block">
          <h3>Fasilitas &amp; Kondisi Eksisting</h3>
          ${facilitiesHTML}
        </article>

        <article class="article-block">
          <h3>Panduan Akses &amp; Jalur Tempuh</h3>
          <p>${escapeHtml(item.accessNotes || 'Informasi rute dan akses detail sedang dihimpun oleh tim survei.')}</p>
        </article>

        <!-- Kotak Catatan Integritas Data & Audit Lapangan -->
        <div class="verification-audit-box">
          <h5>Transparansi &amp; Sumber Informasi</h5>
          <p>Data halaman ini disusun berdasarkan metodologi verifikasi program kerja KKN Desa Kerta:</p>
          <ul>${sourcesList}</ul>
          <p style="margin-top:0.65rem; font-style:italic;">
            Jika Anda memiliki konfirmasi resmi, ralat data, atau dokumentasi terbaru, silakan laporkan ke sekretariat KKN atau pihak pengelola desa.
          </p>
        </div>
      </div>

      <!-- Kolom Kanan: Sidebar Informasi Praktis -->
      <aside class="detail-sidebar">
        <div class="detail-sidebar-card">
          <h4 class="sidebar-title">Informasi Kunjungan</h4>

          <div class="info-item">
            <span class="info-item-label">Alamat / Lokasi Administratif</span>
            <span class="info-item-value">${escapeHtml(item.address || 'Kawasan Desa Kerta, Kec. Payangan, Gianyar (menunggu detail banjar)')}</span>
          </div>

          <div class="info-item">
            <span class="info-item-label">Jam Operasional / Kunjungan</span>
            <span class="info-item-value ${item.openingHours ? '' : 'info-item-unconfirmed'}">
              ${escapeHtml(item.openingHours || 'Informasi belum tersedia.')}
            </span>
          </div>

          <div class="info-item">
            <span class="info-item-label">Tiket Masuk / Kontribusi</span>
            <span class="info-item-value ${item.entranceFee ? '' : 'info-item-unconfirmed'}">
              ${escapeHtml(item.entranceFee || 'Belum dikonfirmasi.')}
            </span>
          </div>

          <div class="info-item">
            <span class="info-item-label">Kontak Pengelola</span>
            <span class="info-item-value ${item.contact ? '' : 'info-item-unconfirmed'}">
              ${escapeHtml(item.contact || 'Kontak pengelola belum dikonfirmasi.')}
            </span>
          </div>

          ${coordinateSectionHTML}

          <div style="margin-top:0.5rem; pt-3; border-top:1px solid var(--color-border-light);">
            <a href="${katalogLink}" class="btn btn-outline btn-sm" style="width:100%;">
              &larr; Lihat Destinasi Lainnya
            </a>
          </div>
        </div>
      </aside>
    </div>
  `;

  // Jika memiliki koordinat valid dan Leaflet tersedia, render mini map
  if (hasCoords && typeof L !== 'undefined') {
    const lat = item.coordinates.latitude;
    const lng = item.coordinates.longitude;
    const miniMap = L.map('detail-mini-map', {
      zoomControl: false,
      scrollWheelZoom: false
    }).setView([lat, lng], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(miniMap);

    L.marker([lat, lng]).addTo(miniMap)
      .bindPopup(`<strong>${escapeHtml(item.name)}</strong>`)
      .openPopup();
  }
}
