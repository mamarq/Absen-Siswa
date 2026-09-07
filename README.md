# 📚 SIA-Jurnal: Sistem Informasi Akademik & Jurnal Mengajar Guru

> **Aplikasi Manajemen Pembelajaran, Presensi, Jurnal Mengajar, Penilaian Tugas & PR, Master Kelompok Belajar, Ledger Nilai Akhir Fleksibel, Simulator Katrol Nilai, & Jadwal Mengajar Rutin Berbasis Web (PWA & Cloud Supabase)**

---

## 🌟 Gambaran Umum

**SIA-Jurnal** adalah aplikasi web modern, responsif (*mobile-first*), dan cepat yang dirancang untuk memudahkan guru mata pelajaran dalam mengelola administrasi pembelajaran sehari-hari secara efisien, transparan, dan terstruktur sesuai standar Kurikulum Merdeka.

Aplikasi ini mendukung **arsitektur Dual-Mode**:
1. 🟢 **Cloud Supabase Mode (Online)**: Sinkronisasi data *real-time* ke cloud database PostgreSQL Supabase multi-perangkat (laptop, smartphone, tablet).
2. 🟡 **PWA Offline Mode (Lokal)**: Beroperasi 100% tanpa internet menggunakan *Service Worker* dan penyimpanan lokal browser (*LocalStorage*) tanpa kehilangan fungsionalitas.

---

## 🚀 Fitur Unggulan

### 1. ⏱️ Presensi Siswa Kilat Per Sesi
* **1-Klik "Set Semua Hadir"** untuk pengisian absensi super cepat (< 1 menit).
* Status kehadiran standar: **Hadir (H)**, **Sakit (S)**, **Izin (I)**, dan **Alfa (A)**.
* Sakit dan Izin secara otomatis dihitung berbobot 50% (0.5) dalam formula persentase kehadiran Ledger Nilai.
* Indikator otomatis catatan kegiatan / dispensasi siswa pada tanggal KBM.
* **Banner Saran Jadwal Hari Ini (100% Pasif/Opt-In)**: Menampilkan saran jadwal rutin mengajar hari ini tanpa mengubah form secara otomatis kecuali guru mengklik *"Pilih Sesi"*.

### 2. 📖 Jurnal Mengajar Terintegrasi
* Pencatatan materi pokok, kegiatan pembelajaran, dan kendala/refleksi guru per pertemuan.
* Ringkasan kehadiran siswa otomatis disematkan ke dalam lembar jurnal.
* Fitur **Cetak Lembar Jurnal Resmi** lengkap dengan kop surat sekolah dan tanda tangan.

### 3. 📝 Catatan Ceklis, Penilaian Tugas, & Penanda Status Absensi — *Terbaru* ✨
* **Penanda Status Absensi Terintegrasi**: Sinkronisasi data presensi harian secara otomatis ke seluruh form penilaian (Ceklis, Tugas Mandiri, Tugas Kelompok, dan Pemeriksaan PR).
  * 🔴 **Alfa / Alpa**: Badge merah mencolok + highlight baris lembut.
  * 🔵 **Sakit**: Badge kuning/amber + catatan dispensasi (misal: *"Demam"*).
  * 🟡 **Izin**: Badge biru/sky + keterangan izin.
  * **Input Nilai Tetap 100% Aktif**: Kolom input nilai, toggle ceklis, dan chip quick-score **TIDAK di-disable**, sehingga guru dapat langsung memberikan nilai jika siswa mengumpulkan tugas susulan via WhatsApp.
* **Catatan Ceklis**: Pantau ketuntasan mencatat atau praktik siswa dengan status Tuntas / Belum Tuntas serta kolom catatan khusus.
* **Penilaian Tugas**: Input skor nilai (0–100) per siswa dilengkapi toolbar isi cepat (*Quick-Fill 75, 80, 85, 90, 95, 100*) dan kalkulasi KKM otomatis.
* **Fitur Mode Bebas Catatan & Bebas Tugas**: Kemampuan menandai sesi pertemuan yang hanya berisi materi/diskusi/ceramah tanpa tagihan tugas.
* **Konteks Sesi Aktif Bersama (*Shared Active Context*)**: Pilihan Kelas, Mapel, dan Tanggal tersinkronisasi otomatis saat berpindah antar tab tanpa memaksa default kelas tertentu (*clean empty state*).

### 4. 👥 Master Kelompok Belajar & Tugas Kelompok Kolaboratif
* **Master Kelompok Belajar**: Pembagian kelompok per kelas dan per mata pelajaran (aturan 1 siswa 1 kelompok per mapel).
* **Generator Kelompok Otomatis**: Pembagian kelompok instan secara merata (*random round-robin*) melalui PostgreSQL Stored Procedure Atomik.
* **Penilaian Tugas Kelompok**: Penilaian batch sekaligus satu kelompok dengan dukungan *Floating Quick-Fill Toolbar* dan penanda status absensi anggota kelompok.
* **Desain *Immutable Snapshot***: Nilai dan nama kelompok siswa direkam permanen saat tugas dinilai, sehingga riwayat nilai lama tetap aman dan tidak berubah meskipun susunan kelompok dibubarkan atau diacak ulang pada materi berikutnya.
* **Sub-Tab Tugas Kelompok di Rekap Siswa**: Riwayat nilai kelompok individual lengkap dengan nama kelompok saat tugas dikerjakan.

### 5. 🏠 Modul Pekerjaan Rumah (PR) 2-Tahap
* **Tahap 1 (Buat PR)**: Catat topik/instruksi soal PR pada hari KBM. Status otomatis tercatat sebagai **`Menunggu Diperiksa`** tanpa batas kedaluwarsa.
* **Tahap 2 (Pemeriksaan PR)**: Dashboard penilaian PR dengan filter kelas/mapel, toolbar nilai cepat, penanda status absensi siswa, dan opsi toggle **"Tidak Mengumpulkan"**.
* **Sidebar Badge Counter**: Menampilkan jumlah PR yang berstatus menunggu secara *real-time*.

### 6. 🧮 Ledger & Kalkulator Nilai Akhir Fleksibel (Hybrid Live + Snapshot)
* **7 Komponen Penilaian On/Off**: Presensi (Sakit/Izin 0.5), Tugas Mandiri, Tugas Kelompok, PR, Ceklis Catatan, Sumatif STS & SAS, dan Sikap.
* **Pembobotan Fleksibel**: Atur persentase bobot tiap komponen aktif dengan indikator validasi total bobot = 100%.
* **KKM & Skala Predikat Fleksibel (A, B, C, D)**: Konfigurasi batas nilai minimal per rombel dan mapel.
* **Generator Deskripsi Capaian**: Narasi capaian pembelajaran otomatis berbasis Kurikulum Merdeka.
* **Redistribusi Bobot Proporsional (Interim Dynamic)**: Nilai berjalan semester tetap terhitung adil tanpa menghukum siswa dengan nilai 0 untuk ujian yang belum berlangsung.
* **Finalisasi & Kunci Rapor**: Bekukan snapshot nilai rapor semester ke arsip permanen (tabel `ledger_finalisasi`).
* **Dedicated Standalone Print Engine (A4 Landscape)**: Cetak dokumen Ledger Resmi bebas dari elemen UI/tombol/sidebar, lengkap dengan Kop Surat Sekolah, formula bobot, KKM, ringkasan statistik, dan kolom tanda tangan Kepala Sekolah & Guru.

### 7. ⚖️ Simulator Penyesuaian Nilai (Katrol)
* **Penyebaran Ulang (*Min-Max Linear Rescaling*)**: Menyesuaikan seluruh distribusi nilai satu kelas ke rentang target baru (misal 75 s/d 85) secara proporsional sambil menjaga urutan peringkat siswa.
* **Rumus Standar Excel**:
  $$\text{Nilai\_Katrol} = \text{Batas\_Terendah} + \left( \frac{\text{Nilai\_Asli} - \text{Min\_Kelas}}{\text{Max\_Kelas} - \text{Min\_Kelas}} \right) \times (\text{Batas\_Tertinggi} - \text{Batas\_Terendah})$$
* **Murni Simulator (Read-Only)**: Tidak mengubah data nilai asli di database maupun rapor resmi.
* **Tabel Komparasi Berdampingan**: Menampilkan Nilai Asli, Nilai Katrol, Selisih Delta ($+X$), Predikat Katrol, dan Status KKM Katrol.
* **Dedicated Standalone Print Engine (A4 Portrait)**: Cetak tabel komparasi nilai katrol rapi dan terisolasi untuk arsip rapat evaluasi nilai guru.

### 8. 📅 Jadwal Mengajar Guru & Master Jam Pelajaran (Dukungan Slot Istirahat) — *Baru* ✨
* **Master Jam Pelajaran (Per-Satuan JP & Fallback Mandiri)**: Kelola slot jam pelajaran sekolah secara fleksibel (13 Slot Standar: 11 JP KBM @ 40 Menit + 2 Slot Istirahat). Tersedia fallback hardcode instan (`constants/masterJam.js`) sehingga form presensi & jadwal tetap dapat digunakan tanpa konfigurasi awal database.
* **Dukungan Slot Istirahat Berpenomoran**: Sekolah dengan penomoran jam istirahat (misal Istirahat 1 & Istirahat 2) didukung penuh dengan properti `tipe_slot: 'istirahat'` & `is_istirahat: true`.
* **Kalkulasi Otomatis Durasi JP Bersih**: Sistem secara otomatis mengecualikan slot bertipe `istirahat` dari perhitungan total jam mengajar efektif:
  $$\text{Jumlah\_JP} = \text{Banyaknya Slot Mengajar Aktif dalam Rentang [Jam Mulai, Jam Selesai]}$$
* **Matriks Jadwal Mingguan**: Grid kalender visual (Senin s.d. Sabtu) dengan kartu jadwal lengkap dan penghitungan total beban ajar per minggu.
* **Cetak Lembar Jadwal Resmi**: Cetak dokumen jadwal mengajar lengkap dengan Kop Sekolah dan kolom tanda tangan Kepala Sekolah & Guru.

### 9. 🎓 Rekap Individual Siswa & Rapor Portofolio (5 Tab Terpadu)
* **Tab 1 - Presensi**: Statistik kehadiran (*Hadir, Sakit, Izin, Alfa*) dan persentase ketuntasan.
* **Tab 2 - Nilai Tugas Mandiri**: Histori seluruh nilai tugas harian individu, rata-rata, dan grafik tren belajar.
* **Tab 3 - Catatan & Keaktifan**: Histori ceklis kelengkapan catatan dan timeline sikap.
* **Tab 4 - Pekerjaan Rumah (PR)**: Riwayat pengerjaan PR dan catatan koreksi guru.
* **Tab 5 - Tugas Kelompok**: Riwayat nilai tugas kelompok dan nama kelompok saat tugas dinilai.
* **Cetak Rapor Portofolio (PDF)** & **Kirim Laporan ke WhatsApp Orang Tua (1-Klik via `wa.me`)**.

### 10. 🏫 Pengaturan Identitas Sekolah & Sinkronisasi Profil Guru
* Pengaturan kop surat seluruh dokumen cetak dan PDF: Nama Sekolah, Instansi Induk, Dinas, NPSN, Alamat, Kontak, dan Logo Sekolah.
* Profil Guru & Kepala Sekolah lengkap dengan NIP untuk kolom tanda tangan resmi otomatis.

---

## 🗄️ Arsitektur Database (Supabase PostgreSQL - 19 Tabel)

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
| **8** | `nilai_tugas` | Sesi penilaian tugas individu, tugas kelompok, KKM, & Bebas Tugas |
| **9** | `kegiatan_siswa` | Catatan agenda, pelanggaran, dispensasi, sikap & prestasi siswa |
| **10**| `pr_tugas` | Master penugasan PR (topik, tanggal, status menunggu/selesai) |
| **11**| `pr_nilai_siswa` | Detail nilai PR & status pengumpulan per siswa |
| **12**| `kelompok_belajar` | Master data kelompok siswa per kelas, mapel, dan tahun ajaran |
| **13**| `kelompok_anggota` | Relasi siswa dalam kelompok (1 siswa 1 kelompok per mapel) |
| **14**| `ledger_config` | Konfigurasi bobot komponen penilaian, KKM, & predikat A/B/C/D |
| **15**| `ledger_finalisasi` | Snapshot permanen nilai rapor yang difinalisasi & dikunci per semester |
| **16**| `school_settings` | Pengaturan data sekolah & kop surat resmi (nama, instansi, logo) |
| **17**| `profil_guru` | Profil guru & kepala sekolah penandatangan dokumen resmi |
| **18**| `jam_pelajaran_master` | Slot jam pelajaran per satuan JP & rentang waktu bel sekolah |
| **19**| `jadwal_mengajar` | Jadwal rutin mingguan guru per kelas, mapel, hari, & ruangan |

---

## 📂 Struktur File Project

```text
d:/Aplikasi/Absen Siswa/
├── index.html                           # Entry point utama aplikasi web
├── styles.css                           # Styling kustom Tailwind, animasi, & utilitas tema
├── app.js                               # Router utama & state management
├── supabase-client.js                   # Lapisan data layer (Supabase Cloud + LocalStorage)
├── schema.sql                           # Master Schema 19 Tabel (Turnkey 1-File Setup)
├── supabase_migration_pekerjaan_rumah.sql # Migration patch modul PR
├── supabase_migration_kelompok.sql      # Migration patch modul Kelompok Belajar
├── supabase_migration_ledger.sql        # Migration patch modul Ledger Nilai & Finalisasi
├── supabase_migration_jadwal.sql        # Migration patch modul Jadwal Mengajar & Master Jam
├── manifest.json                        # Konfigurasi Web App Manifest (PWA)
├── sw.js                                # Service Worker offline cache
├── constants/
│   └── masterJam.js                     # Fallback 13 slot jam pelajaran (11 JP + 2 Istirahat)
├── components/
│   ├── AbsenView.js                     # Modul Presensi Harian Siswa & Saran Jadwal
│   ├── JurnalView.js                    # Modul Jurnal Pembelajaran Guru
│   ├── TugasView.js                     # Modul Catatan Ceklis & Penilaian Tugas Mandiri
│   ├── KelompokView.js                  # Modul Master Kelompok Belajar & Auto-Group
│   ├── TugasKelompokView.js             # Modul Penilaian Tugas Kelompok Kolaboratif
│   ├── PRBuatView.js                    # Modul Buat Penugasan PR (Tahap 1)
│   ├── PRPemeriksaanView.js             # Modul Pemeriksaan & Nilai PR (Tahap 2)
│   ├── PemeriksaanTugasView.js          # Modul Dashboard Evaluasi Tugas Multi-Sesi
│   ├── KegiatanView.js                  # Modul Catatan Kegiatan & Sikap Siswa
│   ├── LedgerNilaiView.js               # Modul Ledger Nilai Akhir & Simulator Katrol
│   ├── LedgerConfigModal.js             # Modal Konfigurasi Bobot, KKM & Predikat
│   ├── LedgerFinalisasiModal.js         # Modal Finalisasi & Snapshot Rapor Semester
│   ├── JadwalMengajarView.js            # Modul Jadwal Mengajar Guru & Cetak Jadwal
│   ├── JadwalModal.js                   # Modal Tambah/Edit Slot Jadwal Mengajar
│   ├── QuickFillNilai.js                # Toolbar Floating Pengisian Nilai Cepat
│   ├── RiwayatView.js                   # Modul Arsip Riwayat Sesi Mengajar
│   ├── RekapView.js                     # Modul Rekapitulasi Presensi Kelas & Ekspor
│   ├── RekapSiswaView.js                # Modul Rekap Individual Siswa & Rapor Portofolio
│   ├── AuthView.js                      # Halaman Login & Registrasi Akun Guru
│   ├── Sidebar.js                       # Sidebar Navigasi Collapsible
│   ├── Topbar.js                        # Header minimalis, breadcrumb, & filter tahun ajaran
│   ├── ClassCombobox.js                 # Combobox Interaktif Pemilihan Kelas
│   ├── MapelCombobox.js                 # Combobox Interaktif Pemilihan Mapel
│   ├── SiswaCombobox.js                 # Combobox Searchable Pemilihan Siswa
│   ├── KategoriKegiatanCombobox.js      # Combobox Custom Kategori Catatan & Sikap
│   ├── HariCombobox.js                  # Combobox Interaktif Pemilihan Hari
│   ├── JamPelajaranCombobox.js          # Combobox Interaktif Pemilihan Jam (Per-JP)
│   ├── KelompokBelajarCombobox.js       # Combobox Interaktif Pemilihan Kelompok
│   ├── AcademicYearCombobox.js          # Combobox Pemilihan Tahun Ajaran
│   ├── DatePicker.js                    # Kalender & Pemilih Tanggal
│   ├── SettingsModal.js                 # Modal Pengaturan Sistem & Master Jam JP
│   ├── SiswaModal.js                    # Modal Kelola Siswa & Impor Excel
│   ├── KenaikanKelasModal.js            # Modal Kenaikan Kelas & Promosi Rombel
│   └── ShareRekapKelasModal.js          # Modal Cetak / PDF Rekap Tugas Multi-Sesi
├── data/
│   ├── appInfo.js                       # Metadata aplikasi & kredit pengembang
│   └── initialData.js                   # Data template netral untuk instalasi baru
└── icons/                               # Aset ikon PWA
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
   *(Seluruh 19 tabel, Stored Procedure Kenaikan Kelas, Auto-Group, Index, dan RLS langsung terpasang otomatis).*
4. Buka menu **Project Settings > API** di Supabase untuk menyalin:
   * **Project URL** (`https://xxx.supabase.co`)
   * **Project API Key (anon/public)** (`eyJhbG...`)
5. Buka aplikasi di browser $\rightarrow$ Masuk ke menu **Pengaturan Sistem > Database** $\rightarrow$ Masukkan URL & Anon Key $\rightarrow$ Klik **Simpan & Hubungkan**.
6. Status di header akan otomatis berubah menjadi 🟢 **Supabase Terhubung**.

---

## 👨‍💻 Kredit Pengembang & Lisensi

* **Nama Aplikasi**: SIA & Jurnal Guru Mapel
* **Pengembang**: Ammar
* **Asal**: Bantaeng, Sulawesi Selatan
* **Hak Cipta**: © 2026 Ammar. All rights reserved.
