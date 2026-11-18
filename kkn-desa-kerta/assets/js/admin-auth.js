/**
 * JELAJAH DESA KERTA - AUTH GUARD & SESSION MANAGER
 * Melindungi seluruh halaman admin dari akses tanpa izin
 */

document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.includes('login');
  const token = API.getToken();

  if (isLoginPage) {
    // Jika di halaman login dan sudah punya token valid, arahkan ke dashboard
    if (token) {
      try {
        const res = await API.get('/api/auth/me');
        if (res && res.authenticated) {
          window.location.href = '/admin';
          return;
        }
      } catch (e) {}
    }
    initLoginForm();
  } else {
    // Pada halaman admin terlindungi: periksa autentikasi server
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    try {
      const res = await API.get('/api/auth/me');
      if (!res || !res.authenticated) {
        API.setToken('');
        window.location.href = '/admin/login';
        return;
      }

      // Tampilkan profil admin di sidebar
      const userNameEl = document.querySelector('.user-name');
      if (userNameEl && res.user) {
        userNameEl.textContent = res.user.name || res.user.username;
      }
    } catch (e) {
      API.setToken('');
      window.location.href = '/admin/login';
      return;
    }

    // Inisialisasi tombol logout
    const logoutBtn = document.getElementById('btn-admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Apakah Anda yakin ingin keluar dari Admin CMS?')) {
          await API.post('/api/auth/logout', {});
          API.setToken('');
          window.location.href = '/admin/login';
        }
      });
    }

    // Inisialisasi sidebar toggle mobile
    const toggleBtn = document.querySelector('.sidebar-toggle-btn');
    const sidebar = document.querySelector('.admin-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }
  }
});

function initLoginForm() {
  const form = document.getElementById('admin-login-form');
  const alertEl = document.getElementById('login-alert');

  // Cek apakah baru saja diarahkan karena sesi habis
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('expired') === '1' && alertEl) {
    alertEl.textContent = 'Sesi Anda telah kedaluwarsa. Silakan login kembali.';
    alertEl.style.display = 'block';
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');
      const submitBtn = form.querySelector('button[type="submit"]');

      if (!usernameInput || !passwordInput) return;

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        if (alertEl) {
          alertEl.textContent = 'Nama pengguna dan kata sandi wajib diisi.';
          alertEl.style.display = 'block';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memverifikasi...';
      }

      try {
        const res = await API.post('/api/auth/login', { username, password });

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Masuk ke Dashboard';
        }

        if (res && res.ok && res.token) {
          API.setToken(res.token);
          window.location.href = '/admin';
        } else {
          if (alertEl) {
            alertEl.textContent = (res && res.error) || 'Login gagal. Periksa username dan password Anda.';
            alertEl.style.display = 'block';
          }
        }
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Masuk ke Dashboard';
        }
        if (alertEl) {
          alertEl.textContent = 'Terjadi kesalahan jaringan atau server.';
          alertEl.style.display = 'block';
        }
      }
    });
  }
}
