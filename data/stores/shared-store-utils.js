// data/stores/shared-store-utils.js
// Kumpulan fungsi utilitas murni (stateless) dan konstanta penyimpanan lokal untuk modul data store

/**
 * Validasi apakah sebuah string merupakan UUID v4 yang valid
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Menentukan semester (Ganjil / Genap) dari string tanggal (YYYY-MM-DD)
 * Standar Kalender Pendidikan Indonesia:
 * - Semester Ganjil: Bulan 7 s.d. 12 (Juli - Desember)
 * - Semester Genap : Bulan 1 s.d. 6 (Januari - Juni)
 * @param {string} dateStr
 * @returns {'Ganjil' | 'Genap'}
 */
export function getSemesterFromDate(dateStr) {
  if (!dateStr) return 'Ganjil';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Ganjil';
  const month = d.getMonth() + 1; // 1 - 12
  return (month >= 7 && month <= 12) ? 'Ganjil' : 'Genap';
}

/**
 * Menghitung penyesuaian nilai katrol secara proporsional (Min-Max Linear Rescaling)
 * Rumus: Nilai_Katrol = Batas_Terendah + ((Nilai_Asli - Min_Kelas) / (Max_Kelas - Min_Kelas)) * (Batas_Tertinggi - Batas_Terendah)
 * @param {Object} param0
 * @param {number|string} param0.nilaiAsli
 * @param {number|string} param0.minKelas
 * @param {number|string} param0.maxKelas
 * @param {number} [param0.batasBawah=75]
 * @param {number} [param0.batasAtas=85]
 * @param {number} [param0.kkm=75]
 * @returns {number|null}
 */
export function calculateNilaiKatrol({
  nilaiAsli,
  minKelas,
  maxKelas,
  batasBawah = 75,
  batasAtas = 85,
  kkm = 75
}) {
  if (nilaiAsli === null || nilaiAsli === undefined || isNaN(Number(nilaiAsli))) {
    return null;
  }

  const sc = Number(nilaiAsli);
  const min = Number(minKelas);
  const max = Number(maxKelas);
  const bBawah = Number(batasBawah);
  const bAtas = Number(batasAtas);

  // Validasi batas
  if (bBawah > bAtas) {
    return null;
  }

  // Edge case 1: Seluruh siswa memiliki nilai yang sama (Max === Min)
  if (max === min) {
    return sc >= Number(kkm) ? bAtas : bBawah;
  }

  // Linear Interpolation
  const katrolRaw = bBawah + ((sc - min) / (max - min)) * (bAtas - bBawah);
  return Math.round(katrolRaw);
}

/**
 * Konstanta key penyimpanan LocalStorage
 */
export const STORAGE_KEYS = {
  CONFIG: 'absen_supabase_config',
  KELAS: 'absen_db_kelas',
  SISWA: 'absen_db_siswa',
  SESI: 'absen_db_sesi',
  ABSENSI: 'absen_db_absensi',
  JURNAL: 'absen_db_jurnal',
  KEGIATAN: 'absen_db_kegiatan',
  TUGAS: 'absen_db_tugas',
  CHECKLIST: 'absen_db_checklist',
  NILAI_TUGAS: 'absen_db_nilai_tugas',
  MATA_PELAJARAN: 'absen_db_mata_pelajaran',
  MAPEL_LIST: 'absen_db_mapel_list',
  JAM_LIST: 'absen_db_jam_list',
  PROFIL_GURU: 'absen_db_profil_guru',
  SCHOOL_SETTINGS: 'absen_db_school_settings',
  PR_TUGAS: 'absen_db_pr_tugas',
  PR_NILAI_SISWA: 'absen_db_pr_nilai_siswa',
  KELOMPOK: 'absen_db_kelompok_belajar',
  KELOMPOK_ANGGOTA: 'absen_db_kelompok_anggota',
  LEDGER_CONFIG: 'absen_db_ledger_config',
  LEDGER_FINALISASI: 'absen_db_ledger_finalisasi',
  JAM_PELAJARAN_MASTER: 'absen_db_jam_pelajaran_master',
  JADWAL_MENGAJAR: 'absen_db_jadwal_mengajar',
  GURU_MENGAJAR: 'absen_db_guru_mengajar',
  JURUSAN: 'absen_db_jurusan',
  PERIODE_SEMESTER: 'absen_db_periode_semester'
};
