/**
 * JELAJAH DESA KERTA - SCRIPT UTAMA APLIKASI
 * Navigasi responsif, helper relative link, interaksi umum
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initDynamicYear();
});

/**
 * Inisialisasi Navigasi Responsif
 */
function initNavbar() {
  const toggleBtn = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const header = document.querySelector('.site-header');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      toggleBtn.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
    });

    // Tutup menu saat menekan tombol Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        toggleBtn.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.focus();
      }
    });

    // Tutup menu saat mengklik tautan
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        toggleBtn.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Header scroll shadow effect
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // Highlight menu aktif berdasarkan path URL
  highlightActiveNav();
}

/**
 * Tandai tautan navigasi yang aktif
 */
function highlightActiveNav() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    if (
      (currentPath.endsWith('/') || currentPath.endsWith('index.html') || currentPath === '') &&
      (href === 'index.html' || href === './index.html' || href === '../index.html' || href === '/')
    ) {
      link.classList.add('active');
    } else if (href && currentPath.includes(href.replace('../', '').replace('./', ''))) {
      link.classList.add('active');
    }
  });
}

/**
 * Menampilkan tahun saat ini di footer secara otomatis
 */
function initDynamicYear() {
  const yearEls = document.querySelectorAll('.current-year');
  const nowYear = new Date().getFullYear();
  yearEls.forEach(el => {
    el.textContent = nowYear;
  });
}

/**
 * Utility: format status verifikasi ke label ramah pengguna
 */
function formatStatusLabel(status) {
  switch (status) {
    case 'verified':
      return { text: 'Terverifikasi Resmi', class: 'badge-status-verified' };
    case 'partially_verified':
      return { text: 'Tercatat Resmi • Titik GPS Menunggu Survei', class: 'badge-status-partially_verified' };
    case 'pending_verification':
    default:
      return { text: 'Dalam Pendataan Lapangan KKN', class: 'badge-status-pending_verification' };
  }
}

/**
 * Utility: format nama kategori
 */
function formatCategoryLabel(cat) {
  switch (cat) {
    case 'alam':
      return { name: 'Wisata Alam', class: 'badge-cat-alam' };
    case 'budaya':
      return { name: 'Wisata Budaya & Purbakala', class: 'badge-cat-budaya' };
    case 'religi':
      return { name: 'Wisata Religi & Spiritual', class: 'badge-cat-religi' };
    case 'agro':
      return { name: 'Agrowisata', class: 'badge-cat-agro' };
    default:
      return { name: cat, class: 'badge-cat-alam' };
  }
}
