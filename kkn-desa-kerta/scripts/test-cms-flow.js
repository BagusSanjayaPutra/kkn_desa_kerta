/**
 * JELAJAH DESA KERTA - SUITE PENGUJIAN OTOMATIS 14 SKENARIO CMS
 * Menguji alur autentikasi, proteksi route, CRUD, upload foto permanen,
 * koordinat GPS, sinkronisasi publik, filter draft, dan penanganan error.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {};
    let postData = null;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
      postData = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', err => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runCMSFlowTests() {
  console.log('================================================================');
  console.log('🧪 MEMULAI PENGUJIAN 14 SKENARIO CMS DESA KERTA');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(scenarioNum, description, condition, details = '') {
    if (condition) {
      console.log(`✅ [Skenario ${scenarioNum}] PASS: ${description}`);
      passed++;
    } else {
      console.error(`❌ [Skenario ${scenarioNum}] FAIL: ${description}. ${details}`);
      failed++;
    }
  }

  try {
    // 1. Login menggunakan akun admin
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'KertaPayangan2026!'
    });
    const token = loginRes.body && loginRes.body.token;
    assert(1, 'Login admin dengan PBKDF2 salt & hash', loginRes.status === 200 && !!token);

    // 2. Proteksi route tanpa login (Unauthorized)
    const unauthPost = await request('POST', '/api/destinations', { name: 'Ilegal' }, null);
    const unauthGetMe = await request('GET', '/api/auth/me', null, null);
    assert(2, 'Proteksi endpoint backend dari akses tanpa token (HTTP 401)', unauthPost.status === 401 && unauthGetMe.status === 401);

    // 3. Menambahkan objek wisata uji
    const createRes = await request('POST', '/api/destinations', {
      name: '[DATA UJI OTOMATIS] Bukit Eksplorasi KKN',
      category: 'alam',
      shortDescription: 'Deskripsi uji coba sistem',
      publicationStatus: 'published',
      verificationStatus: 'pending_verification'
    }, token);
    const testItem = createRes.body && createRes.body.data;
    const testId = testItem ? testItem.id : null;
    if (createRes.status !== 201 || !testItem) {
      console.log('DEBUG createRes:', createRes.status, JSON.stringify(createRes.body));
    }
    console.log('testItem.name:', JSON.stringify(testItem ? testItem.name : null));
    assert(3, 'Menambahkan objek wisata baru via CMS API', createRes.status === 201 && !!testId && testItem && testItem.name.includes('Bukit Eksplorasi'));

    // 4. Mengedit nama dan deskripsi objek wisata uji
    const updateRes = await request('PUT', `/api/destinations/${encodeURIComponent(testId)}`, {
      name: '[DATA UJI DIUBAH] Bukit Eksplorasi KKN Revisi',
      shortDescription: 'Deskripsi hasil pembaruan admin'
    }, token);
    assert(4, 'Mengedit data objek wisata dan memastikan tersimpan', updateRes.status === 200 && updateRes.body.data.name.includes('Revisi'));

    // 5. Mengunggah foto permanen (Simulasi base64 dummy PNG 1x1 piksel)
    const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await request('POST', '/api/upload', {
      fileName: 'uji-foto-kkn.png',
      base64Data: `data:image/png;base64,${dummyPngBase64}`
    }, token);
    const uploadedUrl = uploadRes.body && uploadRes.body.url;
    assert(5, 'Mengunggah foto dan tersimpan permanen di server', uploadRes.status === 201 && typeof uploadedUrl === 'string' && uploadedUrl.includes('assets/images/destinations/uploaded/'));

    // 6. Mengganti foto utama objek wisata uji
    const setPrimaryPhoto = await request('PUT', `/api/destinations/${encodeURIComponent(testId)}`, {
      photos: [
        { url: uploadedUrl, caption: 'Foto utama uji coba', source: 'Tim Uji KKN' }
      ]
    }, token);
    assert(6, 'Menetapkan dan mengganti foto utama objek wisata', setPrimaryPhoto.status === 200 && setPrimaryPhoto.body.data.photos[0].url === uploadedUrl);

    // 7. Menambah dan menghapus foto galeri objek wisata uji
    const addGalleryPhoto = await request('PUT', `/api/destinations/${encodeURIComponent(testId)}`, {
      photos: [
        { url: uploadedUrl, caption: 'Foto utama uji coba', source: 'Tim Uji KKN' },
        { url: uploadedUrl, caption: 'Foto tambahan galeri', source: 'Tim Uji KKN' }
      ]
    }, token);
    const deleteGalleryPhoto = await request('PUT', `/api/destinations/${encodeURIComponent(testId)}`, {
      photos: [
        { url: uploadedUrl, caption: 'Foto utama uji coba', source: 'Tim Uji KKN' }
      ]
    }, token);
    assert(7, 'Menambah dan menghapus foto pada galeri objek wisata', addGalleryPhoto.body.data.photos.length === 2 && deleteGalleryPhoto.body.data.photos.length === 1);

    // 8. Mengubah kategori dan status publikasi (ubah ke draft)
    const setDraftRes = await request('PUT', `/api/destinations/${encodeURIComponent(testId)}`, {
      category: 'budaya',
      publicationStatus: 'draft'
    }, token);
    assert(8, 'Mengubah kategori dan menyetel status publikasi menjadi draft', setDraftRes.status === 200 && setDraftRes.body.data.category === 'budaya' && setDraftRes.body.data.publicationStatus === 'draft');

    // 9. Mengubah koordinat uji dan status verifikasi
    const setCoordsRes = await request('PUT', `/api/destinations/${encodeURIComponent(testId)}`, {
      coordinates: {
        latitude: -8.345678,
        longitude: 115.278912,
        verified: true,
        source: 'Survei GPS Lapangan Uji KKN'
      },
      verificationStatus: 'verified'
    }, token);
    assert(9, 'Memperbarui koordinat geografis WGS84 dan status verifikasi', setCoordsRes.status === 200 && setCoordsRes.body.data.coordinates.verified === true && setCoordsRes.body.data.coordinates.latitude === -8.345678);

    // 10 & 11. Pengujian website publik (Data Draft TIDAK boleh muncul di publik)
    const publicList = await request('GET', '/api/destinations', null, null);
    const isTestItemInPublic = Array.isArray(publicList.body.data) && publicList.body.data.some(d => d.id === testId);
    assert(11, 'Data berstatus DRAFT tidak muncul di katalog publik', !isTestItemInPublic);

    // Sekarang ubah ke published, pastikan muncul di publik
    await request('PUT', `/api/destinations/${encodeURIComponent(testId)}`, { publicationStatus: 'published' }, token);
    const publicListAfterPublish = await request('GET', '/api/destinations', null, null);
    const isTestItemNowInPublic = Array.isArray(publicListAfterPublish.body.data) && publicListAfterPublish.body.data.some(d => d.id === testId);
    assert(10, 'Perubahan data admin tersinkronisasi dan tampil di website publik saat dipublikasikan', isTestItemNowInPublic);

    // 12. Menguji validasi input dan penanganan kesalahan
    const invalidCoordsRes = await request('POST', '/api/destinations', {
      name: 'Uji Koordinat Salah',
      category: 'alam',
      coordinates: { latitude: 999, longitude: 999 } // Nilai di luar rentang
    }, token);
    const invalidNameRes = await request('POST', '/api/destinations', { name: '' }, token);
    assert(12, 'Validasi input ketat (mencegah koordinat tidak valid dan nama kosong)', invalidCoordsRes.status === 400 && invalidNameRes.status === 400);

    // 13. Memastikan pengguna tanpa izin tidak dapat mengubah atau menghapus data
    const unauthorizedDelete = await request('DELETE', `/api/destinations/${encodeURIComponent(testId)}`, null, null);
    assert(13, 'Penolakan mutasi/penghapusan data tanpa otorisasi admin', unauthorizedDelete.status === 401);

    // 14. Pembersihan Data Uji & Pengujian Akses Halaman
    const cleanupRes = await request('DELETE', `/api/destinations/${encodeURIComponent(testId)}`, null, token);
    const pagesToCheck = [
      '/index.html',
      '/pages/katalog.html',
      '/pages/peta.html',
      '/pages/admin/login.html',
      '/pages/admin/index.html',
      '/pages/admin/objek-wisata.html',
      '/pages/admin/galeri.html',
      '/pages/admin/kategori.html',
      '/pages/admin/peta.html',
      '/pages/admin/pengaturan.html'
    ];
    let allPagesOk = true;
    for (const p of pagesToCheck) {
      const pageRes = await request('GET', p);
      if (pageRes.status !== 200) allPagesOk = false;
    }
    assert(14, 'Pembersihan data uji dan verifikasi seluruh rute halaman publik & admin (HTTP 200 OK)', cleanupRes.status === 200 && allPagesOk);

    console.log('\n================================================================');
    console.log(`📊 HASIL PENGUJIAN AKHIR: ${passed} LULUS, ${failed} GAGAL`);
    console.log('================================================================');

    if (failed === 0) {
      console.log('🎉 14 DARI 14 SKENARIO CMS DINYATAKAN LULUS SEMPURNA (100% PASS).\n');
      process.exit(0);
    } else {
      console.error('❌ Terdapat skenario yang gagal.\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error saat menjalankan pengujian:', err);
    process.exit(1);
  }
}

runCMSFlowTests();
