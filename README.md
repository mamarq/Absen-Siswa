# 📚 SIA-Jurnal: Sistem Informasi Akademik & Jurnal Mengajar Guru

> **Aplikasi Manajemen Pembelajaran, Presensi, Jurnal Mengajar, Catatan, Penilaian Tugas & Pekerjaan Rumah (PR) Berbasis Web (PWA & Cloud Supabase)**

---

## 🌟 Gambaran Umum

**SIA-Jurnal** adalah aplikasi web modern, responsif (*mobile-first*), dan cepat yang dirancang untuk memudahkan guru mata pelajaran dalam mengelola administrasi pembelajaran sehari-hari secara efisien, transparan, dan terstruktur.

Aplikasi ini mendukung **arsitektur Dual-Mode**:
1. 🟢 **Cloud Supabase Mode (Online)**: Sinkronisasi data *real-time* ke cloud database PostgreSQL Supabase multi-perangkat (laptop, smartphone, tablet).
2. 🟡 **PWA Offline Mode (Lokal)**: Beroperasi 100% tanpa internet menggunakan *Service Worker* dan penyimpanan lokal browser (*LocalStorage*) tanpa kehilangan fungsionalitas.

---

## 🚀 Fitur Unggulan

### 1. ⏱️ Presensi Siswa Kilat Per Sesi
* **1-Klik "Set Semua Hadir"** untuk pengisian absensi super cepat (< 1 menit).
* Status kehadiran standar: **Hadir (H)**, **Sakit (S)**, **Izin (I)**, dan **Alfa (A)**.
* Ringkasan kehadiran live terhitung otomatis.
* Indikator otomatis catatan kegiatan / dispensasi siswa pada tanggal KBM.

### 2. 📖 Jurnal Mengajar Terintegrasi
* Pencatatan materi pokok, kegiatan pembelajaran, dan kendala/refleksi guru per pertemuan.
* Ringkasan kehadiran siswa otomatis disematkan ke dalam lembar jurnal.
* Fitur **Cetak Lembar Jurnal Resmi** lengkap dengan kop surat sekolah dan tanda tangan.

### 3. 📝 Catatan Ceklis & Penilaian Tugas (Format Sederhana)
* **Catatan Ceklis**: Pantau ketuntasan mencatat atau praktik siswa dengan status Tuntas / Belum Tuntas serta kolom catatan khusus.
* **Penilaian Tugas**: Input skor nilai (0–100) per siswa dilengkapi toolbar isi cepat (75, 80, 85, 90, 95, 100) dan kalkulasi KKM otomatis.
* **Fitur Mode Bebas Catatan & Bebas Tugas**: Kemampuan menandai sesi pertemuan yang hanya berisi materi/diskusi/ceramah tanpa tagihan tugas.

### 4. 🏠 Modul Pekerjaan Rumah (PR) 2-Tahap — *Baru* ✨
Dirancang khusus untuk siklus pemberian dan pemeriksaan pekerjaan rumah:
* **Tahap 1 (Buat PR)**: Catat topik/instruksi soal PR pada hari KBM. Status otomatis tercatat sebagai **`Menunggu Diperiksa`** tanpa batas kedaluwarsa.
* **Tahap 2 (Pemeriksaan PR)**: Dashboard penilaian PR dengan filter kelas/mapel, toolbar nilai cepat, dan opsi toggle **"Tidak Mengumpulkan"** (otomatis mendisable dan mengosongkan nilai).
* **Sidebar Badge Counter**: Menampilkan jumlah PR yang berstatus menunggu secara *real-time*.
* **Histori Snapshot**: Rekaman `academic_year` dicatat permanen saat PR dibuat sehingga data nilai masa lalu tidak terpengaruh saat kenaikan kelas.

### 5. 🔍 Pusat Pemeriksaan Catatan & Tugas Multi-Sesi
* Filter multi-parameter (Kelas, Mapel, Jenis Sesi, Status Ketuntasan, Rentang Tanggal).
* **Modal "Bagikan Rekap Kelas"**: Matriks ketuntasan seluruh siswa dalam satu kelas dengan ekspor ke **PDF Resmi (Lanskap)** atau cetak langsung.

### 6. 🎓 Rekap Individual Siswa & Rapor Portofolio (4 Tab Terpadu)
* **Tab 1 - Presensi**: Statistik kehadiran (*Hadir, Sakit, Izin, Alfa*) dan visual persentase ketuntasan.
* **Tab 2 - Nilai Tugas & Ulangan**: Histori seluruh nilai tugas, rata-rata nilai, nilai tertinggi/terendah, dan grafik tren belajar siswa.
* **Tab 3 - Catatan & Keaktifan**: Histori ceklis catatan dan sikap siswa.
* **Tab 4 - Pekerjaan Rumah (PR)**: Riwayat pengerjaan PR, status pengumpulan, skor, dan catatan guru.
* **Cetak Rapor Portofolio (PDF)** & **Kirim Laporan ke WhatsApp Orang Tua (1-Klik via `wa.me`)**.

### 7. 📚 Master Mata Pelajaran Dinamis
* Kelola daftar mata pelajaran, kode singkatan (misal: MTK, INF, PKK), dan kelompok (Umum / Kejuruan).
* Dropdown Combobox interaktif dengan *search box*, pencarian cerdas, dan visual dot kategori.

### 8. 📅 Multi-Tahun Ajaran & Kenaikan Kelas Atomik
* Penggantian tahun ajaran aktif secara global via dropdown navigasi atas.
* **Wizard Kenaikan Kelas**: Fitur promosi kelas massal (*Promote, Retain, Graduate*) dengan Stored Procedure transaksi aman di database.

### 9. 🏫 Pengaturan Identitas Sekolah & Kop Surat Resmi
* *Single Source of Truth* untuk kop surat seluruh dokumen cetak dan PDF resmi: Nama Sekolah, Instansi Induk, Dinas, NPSN, Alamat, Kontak, dan Logo Sekolah.
* Profil Guru & Kepala Sekolah lengkap dengan NIP untuk kolom tanda tangan resmi otomatis.

### 10. 📊 Manajemen Siswa & Impor Excel (.xlsx / .csv)
* Tambah/edit data siswa dengan validasi NISN dan nomor absen.
* Template unduhan Excel dan fitur impor drag & drop dengan auto-matching kelas.

---

## 🗄️ Arsitektur Database (Supabase PostgreSQL - 13 Tabel)

Semua tabel menggunakan Primary Key bertipe `UUID` (`gen_random_uuid()`) dan dilindungi oleh kebijakan *Row Level Security* (RLS):

| No | Nama Tabel | Deskripsi & Fungsi |
|:--:|---|---|
| **1** | `kelas` | Master data rombongan belajar, tingkat, jurusan, dan tahun ajaran |
| **2** | `mata_pelajaran` | Master data mata pelajaran dan kategori (Umum/Kejuruan) |
| **3** | `siswa` | Data identitas siswa, NISN, no absen, status aktif, dan `kelas_id` |
| **4** | `sesi_mengajar` | Sesi pertemuan KBM harian (kelas, mapel, tanggal) |
| **5** | `absensi` | Rekaman presensi per siswa per sesi (H/S/I/A) |
| **6** | `jurnal_mengajar` | Materi pokok, kegiatan pembelajaran, dan kendala guru |
| **7** | `catatan_checklist`| Sesi ceklis catatan siswa & status Bebas Catatan |
| **8** | `nilai_tugas` | Sesi penilaian tugas, KKM, daftar nilai, & status Bebas Tugas |
| **9** | `kegiatan_siswa` | Catatan agenda, pelanggaran, dispensasi, & prestasi siswa |
| **10**| `pr_tugas` | Master penugasan PR (topik, tanggal, status menunggu/selesai) |
| **11**| `pr_nilai_siswa` | Detail nilai PR & status pengumpulan per siswa |
| **12**| `school_settings` | Pengaturan kop surat sekolah (instansi, dinas, nama, logo) |
| **13**| `profil_guru` | Profil guru mapel & kepala sekolah untuk penandatanganan |

---

## 📂 Struktur File Project

```text
d:/Aplikasi/Absen Siswa/
├── index.html                           # Entry point utama aplikasi web
├── styles.css                           # Styling kustom, animasi, & utilitas tema
├── app.js                               # Router utama & state management
├── supabase-client.js                   # Lapisan data layer (Supabase Cloud + LocalStorage)
├── schema.sql                           # Master Schema 13 Tabel (Turnkey 1-File Setup)
├── supabase_migration_pekerjaan_rumah.sql # Migration patch khusus fitur PR
├── manifest.json                        # Konfigurasi Web App Manifest (PWA)
├── sw.js                                # Service Worker offline cache (v1.6.0)
├── components/
│   ├── AbsenView.js                     # Modul Presensi Harian Siswa
│   ├── JurnalView.js                    # Modul Jurnal Pembelajaran Guru
│   ├── TugasView.js                     # Modul Catatan Ceklis & Penilaian Tugas
│   ├── PRBuatView.js                    # Modul Buat Penugasan PR (Tahap 1)
│   ├── PRPemeriksaanView.js             # Modul Pemeriksaan & Nilai PR (Tahap 2)
│   ├── PemeriksaanTugasView.js          # Modul Dashboard Evaluasi Tugas Multi-Sesi
│   ├── KegiatanView.js                  # Modul Catatan Kegiatan & Sikap Siswa
│   ├── RiwayatView.js                   # Modul Arsip Riwayat Sesi Mengajar
│   ├── RekapView.js                     # Modul Rekapitulasi Presensi Kelas & Ekspor
│   ├── RekapSiswaView.js                # Modul Rekap Individual Siswa & Rapor Portofolio
│   ├── AuthView.js                      # Halaman Login & Registrasi Akun Guru
│   ├── Sidebar.js                       # Sidebar Navigasi Collapsible
│   ├── Topbar.js                        # Header minimalis, breadcrumb, & filter tahun ajaran
│   ├── ClassCombobox.js                 # Shadcn-style Combobox Pemilihan Kelas
│   ├── MapelCombobox.js                 # Shadcn-style Combobox Pemilihan Mapel
│   ├── AcademicYearCombobox.js          # Shadcn-style Combobox Tahun Ajaran
│   ├── DatePicker.js                    # Shadcn-style Kalender & Pemilih Tanggal
│   ├── SettingsModal.js                 # Modal Pengaturan Sistem & Database
│   ├── SiswaModal.js                    # Modal Kelola Siswa & Impor Excel
│   ├── KenaikanKelasModal.js            # Modal Kenaikan Kelas & Promosi Rombel
│   └── ShareRekapKelasModal.js          # Modal Cetak / PDF Rekap Tugas Multi-Sesi
├── data/
│   ├── appInfo.js                       # Metadata aplikasi & kredit pengembang
│   └── initialData.js                   # Data template netral untuk instalasi baru
└── icons/                               # Aset ikon PWA (192px, 512px, SVG)
```

---

## 🛠️ Panduan Instalasi & Menjalankan Aplikasi

### 1. Menjalankan Secara Lokal (Offline)
* **Cara Paling Praktis**: Cukup klik ganda file **`start-app.bat`**. Browser akan otomatis terbuka di `http://localhost:8085`.
* **Atau via Terminal**:
  ```bash
  python -m http.server 8085
  ```

### 2. Setup Database Supabase Cloud (Turnkey 1-File Setup)
1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka menu **SQL Editor** pada dashboard Supabase Anda.
3. Buka file **`schema.sql`**, salin seluruh isinya, lalu klik **Run**.
   *(Seluruh 13 tabel, Stored Procedure Kenaikan Kelas, Index, dan RLS langsung terpasang otomatis).*
4. Buka menu **Project Settings > API** di Supabase untuk menyalin:
   * **Project URL** (`https://xxx.supabase.co`)
   * **Project API Key (anon/public)** (`eyJhbG...`)
5. Buka aplikasi di browser $\rightarrow$ Masuk ke menu **Pengaturan Sistem > Database** $\rightarrow$ Masukkan URL & Anon Key $\rightarrow$ Klik **Simpan & Hubungkan**.
6. Status di header akan otomatis berubah menjadi 🟢 **Supabase Terhubung**.

### 3. Deploy ke Netlify / Vercel
1. Hubungkan repository GitHub Anda ke [app.netlify.com](https://app.netlify.com).
2. Konfigurasi build:
   * **Build command**: *(kosongkan)*
   * **Publish directory**: `.` *(titik / root)*
3. Aplikasi Anda langsung aktif dan dapat diakses dari mana saja.

---

## 👨‍💻 Kredit Pengembang & Lisensi

* **Nama Aplikasi**: SIA & Jurnal Guru Mapel
* **Pengembang**: Ammar
* **Asal**: Bantaeng, Sulawesi Selatan
* **Hak Cipta**: © 2026 Ammar. All rights reserved.

