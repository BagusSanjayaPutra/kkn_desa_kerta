/**
 * JELAJAH DESA KERTA - FULL-STACK HTTP SERVER & REST API
 * Dilengkapi Sistem Autentikasi PBKDF2, Otorisasi Token,
 * REST API CRUD Destinasi & Kategori, Upload Foto Permanen, dan Auto-Sync.
 * 
 * Zero-dependency: Berjalan murni menggunakan modul bawaan Node.js.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const UPLOAD_DIR = path.join(BASE_DIR, 'assets', 'images', 'destinations', 'uploaded');

// Pastikan folder-folder esensial tersedia
try {
  [BACKUP_DIR, UPLOAD_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
} catch (err) {
  // Diabaikan pada environment read-only seperti Vercel serverless
}

// Sesi aktif in-memory: token -> { username, createdAt, expiresAt }
const activeSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ==================== HELPER UTILITAS ====================

const {
  isGitHubSyncEnabled,
  commitFileToGitHub,
  fetchFileFromGitHub,
  fetchBinaryFromGitHub,
  syncAllDataOnStartup
} = require('./lib/github-sync');

const TMP_DATA_DIR = path.join(os.tmpdir(), 'desa-kerta-data');

// Sinkronisasi data awal dari GitHub saat serverless container aktif
if (isGitHubSyncEnabled()) {
  syncAllDataOnStartup(TMP_DATA_DIR).catch(err => {
    console.error('[Startup Sync Error]:', err.message);
  });
}

function readJsonFile(filename, defaultValue = null) {
  try {
    const tmpFile = path.join(TMP_DATA_DIR, filename);
    const origFile = path.join(DATA_DIR, filename);
    const targetFile = fs.existsSync(tmpFile) ? tmpFile : origFile;
    if (!fs.existsSync(targetFile)) return defaultValue;
    const raw = fs.readFileSync(targetFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error membaca ${filename}:`, err.message);
    return defaultValue;
  }
}

async function writeJsonFile(filename, data) {
  let success = false;
  // 1. Coba tulis ke DATA_DIR lokal
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    success = true;
  } catch (err) {
    // Read-only filesystem di serverless environment
  }

  // 2. Simpan juga ke TMP_DATA_DIR agar container serverless dapat membaca mutasi berikutnya
  try {
    if (!fs.existsSync(TMP_DATA_DIR)) {
      fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    }
    const tmpFile = path.join(TMP_DATA_DIR, filename);
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    success = true;
  } catch (err) {
    console.error(`Gagal menulis tmp file ${filename}:`, err.message);
  }

  // Jika yang diperbarui adalah destinations.json, simpan backup dan sinkronkan destinations.js
  if (filename === 'destinations.json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backupPath = path.join(BACKUP_DIR, `destinations-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}

    try {
      const jsPath = path.join(DATA_DIR, 'destinations.js');
      const jsContent = `window.DESA_KERTA_DESTINATIONS = ${JSON.stringify(data, null, 2)};\n`;
      fs.writeFileSync(jsPath, jsContent, 'utf8');
    } catch (e) {}
  }

  // 3. Simpan permanen ke GitHub jika fitur GitHub Sync aktif
  if (isGitHubSyncEnabled()) {
    try {
      await commitFileToGitHub({
        filePath: `data/${filename}`,
        content: JSON.stringify(data, null, 2),
        message: `cms: update ${filename} [skip ci]`
      });

      if (filename === 'destinations.json') {
        const jsContent = `window.DESA_KERTA_DESTINATIONS = ${JSON.stringify(data, null, 2)};\n`;
        await commitFileToGitHub({
          filePath: 'data/destinations.js',
          content: jsContent,
          message: 'cms: update destinations.js [skip ci]'
        });
      }
    } catch (err) {
      console.error(`[GitHub Sync Error] ${filename}:`, err.message);
    }
  }

  return success;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, {
    ok: false,
    error: message,
    details: details
  });
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body, 'utf8'));
    return Promise.resolve(Buffer.from(JSON.stringify(req.body), 'utf8'));
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB limit

    req.on('data', chunk => {
      totalSize += chunk.length;
      if (totalSize > MAX_SIZE) {
        reject(new Error('Payload terlalu besar (Maks 15MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', err => reject(err));
  });
}

// Verifikasi password dengan PBKDF2
function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

// Hash password baru
function hashNewPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Buat stateless HMAC token yang terverifikasi di semua instance serverless
function createAdminToken(username) {
  const adminConfig = readJsonFile('admin-config.json');
  const payload = {
    username,
    name: (adminConfig && adminConfig.name) || 'Administrator',
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = (adminConfig && adminConfig.passwordHash) || 'desa-kerta-cms-secret';
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const token = `${payloadB64}.${sig}`;

  activeSessions.set(token, payload);
  return token;
}

// Verifikasi stateless HMAC token
function verifyStatelessToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  try {
    const adminConfig = readJsonFile('admin-config.json');
    const secret = (adminConfig && adminConfig.passwordHash) || 'desa-kerta-cms-secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      if (Date.now() > payload.expiresAt) return null;
      return payload;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Ekstraksi & validasi otorisasi admin (mendukung token Bearer dan Cookie)
function getAdminSession(req) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/admin_token=([a-zA-Z0-9_.-]+)/);
    if (match) token = match[1];
  }

  if (!token) return null;

  // 1. Cek in-memory session (lokal / container yang sama)
  const session = activeSessions.get(token);
  if (session) {
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token);
      return null;
    }
    return { token, session };
  }

  // 2. Verifikasi stateless token HMAC (resilient lintas lambda serverless)
  const statelessPayload = verifyStatelessToken(token);
  if (statelessPayload) {
    return { token, session: statelessPayload };
  }

  return null;
}

function requireAdmin(req, res) {
  const auth = getAdminSession(req);
  if (!auth) {
    sendError(res, 401, 'Akses ditolak: Anda harus login sebagai administrator untuk melakukan tindakan ini.');
    return null;
  }
  return auth;
}

// ==================== ROUTE HANDLERS ====================

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  // ==================== REST API ROUTES ====================

  if (pathname.startsWith('/api/')) {
    try {
      // 1. AUTH: LOGIN
      if (pathname === '/api/auth/login' && method === 'POST') {
        const bodyBuf = await readBody(req);
        let body;
        try {
          body = JSON.parse(bodyBuf.toString('utf8'));
        } catch (e) {
          return sendError(res, 400, 'Format JSON request tidak valid.');
        }

        const { username, password } = body || {};
        if (!username || !password) {
          return sendError(res, 400, 'Username dan password wajib diisi.');
        }

        const adminConfig = readJsonFile('admin-config.json');
        if (!adminConfig) {
          return sendError(res, 500, 'Konfigurasi akun admin tidak ditemukan di server.');
        }

        if (username.trim() !== adminConfig.adminUser || !verifyPassword(password, adminConfig.salt, adminConfig.passwordHash)) {
          return sendError(res, 401, 'Kombinasi nama pengguna atau kata sandi tidak cocok.');
        }

        // Buat session token aman (terdaftar di activeSessions & verifiable secara stateless)
        const token = createAdminToken(adminConfig.adminUser);

        // Set cookie HTTP-only (opsional untuk kemudahan navigasi dashboard)
        res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);

        return sendJson(res, 200, {
          ok: true,
          message: 'Login berhasil.',
          token,
          user: {
            username: adminConfig.adminUser,
            name: adminConfig.name
          }
        });
      }

      // 2. AUTH: STATUS / ME
      if (pathname === '/api/auth/me' && method === 'GET') {
        const auth = getAdminSession(req);
        if (!auth) {
          return sendError(res, 401, 'Sesi tidak aktif atau telah kedaluwarsa.');
        }
        return sendJson(res, 200, {
          ok: true,
          authenticated: true,
          user: {
            username: auth.session.username,
            name: auth.session.name
          }
        });
      }

      // 3. AUTH: LOGOUT
      if (pathname === '/api/auth/logout' && method === 'POST') {
        const auth = getAdminSession(req);
        if (auth) {
          activeSessions.delete(auth.token);
        }
        res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Max-Age=0');
        return sendJson(res, 200, { ok: true, message: 'Logout berhasil.' });
      }

      // 4. AUTH: GANTI PASSWORD
      if (pathname === '/api/auth/change-password' && method === 'POST') {
        if (!requireAdmin(req, res)) return;

        const bodyBuf = await readBody(req);
        const { currentPassword, newPassword } = JSON.parse(bodyBuf.toString('utf8') || '{}');

        if (!currentPassword || !newPassword) {
          return sendError(res, 400, 'Kata sandi saat ini dan kata sandi baru wajib diisi.');
        }
        if (newPassword.length < 8) {
          return sendError(res, 400, 'Kata sandi baru minimal 8 karakter.');
        }

        const adminConfig = readJsonFile('admin-config.json');
        if (!verifyPassword(currentPassword, adminConfig.salt, adminConfig.passwordHash)) {
          return sendError(res, 400, 'Kata sandi saat ini salah.');
        }

        const { salt, hash } = hashNewPassword(newPassword);
        adminConfig.salt = salt;
        adminConfig.passwordHash = hash;
        adminConfig.lastPasswordChange = new Date().toISOString();
        await writeJsonFile('admin-config.json', adminConfig);

        return sendJson(res, 200, { ok: true, message: 'Kata sandi berhasil diperbarui.' });
      }

      // 5. STATS SUMMARY (UNTUK DASHBOARD ADMIN & PUBLIK)
      if (pathname === '/api/stats' && method === 'GET') {
        const destinations = readJsonFile('destinations.json', []);
        const total = destinations.length;
        const verifiedCoords = destinations.filter(d => d.coordinates && d.coordinates.verified === true).length;
        const pendingCoords = total - verifiedCoords;
        const publishedCount = destinations.filter(d => (d.publicationStatus || 'published') === 'published').length;
        const draftCount = destinations.filter(d => d.publicationStatus === 'draft').length;
        const partiallyVerified = destinations.filter(d => d.verificationStatus === 'partially_verified').length;
        const pendingVerification = destinations.filter(d => d.verificationStatus === 'pending_verification').length;
        
        let totalPhotos = 0;
        destinations.forEach(d => {
          if (Array.isArray(d.photos)) totalPhotos += d.photos.length;
        });

        return sendJson(res, 200, {
          ok: true,
          stats: {
            total,
            published: publishedCount,
            drafts: draftCount,
            verifiedCoords,
            pendingCoords,
            partiallyVerified,
            pendingVerification,
            totalPhotos
          }
        });
      }

      // 6. DESTINASI: GET ALL
      if (pathname === '/api/destinations' && method === 'GET') {
        const destinations = readJsonFile('destinations.json', []);
        const includeAll = parsedUrl.searchParams.get('all') === 'true';
        const auth = getAdminSession(req);

        // Jika minta all dan memiliki token admin, kembalikan semua data (termasuk draft)
        if (includeAll && auth) {
          return sendJson(res, 200, { ok: true, data: destinations });
        }

        // Publik: Hanya kembalikan yang publicationStatus === 'published' (atau belum diset, default published)
        const publicList = destinations.filter(d => (d.publicationStatus || 'published') === 'published');
        return sendJson(res, 200, { ok: true, data: publicList });
      }

      // 7. DESTINASI: GET BY ID OR SLUG
      if (pathname.startsWith('/api/destinations/') && method === 'GET') {
        const param = decodeURIComponent(pathname.replace('/api/destinations/', '').trim());
        const destinations = readJsonFile('destinations.json', []);
        const item = destinations.find(d => d.id === param || d.slug === param);

        if (!item) {
          return sendError(res, 404, 'Destinasi tidak ditemukan.');
        }

        // Jika item berstatus draft dan bukan admin, tolak akses publik
        if (item.publicationStatus === 'draft' && !getAdminSession(req)) {
          return sendError(res, 404, 'Destinasi tidak ditemukan atau belum dipublikasikan.');
        }

        return sendJson(res, 200, { ok: true, data: item });
      }

      // 8. DESTINASI: CREATE (POST)
      if (pathname === '/api/destinations' && method === 'POST') {
        if (!requireAdmin(req, res)) return;

        const bodyBuf = await readBody(req);
        let body;
        try {
          body = JSON.parse(bodyBuf.toString('utf8'));
        } catch (e) {
          return sendError(res, 400, 'Format JSON request tidak valid.');
        }

        if (!body.name || !body.name.trim()) {
          return sendError(res, 400, 'Nama objek wisata wajib diisi.');
        }
        if (!body.category || !body.category.trim()) {
          return sendError(res, 400, 'Kategori objek wisata wajib dipilih.');
        }

        const destinations = readJsonFile('destinations.json', []);

        // Buat ID unik (WIS-001, WIS-002, ...)
        let nextNumber = destinations.length + 1;
        let newId = `WIS-${String(nextNumber).padStart(3, '0')}`;
        while (destinations.some(d => d.id === newId)) {
          nextNumber++;
          newId = `WIS-${String(nextNumber).padStart(3, '0')}`;
        }

        // Buat slug unik
        let baseSlug = (body.slug || body.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (!baseSlug) baseSlug = `wisata-${Date.now()}`;
        let slug = baseSlug;
        let slugCounter = 1;
        while (destinations.some(d => d.slug === slug)) {
          slug = `${baseSlug}-${slugCounter++}`;
        }

        // Validasi koordinat (ATURAN KETAT: jangan koordinat acak)
        let coords = {
          latitude: null,
          longitude: null,
          verified: false,
          source: body.coordinates?.source || 'Menunggu verifikasi titik GPS lapangan tim survei KKN',
          verifiedAt: body.coordinates?.verifiedAt || null
        };

        if (body.coordinates && body.coordinates.latitude !== null && body.coordinates.latitude !== undefined && body.coordinates.latitude !== '') {
          const lat = Number(body.coordinates.latitude);
          const lng = Number(body.coordinates.longitude);
          if (isNaN(lat) || lat < -90 || lat > 90) {
            return sendError(res, 400, 'Nilai Latitude harus berupa angka valid antara -90 dan 90.');
          }
          if (isNaN(lng) || lng < -180 || lng > 180) {
            return sendError(res, 400, 'Nilai Longitude harus berupa angka valid antara -180 dan 180.');
          }
          coords.latitude = lat;
          coords.longitude = lng;
          coords.verified = body.coordinates.verified === true;
        }

        const now = new Date().toISOString();
        const newDestination = {
          id: newId,
          slug: slug,
          name: body.name.trim(),
          category: body.category.trim(),
          shortDescription: body.shortDescription ? body.shortDescription.trim() : '',
          description: body.description ? body.description.trim() : '',
          address: body.address ? body.address.trim() : null,
          coordinates: coords,
          photos: Array.isArray(body.photos) ? body.photos : [],
          facilities: Array.isArray(body.facilities) ? body.facilities : [],
          accessNotes: body.accessNotes ? body.accessNotes.trim() : null,
          openingHours: body.openingHours ? body.openingHours.trim() : 'Informasi belum tersedia.',
          entranceFee: body.entranceFee ? body.entranceFee.trim() : 'Belum dikonfirmasi.',
          contact: body.contact ? body.contact.trim() : null,
          sources: Array.isArray(body.sources) && body.sources.length > 0 ? body.sources : ['Survei Pendataan KKN'],
          verificationStatus: body.verificationStatus || 'pending_verification',
          publicationStatus: body.publicationStatus || 'draft',
          verificationNotes: body.verificationNotes || 'Data baru ditambahkan melalui CMS admin.',
          createdAt: now,
          lastUpdated: now.split('T')[0]
        };

        destinations.push(newDestination);
        await writeJsonFile('destinations.json', destinations);

        return sendJson(res, 201, {
          ok: true,
          message: 'Objek wisata berhasil ditambahkan.',
          data: newDestination
        });
      }

      // 9. DESTINASI: UPDATE (PUT)
      if (pathname.startsWith('/api/destinations/') && method === 'PUT') {
        if (!requireAdmin(req, res)) return;

        const id = decodeURIComponent(pathname.replace('/api/destinations/', '').trim());
        const bodyBuf = await readBody(req);
        let body;
        try {
          body = JSON.parse(bodyBuf.toString('utf8'));
        } catch (e) {
          return sendError(res, 400, 'Format JSON request tidak valid.');
        }

        const destinations = readJsonFile('destinations.json', []);
        const index = destinations.findIndex(d => d.id === id);
        if (index === -1) {
          return sendError(res, 404, 'Objek wisata dengan ID tersebut tidak ditemukan.');
        }

        const existing = destinations[index];

        // Validasi koordinat jika diubah
        let coords = { ...existing.coordinates };
        if (body.coordinates) {
          if (body.coordinates.latitude !== null && body.coordinates.latitude !== undefined && body.coordinates.latitude !== '') {
            const lat = Number(body.coordinates.latitude);
            const lng = Number(body.coordinates.longitude);
            if (isNaN(lat) || lat < -90 || lat > 90) {
              return sendError(res, 400, 'Nilai Latitude harus berupa angka valid antara -90 dan 90.');
            }
            if (isNaN(lng) || lng < -180 || lng > 180) {
              return sendError(res, 400, 'Nilai Longitude harus berupa angka valid antara -180 dan 180.');
            }
            coords.latitude = lat;
            coords.longitude = lng;
            coords.verified = body.coordinates.verified === true;
            coords.source = body.coordinates.source || coords.source;
            coords.verifiedAt = body.coordinates.verifiedAt || coords.verifiedAt;
          } else {
            coords.latitude = null;
            coords.longitude = null;
            coords.verified = false;
            coords.source = body.coordinates.source || coords.source;
          }
        }

        const now = new Date().toISOString();
        const updated = {
          ...existing,
          name: body.name ? body.name.trim() : existing.name,
          slug: body.slug ? body.slug.trim() : existing.slug,
          category: body.category ? body.category.trim() : existing.category,
          shortDescription: body.shortDescription !== undefined ? body.shortDescription.trim() : existing.shortDescription,
          description: body.description !== undefined ? body.description.trim() : existing.description,
          address: body.address !== undefined ? body.address : existing.address,
          coordinates: coords,
          photos: Array.isArray(body.photos) ? body.photos : existing.photos,
          facilities: Array.isArray(body.facilities) ? body.facilities : existing.facilities,
          accessNotes: body.accessNotes !== undefined ? body.accessNotes : existing.accessNotes,
          openingHours: body.openingHours !== undefined ? body.openingHours : existing.openingHours,
          entranceFee: body.entranceFee !== undefined ? body.entranceFee : existing.entranceFee,
          contact: body.contact !== undefined ? body.contact : existing.contact,
          sources: Array.isArray(body.sources) ? body.sources : existing.sources,
          verificationStatus: body.verificationStatus || existing.verificationStatus,
          publicationStatus: body.publicationStatus || existing.publicationStatus,
          verificationNotes: body.verificationNotes !== undefined ? body.verificationNotes : existing.verificationNotes,
          lastUpdated: now.split('T')[0]
        };

        destinations[index] = updated;
        await writeJsonFile('destinations.json', destinations);

        return sendJson(res, 200, {
          ok: true,
          message: 'Data objek wisata berhasil diperbarui.',
          data: updated
        });
      }

      // 10. DESTINASI: DELETE
      if (pathname.startsWith('/api/destinations/') && method === 'DELETE') {
        if (!requireAdmin(req, res)) return;

        const id = decodeURIComponent(pathname.replace('/api/destinations/', '').trim());
        const destinations = readJsonFile('destinations.json', []);
        const index = destinations.findIndex(d => d.id === id);

        if (index === -1) {
          return sendError(res, 404, 'Objek wisata dengan ID tersebut tidak ditemukan.');
        }

        const deleted = destinations.splice(index, 1)[0];
        await writeJsonFile('destinations.json', destinations);

        return sendJson(res, 200, {
          ok: true,
          message: `Objek wisata "${deleted.name}" berhasil dihapus.`,
          data: deleted
        });
      }

      // 11. KATEGORI: GET ALL
      if (pathname === '/api/categories' && method === 'GET') {
        const categories = readJsonFile('categories.json', []);
        return sendJson(res, 200, { ok: true, data: categories });
      }

      // 12. KATEGORI: CREATE (POST)
      if (pathname === '/api/categories' && method === 'POST') {
        if (!requireAdmin(req, res)) return;

        const bodyBuf = await readBody(req);
        const { slug, name, description } = JSON.parse(bodyBuf.toString('utf8') || '{}');

        if (!name || !name.trim()) return sendError(res, 400, 'Nama kategori wajib diisi.');

        const categories = readJsonFile('categories.json', []);
        const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        if (categories.some(c => c.slug === cleanSlug)) {
          return sendError(res, 400, `Kategori dengan slug "${cleanSlug}" sudah ada.`);
        }

        const newCat = {
          slug: cleanSlug,
          name: name.trim(),
          description: description ? description.trim() : '',
          badgeClass: `badge-cat-${cleanSlug}`
        };

        categories.push(newCat);
        await writeJsonFile('categories.json', categories);

        return sendJson(res, 201, { ok: true, message: 'Kategori berhasil ditambahkan.', data: newCat });
      }

      // 13. KATEGORI: DELETE
      if (pathname.startsWith('/api/categories/') && method === 'DELETE') {
        if (!requireAdmin(req, res)) return;

        const slug = decodeURIComponent(pathname.replace('/api/categories/', '').trim());
        const destinations = readJsonFile('destinations.json', []);

        // Relational Guard: Cegah hapus jika kategori masih dipakai oleh objek wisata!
        const usageCount = destinations.filter(d => d.category === slug).length;
        if (usageCount > 0) {
          return sendError(res, 400, `Kategori "${slug}" tidak dapat dihapus karena masih digunakan oleh ${usageCount} objek wisata. Pindahkan kategori objek wisata terlebih dahulu.`);
        }

        const categories = readJsonFile('categories.json', []);
        const index = categories.findIndex(c => c.slug === slug);
        if (index === -1) {
          return sendError(res, 404, 'Kategori tidak ditemukan.');
        }

        const deleted = categories.splice(index, 1)[0];
        await writeJsonFile('categories.json', categories);

        return sendJson(res, 200, { ok: true, message: 'Kategori berhasil dihapus.', data: deleted });
      }

      // 14. SITE CONTENT: GET & PUT
      if (pathname === '/api/content' && method === 'GET') {
        const content = readJsonFile('site-content.json', {});
        return sendJson(res, 200, { ok: true, data: content });
      }

      if (pathname === '/api/content' && method === 'PUT') {
        if (!requireAdmin(req, res)) return;

        const bodyBuf = await readBody(req);
        const newContent = JSON.parse(bodyBuf.toString('utf8') || '{}');
        await writeJsonFile('site-content.json', newContent);

        return sendJson(res, 200, { ok: true, message: 'Konten website berhasil diperbarui.', data: newContent });
      }

      // 15. UPLOAD FOTO PERMANEN
      if (pathname === '/api/upload' && method === 'POST') {
        if (!requireAdmin(req, res)) return;

        const contentType = req.headers['content-type'] || '';
        const bodyBuf = await readBody(req);

        let fileBuffer = null;
        let originalName = 'foto.jpg';
        let extension = '.jpg';

        if (contentType.includes('application/json')) {
          // Mendukung JSON base64 upload
          const payload = JSON.parse(bodyBuf.toString('utf8') || '{}');
          if (!payload.base64Data) {
            return sendError(res, 400, 'Payload base64Data gambar tidak ditemukan.');
          }

          // Bersihkan data URL prefix jika ada
          const base64Str = payload.base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
          fileBuffer = Buffer.from(base64Str, 'base64');
          originalName = payload.fileName || 'upload.jpg';
          extension = path.extname(originalName).toLowerCase() || '.jpg';
        } else if (contentType.includes('multipart/form-data')) {
          // Native Multipart Parser
          const boundaryMatch = contentType.match(/boundary=(?:["']?)([^"';]+)(?:["']?)/);
          if (!boundaryMatch) {
            return sendError(res, 400, 'Boundary multipart/form-data tidak valid.');
          }
          const boundary = boundaryMatch[1];
          const parts = splitMultipart(bodyBuf, boundary);

          for (const part of parts) {
            if (part.headers['content-disposition'] && part.headers['content-disposition'].includes('filename=')) {
              fileBuffer = part.data;
              const nameMatch = part.headers['content-disposition'].match(/filename="?([^";]+)"?/);
              if (nameMatch) {
                originalName = nameMatch[1];
                extension = path.extname(originalName).toLowerCase();
              }
              break;
            }
          }
        } else {
          return sendError(res, 400, 'Content-Type harus berupa multipart/form-data atau application/json.');
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          return sendError(res, 400, 'File gambar kosong atau gagal diekstraksi.');
        }

        // Validasi ukuran: Maksimal 5MB
        if (fileBuffer.length > 5 * 1024 * 1024) {
          return sendError(res, 400, 'Ukuran file gambar melebihi batas maksimal 5 MB.');
        }

        // Validasi tipe ekstensi gambar
        const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
        if (!allowedExtensions.has(extension)) {
          return sendError(res, 400, `Format file "${extension}" tidak didukung. Harap unggah JPG, PNG, WebP, atau SVG.`);
        }

        // Simpan file permanen dengan nama unik
        const safeTimestamp = Date.now();
        const randomId = crypto.randomBytes(6).toString('hex');
        const cleanBase = path.basename(originalName, extension).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
        const newFileName = `${safeTimestamp}-${cleanBase || 'foto'}-${randomId}${extension}`;
        const targetPath = path.join(UPLOAD_DIR, newFileName);

        try {
          fs.writeFileSync(targetPath, fileBuffer);
        } catch (e) {
          // Read-only filesystem di serverless environment
        }

        // Simpan ke TMP_DATA_DIR/uploads agar container serverless dapat langsung melayani file ini
        const tmpUploadsDir = path.join(TMP_DATA_DIR, 'uploads');
        try {
          if (!fs.existsSync(tmpUploadsDir)) fs.mkdirSync(tmpUploadsDir, { recursive: true });
          fs.writeFileSync(path.join(tmpUploadsDir, newFileName), fileBuffer);
        } catch (e) {
          console.error('[Upload TMP Error]:', e.message);
        }

        // Commit biner ke GitHub repository secara permanen
        if (isGitHubSyncEnabled()) {
          try {
            await commitFileToGitHub({
              filePath: `assets/images/destinations/uploaded/${newFileName}`,
              content: fileBuffer,
              isBinary: true,
              message: `cms: upload photo ${newFileName} [skip ci]`
            });
          } catch (err) {
            console.error('[GitHub Sync Upload Error]:', err.message);
          }
        }

        const publicUrl = `assets/images/destinations/uploaded/${newFileName}`;
        return sendJson(res, 201, {
          ok: true,
          message: 'Foto berhasil diunggah dan disimpan secara permanen.',
          url: publicUrl,
          fileName: newFileName,
          fileSize: fileBuffer.length
        });
      }

      // Route API tidak ditemukan
      return sendError(res, 404, `Endpoint API ${method} ${pathname} tidak ditemukan.`);
    } catch (apiErr) {
      console.error('API Error:', apiErr);
      return sendError(res, 500, 'Terjadi kesalahan pada server internal.', apiErr.message);
    }
  }

  // ==================== STATIC FILE ROUTING ====================

  let reqUrl = decodeURI(pathname);

  // Alias rute praktis admin (mendukung format clean URL maupun dengan ekstensi .html)
  if (reqUrl.startsWith('/admin')) {
    const sub = reqUrl.replace(/^\/admin\/?/, '').trim();
    if (!sub || sub === 'index' || sub === 'index.html') {
      reqUrl = '/pages/admin/index.html';
    } else {
      const baseName = sub.endsWith('.html') ? sub.slice(0, -5) : sub;
      const candidateFile = path.join(BASE_DIR, 'pages', 'admin', `${baseName}.html`);
      if (fs.existsSync(candidateFile)) {
        reqUrl = `/pages/admin/${baseName}.html`;
      }
    }
  } else if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/index.html';
  } else if (reqUrl === '/katalog' || reqUrl === '/katalog.html') {
    reqUrl = '/pages/katalog.html';
  } else if (reqUrl === '/detail' || reqUrl === '/detail.html') {
    reqUrl = '/pages/detail.html';
  } else if (reqUrl === '/peta' || reqUrl === '/peta.html') {
    reqUrl = '/pages/peta.html';
  } else if (reqUrl === '/galeri' || reqUrl === '/galeri.html') {
    reqUrl = '/pages/galeri.html';
  } else if (reqUrl === '/tentang' || reqUrl === '/tentang.html') {
    reqUrl = '/pages/tentang.html';
  } else if (reqUrl === '/objek-wisata' || reqUrl === '/objek-wisata.html') {
    reqUrl = '/pages/admin/objek-wisata.html';
  } else if (reqUrl === '/kategori' || reqUrl === '/kategori.html') {
    reqUrl = '/pages/admin/kategori.html';
  } else if (reqUrl === '/pengaturan' || reqUrl === '/pengaturan.html') {
    reqUrl = '/pages/admin/pengaturan.html';
  }

  const filePath = path.join(BASE_DIR, reqUrl);

  // Mencegah directory traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Cek apakah berkas ada di BASE_DIR atau di TMP_DATA_DIR (untuk upload runtime atau data termutasi di serverless)
  let targetServePath = filePath;
  if (!fs.existsSync(targetServePath)) {
    if (reqUrl.includes('destinations/uploaded/')) {
      const tmpUploadCandidate = path.join(TMP_DATA_DIR, 'uploads', path.basename(reqUrl));
      if (fs.existsSync(tmpUploadCandidate)) {
        targetServePath = tmpUploadCandidate;
      } else if (isGitHubSyncEnabled()) {
        try {
          const remoteBuffer = await fetchBinaryFromGitHub(reqUrl);
          if (remoteBuffer) {
            const tmpUploadsDir = path.join(TMP_DATA_DIR, 'uploads');
            if (!fs.existsSync(tmpUploadsDir)) fs.mkdirSync(tmpUploadsDir, { recursive: true });
            fs.writeFileSync(tmpUploadCandidate, remoteBuffer);
            targetServePath = tmpUploadCandidate;
          }
        } catch (err) {
          console.error('[Serve Upload Remote Error]:', err.message);
        }
      }
    } else if (reqUrl.startsWith('/data/')) {
      const tmpDataCandidate = path.join(TMP_DATA_DIR, path.basename(reqUrl));
      if (fs.existsSync(tmpDataCandidate)) {
        targetServePath = tmpDataCandidate;
      }
    }
  } else if (reqUrl.startsWith('/data/')) {
    // Jika berkas data sudah pernah diupdate di TMP_DATA_DIR, utamakan versi terbaru di TMP
    const tmpDataCandidate = path.join(TMP_DATA_DIR, path.basename(reqUrl));
    if (fs.existsSync(tmpDataCandidate)) {
      targetServePath = tmpDataCandidate;
    }
  }

  fs.stat(targetServePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(`
        <div style="font-family:system-ui, sans-serif; text-align:center; padding:4rem 1rem;">
          <h2 style="color:#1C382B;">404 — Halaman Tidak Ditemukan</h2>
          <p style="color:#56685F;">File <code>${reqUrl}</code> tidak ditemukan pada server.</p>
          <a href="/" style="display:inline-block; margin-top:1rem; padding:0.5rem 1rem; background:#1C382B; color:white; text-decoration:none; border-radius:6px;">
            Kembali ke Beranda
          </a>
        </div>
      `);
      return;
    }

    const ext = path.extname(targetServePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const readStream = fs.createReadStream(targetServePath);
    readStream.pipe(res);
  });
}

// Helper sederhana pemecah multipart buffer tanpa dependency
function splitMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let startIndex = 0;

  while ((startIndex = buffer.indexOf(boundaryBuffer, startIndex)) !== -1) {
    startIndex += boundaryBuffer.length;
    if (buffer.slice(startIndex, startIndex + 2).toString() === '--') break;
    if (buffer.slice(startIndex, startIndex + 2).toString() === '\r\n') startIndex += 2;

    const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, startIndex);
    if (nextBoundaryIndex === -1) break;

    const partBuffer = buffer.slice(startIndex, nextBoundaryIndex - 2);
    const headerEndIndex = partBuffer.indexOf('\r\n\r\n');
    if (headerEndIndex !== -1) {
      const headerStr = partBuffer.slice(0, headerEndIndex).toString('utf8');
      const data = partBuffer.slice(headerEndIndex + 4);
      const headers = {};
      headerStr.split('\r\n').forEach(line => {
        const colon = line.indexOf(':');
        if (colon !== -1) {
          headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
      });
      parts.push({ headers, data });
    }
  }
  return parts;
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`🌿 Jelajah Desa Kerta - Server & REST API CMS Berjalan`);
    console.log(`🔗 Akses Publik   : http://localhost:${PORT}`);
    console.log(`🔐 Akses Admin CMS : http://localhost:${PORT}/admin`);
    console.log(`========================================================`);
  });
}

module.exports = handleRequest;
module.exports.server = server;
