# 📖 Dokumentasi Lengkap Fitur Aplikasi
### **Sistem Informasi Absensi, Jurnal Mengajar & Penilaian Guru Mata Pelajaran**

Dokumen ini berisi daftar lengkap seluruh fitur dan fungsionalitas yang tersedia di dalam aplikasi dari sudut pandang pengguna. Dokumen ini dapat dijadikan panduan operasional harian, referensi fitur, maupun pedoman pengenalan aplikasi kepada pengguna baru.

---

## 📑 Daftar Isi
1. [Fitur Global & Lintas Halaman](#1-fitur-global--lintas-halaman)
2. [Menu Utama (Presensi & Pembelajaran Harian)](#2-menu-utama-presensi--pembelajaran-harian)
   - [2.1 Absen Siswa](#21-absen-siswa)
   - [2.2 Jurnal Mengajar](#22-jurnal-mengajar)
   - [2.3 Catatan & Tugas Siswa](#23-catatan--tugas-siswa)
   - [2.4 Pemeriksaan Catatan & Tugas](#24-pemeriksaan-catatan--tugas)
   - [2.5 Pekerjaan Rumah (PR) 2-Tahap](#25-pekerjaan-rumah-pr-2-tahap)
   - [2.6 Kegiatan Siswa](#26-kegiatan-siswa)
   - [2.7 Riwayat Sesi Mengajar](#27-riwayat-sesi-mengajar)
   - [2.8 Rekap Kehadiran (Rekap Kelas)](#28-rekap-kehadiran-rekap-kelas)
   - [2.9 Rekap Per Siswa (Portofolio Individual)](#29-rekap-per-siswa-portofolio-individual)
3. [Kelola Data & Akademik](#3-kelola-data--akademik)
   - [3.1 Data Kelas & Siswa](#31-data-kelas--siswa)
   - [3.2 Kenaikan Kelas & Pemindahan Rombel](#32-kenaikan-kelas--pemindahan-rombel)
4. [Pengaturan Sistem & Master Data](#4-pengaturan-sistem--master-data)
   - [4.1 Master Mata Pelajaran (Mapel)](#41-master-mata-pelajaran-mapel)
   - [4.2 Data Sekolah](#42-data-sekolah)
   - [4.3 Profil Guru, NIP & Kepala Sekolah](#43-profil-guru-nip--kepala-sekolah)
   - [4.4 Database Cloud & Instalasi Otomatis](#44-database-cloud--instalasi-otomatis)
   - [4.5 Cadangan Data, Restore & Reset](#45-cadangan-data-restore--reset)

---

## 1. Fitur Global & Lintas Halaman

Fitur-fitur ini bekerja secara menyeluruh dan memengaruhi pengalaman penggunaan di semua halaman aplikasi:

* **Filter Tahun Ajaran Global (Bilah Navigasi Atas)**:
  * Memungkinkan guru berpindah tahun ajaran aktif kapan saja melalui dropdown di pojok kanan atas.
  * Setiap data absensi, nilai, jurnal, dan daftar kelas terisolasi rapi berdasarkan tahun ajaran yang dipilih, sehingga rekaman masa lalu tidak tercampur dengan data aktif saat ini.
* **Autentikasi & Keamanan Akses**:
  * Form Login dengan proteksi email & password terhubung langsung ke layanan Cloud Supabase.
  * Sesi login tersimpan otomatis di peramban sehingga guru tidak perlu mengetikkan ulang kata sandi setiap kali membuka aplikasi.
* **Sistem Notifikasi & Indikator Status**:
  * Notifikasi toast interaktif (Sukses, Peringatan, Info, Gagal) muncul secara otomatis di setiap aksi simpan, edit, atau hapus.
  * Indikator status koneksi database (Online/Offline) dan sinkronisasi data *real-time*.
* **Standardisasi Cetak Dokumen & Ekspor PDF**:
  * Kop Surat Resmi Standar Sekolah otomatis disematkan pada seluruh dokumen cetak dan PDF (Rekap Presensi, Jurnal, Rapor Portofolio Siswa, Lembar Rekap Nilai & Catatan).
  * Format tanda tangan resmi otomatis menyertakan nama dan NIP Kepala Sekolah serta Guru Pengampu.
* **Format Dropdown Modern (Combobox Shadcn-Style)**:
  * Dropdown Kelas dan Mata Pelajaran dilengkapi dengan pencarian cepat (*search box*), tag warna jurusan, dan indikator visual seragam.

---

## 2. Menu Utama (Presensi & Pembelajaran Harian)

### 2.1 Absen Siswa
* **Fungsi Utama**: Mencatat kehadiran harian siswa pada pertemuan mengajar tertentu secara cepat dan akurat.
* **Sub-Fitur & Aksi**:
  * **Pemilihan Sesi**: Memilih tanggal pertemuan (dilengkapi kalender interaktif), kelas rombel, jam ke-, dan mata pelajaran.
  * **Opsi Presensi Satuan**: Status Hadir (H), Sakit (S), Izin (I), dan Alfa (A) dengan tombol radio warna yang mudah dibedakan.
  * **Tombol Cepat "Set Semua Hadir"**: Mengubah status seluruh siswa menjadi Hadir dalam satu klik untuk mempercepat pengisian presensi.
  * **Statistik Langsung**: Ringkasan jumlah siswa Hadir, Sakit, Izin, dan Alfa terhitung otomatis secara *live* saat presensi diisi.
  * **Catatan Khusus**: Kolom catatan tambahan per siswa untuk kendala kehadiran (misal: terlambat, tugas dinas, dispensasi).
  * **Simpan & Update**: Menyimpan sesi baru atau memperbarui sesi presensi yang sedang diedit.
* **Ketergantungan Data**: Bersumber dari data **Kelas & Siswa** serta **Master Mata Pelajaran**.

---

### 2.2 Jurnal Mengajar
* **Fungsi Utama**: Mendokumentasikan materi pembelajaran, capaian kompetensi, dan kegiatan belajar-mengajar pada setiap pertemuan.
* **Sub-Fitur & Aksi**:
  * **Formulir Jurnal Sesi**: Pengisian tanggal pertemuan, kelas, mata pelajaran, jam mengajar, pertemuan ke-, dan semester.
  * **Detail Pembelajaran**: Pengisian Materi Pokok / Topik Bahasan, Indikator / Kompetensi Dasar, Catatan Kejadian di Kelas, dan Kendala Pembelajaran.
  * **Integrasi Otomatis dengan Presensi**: Ringkasan persentase kehadiran siswa pada sesi tersebut langsung tertaut ke catatan jurnal.
  * **Cetak Lembar Jurnal**: Ekspor/cetak lembar jurnal mengajar resmi lengkap dengan kop sekolah dan tanda tangan guru/kepala sekolah.
* **Ketergantungan Data**: Terhubung dengan data **Absen Siswa**, **Profil Guru**, dan **Data Sekolah**.

---

### 2.3 Catatan & Tugas Siswa
* **Fungsi Utama**: Mengelola pemeriksaan kelengkapan catatan materi serta penilaian nilai tugas harian siswa.
* **Varian / Mode**:
  1. **Mode 1: Catatan Ceklis Siswa**:
     * **Fungsi**: Memeriksa kelengkapan buku catatan/rangkuman siswa pada suatu materi bahasan.
     * **Fitur Ceklis Massal**: Tombol *Centang Semua* atau centang per siswa.
     * **Varian Khusus "Bebas Catatan"**: Opsi menandai sesi tertentu di mana siswa dibebaskan dari kewajiban mencatat materi (otomatis berstatus tuntas 100%).
     * **Catatan Tambahan**: Catatan kekurangan catatan per individu siswa.
     * **Riwayat Sesi Ceklis**: Tabel ringkas sesi catatan tersimpan dengan status ketuntasan (persen, indikator warna hijau/kuning, tombol edit & hapus).
     * **Cetak Lembar Ceklis**: Mencetak lembar kendali catatan kosong atau terisi untuk arsip fisik.
  2. **Mode 2: Penilaian Nilai Tugas**:
     * **Fungsi**: Menginput dan merekap nilai angka hasil pengerjaan tugas atau latihan soal siswa.
     * **Pengaturan KKM**: Menentukan standar Kriteria Ketuntasan Minimal (KKM) untuk tugas tersebut (default: 75).
     * **Varian Khusus "Bebas Tugas"**: Opsi menandai sesi di mana tidak ada tagihan tugas (otomatis tuntas 100% tanpa beban nilai).
     * **Perhitungan Otomatis**: Rata-rata nilai kelas, status Tuntas / Remedial per siswa, dan jumlah siswa yang belum dinilai terhitung secara otomatis.
     * **Riwayat Sesi Nilai Tugas**: Tabel ringkas seluruh tugas tersimpan lengkap dengan rata-rata nilai kelas, tombol edit, dan tombol hapus.
     * **Cetak Daftar Nilai**: Mencetak format daftar nilai tugas resmi lengkap dengan tanda tangan.
* **Ketergantungan Data**: Bersumber dari data **Kelas & Siswa**, **Master Mapel**, **Profil Guru**, dan **Data Sekolah**.

---

### 2.4 Pemeriksaan Catatan & Tugas
* **Fungsi Utama**: Dashboard monitoring dan rekapitulasi multi-sesi untuk memantau ketuntasan catatan dan tugas seluruh kelas dalam satu tampilan terpadu.
* **Sub-Fitur & Aksi**:
  * **Penyaringan Lanjutan (Filter Multi-Parameter)**:
    * Filter Kelas.
    * Filter Mata Pelajaran (Semua Mapel atau Mapel Spesifik).
    * Filter Jenis Sesi (Semua Sesi, Hanya Ceklis Catatan, atau Hanya Nilai Tugas).
    * Filter Status Ketuntasan (Semua Status, Hanya yang Sudah Tuntas 100%, atau Hanya yang Belum Tuntas / Ada Tunggakan).
    * Filter Rentang Tanggal (Tanggal Awal s/d Tanggal Akhir).
  * **Kartu Statistik Ringkasan**:
    * Total Sesi Tersimpan.
    * Rata-rata Ketuntasan Kelas (%).
    * Jumlah Sesi Bebas Tugas / Bebas Catatan.
    * Jumlah Siswa yang Masih Memiliki Tunggakan Tugas/Catatan.
  * **Daftar Sesi Ringkas & Interaktif**: Tabel daftar sesi dengan indikator visual garis tepi (Hijau = Tuntas, Kuning = Belum Tuntas, Biru/Teal = Bebas Tugas/Catatan) dan *progress bar* ketuntasan.
  * **Modal "Bagikan Rekap Kelas (Multi-Sesi)"**:
    * Menampilkan rekapitulasi matriks nama siswa vs seluruh sesi tugas/catatan dalam satu lembar tabel besar.
    * Ekspor langsung ke format **PDF Resmi (Lanskap)** atau **Cetak Langsung ke Printer**.
    * Dilengkapi statistik rekap: % Tuntas Catatan, Rata-rata Nilai Tugas, dan status kelayakan akhir.
* **Ketergantungan Data**: Mengagregasi data dari **Catatan Ceklis**, **Penilaian Nilai Tugas**, **Profil Guru**, dan **Data Sekolah**.

---

### 2.5 Pekerjaan Rumah (PR) 2-Tahap
* **Fungsi Utama**: Manajemen siklus pekerjaan rumah yang memisahkan tahap pemberian tugas dengan tahap pemeriksaan di pekan berikutnya.
* **Sub-Fitur & Aksi**:
  * **Tahap 1 (Buat PR)**:
    * Memilih Kelas, Mapel, Tanggal Diberikan, dan Topik / Instruksi Soal PR.
    * Preview jumlah siswa aktif secara langsung.
    * Status awal otomatis tersimpan sebagai **`Menunggu Diperiksa`** tanpa batas kedaluwarsa.
  * **Tahap 2 (Pemeriksaan & Input Nilai PR)**:
    * Dashboard PR dengan tab status (*Menunggu Diperiksa*, *Selesai Diperiksa*, *Semua*) serta filter kelas dan mapel.
    * Form input nilai siswa dengan toggle checkbox **"Tidak Mengumpulkan"** (otomatis mendisable dan mengosongkan nilai).
    * Toolbar nilai cepat (80, 85, 90, 100) dan kolom catatan guru per siswa.
    * Cetak Lembar Rekap Nilai PR.
  * **Sidebar Realtime Badge**: Menampilkan jumlah total PR yang berstatus menunggu secara live di grup menu navigasi.
  * **Snapshot Tahun Ajaran**: Nilai `academic_year` dicatat permanen saat PR dibuat sehingga histori nilai tidak berubah saat kenaikan kelas.
* **Ketergantungan Data**: Menggunakan data **Kelas**, **Mata Pelajaran**, **Siswa**, **pr_tugas**, dan **pr_nilai_siswa**.

---

### 2.6 Kegiatan Siswa
* **Fungsi Utama**: Mencatat kejadian khusus, pelanggaran tata tertib, bimbingan konseling ringan, maupun prestasi yang diraih siswa selama proses belajar.
* **Sub-Fitur & Aksi**:
  * **Form Pencatatan Cepat**: Memilih tanggal, kelas, siswa terkait, jenis kegiatan (Positif / Prestasi vs Catatan / Pelanggaran), dan deskripsi kejadian.
  * **Tindak Lanjut**: Kolom untuk mencatat tindak lanjut atau solusi yang telah diberikan oleh guru.
  * **Filter & Pencarian**: Memfilter catatan kegiatan berdasarkan kelas, rentang waktu, atau kata kunci nama siswa.
  * **Manajemen Catatan**: Kemampuan mengedit atau menghapus catatan kejadian yang sudah diselesaikan.
* **Ketergantungan Data**: Bersumber dari data **Kelas & Siswa**.

---

### 2.7 Riwayat Sesi Mengajar
* **Fungsi Utama**: Arsip kronologis seluruh sesi pertemuan mengajar yang pernah dilakukan guru (mencakup presensi dan materi jurnal).
* **Sub-Fitur & Aksi**:
  * **Tampilan Tabel Ringkas**: Menampilkan tanggal pertemuan, kelas, mata pelajaran, materi jurnal, ringkasan kehadiran (Hadir, Sakit, Izin, Alfa), dan jumlah total siswa.
  * **Filter Cepat**: Filter berdasarkan Kelas dan Mata Pelajaran tertentu.
  * **Aksi per Sesi**:
    * **Buka / Edit Absensi**: Memuat kembali data presensi sesi tersebut ke form Absen Siswa untuk dilakukan koreksi.
    * **Lihat Jurnal**: Membuka popup rincian jurnal mengajar yang tersimpan pada sesi tersebut.
    * **Hapus Sesi**: Menghapus data sesi mengajar beserta rekaman presensinya secara permanen.
* **Ketergantungan Data**: Bersumber dari data **Absen Siswa** dan **Jurnal Mengajar**.

---

### 2.7 Rekap Kehadiran (Rekap Kelas)
* **Fungsi Utama**: Menghitung dan menyajikan rekapitulasi kumulatif absensi seluruh siswa dalam satu kelas pada periode waktu tertentu.
* **Sub-Fitur & Aksi**:
  * **Filter Fleksibel**: Memilih kelas, rentang tanggal (misal: 1 bulan, 1 semester, atau tahunan), dan mata pelajaran.
  * **Tabel Rekapitulasi Otomatis**:
    * Total akumulasi Hadir (H), Sakit (S), Izin (I), dan Alfa (A) per siswa.
    * Persentase Kehadiran Total (%) yang dihitung secara otomatis.
  * **Ekspor Excel (.xlsx / .csv)**: Mengunduh data rekapitulasi kehadiran ke spreadsheet Excel untuk kebutuhan pelaporan dinas atau wali kelas.
  * **Cetak Rekap Resmi**: Mencetak dokumen rekapitulasi kehadiran kelas dengan kop surat resmi dan tanda tangan.
* **Ketergantungan Data**: Mengagregasi data dari seluruh sesi **Absen Siswa**, **Profil Guru**, dan **Data Sekolah**.

---

### 2.8 Rekap Per Siswa (Portofolio Individual)
* **Fungsi Utama**: Melihat profil akademik, riwayat presensi, catatan ketuntasan, dan capaian nilai untuk satu siswa tertentu secara mendalam.
* **Sub-Fitur & Aksi**:
  * **Pemilih Siswa Cepat**: Memilih kelas dan nama siswa dari dropdown interaktif.
  * **Kartu Ringkasan Siswa**: Menampilkan persentase kehadiran kumulatif, rata-rata nilai tugas, total catatan terselesaikan, dan catatan kegiatan/perilaku.
  * **Tabel Riwayat Rinci**: Menampilkan daftar seluruh pertemuan yang pernah diikuti siswa, rincian status hadir, judul materi catatan, dan skor nilai tugas per pertemuan.
  * **Cetak Rapor Portofolio Siswa**: Mencetak laporan capaian individual siswa (format kartu portofolio/rapor siswa) untuk diserahkan kepada orang tua/wali murid atau guru BK.
* **Ketergantungan Data**: Menggabungkan data dari **Absensi**, **Catatan Ceklis**, **Nilai Tugas**, **Kegiatan Siswa**, **Profil Guru**, dan **Data Sekolah**.

---

## 3. Kelola Data & Akademik

### 3.1 Data Kelas & Siswa
* **Fungsi Utama**: Manajemen data master rombongan belajar (kelas) dan basis data siswa aktif pada tahun ajaran yang sedang berjalan.
* **Sub-Fitur & Aksi**:
  * **Manajemen Kelas (Rombel)**:
    * Tambah rombel kelas baru (Nama Kelas, Tingkat [X/XI/XII], Jurusan/Konsentrasi Keahlian, Tahun Ajaran).
    * Edit informasi kelas dan status keaktifan kelas.
    * Hapus kelas (dilengkapi validasi pengamanan data).
  * **Manajemen Siswa**:
    * Tambah siswa manual (Nama Lengkap, NISN/NIS, Nomor Absen, Jenis Kelamin, Nomor Telepon/WhatsApp Orang Tua).
    * Edit data identitas siswa.
    * Pindah rombel kelas siswa secara perorangan.
    * Hapus data siswa.
  * **Import Siswa Massal (Excel / CSV)**:
    * Fitur unggah file Excel/CSV untuk memasukkan puluhan hingga ratusan siswa sekaligus ke suatu kelas dalam hitungan detik.
    * Fitur unduh *Template Excel Standar* untuk memastikan susunan kolom data sesuai sebelum diimpor.
  * **Ekspor Data Siswa**: Mengunduh daftar siswa per kelas ke file spreadsheet Excel.
* **Ketergantungan Data**: Merupakan fondasi master data utama untuk seluruh fitur presensi dan penilaian.

---

### 3.2 Kenaikan Kelas & Pemindahan Rombel
* **Fungsi Utama**: Memproses transisi kenaikan kelas siswa secara massal dari tahun ajaran lama ke tahun ajaran baru secara atomik dan aman tanpa merusak data masa lalu.
* **Alur 2 Langkah (Wizard Interaktif)**:
  1. **Langkah 1: Pemetaan Rombel (Mapping)**:
     * Memilih *Tahun Ajaran Asal* dan *Tahun Ajaran Tujuan*.
     * **Prediksi Cerdas Otomatis**: Aplikasi secara otomatis menebak kelas tujuan (misal: `X TJKT 1` otomatis dipetakan ke `XI TJKT 1`, dan `XII TJKT 1` otomatis dipetakan ke *Lulus*).
     * **Varian Aksi Per Kelas (Dropdown Menjadi:)**:
       * *Naik Kelas Otomatis*: Memindahkan seluruh rombel ke tingkat kelas berikutnya.
       * *Nama Kelas Kustom...*: Menentukan nama rombel baru secara bebas (misal: restrukturisasi rombel).
       * *Lulus / Selesai (Non-Aktif)*: Menandai seluruh siswa di kelas tingkat akhir sebagai alumni/lulusan.
       * *Lewati (Jangan Dipindahkan)*: Membiarkan kelas tetap berada di tahun ajaran lama.
     * **Rincian Siswa & Override Khusus**: Fitur akordeon untuk mengatur kasus khusus siswa perorangan (misal: siswa yang Tinggal Kelas tetap di tingkat lama, atau siswa tertentu yang dinyatakan Lulus mendahului).
  2. **Langkah 2: Preview & Eksekusi**:
     * Menampilkan tabel ringkasan pra-eksekusi: Jumlah siswa naik kelas, siswa lulus, siswa tinggal kelas, dan rombel baru yang akan dibuat otomatis.
     * Validasi konfirmasi ganda untuk mencegah eksekusi yang tidak disengaja.
     * **Eksekusi Atomik Database (RPC)**: Memproses ratusan perpindahan siswa dan pembuatan kelas baru dalam satu transaksi data aman.
* **Ketergantungan Data**: Mengelola relasi data antara **Kelas**, **Siswa**, dan **Tahun Ajaran**.

---

## 4. Pengaturan Sistem & Master Data

Dapat diakses melalui tombol ikon gerigi di bilah navigasi atas (Modal Pengaturan Sistem 5 Tab):

### 4.1 Master Mata Pelajaran (Mapel)
* **Fungsi Utama**: Mengelola daftar mata pelajaran yang diampu oleh guru di sekolah.
* **Sub-Fitur**:
  * Menambah mata pelajaran baru (Nama Mapel, Kode Mapel, Kelompok Mapel [Umum / Kejuruan]).
  * Mengedit nama dan kode mapel.
  * Menghapus mata pelajaran yang sudah tidak diajarkan.
  * Fitur *Quick Edit Mapel* yang dapat diakses langsung dari formulir presensi.

---

### 4.2 Data Sekolah
* **Fungsi Utama**: Menyimpan identitas resmi sekolah yang akan menjadi kepala surat (Kop Dokumen) pada seluruh laporan cetak dan PDF.
* **Informasi yang Dikelola**:
  * Nama Pemerintah / Instansi Induk (Contoh: *Pemerintah Provinsi Sulawesi Selatan*).
  * Nama Dinas Terkait (Contoh: *Dinas Pendidikan*).
  * Nama Sekolah (Contoh: *SMKN 1 Bantaeng*).
  * Alamat Lengkap Sekolah, Nomor Telepon, Alamat Email, Website Resmi, dan NPSN.
* **Dampak**: Data ini otomatis merender Kop Laporan yang rapi, simetris, dan baku di semua laporan.

---

### 4.3 Profil Guru, NIP & Kepala Sekolah
* **Fungsi Utama**: Menyimpan data identitas guru pengampu dan Kepala Sekolah untuk legalitas tanda tangan dokumen resmi.
* **Informasi yang Dikelola**:
  * Nama Lengkap Guru Pengampu & Gelar.
  * NIP Guru Pengampu.
  * Nama Lengkap Kepala Sekolah & Gelar.
  * NIP Kepala Sekolah.
  * Kota / Kabupaten Domisili dan Tanggal Penandatanganan Dokumen.
* **Dampak**: Otomatis tercantum pada bagian tanda tangan (*titimangsa*) di bawah setiap lembar laporan presensi, jurnal, rekap nilai, dan portofolio siswa.

---

### 4.4 Database Cloud & Instalasi Otomatis
* **Fungsi Utama**: Mengatur parameter koneksi ke Supabase dan menyediakan sarana instalasi database mandiri untuk pengguna baru.
* **Sub-Fitur**:
  * **Konfigurasi URL & Anon Key**: Menghubungkan aplikasi ke project Supabase milik pengguna secara dinamis.
  * **Inspeksi Kesehatan Database (Health Check)**: Memeriksa ketersediaan dan status 11 tabel sistem secara *live*.
  * **Fitur 1-Klik Salin Master Skema SQL**: Menyalin seluruh struktur skema tabel, fungsi RPC, dan aturan RLS ke clipboard untuk dieksekusi di Supabase SQL Editor.
  * **Unduh Master `schema.sql`**: Mengunduh berkas skema database lengkap untuk arsip lokal.
  * **Isi Data Awal (Seed Initial Data)**: Mengisi database kosong dengan data contoh awal (kelas, mapel, siswa sampel) agar aplikasi dapat langsung diuji coba.

---

### 4.5 Cadangan Data, Restore & Reset
* **Fungsi Utama**: Menjaga keamanan data guru dari risiko kehilangan melalui mekanisme *backup* dan *restore* berbasis file lokal JSON.
* **Sub-Fitur**:
  * **Unduh Cadangan JSON (Backup)**: Mengunduh seluruh data aplikasi (kelas, siswa, presensi, jurnal, nilai, kegiatan, pengaturan) ke dalam satu berkas `.json` cadangan.
  * **Pulihkan Data (Restore JSON)**: Mengunggah kembali berkas `.json` cadangan untuk mengembalikan kondisi data ke waktu sebelumnya.
  * **Reset Data Sistem**: Mengosongkan data sesi atau mengembalikan aplikasi ke pengaturan bawaan (dilengkapi peringatan keamanan ketat).

---

## 5. Ringkasan Matriks Dukungan Ekspor & Impor

| Modul / Fitur | Ekspor PDF / Cetak | Ekspor Excel (.xlsx / .csv) | Impor Excel / CSV |
|---|:---:|:---:|:---:|
| **Absen Siswa (Lembar Pertemuan)** | ✅ | — | — |
| **Jurnal Mengajar** | ✅ | — | — |
| **Catatan Ceklis Siswa** | ✅ | — | — |
| **Penilaian Nilai Tugas** | ✅ | — | — |
| **Pemeriksaan Catatan (Multi-Sesi)** | ✅ (Lanskap) | — | — |
| **Rekap Kehadiran Kelas** | ✅ | ✅ | — |
| **Rekap Portofolio Per Siswa** | ✅ | — | — |
| **Data Siswa (Per Kelas)** | — | ✅ | ✅ (Massal) |
| **Seluruh Database Sistem** | — | — | ✅ (Cadangan JSON) |

---
*Dokumentasi ini disusun sebagai acuan fungsional resmi Sistem Informasi Absensi, Jurnal Mengajar & Penilaian Guru Mapel.*
