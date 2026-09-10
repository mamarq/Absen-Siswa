# 📚 SIA-Jurnal: Sistem Informasi Akademik & Jurnal Mengajar Guru

> **Aplikasi Manajemen Pembelajaran, Presensi, Jurnal Mengajar, Penilaian Tugas & PR, Master Kelompok Belajar, Ledger Nilai Akhir Fleksibel, Jadwal Mengajar Rutin, dan Master Jurusan Dinamis Berbasis Web (PWA & Cloud Supabase)**

---

## 📌 Versi
**v1.1.0** (Production Release)

---

## 🌟 Gambaran Umum

**SIA-Jurnal** adalah aplikasi web modern, responsif (*mobile-first*), dan cepat yang dirancang untuk memudahkan guru mata pelajaran dalam mengelola administrasi pembelajaran sehari-hari secara efisien, transparan, dan terstruktur sesuai standar Kurikulum Merdeka.

Aplikasi ini mendukung **arsitektur Dual-Mode**:
1. 🟢 **Cloud Supabase Mode (Online)**: Sinkronisasi data multi-pengguna *real-time* ke database PostgreSQL Supabase yang aman dengan proteksi *Row Level Security* (RLS).
2. 🟡 **PWA Offline Mode (Lokal)**: Beroperasi tanpa internet menggunakan *Service Worker* dan penyimpanan lokal browser (*LocalStorage*) tanpa kehilangan fungsionalitas.

---

## 🚀 Fitur Utama

- ⏱️ **Presensi Siswa Kilat**: 1-Klik *"Set Semua Hadir"*, status H/S/I/A, sinkronisasi jadwal harian berbasis tanggal yang dipilih (*Selected Date*), dan integrasi dispensasi.
- 📖 **Jurnal Mengajar Terintegrasi**: Pencatatan materi pokok, kegiatan KBM, kendala/refleksi, dan cetak lembar jurnal resmi.
- 📝 **Catatan Ceklis & Penilaian Tugas**: Manajemen ceklis catatan materi, penilaian tugas mandiri (skor 0–100, quick-fill toolbar), status Bebas Catatan & Bebas Tugas.
- 🔍 **Pemeriksaan Tugas Multi-Sesi**: Dashboard evaluasi kelengkapan nilai tugas siswa lintas pertemuan.
- 👥 **Master Kelompok Belajar & Tugas Kelompok**: Pembagian kelompok per kelas & mapel, generator pembagian kelompok otomatis atomik (*round-robin*), dan penilaian batch kelompok.
- 🏠 **Modul Pekerjaan Rumah (PR) 2-Tahap**: Pembuatan penugasan PR (*Menunggu Diperiksa*) dan dashboard pemeriksaan PR dengan penanda status kehadiran siswa.
- 📜 **Riwayat Pembelajaran**: Arsip lengkap sesi KBM, absensi, dan jurnal per tahun ajaran.
- 📊 **Rekapitulasi Kelas & Rapor Portofolio Siswa**: Rekap persentase kehadiran kelas, rekap 5-tab individual siswa (Presensi, Tugas Mandiri, Catatan, PR, Tugas Kelompok), serta cetak PDF & bagikan via WhatsApp.
- 🧮 **Ledger Nilai Akhir & Simulator Katrol**: Kalkulator nilai akhir berbasis 7 komponen bobot fleksibel, pembobotan proporsional berjalan, penguncian snapshot rapor semester, dan simulator penyesuaian nilai (*Min-Max Rescaling*).
- 📅 **Jadwal Mengajar Rutin & Master Jam JP**: Matriks jadwal mingguan per guru, manajemen slot jam pelajaran (termasuk slot istirahat), dan banner jadwal mengajar pasif-interaktif.
- 🏫 **Data Kelas & Siswa**: Pengelolaan rombel kelas multi-tahun ajaran, pendataan siswa, dan impor data siswa via Excel.
- 🎓 **Kenaikan Kelas Atomik**: Wizard promosi kelas, kelulusan rombel, dan penanganan siswa tinggal kelas secara aman dalam 1 transaksi database.
- 🔐 **Multi-User Role System (Admin / Guru)**: Pemisahan hak akses master data sekolah dan isolasi penuh data kegiatan belajar mengajar antar guru.
- 🏷️ **Master Jurusan Dinamis**: Pengelolaan jurusan sekolah secara fleksibel tanpa batasan hardcoded.
- 📚 **Kategori Mata Pelajaran Generik (UMUM / PILIHAN)**: Fleksibilitas kategorisasi mapel tanpa keterikatan kaku pada jurusan.
- 💾 **Cadangan & Pemulihan (Backup & Restore)**: Ekspor/impor seluruh data sistem dalam format JSON terenkripsi/terstruktur.

---

## 👥 Sistem Peran & Hak Akses (Role-Based Architecture)

Aplikasi menerapkan pemisahan peran yang tegas antara **Otorisasi Izin (Permission)** dan **Kepemilikan Data Mengajar (Teaching Ownership)**:

### 1. 🛡️ ADMIN
- **Kelola Master Data Sekolah**: Menambah, mengedit, mengaktifkan/menonaktifkan Master Jurusan, Master Mata Pelajaran, Master Kelas, Data Siswa, Master Jam Pelajaran, dan Pengaturan Identitas Sekolah.
- **Eksekusi Kenaikan Kelas**: Memproses kenaikan rombel dan kelulusan siswa secara massal.
- **Data Mengajar Pribadi**: Sebagai pengajar, Admin tetap memiliki data jadwal, absensi, dan nilai tugasnya sendiri yang terisolasi dari guru lain.

### 2. 👨‍🏫 GURU
- **Akses Master Data (Read-Only)**: Dapat melihat daftar jurusan aktif, kelas, siswa, dan mata pelajaran sekolah.
- **Isolasi Penuh Data Mengajar**: Hanya dapat melihat, menambah, mengubah, dan menghapus jadwal mengajar, sesi presensi, jurnal, catatan, nilai tugas, PR, kelompok belajar, dan ledger miliknya sendiri (`user_id = auth.uid()`).
- **Filter Otomatis**: Dropdown Kelas dan Mapel pada form KBM secara otomatis difilter sesuai jadwal mengajar milik guru yang bersangkutan.

> [!NOTE]
> **Prinsip Dasar**:
> - **Role** = Penentu hak izin modifikasi Master Data (`public.is_admin()`).
> - **jadwal_mengajar.user_id** = Penentu kepemilikan dan visibilitas ruang mengajar guru.

---

## 🏗️ Arsitektur Data

Struktur database Supabase PostgreSQL dirancang dalam 3 lapisan kepemilikan:

1. **Shared Master Data** (`kelas`, `siswa`, `mata_pelajaran`, `jurusan`, `school_settings`, `jam_pelajaran_master`):
   - Dapat dibaca oleh seluruh user terautentikasi (*Authenticated Read*).
   - Hanya dapat dimodifikasi oleh Administrator (*Admin-Only Write*).
2. **Root Private Teaching Data** (`jadwal_mengajar`, `sesi_mengajar`, `catatan_checklist`, `nilai_tugas`, `pr_tugas`, `kelompok_belajar`, `kegiatan_siswa`, `ledger_config`, `ledger_finalisasi`, `profil_guru`):
   - Memiliki kolom `user_id UUID REFERENCES auth.users(id)`.
   - Terisolasi penuh: Guru hanya dapat mengakses dan mengelola baris miliknya (`auth.uid() = user_id`).
3. **Child Inherited Teaching Data** (`absensi`, `jurnal_mengajar`, `pr_nilai_siswa`, `kelompok_anggota`):
   - Hak akses diwariskan dari tabel induknya via relasi foreign key (misal: `sesi_mengajar.user_id = auth.uid()`).

---

## 🗄️ Database & Instalasi Supabase

### Skenario A: Database Production Berjalan
Bagi sistem yang sudah berjalan, seluruh migrasi telah diaplikasikan secara kumulatif. Tidak perlu menjalankan ulang file skema.

### Skenario B: Pemasangan Baru (Fresh Install)
Gunakan installer mandiri **`schema.sql`** untuk inisialisasi database Supabase baru dari nol (21 tabel, RLS hardened, functions, triggers, dan RPC).

Setelah instalasi selesai, jalankan **`verify_schema_v1_1_0.sql`** untuk memastikan seluruh tabel, kolom, index, dan kebijakan keamanan terpasang sempurna (*100% PASS*).

---

## 🚀 Panduan Fresh Install Langkah Demi Langkah

1. **Buat Project Supabase Baru**: Buka [supabase.com](https://supabase.com) dan buat project baru.
2. **Buka SQL Editor**: Buka menu **SQL Editor** pada dashboard Supabase.
3. **Eksekusi Installer**: Salin seluruh isi file **`schema.sql`** lalu klik **Run**.
4. **Verifikasi Instalasi**: Salin dan jalankan isi file **`verify_schema_v1_1_0.sql`**. Pastikan seluruh metrik bernilai **PASS**.
5. **Daftarkan Akun Pertama**: Buka aplikasi web di browser, masuk ke menu Login $\rightarrow$ **Daftar Akun Baru**.
6. **Promosikan Akun Pertama Menjadi Admin**: Akun baru secara default memiliki peran `'guru'`. Buka SQL Editor di Supabase dan jalankan query:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = 'email_anda@sekolah.sch.id';
   ```
7. **Hubungkan Aplikasi ke Supabase**:
   - Salin **Project URL** dan **Project API Key (anon/public)** dari menu **Project Settings > API**.
   - Buka aplikasi web $\rightarrow$ Menu **Pengaturan Sistem & Master Data** $\rightarrow$ Tab **Database** $\rightarrow$ Masukkan URL & Anon Key $\rightarrow$ Klik **Simpan & Hubungkan**.
8. **Login**: Masuk menggunakan akun admin yang telah didaftarkan.
9. **Isi Master Data**: Mulai isi Master Jurusan (jika SMK/Kejuruan), Master Mata Pelajaran, Master Kelas, dan Data Siswa.

---

## 🏷️ Master Jurusan Dinamis

- **Dinamis & Fleksibel**: Sekolah dapat menambah jurusan apapun (misal: *Teknik Komputer dan Jaringan*, *Desain Komunikasi Visual*, *Akuntansi*, dll.) tanpa terikat kode bawaan sistem.
- **Dukungan Sekolah Non-Kejuruan**: Master Jurusan dapat dibiarkan kosong (0 jurusan). Rombel kelas dapat dibuat tanpa memilih jurusan (*Tanpa Jurusan / Umum*).
- **Status Aktif/Nonaktif**: Jurusan yang dinonaktifkan tidak akan muncul pada dropdown pembuatan kelas baru, namun histori kelas lama tetap terjaga utuh.

---

## 📚 Kategori Mata Pelajaran (UMUM & PILIHAN)

Kategori mata pelajaran distandardisasi menjadi 2 kelompok generik:
- **`UMUM`**: Mata pelajaran wajib, fondasi, muatan nasional, atau umum.
- **`PILIHAN`**: Mata pelajaran pilihan, peminatan, konsentrasi keahlian, muatan lokal, atau vokasi.

> [!IMPORTANT]
> Kategori **PILIHAN** tidak mengunci mata pelajaran ke jurusan tertentu. Penugasan guru, kelas, dan mata pelajaran tetap ditentukan secara fleksibel melalui **Jadwal Mengajar**.

---

## 📅 Integrasi Jadwal Mengajar & Presensi

- **Berbasis Pengguna**: Jadwal mengajar dikelola secara individual per guru.
- **Sinkronisasi Tanggal Aktif (*Selected Date*)**: Saat guru memilih tanggal pada halaman Absen, banner jadwal akan menampilkan daftar sesi mengajar pada hari tersebut.
- **1-Klik "Pilih Sesi"**: Mengklik tombol *"Pilih Sesi"* pada kartu jadwal akan secara otomatis menyinkronkan pilihan Tanggal, Kelas, dan Mata Pelajaran serta memuat data presensi sesi tersebut.
- **Hari Libur / Tanpa Jadwal**: Jika tidak ada jadwal pada tanggal yang dipilih, sistem menampilkan status informatif tanpa merusak pilihan manual guru.
- **In-Memory Schedule Cache**: Pergantian tanggal dan navigasi menu berlangsung instan tanpa query jaringan berulang.

---

## 📜 Riwayat Versi (Changelog)

### v1.1.0 (Rilis Terbaru)
- ✨ **Multi-User Role Architecture**: Integrasi `public.profiles`, helper `is_admin()`, dan trigger registrasi pengguna.
- 🔒 **Teaching Data Isolation**: Isolasi data operasional guru berbasis `user_id` pada 10 tabel privat dan 4 tabel relasi turunan.
- 🏷️ **Dynamic Master Jurusan**: Manajemen Master Jurusan dinamis dan relasi `kelas.jurusan_id`.
- 📚 **Kategori Mapel UMUM / PILIHAN**: Standardisasi kategori mapel generik bebas hardcode.
- ⚡ **Schedule Cache & Selected-Date Sync**: Pemuatan jadwal instan dan sinkronisasi otomatis pemilih tanggal ke sesi KBM.
- 🪟 **SettingsModal UI & Scroll Fix**: Perbaikan scrolling vertikal tunggal, scroll horizontal tab, dan navigasi instan tanpa lag.
- 📦 **Database Installer v1.1.0**: File `schema.sql` 21 tabel siap pakai + script uji `verify_schema_v1_1_0.sql`.

### v1.0.0
- Inisialisasi rilis stabil SIA-Jurnal (Presensi, Jurnal Mengajar, Catatan Ceklis, Penilaian Tugas, PR, Kelompok Belajar, Ledger Nilai, Simulator Katrol, dan Integrasi Supabase).

---

## 🔒 Catatan Keamanan (Security Notes)

- **Row Level Security (RLS)**: 100% tabel dilindungi oleh kebijakan RLS granular. Kebijakan permisif terbuka (`USING (true)`) telah dihapus total.
- **Isolasi Data Antar Guru**: Guru tidak dapat melihat, mengubah, atau menghapus data presensi, nilai, jurnal, atau tugas milik guru lain.
- **Keamanan Kunci API**: Hanya gunakan **Publishable / Anon Key** pada frontend aplikasi. **JANGAN PERNAH** memasukkan `service_role` key ke dalam frontend atau repositori publik.

---

## 💻 Menjalankan Aplikasi Secara Lokal

1. **Cara Praktis**: Klik ganda file **`start-app.bat`** di Windows.
2. **Via Terminal / Command Line**:
   ```bash
   python -m http.server 8085
   ```
   Buka browser di: `http://localhost:8085`

---

## 🌐 Deployment

Aplikasi dapat dideploy secara statis melalui platform hosting modern:
- **GitHub Repository**: Branch utama `main`.
- **Netlify / Vercel**: Terhubung langsung (*Continuous Deployment*) ke branch `main`.

---

## 👨‍💻 Kredit Pengembang & Lisensi

* **Aplikasi**: SIA & Jurnal Guru Mapel
* **Versi**: v1.1.0
* **Pengembang**: Ammar
* **Lokasi**: Bantaeng, Sulawesi Selatan
* **Hak Cipta**: © 2026 Ammar. All rights reserved.
