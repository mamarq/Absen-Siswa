// data/initialData.js - Data Default Awal Aplikasi Absen Siswa
import { DEFAULT_MASTER_JAM } from '../constants/masterJam.js';

export { DEFAULT_MASTER_JAM };

export const INITIAL_DATA = {
  kelas: [
    {
      id: 'k-tjkt-1',
      nama_kelas: 'X TJKT 1',
      tingkat: 'X',
      jurusan: 'Teknik Jaringan Komputer dan Telekomunikasi',
      academic_year: '2026/2027',
      is_active: true
    },
    {
      id: 'k-tjkt-2',
      nama_kelas: 'X TJKT 2',
      tingkat: 'X',
      jurusan: 'Teknik Jaringan Komputer dan Telekomunikasi',
      academic_year: '2026/2027',
      is_active: true
    },
    {
      id: 'k-dkv-1',
      nama_kelas: 'X DKV 1',
      tingkat: 'X',
      jurusan: 'Desain Komunikasi Visual',
      academic_year: '2026/2027',
      is_active: true
    },
    {
      id: 'k-mplb-1',
      nama_kelas: 'X MPLB 1',
      tingkat: 'X',
      jurusan: 'Manajemen Perkantoran dan Layanan Bisnis',
      academic_year: '2026/2027',
      is_active: true
    },
    {
      id: 'k-akl-1',
      nama_kelas: 'X AKL 1',
      tingkat: 'X',
      jurusan: 'Akuntansi dan Keuangan Lembaga',
      academic_year: '2026/2027',
      is_active: true
    }
  ],

  mataPelajaran: [
    { id: 'mp-1', nama_mapel: 'Matematika', kode: 'MTK', kategori: 'UMUM' },
    { id: 'mp-2', nama_mapel: 'Informatika', kode: 'INF', kategori: 'UMUM' },
    { id: 'mp-3', nama_mapel: 'Dasar-dasar Kejuruan TJKT', kode: 'D-TJKT', kategori: 'PILIHAN' },
    { id: 'mp-4', nama_mapel: 'Jaringan Komputer Dasar', kode: 'JKD', kategori: 'PILIHAN' },
    { id: 'mp-5', nama_mapel: 'Projek Kreatif dan Kewirausahaan', kode: 'PKK', kategori: 'PILIHAN' }
  ],

  mapelList: [
    'Matematika',
    'Informatika',
    'Dasar-dasar Kejuruan TJKT',
    'Jaringan Komputer Dasar',
    'Projek Kreatif dan Kewirausahaan'
  ],

  jamPelajaranMaster: [...DEFAULT_MASTER_JAM],

  siswa: [
    // X TJKT 1
    { id: 's-101', kelas_id: 'k-tjkt-1', nomor_absen: 1, nama_lengkap: 'Achmad Fauzan Syaputra', jenis_kelamin: 'L', nisn: '0081234501' },
    { id: 's-102', kelas_id: 'k-tjkt-1', nomor_absen: 2, nama_lengkap: 'Aditya Pratama Putra', jenis_kelamin: 'L', nisn: '0081234502' },
    { id: 's-103', kelas_id: 'k-tjkt-1', nomor_absen: 3, nama_lengkap: 'Ainun Mardhiah', jenis_kelamin: 'P', nisn: '0081234503' },
    { id: 's-104', kelas_id: 'k-tjkt-1', nomor_absen: 4, nama_lengkap: 'Andi Muhammad Rifky', jenis_kelamin: 'L', nisn: '0081234504' },
    { id: 's-105', kelas_id: 'k-tjkt-1', nomor_absen: 5, nama_lengkap: 'Anisa Rahmawati', jenis_kelamin: 'P', nisn: '0081234505' },
    { id: 's-106', kelas_id: 'k-tjkt-1', nomor_absen: 6, nama_lengkap: 'Arya Bima Sena', jenis_kelamin: 'L', nisn: '0081234506' },
    { id: 's-107', kelas_id: 'k-tjkt-1', nomor_absen: 7, nama_lengkap: 'Azka Nurfadilah', jenis_kelamin: 'P', nisn: '0081234507' },
    { id: 's-108', kelas_id: 'k-tjkt-1', nomor_absen: 8, nama_lengkap: 'Dimas Bagus Setiawan', jenis_kelamin: 'L', nisn: '0081234508' },
    { id: 's-109', kelas_id: 'k-tjkt-1', nomor_absen: 9, nama_lengkap: 'Dwi Nur Haliza', jenis_kelamin: 'P', nisn: '0081234509' },
    { id: 's-110', kelas_id: 'k-tjkt-1', nomor_absen: 10, nama_lengkap: 'Fadly Rahman', jenis_kelamin: 'L', nisn: '0081234510' },
    { id: 's-111', kelas_id: 'k-tjkt-1', nomor_absen: 11, nama_lengkap: 'Fitri Handayani', jenis_kelamin: 'P', nisn: '0081234511' },
    { id: 's-112', kelas_id: 'k-tjkt-1', nomor_absen: 12, nama_lengkap: 'Haikal Maulana', jenis_kelamin: 'L', nisn: '0081234512' },
    { id: 's-113', kelas_id: 'k-tjkt-1', nomor_absen: 13, nama_lengkap: 'Indah Permatasari', jenis_kelamin: 'P', nisn: '0081234513' },
    { id: 's-114', kelas_id: 'k-tjkt-1', nomor_absen: 14, nama_lengkap: 'Irfan Syamsuddin', jenis_kelamin: 'L', nisn: '0081234514' },
    { id: 's-115', kelas_id: 'k-tjkt-1', nomor_absen: 15, nama_lengkap: 'M. Alif Nur Ramadhan', jenis_kelamin: 'L', nisn: '0081234515' },
    { id: 's-116', kelas_id: 'k-tjkt-1', nomor_absen: 16, nama_lengkap: 'Muh. Dzaky Fathurrahman', jenis_kelamin: 'L', nisn: '0081234516' },
    { id: 's-117', kelas_id: 'k-tjkt-1', nomor_absen: 17, nama_lengkap: 'Nabila Salsabila', jenis_kelamin: 'P', nisn: '0081234517' },
    { id: 's-118', kelas_id: 'k-tjkt-1', nomor_absen: 18, nama_lengkap: 'Nurul Aisyah Putri', jenis_kelamin: 'P', nisn: '0081234518' },
    { id: 's-119', kelas_id: 'k-tjkt-1', nomor_absen: 19, nama_lengkap: 'Rahmat Hidayat', jenis_kelamin: 'L', nisn: '0081234519' },
    { id: 's-120', kelas_id: 'k-tjkt-1', nomor_absen: 20, nama_lengkap: 'Rani Maharani', jenis_kelamin: 'P', nisn: '0081234520' },
    { id: 's-121', kelas_id: 'k-tjkt-1', nomor_absen: 21, nama_lengkap: 'Rian Anggara', jenis_kelamin: 'L', nisn: '0081234521' },
    { id: 's-122', kelas_id: 'k-tjkt-1', nomor_absen: 22, nama_lengkap: 'Siti Nurhaliza', jenis_kelamin: 'P', nisn: '0081234522' },
    { id: 's-123', kelas_id: 'k-tjkt-1', nomor_absen: 23, nama_lengkap: 'Sultan Maulana', jenis_kelamin: 'L', nisn: '0081234523' },
    { id: 's-124', kelas_id: 'k-tjkt-1', nomor_absen: 24, nama_lengkap: 'Syahrul Ramadhan', jenis_kelamin: 'L', nisn: '0081234524' },
    { id: 's-125', kelas_id: 'k-tjkt-1', nomor_absen: 25, nama_lengkap: 'Taufiqurrahman', jenis_kelamin: 'L', nisn: '0081234525' },
    { id: 's-126', kelas_id: 'k-tjkt-1', nomor_absen: 26, nama_lengkap: 'Wahyu Triyadi', jenis_kelamin: 'L', nisn: '0081234526' },
    { id: 's-127', kelas_id: 'k-tjkt-1', nomor_absen: 27, nama_lengkap: 'Yuliana Safitri', jenis_kelamin: 'P', nisn: '0081234527' },
    { id: 's-128', kelas_id: 'k-tjkt-1', nomor_absen: 28, nama_lengkap: 'Zahra Amelia', jenis_kelamin: 'P', nisn: '0081234528' },
    { id: 's-129', kelas_id: 'k-tjkt-1', nomor_absen: 29, nama_lengkap: 'Zikri Maulana', jenis_kelamin: 'L', nisn: '0081234529' },
    { id: 's-130', kelas_id: 'k-tjkt-1', nomor_absen: 30, nama_lengkap: 'Zulfikar Ali', jenis_kelamin: 'L', nisn: '0081234530' },

    // X TJKT 2
    { id: 's-201', kelas_id: 'k-tjkt-2', nomor_absen: 1, nama_lengkap: 'Abdurrahman Wahid', jenis_kelamin: 'L', nisn: '0082234501' },
    { id: 's-202', kelas_id: 'k-tjkt-2', nomor_absen: 2, nama_lengkap: 'Ade Irma Suryani', jenis_kelamin: 'P', nisn: '0082234502' },
    { id: 's-203', kelas_id: 'k-tjkt-2', nomor_absen: 3, nama_lengkap: 'Agus Setiawan', jenis_kelamin: 'L', nisn: '0082234503' },
    { id: 's-204', kelas_id: 'k-tjkt-2', nomor_absen: 4, nama_lengkap: 'Andi Batari Toja', jenis_kelamin: 'P', nisn: '0082234504' },
    { id: 's-205', kelas_id: 'k-tjkt-2', nomor_absen: 5, nama_lengkap: 'Bayu Segara', jenis_kelamin: 'L', nisn: '0082234505' },
    { id: 's-206', kelas_id: 'k-tjkt-2', nomor_absen: 6, nama_lengkap: 'Citra Kirana', jenis_kelamin: 'P', nisn: '0082234506' },
    { id: 's-207', kelas_id: 'k-tjkt-2', nomor_absen: 7, nama_lengkap: 'Dandi Mahardika', jenis_kelamin: 'L', nisn: '0082234507' },
    { id: 's-208', kelas_id: 'k-tjkt-2', nomor_absen: 8, nama_lengkap: 'Eka Wahyuni', jenis_kelamin: 'P', nisn: '0082234508' },
    { id: 's-209', kelas_id: 'k-tjkt-2', nomor_absen: 9, nama_lengkap: 'Faturrahman', jenis_kelamin: 'L', nisn: '0082234509' },
    { id: 's-210', kelas_id: 'k-tjkt-2', nomor_absen: 10, nama_lengkap: 'Gita Gutawa', jenis_kelamin: 'P', nisn: '0082234510' },

    // X DKV 1
    { id: 's-301', kelas_id: 'k-dkv-1', nomor_absen: 1, nama_lengkap: 'Alifia Zahra', jenis_kelamin: 'P', nisn: '0083234501' },
    { id: 's-302', kelas_id: 'k-dkv-1', nomor_absen: 2, nama_lengkap: 'Bagas Aditya Nugraha', jenis_kelamin: 'L', nisn: '0083234502' },
    { id: 's-303', kelas_id: 'k-dkv-1', nomor_absen: 3, nama_lengkap: 'Cantika Dewi', jenis_kelamin: 'P', nisn: '0083234503' },
    { id: 's-304', kelas_id: 'k-dkv-1', nomor_absen: 4, nama_lengkap: 'Deva Anandita', jenis_kelamin: 'L', nisn: '0083234504' },
    { id: 's-305', kelas_id: 'k-dkv-1', nomor_absen: 5, nama_lengkap: 'Farah Quinn', jenis_kelamin: 'P', nisn: '0083234505' },

    // X MPLB 1
    { id: 's-401', kelas_id: 'k-mplb-1', nomor_absen: 1, nama_lengkap: 'Annisa Putri Utami', jenis_kelamin: 'P', nisn: '0084234501' },
    { id: 's-402', kelas_id: 'k-mplb-1', nomor_absen: 2, nama_lengkap: 'Bella Safira', jenis_kelamin: 'P', nisn: '0084234502' },
    { id: 's-403', kelas_id: 'k-mplb-1', nomor_absen: 3, nama_lengkap: 'Danang Joyo', jenis_kelamin: 'L', nisn: '0084234503' },
    { id: 's-404', kelas_id: 'k-mplb-1', nomor_absen: 4, nama_lengkap: 'Erina Gudono', jenis_kelamin: 'P', nisn: '0084234504' },
    { id: 's-405', kelas_id: 'k-mplb-1', nomor_absen: 5, nama_lengkap: 'Fajar Nugros', jenis_kelamin: 'L', nisn: '0084234505' },

    // X AKL 1
    { id: 's-501', kelas_id: 'k-akl-1', nomor_absen: 1, nama_lengkap: 'Ahmad Fauzi', jenis_kelamin: 'L', nisn: '0085234501' },
    { id: 's-502', kelas_id: 'k-akl-1', nomor_absen: 2, nama_lengkap: 'Cindy Claudia', jenis_kelamin: 'P', nisn: '0085234502' },
    { id: 's-503', kelas_id: 'k-akl-1', nomor_absen: 3, nama_lengkap: 'Dian Sastrowardoyo', jenis_kelamin: 'P', nisn: '0085234503' },
    { id: 's-504', kelas_id: 'k-akl-1', nomor_absen: 4, nama_lengkap: 'Eko Prasetyo', jenis_kelamin: 'L', nisn: '0085234504' },
    { id: 's-505', kelas_id: 'k-akl-1', nomor_absen: 5, nama_lengkap: 'Gadis Arafah', jenis_kelamin: 'P', nisn: '0085234505' }
  ],

  kegiatanSiswa: [],
  sesiMengajar: [],
  absensi: [],
  jurnal: [],
  checklistNotes: [],
  nilaiTugasList: [],
  schoolSettings: {
    instansi_induk: 'Pemerintah Provinsi Sulawesi Selatan',
    dinas: 'Dinas Pendidikan',
    nama_sekolah: 'SMKN 1 Bantaeng',
    alamat: 'Jl. Pahlawan No. 12, Bantaeng',
    telepon: '(0413) 21088',
    email: '',
    website: 'smkn1bantaeng.sch.id',
    npsn: '',
    logo_url: ''
  }
};
