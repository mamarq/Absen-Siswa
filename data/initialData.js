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

  siswa: [],

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
  },
  periodeSemester: []
};
