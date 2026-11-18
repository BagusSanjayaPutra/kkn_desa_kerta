/**
 * JELAJAH DESA KERTA - ADMIN API CLIENT & UI HELPERS
 * Menangani komunikasi REST API terproteksi token dan interaksi antarmuka dashboard
 */

const API = {
  TOKEN_KEY: 'admin_session_token',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  },

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : endpoint;
    const headers = options.headers || {};
    
    // Inject Authorization header jika token ada
    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    options.headers = headers;

    try {
      const response = await fetch(url, options);

      // Tangani unauthenticated pada route admin
      if (response.status === 401) {
        if (!window.location.pathname.includes('login')) {
          this.setToken('');
          window.location.href = '/admin/login?expired=1';
          return { ok: false, error: 'Sesi telah kedaluwarsa' };
        }
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`Fetch error ${endpoint}:`, err);
      return { ok: false, error: 'Koneksi ke server gagal atau server luring.' };
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  /**
   * Upload foto permanen via JSON base64 ke endpoint /api/upload
   */
  async uploadPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await this.post('/api/upload', {
            fileName: file.name,
            base64Data: reader.result
          });
          resolve(res);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }
};

const AdminUI = {
  toast(message, type = 'info') {
    let container = document.querySelector('.admin-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'admin-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

if (typeof window !== 'undefined') {
  window.API = API;
  window.AdminUI = AdminUI;
}
