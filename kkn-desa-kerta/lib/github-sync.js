/**
 * JELAJAH DESA KERTA - GITHUB AUTO-SYNC ENGINE
 * Mengabadikan seluruh mutasi data CMS (destinasi, kategori, konten, foto)
 * langsung ke repositori GitHub via GitHub REST API v3.
 * Menjadikan GitHub sebagai basis data permanen yang bebas dari reset serverless Vercel.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Membaca berkas .env jika ada (untuk lingkungan lokal tanpa paket dotenv)
if (!process.env.GITHUB_TOKEN) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const parts = line.trim().split('=');
        if (parts.length >= 2 && !parts[0].startsWith('#')) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch (e) {}
}

function getGitHubRepo() {
  return process.env.GITHUB_REPO || 'suryacakraaa/kkn-desa-kerta';
}
function getGitHubBranch() {
  return process.env.GITHUB_BRANCH || 'main';
}
function getGitHubToken() {
  return process.env.GITHUB_TOKEN || '';
}

function isGitHubSyncEnabled() {
  return Boolean(getGitHubToken() && getGitHubRepo());
}

function githubRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    if (!isGitHubSyncEnabled()) {
      return resolve({ status: 0, error: 'GitHub Sync not configured' });
    }

    const token = getGitHubToken();
    const postData = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'Desa-Kerta-CMS-Sync/1.0',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', err => {
      console.error(`[GitHub Sync Error] ${method} ${endpoint}:`, err.message);
      resolve({ status: 0, error: err.message });
    });

    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Menyimpan atau memperbarui berkas langsung di repositori GitHub
 * @param {Object} params { filePath, content, isBinary, message }
 */
async function commitFileToGitHub({ filePath, content, isBinary = false, message = null }) {
  if (!isGitHubSyncEnabled()) return false;

  const repo = getGitHubRepo();
  const branch = getGitHubBranch();
  const cleanPath = filePath.replace(/^(\.\/|\/)/, '');
  const commitMsg = message || `chore(cms): update ${cleanPath} via Admin CMS [skip ci]`;

  try {
    // 1. Ambil SHA berkas yang ada jika sudah pernah dibuat
    let sha = null;
    const getRes = await githubRequest(
      `/repos/${repo}/contents/${cleanPath}?ref=${branch}`,
      'GET'
    );
    if (getRes.status === 200 && getRes.data && getRes.data.sha) {
      sha = getRes.data.sha;
    }

    // 2. Siapkan konten dalam base64
    const base64Content = isBinary
      ? (Buffer.isBuffer(content) ? content.toString('base64') : Buffer.from(content).toString('base64'))
      : Buffer.from(content, 'utf8').toString('base64');

    const putBody = {
      message: commitMsg,
      content: base64Content,
      branch: branch
    };
    if (sha) putBody.sha = sha;

    // 3. Eksekusi commit via GitHub API
    const putRes = await githubRequest(
      `/repos/${repo}/contents/${cleanPath}`,
      'PUT',
      putBody
    );

    if (putRes.status === 200 || putRes.status === 201) {
      console.log(`[GitHub Sync ✅] Berhasil commit ${cleanPath} ke ${repo}:${branch}`);
      return true;
    } else {
      console.error(`[GitHub Sync ❌] Gagal commit ${cleanPath}:`, putRes.status, putRes.data);
      return false;
    }
  } catch (err) {
    console.error(`[GitHub Sync ❌] Exception saat commit ${cleanPath}:`, err.message);
    return false;
  }
}

function githubRawRequest(endpoint) {
  return new Promise((resolve) => {
    if (!isGitHubSyncEnabled()) return resolve(null);

    const token = getGitHubToken();
    const req = https.request({
      hostname: 'api.github.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': 'Desa-Kerta-CMS-Sync/1.0',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.raw'
      }
    }, res => {
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', err => {
      console.error(`[GitHub Raw Error] GET ${endpoint}:`, err.message);
      resolve(null);
    });

    req.end();
  });
}

/**
 * Mengambil isi berkas terbaru dari GitHub jika tersedia
 */
async function fetchFileFromGitHub(filePath) {
  if (!isGitHubSyncEnabled()) return null;

  const repo = getGitHubRepo();
  const branch = getGitHubBranch();
  const cleanPath = filePath.replace(/^(\.\/|\/)/, '');
  try {
    const rawBuf = await githubRawRequest(
      `/repos/${repo}/contents/${cleanPath}?ref=${branch}`
    );
    if (!rawBuf) return null;

    const decoded = rawBuf.toString('utf8');
    try {
      return JSON.parse(decoded);
    } catch (e) {
      return decoded;
    }
  } catch (err) {
    console.error(`[GitHub Sync ❌] Gagal fetch ${cleanPath}:`, err.message);
    return null;
  }
}

/**
 * Mengambil berkas biner (gambar/foto) langsung dari GitHub
 */
async function fetchBinaryFromGitHub(filePath) {
  if (!isGitHubSyncEnabled()) return null;

  const repo = getGitHubRepo();
  const branch = getGitHubBranch();
  const cleanPath = filePath.replace(/^(\.\/|\/)/, '');
  try {
    return await githubRawRequest(
      `/repos/${repo}/contents/${cleanPath}?ref=${branch}`
    );
  } catch (err) {
    console.error(`[GitHub Sync ❌] Gagal fetch biner ${cleanPath}:`, err.message);
    return null;
  }
}

/**
 * Sinkronisasi data awal saat serverless container bangun (cold start)
 * Mengisi cache lokal /tmp dengan data komit terbaru dari GitHub
 */
let isInitialSyncDone = false;
async function syncAllDataOnStartup(tmpDir) {
  if (!isGitHubSyncEnabled() || isInitialSyncDone) return;
  isInitialSyncDone = true;

  const filesToSync = [
    'destinations.json',
    'categories.json',
    'site-content.json',
    'admin-config.json'
  ];

  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    for (const file of filesToSync) {
      const remoteData = await fetchFileFromGitHub(`data/${file}`);
      if (remoteData) {
        const targetPath = path.join(tmpDir, file);
        fs.writeFileSync(targetPath, JSON.stringify(remoteData, null, 2), 'utf8');
        console.log(`[GitHub Sync 🔄] Sinkron ${file} terbaru dari GitHub ke ${targetPath}`);
      }
    }
  } catch (err) {
    console.error('[GitHub Sync ❌] Gagal sinkronisasi data startup:', err.message);
  }
}

module.exports = {
  isGitHubSyncEnabled,
  commitFileToGitHub,
  fetchFileFromGitHub,
  fetchBinaryFromGitHub,
  syncAllDataOnStartup
};
