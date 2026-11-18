/**
 * AUDIT KESELURUHAN LIVE VERCEL - JELAJAH DESA KERTA
 * Memeriksa seluruh halaman, aset (CSS, JS, Gambar, Ikon), API endpoints,
 * dan tautan internal pada https://kkn-desa-kerta.vercel.app
 */

const https = require('https');

const BASE_HOST = 'kkn-desa-kerta.vercel.app';
const BASE_ORIGIN = `https://${BASE_HOST}`;

function fetchUrl(path, options = {}, postData = null) {
  return new Promise((resolve) => {
    const fullPath = path.startsWith('http') ? new URL(path).pathname + new URL(path).search : path;
    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (Audit Bot)',
      ...(options.headers || {})
    };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request({
      hostname: BASE_HOST,
      path: fullPath,
      method: options.method || 'GET',
      headers: reqHeaders
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          headers: res.headers,
          location: res.headers.location,
          body: data
        });
      });
    });

    req.on('error', err => {
      resolve({ path, status: 0, error: err.message, body: '' });
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('🔍 MEMULAI AUDIT KESELURUHAN LIVE VERCEL: ' + BASE_ORIGIN);
  console.log('================================================================\n');

  const pagesToAudit = [
    // Public routes (clean URLs & fallback)
    '/',
    '/katalog',
    '/detail?id=kerta-dest-01',
    '/detail?slug=sekar-bumi-farm',
    '/peta',
    '/galeri',
    '/tentang',
    // Admin routes
    '/admin',
    '/admin/login',
    '/admin/objek-wisata',
    '/admin/galeri',
    '/admin/kategori',
    '/admin/peta',
    '/admin/pengaturan',
    // Root alias routes
    '/objek-wisata',
    '/kategori',
    '/pengaturan'
  ];

  const issues = [];
  const checkedAssets = new Map();

  // 1. AUDIT PAGES & ASSETS
  console.log('--- TAHAP 1: Audit Status Halaman & Ekstraksi Aset ---');
  for (const pagePath of pagesToAudit) {
    const res = await fetchUrl(pagePath);
    const statusText = res.status === 200 ? '✅ 200 OK' : (res.status === 308 || res.status === 307 ? `⚠️ ${res.status} -> ${res.location}` : `❌ ${res.status}`);
    console.log(`Halaman: ${pagePath.padEnd(35)} [${statusText}]`);

    if (res.status !== 200 && res.status !== 308) {
      issues.push({ type: 'PAGE_STATUS', path: pagePath, status: res.status });
      continue;
    }

    if (res.status === 200 && res.body) {
      // Ekstraksi tag <link href="...">, <script src="...">, <img src="...">, <a href="...">
      const regex = /(?:href|src)=["']([^"']+)["']/g;
      let match;
      while ((match = regex.exec(res.body)) !== null) {
        const rawUrl = match[1];
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('#') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:') || rawUrl.startsWith('javascript:') || rawUrl.includes('${')) {
          continue;
        }

        // Resolusi URL relatif terhadap path halaman
        try {
          const resolved = new URL(rawUrl, BASE_ORIGIN + pagePath.split('?')[0]);
          const assetPath = resolved.pathname;

          if (!checkedAssets.has(assetPath)) {
            checkedAssets.set(assetPath, { originalRef: rawUrl, foundOn: pagePath, status: null });
          }
        } catch (e) {}
      }
    }
  }

  // 2. AUDIT ASSETS STATUS
  console.log(`\n--- TAHAP 2: Audit Integritas ${checkedAssets.size} Aset Unik (CSS, JS, Gambar, Favicon) ---`);
  let assetErrors = 0;
  for (const [assetPath, info] of checkedAssets.entries()) {
    const res = await fetchUrl(assetPath);
    info.status = res.status;
    if (res.status !== 200) {
      assetErrors++;
      console.log(`❌ ASET ERROR [${res.status}]: ${assetPath} (Ref: "${info.originalRef}" di ${info.foundOn})`);
      issues.push({ type: 'ASSET_ERROR', assetPath, status: res.status, ref: info.originalRef, page: info.foundOn });
    }
  }
  if (assetErrors === 0) {
    console.log(`✅ Seluruh ${checkedAssets.size} aset unik berhasil dimuat dengan status 200 OK.`);
  }

  // 3. AUDIT REST API ENDPOINTS
  console.log('\n--- TAHAP 3: Audit Seluruh REST API Endpoints ---');
  const apiTests = [
    { method: 'GET', path: '/api/destinations', expect: 200, label: 'GET /api/destinations (Publik)' },
    { method: 'GET', path: '/api/categories', expect: 200, label: 'GET /api/categories (Publik)' },
    { method: 'GET', path: '/api/stats', expect: 200, label: 'GET /api/stats (Publik)' },
    { method: 'GET', path: '/api/content', expect: 200, label: 'GET /api/content (Publik)' },
    { method: 'GET', path: '/api/auth/me', expect: 401, label: 'GET /api/auth/me tanpa token (Harus 401)' },
    { method: 'POST', path: '/api/destinations', expect: 401, label: 'POST /api/destinations tanpa token (Harus 401)' }
  ];

  for (const t of apiTests) {
    const res = await fetchUrl(t.path, { method: t.method });
    const pass = res.status === t.expect;
    console.log(`${pass ? '✅' : '❌'} ${t.label}: Status ${res.status}`);
    if (!pass) issues.push({ type: 'API_STATUS', path: t.path, expected: t.expect, actual: res.status });
  }

  // 4. AUDIT AUTENTIKASI ADMIN & OPERASI TERPROTEKSI
  console.log('\n--- TAHAP 4: Audit Alur Autentikasi Admin & Mutasi ---');
  const loginRes = await fetchUrl('/api/auth/login', { method: 'POST' }, JSON.stringify({
    username: 'admin',
    password: 'KertaPayangan2026!'
  }));

  let token = null;
  try {
    const json = JSON.parse(loginRes.body);
    token = json.token;
  } catch (e) {}

  if (loginRes.status === 200 && token) {
    console.log('✅ Login Admin Berhasil. Token diterima.');

    // Tes /api/auth/me dengan token
    const meRes = await fetchUrl('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`${meRes.status === 200 ? '✅' : '❌'} GET /api/auth/me dengan Bearer token: Status ${meRes.status}`);

    // Tes GET /api/destinations?all=true dengan token
    const allDestRes = await fetchUrl('/api/destinations?all=true', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    try {
      const allData = JSON.parse(allDestRes.body);
      console.log(`✅ Destinasi lengkap terambil (Total: ${allData.data ? allData.data.length : 0})`);
    } catch(e) {
      console.log('❌ Gagal mem-parse respon /api/destinations?all=true');
    }

  } else {
    console.log(`❌ Login Admin Gagal: Status ${loginRes.status}, Body: ${loginRes.body.slice(0, 100)}`);
    issues.push({ type: 'ADMIN_AUTH_FAILED', status: loginRes.status });
  }

  console.log('\n================================================================');
  console.log(`📊 TOTAL KENDALA / ISSUE TERDETEKSI: ${issues.length}`);
  console.log('================================================================');
  if (issues.length > 0) {
    console.log(JSON.stringify(issues, null, 2));
  }
}

runAudit();
