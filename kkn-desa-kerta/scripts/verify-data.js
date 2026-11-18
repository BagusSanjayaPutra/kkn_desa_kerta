/**
 * JELAJAH DESA KERTA - TEST SUITE & VALIDASI INTEGRITAS DATA
 * Skrip otomatis untuk memeriksa kepatuhan skema, keunikan ID/slug,
 * integritas geografis, serta ketersediaan modul Admin CMS.
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'destinations.json');
const CAT_FILE = path.join(__dirname, '..', 'data', 'categories.json');
const ADMIN_CONF = path.join(__dirname, '..', 'data', 'admin-config.json');

function runTests() {
  console.log('=== MEMULAI PENGUJIAN INTEGRITAS DATA & SKEMA CMS ===\n');
  let errors = 0;
  let warnings = 0;

  // 1. Uji keberadaan dan parsing JSON
  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ GAGAL: File data/destinations.json tidak ditemukan!');
    process.exit(1);
  }

  let data;
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    data = JSON.parse(raw);
    console.log('✅ Uji 1: Parsing destinations.json berhasil.');
  } catch (err) {
    console.error('❌ GAGAL: File destinations.json rusak / tidak valid:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('❌ GAGAL: destinations.json harus berupa array!');
    process.exit(1);
  }

  console.log(`ℹ️  Jumlah entri destinasi terdaftar: ${data.length}`);

  // 2. Uji File Konfigurasi Tambahan CMS
  if (fs.existsSync(CAT_FILE)) {
    console.log('✅ Uji 2: File data/categories.json terverifikasi.');
  } else {
    console.error('❌ GAGAL: data/categories.json tidak ditemukan!');
    errors++;
  }

  if (fs.existsSync(ADMIN_CONF)) {
    console.log('✅ Uji 3: File data/admin-config.json terverifikasi.');
  } else {
    console.error('❌ GAGAL: data/admin-config.json tidak ditemukan!');
    errors++;
  }

  // 3. Uji keunikan ID dan Slug serta status publikasi
  const seenIds = new Set();
  const seenSlugs = new Set();
  const validCategories = new Set(['alam', 'budaya', 'religi', 'agro']);
  const validStatuses = new Set(['verified', 'partially_verified', 'pending_verification']);
  const validPubStatuses = new Set(['published', 'draft', 'archived']);

  data.forEach((item, idx) => {
    const prefix = `[Item #${idx + 1} - ${item.name || 'TANPA NAMA'}]`;

    // ID
    if (!item.id || typeof item.id !== 'string') {
      console.error(`❌ ${prefix}: ID tidak valid atau kosong.`);
      errors++;
    } else if (seenIds.has(item.id)) {
      console.error(`❌ ${prefix}: Duplikasi ID "${item.id}"!`);
      errors++;
    } else {
      seenIds.add(item.id);
    }

    // Slug
    if (!item.slug || typeof item.slug !== 'string') {
      console.error(`❌ ${prefix}: Slug tidak valid atau kosong.`);
      errors++;
    } else if (seenSlugs.has(item.slug)) {
      console.error(`❌ ${prefix}: Duplikasi Slug "${item.slug}"!`);
      errors++;
    } else {
      seenSlugs.add(item.slug);
    }

    // Kategori
    if (!validCategories.has(item.category)) {
      console.error(`❌ ${prefix}: Kategori "${item.category}" tidak dikenal.`);
      errors++;
    }

    // Status Verifikasi
    if (!validStatuses.has(item.verificationStatus)) {
      console.error(`❌ ${prefix}: verificationStatus "${item.verificationStatus}" tidak valid.`);
      errors++;
    }

    // Status Publikasi
    if (item.publicationStatus && !validPubStatuses.has(item.publicationStatus)) {
      console.error(`❌ ${prefix}: publicationStatus "${item.publicationStatus}" tidak valid.`);
      errors++;
    }

    // Integritas Koordinat Geografis (ATURAN UTAMA: Dilarang koordinat palsu!)
    if (!item.coordinates || typeof item.coordinates !== 'object') {
      console.error(`❌ ${prefix}: Objek coordinates hilang.`);
      errors++;
    } else {
      const { latitude, longitude, verified } = item.coordinates;
      if (verified === true) {
        if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
          console.error(`❌ ${prefix}: Koordinat berstatus verified=true tetapi nilainya null/NaN!`);
          errors++;
        } else {
          if (latitude < -90 || latitude > 90) {
            console.error(`❌ ${prefix}: Latitude ${latitude} di luar rentang [-90, 90]!`);
            errors++;
          }
          if (longitude < -180 || longitude > 180) {
            console.error(`❌ ${prefix}: Longitude ${longitude} di luar rentang [-180, 180]!`);
            errors++;
          }
        }
      } else {
        if (latitude !== null || longitude !== null) {
          console.warn(`⚠️  ${prefix}: PERINGATAN - verified=false tetapi koordinat memiliki nilai numerik (${latitude}, ${longitude}).`);
          warnings++;
        }
      }
    }
  });

  console.log('\n=== UJI INTEGRITAS FILE HTML & MODUL ADMIN CMS ===');
  const requiredFiles = [
    // Halaman Publik
    'index.html',
    'pages/katalog.html',
    'pages/detail.html',
    'pages/peta.html',
    'pages/galeri.html',
    'pages/tentang.html',
    // Halaman Admin CMS
    'pages/admin/login.html',
    'pages/admin/index.html',
    'pages/admin/objek-wisata.html',
    'pages/admin/galeri.html',
    'pages/admin/kategori.html',
    'pages/admin/peta.html',
    'pages/admin/pengaturan.html',
    // Stylesheets & Scripts
    'assets/css/style.css',
    'assets/css/components.css',
    'assets/css/leaflet-custom.css',
    'assets/css/admin.css',
    'assets/js/data-service.js',
    'assets/js/app.js',
    'assets/js/katalog.js',
    'assets/js/detail.js',
    'assets/js/map.js',
    'assets/js/galeri.js',
    'assets/js/admin-api.js',
    'assets/js/admin-auth.js',
    'data/destinations.js'
  ];

  requiredFiles.forEach(relPath => {
    const fullPath = path.join(__dirname, '..', relPath);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ File terverifikasi: ${relPath}`);
    } else {
      console.error(`❌ File hilang: ${relPath}`);
      errors++;
    }
  });

  console.log('\n=== RINGKASAN HASIL PENGUJIAN ===');
  console.log(`Error Terdeteksi: ${errors}`);
  console.log(`Peringatan: ${warnings}`);

  if (errors > 0) {
    console.error('❌ HASIL: Pengujian GAGAL. Perbaiki kesalahan di atas!');
    process.exit(1);
  } else {
    console.log('🎉 HASIL: Seluruh pengujian integritas BERHASIL (PASS 100%). Modul Publik dan Admin CMS valid.');
    process.exit(0);
  }
}

runTests();
