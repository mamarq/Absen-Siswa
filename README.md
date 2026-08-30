# Sistem Informasi Absensi & Jurnal Mengajar Guru Mapel
**UPT SMKN 1 Bantaeng**  
**Guru Mata Pelajaran:** Ammar (Matematika / TJKT / DKV / MPLB / AKL)

Aplikasi web modern, responsif (mobile-first), dan cepat untuk mencatat absensi siswa per sesi mengajar, mengisi jurnal mengajar pada sesi yang sama, memantau catatan agenda & kegiatan siswa dengan indikator visual otomatis (badge), serta membuat rekapitulasi kehadiran dan cetak laporan resmi khusus untuk 4 jurusan:
- **TJKT** (Teknik Jaringan Komputer dan Telekomunikasi)
- **DKV** (Desain Komunikasi Visual)
- **MPLB** (Manajemen Perkantoran dan Layanan Bisnis)
- **AKL** (Akuntansi dan Keuangan Lembaga)

---

## 🚀 Fitur Unggulan

1. **Input Absensi Kilat (< 1 Menit)**
   - Tombol 1-klik **"Set Semua Hadir"**.
   - Toggle status instan per siswa: **H** (Hadir), **S** (Sakit), **I** (Izin), **A** (Alfa).
   - Sticky action bar ramah HP untuk memudahkan penyimpanan satu tangan saat berganti jam kelas.
2. **Modul Catatan Ceklis Siswa & Nilai Tugas (Sederhana)**
   - **Catatan Ceklis Per Siswa**: Format absen ceklis (Sudah/Belum) per siswa pada hari itu untuk mengecek kelengkapan buku, PR, praktik lab, atau keaktifan kelas, lengkap dengan kolom catatan khusus per siswa.
   - **Penilaian Tugas Sederhana**: Input nilai angka (0 - 100) per siswa dengan status Tuntas / Remedial otomatis sesuai standar KKM dan tombol isi cepat.
   - **Cetak Lembar Resmi**: Format cetak standar UPT SMKN 1 Bantaeng untuk lembar ceklis dan lembar daftar nilai.
3. **Badge Otomatis Kegiatan Siswa (F6)**
   - Jika ada siswa yang memiliki catatan kegiatan/lomba/dispensasi pada tanggal mengajar, sistem langsung menampilkan badge interaktif di samping nama siswa pada form absensi.
4. **Jurnal Mengajar Terintegrasi**
   - Terhubung otomatis dengan Sesi Mengajar (Kelas, Mapel, Tanggal, Jam Pelajaran).
   - Ringkasan kehadiran siswa otomatis disematkan ke dalam jurnal.
   - Fitur **Cetak Lembar Jurnal Resmi** format SMKN 1 Bantaeng.
5. **Riwayat Sesi & Mode Edit (F5, F7)**
   - Menampilkan seluruh sesi mengajar lampau.
   - Kemudahan edit ulang absensi jika terdapat kekeliruan input.
6. **Rekapitulasi Kehadiran & Ekspor (F8)**
   - Matriks kehadiran siswa per pertemuan.
   - Kalkulasi persentase kehadiran (%) otomatis.
   - Ekspor data ke **CSV / Excel** dan **Cetak Rekap Presensi Resmi**.
7. **Rekap Per Siswa (Profil & Portofolio Akademik Siswa) — Baru 🎓**
   - **Profil & Statistik Presensi Individual**: Visual ring/progress bar kehadiran (*Hadir, Sakit, Izin, Alfa*).
   - **Statistik Akademik & Grafik Tren Belajar**: SVG line chart interaktif perbandingan nilai siswa vs standar KKM vs rata-rata kelas.
   - **Tabel Riwayat Tugas & Status Tuntas/Remedi**: Rincian setiap tugas/ulangan lengkap dengan catatan guru.
   - **Timeline Catatan & Sikap Siswa**: Histori catatan perilaku, dispensasi, lomba, dan ceklis tugas dengan tag filter (`#Kehadiran`, `#Sikap`, `#Akademik`, `#Prestasi`).
   - **Ekspor Rapor Ringkas (PDF/Print)** & **Kirim Laporan ke WhatsApp Orang Tua**: Pesan WA terformat otomatis dan generator link `wa.me/`.
8. **Manajemen Master Mata Pelajaran (CRUD Dinamis Baru 📚✨)**
   - **Tabel & Form Master Mapel**: Kelola daftar mata pelajaran, kode singkatan (MTK, INF, PKK), dan kelompok (Umum / Kejuruan Produktif).
   - **Dropdown Terintegrasi Real-Time**: Seluruh dropdown mapel pada form Absensi, Jurnal Mengajar, Catatan Ceklis, Penilaian Tugas, Riwayat Sesi, dan Rekapitulasi kini terhubung dinamis ke master data.
   - **Tombol Cepat "+ Kelola Mapel"**: Akses langsung ke modal manajemen mapel dari form input absensi harian.
   - **Support Offline & Cloud**: Tersimpan aman di LocalStorage dan mendukung sinkronisasi ke tabel Supabase `mata_pelajaran`.
9. **Supabase Cloud Database & Autentikasi Login Guru (Baru 🛡️☁️)**
   - **Terhubung Penuh ke Supabase**: URL `https://nvvcwapmkfpilwhqopct.supabase.co` aktif secara otomatis.
   - **Halaman Login & Registrasi Guru (`AuthView.js`)**: Dilengkapi autentikasi email & password, proteksi sesi, dan mode masuk cepat guru.
   - **Sinkronisasi Multi-Perangkat**: Data tersinkronisasi otomatis secara online sehingga dapat diakses bersamaan dari smartphone/tablet di kelas dan laptop di rumah.
   - **Offline-First Resilience**: Jika berada di lab tanpa sinyal, sesi tersimpan di browser sehingga proses mengajar tidak terganggu.
   - **Tombol 1-Klik Sinkronisasi**: Mengunggah seluruh data kelas dan siswa lokal ke Cloud Supabase langsung dari menu Pengaturan DB.
10. **Impor Data Siswa via Excel (.xlsx / .csv) & Download Template (Baru 📊📥)**
    - **Tombol Download Template Excel**: Unduh template standar (.xlsx) dengan kolom `NISN`, `Nama Siswa`, `Jenis Kelamin`, `Kelas` beserta contoh data dummy.
    - **Upload File & Drag-Drop**: Dukungan unggah file spreadsheet (.xlsx, .xls, .csv).
    - **Preview & Validasi Data Otomatis**: Deteksi NISN duplikat (dalam file maupun database), validasi kolom wajib kosong, dan auto-matching kelas.
    - **Penyimpanan Aman**: Mengimpor data siswa tanpa menimpa atau merusak siswa yang sudah ada.

---

## 📂 Struktur File

```
d:/Aplikasi/Absen Siswa/
├── index.html              # Entry point utama aplikasi
├── styles.css              # Custom styling, responsive layout, animasi toast
├── app.js                  # Controller utama & router SPA
├── supabase-client.js      # Lapisan database Supabase & fallback LocalStorage
├── schema.sql              # Skema database PostgreSQL Supabase + RLS + Seed Data
├── components/
│   ├── Navbar.js           # Header navigasi & status bar
│   ├── AbsenView.js        # Modul Form Absensi Siswa
│   ├── JurnalView.js       # Modul Jurnal Mengajar
│   ├── KegiatanView.js     # Modul Catatan Kegiatan Siswa
│   ├── RiwayatView.js      # Modul Riwayat Sesi Mengajar
│   ├── RekapView.js        # Modul Rekapitulasi Presensi
│   ├── SiswaModal.js       # Modal Kelola Siswa & Impor Excel
│   └── SettingsModal.js    # Modal Konfigurasi Supabase & Backup Data
├── data/
│   └── initialData.js      # Data awal (Kelas X TJKT 1, X TJKT 2, X RPL 1, Mapel)
└── README.md
```

---

## 🛠️ Panduan Menjalankan Secara Lokal

Anda dapat membuka aplikasi ini dengan salah satu cara mudah berikut:

### Opsi 1: Klik Ganda File `start-app.bat` (Paling Praktis)
Cukup klik ganda (double-click) file **`start-app.bat`** yang ada di folder proyek ini. Server akan otomatis aktif di port **`8085`** dan membuka browser Anda secara instan.

### Opsi 2: Menggunakan Terminal / Command Prompt:
Jalankan perintah berikut di terminal:
```bash
python -m http.server 8085
```
Lalu buka browser di: **`http://localhost:8085`**

---

## ☁️ Panduan Menghubungkan Supabase Cloud

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka menu **SQL Editor** di dashboard Supabase Anda.
3. Buka file `schema.sql`, salin seluruh isinya, dan jalankan (Run) di SQL Editor Supabase.
4. Buka menu **Project Settings > API** di Supabase untuk mendapatkan:
   - **Project URL**
   - **Project API Key (anon/public)**
5. Buka aplikasi Absen ini di browser, klik ikon **⚙️ (Pengaturan)** di pojok kanan atas, masukkan URL dan Anon Key Anda, lalu klik **"Test & Simpan Koneksi"**.
6. Status di header akan otomatis berubah menjadi 🟢 **Supabase Cloud**.

---

## 🌐 Panduan Deploy ke Netlify

1. Upload folder proyek ini ke repositori GitHub / GitLab Anda, atau cukup drag & drop folder proyek ke [app.netlify.com/drop](https://app.netlify.com/drop).
2. Konfigurasi build Netlify:
   - **Build command**: *(kosongkan)*
   - **Publish directory**: `.` *(titik / root)*
3. Aplikasi Anda langsung aktif dan dapat diakses dari smartphone maupun laptop di sekolah.
