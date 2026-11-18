/**
 * JELAJAH DESA KERTA - LOGIKA PETA INTERAKTIF (LEAFLET.JS)
 * 
 * ATURAN INTEGRITAS GEOGRAFIS:
 * 1. Marker destinasi HANYA ditampilkan apabila coordinates.verified === true dan numerik valid.
 * 2. Tidak pernah menggunakan koordinat acak, contoh, atau titik tengah desa untuk objek wisata.
 * 3. Jika belum ada koordinat yang diverifikasi, tampilkan pesan informatif yang jujur.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  initLeafletMap(mapElement);
});

async function initLeafletMap(mapElement) {
  if (typeof L === 'undefined') {
    mapElement.innerHTML = `
      <div style="padding:2rem; text-align:center; color:var(--color-text-muted);">
        Library peta (Leaflet.js) tidak termuat. Periksa koneksi internet Anda.
      </div>
    `;
    return;
  }

  // Koordinat acuan pusat wilayah administratif Desa Kerta
  const villageCenter = [-8.343683, 115.276070];
  const map = L.map('map', {
    scrollWheelZoom: false,
    zoomControl: true
  }).setView(villageCenter, 13);

  // Tile layer OpenStreetMap dengan atribusi resmi
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Marker Referensi Administratif Kantor Desa Kerta
  const adminIcon = L.divIcon({
    className: 'custom-admin-marker',
    html: `
      <div style="
        background-color: #1C382B;
        color: white;
        border: 2px solid white;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  L.marker(villageCenter, { icon: adminIcon })
    .addTo(map)
    .bindPopup(`
      <div style="padding:0.5rem; max-width:240px; font-family:var(--font-body);">
        <strong style="color:#1C382B; display:block; margin-bottom:0.25rem;">Kantor Desa Kerta</strong>
        <p style="font-size:0.75rem; color:#56685F; margin:0 0 0.5rem; line-height:1.4;">
          Titik Referensi Administratif Wilayah Desa Kerta, Payangan, Gianyar.
        </p>
        <span style="font-size:0.7rem; color:#8C5338; font-weight:600;">(Bukan titik objek wisata)</span>
      </div>
    `);

  // Ambil data destinasi
  const list = await DataService.getDestinations();
  const verifiedItems = list.filter(item => DataService.isValidCoordinate(item.coordinates));
  const unverifiedItems = list.filter(item => !DataService.isValidCoordinate(item.coordinates));

  const isPagesDir = window.location.pathname.includes('/pages/');

  // Update Status Overlay Bar
  const overlayStatus = document.getElementById('map-overlay-status');
  if (overlayStatus) {
    if (verifiedItems.length === 0) {
      overlayStatus.innerHTML = `
        <strong>Status Peta Digital: Menunggu Verifikasi GPS Lapangan</strong>
        <span>
          Saat ini terdapat <strong>${unverifiedItems.length} potensi destinasi</strong> yang tercatat. 
          Sesuai SOP integritas data KKN, marker publik tidak ditayangkan menggunakan koordinat perkiraan/palsu.
        </span>
      `;
    } else {
      overlayStatus.innerHTML = `
        <strong>${verifiedItems.length} Destinasi Terverifikasi Koordinat</strong>
        <span>Menampilkan destinasi yang telah divalidasi titik koordinatnya di lapangan.</span>
      `;
    }
  }

  // Jika ada destinasi terverifikasi, render pin ke peta
  if (verifiedItems.length > 0) {
    const group = L.featureGroup();
    verifiedItems.forEach(item => {
      const lat = item.coordinates.latitude;
      const lng = item.coordinates.longitude;
      const cat = formatCategoryLabel(item.category);
      const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
      const detailHref = isFileProto 
        ? (isPagesDir ? `detail.html?slug=${encodeURIComponent(item.slug)}` : `pages/detail.html?slug=${encodeURIComponent(item.slug)}`)
        : `/detail?slug=${encodeURIComponent(item.slug)}`;

      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(`
        <div class="map-popup-card">
          <div class="map-popup-body">
            <span class="badge ${cat.class}" style="margin-bottom:0.35rem; display:inline-block;">${cat.name}</span>
            <h4 class="map-popup-title">${escapeHtml(item.name)}</h4>
            <p class="map-popup-desc">${escapeHtml(item.shortDescription || '')}</p>
            <div class="map-popup-actions">
              <a href="${detailHref}" class="btn btn-primary btn-sm" style="font-size:0.75rem; padding:0.3rem 0.65rem;">
                Lihat Detail
              </a>
              <a 
                href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="btn btn-outline btn-sm"
                style="font-size:0.75rem; padding:0.3rem 0.65rem;"
              >
                Rute
              </a>
            </div>
          </div>
        </div>
      `);
      group.addLayer(marker);
    });

    // Sesuaikan bounds peta bila ada marker
    map.fitBounds(group.getBounds().pad(0.2));
  }

  // Render daftar destinasi yang sedang dalam pendataan (side panel pada pages/peta.html)
  const pendingListContainer = document.getElementById('map-pending-destinations');
  if (pendingListContainer) {
    if (unverifiedItems.length === 0) {
      pendingListContainer.innerHTML = `<p style="font-size:0.875rem; color:#2E7D32;">Seluruh destinasi telah terverifikasi titik koordinatnya.</p>`;
    } else {
      pendingListContainer.innerHTML = unverifiedItems.map(item => {
        const cat = formatCategoryLabel(item.category);
        const detailHref = isPagesDir ? `detail.html?slug=${item.slug}` : `pages/detail.html?slug=${item.slug}`;
        return `
          <div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:1rem; margin-bottom:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.35rem;">
              <strong style="font-size:0.9375rem; color:var(--color-primary-dark);">${escapeHtml(item.name)}</strong>
              <span class="badge ${cat.class}" style="font-size:0.7rem;">${cat.name}</span>
            </div>
            <p style="font-size:0.8125rem; color:var(--color-text-muted); line-height:1.45; margin-bottom:0.5rem;">
              ${escapeHtml(item.shortDescription || '')}
            </p>
            <div style="font-size:0.75rem; color:#8D6E18; font-style:italic; margin-bottom:0.6rem;">
              Titik GPS: ${escapeHtml(item.coordinates?.source || 'Menunggu verifikasi lapangan tim KKN')}
            </div>
            <a href="${detailHref}" class="btn btn-outline btn-sm" style="font-size:0.75rem; padding:0.25rem 0.65rem;">
              Lihat Profil Destinasi &rarr;
            </a>
          </div>
        `;
      }).join('');
    }
  }
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
