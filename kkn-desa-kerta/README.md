# Jelajah Desa Kerta — Website Informasi & CMS Wisata Desa

> **Program Kerja Kuliah Kerja Nyata (KKN) Mahasiswa**  
> Lokasi: Desa Kerta, Kecamatan Payangan, Kabupaten Gianyar, Provinsi Bali, Indonesia.  
> Status Pengembangan: **Fase 2 Selesai (Portal Publik, REST API, & Admin CMS Terintegrasi Penuh)**

---

## 1. Latar Belakang & Tujuan Proyek

Desa Kerta terletak di kawasan dataran tinggi Kecamatan Payangan, Kabupaten Gianyar yang berbatasan langsung dengan Kintamani, Kabupaten Bangli. Wilayah ini memiliki kekayaan potensi pariwisata yang beragam:
- **Wisata Alam & Tebing**: Pemandangan jurang, lembah hijau, serta ikon akar pohon Taep raksasa di *Munduk Asri*.
- **Cagar Budaya Megalitikum**: Peninggalan kubur batu (*Sarkofagus*) yang ditemukan pada tahun 1974 di Banjar Margatengah dan terdaftar di Balai Pelestarian Cagar Budaya (BPCB).
- **Wisata Spiritual & Sejarah**: Jejak perjalanan suci Ida Rsi Markandeya pada abad ke-8 di *Pura Alas Angker* yang melandasi penamaan Desa Kerta.
- **Agrowisata Rakyat**: Perkebunan jeruk manis khas Payangan dan tanaman kopi di lereng perbukitan yang sejuk.

### Nilai Utama: Integritas Data & Anti-Fabrikasi
Proyek ini mengutamakan **kebenaran data di atas kelengkapan visual**. Tidak ada harga tiket fiktif, jam buka rekayasa, atau titik koordinat GPS palsu yang dipasang. Seluruh informasi yang belum diverifikasi secara resmi atau belum diukur melalui survei lapangan diberi label transparan seperti `pending_verification` atau `Belum dikonfirmasi`.

---

## 2. Struktur Direktori Proyek

```text
KKN/
├── index.html                   # Halaman beranda (Hero, Profil Desa, Fakta Dinamis, Peta, Nilai KKN)
├── pages/
│   ├── katalog.html             # Katalog destinasi (Pencarian teks, Filter Kategori, Filter Status)
│   ├── detail.html              # Halaman detail faktual dinamis (Foto, Deskripsi, Fasilitas, Audit Log)
│   ├── peta.html                # Peta spasial Leaflet & OSM (Marker terverifikasi, panel survei)
│   ├── galeri.html              # Galeri dokumentasi visual (Grid responsif, filter, modal lightbox)
│   ├── tentang.html             # Akuntabilitas KKN (Latar belakang, metodologi, formulir umpan balik)
│   └── admin/                   # [MODUL ADMIN DASHBOARD / CMS]
│       ├── login.html           # Halaman login administrator terlindungi
│       ├── index.html           # Dashboard utama ringkasan statistik faktual & quick actions
│       ├── objek-wisata.html    # CRUD lengkap objek wisata (tabel, search/filter, form interaktif)
│       ├── galeri.html          # Pengelolaan foto, upload berkas, alt text, atribusi sumber
│       ├── kategori.html        # Manajemen kategori wisata & proteksi integritas relasi
│       ├── peta.html            # Manajemen titik koordinat spasial & pratinjau peta Leaflet
│       └── pengaturan.html      # Pengaturan teks beranda, kontak resmi desa, & ganti kata sandi
├── assets/
│   ├── css/
│   │   ├── style.css            # Stylesheet utama tema Bali Nature (Sage, Forest Green, Ivory, Sand)
│   │   ├── components.css       # Kartu wisata, badge status, filter bar, modal lightbox
│   │   ├── leaflet-custom.css   # Kustomisasi kontrol peta, popup, legend, responsive map
│   │   └── admin.css            # Stylesheet profesional Admin Dashboard CMS
│   ├── js/
│   │   ├── app.js               # Navigasi responsif, mobile drawer, active indicator
│   │   ├── data-service.js      # Fetch data API (dengan fallback offline), validasi koordinat
│   │   ├── katalog.js           # Logika katalog (search debounce, category pill, handling empty state)
│   │   ├── detail.js            # Parsing URL slug/id, render detail, penanganan jujur koordinat
│   │   ├── map.js               # Inisialisasi Leaflet, marker Kantor Desa, filter marker terverifikasi
│   │   ├── galeri.js            # Render galeri, filter kategori, viewer lightbox modal
│   │   ├── admin-api.js         # API client dengan injeksi token otorisasi & toast UI
│   │   └── admin-auth.js        # Auth guard, session manager, & proteksi rute admin
│   └── images/
│       ├── brand/               # Logo SVG Jelajah Desa Kerta
│       ├── destinations/        # Ilustrasi & foto berlabel transparansi
│       │   └── uploaded/        # Direktori penyimpanan permanen foto hasil unggahan admin
│       └── hero-desa-kerta.svg  # Banner lanskap bukit Payangan
├── data/
│   ├── destinations.json        # Basis data primer terstruktur (JSON Standar)
│   ├── destinations.js          # Modul fallback data (menjamin 100% jalan via file:// offline)
│   ├── categories.json          # Data kategori wisata yang dapat dikelola admin
│   ├── site-content.json        # Data teks halaman publik dan kontak resmi desa
│   ├── admin-config.json        # Kredensial akun admin terenkripsi PBKDF2 (SHA-512)
│   └── backups/                 # Arsip rotasi snapshot cadangan data otomatis (maks 20)
├── scripts/
│   ├── verify-data.js           # Uji otomatis integritas skema dan koordinat
│   └── test-cms-flow.js         # Uji alur nyata 14 skenario CMS end-to-end
├── package.json                 # Metadata npm & skrip pengujian/server
├── server.js                    # Server HTTP full-stack & REST API zero-dependency (Node.js)
└── README.md                    # Dokumentasi lengkap proyek
```

---

## 3. Cara Menjalankan Website & CMS Secara Lokal

Proyek ini dirancang **ringan, mandiri, dan zero-dependency** (hanya memerlukan runtime Node.js bawaan).

### Menjalankan Server & API
```bash
# Jalankan server full-stack di terminal
npm start
```
Akses di browser:
- **Website Publik**: [`http://localhost:3000`](http://localhost:3000)
- **Admin Dashboard CMS**: [`http://localhost:3000/admin`](http://localhost:3000/admin) (atau langsung ke [`http://localhost:3000/admin/login`](http://localhost:3000/admin/login))

---

## 4. Akses Administrator CMS & Keamanan Akun

### Kredensial Default Awal
- **URL Login**: `http://localhost:3000/admin/login`
- **Username**: `admin`
- **Password Awal**: `KertaPayangan2026!`

> [!IMPORTANT]
> **Segera Ganti Kata Sandi:**
> Setelah pertama kali login, disarankan segera mengganti kata sandi melalui menu **Pengaturan** (`/admin/pengaturan`).
> Kata sandi di server dienkripsi menggunakan algoritma **Salted PBKDF2 (100.000 iterasi SHA-512)** pada file terlindungi `data/admin-config.json` dan tidak pernah terekspos ke antarmuka klien.

---

## 5. Fitur Admin Dashboard / CMS

### A. Dashboard Utama (`/admin`)
- Ringkasan statistik riil yang ditarik dari basis data (Total Objek Wisata, Terpublikasi, Draft, Titik GPS Terverifikasi, Total Foto).
- Tabel 5 objek wisata terdaftar dengan status publikasi dan verifikasi data.

### B. Pengelolaan Objek Wisata (`/admin/objek-wisata`)
- **CRUD Penuh**: Tambah, Lihat, Edit, dan Hapus objek wisata.
- **Pencarian & Filter**: Filter kategori, filter status publikasi (`published`, `draft`, `archived`), dan pencarian teks nama/ID.
- **Form Komprehensif**: Nama, kategori, deskripsi, alamat, fasilitas, jam operasional, tiket, kontak pengelola, catatan akses, dan catatan verifikasi internal.
- **Status Publikasi Terpisah**:
  - `Draft`: Hanya terlihat di dashboard admin, disembunyikan dari katalog website publik.
  - `Dipublikasikan`: Ditayangkan secara publik di website.
  - `Diarsipkan`: Disimpan dalam arsip tanpa ditampilkan di publik.

### C. Pengelolaan Galeri & Unggah Foto Permanen (`/admin/galeri`)
- Unggah file gambar (`.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`) maksimal 5 MB langsung dari perangkat.
- Pratinjau foto sebelum disimpan.
- Penyimpanan foto permanen di direktori server `assets/images/destinations/uploaded/`.
- Pengaturan keterangan (*caption*), teks alternatif (*alt text*), dan atribusi sumber foto.
- Opsi menetapkan foto sebagai foto utama kartu wisata.

### D. Pengelolaan Kategori Wisata (`/admin/kategori`)
- Tambah, edit, dan hapus kategori wisata.
- **Relational Integrity Guard**: Mencegah penghapusan kategori jika kategori tersebut masih digunakan oleh objek wisata aktif.

### E. Pengelolaan Koordinat Spasial & Peta (`/admin/peta`)
- Memilih objek wisata dan melihat koordinatnya pada peta Leaflet interaktif.
- Klik peta atau seret marker untuk menetapkan koordinat desimal WGS84 secara presisi.
- Tandai status verifikasi: `Terverifikasi Resmi` vs `Menunggu Survei GPS`.
- Perubahan koordinat langsung tersimpan dan diperbarui di peta website publik.

### F. Pengaturan Website & Keamanan (`/admin/pengaturan`)
- Mengubah teks judul utama, subjudul, dan badge hero beranda.
- Mengubah alamat kantor desa, email, nomor telepon, dan website resmi.
- Fitur ganti kata sandi administrator dengan validasi kata sandi saat ini.

---

## 6. Pengujian Otomatis (Test Suite)

Proyek dilengkapi dua modul pengujian otomatis:

### A. Uji Integritas Data & Berkas
```bash
npm test
```
Memeriksa integritas berkas JSON, keunikan ID/slug, kepatuhan batas koordinat geografis `[-90, 90]` & `[-180, 180]`, serta ketersediaan seluruh file publik dan admin.

### B. Uji Alur 14 Skenario CMS End-to-End
```bash
npm run test:flow
```
Menguji 14 alur wajib secara otomatis terhadap server aktif:
1. Login admin dengan PBKDF2 salt & hash.
2. Penolakan akses endpoint tanpa token (HTTP 401).
3. Penambahan objek wisata baru via API.
4. Pengeditan nama dan deskripsi objek wisata.
5. Unggah foto permanen ke direktori server.
6. Penetapan dan penggantian foto utama.
7. Penambahan dan penghapusan foto galeri.
8. Pengubahan kategori dan status publikasi (Draft).
9. Pembaruan koordinat GPS dan status verifikasi.
10. Sinkronisasi data admin ke website publik.
11. Verifikasi data DRAFT tidak muncul di katalog publik.
12. Pengujian validasi input ketat (koordinat tidak valid & nama kosong).
13. Penolakan mutasi data dari pengguna tanpa otorisasi.
14. Pembersihan data uji dan verifikasi respons seluruh rute halaman (HTTP 200 OK).

---

## 7. Sistem Cadangan (Backup) & Pemulihan Data

- Setiap kali ada data yang ditambah, diubah, atau dihapus melalui CMS, server secara otomatis menyimpan cadangan berkas di folder `data/backups/destinations-TIMESTAMP.json`.
- Sistem menyimpan hingga 20 cadangan terakhir secara otomatis (*rotating backups*).
- **Cara Pemulihan Data (Restore)**: Jika terjadi kesalahan pengeditan, salin isi berkas backup yang diinginkan dari folder `data/backups/` lalu timpa ke file `data/destinations.json`.

---

## 8. Panduan Deployment

### Opsi A: Deployment Server / VPS Desa (Rekomendasi Penuh untuk CMS Aktif)
1. Pasang Node.js (v18+) pada server atau hosting cPanel/VPS desa.
2. Unggah seluruh isi direktori proyek ke server.
3. Jalankan server menggunakan process manager (misalnya PM2):
   ```bash
   pm2 start server.js --name "kerta-wisata"
   ```
4. Hubungkan domain desa (misal: `wisata.kerta.desa.id`) menggunakan reverse proxy Nginx ke port 3000.

### Opsi B: Deployment Statis (GitHub Pages)
Jika desa hanya membutuhkan tampilan publik tanpa server CMS aktif:
1. Ekspor file proyek ke repositori GitHub.
2. Seluruh website publik tetap dapat berjalan mandiri berkat modul fallback `data/destinations.js`.

---

## 9. Prosedur Serah Terima (Handover) ke Pihak Desa

1. **Serah Terima Kredensial**: Berikan username `admin` dan panduan login kepada sekretaris desa / pengelola Pokdarwis Desa Kerta.
2. **Pelatihan Penggunaan CMS**: Tunjukkan cara menggunakan antarmuka visual di `/admin`:
   - Menambah objek wisata baru jika ada potensi baru yang dibuka.
   - Mengisi koordinat GPS hasil survei lapangan melalui peta interaktif.
   - Mengunggah foto asli hasil jepretan warga/pengelola.
3. **Dokumentasi Fisik**: Cetak atau lampirkan dokumen README ini ke dalam laporan pertanggungjawaban luaran KKN mahasiswa.
