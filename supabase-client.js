// supabase-client.js - Database Access Layer (Supabase + LocalStorage Fallback)
import { INITIAL_DATA } from './data/initialData.js';
import {
  isValidUUID,
  getSemesterFromDate,
  calculateNilaiKatrol,
  STORAGE_KEYS
} from './data/stores/shared-store-utils.js';
import { JamPelajaranStore } from './data/stores/jam-pelajaran-store.js';
import { PeriodeStore } from './data/stores/periode-store.js';
import { KegiatanStore } from './data/stores/kegiatan-store.js';
import { TugasStore } from './data/stores/tugas-store.js';
import { PRStore } from './data/stores/pr-store.js';
import { KelompokStore } from './data/stores/kelompok-store.js';
import { AuthStore } from './data/stores/auth-store.js';
import { AkademikStore } from './data/stores/akademik-store.js';
import { JadwalStore } from './data/stores/jadwal-store.js';
import { GuruMengajarStore } from './data/stores/guru-mengajar-store.js';
import { AbsensiStore } from './data/stores/absensi-store.js';
import { JurnalStore } from './data/stores/jurnal-store.js';
import { LedgerStore } from './data/stores/ledger-store.js';
import { RekapStore } from './data/stores/rekap-store.js';
import { MaintenanceStore } from './data/stores/maintenance-store.js';

// Re-export pure utilities for full backwards compatibility
export {
  isValidUUID,
  getSemesterFromDate,
  calculateNilaiKatrol,
  STORAGE_KEYS
};

export class DataStore {
  constructor() {
    this.supabase = null;
    this.isSupabaseConnected = false;
    this._cache = new Map();
    this._cacheTTL = 5 * 60 * 1000; // 5 menit default TTL untuk master data
    this._scheduleCache = new Map();
    this._pendingScheduleRequests = new Map();
    this._assignmentCache = new Map();
    this._pendingAssignmentRequests = new Map();
    this._jamPelajaranStore = new JamPelajaranStore(this);
    this._periodeStore = new PeriodeStore(this);
    this._kegiatanStore = new KegiatanStore(this);
    this._tugasStore = new TugasStore(this);
    this._prStore = new PRStore(this);
    this._kelompokStore = new KelompokStore(this);
    this._authStore = new AuthStore(this);
    this._akademikStore = new AkademikStore(this);
    this._jadwalStore = new JadwalStore(this);
    this._guruMengajarStore = new GuruMengajarStore(this);
    this._absensiStore = new AbsensiStore(this);
    this._jurnalStore = new JurnalStore(this);
    this._ledgerStore = new LedgerStore(this);
    this._rekapStore = new RekapStore(this);
    this._maintenanceStore = new MaintenanceStore(this);
    this.initLocalStorage();
    this.initSupabaseClient();
  }

  // ==========================================================================
  // IN-MEMORY CACHE & SWR LAYER (SUPER CEPAT / 0 MS TAB SWITCH)
  // ==========================================================================
  _getCache(key) {
    if (!this._cache || !this._cache.has(key)) return null;
    const entry = this._cache.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  _setCache(key, data, ttl = this._cacheTTL) {
    if (data !== undefined && data !== null) {
      if (!this._cache) this._cache = new Map();
      this._cache.set(key, {
        data: data,
        expiry: Date.now() + ttl
      });
    }
    return data;
  }

  _invalidateCache(patterns = null) {
    if (!this._cache) return;
    if (!patterns) {
      this._cache.clear();
      this.invalidateGuruMengajarCache();
      this.invalidateJadwalMengajarCache();
      return;
    }
    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    for (const key of this._cache.keys()) {
      if (patternList.some(p => key.startsWith(p) || key.includes(p))) {
        this._cache.delete(key);
      }
    }
    if (patternList.some(p => p.includes('guru_mengajar') || p.includes('assignment') || p.includes('classes_'))) {
      this.invalidateGuruMengajarCache();
    }
    if (patternList.some(p => p.includes('jadwal') || p.includes('schedule') || p.includes('classes_'))) {
      this.invalidateJadwalMengajarCache();
    }
  }

  /**
   * Mengosongkan in-memory cache penugasan guru (per user/tahun atau seluruhnya)
   */
  invalidateGuruMengajarCache(userId = null, academicYear = null) {
    return this._guruMengajarStore.invalidateGuruMengajarCache(userId, academicYear);
  }

  /**
   * Mengosongkan in-memory cache jadwal mengajar (per user/tahun atau seluruhnya)
   */
  invalidateJadwalMengajarCache(userId = null, academicYear = null) {
    return this._jadwalStore.invalidateJadwalMengajarCache(userId, academicYear);
  }

  /**
   * Master cache: mengambil SELURUH penugasan guru (guru_mengajar) untuk satu tahun ajaran
   * dalam 1 query, lalu menyimpannya di _assignmentCache.
   * Method getKelasSaya dan getMapelSaya memprioritaskan data dari master cache ini.
   *
   * Concurrent requests untuk key yang sama share 1 Promise (dedup).
   */
  async getGuruMengajarCached(academicYear, semester = null) {
    return this._guruMengajarStore.getGuruMengajarCached(academicYear, semester);
  }

  /**
   * Master cache: mengambil SELURUH jadwal mengajar user untuk satu tahun ajaran
   * dalam 1 query, lalu menyimpannya di _scheduleCache.
   * Semua method turunan (getKelasSaya, getMapelSaya, getJadwalHariIni,
   * getJadwalMengajarList) DERIVE dari data ini — 0 query tambahan.
   *
   * Concurrent requests untuk key yang sama share 1 Promise (dedup).
   * Error TIDAK disimpan sebagai cache — retry dimungkinkan.
   */
  async getJadwalMengajarCached(academicYear) {
    return this._jadwalStore.getJadwalMengajarCached(academicYear);
  }

  // Inisialisasi data lokal jika masih kosong
  initLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEYS.SCHOOL_SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(INITIAL_DATA.schoolSettings || {}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.KELAS)) {
      localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(INITIAL_DATA.kelas));
    } else {
      // Backfill data kelas lokal lama jika belum memiliki academic_year
      try {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
        let modified = false;
        const backfilled = existing.map(k => {
          if (!k.academic_year || k.is_active === undefined) {
            modified = true;
            return {
              ...k,
              academic_year: k.academic_year || '2026/2027',
              is_active: k.is_active !== undefined ? k.is_active : true
            };
          }
          return k;
        });
        if (modified) {
          localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(backfilled));
        }
      } catch (e) {
        console.warn('Backfill local kelas error:', e);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.SISWA)) {
      localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(INITIAL_DATA.siswa));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MATA_PELAJARAN)) {
      localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(INITIAL_DATA.mataPelajaran));
    }
    if (!localStorage.getItem(STORAGE_KEYS.KEGIATAN)) {
      localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(INITIAL_DATA.kegiatanSiswa));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHECKLIST)) {
      localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(INITIAL_DATA.checklistNotes || []));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS)) {
      localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(INITIAL_DATA.nilaiTugasList || []));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TUGAS)) {
      localStorage.setItem(STORAGE_KEYS.TUGAS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MAPEL_LIST)) {
      localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(INITIAL_DATA.mapelList));
    }
    if (!localStorage.getItem(STORAGE_KEYS.JAM_LIST)) {
      localStorage.setItem(STORAGE_KEYS.JAM_LIST, JSON.stringify(INITIAL_DATA.jamPelajaranList || []));
    }
    if (!localStorage.getItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER)) {
      localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(INITIAL_DATA.jamPelajaranMaster || []));
    }
    if (!localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR)) {
      localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SESI)) {
      localStorage.setItem(STORAGE_KEYS.SESI, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ABSENSI)) {
      localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.JURNAL)) {
      localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.JURUSAN)) {
      localStorage.setItem(STORAGE_KEYS.JURUSAN, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PERIODE_SEMESTER)) {
      localStorage.setItem(STORAGE_KEYS.PERIODE_SEMESTER, JSON.stringify(INITIAL_DATA.periodeSemester || []));
    }

    // Pembersihan otomatis data dummy lama (act-1, act-2, act-3, chk-1, nt-1)
    if (!localStorage.getItem('absen_dummy_purged_v2')) {
      const oldKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
      const cleanedKegiatan = oldKegiatan.filter(k => !['act-1', 'act-2', 'act-3'].includes(k.id));
      localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(cleanedKegiatan));

      const oldChecklist = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]');
      const cleanedChecklist = oldChecklist.filter(c => c.id !== 'chk-1');
      localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(cleanedChecklist));

      const oldNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]');
      const cleanedNilai = oldNilai.filter(n => n.id !== 'nt-1');
      localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(cleanedNilai));

      localStorage.setItem('absen_dummy_purged_v2', 'true');
    }
  }

  // Inisialisasi Supabase JS jika credential tersedia di localStorage
  initSupabaseClient() {
    try {
      if (typeof localStorage === 'undefined') return;
      const configStr = localStorage.getItem(STORAGE_KEYS.CONFIG);
      const config = configStr ? JSON.parse(configStr) : null;

      const url = config && typeof config.url === 'string' ? config.url.trim() : '';
      const key = config && typeof config.key === 'string' ? config.key.trim() : '';

      if (url && key && typeof window !== 'undefined' && window.supabase) {
        this.supabase = window.supabase.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        this.isSupabaseConnected = true;
        return;
      }
    } catch (e) {
      console.warn('Gagal menghubungkan Supabase:', e);
    }
    this.supabase = null;
    this.isSupabaseConnected = false;
  }

  getConfig() {
    try {
      if (typeof localStorage === 'undefined') return {};
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}');
    } catch {
      return {};
    }
  }

  async saveConfig(urlOrConfig, keyParam) {
    const rawUrl = (typeof urlOrConfig === 'object' && urlOrConfig !== null)
      ? urlOrConfig.url
      : urlOrConfig;
    const rawKey = (typeof urlOrConfig === 'object' && urlOrConfig !== null)
      ? urlOrConfig.key
      : keyParam;

    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';

    if (!url || !key) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.CONFIG);
      }
      this.supabase = null;
      this.isSupabaseConnected = false;
      return { success: true, message: 'Kembali ke mode penyimpanan lokal (Offline)' };
    }

    try {
      if (typeof window === 'undefined' || !window.supabase) {
        throw new Error('Library Supabase SDK belum termuat.');
      }
      const client = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      // Test query
      const { error } = await client.from('kelas').select('id').limit(1);
      if (error) throw error;

      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ url, key }));
      this.supabase = client;
      this.isSupabaseConnected = true;
      await this.syncSchoolAndProfileFromSupabase();
      return { success: true, message: 'Koneksi ke Supabase berhasil! Data sekolah dan profil guru tersinkronisasi.' };
    } catch (err) {
      return { success: false, message: `Koneksi Supabase gagal: ${err.message}` };
    }
  }

  // ==========================================================================
  // PEMERIKSAAN KESEHATAN, STRUKTUR TABEL & SEEDING (MaintenanceStore)
  // ==========================================================================
  async checkDatabaseSchema() {
    return this._maintenanceStore.checkDatabaseSchema();
  }

  async seedInitialDatabase() {
    return this._maintenanceStore.seedInitialDatabase();
  }

  // ==========================================================================
  // DATA SEKOLAH & PROFIL GURU & AUTENTIKASI
  // Dipindahkan ke data/stores/auth-store.js (Tahap 5B-8)
  // ==========================================================================

  /**
   * Menyelaraskan Data Sekolah dan Profil Guru dari Supabase Cloud ke LocalStorage
   */
  async syncSchoolAndProfileFromSupabase() {
    return this._authStore.syncSchoolAndProfileFromSupabase();
  }

  getSchoolSettings() {
    return this._authStore.getSchoolSettings();
  }

  async saveSchoolSettings(settings) {
    return this._authStore.saveSchoolSettings(settings);
  }

  getProfilGuru() {
    return this._authStore.getProfilGuru();
  }

  async saveProfilGuru(profil) {
    return this._authStore.saveProfilGuru(profil);
  }

  async _getAuthProfile(userId) {
    return this._authStore._getAuthProfile(userId);
  }

  async getCurrentUser() {
    return this._authStore.getCurrentUser();
  }

  async login(email, password) {
    return this._authStore.login(email, password);
  }

  async signup(email, password, fullName) {
    return this._authStore.signup(email, password, fullName);
  }

  async logout() {
    return this._authStore.logout();
  }

  // Sinkronisasi data lokal ke Supabase Cloud
  async syncLocalToCloud() {
    return this._authStore.syncLocalToCloud();
  }

  // ==========================================================================
  // HELPER GROUPING & SORTING TINGKAT KELAS — DELEGATED TO AkademikStore
  // ==========================================================================
  groupAndSortKelas(kelasList) {
    return this._akademikStore.groupAndSortKelas(kelasList);
  }

  renderClassOptgroups(kelasList, selectedId = '', placeholder = null) {
    return this._akademikStore.renderClassOptgroups(kelasList, selectedId, placeholder);
  }

  getGroupedKelasMap(kelasList) {
    return this._akademikStore.getGroupedKelasMap(kelasList);
  }

  // ==========================================================================
  // TAHUN AJARAN & KELAS PER TAHUN — DELEGATED TO AkademikStore
  // ==========================================================================
  async getDistinctAcademicYears() {
    return this._akademikStore.getDistinctAcademicYears();
  }

  async getActiveAcademicYear() {
    return this._akademikStore.getActiveAcademicYear();
  }

  // ==========================================================================
  // MASTER PERIODE SEMESTER (SOURCE OF TRUTH PERIODE KBM) — DELEGATED
  // ==========================================================================

  /**
   * Mengambil SELURUH daftar periode semester yang terdaftar, diurutkan tanggal_mulai ASC.
   */
  async getPeriodeSemesterList() {
    return this._periodeStore.getPeriodeSemesterList();
  }

  /**
   * Mengambil periode semester yang saat ini AKTIF (is_active = true / status = 'aktif')
   */
  async getActiveSemester() {
    return this._periodeStore.getActiveSemester();
  }

  /**
   * Mengambil periode semester yang menaungi suatu tanggal tertentu (tanggal_mulai <= date <= tanggal_selesai)
   */
  async getPeriodeByDate(dateStr) {
    return this._periodeStore.getPeriodeByDate(dateStr);
  }

  /**
   * Memastikan tanggal yang dituju dapat ditulis (tidak berada dalam semester yang ditutup).
   */
  async assertPeriodeWritableByDate(dateStr) {
    return this._periodeStore.assertPeriodeWritableByDate(dateStr);
  }

  /**
   * Mengambil satu periode semester spesifik berdasarkan academic_year dan semester.
   */
  async getPeriodeSemester(academicYear, semester) {
    return this._periodeStore.getPeriodeSemester(academicYear, semester);
  }

  /**
   * Memastikan periode semester yang dituju dapat ditulis (tidak berstatus 'ditutup').
   */
  async assertPeriodeWritableBySemester(academicYear, semester) {
    return this._periodeStore.assertPeriodeWritableBySemester(academicYear, semester);
  }

  /**
   * Mengambil seluruh periode semester untuk tahun ajaran tertentu
   */
  async getPeriodeByAcademicYear(academicYear) {
    return this._periodeStore.getPeriodeByAcademicYear(academicYear);
  }

  /**
   * Menambahkan atau mengupdate periode semester dengan validasi ketat
   */
  async savePeriodeSemester(periodeData) {
    return this._periodeStore.savePeriodeSemester(periodeData);
  }

  /**
   * Menetapkan satu periode semester menjadi AKTIF secara atomik
   */
  async setActivePeriode(id) {
    return this._periodeStore.setActivePeriode(id);
  }

  /**
   * Menutup periode semester yang sedang aktif
   */
  async closePeriode(id) {
    return this._periodeStore.closePeriode(id);
  }

  // Wrapper Query getClassesByYear — DELEGATED TO AkademikStore
  async getClassesByYear(academicYear, onlyActive = false) {
    return this._akademikStore.getClassesByYear(academicYear, onlyActive);
  }

  async getKelasByTahunAjaran(academicYear, onlyActive = false) {
    return this._akademikStore.getKelasByTahunAjaran(academicYear, onlyActive);
  }

  // Wrapper Query getSessionsByYear (Bagian 1) — DELEGATED TO AbsensiStore
  async getSessionsByYear(academicYear) {
    return this._absensiStore.getSessionsByYear(academicYear);
  }

  async getAllSesiByYear(academicYear) {
    return this._absensiStore.getAllSesiByYear(academicYear);
  }

  async getKelas(academicYear) {
    return this._akademikStore.getKelas(academicYear);
  }

  // ==========================================================================
  // MASTER JURUSAN — DELEGATED TO AkademikStore
  // ==========================================================================
  async getJurusanList() {
    return this._akademikStore.getJurusanList();
  }

  async getAllJurusan() {
    return this._akademikStore.getAllJurusan();
  }

  async addJurusan(jurusanData) {
    return this._akademikStore.addJurusan(jurusanData);
  }

  async updateJurusan(id, updatedData) {
    return this._akademikStore.updateJurusan(id, updatedData);
  }

  async deactivateJurusan(id) {
    return this._akademikStore.deactivateJurusan(id);
  }

  async reactivateJurusan(id) {
    return this._akademikStore.reactivateJurusan(id);
  }

  async deleteJurusan(id) {
    return this._akademikStore.deleteJurusan(id);
  }

  // ==========================================================================
  // MASTER KELAS — DELEGATED TO AkademikStore
  // ==========================================================================
  async addKelas(kelasData) {
    return this._akademikStore.addKelas(kelasData);
  }

  async updateKelas(id, updatedData) {
    return this._akademikStore.updateKelas(id, updatedData);
  }

  async deleteKelas(id) {
    return this._akademikStore.deleteKelas(id);
  }

  // ==========================================================================
  // MASTER MATA PELAJARAN — DELEGATED TO AkademikStore
  // ==========================================================================
  async getMataPelajaran() {
    return this._akademikStore.getMataPelajaran();
  }

  async getMapelList() {
    return this._akademikStore.getMapelList();
  }

  async addMataPelajaran(mapelData) {
    return this._akademikStore.addMataPelajaran(mapelData);
  }

  async updateMataPelajaran(id, updatedData) {
    return this._akademikStore.updateMataPelajaran(id, updatedData);
  }

  async deleteMataPelajaran(id) {
    return this._akademikStore.deleteMataPelajaran(id);
  }

  async addMapel(namaMapel) {
    return this._akademikStore.addMapel(namaMapel);
  }

  async deleteMapel(namaMapel) {
    return this._akademikStore.deleteMapel(namaMapel);
  }

  async getJamList() {
    return this._akademikStore.getJamList();
  }

  // ==========================================================================
  // DATA SISWA — DELEGATED TO AkademikStore
  // ==========================================================================
  async getAllSiswa() {
    return this._akademikStore.getAllSiswa();
  }

  async getSiswaByKelas(kelasId, onlyActive = false) {
    return this._akademikStore.getSiswaByKelas(kelasId, onlyActive);
  }

  async addSiswa(siswaData) {
    return this._akademikStore.addSiswa(siswaData);
  }

  async updateSiswa(id, updatedData) {
    return this._akademikStore.updateSiswa(id, updatedData);
  }

  async deleteSiswa(id) {
    return this._akademikStore.deleteSiswa(id);
  }

  async bulkImportSiswa(kelasId, namesList) {
    return this._akademikStore.bulkImportSiswa(kelasId, namesList);
  }

  // ==========================================================================
  // KEGIATAN SISWA & BADGES — DELEGATED TO KegiatanStore
  // ==========================================================================
  async getKegiatanSiswaByTanggal(tanggal) {
    return this._kegiatanStore.getKegiatanSiswaByTanggal(tanggal);
  }

  async getAllKegiatanSiswa(academicYear) {
    return this._kegiatanStore.getAllKegiatanSiswa(academicYear);
  }

  async getKegiatanSiswaBySiswa(siswaId) {
    return this._kegiatanStore.getKegiatanSiswaBySiswa(siswaId);
  }

  async addKegiatanSiswa(kegiatanData) {
    return this._kegiatanStore.addKegiatanSiswa(kegiatanData);
  }

  async deleteKegiatanSiswa(id) {
    return this._kegiatanStore.deleteKegiatanSiswa(id);
  }

  // ==========================================================================
  // CATATAN CEKLIS SISWA (BENTUK CEKLIS ABSEN PER SISWA HARI ITU)
  // Dipindahkan ke data/stores/tugas-store.js (Tahap 5B-5)
  // ==========================================================================
  async getAllChecklist(academicYear) {
    return this._tugasStore.getAllChecklist(academicYear);
  }

  async getChecklistById(id) {
    return this._tugasStore.getChecklistById(id);
  }

  async getChecklistHariIni(tanggal, academicYear = null) {
    return this._tugasStore.getChecklistHariIni(tanggal, academicYear);
  }

  async getChecklistByKelasAndTanggal(kelasId, tanggal) {
    return this._tugasStore.getChecklistByKelasAndTanggal(kelasId, tanggal);
  }

  async saveChecklist(data) {
    return this._tugasStore.saveChecklist(data);
  }

  async deleteChecklist(id) {
    return this._tugasStore.deleteChecklist(id);
  }

  // ==========================================================================
  // NILAI TUGAS (BENTUK NILAI SEDERHANA PER SISWA)
  // Dipindahkan ke data/stores/tugas-store.js (Tahap 5B-5)
  // ==========================================================================
  async getAllNilaiTugas(academicYear) {
    return this._tugasStore.getAllNilaiTugas(academicYear);
  }

  async getNilaiTugasById(id) {
    return this._tugasStore.getNilaiTugasById(id);
  }

  async getNilaiTugasHariIni(tanggal, academicYear = null) {
    return this._tugasStore.getNilaiTugasHariIni(tanggal, academicYear);
  }

  async saveNilaiTugas(data) {
    return this._tugasStore.saveNilaiTugas(data);
  }

  async deleteNilaiTugas(id) {
    return this._tugasStore.deleteNilaiTugas(id);
  }

  // ==========================================================================
  // PEKERJAAN RUMAH (PR) - MASTER TUGAS & NILAI SISWA (2 TAHAP: PEMBERIAN & PEMERIKSAAN)
  // Dipindahkan ke data/stores/pr-store.js (Tahap 5B-6)
  // ==========================================================================

  /**
   * Mengambil daftar PR dengan filter status, kelas_id, dan academic_year (Strict Per-User)
   */
  async getPRList({ status, kelas_id, academic_year } = {}) {
    return this._prStore.getPRList({ status, kelas_id, academic_year });
  }

  /**
   * Mengambil detail lengkap 1 data PR beserta seluruh baris nilai siswa (Strict Per-User)
   */
  async getPRDetail(prId) {
    return this._prStore.getPRDetail(prId);
  }

  /**
   * Membuat penugasan PR baru dan otomatis meng-generate baris awal pr_nilai_siswa (Strict Per-User)
   */
  async createPR(data) {
    return this._prStore.createPR(data);
  }

  /**
   * Submit hasil pemeriksaan nilai PR per siswa dan ubah status pr_tugas jadi 'selesai_diperiksa' (Strict Per-User)
   */
  async submitPemeriksaanPR(prId, { items = [], tanggal_diperiksa } = {}) {
    return this._prStore.submitPemeriksaanPR(prId, { items, tanggal_diperiksa });
  }

  /**
   * Hapus penugasan PR dan seluruh detail nilainya (Strict Per-User)
   */
  async deletePR(prId) {
    return this._prStore.deletePR(prId);
  }

  /**
   * Menghitung jumlah PR dengan status 'menunggu' untuk badge notifikasi sidebar (Strict Per-User)
   */
  async getPendingPRCount(academicYear) {
    return this._prStore.getPendingPRCount(academicYear);
  }

  /**
   * Mengambil riwayat PR untuk satu siswa tertentu (untuk Rekap Per Siswa)
   */
  async getRekapPRBySiswa(siswaId, academicYear) {
    return this._prStore.getRekapPRBySiswa(siswaId, academicYear);
  }

  // ==========================================================================
  // FITUR KELOMPOK BELAJAR (MASTER DATA & TUGAS KELOMPOK)
  // Dipindahkan ke data/stores/kelompok-store.js (Tahap 5B-7)
  // ==========================================================================

  /**
   * Mengambil daftar kelompok beserta anggota siswanya per Kelas + Mapel + Tahun Ajaran (Strict Per-User)
   */
  async getKelompokList({ kelas_id, mapel_id, mapel, academic_year } = {}) {
    return this._kelompokStore.getKelompokList({ kelas_id, mapel_id, mapel, academic_year });
  }

  /**
   * Menyimpan / membuat kelompok baru (Strict Per-User & Mandatory mapel_id)
   */
  async saveKelompok(data) {
    return this._kelompokStore.saveKelompok(data);
  }

  /**
   * Menghapus 1 data kelompok dan seluruh anggotanya (Strict Per-User)
   */
  async deleteKelompok(kelompokId) {
    return this._kelompokStore.deleteKelompok(kelompokId);
  }

  /**
   * Menambahkan siswa ke dalam kelompok (Strict Parent Ownership & Mandatory mapel_id)
   */
  async addAnggotaKelompok({ kelompok_id, siswa_id, kelas_id, mapel_id, academic_year, semester }) {
    return this._kelompokStore.addAnggotaKelompok({ kelompok_id, siswa_id, kelas_id, mapel_id, academic_year, semester });
  }

  /**
   * Menghapus siswa dari anggota kelompok (Strict Parent Ownership)
   */
  async removeAnggotaKelompok(kelompokId, siswaId) {
    return this._kelompokStore.removeAnggotaKelompok(kelompokId, siswaId);
  }

  /**
   * Mengambil daftar siswa yang BELUM masuk kelompok manapun pada kombinasi Kelas + Mapel aktif (Strict Per-User)
   */
  async getSiswaBelumBerkelompok(kelasId, mapelId, academicYear) {
    return this._kelompokStore.getSiswaBelumBerkelompok(kelasId, mapelId, academicYear);
  }

  /**
   * Membuat pembagian kelompok secara otomatis (Acak / Berimbang)
   */
  async generateKelompokOtomatis({ kelas_id, mapel_id, mapel, jumlah_kelompok = 4, format_nama = 'Kelompok {N}', academic_year, semester }) {
    return this._kelompokStore.generateKelompokOtomatis({ kelas_id, mapel_id, mapel, jumlah_kelompok, format_nama, academic_year, semester });
  }

  /**
   * Mengambil daftar tugas kelompok tersimpan
   */
  async getTugasKelompokList({ kelas_id, mapel, academic_year } = {}) {
    return this._kelompokStore.getTugasKelompokList({ kelas_id, mapel, academic_year });
  }

  /**
   * Mengambil riwayat nilai tugas kelompok untuk satu siswa tertentu (untuk Rekap Per Siswa)
   */
  async getRekapTugasKelompokBySiswa(siswaId, academicYear) {
    return this._kelompokStore.getRekapTugasKelompokBySiswa(siswaId, academicYear);
  }

  /**
   * Menyimpan nilai tugas kelompok
   */
  async saveTugasKelompok(data) {
    return this._kelompokStore.saveTugasKelompok(data);
  }

  /**
   * Menghapus tugas kelompok
   */
  async deleteTugasKelompok(tugasId) {
    return this._kelompokStore.deleteTugasKelompok(tugasId);
  }

  // ==========================================================================
  // SESI MENGAJAR & ABSENSI & JURNAL
  // Didelegasikan ke AbsensiStore & JurnalStore (Tahap 5B-11)
  // ==========================================================================

  async findSesi(kelasId, mapel, tanggal) {
    return this._absensiStore.findSesi(kelasId, mapel, tanggal);
  }

  async getAttendanceMapByKelasAndTanggal(kelasId, tanggal, mapel = null) {
    return this._absensiStore.getAttendanceMapByKelasAndTanggal(kelasId, tanggal, mapel);
  }

  async getAllSesi(academicYear = null) {
    return this._absensiStore.getAllSesi(academicYear);
  }

  async saveSesi({ sesiData, absensiList, jurnalData }) {
    return this._absensiStore.saveSesi({ sesiData, absensiList, jurnalData });
  }

  async deleteSesi(sesiId) {
    return this._absensiStore.deleteSesi(sesiId);
  }

  async getRekapKehadiran(kelasId, mapel, startDate, endDate, academicYear = null) {
    return this._rekapStore.getRekapKehadiran(kelasId, mapel, startDate, endDate, academicYear);
  }

  async getRekapIndividuSiswa(siswaId, academicYear = null) {
    return this._rekapStore.getRekapIndividuSiswa(siswaId, academicYear);
  }

  // Helper delegasi JurnalStore
  async getJurnalBySesiId(sesiId) {
    return this._jurnalStore.getJurnalBySesiId(sesiId);
  }

  async getAllJurnal(academicYear = null) {
    return this._jurnalStore.getAllJurnal(academicYear);
  }

  async saveJurnal(sesiId, jurnalData) {
    return this._jurnalStore.saveJurnal(sesiId, jurnalData);
  }

  // ==========================================================================
  // BACKUP, RESTORE, & CLEAR (MaintenanceStore)
  // ==========================================================================
  exportBackupJSON() {
    return this._maintenanceStore.exportBackupJSON();
  }

  importBackupJSON(jsonString) {
    return this._maintenanceStore.importBackupJSON(jsonString);
  }

  clearDummyData() {
    return this._maintenanceStore.clearDummyData();
  }

  // ==========================================================================
  // KENAIKAN KELAS — DELEGATED TO AkademikStore
  // ==========================================================================
  async checkKenaikanSafeguard(sourceYear, targetYear) {
    return this._akademikStore.checkKenaikanSafeguard(sourceYear, targetYear);
  }

  async processKenaikanKelas(payload) {
    return this._akademikStore.processKenaikanKelas(payload);
  }

  // ==========================================================================
  // FITUR LEDGER & KALKULATOR NILAI AKHIR (DELEGATED TO LedgerStore)
  // ==========================================================================

  async getLedgerConfig({ kelas_id, mapel_id, mapel, academic_year }) {
    return this._ledgerStore.getLedgerConfig({ kelas_id, mapel_id, mapel, academic_year });
  }

  async saveLedgerConfig(configData) {
    return this._ledgerStore.saveLedgerConfig(configData);
  }

  async calculateLedgerNilai({ kelas_id, mapel_id, mapel, academic_year, semester = 'Ganjil' }) {
    return this._ledgerStore.calculateLedgerNilai({ kelas_id, mapel_id, mapel, academic_year, semester });
  }

  async saveLedgerFinalisasi(data) {
    return this._ledgerStore.saveLedgerFinalisasi(data);
  }

  async getLedgerFinalisasiList({ kelas_id, mapel_id, mapel, academic_year, semester } = {}) {
    return this._ledgerStore.getLedgerFinalisasiList({ kelas_id, mapel_id, mapel, academic_year, semester });
  }

  async deleteLedgerFinalisasi(id) {
    return this._ledgerStore.deleteLedgerFinalisasi(id);
  }

  async saveNilaiSumatif({ kelas_id, mapel_id, mapel, academic_year, semester, tipe_sumatif, judul, tanggal, daftar_nilai, kkm = 75 }) {
    return this._ledgerStore.saveNilaiSumatif({ kelas_id, mapel_id, mapel, academic_year, semester, tipe_sumatif, judul, tanggal, daftar_nilai, kkm });
  }

  // ==========================================================================
  // MASTER JAM PELAJARAN (PER-SATUAN JP) — DELEGATED TO JamPelajaranStore
  // ==========================================================================

  /**
   * Mengambil daftar master slot jam pelajaran (diurutkan nomor_urut)
   */
  async getJamPelajaranMaster() {
    return this._jamPelajaranStore.getJamPelajaranMaster();
  }

  /**
   * Menyimpan atau memperbarui 1 slot jam pelajaran master
   */
  async saveJamPelajaranMaster(item) {
    return this._jamPelajaranStore.saveJamPelajaranMaster(item);
  }

  /**
   * Menghapus 1 slot jam pelajaran master
   */
  async deleteJamPelajaranMaster(id) {
    return this._jamPelajaranStore.deleteJamPelajaranMaster(id);
  }

  /**
   * Reset master jam pelajaran ke template default
   */
  async resetJamPelajaranMasterToDefault() {
    return this._jamPelajaranStore.resetJamPelajaranMasterToDefault();
  }

  // ==========================================================================
  // JADWAL MENGAJAR GURU (JADWAL RUTIN MINGGUAN & VERSIONING HISTORIS)
  // Didelegasikan ke JadwalStore
  // ==========================================================================

  _getDefaultEffectiveFrom(academicYear) {
    return this._jadwalStore._getDefaultEffectiveFrom(academicYear);
  }

  _getPreviousDateString(dateStr) {
    return this._jadwalStore._getPreviousDateString(dateStr);
  }

  async getJadwalMengajarList(filter = {}) {
    return this._jadwalStore.getJadwalMengajarList(filter);
  }

  async saveJadwalMengajar(data) {
    return this._jadwalStore.saveJadwalMengajar(data);
  }

  async deleteJadwalMengajar(id, options = {}) {
    return this._jadwalStore.deleteJadwalMengajar(id, options);
  }

  async replaceJadwalMengajar(params) {
    return this._jadwalStore.replaceJadwalMengajar(params);
  }

  async resetJadwalMengajar(academicYear = null) {
    return this._jadwalStore.resetJadwalMengajar(academicYear);
  }

  async getJadwalHariIni(academicYear, dateStr) {
    return this._jadwalStore.getJadwalHariIni(academicYear, dateStr);
  }

  // ==========================================================================
  // PENUGASAN GURU (GURU_MENGAJAR) & DERIVED GETTERS (getKelasSaya, getMapelSaya)
  // Didelegasikan ke GuruMengajarStore
  // ==========================================================================

  async getGuruMengajarList(academicYear = null, semester = null) {
    return this._guruMengajarStore.getGuruMengajarList(academicYear, semester);
  }

  async addGuruMengajar(assignmentData) {
    return this._guruMengajarStore.addGuruMengajar(assignmentData);
  }

  async updateGuruMengajar(id, updatedData) {
    return this._guruMengajarStore.updateGuruMengajar(id, updatedData);
  }

  async deleteGuruMengajar(id) {
    return this._guruMengajarStore.deleteGuruMengajar(id);
  }

  async getKelasSaya(academicYear = null, targetDate = null, semester = null) {
    return this._guruMengajarStore.getKelasSaya(academicYear, targetDate, semester);
  }

  async getMapelSaya(academicYear = null, kelasId = null, targetDate = null, semester = null) {
    return this._guruMengajarStore.getMapelSaya(academicYear, kelasId, targetDate, semester);
  }

  resetDemoData() {
    return this._maintenanceStore.resetDemoData();
  }
}

export const db = new DataStore();
