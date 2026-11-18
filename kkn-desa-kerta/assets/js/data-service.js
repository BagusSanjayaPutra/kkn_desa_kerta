/**
 * JELAJAH DESA KERTA - DATA SERVICE
 * Layanan terpusat untuk memuat, memvalidasi, dan menyaring data destinasi wisata
 * Mematuhi aturan integritas data: menghitung statistik secara dinamis dari data faktual.
 */

const DataService = {
  _destinationsCache: null,
  _villageInfoCache: null,
  _siteContentCache: null,

  /**
   * Validasi numerik dan logika koordinat geografis
   * @param {Object} coords { latitude, longitude, verified }
   * @returns {boolean}
   */
  isValidCoordinate(coords) {
    if (!coords || typeof coords !== 'object') return false;
    const { latitude, longitude, verified } = coords;
    if (verified !== true) return false;
    if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) return false;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
  },

  /**
   * Memuat data destinasi dengan fallback otomatis
   * Prioritas 1: /api/destinations (hanya mengembalikan yang berstatus published untuk publik)
   * Prioritas 2: data/destinations.json (difilter status != 'draft')
   * Prioritas 3: window.DESTINATIONS_DATA (akses luring file://)
   */
  async getDestinations() {
    if (this._destinationsCache) {
      return this._destinationsCache;
    }

    // 1. Coba fetch dari REST API backend
    try {
      const apiRes = await fetch('/api/destinations');
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json && json.ok && Array.isArray(json.data)) {
          this._destinationsCache = json.data;
          return this._destinationsCache;
        }
      }
    } catch (e) {
      // Server API mungkin luring atau diakses via file://
    }

    // 2. Coba fetch dari file statis JSON
    try {
      const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
      const isPagesDir = typeof window !== 'undefined' && window.location.pathname.includes('/pages/');
      const jsonPath = isFileProto ? (isPagesDir ? '../data/destinations.json' : 'data/destinations.json') : '/data/destinations.json';
      const response = await fetch(jsonPath);
      if (response.ok) {
        const list = await response.json();
        // Pastikan data berstatus 'draft' tidak muncul di website publik!
        this._destinationsCache = list.filter(d => (d.publicationStatus || 'published') === 'published');
        return this._destinationsCache;
      }
    } catch (err) {
      // Fallback diam-diam ke preloaded script jika ada batasan CORS file://
    }

    // 3. Fallback luring
    if (typeof window !== 'undefined' && (window.DESTINATIONS_DATA || window.DESA_KERTA_DESTINATIONS)) {
      const list = window.DESTINATIONS_DATA || window.DESA_KERTA_DESTINATIONS;
      this._destinationsCache = list.filter(d => (d.publicationStatus || 'published') === 'published');
      return this._destinationsCache;
    }

    return [];
  },

  /**
   * Memuat konten dinamis website dari CMS
   */
  async getSiteContent() {
    if (this._siteContentCache) {
      return this._siteContentCache;
    }

    try {
      const res = await fetch('/api/content');
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && json.data) {
          this._siteContentCache = json.data;
          return this._siteContentCache;
        }
      }
    } catch (e) {}

    try {
      const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
      const isPagesDir = typeof window !== 'undefined' && window.location.pathname.includes('/pages/');
      const jsonPath = isFileProto ? (isPagesDir ? '../data/site-content.json' : 'data/site-content.json') : '/data/site-content.json';
      const res = await fetch(jsonPath);
      if (res.ok) {
        this._siteContentCache = await res.json();
        return this._siteContentCache;
      }
    } catch (e) {}

    return null;
  },

  /**
   * Memuat data informasi desa
   */
  async getVillageInfo() {
    if (this._villageInfoCache) {
      return this._villageInfoCache;
    }
    if (typeof window !== 'undefined' && window.VILLAGE_INFO) {
      this._villageInfoCache = window.VILLAGE_INFO;
      return this._villageInfoCache;
    }
    return {
      name: "Desa Kerta",
      district: "Kecamatan Payangan",
      regency: "Kabupaten Gianyar",
      province: "Provinsi Bali",
      officialWebsite: "https://kerta.desa.id"
    };
  },

  /**
   * Menemukan destinasi berdasarkan slug
   */
  async getBySlug(slug) {
    // Coba endpoint spesifik
    try {
      const res = await fetch(`/api/destinations/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && json.data) return json.data;
      }
    } catch (e) {}

    const list = await this.getDestinations();
    return list.find(item => item.slug === slug) || null;
  },

  /**
   * Menemukan destinasi berdasarkan ID
   */
  async getById(id) {
    try {
      const res = await fetch(`/api/destinations/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && json.data) return json.data;
      }
    } catch (e) {}

    const list = await this.getDestinations();
    return list.find(item => item.id === id) || null;
  },

  /**
   * Filter dan pencarian dinamis
   */
  async filterDestinations({ query = '', category = 'all', verificationStatus = 'all' } = {}) {
    const list = await this.getDestinations();
    const cleanQuery = query.trim().toLowerCase();

    return list.filter(item => {
      // Filter kategori
      if (category !== 'all' && item.category !== category) {
        return false;
      }

      // Filter status verifikasi
      if (verificationStatus !== 'all' && item.verificationStatus !== verificationStatus) {
        return false;
      }

      // Pencarian teks (nama, deskripsi singkat, alamat)
      if (cleanQuery) {
        const matchName = item.name.toLowerCase().includes(cleanQuery);
        const matchShortDesc = (item.shortDescription || '').toLowerCase().includes(cleanQuery);
        const matchAddress = (item.address || '').toLowerCase().includes(cleanQuery);
        if (!matchName && !matchShortDesc && !matchAddress) {
          return false;
        }
      }

      return true;
    });
  },

  /**
   * Menghitung statistik faktual dari dataset yang ada
   * Dihitung secara matematis, bukan angka karangan.
   */
  async getStats() {
    try {
      const apiRes = await fetch('/api/stats');
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json && json.ok && json.stats) {
          return {
            totalRecorded: json.stats.total,
            publishedCount: json.stats.published,
            draftCount: json.stats.drafts,
            verifiedCoords: json.stats.verifiedCoords,
            pendingCoords: json.stats.pendingCoords,
            partiallyVerified: json.stats.partiallyVerified,
            pendingVerification: json.stats.pendingVerification
          };
        }
      }
    } catch (e) {}

    const list = await this.getDestinations();
    const totalRecorded = list.length;
    const verifiedCoords = list.filter(item => this.isValidCoordinate(item.coordinates)).length;
    const partiallyVerified = list.filter(item => item.verificationStatus === 'partially_verified').length;
    const pendingVerification = list.filter(item => item.verificationStatus === 'pending_verification').length;

    return {
      totalRecorded,
      publishedCount: totalRecorded,
      draftCount: 0,
      verifiedCoords,
      pendingCoords: totalRecorded - verifiedCoords,
      partiallyVerified,
      pendingVerification
    };
  }
};

if (typeof window !== 'undefined') {
  window.DataService = DataService;
}
