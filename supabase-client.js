function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// supabase-client.js - Database Access Layer (Supabase + LocalStorage Fallback)
import { INITIAL_DATA } from './data/initialData.js';

/**
 * Menentukan semester (Ganjil / Genap) dari string tanggal (YYYY-MM-DD)
 * Standar Kalender Pendidikan Indonesia:
 * - Semester Ganjil: Bulan 7 s.d. 12 (Juli - Desember)
 * - Semester Genap : Bulan 1 s.d. 6 (Januari - Juni)
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
  JURUSAN: 'absen_db_jurusan'
};

class DataStore {
  constructor() {
    this.supabase = null;
    this.isSupabaseConnected = false;
    this._cache = new Map();
    this._cacheTTL = 5 * 60 * 1000; // 5 menit default TTL untuk master data
    this._scheduleCache = new Map();
    this._pendingScheduleRequests = new Map();
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
      return;
    }
    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    for (const key of this._cache.keys()) {
      if (patternList.some(p => key.startsWith(p) || key.includes(p))) {
        this._cache.delete(key);
      }
    }
  }

  /**
   * Mengosongkan in-memory cache jadwal mengajar (per user/tahun atau seluruhnya)
   */
  invalidateJadwalMengajarCache(userId = null, academicYear = null) {
    if (!this._scheduleCache) this._scheduleCache = new Map();
    if (!this._pendingScheduleRequests) this._pendingScheduleRequests = new Map();

    if (userId && academicYear) {
      const key = `${userId}:${academicYear}`;
      this._scheduleCache.delete(key);
      this._pendingScheduleRequests.delete(key);
    } else if (userId) {
      for (const key of this._scheduleCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this._scheduleCache.delete(key);
        }
      }
      for (const key of this._pendingScheduleRequests.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this._pendingScheduleRequests.delete(key);
        }
      }
    } else {
      this._scheduleCache.clear();
      this._pendingScheduleRequests.clear();
    }
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
    const activeYear = academicYear || await this.getActiveAcademicYear();
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    if (!currentUserId) return [];

    const key = `${currentUserId}:${activeYear}`;

    // 1. Cek cache hit
    if (this._scheduleCache.has(key)) {
      const entry = this._scheduleCache.get(key);
      if (entry && Date.now() <= entry.expiry) {
        return entry.data;
      }
      this._scheduleCache.delete(key);
    }

    // 2. Dedup: jika ada request in-flight untuk key sama, tunggu itu
    if (this._pendingScheduleRequests.has(key)) {
      return this._pendingScheduleRequests.get(key);
    }

    // 3. Buat Promise baru
    const fetchPromise = (async () => {
      try {
        let result = null;

        if (this.isSupabaseConnected && this.supabase) {
          try {
            const { data, error } = await this.supabase
              .from('jadwal_mengajar')
              .select(`
                *,
                kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year, is_active),
                mata_pelajaran:mapel_id (id, nama_mapel, kode)
              `)
              .eq('academic_year', activeYear)
              .eq('user_id', currentUserId)
              .order('jam_mulai', { ascending: true });

            if (!error && data) {
              result = data.map(j => ({
                ...j,
                nama_kelas: j.kelas?.nama_kelas || '',
                mapel: j.mata_pelajaran?.nama_mapel || j.mapel || ''
              }));
            }
          } catch (e) {
            console.warn('Supabase getJadwalMengajarCached fallback:', e);
          }
        }

        if (!result) {
          // Fallback localStorage
          const allJadwal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
          const [kelasList, mapelList] = await Promise.all([
            this.getClassesByYear(activeYear, false),
            this.getMataPelajaran()
          ]);

          result = allJadwal.filter(j => {
            if (j.user_id !== currentUserId) return false;
            if (j.academic_year && j.academic_year !== activeYear) return false;
            return true;
          }).map(j => {
            const kObj = kelasList.find(k => k.id === j.kelas_id);
            const mObj = mapelList.find(m => m.id === j.mapel_id || m.nama_mapel === j.mapel);
            return {
              ...j,
              nama_kelas: kObj?.nama_kelas || j.nama_kelas || '',
              mapel: mObj?.nama_mapel || j.mapel || ''
            };
          });

          const dayOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
          result.sort((a, b) => {
            const dayDiff = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99);
            if (dayDiff !== 0) return dayDiff;
            return (a.jam_mulai || '').localeCompare(b.jam_mulai || '');
          });
        }

        // Simpan di schedule cache (TTL 5 menit)
        this._scheduleCache.set(key, {
          data: result,
          expiry: Date.now() + this._cacheTTL
        });

        return result;
      } finally {
        // SELALU hapus pending, baik sukses maupun error
        this._pendingScheduleRequests.delete(key);
      }
    })();

    this._pendingScheduleRequests.set(key, fetchPromise);
    return fetchPromise;
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
  // PEMERIKSAAN KESEHATAN & STRUKTUR TABEL DATABASE SUPABASE CLOUD
  // ==========================================================================
  async checkDatabaseSchema() {
    if (!this.isSupabaseConnected || !this.supabase) {
      return {
        isConnected: false,
        totalTables: 19,
        existingCount: 0,
        missingCount: 19,
        isFullyInstalled: false,
        rpcExists: false,
        message: 'Aplikasi belum terhubung ke project Supabase Cloud.',
        tables: []
      };
    }

    const tableDefs = [
      { name: 'kelas', label: 'Data Kelas & Rombel', desc: 'Rombel kelas, tingkat, jurusan, & academic_year' },
      { name: 'mata_pelajaran', label: 'Master Mata Pelajaran', desc: 'Daftar mapel dan kategori (UMUM/PILIHAN)' },
      { name: 'siswa', label: 'Data Siswa', desc: 'Identitas siswa, NISN, no absen, & kelas_id' },
      { name: 'sesi_mengajar', label: 'Sesi Mengajar', desc: 'Pertemuan KBM kelas, mapel, & tanggal' },
      { name: 'absensi', label: 'Absensi / Presensi Siswa', desc: 'Status kehadiran H/S/I/A per sesi' },
      { name: 'jurnal_mengajar', label: 'Jurnal Pembelajaran', desc: 'Materi pokok, kegiatan, & kendala guru' },
      { name: 'catatan_checklist', label: 'Catatan Ceklis & Tugas', desc: 'Ceklis ketuntasan & fitur Bebas Catatan' },
      { name: 'nilai_tugas', label: 'Penilaian Nilai Tugas', desc: 'Nilai tugas siswa, tugas kelompok, & Bebas Tugas' },
      { name: 'kegiatan_siswa', label: 'Catatan Kegiatan Siswa', desc: 'Keaktifan, dispensasi, pelanggaran siswa' },
      { name: 'pr_tugas', label: 'Pekerjaan Rumah (PR)', desc: 'Penugasan PR 2 tahap (menunggu / selesai diperiksa)' },
      { name: 'pr_nilai_siswa', label: 'Nilai PR Siswa', desc: 'Detail nilai & status pengumpulan PR per siswa' },
      { name: 'kelompok_belajar', label: 'Master Data Kelompok', desc: 'Susunan kelompok siswa per kelas & mapel' },
      { name: 'kelompok_anggota', label: 'Anggota Kelompok Siswa', desc: 'Relasi siswa dalam kelompok (1 siswa 1 kelompok per mapel)' },
      { name: 'ledger_config', label: 'Konfigurasi Bobot & Nilai Akhir', desc: 'Bobot komponen penilaian, KKM, & predikat' },
      { name: 'ledger_finalisasi', label: 'Snapshot Finalisasi Rapor', desc: 'Nilai rapor terkunci & permanen per semester' },
      { name: 'school_settings', label: 'Pengaturan Data Sekolah', desc: 'Nama sekolah, instansi, alamat, & logo' },
      { name: 'profil_guru', label: 'Profil Guru & Kepala Sekolah', desc: 'Pejabat penandatangan laporan & NIP' },
      { name: 'jam_pelajaran_master', label: 'Master Jam Pelajaran (Per-JP)', desc: 'Slot jam per satuan JP & rentang waktu bel' },
      { name: 'jadwal_mengajar', label: 'Jadwal Mengajar Guru', desc: 'Jadwal rutin mingguan per kelas, mapel & hari' }
    ];

    const results = [];
    let existingCount = 0;
    let missingCount = 0;

    for (const t of tableDefs) {
      try {
        const { error } = await this.supabase.from(t.name).select('id').limit(1);
        if (error) {
          results.push({ ...t, exists: false, error: error.message });
          missingCount++;
        } else {
          results.push({ ...t, exists: true, error: null });
          existingCount++;
        }
      } catch (err) {
        results.push({ ...t, exists: false, error: err.message });
        missingCount++;
      }
    }

    // Check RPC function process_kenaikan_kelas_batch
    let rpcExists = false;
    try {
      const { error } = await this.supabase.rpc('process_kenaikan_kelas_batch', {
        p_mappings: [],
        p_source_academic_year: 'test',
        p_target_academic_year: 'test'
      });
      if (!error || !error.message?.includes('does not exist')) {
        rpcExists = true;
      }
    } catch {
      rpcExists = false;
    }

    return {
      isConnected: true,
      totalTables: tableDefs.length,
      existingCount,
      missingCount,
      isFullyInstalled: missingCount === 0 && rpcExists,
      rpcExists,
      tables: results
    };
  }

  // Inisialisasi Data Awal (Seed) Netral ke Supabase Cloud
  async seedInitialDatabase() {
    if (!this.isSupabaseConnected || !this.supabase) {
      return { success: false, message: 'Supabase belum terhubung.' };
    }

    try {
      // 1. Seed Mata Pelajaran dasar jika kosong
      const { data: existingMapel } = await this.supabase.from('mata_pelajaran').select('id').limit(1);
      if (!existingMapel || existingMapel.length === 0) {
        const defaultMapels = [
          { nama_mapel: 'Informatika', kategori: 'UMUM' },
          { nama_mapel: 'Matematika', kategori: 'UMUM' },
          { nama_mapel: 'Bahasa Indonesia', kategori: 'UMUM' },
          { nama_mapel: 'Bahasa Inggris', kategori: 'UMUM' },
          { nama_mapel: 'Pendidikan Pancasila', kategori: 'UMUM' },
          { nama_mapel: 'Koding dan Kecerdasan Artifisial', kategori: 'UMUM' },
          { nama_mapel: 'Konsentrasi Pilihan', kategori: 'PILIHAN' },
          { nama_mapel: 'Projek Kreatif dan Kewirausahaan', kategori: 'PILIHAN' }
        ];
        await this.supabase.from('mata_pelajaran').upsert(defaultMapels, { onConflict: 'nama_mapel' });
      }

      // 2. Seed School Settings jika kosong
      const { data: existingSchool } = await this.supabase.from('school_settings').select('id').limit(1);
      if (!existingSchool || existingSchool.length === 0) {
        const currentLocalSchool = this.getSchoolSettings();
        await this.supabase.from('school_settings').insert([{
          instansi_induk: currentLocalSchool.instansi_induk || 'Pemerintah Provinsi / Yayasan',
          dinas: currentLocalSchool.dinas || 'Dinas Pendidikan',
          nama_sekolah: currentLocalSchool.nama_sekolah || 'Nama Sekolah Anda',
          alamat: currentLocalSchool.alamat || 'Jl. Pendidikan No. 1',
          telepon: currentLocalSchool.telepon || '',
          website: currentLocalSchool.website || '',
          email: currentLocalSchool.email || '',
          logo_url: currentLocalSchool.logo_url || ''
        }]);
      }

      // 3. Seed Profil Guru jika belum ada untuk user saat ini
      const currentUser = await this.getCurrentUser();
      const currentUserId = currentUser?.id || null;
      if (currentUserId) {
        const { data: existingProfil } = await this.supabase
          .from('profil_guru')
          .select('id')
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!existingProfil) {
          const currentLocalProfil = this.getProfilGuru();
          await this.supabase.from('profil_guru').insert([{
            user_id: currentUserId,
            nama_guru: currentLocalProfil.nama_guru || currentUser.name || 'Guru Mata Pelajaran',
            nip_guru: currentLocalProfil.nip_guru || '',
            nama_sekolah: currentLocalProfil.nama_sekolah || 'Nama Sekolah Anda',
            nama_kepsek: currentLocalProfil.nama_kepsek || 'Kepala Sekolah',
            nip_kepsek: currentLocalProfil.nip_kepsek || '',
            kota: currentLocalProfil.kota || 'Kota',
            created_at: new Date().toISOString()
          }]);
        }
      }

      return { success: true, message: 'Data awal (seed) berhasil diinisialisasi ke Supabase Cloud!' };
    } catch (err) {
      return { success: false, message: `Gagal inisialisasi data awal: ${err.message}` };
    }
  }

  // ==========================================================================
  // DATA SEKOLAH & PROFIL GURU (CLOUD SYNC & MULTI-DEVICE SUPPORT)
  // ==========================================================================

  /**
   * Menyelaraskan Data Sekolah dan Profil Guru dari Supabase Cloud ke LocalStorage
   * Dipanggil saat inisialisasi aplikasi atau saat berpindah perangkat
   */
  async syncSchoolAndProfileFromSupabase() {
    if (!this.isSupabaseConnected || !this.supabase) return;
    try {
      const currentUser = await this.getCurrentUser();
      const currentUserId = currentUser?.id || null;

      const promises = [this.supabase.from('school_settings').select('*').limit(1)];
      if (currentUserId) {
        promises.push(this.supabase.from('profil_guru').select('*').eq('user_id', currentUserId).maybeSingle());
      }

      const [schoolRes, profilRes] = await Promise.all(promises);

      if (schoolRes && schoolRes.data && schoolRes.data.length > 0) {
        const s = schoolRes.data[0];
        const localSchool = {
          id: s.id,
          instansi_induk: s.instansi_induk || '',
          dinas: s.dinas || '',
          nama_sekolah: s.nama_sekolah || '',
          alamat: s.alamat || '',
          telepon: s.telepon || '',
          email: s.email || '',
          website: s.website || '',
          npsn: s.npsn || '',
          logo_url: s.logo_url || '',
          updatedAt: s.updated_at || new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(localSchool));
      }

      if (profilRes && profilRes.data && currentUserId) {
        const p = Array.isArray(profilRes.data) ? profilRes.data[0] : profilRes.data;
        if (p) {
          const localProfil = {
            id: p.id,
            user_id: p.user_id,
            nama_guru: p.nama_guru || '',
            nip_guru: p.nip_guru || '',
            nama_sekolah: p.nama_sekolah || '',
            nama_kepsek: p.nama_kepsek || '',
            nip_kepsek: p.nip_kepsek || '',
            kota: p.kota || '',
            updatedAt: p.updated_at || new Date().toISOString()
          };
          localStorage.setItem(`${STORAGE_KEYS.PROFIL_GURU}_${currentUserId}`, JSON.stringify(localProfil));
          this._setCache(`profil_guru_${currentUserId}`, localProfil);
        }
      }

      this._invalidateCache(['school_settings', ...(currentUserId ? [`profil_guru_${currentUserId}`] : [])]);
    } catch (e) {
      console.warn('Sync school settings & profile warning:', e);
    }
  }

  getSchoolSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHOOL_SETTINGS) || '{}');
      return {
        instansi_induk: s.instansi_induk !== undefined ? s.instansi_induk : 'Pemerintah Provinsi Sulawesi Selatan',
        dinas: s.dinas !== undefined ? s.dinas : 'Dinas Pendidikan',
        nama_sekolah: s.nama_sekolah !== undefined ? s.nama_sekolah : 'SMKN 1 Bantaeng',
        alamat: s.alamat !== undefined ? s.alamat : 'Jl. Pahlawan No. 12, Bantaeng',
        telepon: s.telepon !== undefined ? s.telepon : '(0413) 21088',
        email: s.email || '',
        website: s.website !== undefined ? s.website : 'smkn1bantaeng.sch.id',
        npsn: s.npsn || '',
        logo_url: s.logo_url || ''
      };
    } catch {
      return {
        instansi_induk: 'Pemerintah Provinsi Sulawesi Selatan',
        dinas: 'Dinas Pendidikan',
        nama_sekolah: 'SMKN 1 Bantaeng',
        alamat: 'Jl. Pahlawan No. 12, Bantaeng',
        telepon: '(0413) 21088',
        email: '',
        website: 'smkn1bantaeng.sch.id',
        npsn: '',
        logo_url: ''
      };
    }
  }

  async saveSchoolSettings(settings) {
    this._invalidateCache(['school_settings', 'profil_guru']);
    try {
      const current = this.getSchoolSettings();
      const updated = {
        ...current,
        ...settings,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(updated));

      // Sync nama_sekolah ke profil guru jika nama sekolah berubah
      const profil = this.getProfilGuru();
      if (updated.nama_sekolah && profil.nama_sekolah !== updated.nama_sekolah) {
        await this.saveProfilGuru({ ...profil, nama_sekolah: updated.nama_sekolah });
      }

      // Sync ke Supabase table school_settings jika terhubung
      if (this.isSupabaseConnected && this.supabase) {
        try {
          const { data: existing } = await this.supabase.from('school_settings').select('id').limit(1);
          const payload = {
            instansi_induk: updated.instansi_induk,
            dinas: updated.dinas,
            nama_sekolah: updated.nama_sekolah,
            alamat: updated.alamat,
            telepon: updated.telepon,
            email: updated.email,
            website: updated.website,
            npsn: updated.npsn,
            logo_url: updated.logo_url,
            updated_at: new Date().toISOString()
          };

          if (existing && existing.length > 0) {
            await this.supabase.from('school_settings').update(payload).eq('id', existing[0].id);
          } else {
            await this.supabase.from('school_settings').insert([{
              ...payload,
              created_at: new Date().toISOString()
            }]);
          }
        } catch (errSup) {
          console.warn('Supabase saveSchoolSettings sync warning:', errSup);
        }
      }

      this._invalidateCache(['school_settings', 'profil_guru']);
      return { success: true, message: 'Data sekolah berhasil disimpan!' };
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan data sekolah: ' + e.message };
    }
  }

  getProfilGuru() {
    const school = this.getSchoolSettings();
    let currentUserId = null;
    let userName = 'Ammar, S.Pd.';
    try {
      const localUser = localStorage.getItem('absen_local_auth_user');
      if (localUser) {
        const u = JSON.parse(localUser);
        currentUserId = u?.id || null;
        if (u?.name) userName = u.name;
      }
    } catch {}

    const defaultProfile = {
      user_id: currentUserId,
      nama_guru: userName,
      nip_guru: '',
      nama_sekolah: school?.nama_sekolah || 'SMKN 1 Bantaeng',
      nama_kepsek: school?.nama_kepsek || 'Drs. H. Syamsuddin, M.Pd.',
      nip_kepsek: school?.nip_kepsek || '',
      kota: school?.kota || 'Bantaeng'
    };

    if (!currentUserId) {
      return defaultProfile;
    }

    const cacheKey = `profil_guru_${currentUserId}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    try {
      const p = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.PROFIL_GURU}_${currentUserId}`) || 'null');
      if (p && (p.nama_guru || p.user_id === currentUserId)) {
        const res = {
          id: p.id,
          user_id: currentUserId,
          nama_guru: p.nama_guru || defaultProfile.nama_guru,
          nip_guru: p.nip_guru || '',
          nama_sekolah: p.nama_sekolah || defaultProfile.nama_sekolah,
          nama_kepsek: p.nama_kepsek || defaultProfile.nama_kepsek,
          nip_kepsek: p.nip_kepsek || defaultProfile.nip_kepsek,
          kota: p.kota || defaultProfile.kota
        };
        return this._setCache(cacheKey, res);
      }
    } catch {}

    return this._setCache(cacheKey, defaultProfile);
  }

  async saveProfilGuru(profil) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    this._invalidateCache([`profil_guru_${currentUserId}`]);
    const school = this.getSchoolSettings();
    try {
      const current = this.getProfilGuru();
      const updated = {
        ...current,
        ...profil,
        user_id: currentUserId,
        updatedAt: new Date().toISOString()
      };

      let savedRow = null;
      let supabaseError = null;

      // Sync ke Supabase table profil_guru jika terhubung
      if (this.isSupabaseConnected && this.supabase) {
        try {
          const { data: existing } = await this.supabase
            .from('profil_guru')
            .select('id')
            .eq('user_id', currentUserId)
            .maybeSingle();

          const existingRow = Array.isArray(existing) ? existing[0] : existing;

          const payload = {
            user_id: currentUserId,
            nama_guru: updated.nama_guru || currentUser.name || '',
            nip_guru: updated.nip_guru || '',
            nama_sekolah: updated.nama_sekolah || school?.nama_sekolah || '',
            nama_kepsek: updated.nama_kepsek || school?.nama_kepsek || '',
            nip_kepsek: updated.nip_kepsek || school?.nip_kepsek || '',
            kota: updated.kota || school?.kota || 'Bantaeng',
            updated_at: new Date().toISOString()
          };

          if (existingRow && existingRow.id) {
            const { data: updateRes, error: updateErr } = await this.supabase
              .from('profil_guru')
              .update(payload)
              .eq('id', existingRow.id)
              .eq('user_id', currentUserId)
              .select()
              .single();
            if (updateErr) throw updateErr;
            savedRow = updateRes;
          } else {
            const { data: insertRes, error: insertErr } = await this.supabase
              .from('profil_guru')
              .insert([{
                ...payload,
                created_at: new Date().toISOString()
              }])
              .select()
              .single();
            if (insertErr) throw insertErr;
            savedRow = insertRes;
          }
        } catch (errSup) {
          console.warn('Supabase saveProfilGuru sync warning:', errSup);
          supabaseError = errSup;
        }
      }

      const finalProfile = savedRow ? { ...updated, ...savedRow } : updated;
      localStorage.setItem(`${STORAGE_KEYS.PROFIL_GURU}_${currentUserId}`, JSON.stringify(finalProfile));
      this._setCache(`profil_guru_${currentUserId}`, finalProfile);

      if (supabaseError) {
        return { success: true, warning: 'Profil tersimpan di lokal (Supabase sync tertunda): ' + supabaseError.message };
      }
      return { success: true, message: 'Profil guru & tanda tangan berhasil disimpan!' };
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan profil: ' + e.message };
    }
  }

  // ==========================================================================
  // AUTENTIKASI & USER MANAGEMENT (AUTHORITATIVE ROLE INTEGRATION)
  // ==========================================================================
  async _getAuthProfile(userId) {
    if (!this.isSupabaseConnected || !this.supabase || !userId) {
      return { role: 'guru', full_name: null };
    }
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const validRole = data.role === 'admin' ? 'admin' : 'guru';
        return {
          id: data.id,
          email: data.email,
          full_name: data.full_name || null,
          role: validRole
        };
      }
    } catch (e) {
      console.warn('Fail-closed profile read error:', e);
    }
    return { role: 'guru', full_name: null };
  }

  async getCurrentUser() {
    // 1. Cek sesi Supabase jika terhubung (prioritas otoritatif)
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const userPromise = this.supabase.auth.getUser();
        const res = await Promise.race([userPromise, timeoutPromise]);
        if (res && res.data && res.data.user) {
          const authUser = res.data.user;
          const profile = await this._getAuthProfile(authUser.id);
          const authoritativeRole = profile.role === 'admin' ? 'admin' : 'guru';

          const user = {
            id: authUser.id,
            email: authUser.email,
            name: profile.full_name || authUser.user_metadata?.full_name || 'Muammar Qadafie',
            role: authoritativeRole,
            isCloud: true
          };
          localStorage.setItem('absen_local_auth_user', JSON.stringify(user));
          return user;
        }
      } catch (e) {
        console.warn('Check Supabase auth user:', e);
      }
    }

    // 2. Cek sesi lokal jika offline / Supabase tidak terhubung
    const localUser = localStorage.getItem('absen_local_auth_user');
    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        if (!this.isSupabaseConnected && parsed.role === 'admin') {
          parsed.role = 'guru'; // Fail-closed: tidak boleh offline admin
        }
        return parsed;
      } catch {
        // ignore
      }
    }

    return null;
  }

  async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPwd = (password || '').trim();

    if (!cleanPwd || cleanPwd.length < 3) {
      return { success: false, message: 'Kata sandi minimal 3 karakter.' };
    }

    // 1. Coba login via Supabase jika terhubung
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const authPromise = this.supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPwd
        });
        const res = await Promise.race([authPromise, timeoutPromise]);
        if (res && res.data && res.data.user && !res.error) {
          const authUser = res.data.user;
          const profile = await this._getAuthProfile(authUser.id);
          const authoritativeRole = profile.role === 'admin' ? 'admin' : 'guru';

          const user = {
            id: authUser.id,
            email: authUser.email,
            name: profile.full_name || authUser.user_metadata?.full_name || 'Muammar Qadafie',
            role: authoritativeRole,
            isCloud: true
          };
          localStorage.setItem('absen_local_auth_user', JSON.stringify(user));
          return { success: true, user, isCloud: true };
        }
      } catch (err) {
        console.warn('Supabase cloud login timeout / network warning, fallback to local login:', err);
      }
    }

    // 2. Hybrid Fallback: Login Berhasil Secara Otomatis (Offline/Lokal)
    const profil = this.getProfilGuru();
    const user = {
      id: 'guru-local-1',
      email: cleanEmail || 'guru@smkn1bantaeng.sch.id',
      name: profil.nama_guru || 'Muammar Qadafie',
      role: 'guru',
      isCloud: false
    };
    localStorage.setItem('absen_local_auth_user', JSON.stringify(user));
    return { success: true, user, isCloud: false };
  }

  async signup(email, password, fullName) {
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'guru'
          }
        }
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return {
        success: true,
        message: 'Pendaftaran akun berhasil! Silakan periksa email Anda jika konfirmasi email aktif, atau langsung masuk.',
        user: data.user
      };
    }
    return { success: false, message: 'Koneksi Supabase belum aktif.' };
  }

  async logout() {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
    localStorage.removeItem('absen_local_auth_user');
    this._cache.clear();
    this.invalidateJadwalMengajarCache();
    return { success: true };
  }

  // Sinkronisasi data lokal ke Supabase Cloud
  async syncLocalToCloud() {
    if (!this.isSupabaseConnected || !this.supabase) {
      return { success: false, message: 'Koneksi ke Supabase belum terhubung.' };
    }

    try {
      const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
      const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');

      // 1. Upload Kelas
      if (allKelas.length > 0) {
        const { error: errKelas } = await this.supabase.from('kelas').upsert(allKelas.map(k => ({
          id: k.id,
          nama_kelas: k.nama_kelas,
          tingkat: k.tingkat || 'X',
          jurusan: k.jurusan || null,
          jurusan_id: k.jurusan_id || null,
          academic_year: k.academic_year || '2026/2027',
          is_active: k.is_active !== undefined ? k.is_active : true
        })));
        if (errKelas) console.warn('Sync Kelas Warning:', errKelas.message);
      }

      // 2. Upload Siswa
      if (allSiswa.length > 0) {
        const { error: errSiswa } = await this.supabase.from('siswa').upsert(allSiswa.map(s => ({
          id: s.id,
          kelas_id: s.kelas_id,
          nama_lengkap: s.nama_lengkap,
          nisn: s.nisn || null,
          jenis_kelamin: s.jenis_kelamin || 'L',
          nomor_absen: s.nomor_absen || null
        })));
        if (errSiswa) console.warn('Sync Siswa Warning:', errSiswa.message);
      }

      return {
        success: true,
        message: `Sinkronisasi berhasil! ${allKelas.length} Kelas dan ${allSiswa.length} Siswa berhasil diunggah ke Cloud Supabase.`
      };
    } catch (err) {
      return { success: false, message: 'Gagal sinkronisasi data: ' + err.message };
    }
  }

  // ==========================================================================
  // HELPER GROUPING & SORTING TINGKAT KELAS (BAGIAN 3)
  // Mapping eksplisit tingkat kelas ke bobot angka: X=10, XI=11, XII=12, Lainnya=99
  // ==========================================================================
  groupAndSortKelas(kelasList) {
    if (!Array.isArray(kelasList)) return [];

    const getLevelWeight = (namaKelas, tingkat) => {
      const text = `${tingkat || ''} ${namaKelas || ''}`.toUpperCase();
      if (/\bXII\b/i.test(text) || text.startsWith('XII') || text.includes('KELAS 12') || text.includes('KELAS XII')) {
        return { level: 'Tingkat XII', weight: 12 };
      }
      if (/\bXI\b/i.test(text) || text.startsWith('XI') || text.includes('KELAS 11') || text.includes('KELAS XI')) {
        return { level: 'Tingkat XI', weight: 11 };
      }
      if (/\bX\b/i.test(text) || text.startsWith('X') || text.includes('KELAS 10') || text.includes('KELAS X')) {
        return { level: 'Tingkat X', weight: 10 };
      }
      return { level: 'Lainnya', weight: 99 };
    };

    const sorted = [...kelasList].sort((a, b) => {
      const weightA = getLevelWeight(a.nama_kelas, a.tingkat);
      const weightB = getLevelWeight(b.nama_kelas, b.tingkat);

      // 1. Urutkan berdasarkan bobot tingkat numerik (10 -> 11 -> 12 -> 99)
      if (weightA.weight !== weightB.weight) {
        return weightA.weight - weightB.weight;
      }

      // 2. Di dalam tingkat yang sama, urutkan alfanumerik (AKL 1, AKL 2, DKV 1, dst)
      return (a.nama_kelas || '').localeCompare(b.nama_kelas || '', 'id', { numeric: true, sensitivity: 'base' });
    });

    return sorted;
  }

  renderClassOptgroups(kelasList, selectedId = '', placeholder = null) {
    if (!kelasList || kelasList.length === 0) {
      return `<option value="" disabled selected>Belum ada kelas</option>`;
    }

    const groups = this.getGroupedKelasMap(kelasList);
    let html = '';
    if (placeholder) {
      html += `<option value="">${placeholder}</option>`;
    }

    const groupOrder = ['Tingkat X', 'Tingkat XI', 'Tingkat XII', 'Lainnya'];
    groupOrder.forEach(grpName => {
      const items = groups[grpName] || [];
      if (items.length > 0) {
        html += `<optgroup label="── ${grpName} ──">`;
        items.forEach(k => {
          const isSel = k.id === selectedId ? 'selected' : '';
          const jurusanDisplay = k.jurusan ? ` (${k.jurusan})` : '';
          html += `<option value="${k.id}" ${isSel}>${k.nama_kelas}${jurusanDisplay}</option>`;
        });
        html += `</optgroup>`;
      }
    });

    return html;
  }

  getGroupedKelasMap(kelasList) {
    const sorted = this.groupAndSortKelas(kelasList);
    const groups = {
      'Tingkat X': [],
      'Tingkat XI': [],
      'Tingkat XII': [],
      'Lainnya': []
    };

    sorted.forEach(k => {
      const text = `${k.tingkat || ''} ${k.nama_kelas || ''}`.toUpperCase();
      if (/\bXII\b/i.test(text) || text.startsWith('XII') || text.includes('KELAS 12') || text.includes('KELAS XII')) {
        groups['Tingkat XII'].push(k);
      } else if (/\bXI\b/i.test(text) || text.startsWith('XI') || text.includes('KELAS 11') || text.includes('KELAS XI')) {
        groups['Tingkat XI'].push(k);
      } else if (/\bX\b/i.test(text) || text.startsWith('X') || text.includes('KELAS 10') || text.includes('KELAS X')) {
        groups['Tingkat X'].push(k);
      } else {
        groups['Lainnya'].push(k);
      }
    });

    return groups;
  }

  // ==========================================================================
  // TAHUN AJARAN & KELAS PER TAHUN (BAGIAN 1 & BAGIAN 2)
  // ==========================================================================
  async getDistinctAcademicYears() {
    const cacheKey = 'academic_years';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let years = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kelas')
          .select('academic_year')
          .order('academic_year', { ascending: false });
        if (!error && data && data.length > 0) {
          years = [...new Set(data.map(d => d.academic_year).filter(Boolean))];
        }
      } catch (e) {
        console.warn('Supabase distinct academic_year fallback:', e);
      }
    }

    if (years.length === 0) {
      const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
      years = [...new Set(allKelas.map(k => k.academic_year || '2026/2027').filter(Boolean))];
    }

    if (!years.includes('2026/2027')) {
      years.push('2026/2027');
    }

    const sorted = years.sort().reverse();
    return this._setCache(cacheKey, sorted, 10 * 60 * 1000);
  }

  async getActiveAcademicYear() {
    const cacheKey = 'active_academic_year';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let activeYear = null;
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kelas')
          .select('academic_year')
          .eq('is_active', true)
          .limit(1);
        if (!error && data && data.length > 0 && data[0].academic_year) {
          activeYear = data[0].academic_year;
        }
      } catch (e) {
        console.warn('Supabase getActiveAcademicYear fallback:', e);
      }
    }

    if (!activeYear) {
      const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
      const activeKelas = allKelas.find(k => k.is_active === true && k.academic_year);
      if (activeKelas) activeYear = activeKelas.academic_year;
    }

    if (!activeYear) {
      const allYears = await this.getDistinctAcademicYears();
      activeYear = allYears[0] || '2026/2027';
    }

    return this._setCache(cacheKey, activeYear, 10 * 60 * 1000);
  }

  // Wrapper Query getClassesByYear (Bagian 1)
  async getClassesByYear(academicYear, onlyActive = false) {
    return this.getKelasByTahunAjaran(academicYear, onlyActive);
  }

  async getKelasByTahunAjaran(academicYear, onlyActive = false) {
    const cacheKey = `classes_${academicYear || 'all'}_active_${onlyActive}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase.from('kelas').select('*, jurusan_master:jurusan_id (id, nama, kode, is_active)');
        if (academicYear) query = query.eq('academic_year', academicYear);
        if (onlyActive) query = query.eq('is_active', true);
        query = query.order('nama_kelas');
        const { data, error } = await query;
        if (!error && data && data.length > 0) result = data;
      } catch (e) {
        console.warn('Supabase getKelasByTahunAjaran fallback:', e);
      }
    }

    if (result.length === 0) {
      let allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
      result = allKelas.filter(k => {
        const kYear = k.academic_year || '2026/2027';
        if (academicYear && kYear !== academicYear) return false;
        if (onlyActive && k.is_active === false) return false;
        return true;
      });

      // Enrich dengan jurusan_master jika jurusan_id ada
      const localJurusan = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
      const jurusanMap = new Map(localJurusan.map(j => [j.id, j]));
      result = result.map(k => {
        if (k.jurusan_id && !k.jurusan_master && jurusanMap.has(k.jurusan_id)) {
          const j = jurusanMap.get(k.jurusan_id);
          return {
            ...k,
            jurusan_master: {
              id: j.id,
              nama: j.nama,
              kode: j.kode || null,
              is_active: j.is_active !== false
            }
          };
        }
        return k;
      });
    }

    const grouped = this.groupAndSortKelas(result);
    return this._setCache(cacheKey, grouped);
  }

  // Wrapper Query getSessionsByYear (Bagian 1)
  async getSessionsByYear(academicYear) {
    return this.getAllSesiByYear(academicYear);
  }

  async getAllSesiByYear(academicYear) {
    return this.getAllSesi(academicYear);
  }

  async getKelas(academicYear) {
    if (academicYear) {
      return this.getKelasByTahunAjaran(academicYear);
    }
    const cacheKey = 'classes_all_master';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kelas')
          .select('*, jurusan_master:jurusan_id (id, nama, kode, is_active)')
          .order('nama_kelas');
        if (!error && data && data.length > 0) {
          const grouped = this.groupAndSortKelas(data);
          return this._setCache(cacheKey, grouped);
        }
      } catch (e) {
        console.warn('Supabase getKelas fallback:', e);
      }
    }
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    const localJurusan = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
    const jurusanMap = new Map(localJurusan.map(j => [j.id, j]));
    const enriched = raw.map(k => {
      if (k.jurusan_id && !k.jurusan_master && jurusanMap.has(k.jurusan_id)) {
        const j = jurusanMap.get(k.jurusan_id);
        return {
          ...k,
          jurusan_master: {
            id: j.id,
            nama: j.nama,
            kode: j.kode || null,
            is_active: j.is_active !== false
          }
        };
      }
      return k;
    });
    const grouped = this.groupAndSortKelas(enriched);
    return this._setCache(cacheKey, grouped);
  }

  // ==========================================================================
  // MASTER JURUSAN (CRUD & RELASI)
  // ==========================================================================

  /**
   * Mengambil daftar jurusan yang AKTIF dari master tabel public.jurusan
   * Digunakan untuk dropdown form dan data referensi aktif.
   * 100% dinamis, tanpa fallback hardcoded STANDARD_JURUSAN.
   */
  async getJurusanList() {
    const cacheKey = 'master_jurusan_list';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('jurusan')
          .select('*')
          .eq('is_active', true)
          .order('nama', { ascending: true });

        if (error) {
          console.error('Supabase getJurusanList error:', error);
          throw error;
        }
        if (data) {
          result = data;
        }
      } catch (e) {
        console.warn('Supabase getJurusanList fallback:', e);
        throw e;
      }
    } else {
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
      result = localData
        .filter(j => j.is_active !== false)
        .sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id', { numeric: true, sensitivity: 'base' }));
    }

    const formatted = result.map(j => ({
      id: j.id,
      nama: j.nama,
      kode: j.kode || null,
      code: j.kode || j.nama,
      label: j.kode ? `${j.kode} - ${j.nama}` : j.nama,
      is_active: j.is_active !== false
    }));

    return this._setCache(cacheKey, formatted);
  }

  /**
   * Mengambil SELURUH data jurusan (aktif dan non-aktif) untuk manajemen master di UI Admin
   */
  async getAllJurusan() {
    const cacheKey = 'master_jurusan_all';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('jurusan')
          .select('*')
          .order('nama', { ascending: true });

        if (error) {
          console.error('Supabase getAllJurusan error:', error);
          throw error;
        }
        if (data) {
          result = data;
        }
      } catch (e) {
        console.warn('Supabase getAllJurusan fallback:', e);
        throw e;
      }
    } else {
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
      result = localData.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id', { numeric: true, sensitivity: 'base' }));
    }

    const formatted = result.map(j => ({
      id: j.id,
      nama: j.nama,
      kode: j.kode || null,
      code: j.kode || j.nama,
      label: j.kode ? `${j.kode} - ${j.nama}` : j.nama,
      is_active: j.is_active !== false
    }));

    return this._setCache(cacheKey, formatted);
  }

  /**
   * Menambahkan jurusan baru ke master tabel public.jurusan
   */
  async addJurusan(jurusanData) {
    const nama = (jurusanData?.nama || '').trim();
    if (!nama) {
      throw new Error('Nama jurusan wajib diisi.');
    }
    const rawKode = (jurusanData?.kode || '').trim();
    const kode = rawKode ? rawKode.toUpperCase() : null;

    this._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);

    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('jurusan')
        .insert([{
          nama,
          kode,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase addJurusan error:', error);
        throw error;
      }
      this._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
      return {
        ...data,
        code: data.kode || data.nama,
        label: data.kode ? `${data.kode} - ${data.nama}` : data.nama
      };
    }

    // Local storage fallback / offline
    const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
    const newJurusan = {
      id: 'j-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nama,
      kode,
      is_active: true
    };
    localData.push(newJurusan);
    localStorage.setItem(STORAGE_KEYS.JURUSAN, JSON.stringify(localData));
    this._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
    return {
      ...newJurusan,
      code: newJurusan.kode || newJurusan.nama,
      label: newJurusan.kode ? `${newJurusan.kode} - ${newJurusan.nama}` : newJurusan.nama
    };
  }

  /**
   * Mengupdate data jurusan pada master public.jurusan
   * Jika nama diubah, sinkronkan juga string kelas.jurusan untuk integritas legacy.
   */
  async updateJurusan(id, updatedData) {
    if (!id) throw new Error('ID jurusan wajib diisi.');

    const payload = {};
    if (updatedData.nama !== undefined) {
      const nama = (updatedData.nama || '').trim();
      if (!nama) throw new Error('Nama jurusan tidak boleh kosong.');
      payload.nama = nama;
    }
    if (updatedData.kode !== undefined) {
      const rawKode = (updatedData.kode || '').trim();
      payload.kode = rawKode ? rawKode.toUpperCase() : null;
    }
    if (updatedData.is_active !== undefined) {
      payload.is_active = Boolean(updatedData.is_active);
    }

    this._invalidateCache(['master_jurusan_list', 'master_jurusan_all', 'classes_']);

    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('jurusan')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateJurusan error:', error);
        throw error;
      }

      // Jika nama berubah, update legacy string kelas.jurusan yang berelasi
      if (payload.nama) {
        try {
          await this.supabase
            .from('kelas')
            .update({ jurusan: payload.nama })
            .eq('jurusan_id', id);
        } catch (syncErr) {
          console.warn('Sync legacy kelas.jurusan error:', syncErr);
        }
      }

      this._invalidateCache(['master_jurusan_list', 'master_jurusan_all', 'classes_']);
      return {
        ...data,
        code: data.kode || data.nama,
        label: data.kode ? `${data.kode} - ${data.nama}` : data.nama
      };
    }

    // Local storage fallback
    let localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
    let updatedItem = null;
    localData = localData.map(j => {
      if (j.id === id) {
        updatedItem = { ...j, ...payload };
        return updatedItem;
      }
      return j;
    });
    localStorage.setItem(STORAGE_KEYS.JURUSAN, JSON.stringify(localData));

    if (payload.nama) {
      let localKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
      localKelas = localKelas.map(k => (k.jurusan_id === id ? { ...k, jurusan: payload.nama } : k));
      localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(localKelas));
    }

    this._invalidateCache(['master_jurusan_list', 'master_jurusan_all', 'classes_']);
    return updatedItem ? {
      ...updatedItem,
      code: updatedItem.kode || updatedItem.nama,
      label: updatedItem.kode ? `${updatedItem.kode} - ${updatedItem.nama}` : updatedItem.nama
    } : null;
  }

  /**
   * Soft-delete jurusan: menonaktifkan is_active = false jika tidak ada kelas yang menggunakannya.
   * Jika masih dipakai kelas, tolak dengan melempar error code 'JURUSAN_IN_USE'.
   */
  async deactivateJurusan(id) {
    if (!id) throw new Error('ID jurusan wajib diisi.');

    if (this.isSupabaseConnected && this.supabase) {
      // Cek apakah masih digunakan di tabel kelas
      const { count, error: countError } = await this.supabase
        .from('kelas')
        .select('*', { count: 'exact', head: true })
        .eq('jurusan_id', id);

      if (countError) {
        console.error('Supabase count kelas error:', countError);
        throw countError;
      }

      if (count && count > 0) {
        const err = new Error(`Jurusan tidak dapat dinonaktifkan karena sedang digunakan oleh ${count} kelas.`);
        err.code = 'JURUSAN_IN_USE';
        err.count = count;
        throw err;
      }

      const { data, error } = await this.supabase
        .from('jurusan')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase deactivateJurusan error:', error);
        throw error;
      }

      this._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
      return data;
    }

    // Local storage fallback
    const localKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    const inUseCount = localKelas.filter(k => k.jurusan_id === id).length;
    if (inUseCount > 0) {
      const err = new Error(`Jurusan tidak dapat dinonaktifkan karena sedang digunakan oleh ${inUseCount} kelas.`);
      err.code = 'JURUSAN_IN_USE';
      err.count = inUseCount;
      throw err;
    }

    let localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
    localData = localData.map(j => (j.id === id ? { ...j, is_active: false } : j));
    localStorage.setItem(STORAGE_KEYS.JURUSAN, JSON.stringify(localData));
    this._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
    return true;
  }

  /**
   * Mengaktifkan kembali jurusan yang sebelumnya dinonaktifkan (is_active = true)
   */
  async reactivateJurusan(id) {
    if (!id) throw new Error('ID jurusan wajib diisi.');

    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('jurusan')
        .update({ is_active: true })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase reactivateJurusan error:', error);
        throw error;
      }

      this._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
      return data;
    }

    let localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
    localData = localData.map(j => (j.id === id ? { ...j, is_active: true } : j));
    localStorage.setItem(STORAGE_KEYS.JURUSAN, JSON.stringify(localData));
    this._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
    return true;
  }

  /**
   * Alias soft-delete jurusan (menonaktifkan)
   */
  async deleteJurusan(id) {
    return this.deactivateJurusan(id);
  }

  async addKelas(kelasData) {
    this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);

    let finalJurusanId = null;
    let finalJurusanName = null;

    if (kelasData.jurusan_id) {
      try {
        const masterList = await this.getAllJurusan();
        const found = masterList.find(j => j.id === kelasData.jurusan_id);
        if (found) {
          finalJurusanId = found.id;
          finalJurusanName = found.nama;
        } else {
          finalJurusanId = kelasData.jurusan_id;
          finalJurusanName = kelasData.jurusan ? kelasData.jurusan.trim() : null;
        }
      } catch (e) {
        finalJurusanId = kelasData.jurusan_id;
        finalJurusanName = kelasData.jurusan ? kelasData.jurusan.trim() : null;
      }
    } else if (kelasData.jurusan && typeof kelasData.jurusan === 'string' && kelasData.jurusan.trim()) {
      const rawStr = kelasData.jurusan.trim();
      try {
        const masterList = await this.getAllJurusan();
        const found = masterList.find(j =>
          (j.nama && j.nama.toLowerCase() === rawStr.toLowerCase()) ||
          (j.kode && j.kode.toLowerCase() === rawStr.toLowerCase())
        );
        if (found) {
          finalJurusanId = found.id;
          finalJurusanName = found.nama;
        } else {
          finalJurusanId = null;
          finalJurusanName = rawStr;
        }
      } catch (e) {
        finalJurusanId = null;
        finalJurusanName = rawStr;
      }
    }

    const newKelas = {
      id: 'k-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nama_kelas: (kelasData.nama_kelas || '').trim(),
      tingkat: kelasData.tingkat || 'X',
      jurusan_id: finalJurusanId,
      jurusan: finalJurusanName,
      academic_year: (kelasData.academic_year || '2026/2027').trim(),
      is_active: kelasData.is_active !== false
    };

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kelas')
          .insert([{
            nama_kelas: newKelas.nama_kelas,
            tingkat: newKelas.tingkat,
            jurusan_id: newKelas.jurusan_id,
            jurusan: newKelas.jurusan,
            academic_year: newKelas.academic_year,
            is_active: newKelas.is_active
          }])
          .select('*, jurusan_master:jurusan_id (id, nama, kode, is_active)')
          .single();
        if (!error && data) {
          this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
          return data;
        }
        if (error) console.error('Supabase addKelas error:', error);
      } catch (err) {
        console.warn('Supabase addKelas catch:', err);
      }
    }

    const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    allKelas.push(newKelas);
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(allKelas));
    this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
    return newKelas;
  }

  async updateKelas(id, updatedData) {
    this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);

    const payload = { ...updatedData };

    if ('jurusan_id' in updatedData || 'jurusan' in updatedData) {
      if (updatedData.jurusan_id) {
        try {
          const masterList = await this.getAllJurusan();
          const found = masterList.find(j => j.id === updatedData.jurusan_id);
          if (found) {
            payload.jurusan_id = found.id;
            payload.jurusan = found.nama;
          }
        } catch (e) {
          // keep as is
        }
      } else if (updatedData.jurusan_id === null) {
        payload.jurusan_id = null;
        if (!('jurusan' in updatedData)) {
          payload.jurusan = null;
        }
      } else if (updatedData.jurusan && typeof updatedData.jurusan === 'string' && updatedData.jurusan.trim()) {
        const rawStr = updatedData.jurusan.trim();
        try {
          const masterList = await this.getAllJurusan();
          const found = masterList.find(j =>
            (j.nama && j.nama.toLowerCase() === rawStr.toLowerCase()) ||
            (j.kode && j.kode.toLowerCase() === rawStr.toLowerCase())
          );
          if (found) {
            payload.jurusan_id = found.id;
            payload.jurusan = found.nama;
          } else {
            payload.jurusan_id = null;
            payload.jurusan = rawStr;
          }
        } catch (e) {
          payload.jurusan_id = null;
          payload.jurusan = rawStr;
        }
      } else if (updatedData.jurusan === null || updatedData.jurusan === '') {
        payload.jurusan_id = null;
        payload.jurusan = null;
      }
    }

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kelas')
          .update(payload)
          .eq('id', id)
          .select('*, jurusan_master:jurusan_id (id, nama, kode, is_active)')
          .single();
        if (!error && data) {
          this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
          return data;
        }
      } catch (err) {
        console.warn('Supabase updateKelas catch:', err);
      }
    }

    let allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    allKelas = allKelas.map(k => (k.id === id ? { ...k, ...payload } : k));
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(allKelas));
    this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
    return true;
  }

  async deleteKelas(id) {
    this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase.from('kelas').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteKelas catch:', err);
      }
    }

    // Hapus kelas
    let allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    allKelas = allKelas.filter(k => k.id !== id);
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(allKelas));

    // Hapus juga siswa di kelas tersebut di local storage
    let allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa = allSiswa.filter(s => s.kelas_id !== id);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);

    return true;
  }

  // ==========================================================================
  // MASTER MATA PELAJARAN (CRUD)
  // ==========================================================================
  async getMataPelajaran() {
    const cacheKey = 'mapel_all';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('mata_pelajaran').select('*').order('nama_mapel');
        if (!error && data && data.length > 0) result = data;
      } catch (e) {
        console.warn('Supabase getMataPelajaran fallback:', e);
      }
    }

    if (!result) {
      let raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.MATA_PELAJARAN) || 'null');
      if (!raw || raw.length === 0) {
        const oldList = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAPEL_LIST) || '[]');
        if (oldList.length > 0) {
          raw = oldList.map((m, idx) => ({
            id: 'mp-' + (idx + 1),
            nama_mapel: typeof m === 'string' ? m : m.nama_mapel || 'Mapel',
            kode: (typeof m === 'string' ? m : m.kode || 'MPL').substring(0, 4).toUpperCase(),
            kategori: 'UMUM'
          }));
        } else {
          raw = INITIAL_DATA.mataPelajaran;
        }
        localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(raw));
      }
      result = raw;
    }

    if (result && Array.isArray(result)) {
      result = result.map(m => {
        const rawCat = (m.kategori || 'UMUM').toString().trim().toUpperCase();
        const isPilihan = rawCat === 'PILIHAN' || rawCat === 'KEJURUAN';
        return {
          ...m,
          kategori: isPilihan ? 'PILIHAN' : 'UMUM'
        };
      });
    }

    return this._setCache(cacheKey, result);
  }

  async getMapelList() {
    const list = await this.getMataPelajaran();
    return list.map(m => m.nama_mapel);
  }

  async addMataPelajaran(mapelData) {
    this._invalidateCache(['mapel_']);
    const rawCat = (mapelData.kategori || 'UMUM').toString().trim().toUpperCase();
    const isPilihan = rawCat === 'PILIHAN' || rawCat === 'KEJURUAN';
    const kategori = isPilihan ? 'PILIHAN' : 'UMUM';

    const newMapel = {
      id: 'mp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nama_mapel: mapelData.nama_mapel.trim(),
      kode: (mapelData.kode || '').trim().toUpperCase() || mapelData.nama_mapel.substring(0, 3).toUpperCase(),
      kategori
    };

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('mata_pelajaran').insert([{
          nama_mapel: newMapel.nama_mapel,
          kode: newMapel.kode,
          kategori: newMapel.kategori
        }]).select().single();
        if (!error && data) {
          this._invalidateCache(['mapel_']);
          return data;
        }
      } catch (e) {
        console.warn('Supabase addMataPelajaran error:', e);
      }
    }

    const list = await this.getMataPelajaran();
    list.push(newMapel);
    localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(list.map(m => m.nama_mapel)));
    this._invalidateCache(['mapel_']);
    return newMapel;
  }

  async updateMataPelajaran(id, updatedData) {
    this._invalidateCache(['mapel_']);
    const rawCat = (updatedData.kategori || 'UMUM').toString().trim().toUpperCase();
    const isPilihan = rawCat === 'PILIHAN' || rawCat === 'KEJURUAN';
    const kategori = isPilihan ? 'PILIHAN' : 'UMUM';

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('mata_pelajaran').update({
          nama_mapel: updatedData.nama_mapel.trim(),
          kode: (updatedData.kode || '').trim().toUpperCase(),
          kategori
        }).eq('id', id).select().single();
        if (!error && data) {
          this._invalidateCache(['mapel_']);
          return data;
        }
      } catch (e) {
        console.warn('Supabase updateMataPelajaran error:', e);
      }
    }

    let list = await this.getMataPelajaran();
    list = list.map(m => (m.id === id ? { ...m, ...updatedData, kategori } : m));
    localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(list.map(m => m.nama_mapel)));
    this._invalidateCache(['mapel_']);
    return true;
  }

  async deleteMataPelajaran(id) {
    this._invalidateCache(['mapel_']);
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase.from('mata_pelajaran').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase deleteMataPelajaran error:', e);
      }
    }

    let list = await this.getMataPelajaran();
    list = list.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(list.map(m => m.nama_mapel)));
    this._invalidateCache(['mapel_']);
    return true;
  }

  async addMapel(namaMapel) {
    return this.addMataPelajaran({ nama_mapel: namaMapel, kode: '', kategori: 'Umum' });
  }

  async deleteMapel(namaMapel) {
    const list = await this.getMataPelajaran();
    const item = list.find(m => m.nama_mapel === namaMapel);
    if (item) await this.deleteMataPelajaran(item.id);
    return this.getMapelList();
  }

  async getJamList() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.JAM_LIST) || '[]');
  }

  // ==========================================================================
  // DATA SISWA
  // ==========================================================================
  async getAllSiswa() {
    const cacheKey = 'siswa_all';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('siswa')
        .select('*')
        .order('nomor_absen', { ascending: true })
        .order('nama_lengkap', { ascending: true });
      if (!error && data) result = data;
    }

    if (!result) {
      result = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    }

    return this._setCache(cacheKey, result);
  }

  async getSiswaByKelas(kelasId, onlyActive = false) {
    const cacheKey = `siswa_kelas_${kelasId || 'none'}_active_${onlyActive}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.isSupabaseConnected && this.supabase) {
      let query = this.supabase
        .from('siswa')
        .select('*')
        .eq('kelas_id', kelasId);
      if (onlyActive) {
        query = query.or('is_active.eq.true,is_active.is.null');
      }
      query = query
        .order('nomor_absen', { ascending: true })
        .order('nama_lengkap', { ascending: true });
      const { data, error } = await query;
      if (!error && data) result = data;
    }

    if (!result) {
      const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
      result = allSiswa
        .filter(s => s.kelas_id === kelasId && (!onlyActive || s.is_active !== false))
        .sort((a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999) || a.nama_lengkap.localeCompare(b.nama_lengkap));
    }

    return this._setCache(cacheKey, result);
  }

  async addSiswa(siswaData) {
    this._invalidateCache(['siswa_']);
    const newSiswa = {
      id: 's-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      ...siswaData
    };

    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase.from('siswa').insert([siswaData]).select().single();
      if (!error && data) {
        this._invalidateCache(['siswa_']);
        return data;
      }
    }

    const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa.push(newSiswa);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this._invalidateCache(['siswa_']);
    return newSiswa;
  }

  async updateSiswa(id, updatedData) {
    this._invalidateCache(['siswa_']);
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase.from('siswa').update(updatedData).eq('id', id).select().single();
      if (!error && data) {
        this._invalidateCache(['siswa_']);
        return data;
      }
    }

    let allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa = allSiswa.map(s => (s.id === id ? { ...s, ...updatedData } : s));
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this._invalidateCache(['siswa_']);
    return true;
  }

  async deleteSiswa(id) {
    this._invalidateCache(['siswa_']);
    if (this.isSupabaseConnected && this.supabase) {
      await this.supabase.from('siswa').delete().eq('id', id);
    }
    let allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa = allSiswa.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this._invalidateCache(['siswa_']);
    return true;
  }

  async bulkImportSiswa(kelasId, namesList) {
    this._invalidateCache(['siswa_']);
    const currentSiswa = await this.getSiswaByKelas(kelasId);
    let currentMaxAbsen = currentSiswa.reduce((max, s) => Math.max(max, s.nomor_absen || 0), 0);

    const newEntries = namesList.map(item => {
      currentMaxAbsen++;
      return {
        id: 's-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        kelas_id: kelasId,
        nama_lengkap: typeof item === 'string' ? item.trim() : item.nama_lengkap,
        jenis_kelamin: (typeof item === 'object' && item.jenis_kelamin) ? item.jenis_kelamin : 'L',
        nomor_absen: (typeof item === 'object' && item.nomor_absen) ? item.nomor_absen : currentMaxAbsen,
        nisn: (typeof item === 'object' && item.nisn) ? item.nisn : ''
      };
    });

    if (this.isSupabaseConnected && this.supabase) {
      const { error } = await this.supabase.from('siswa').insert(newEntries.map(e => ({
        kelas_id: e.kelas_id,
        nama_lengkap: e.nama_lengkap,
        jenis_kelamin: e.jenis_kelamin,
        nomor_absen: e.nomor_absen,
        nisn: e.nisn
      })));
      if (error) console.error('Supabase import error:', error);
    }

    const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa.push(...newEntries);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this._invalidateCache(['siswa_']);
    return newEntries;
  }

  // ==========================================================================
  // KEGIATAN SISWA & BADGES
  // ==========================================================================
  async getKegiatanSiswaByTanggal(tanggal) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `kegiatan_tgl_${currentUserId}_${tanggal || 'none'}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('kegiatan_siswa')
        .select('*, siswa:siswa_id(nama_lengkap, kelas_id, nomor_absen)')
        .eq('user_id', currentUserId)
        .eq('tanggal', tanggal);
      if (!error && data) result = data;
    }

    if (!result) {
      const allKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
      const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');

      result = allKegiatan
        .filter(k => k.user_id === currentUserId && k.tanggal === tanggal)
        .map(k => {
          const s = allSiswa.find(x => x.id === k.siswa_id);
          return {
            ...k,
            siswa: s ? { nama_lengkap: s.nama_lengkap, kelas_id: s.kelas_id, nomor_absen: s.nomor_absen } : null
          };
        });
    }

    return this._setCache(cacheKey, result, 60000); // 1 min cache
  }

  async getAllKegiatanSiswa(academicYear) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `kegiatan_year_${currentUserId}_${academicYear || 'all'}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let rawData = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase
          .from('kegiatan_siswa')
          .select('*')
          .eq('user_id', currentUserId)
          .order('tanggal', { ascending: false });
        if (academicYear) {
          query = query.or(`academic_year.eq.${academicYear},academic_year.is.null`);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) rawData = data;
      } catch (e) {
        console.warn('Supabase getAllKegiatanSiswa fallback:', e);
      }
    }

    if (rawData.length === 0) {
      const allKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
      rawData = allKegiatan.filter(k => 
        k.user_id === currentUserId && 
        (!academicYear || !k.academic_year || k.academic_year === academicYear)
      );
    }

    let allSiswa = [];
    try {
      allSiswa = await this.getAllSiswa();
    } catch {
      allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    }

    const siswaMap = new Map(allSiswa.map(s => [s.id, s]));

    const result = rawData
      .map(k => {
        const s = siswaMap.get(k.siswa_id);
        return {
          ...k,
          siswa: s ? { nama_lengkap: s.nama_lengkap, kelas_id: s.kelas_id, nomor_absen: s.nomor_absen } : (k.siswa || null)
        };
      })
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return this._setCache(cacheKey, result, 60000);
  }

  async getKegiatanSiswaBySiswa(siswaId) {
    const list = await this.getAllKegiatanSiswa();
    return list.filter(k => k.siswa_id === siswaId);
  }

  async addKegiatanSiswa(kegiatanData) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) throw new Error('Pengguna tidak terautentikasi.');

    // Sanitasi payload: buang user_id bawaan jika ada, inject currentUserId
    const { user_id: _ignoredUserId, ...cleanPayload } = kegiatanData || {};

    const rawKategori = cleanPayload.kategori || 'Lainnya';
    let dbKategori = rawKategori;
    const k = rawKategori.toLowerCase();
    if (k.includes('positif') || k.includes('prestasi')) dbKategori = 'Catatan Positif';
    else if (k.includes('pelanggaran') || k.includes('perilaku') || k.includes('disiplin')) dbKategori = 'Pelanggaran';
    else if (k.includes('izin') || k.includes('dinas')) dbKategori = 'Izin Khusus';
    else if (dbKategori !== 'Catatan Positif' && dbKategori !== 'Pelanggaran' && dbKategori !== 'Izin Khusus' && dbKategori !== 'Lainnya') dbKategori = 'Lainnya';

    const payload = {
      ...cleanPayload,
      kategori: dbKategori,
      user_id: currentUserId,
      academic_year: cleanPayload.academic_year || (await this.getActiveAcademicYear())
    };

    let newItem = {
      id: 'act-' + Date.now(),
      created_at: new Date().toISOString(),
      ...payload
    };

    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('kegiatan_siswa')
        .insert([payload])
        .select()
        .single();
      if (!error && data) {
        newItem = data;
      } else if (error) {
        console.error('Supabase addKegiatanSiswa error:', error);
      }
    }

    const allKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
    allKegiatan.unshift(newItem);
    localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(allKegiatan));
    this._invalidateCache([
      `kegiatan_tgl_${currentUserId}_`,
      `kegiatan_year_${currentUserId}_`
    ]);
    return newItem;
  }

  async deleteKegiatanSiswa(id) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return false;

    let deletedSuccessfully = false;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kegiatan_siswa')
          .delete()
          .eq('id', id)
          .eq('user_id', currentUserId)
          .select('id');

        if (!error && data && data.length > 0) {
          deletedSuccessfully = true;
        } else if (error) {
          console.error('Supabase deleteKegiatanSiswa error:', error);
          return false;
        }
      } catch (e) {
        console.error('Supabase deleteKegiatanSiswa error:', e);
        return false;
      }
    } else {
      // Offline mode
      deletedSuccessfully = true;
    }

    if (deletedSuccessfully) {
      let allKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
      allKegiatan = allKegiatan.filter(k => !(k.id === id && k.user_id === currentUserId));
      localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(allKegiatan));
      this._invalidateCache([
        `kegiatan_tgl_${currentUserId}_`,
        `kegiatan_year_${currentUserId}_`
      ]);
      return true;
    }

    return false;
  }

  // ==========================================================================
  // CATATAN CEKLIS SISWA (BENTUK CEKLIS ABSEN PER SISWA HARI ITU)
  // ==========================================================================
  async getAllChecklist(academicYear) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `checklist_${currentUserId}_${academicYear || 'all'}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let list = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let q = this.supabase
          .from('catatan_checklist')
          .select('*')
          .eq('user_id', currentUserId)
          .order('tanggal', { ascending: false });
        if (academicYear) {
          q = q.or(`academic_year.eq.${academicYear},academic_year.is.null`);
        }
        let { data, error } = await q;
        if (!error && data && data.length > 0) {
          list = data;
        }
      } catch (e) {
        console.warn('Supabase getAllChecklist fallback:', e);
      }
    }
    if (list.length === 0) {
      const allLocal = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]');
      list = allLocal.filter(c => c.user_id === currentUserId);
      if (academicYear) {
        list = list.filter(c => !c.academic_year || c.academic_year === academicYear);
      }
    }
    const allKelas = await this.getKelas(academicYear);
    const result = list.map(c => {
      const foundKelas = allKelas.find(k => k.id === c.kelas_id || k.nama_kelas === c.kelas_id);
      const isNoCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
      return {
        ...c,
        judul_catatan: c.judul_catatan || c.teks || 'Ceklis Catatan / Tugas Harian',
        is_no_catatan: isNoCatatan,
        bebas_catatan: isNoCatatan,
        kelas: foundKelas || {
          id: c.kelas_id,
          nama_kelas: c.kelas_nama || (c.kelas_id && !c.kelas_id.startsWith('k-') && !c.kelas_id.includes('-') ? c.kelas_id : 'Kelas')
        }
      };
    }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return this._setCache(cacheKey, result, 60000);
  }

  async getChecklistById(id) {
    const list = await this.getAllChecklist();
    return list.find(c => c.id === id) || null;
  }

  async getChecklistHariIni(tanggal, academicYear = null) {
    const list = await this.getAllChecklist(academicYear);
    return list.filter(c => c.tanggal === tanggal);
  }

  async getChecklistByKelasAndTanggal(kelasId, tanggal) {
    const list = await this.getAllChecklist();
    return list.filter(c => (c.kelas_id === kelasId || c.kelas?.id === kelasId) && c.tanggal === tanggal);
  }

  async saveChecklist(data) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan', savedLocally: false };
    }

    this._invalidateCache([`checklist_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    let id = data.id;
    const isDbUUID = isValidUUID(id);
    const currentYear = data.academic_year || await this.getActiveAcademicYear();
    const allKelas = await this.getKelas(currentYear);
    const targetKelas = allKelas.find(k => k.id === data.kelas_id || k.nama_kelas === data.kelas_id);
    const kelasNama = targetKelas?.nama_kelas || data.kelas_nama || data.kelas_id || 'Kelas';
    const isNoCatatan = data.is_no_catatan === true || data.is_no_catatan === 'true' || data.bebas_catatan === true || data.bebas_catatan === 'true';

    const payload = {
      kelas_id: targetKelas?.id || data.kelas_id,
      mapel: data.mapel,
      tanggal: data.tanggal,
      judul_catatan: (data.judul_catatan || 'Ceklis Catatan / Tugas Harian').trim(),
      teks: (data.judul_catatan || 'Ceklis Catatan / Tugas Harian').trim(),
      is_no_catatan: isNoCatatan,
      bebas_catatan: isNoCatatan,
      daftar_ceklis: data.daftar_ceklis || [],
      academic_year: currentYear,
      is_active: true,
      updated_at: timestamp
    };

    let supabaseError = null;
    let savedFromSupabase = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (isDbUUID) {
          // UPDATE: Guard .eq('user_id', currentUserId)
          let { data: updatedData, error: err1 } = await this.supabase
            .from('catatan_checklist')
            .update(payload)
            .eq('id', id)
            .eq('user_id', currentUserId)
            .select()
            .maybeSingle();

          if (err1) {
            supabaseError = err1;
          } else if (!updatedData) {
            supabaseError = new Error('Data tidak ditemukan atau Anda tidak memiliki izin untuk mengedit catatan ini');
          } else {
            savedFromSupabase = updatedData;
          }
        } else {
          // CREATE: Set user_id from auth
          let { data: insertedData, error: err1 } = await this.supabase
            .from('catatan_checklist')
            .insert([{ ...payload, user_id: currentUserId, created_at: timestamp }])
            .select()
            .single();

          if (err1) {
            supabaseError = err1;
          } else {
            savedFromSupabase = insertedData;
          }
        }
      } catch (e) {
        supabaseError = e;
      }
    }

    if (savedFromSupabase && savedFromSupabase.id) {
      id = savedFromSupabase.id;
    } else if (!id) {
      id = 'chk-' + Date.now();
    }

    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]');
    const localEntry = savedFromSupabase || {
      id,
      ...payload,
      user_id: currentUserId,
      kelas_nama: kelasNama,
      created_at: timestamp
    };

    // Sinkronisasi LocalStorage: hanya update jika milik user yang sama
    list = list.filter(c => !(c.id === id && c.user_id === currentUserId));
    list.unshift(localEntry);
    localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(list));
    this._invalidateCache([`checklist_${currentUserId}_`]);

    if (supabaseError) {
      console.error('Gagal menyimpan Catatan Ceklis ke Supabase:', supabaseError);
      return {
        success: false,
        error: supabaseError.message || String(supabaseError),
        id,
        savedLocally: !isDbUUID || (savedFromSupabase !== null)
      };
    }

    return { success: true, id };
  }

  async deleteChecklist(id) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return false;

    this._invalidateCache([`checklist_${currentUserId}_`]);
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase
          .from('catatan_checklist')
          .delete()
          .eq('id', id)
          .eq('user_id', currentUserId);
      } catch (e) {
        console.warn('Supabase deleteChecklist error:', e);
      }
    }
    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]');
    list = list.filter(c => !(c.id === id && c.user_id === currentUserId));
    localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(list));
    this._invalidateCache([`checklist_${currentUserId}_`]);
    return true;
  }

  // ==========================================================================
  // NILAI TUGAS (BENTUK NILAI SEDERHANA PER SISWA)
  // ==========================================================================
  async getAllNilaiTugas(academicYear) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `nilai_${currentUserId}_${academicYear || 'all'}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let list = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let q = this.supabase
          .from('nilai_tugas')
          .select('*')
          .eq('user_id', currentUserId)
          .order('tanggal', { ascending: false });
        if (academicYear) {
          q = q.or(`academic_year.eq.${academicYear},academic_year.is.null`);
        }
        const { data, error } = await q;
        if (!error && data && data.length > 0) list = data;
      } catch (e) {
        console.warn('Supabase getAllNilaiTugas fallback:', e);
      }
    }
    if (list.length === 0) {
      const allLocal = JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]');
      list = allLocal.filter(nt => nt.user_id === currentUserId);
      if (academicYear) {
        list = list.filter(nt => !nt.academic_year || nt.academic_year === academicYear);
      }
    }
    const allKelas = await this.getKelas(academicYear);
    const result = list.map(nt => {
      const foundKelas = allKelas.find(k => k.id === nt.kelas_id || k.nama_kelas === nt.kelas_id);
      return {
        ...nt,
        kelas: foundKelas || {
          id: nt.kelas_id,
          nama_kelas: nt.kelas_nama || (nt.kelas_id && !nt.kelas_id.startsWith('nt-') && !nt.kelas_id.includes('-') ? nt.kelas_id : 'Kelas')
        }
      };
    }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return this._setCache(cacheKey, result, 60000);
  }

  async getNilaiTugasById(id) {
    const list = await this.getAllNilaiTugas();
    return list.find(nt => nt.id === id) || null;
  }

  async getNilaiTugasHariIni(tanggal, academicYear = null) {
    const list = await this.getAllNilaiTugas(academicYear);
    return list.filter(nt => nt.tanggal === tanggal);
  }

  async saveNilaiTugas(data) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan', savedLocally: false };
    }

    this._invalidateCache([`nilai_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    let id = data.id;
    const isDbUUID = isValidUUID(id);
    const currentYear = data.academic_year || await this.getActiveAcademicYear();
    const allKelas = await this.getKelas(currentYear);
    const targetKelas = allKelas.find(k => k.id === data.kelas_id || k.nama_kelas === data.kelas_id);
    const kelasNama = targetKelas?.nama_kelas || data.kelas_nama || data.kelas_id || 'Kelas';

    const payload = {
      kelas_id: targetKelas?.id || data.kelas_id,
      mapel: data.mapel,
      tanggal: data.tanggal,
      judul_tugas: data.judul_tugas.trim(),
      kkm: parseInt(data.kkm) || 75,
      is_no_tugas: data.is_no_tugas === true || data.is_no_tugas === 'true',
      daftar_nilai: data.daftar_nilai || [],
      is_kelompok: data.is_kelompok === true || data.is_kelompok === 'true',
      tipe_tugas: data.tipe_tugas || (data.is_kelompok ? 'kelompok' : 'individu'),
      academic_year: currentYear,
      updated_at: timestamp
    };

    let supabaseError = null;
    let savedFromSupabase = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (isDbUUID) {
          // UPDATE: Guard .eq('user_id', currentUserId)
          const { data: updatedData, error } = await this.supabase
            .from('nilai_tugas')
            .update(payload)
            .eq('id', id)
            .eq('user_id', currentUserId)
            .select()
            .maybeSingle();

          if (error) {
            supabaseError = error;
          } else if (!updatedData) {
            supabaseError = new Error('Data tidak ditemukan atau Anda tidak memiliki izin untuk mengedit tugas ini');
          } else {
            savedFromSupabase = updatedData;
          }
        } else {
          // CREATE: Set user_id from auth
          const { data: insertedData, error } = await this.supabase
            .from('nilai_tugas')
            .insert([{ ...payload, user_id: currentUserId, created_at: timestamp }])
            .select()
            .single();

          if (error) {
            supabaseError = error;
          } else {
            savedFromSupabase = insertedData;
          }
        }
      } catch (e) {
        supabaseError = e;
      }
    }

    if (savedFromSupabase && savedFromSupabase.id) {
      id = savedFromSupabase.id;
    } else if (!id) {
      id = 'nt-' + Date.now();
    }

    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]');
    const localEntry = savedFromSupabase || {
      id,
      ...payload,
      user_id: currentUserId,
      kelas_nama: kelasNama,
      created_at: timestamp
    };

    // Sinkronisasi LocalStorage: hanya update jika milik user yang sama
    list = list.filter(nt => !(nt.id === id && nt.user_id === currentUserId));
    list.unshift(localEntry);
    localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(list));
    this._invalidateCache([`nilai_${currentUserId}_`]);

    if (supabaseError) {
      console.error('Gagal menyimpan Nilai Tugas ke Supabase:', supabaseError);
      return {
        success: false,
        error: supabaseError.message || String(supabaseError),
        id,
        savedLocally: !isDbUUID || (savedFromSupabase !== null)
      };
    }

    return { success: true, id };
  }

  async deleteNilaiTugas(id) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return false;

    this._invalidateCache([`nilai_${currentUserId}_`]);
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase
          .from('nilai_tugas')
          .delete()
          .eq('id', id)
          .eq('user_id', currentUserId);
      } catch (e) {
        console.warn('Supabase deleteNilaiTugas error:', e);
      }
    }
    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]');
    list = list.filter(nt => !(nt.id === id && nt.user_id === currentUserId));
    localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(list));
    this._invalidateCache([`nilai_${currentUserId}_`]);
    return true;
  }

  // ==========================================================================
  // PEKERJAAN RUMAH (PR) - MASTER TUGAS & NILAI SISWA (2 TAHAP: PEMBERIAN & PEMERIKSAAN)
  // ==========================================================================

  /**
   * Mengambil daftar PR dengan filter status, kelas_id, dan academic_year (Strict Per-User)
   */
  async getPRList({ status, kelas_id, academic_year } = {}) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const activeYear = academic_year || await this.getActiveAcademicYear();
    const cacheKey = `pr_list_${currentUserId}_${status || 'all'}_${kelas_id || 'all'}_${activeYear || 'all'}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase
          .from('pr_tugas')
          .select(`
            *,
            kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year),
            mata_pelajaran:mapel_id (id, nama_mapel, kode, kategori),
            pr_nilai_siswa (*)
          `)
          .eq('user_id', currentUserId)
          .order('tanggal_diberikan', { ascending: false })
          .order('created_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }
        if (kelas_id) {
          query = query.eq('kelas_id', kelas_id);
        }
        if (activeYear) {
          query = query.eq('academic_year', activeYear);
        }

        const { data, error } = await query;
        if (!error && data) result = data;
      } catch (e) {
        console.warn('Supabase getPRList fallback:', e);
      }
    }

    if (!result) {
      // Fallback Local Storage: strict p.user_id === currentUserId
      const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
      const allNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
      const allKelas = await this.getKelas(activeYear);
      const allMapel = await this.getMataPelajaran();

      const kelasMap = new Map(allKelas.map(k => [k.id, k]));
      const mapelMap = new Map(allMapel.map(m => [m.id, m]));

      let filtered = allPR.filter(p => p.user_id === currentUserId).map(pr => {
        const k = kelasMap.get(pr.kelas_id) || null;
        const m = pr.mapel_id ? mapelMap.get(pr.mapel_id) : null;
        const nilaiRows = allNilai.filter(n => n.pr_tugas_id === pr.id);
        return {
          ...pr,
          kelas: k,
          mata_pelajaran: m,
          pr_nilai_siswa: (Array.isArray(pr.pr_nilai_siswa) && pr.pr_nilai_siswa.length > 0) ? pr.pr_nilai_siswa : nilaiRows
        };
      });

      if (status) {
        filtered = filtered.filter(p => p.status === status);
      }
      if (kelas_id) {
        filtered = filtered.filter(p => p.kelas_id === kelas_id);
      }
      if (activeYear) {
        filtered = filtered.filter(p => {
          if (p.academic_year) return p.academic_year === activeYear;
          return p.kelas?.academic_year === activeYear;
        });
      }

      result = filtered.sort((a, b) => new Date(b.tanggal_diberikan) - new Date(a.tanggal_diberikan));
    }

    return this._setCache(cacheKey, result, 60000);
  }

  /**
   * Mengambil detail lengkap 1 data PR beserta seluruh baris nilai siswa (Strict Per-User)
   */
  async getPRDetail(prId) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !prId) return null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('pr_tugas')
          .select(`
            *,
            kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year),
            mata_pelajaran:mapel_id (id, nama_mapel, kode, kategori),
            pr_nilai_siswa (
              id,
              siswa_id,
              nilai,
              mengumpulkan,
              tanggal_diperiksa,
              catatan,
              siswa:siswa_id (id, nama_lengkap, nomor_absen, jenis_kelamin, nisn)
            )
          `)
          .eq('id', prId)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!error && data) {
          if (Array.isArray(data.pr_nilai_siswa)) {
            data.pr_nilai_siswa.sort((a, b) => {
              const noA = a.siswa?.nomor_absen || 999;
              const noB = b.siswa?.nomor_absen || 999;
              return noA - noB;
            });
          }
          return data;
        }
      } catch (e) {
        console.warn('Supabase getPRDetail fallback:', e);
      }
    }

    // Fallback Local Storage (Strict Parent Ownership)
    const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const pr = allPR.find(p => p.id === prId && p.user_id === currentUserId);
    if (!pr) return null;

    const allKelas = await this.getKelas();
    const allMapel = await this.getMataPelajaran();
    const allSiswa = await this.getSiswaByKelas(pr.kelas_id);
    const allNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');

    const kelas = allKelas.find(k => k.id === pr.kelas_id) || null;
    const mapel = pr.mapel_id ? allMapel.find(m => m.id === pr.mapel_id) : null;
    const nilaiRows = allNilai.filter(n => n.pr_tugas_id === pr.id).map(n => {
      const s = allSiswa.find(x => x.id === n.siswa_id) || null;
      return {
        ...n,
        siswa: s
      };
    }).sort((a, b) => (a.siswa?.nomor_absen || 999) - (b.siswa?.nomor_absen || 999));

    return {
      ...pr,
      kelas,
      mata_pelajaran: mapel,
      pr_nilai_siswa: nilaiRows
    };
  }

  /**
   * Membuat penugasan PR baru dan otomatis meng-generate baris awal pr_nilai_siswa (Strict Per-User)
   */
  async createPR(data) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    this._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    const currentYear = data.academic_year || await this.getActiveAcademicYear();

    const payload = {
      kelas_id: data.kelas_id,
      mapel_id: data.mapel_id || null,
      topik: (data.topik || '').trim(),
      tanggal_diberikan: data.tanggal_diberikan || new Date().toISOString().split('T')[0],
      status: 'menunggu',
      academic_year: currentYear,
      user_id: currentUserId,
      updated_at: timestamp
    };

    let prId = data.id || ('pr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4));
    let supabaseError = null;
    let isPartialFailure = false;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data: insertedPR, error: prErr } = await this.supabase
          .from('pr_tugas')
          .insert([{ ...payload, created_at: timestamp }])
          .select()
          .single();

        if (prErr) throw prErr;
        prId = insertedPR.id;

        // Ambil seluruh siswa aktif di kelas tersebut
        const activeStudents = await this.getSiswaByKelas(data.kelas_id, true);
        if (activeStudents && activeStudents.length > 0) {
          const initialNilaiRows = activeStudents.map(s => ({
            pr_tugas_id: prId,
            siswa_id: s.id,
            nilai: null,
            mengumpulkan: true,
            created_at: timestamp,
            updated_at: timestamp
          }));

          const { error: childErr } = await this.supabase.from('pr_nilai_siswa').insert(initialNilaiRows);
          if (childErr) {
            isPartialFailure = true;
            supabaseError = new Error('Penugasan PR berhasil dibuat, tetapi gagal menginisialisasi daftar siswa: ' + childErr.message);
          }
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase createPR error:', e);
      }
    }

    // Simpan ke Cache Offline LocalStorage
    const localPREntry = { id: prId, ...payload, created_at: timestamp };
    let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    prList = prList.filter(p => !(p.id === prId && p.user_id === currentUserId));
    prList.unshift(localPREntry);
    localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));

    // Generate baris nilai lokal
    const activeStudents = await this.getSiswaByKelas(data.kelas_id, true);
    let allPRNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
    allPRNilai = allPRNilai.filter(n => n.pr_tugas_id !== prId);
    const localNilaiRows = activeStudents.map(s => ({
      id: 'prn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      pr_tugas_id: prId,
      siswa_id: s.id,
      nilai: null,
      mengumpulkan: true,
      tanggal_diperiksa: null,
      catatan: null,
      created_at: timestamp,
      updated_at: timestamp
    }));
    allPRNilai.push(...localNilaiRows);
    localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(allPRNilai));
    this._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);

    if (supabaseError) {
      return {
        success: false,
        id: prId,
        partial: isPartialFailure,
        error: supabaseError.message || String(supabaseError)
      };
    }

    return { success: true, id: prId };
  }

  /**
   * Submit hasil pemeriksaan nilai PR per siswa dan ubah status pr_tugas jadi 'selesai_diperiksa' (Strict Per-User)
   */
  async submitPemeriksaanPR(prId, { items = [], tanggal_diperiksa } = {}) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !prId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    this._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    const checkDate = tanggal_diperiksa || timestamp;
    let supabaseError = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        // 1. Update status pr_tugas (Guarded by user_id)
        const { data: updatedPR, error: prErr } = await this.supabase
          .from('pr_tugas')
          .update({
            status: 'selesai_diperiksa',
            updated_at: timestamp
          })
          .eq('id', prId)
          .eq('user_id', currentUserId)
          .select()
          .maybeSingle();

        if (prErr) {
          throw prErr;
        }
        if (!updatedPR) {
          throw new Error('Penugasan PR tidak ditemukan atau Anda tidak memiliki izin untuk mengedit PR ini.');
        }

        // 2. Upsert masing-masing baris nilai siswa (Hanya setelah parent tervalidasi)
        for (const item of items) {
          const payload = {
            pr_tugas_id: prId,
            siswa_id: item.siswa_id,
            nilai: item.mengumpulkan === false ? null : (item.nilai !== null && item.nilai !== '' && !isNaN(item.nilai) ? Number(item.nilai) : null),
            mengumpulkan: item.mengumpulkan !== false,
            tanggal_diperiksa: checkDate,
            catatan: (item.catatan || '').trim() || null,
            updated_at: timestamp
          };

          if (item.id && isValidUUID(item.id)) {
            await this.supabase.from('pr_nilai_siswa').update(payload).eq('id', item.id);
          } else {
            await this.supabase.from('pr_nilai_siswa').upsert([payload], { onConflict: 'pr_tugas_id, siswa_id' });
          }
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase submitPemeriksaanPR error:', e);
      }
    }

    // Update LocalStorage: Pastikan parent milik user aktif
    let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const targetPR = prList.find(p => p.id === prId && p.user_id === currentUserId);
    if (targetPR) {
      targetPR.status = 'selesai_diperiksa';
      targetPR.updated_at = timestamp;
      localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));

      let allPRNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
      for (const item of items) {
        const existingIdx = allPRNilai.findIndex(n => n.pr_tugas_id === prId && n.siswa_id === item.siswa_id);
        const updatedRow = {
          id: item.id || (existingIdx >= 0 ? allPRNilai[existingIdx].id : ('prn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6))),
          pr_tugas_id: prId,
          siswa_id: item.siswa_id,
          nilai: item.mengumpulkan === false ? null : (item.nilai !== null && item.nilai !== '' && !isNaN(item.nilai) ? Number(item.nilai) : null),
          mengumpulkan: item.mengumpulkan !== false,
          tanggal_diperiksa: checkDate,
          catatan: (item.catatan || '').trim() || null,
          updated_at: timestamp
        };

        if (existingIdx >= 0) {
          allPRNilai[existingIdx] = updatedRow;
        } else {
          allPRNilai.push(updatedRow);
        }
      }
      localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(allPRNilai));
    }
    this._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, error: supabaseError.message || String(supabaseError) };
    }

    return { success: true };
  }

  /**
   * Hapus penugasan PR dan seluruh detail nilainya (Strict Per-User)
   */
  async deletePR(prId) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !prId) return false;

    this._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    let deleteSuccess = true;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('pr_tugas')
          .delete()
          .eq('id', prId)
          .eq('user_id', currentUserId);

        if (error) {
          console.warn('Supabase deletePR error:', error);
          deleteSuccess = false;
        }
      } catch (e) {
        console.warn('Supabase deletePR exception:', e);
        deleteSuccess = false;
      }
    }

    if (deleteSuccess) {
      let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
      prList = prList.filter(p => !(p.id === prId && p.user_id === currentUserId));
      localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));

      let allPRNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
      allPRNilai = allPRNilai.filter(n => n.pr_tugas_id !== prId);
      localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(allPRNilai));
      this._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    }

    return deleteSuccess;
  }

  /**
   * Menghitung jumlah PR dengan status 'menunggu' untuk badge notifikasi sidebar (Strict Per-User)
   */
  async getPendingPRCount(academicYear) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return 0;

    const activeYear = academicYear || await this.getActiveAcademicYear();
    const cacheKey = `pr_pending_count_${currentUserId}_${activeYear || 'all'}`;
    const cached = this._getCache(cacheKey);
    if (cached !== null) return cached;

    let countResult = null;
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase
          .from('pr_tugas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', currentUserId)
          .eq('status', 'menunggu');

        if (activeYear) {
          query = query.eq('academic_year', activeYear);
        }

        const { count, error } = await query;
        if (!error && count !== null) countResult = count;
      } catch (e) {
        console.warn('Supabase getPendingPRCount fallback:', e);
      }
    }

    if (countResult === null) {
      const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
      const allKelas = await this.getKelas(activeYear);
      const kelasMap = new Map(allKelas.map(k => [k.id, k]));

      const pending = allPR.filter(pr => {
        if (pr.user_id !== currentUserId) return false;
        if (pr.status !== 'menunggu') return false;
        if (!activeYear) return true;
        if (pr.academic_year === activeYear) return true;
        const k = kelasMap.get(pr.kelas_id);
        return k && k.academic_year === activeYear;
      });

      countResult = pending.length;
    }

    return this._setCache(cacheKey, countResult, 60000);
  }

  /**
   * Mengambil riwayat PR untuk satu siswa tertentu (untuk Rekap Per Siswa)
   */
  async getRekapPRBySiswa(siswaId, academicYear) {
    const activeYear = academicYear || await this.getActiveAcademicYear();
    const prList = await this.getPRList({ academic_year: activeYear });

    const results = [];
    for (const pr of prList) {
      const studentRow = (pr.pr_nilai_siswa || []).find(n => n.siswa_id === siswaId);
      if (studentRow) {
        results.push({
          pr_id: pr.id,
          topik: pr.topik,
          tanggal_diberikan: pr.tanggal_diberikan,
          status_pr: pr.status,
          mapel: pr.mata_pelajaran?.nama_mapel || 'Mapel Tidak Diketahui',
          mapel_kode: pr.mata_pelajaran?.kode || 'MPL',
          kelas: pr.kelas?.nama_kelas || 'Kelas',
          nilai: studentRow.nilai,
          mengumpulkan: studentRow.mengumpulkan !== false,
          tanggal_diperiksa: studentRow.tanggal_diperiksa,
          catatan: studentRow.catatan
        });
      }
    }

    return results;
  }

  // ==========================================================================
  // FITUR KELOMPOK BELAJAR (MASTER DATA & TUGAS KELOMPOK)
  // ==========================================================================

  /**
   * Mengambil daftar kelompok beserta anggota siswanya per Kelas + Mapel + Tahun Ajaran (Strict Per-User)
   */
  async getKelompokList({ kelas_id, mapel_id, mapel, academic_year } = {}) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const activeYear = academic_year || await this.getActiveAcademicYear();

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId && mapel) {
      const allMapel = await this.getMataPelajaran();
      const m = allMapel.find(x => x.nama_mapel === mapel);
      if (m) resolvedMapelId = m.id;
    }

    const cacheKey = `kelompok_list_${currentUserId}_${kelas_id || 'all'}_${resolvedMapelId || mapel || 'all'}_${activeYear || 'all'}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase
          .from('kelompok_belajar')
          .select(`
            *,
            kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year),
            mata_pelajaran:mapel_id (id, nama_mapel, kode),
            kelompok_anggota (
              id,
              siswa_id,
              siswa:siswa_id (id, nama_lengkap, nomor_absen, jenis_kelamin, nisn)
            )
          `)
          .eq('user_id', currentUserId)
          .order('nama_kelompok', { ascending: true });

        if (kelas_id) query = query.eq('kelas_id', kelas_id);
        if (resolvedMapelId) query = query.eq('mapel_id', resolvedMapelId);
        if (activeYear) query = query.eq('academic_year', activeYear);

        const { data, error } = await query;
        if (!error && data) {
          result = data.map(k => ({
            ...k,
            mapel: k.mata_pelajaran?.nama_mapel || k.mapel || '',
            anggota: (k.kelompok_anggota || []).map(a => a.siswa || { id: a.siswa_id }).sort((a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999))
          }));
        }
      } catch (e) {
        console.warn('Supabase getKelompokList fallback:', e);
      }
    }

    if (!result) {
      // Fallback Local Storage: strict k.user_id === currentUserId
      const allKelompok = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK) || '[]');
      const allAnggota = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK_ANGGOTA) || '[]');
      const allSiswa = await this.getAllSiswa();
      const allKelas = await this.getKelas(activeYear);
      const allMapel = await this.getMataPelajaran();

      const siswaMap = new Map(allSiswa.map(s => [s.id, s]));
      const kelasMap = new Map(allKelas.map(k => [k.id, k]));
      const mapelMap = new Map(allMapel.map(m => [m.id, m]));

      const userKelompok = allKelompok.filter(k => k.user_id === currentUserId);
      const userKelompokIds = new Set(userKelompok.map(k => k.id));

      let filtered = userKelompok.map(k => {
        const kObj = kelasMap.get(k.kelas_id) || null;
        const mObj = k.mapel_id ? mapelMap.get(k.mapel_id) : (allMapel.find(m => m.nama_mapel === k.mapel) || null);
        const anggotaRows = allAnggota.filter(a => userKelompokIds.has(a.kelompok_id) && a.kelompok_id === k.id);
        const anggotaList = anggotaRows.map(a => siswaMap.get(a.siswa_id) || { id: a.siswa_id, nama_lengkap: 'Siswa' })
          .sort((a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999));

        return {
          ...k,
          kelas: kObj,
          mata_pelajaran: mObj,
          mapel: mObj?.nama_mapel || k.mapel || '',
          anggota: anggotaList,
          kelompok_anggota: anggotaRows
        };
      });

      if (kelas_id) filtered = filtered.filter(k => k.kelas_id === kelas_id);
      if (resolvedMapelId) filtered = filtered.filter(k => k.mapel_id === resolvedMapelId || (k.mata_pelajaran && k.mata_pelajaran.id === resolvedMapelId));
      if (mapel && !resolvedMapelId) filtered = filtered.filter(k => k.mapel === mapel || (k.mata_pelajaran && k.mata_pelajaran.nama_mapel === mapel));
      if (activeYear) filtered = filtered.filter(k => k.academic_year === activeYear);

      result = filtered.sort((a, b) => (a.nama_kelompok || '').localeCompare(b.nama_kelompok || '', undefined, { numeric: true }));
    }

    return this._setCache(cacheKey, result, 60000);
  }

  /**
   * Menyimpan / membuat kelompok baru (Strict Per-User & Mandatory mapel_id)
   */
  async saveKelompok(data) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    let mapelId = data.mapel_id || null;
    let mapelNama = data.mapel || '';
    if (!mapelId && mapelNama) {
      const allMapel = await this.getMataPelajaran();
      const m = allMapel.find(x => x.nama_mapel === mapelNama);
      if (m) mapelId = m.id;
    }

    if (!mapelId) {
      return { success: false, error: 'Validasi gagal: Mata Pelajaran (mapel_id) wajib dipilih untuk membuat kelompok belajar.' };
    }

    this._invalidateCache([`kelompok_list_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    const activeYear = data.academic_year || await this.getActiveAcademicYear();

    const payload = {
      kelas_id: data.kelas_id,
      mapel_id: mapelId,
      nama_kelompok: (data.nama_kelompok || '').trim(),
      deskripsi: (data.deskripsi || '').trim(),
      academic_year: activeYear,
      user_id: currentUserId,
      updated_at: timestamp
    };

    let kelompokId = data.id || ('kel-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5));
    let supabaseError = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (data.id && isValidUUID(data.id)) {
          // UPDATE: Guard .eq('id', data.id).eq('user_id', currentUserId)
          const { data: updated, error } = await this.supabase
            .from('kelompok_belajar')
            .update({
              kelas_id: payload.kelas_id,
              mapel_id: payload.mapel_id,
              nama_kelompok: payload.nama_kelompok,
              deskripsi: payload.deskripsi,
              academic_year: payload.academic_year,
              updated_at: timestamp
            })
            .eq('id', data.id)
            .eq('user_id', currentUserId)
            .select()
            .maybeSingle();

          if (error) throw error;
          if (!updated) throw new Error('Kelompok tidak ditemukan atau Anda tidak memiliki izin untuk mengedit kelompok ini.');
        } else {
          // CREATE: Injeksi user_id = currentUserId
          const { data: created, error } = await this.supabase
            .from('kelompok_belajar')
            .insert([{ ...payload, created_at: timestamp }])
            .select()
            .single();

          if (error) throw error;
          if (created) kelompokId = created.id;
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase saveKelompok error:', e);
      }
    }

    // LocalStorage Sync: strict user_id === currentUserId
    let allKelompok = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK) || '[]');
    const existingIdx = allKelompok.findIndex(k => k.id === kelompokId && k.user_id === currentUserId);
    const localEntry = { id: kelompokId, mapel: mapelNama, ...payload, created_at: timestamp };

    if (existingIdx >= 0) {
      allKelompok[existingIdx] = localEntry;
    } else {
      allKelompok.push(localEntry);
    }
    localStorage.setItem(STORAGE_KEYS.KELOMPOK, JSON.stringify(allKelompok));
    this._invalidateCache([`kelompok_list_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, id: kelompokId, error: supabaseError.message || String(supabaseError) };
    }

    return { success: true, id: kelompokId };
  }

  /**
   * Menghapus 1 data kelompok dan seluruh anggotanya (Strict Per-User)
   */
  async deleteKelompok(kelompokId) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelompokId) return false;

    this._invalidateCache([`kelompok_list_${currentUserId}_`]);
    let deleteSuccess = true;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('kelompok_belajar')
          .delete()
          .eq('id', kelompokId)
          .eq('user_id', currentUserId);

        if (error) {
          console.warn('Supabase deleteKelompok error:', error);
          deleteSuccess = false;
        }
      } catch (e) {
        console.warn('Supabase deleteKelompok error:', e);
        deleteSuccess = false;
      }
    }

    if (deleteSuccess) {
      let allKelompok = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK) || '[]');
      allKelompok = allKelompok.filter(k => !(k.id === kelompokId && k.user_id === currentUserId));
      localStorage.setItem(STORAGE_KEYS.KELOMPOK, JSON.stringify(allKelompok));

      let allAnggota = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK_ANGGOTA) || '[]');
      allAnggota = allAnggota.filter(a => a.kelompok_id !== kelompokId);
      localStorage.setItem(STORAGE_KEYS.KELOMPOK_ANGGOTA, JSON.stringify(allAnggota));
      this._invalidateCache([`kelompok_list_${currentUserId}_`]);
    }

    return deleteSuccess;
  }

  /**
   * Menambahkan siswa ke dalam kelompok (Strict Parent Ownership & Mandatory mapel_id)
   */
  async addAnggotaKelompok({ kelompok_id, siswa_id, kelas_id, mapel_id, academic_year }) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelompok_id || !siswa_id) {
      return { success: false, error: 'Autentikasi gagal atau parameter tidak lengkap' };
    }

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId) {
      return { success: false, error: 'Validasi gagal: mapel_id wajib disertakan untuk menambahkan anggota kelompok.' };
    }

    this._invalidateCache([`kelompok_list_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    const activeYear = academic_year || await this.getActiveAcademicYear();
    let supabaseError = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        // 1. Verifikasi kepemilikan parent (kelompok_belajar.user_id === currentUserId)
        const { data: parent, error: parentErr } = await this.supabase
          .from('kelompok_belajar')
          .select('id, mapel_id')
          .eq('id', kelompok_id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (parentErr) throw parentErr;
        if (!parent) {
          throw new Error('Kelompok belajar tidak ditemukan atau Anda tidak memiliki izin untuk mengelola kelompok ini.');
        }

        // 2. Hapus keanggotaan lama siswa di mapel & kelas ini
        const { error: delError } = await this.supabase
          .from('kelompok_anggota')
          .delete()
          .eq('siswa_id', siswa_id)
          .eq('kelas_id', kelas_id)
          .eq('mapel_id', resolvedMapelId)
          .eq('academic_year', activeYear);

        if (delError) throw delError;

        // 3. Insert keanggotaan baru
        const { error: insError } = await this.supabase.from('kelompok_anggota').insert([{
          kelompok_id,
          siswa_id,
          kelas_id,
          mapel_id: resolvedMapelId,
          academic_year: activeYear,
          created_at: timestamp
        }]);

        if (insError) throw insError;
      } catch (e) {
        supabaseError = e;
        console.error('Supabase addAnggotaKelompok error:', e);
      }
    }

    if (!supabaseError) {
      let allAnggota = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK_ANGGOTA) || '[]');
      allAnggota = allAnggota.filter(a => {
        const matchSiswa = a.siswa_id === siswa_id;
        const matchKelas = a.kelas_id === kelas_id;
        const matchMapel = a.mapel_id === resolvedMapelId;
        const matchYear = !activeYear || a.academic_year === activeYear;
        return !(matchSiswa && matchKelas && matchMapel && matchYear);
      });

      allAnggota.push({
        id: 'ka-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        kelompok_id,
        siswa_id,
        kelas_id,
        mapel_id: resolvedMapelId,
        academic_year: activeYear,
        created_at: timestamp
      });
      localStorage.setItem(STORAGE_KEYS.KELOMPOK_ANGGOTA, JSON.stringify(allAnggota));
    }

    this._invalidateCache([`kelompok_list_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, error: supabaseError.message || String(supabaseError) };
    }

    return { success: true };
  }

  /**
   * Menghapus siswa dari anggota kelompok (Strict Parent Ownership)
   */
  async removeAnggotaKelompok(kelompokId, siswaId) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelompokId || !siswaId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    this._invalidateCache([`kelompok_list_${currentUserId}_`]);
    let supabaseError = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        // 1. Verifikasi kepemilikan parent sebelum delete child
        const { data: parent, error: parentErr } = await this.supabase
          .from('kelompok_belajar')
          .select('id')
          .eq('id', kelompokId)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (parentErr) throw parentErr;
        if (!parent) {
          throw new Error('Kelompok belajar tidak ditemukan atau Anda tidak memiliki izin untuk mengedit kelompok ini.');
        }

        // 2. Hapus relasi keanggotaan
        const { error } = await this.supabase
          .from('kelompok_anggota')
          .delete()
          .eq('kelompok_id', kelompokId)
          .eq('siswa_id', siswaId);

        if (error) throw error;
      } catch (e) {
        supabaseError = e;
        console.warn('Supabase removeAnggotaKelompok error:', e);
      }
    }

    if (!supabaseError) {
      let allAnggota = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK_ANGGOTA) || '[]');
      allAnggota = allAnggota.filter(a => !(a.kelompok_id === kelompokId && a.siswa_id === siswaId));
      localStorage.setItem(STORAGE_KEYS.KELOMPOK_ANGGOTA, JSON.stringify(allAnggota));
    }

    this._invalidateCache([`kelompok_list_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, error: supabaseError.message || String(supabaseError) };
    }
    return { success: true };
  }

  /**
   * Mengambil daftar siswa yang BELUM masuk kelompok manapun pada kombinasi Kelas + Mapel aktif (Strict Per-User)
   */
  async getSiswaBelumBerkelompok(kelasId, mapelId, academicYear) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelasId) return [];

    let resolvedMapelId = mapelId || null;
    if (!resolvedMapelId) return []; // Fail-closed jika mapel_id kosong

    const activeYear = academicYear || await this.getActiveAcademicYear();
    const [allStudents, kelompokList] = await Promise.all([
      this.getSiswaByKelas(kelasId, true),
      this.getKelompokList({ kelas_id: kelasId, mapel_id: resolvedMapelId, academic_year: activeYear })
    ]);

    const assignedSiswaIds = new Set();
    kelompokList.forEach(k => {
      (k.anggota || []).forEach(a => {
        if (a && a.id) assignedSiswaIds.add(a.id);
      });
    });

    return allStudents.filter(s => !assignedSiswaIds.has(s.id));
  }

  /**
   * Membuat pembagian kelompok secara otomatis (Acak / Berimbang)
   * Strategi Aman: Pre-Validation -> Memory Snapshot -> Scoped Delete -> Controlled Creation -> Best-Effort Recovery
   */
  async generateKelompokOtomatis({ kelas_id, mapel_id, mapel, jumlah_kelompok = 4, format_nama = 'Kelompok {N}', academic_year }) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    let resolvedMapelId = mapel_id || null;
    let resolvedMapelNama = mapel || '';
    if (!resolvedMapelId && resolvedMapelNama) {
      const allMapel = await this.getMataPelajaran();
      const m = allMapel.find(x => x.nama_mapel === resolvedMapelNama);
      if (m) resolvedMapelId = m.id;
    }

    // A. Pre-validation: mapel_id WAJIB
    if (!resolvedMapelId) {
      return { success: false, message: 'Validasi gagal: Mata Pelajaran (mapel_id) wajib dipilih untuk pembagian kelompok otomatis.' };
    }

    this._invalidateCache([`kelompok_list_${currentUserId}_`, 'siswa_']);
    const activeYear = academic_year || await this.getActiveAcademicYear();

    const allStudents = await this.getSiswaByKelas(kelas_id, true);
    if (!allStudents || allStudents.length === 0) {
      return { success: false, message: 'Tidak ada siswa aktif di kelas ini' };
    }

    // B. Snapshot Memory: Ambil data lama HANYA milik current user untuk kelas+mapel+tahun ini
    let oldUserGroupsSnapshot = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data: oldGroups } = await this.supabase
          .from('kelompok_belajar')
          .select('*, kelompok_anggota(*)')
          .eq('kelas_id', kelas_id)
          .eq('mapel_id', resolvedMapelId)
          .eq('academic_year', activeYear)
          .eq('user_id', currentUserId);

        if (Array.isArray(oldGroups)) {
          oldUserGroupsSnapshot = oldGroups;
        }
      } catch (snapErr) {
        console.warn('Snapshot error:', snapErr);
      }
    }

    const n = Math.max(1, Math.min(jumlah_kelompok, allStudents.length));
    const shuffled = [...allStudents].sort(() => Math.random() - 0.5);

    let recreateError = null;
    const createdKelompok = [];

    // C. Scoped Delete: Hapus HANYA kelompok milik current user di Supabase
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase
          .from('kelompok_belajar')
          .delete()
          .eq('kelas_id', kelas_id)
          .eq('mapel_id', resolvedMapelId)
          .eq('academic_year', activeYear)
          .eq('user_id', currentUserId);
      } catch (delErr) {
        console.warn('Scoped delete error:', delErr);
      }
    }

    // D. Controlled Recreate: Buat N kelompok baru dengan user_id = currentUserId
    try {
      for (let i = 1; i <= n; i++) {
        const nama = (format_nama || 'Kelompok {N}').replace('{N}', i);
        const res = await this.saveKelompok({
          kelas_id,
          mapel_id: resolvedMapelId,
          mapel: resolvedMapelNama,
          nama_kelompok: nama,
          academic_year: activeYear
        });
        if (res.success) {
          createdKelompok.push({ id: res.id, nama_kelompok: nama });
        } else {
          throw new Error(res.error || `Gagal membuat parent ${nama}`);
        }
      }

      // Bagikan seluruh siswa secara modulo round-robin
      for (let i = 0; i < shuffled.length; i++) {
        const targetKel = createdKelompok[i % createdKelompok.length];
        const s = shuffled[i];
        const addRes = await this.addAnggotaKelompok({
          kelompok_id: targetKel.id,
          siswa_id: s.id,
          kelas_id,
          mapel_id: resolvedMapelId,
          academic_year: activeYear
        });
        if (!addRes.success) {
          throw new Error(`Siswa ${s.nama_lengkap}: ${addRes.error}`);
        }
      }
    } catch (createErr) {
      recreateError = createErr;
      console.error('Recreate error in generateKelompokOtomatis:', createErr);
    }

    // E. Partial Failure & Best-Effort Recovery
    if (recreateError) {
      let isRecovered = false;
      if (oldUserGroupsSnapshot.length > 0 && this.isSupabaseConnected && this.supabase) {
        try {
          // Bersihkan kelompok parsial yang sempat dibuat
          for (const k of createdKelompok) {
            await this.deleteKelompok(k.id);
          }

          // Restore snapshot lama
          for (const oldG of oldUserGroupsSnapshot) {
            const { data: restoredG } = await this.supabase
              .from('kelompok_belajar')
              .insert([{
                kelas_id: oldG.kelas_id,
                mapel_id: oldG.mapel_id,
                nama_kelompok: oldG.nama_kelompok,
                deskripsi: oldG.deskripsi,
                academic_year: oldG.academic_year,
                user_id: currentUserId,
                created_at: oldG.created_at,
                updated_at: new Date().toISOString()
              }])
              .select()
              .single();

            if (restoredG && Array.isArray(oldG.kelompok_anggota)) {
              for (const oldA of oldG.kelompok_anggota) {
                await this.supabase.from('kelompok_anggota').insert([{
                  kelompok_id: restoredG.id,
                  siswa_id: oldA.siswa_id,
                  kelas_id: oldA.kelas_id,
                  mapel_id: oldA.mapel_id,
                  academic_year: oldA.academic_year,
                  created_at: oldA.created_at
                }]);
              }
            }
          }
          isRecovered = true;
        } catch (recErr) {
          console.error('Best-effort recovery failed:', recErr);
          isRecovered = false;
        }
      }

      this._invalidateCache([`kelompok_list_${currentUserId}_`, 'siswa_']);
      return {
        success: false,
        partial: true,
        recovered: isRecovered,
        message: `Gagal membuat susunan kelompok: ${recreateError.message}. ${isRecovered ? 'Susunan kelompok lama berhasil dipulihkan.' : 'Susunan kelompok lama belum dapat dipulihkan.'}`
      };
    }

    this._invalidateCache([`kelompok_list_${currentUserId}_`, 'siswa_']);

    return {
      success: true,
      count: createdKelompok.length,
      students: allStudents.length,
      message: `Berhasil membagikan ${allStudents.length} siswa ke dalam ${createdKelompok.length} kelompok secara merata.`
    };
  }

  /**
   * Mengambil daftar tugas kelompok tersimpan
   */
  async getTugasKelompokList({ kelas_id, mapel, academic_year } = {}) {
    const activeYear = academic_year || await this.getActiveAcademicYear();
    const allNilai = await this.getAllNilaiTugas(activeYear);
    let filtered = allNilai.filter(n => n.is_kelompok === true || n.tipe_tugas === 'kelompok');
    if (kelas_id) filtered = filtered.filter(n => n.kelas_id === kelas_id);
    if (mapel) filtered = filtered.filter(n => n.mapel === mapel);
    return filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }

  /**
   * Mengambil riwayat nilai tugas kelompok untuk satu siswa tertentu (untuk Rekap Per Siswa)
   */
  async getRekapTugasKelompokBySiswa(siswaId, academicYear) {
    const activeYear = academicYear || await this.getActiveAcademicYear();
    const cacheKey = `rekap_tugas_kelompok_${siswaId}_${activeYear}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    const allNilai = await this.getAllNilaiTugas(activeYear);
    const tugasKelompokList = allNilai.filter(n => n.is_kelompok === true || n.tipe_tugas === 'kelompok');

    const results = [];
    for (const t of tugasKelompokList) {
      const studentGrade = (t.daftar_nilai || []).find(d => d.siswa_id === siswaId);
      if (studentGrade) {
        const valNum = (studentGrade.nilai !== '' && studentGrade.nilai !== null && studentGrade.nilai !== undefined && !isNaN(parseInt(studentGrade.nilai)))
          ? parseInt(studentGrade.nilai)
          : null;
        const kkm = t.kkm || 75;
        const isTuntas = valNum !== null ? valNum >= kkm : null;

        let status = 'Belum Dinilai';
        if (valNum !== null) {
          status = isTuntas ? 'Tuntas' : 'Remedi';
        }

        results.push({
          id: t.id,
          judul_tugas: t.judul_tugas || 'Tugas Kelompok',
          tanggal: t.tanggal || '-',
          mapel: t.mapel || 'Mata Pelajaran',
          kelas_id: t.kelas_id,
          kkm,
          kelompok_id: studentGrade.kelompok_id || null,
          nama_kelompok: studentGrade.nama_kelompok || 'Kelompok',
          nilai: valNum,
          isTuntas,
          status,
          catatan: studentGrade.catatan || ''
        });
      }
    }

    results.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    return this._setCache(cacheKey, results);
  }

  /**
   * Menyimpan nilai tugas kelompok
   */
  async saveTugasKelompok(data) {
    this._invalidateCache(['nilai_', 'kelompok_']);
    return this.saveNilaiTugas({
      ...data,
      is_kelompok: true,
      tipe_tugas: 'kelompok'
    });
  }

  /**
   * Menghapus tugas kelompok
   */
  async deleteTugasKelompok(tugasId) {
    this._invalidateCache(['nilai_', 'kelompok_']);
    return this.deleteNilaiTugas(tugasId);
  }

  // ==========================================================================
  // SESI MENGAJAR & ABSENSI & JURNAL
  // ==========================================================================
  async findSesi(kelasId, mapel, tanggal) {
    // Dapatkan identitas user aktif (Fail-Closed)
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        // Query Cloud: strict per user_id + kelas_id + mapel + tanggal
        const { data, error } = await this.supabase
          .from('sesi_mengajar')
          .select('*, absensi(*), jurnal_mengajar(*)')
          .eq('user_id', currentUserId)
          .eq('kelas_id', kelasId)
          .eq('mapel', mapel)
          .eq('tanggal', tanggal)
          .maybeSingle();

        if (!error && data) {
          if (!data.absensi || data.absensi.length === 0) {
            const { data: directAbs } = await this.supabase
              .from('absensi').select('*').eq('sesi_id', data.id);
            if (directAbs && directAbs.length > 0) {
              data.absensi = directAbs;
            } else {
              const allAbs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
              data.absensi = allAbs.filter(a => a.sesi_id === data.id);
            }
          }
          return data;
        }
      } catch (e) {
        console.warn('findSesi Supabase query error:', e);
      }
    }

    // Fallback LocalStorage: strict per-user matching
    const allSesi = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI) || '[]');
    const matchingSesi = allSesi.find(s =>
      s.user_id === currentUserId &&
      s.kelas_id === kelasId &&
      s.mapel === mapel &&
      s.tanggal === tanggal
    );
    if (!matchingSesi) return null;

    const allAbsensi = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    const allJurnal  = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL)   || '[]');

    return {
      ...matchingSesi,
      absensi:         allAbsensi.filter(a => a.sesi_id === matchingSesi.id),
      jurnal_mengajar: allJurnal.find(j => j.sesi_id === matchingSesi.id) || null
    };
  }

  async getAttendanceMapByKelasAndTanggal(kelasId, tanggal, mapel = null) {
    if (!kelasId || !tanggal) return {};

    // Jika mapel tidak tersedia, tidak bisa menentukan sesi dengan aman
    // (satu guru bisa punya dua mapel berbeda di kelas + tanggal yang sama)
    if (!mapel) return {};

    // findSesi sudah strict per user_id (Step 5C) — delegate sepenuhnya
    const targetSesi = await this.findSesi(kelasId, mapel, tanggal);

    const attMap = {};
    if (targetSesi?.absensi?.length > 0) {
      targetSesi.absensi.forEach(a => {
        attMap[a.siswa_id] = {
          status:  a.status  || 'Hadir',
          catatan: a.catatan || ''
        };
      });
    }
    return attMap;
  }

  async getAllSesi(academicYear = null) {
    // 1. Fail-Closed: Hanya tampilkan sesi jika user teridentifikasi
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    // 2. Cache key per user agar data tidak bocor antar sesi login
    const cacheKey = `sesi_year_${currentUserId}_${academicYear || 'all'}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let data = null;
    if (this.isSupabaseConnected && this.supabase) {
      try {
        // 3. Filter wajib: hanya sesi milik user aktif
        let query = this.supabase
          .from('sesi_mengajar')
          .select('*, kelas:kelas_id(nama_kelas, academic_year), absensi(*), jurnal_mengajar(*)')
          .eq('user_id', currentUserId)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false });

        if (academicYear) {
          const kelasInYear = await this.getClassesByYear(academicYear, false);
          const kelasIds = kelasInYear.map(k => k.id);
          if (kelasIds.length > 0) {
            query = query.in('kelas_id', kelasIds);
          }
        }

        const res = await query;
        if (!res.error && res.data) {
          data = res.data;
        }
      } catch (e) {
        console.warn('Supabase getAllSesi fallback:', e);
      }
    }

    if (!data) {
      const allSesi    = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI)    || '[]');
      const allKelas   = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS)   || '[]');
      const allAbsensi = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
      const allJurnal  = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL)  || '[]');

      data = allSesi
        // 4. Strict: hanya sesi milik user aktif
        .filter(s => s.user_id === currentUserId)
        .map(sesi => {
          const k = allKelas.find(x => x.id === sesi.kelas_id);
          return {
            ...sesi,
            kelas: k ? { nama_kelas: k.nama_kelas, academic_year: k.academic_year } : { nama_kelas: 'Kelas' },
            absensi: (Array.isArray(sesi.absensi) && sesi.absensi.length > 0)
              ? sesi.absensi
              : allAbsensi.filter(a => a.sesi_id === sesi.id),
            jurnal_mengajar: allJurnal.find(j => j.sesi_id === sesi.id) || null
          };
        })
        .filter(s => !academicYear || !s.kelas?.academic_year || s.kelas.academic_year === academicYear)
        .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    }

    return this._setCache(cacheKey, data, 60000);
  }

  async saveSesi({ sesiData, absensiList, jurnalData }) {
    this._invalidateCache(['sesi_']);
    const timestamp = new Date().toISOString();
    const isUpdate = Boolean(sesiData.id && isValidUUID(sesiData.id));
    let sesiId = isUpdate ? sesiData.id : null;
    let supabaseSuccess = false;
    let savedSesi = null; // Sumber kebenaran tunggal untuk localStorage

    // Identitas user aktif untuk sinkronisasi localStorage
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        // Validasi session untuk SEMUA operasi cloud (CREATE maupun UPDATE)
        const { data: authData, error: authError } = await this.supabase.auth.getUser();

        if (authError || !authData?.user?.id) {
          return {
            success: false,
            sesiId: null,
            error: 'Sesi pengguna tidak valid. Silakan login kembali.'
          };
        }

        const authUserId = authData.user.id;

        if (isUpdate) {
          // UPDATE: payload murni tanpa user_id
          // .eq('user_id', authUserId) memastikan hanya owner yang bisa mengubah
          const { data, error } = await this.supabase
            .from('sesi_mengajar')
            .update({
              kelas_id:    sesiData.kelas_id,
              mapel:       sesiData.mapel,
              tanggal:     sesiData.tanggal,
              catatan_sesi: sesiData.catatan_sesi || '',
              updated_at:  timestamp
            })
            .eq('id', sesiId)
            .eq('user_id', authUserId) // Proteksi ownership: hanya owner yang bisa UPDATE
            .select()
            .single();

          if (error) throw error;
          savedSesi = data;

        } else {
          // CREATE: user_id wajib diisi dari session yang tervalidasi
          const { data, error } = await this.supabase
            .from('sesi_mengajar')
            .insert([{
              kelas_id:    sesiData.kelas_id,
              mapel:       sesiData.mapel,
              tanggal:     sesiData.tanggal,
              catatan_sesi: sesiData.catatan_sesi || '',
              user_id:     authUserId, // Wajib terisi — tidak pernah null pada cloud CREATE
              created_at:  timestamp,
              updated_at:  timestamp
            }])
            .select()
            .single();

          if (error) throw error;
          savedSesi = data;
          sesiId = savedSesi.id;
        }

        // Child tables: absensi & jurnal_mengajar (ownership inherit via sesi_id)
        await this.supabase.from('absensi').delete().eq('sesi_id', sesiId);
        if (absensiList && absensiList.length > 0) {
          const absensiToInsert = absensiList.map(a => ({
            sesi_id:  sesiId,
            siswa_id: a.siswa_id,
            status:   a.status || 'Hadir',
            catatan:  a.catatan || ''
          }));
          const { error: absError } = await this.supabase.from('absensi').insert(absensiToInsert);
          if (absError) console.warn('Supabase insert absensi warning:', absError.message);
        }

        if (jurnalData && (jurnalData.materi_pokok || jurnalData.kegiatan_pembelajaran)) {
          await this.supabase.from('jurnal_mengajar').delete().eq('sesi_id', sesiId);
          await this.supabase.from('jurnal_mengajar').insert([{
            sesi_id:               sesiId,
            materi_pokok:          jurnalData.materi_pokok || '-',
            kegiatan_pembelajaran: jurnalData.kegiatan_pembelajaran || '',
            kendala_refleksi:      jurnalData.kendala_refleksi || '',
            created_at:            timestamp,
            updated_at:            timestamp
          }]);
        }

        supabaseSuccess = true;
      } catch (err) {
        console.warn('Gagal simpan ke Supabase, fallback ke LocalStorage:', err);
      }
    }

    // ── LOCAL STORAGE SYNC ─────────────────────────────────────────────────
    let allSesi    = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI)    || '[]');
    let allAbsensi = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    let allJurnal  = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL)  || '[]');

    // Pencarian existing: strict per user_id + (id atau kelas+mapel+tanggal)
    const existingIdx = allSesi.findIndex(s =>
      s.user_id === currentUserId &&
      (
        s.id === sesiId ||
        (
          s.kelas_id === sesiData.kelas_id &&
          s.mapel    === sesiData.mapel &&
          s.tanggal  === sesiData.tanggal
        )
      )
    );

    let sesiObject;
    if (savedSesi) {
      // ONLINE: row dari Supabase = sumber kebenaran tunggal
      //   CREATE → savedSesi.user_id = authUserId yang kita sisipkan
      //   UPDATE → savedSesi.user_id = pemilik lama yang dipertahankan database
      sesiObject = { ...savedSesi };

    } else if (isUpdate && existingIdx >= 0) {
      // OFFLINE UPDATE: pertahankan user_id existing dari cache lokal
      sesiObject = {
        ...allSesi[existingIdx],        // user_id lama terlindungi
        kelas_id:    sesiData.kelas_id,
        mapel:       sesiData.mapel,
        tanggal:     sesiData.tanggal,
        catatan_sesi: sesiData.catatan_sesi || '',
        updated_at:  timestamp
      };

    } else {
      // OFFLINE CREATE: gunakan user dari cache session lokal (atau null)
      sesiId = sesiId || ('sesi-' + Date.now());
      sesiObject = {
        id:          sesiId,
        kelas_id:    sesiData.kelas_id,
        mapel:       sesiData.mapel,
        tanggal:     sesiData.tanggal,
        catatan_sesi: sesiData.catatan_sesi || '',
        user_id:     currentUserId || null,
        created_at:  timestamp,
        updated_at:  timestamp
      };
    }

    if (existingIdx >= 0) {
      allSesi[existingIdx] = sesiObject;
    } else {
      allSesi.unshift(sesiObject);
    }
    localStorage.setItem(STORAGE_KEYS.SESI, JSON.stringify(allSesi));

    // Absensi di LocalStorage
    allAbsensi = allAbsensi.filter(a => a.sesi_id !== sesiId);
    if (absensiList && absensiList.length > 0) {
      const newAbsensi = absensiList.map(a => ({
        id:         'abs-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        sesi_id:    sesiId,
        siswa_id:   a.siswa_id,
        status:     a.status || 'Hadir',
        catatan:    a.catatan || '',
        created_at: timestamp
      }));
      allAbsensi.push(...newAbsensi);
    }
    localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify(allAbsensi));

    // Jurnal di LocalStorage
    allJurnal = allJurnal.filter(j => j.sesi_id !== sesiId);
    if (jurnalData && (jurnalData.materi_pokok || jurnalData.kegiatan_pembelajaran)) {
      allJurnal.push({
        id:                    'jur-' + Date.now(),
        sesi_id:               sesiId,
        materi_pokok:          jurnalData.materi_pokok || '-',
        kegiatan_pembelajaran: jurnalData.kegiatan_pembelajaran || '',
        kendala_refleksi:      jurnalData.kendala_refleksi || '',
        created_at:            timestamp,
        updated_at:            timestamp
      });
    }
    localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify(allJurnal));

    return {
      success: true,
      sesiId,
      message: supabaseSuccess
        ? 'Data absensi & sesi berhasil disimpan ke Supabase'
        : 'Data absensi & sesi berhasil disimpan ke Penyimpanan Lokal'
    };
  }

  async deleteSesi(sesiId) {
    this._invalidateCache(['sesi_']);
    if (this.isSupabaseConnected && this.supabase) {
      await this.supabase.from('sesi_mengajar').delete().eq('id', sesiId);
    }

    let allSesi = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI) || '[]');
    let allAbsensi = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    let allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');

    allSesi = allSesi.filter(s => s.id !== sesiId);
    allAbsensi = allAbsensi.filter(a => a.sesi_id !== sesiId);
    allJurnal = allJurnal.filter(j => j.sesi_id !== sesiId);

    localStorage.setItem(STORAGE_KEYS.SESI, JSON.stringify(allSesi));
    localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify(allAbsensi));
    localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify(allJurnal));
    this._invalidateCache(['sesi_']);

    return true;
  }

  // ==========================================================================
  // REKAPITULASI & STATISTIK
  // ==========================================================================
  async getRekapKehadiran(kelasId, mapel, startDate, endDate, academicYear = null) {
    let allSiswa = await this.getSiswaByKelas(kelasId);
    const allSesi = await this.getAllSesi(academicYear);

    const filteredSesi = allSesi.filter(s => {
      const matchKelas = s.kelas_id === kelasId;
      const matchMapel = !mapel || s.mapel === mapel;
      const matchDate = (!startDate || s.tanggal >= startDate) && (!endDate || s.tanggal <= endDate);
      return matchKelas && matchMapel && matchDate;
    }).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    const sesiIds = filteredSesi.map(s => s.id);
    
    // 1. Kumpulkan seluruh record absensi dari sesi object (Supabase JOIN)
    let combinedAbsensi = [];
    filteredSesi.forEach(s => {
      if (Array.isArray(s.absensi) && s.absensi.length > 0) {
        combinedAbsensi.push(...s.absensi);
      }
    });

    // 2. Jika sesi.absensi kosong tapi terhubung Supabase, query langsung ke tabel absensi
    if (this.isSupabaseConnected && this.supabase && sesiIds.length > 0 && combinedAbsensi.length === 0) {
      try {
        const { data, error } = await this.supabase.from('absensi').select('*').in('sesi_id', sesiIds);
        if (!error && data) {
          combinedAbsensi.push(...data);
        }
      } catch (e) {
        console.warn('Supabase fetch absensi for rekap warning:', e);
      }
    }

    // 3. Gabungkan juga dari LocalStorage
    const localAbs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    combinedAbsensi.push(...localAbs.filter(a => sesiIds.includes(a.sesi_id)));

    // 4. Kumpulkan seluruh siswa yang terdaftar di kelas saat ini ATAU memiliki rekaman absensi di sesi-sesi kelas ini
    if (combinedAbsensi.length > 0) {
      const distinctSiswaIds = [...new Set(combinedAbsensi.map(a => a.siswa_id).filter(Boolean))];
      const existingStudentIds = new Set(allSiswa.map(s => s.id));
      const missingStudentIds = distinctSiswaIds.filter(id => !existingStudentIds.has(id));

      if (missingStudentIds.length > 0) {
        const allMasterSiswa = await this.getAllSiswa();
        const missingStudents = allMasterSiswa.filter(s => missingStudentIds.includes(s.id));
        allSiswa = [...allSiswa, ...missingStudents].sort(
          (a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999) || (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '')
        );
      }
    }

    // Buat Map absensi dengan key `${sesi_id}_${siswa_id}`
    const absensiMap = new Map();
    combinedAbsensi.forEach(a => {
      if (a.sesi_id && a.siswa_id) {
        const key = `${a.sesi_id}_${a.siswa_id}`;
        if (!absensiMap.has(key) || a.status) {
          absensiMap.set(key, a);
        }
      }
    });

    // Susun matriks kehadiran per siswa
    const siswaRekap = allSiswa.map(siswa => {
      const record = {
        siswa,
        totalSesi: filteredSesi.length,
        hadir: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        persentase: 100,
        perSesi: {} // sesiId -> status
      };

      filteredSesi.forEach(sesi => {
        const key = `${sesi.id}_${siswa.id}`;
        const item = absensiMap.get(key);
        let rawStatus = item ? String(item.status || '').trim() : '';

        // Normalisasi status
        let status = '-';
        if (rawStatus) {
          const lower = rawStatus.toLowerCase();
          if (lower === 'hadir' || lower === 'h') {
            status = 'Hadir';
            record.hadir++;
          } else if (lower === 'sakit' || lower === 's') {
            status = 'Sakit';
            record.sakit++;
          } else if (lower === 'izin' || lower === 'i') {
            status = 'Izin';
            record.izin++;
          } else if (lower === 'alfa' || lower === 'alpa' || lower === 'a') {
            status = 'Alfa';
            record.alfa++;
          } else {
            status = rawStatus;
            record.hadir++;
          }
        }

        record.perSesi[sesi.id] = status;
      });

      if (filteredSesi.length > 0) {
        record.persentase = Math.round((record.hadir / filteredSesi.length) * 100);
      } else {
        record.persentase = 100;
      }

      return record;
    });

    return {
      daftarSesi: filteredSesi,
      siswaRekap,
      totalSesi: filteredSesi.length
    };
  }

  async getRekapIndividuSiswa(siswaId, academicYear = null) {
    let siswa = null;
    let allSiswa = await this.getAllSiswa();
    siswa = allSiswa.find(s => s.id === siswaId);
    if (!siswa && this.isSupabaseConnected && this.supabase) {
      try {
        const { data } = await this.supabase.from('siswa').select('*').eq('id', siswaId).single();
        if (data) siswa = data;
      } catch {}
    }
    if (!siswa) {
      const localSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
      siswa = localSiswa.find(s => s.id === siswaId);
    }
    if (!siswa) return null;

    const allKelas = await this.getKelas(academicYear);
    const kelas = allKelas.find(k => k.id === siswa.kelas_id) || { nama_kelas: 'Kelas', jurusan: 'Umum' };

    // 1. Presensi Data
    const allSesi = await this.getAllSesi(academicYear);
    const kelasSesi = allSesi.filter(s => {
      const matchKelas = s.kelas_id === siswa.kelas_id;
      const matchAbsen = Array.isArray(s.absensi) && s.absensi.some(a => a.siswa_id === siswa.id);
      return matchKelas || matchAbsen;
    }).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    const sesiIds = kelasSesi.map(s => s.id);

    let combinedAbsensi = [];
    kelasSesi.forEach(s => {
      if (Array.isArray(s.absensi) && s.absensi.length > 0) {
        combinedAbsensi.push(...s.absensi);
      }
    });

    if (this.isSupabaseConnected && this.supabase && sesiIds.length > 0 && combinedAbsensi.length === 0) {
      try {
        const { data, error } = await this.supabase.from('absensi').select('*').in('sesi_id', sesiIds);
        if (!error && data) combinedAbsensi.push(...data);
      } catch (e) {
        console.warn('Supabase fetch absensi for individual rekap warning:', e);
      }
    }

    const localAbs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    combinedAbsensi.push(...localAbs.filter(a => sesiIds.includes(a.sesi_id)));

    const absensiMap = new Map();
    combinedAbsensi.forEach(a => {
      if (a.sesi_id && a.siswa_id === siswa.id) {
        absensiMap.set(a.sesi_id, a);
      }
    });

    let hadir = 0, sakit = 0, izin = 0, alfa = 0;
    const riwayatPresensi = [];
    let allJurnal = [];
    try {
      allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');
    } catch {}

    kelasSesi.forEach(sesi => {
      const rec = absensiMap.get(sesi.id);
      let rawStatus = rec ? String(rec.status || '').trim() : 'Hadir';
      const catatan = rec?.catatan || '';

      let status = 'Hadir';
      const lower = rawStatus.toLowerCase();
      if (lower === 'hadir' || lower === 'h') {
        status = 'Hadir';
        hadir++;
      } else if (lower === 'sakit' || lower === 's') {
        status = 'Sakit';
        sakit++;
      } else if (lower === 'izin' || lower === 'i') {
        status = 'Izin';
        izin++;
      } else if (lower === 'alfa' || lower === 'alpa' || lower === 'a') {
        status = 'Alfa';
        alfa++;
      } else {
        status = rawStatus;
        hadir++;
      }

      const jRec = allJurnal.find(j => j.sesi_id === sesi.id);
      const materi = sesi.jurnal?.materi_pokok || jRec?.materi_pokok || sesi.materi_pokok || sesi.catatan_sesi || 'Pembelajaran Regular';

      riwayatPresensi.push({
        sesi_id: sesi.id,
        tanggal: sesi.tanggal,
        mapel: sesi.mapel,
        materi,
        status,
        catatan
      });
    });

    const totalSesi = kelasSesi.length;
    const persentaseKehadiran = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 100;

    // 2. Nilai Tugas Data & Ceklis Catatan Data
    const allNilaiTugas = await this.getAllNilaiTugas(academicYear);
    const allChecklist = await this.getAllChecklist(academicYear);

    const kelasTugas = allNilaiTugas.filter(nt => nt.kelas_id === siswa.kelas_id).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    const kelasChecklist = allChecklist.filter(c => c.kelas_id === siswa.kelas_id).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    let sumNilai = 0;
    let countNilai = 0;
    let tugasTuntas = 0;
    let tugasRemedi = 0;
    let nilaiTertinggi = 0;
    let nilaiTerendah = 100;

    const riwayatTugas = kelasTugas.map(tugas => {
      const isBebasTugas = tugas.is_no_tugas === true || tugas.is_no_tugas === 'true' || tugas.bebas_tugas === true || tugas.bebas_tugas === 'true';

      // Hitung rata-rata kelas untuk tugas ini
      let sumKelas = 0, countKelas = 0;
      if (!isBebasTugas) {
        (tugas.daftar_nilai || []).forEach(d => {
          const n = parseInt(d.nilai);
          if (!isNaN(n)) {
            sumKelas += n;
            countKelas++;
          }
        });
      }
      const avgKelas = countKelas > 0 ? Math.round(sumKelas / countKelas) : 0;

      // Cari nilai siswa
      const itemSiswa = (tugas.daftar_nilai || []).find(d => d.siswa_id === siswa.id);
      const valNum = (!isBebasTugas && itemSiswa && itemSiswa.nilai !== '' && !isNaN(parseInt(itemSiswa.nilai))) ? parseInt(itemSiswa.nilai) : null;
      const kkm = isBebasTugas ? null : (tugas.kkm || 75);
      const isTuntas = isBebasTugas ? true : (valNum !== null ? valNum >= kkm : null);

      if (!isBebasTugas && valNum !== null && !isNaN(valNum)) {
        sumNilai += valNum;
        countNilai++;
        if (isTuntas) tugasTuntas++;
        else tugasRemedi++;
        if (valNum > nilaiTertinggi) nilaiTertinggi = valNum;
        if (valNum < nilaiTerendah) nilaiTerendah = valNum;
      }

      let status = 'Belum Dinilai';
      if (isBebasTugas) {
        status = 'Bebas';
      } else if (valNum !== null) {
        status = isTuntas ? 'Tuntas' : 'Remedi';
      }

      return {
        id: 'tgs-' + tugas.id,
        rawId: tugas.id,
        tipe: 'Tugas',
        jenisBadge: 'bg-amber-50 text-amber-800 border-amber-200',
        judul: tugas.judul_tugas || 'Tugas Pembelajaran',
        judul_tugas: tugas.judul_tugas || 'Tugas Pembelajaran',
        mapel: tugas.mapel || 'Mata Pelajaran',
        tanggal: tugas.tanggal || '-',
        kkm,
        nilai: valNum,
        avgKelas: isBebasTugas ? null : avgKelas,
        isBebas: isBebasTugas,
        isTuntas,
        status,
        catatan: itemSiswa?.catatan || ''
      };
    });

    const riwayatCeklis = kelasChecklist.map(c => {
      const isBebasCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
      const itemSiswa = (c.daftar_ceklis || []).find(d => d.siswa_id === siswa.id);
      const isChecked = isBebasCatatan ? true : (itemSiswa ? (itemSiswa.is_checked === true || itemSiswa.is_checked === 'true') : false);

      let status = isBebasCatatan ? 'Bebas' : (isChecked ? 'Selesai' : 'Belum Selesai');

      return {
        id: 'chk-' + c.id,
        rawId: c.id,
        tipe: 'Ceklis',
        jenisBadge: 'bg-teal-50 text-teal-800 border-teal-200',
        judul: c.judul_catatan || 'Ceklis Catatan',
        judul_tugas: c.judul_catatan || 'Ceklis Catatan',
        mapel: c.mapel || 'Mata Pelajaran',
        tanggal: c.tanggal || '-',
        kkm: null,
        nilai: null,
        avgKelas: null,
        isBebas: isBebasCatatan,
        isTuntas: isBebasCatatan || isChecked,
        status,
        catatan: itemSiswa?.catatan || ''
      };
    });

    // Gabungkan riwayat tugas dan riwayat ceklis dalam satu array yang diurutkan tanggal ascending
    const riwayatGabungan = [...riwayatTugas, ...riwayatCeklis].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    const rataRataNilai = countNilai > 0 ? Math.round(sumNilai / countNilai) : 0;
    if (countNilai === 0) nilaiTerendah = 0;

    // 3. Catatan Timeline (Kombinasi Kegiatan Siswa, Ceklis, Absensi, dan Tugas)
    const allKegiatan = await this.getKegiatanSiswaBySiswa(siswa.id);

    const timelineNotes = [];

    // Kegiatan Khusus (Dispensasi, Lomba, Bimbingan, Sikap, Prestasi)
    allKegiatan.forEach(k => {
      let tag = '#Sikap';
      const kat = (k.kategori || '').toLowerCase();
      if (kat.includes('prestasi') || kat.includes('positif') || kat.includes('kejuaraan')) {
        tag = '#Prestasi';
      } else if (kat.includes('dispensasi') || kat.includes('lomba') || kat.includes('izin') || kat.includes('dinas')) {
        tag = '#Kehadiran';
      } else if (kat.includes('bimbingan') || kat.includes('remedial') || kat.includes('konseling') || kat.includes('akademik')) {
        tag = '#Akademik';
      } else if (kat.includes('pelanggaran') || kat.includes('sikap') || kat.includes('perilaku')) {
        tag = '#Sikap';
      }

      timelineNotes.push({
        id: k.id,
        tanggal: k.tanggal,
        judul: k.judul,
        deskripsi: k.keterangan || '',
        kategori: k.kategori,
        tag,
        sumber: 'Catatan Kegiatan Siswa'
      });
    });

    // Catatan Khusus saat Absensi
    riwayatPresensi.filter(r => r.catatan).forEach(r => {
      timelineNotes.push({
        id: 'abs-cat-' + r.sesi_id,
        tanggal: r.tanggal,
        judul: `Catatan Presensi (${r.status})`,
        deskripsi: r.catatan,
        kategori: 'Presensi',
        tag: '#Kehadiran',
        sumber: `Mapel: ${r.mapel}`
      });
    });

    // Catatan Ceklis
    kelasChecklist.forEach(c => {
      const isNoCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
      if (isNoCatatan) return;
      const item = (c.daftar_ceklis || []).find(d => d.siswa_id === siswa.id);
      if (item && item.catatan) {
        timelineNotes.push({
          id: 'chk-cat-' + c.id,
          tanggal: c.tanggal,
          judul: c.judul_catatan,
          deskripsi: `${item.is_checked ? '☑️ Sudah/Lengkap' : '⬜ Belum'}: ${item.catatan}`,
          kategori: 'Ceklis Siswa',
          tag: '#Akademik',
          sumber: `Mapel: ${c.mapel}`
        });
      }
    });

    // Catatan Tugas
    riwayatTugas.filter(r => r.catatan).forEach(r => {
      timelineNotes.push({
        id: 'tgs-cat-' + r.id,
        tanggal: r.tanggal,
        judul: `Catatan Tugas: ${r.judul}`,
        deskripsi: `Nilai: ${r.nilai ?? '-'} • Catatan: ${r.catatan}`,
        kategori: 'Penilaian Tugas',
        tag: '#Akademik',
        sumber: `Mapel: ${r.mapel}`
      });
    });

    timelineNotes.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return {
      siswa,
      kelas,
      presensi: {
        totalSesi,
        hadir,
        sakit,
        izin,
        alfa,
        persentase: persentaseKehadiran,
        riwayat: riwayatPresensi
      },
      akademik: {
        totalTugas: kelasTugas.length,
        totalCeklis: kelasChecklist.length,
        totalGabungan: riwayatGabungan.length,
        tugasDinilai: countNilai,
        tugasTuntas,
        tugasRemedi,
        rataRataNilai,
        nilaiTertinggi,
        nilaiTerendah,
        riwayatTugas,
        riwayatCeklis,
        riwayat: riwayatGabungan
      },
      timelineNotes
    };
  }

  // ==========================================================================
  // BACKUP, RESTORE, & RESET
  // ==========================================================================
  exportBackupJSON() {
    const backup = {
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      kelas: JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]'),
      siswa: JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]'),
      sesi: JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI) || '[]'),
      absensi: JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]'),
      jurnal: JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]'),
      kegiatan: JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]'),
      checklist: JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]'),
      nilai_tugas: JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]'),
      pr_tugas: JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]'),
      pr_nilai_siswa: JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]'),
      mapelList: JSON.parse(localStorage.getItem(STORAGE_KEYS.MAPEL_LIST) || '[]'),
      profil_guru: this.getProfilGuru(),
      school_settings: this.getSchoolSettings()
    };
    return JSON.stringify(backup, null, 2);
  }

  importBackupJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.kelas) localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(data.kelas));
      if (data.siswa) localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(data.siswa));
      if (data.sesi) localStorage.setItem(STORAGE_KEYS.SESI, JSON.stringify(data.sesi));
      if (data.absensi) localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify(data.absensi));
      if (data.jurnal) localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify(data.jurnal));
      if (data.kegiatan) localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(data.kegiatan));
      if (data.checklist) localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(data.checklist));
      if (data.nilai_tugas) localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(data.nilai_tugas));
      if (data.pr_tugas) localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(data.pr_tugas));
      if (data.pr_nilai_siswa) localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(data.pr_nilai_siswa));
      if (data.mapelList) localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(data.mapelList));
      if (data.profil_guru) localStorage.setItem(STORAGE_KEYS.PROFIL_GURU, JSON.stringify(data.profil_guru));
      if (data.school_settings) localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(data.school_settings));
      return { success: true, message: 'Data cadangan berhasil dipulihkan!' };
    } catch (e) {
      return { success: false, message: 'Format data JSON cadangan tidak valid: ' + e.message };
    }
  }

  clearDummyData() {
    localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.TUGAS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SESI, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify([]));
    return true;
  }

  // ==========================================================================
  // KENAIKAN KELAS (GRADE PROMOTION) MULTI-TAHUN AJARAN
  // ==========================================================================

  // Safeguard: Periksa apakah tahun ajaran tujuan sudah memiliki kelas atau siswa
  async checkKenaikanSafeguard(sourceYear, targetYear) {
    if (!targetYear) {
      return { hasExistingClasses: false, existingClassCount: 0, existingStudentCount: 0, targetClasses: [] };
    }

    const targetClasses = await this.getClassesByYear(targetYear, false);
    let studentCount = 0;

    for (const k of targetClasses) {
      const sList = await this.getSiswaByKelas(k.id, false);
      studentCount += sList.length;
    }

    return {
      hasExistingClasses: targetClasses.length > 0,
      existingClassCount: targetClasses.length,
      existingStudentCount: studentCount,
      targetClasses
    };
  }

  // Eksekusi Kenaikan Kelas Secara Atomik & Aman
  async processKenaikanKelas(payload) {
    const { sourceYear, targetYear, mappings } = payload;
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return { success: false, message: 'Mapping kelas belum ditentukan.' };
    }

    // 1. Coba eksekusi melalui PostgreSQL RPC Supabase jika terhubung
    let rpcSuccess = false;
    let rpcResult = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.rpc('process_kenaikan_kelas_batch', {
          p_mappings: mappings,
          p_source_academic_year: sourceYear,
          p_target_academic_year: targetYear
        });

        if (!error && data && data.success) {
          rpcSuccess = true;
          rpcResult = data;
        } else if (error) {
          console.warn('Supabase RPC process_kenaikan_kelas_batch fallback to client-batch:', error);
        }
      } catch (err) {
        console.warn('Supabase RPC invocation error:', err);
      }
    }

    // 2. Eksekusi Sinkronisasi Atomik pada Local Storage (dan Supabase Client Fallback jika RPC belum ada)
    let localKelasList = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    let localSiswaList = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');

    let promotedCount = 0;
    let graduatedCount = 0;
    let retainedCount = 0;
    let classesCreatedCount = 0;
    const classResults = [];

    // Map kelas tujuan yang sudah ada di target year
    let currentTargetYearClasses = localKelasList.filter(k => (k.academic_year || '').trim() === targetYear.trim());

    for (const mapping of mappings) {
      const {
        source_kelas_id,
        target_kelas_nama,
        target_tingkat = 'XI',
        target_jurusan = null,
        target_jurusan_id = null,
        target_jurusan_master = null,
        action = 'promote', // 'promote' | 'graduate' | 'skip'
        student_overrides = [] // [{ siswa_id, action: 'promote'|'graduate'|'retain', target_kelas_id }]
      } = mapping;

      if (action === 'skip') {
        continue;
      }

      // Case A: Seluruh kelas lulus (misal kelas XII)
      if (action === 'graduate') {
        let gradInThisClass = 0;
        localSiswaList = localSiswaList.map(s => {
          if (s.kelas_id === source_kelas_id) {
            gradInThisClass++;
            return { ...s, is_active: false };
          }
          return s;
        });

        // Supabase update jika RPC belum berjalan
        if (!rpcSuccess && this.isSupabaseConnected && this.supabase) {
          try {
            await this.supabase
              .from('siswa')
              .update({ is_active: false })
              .eq('kelas_id', source_kelas_id);
          } catch (e) {
            console.warn('Supabase graduate update catch:', e);
          }
        }

        graduatedCount += gradInThisClass;
        classResults.push({
          source_kelas_id,
          action: 'graduate',
          students_graduated: gradInThisClass
        });
        continue;
      }

      // Case B: Promosi / Naik Kelas
      if (action === 'promote' && target_kelas_nama) {
        // Cari apakah kelas tujuan sudah ada di target year
        let targetKelas = currentTargetYearClasses.find(
          k => k.nama_kelas.toLowerCase().trim() === target_kelas_nama.toLowerCase().trim()
        );

        if (!targetKelas) {
          // Buat kelas baru
          const newKelasId = 'k-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
          const effectiveJurusanId = target_jurusan_id || mapping.jurusan_id || null;
          let effectiveJurusanName = target_jurusan || target_jurusan_master?.nama || mapping.jurusan || null;

          if (effectiveJurusanId && !effectiveJurusanName) {
            const jList = await this.getJurusanList();
            const found = jList.find(j => j.id === effectiveJurusanId);
            if (found) effectiveJurusanName = found.nama;
          }

          targetKelas = {
            id: newKelasId,
            nama_kelas: target_kelas_nama.trim(),
            tingkat: target_tingkat,
            jurusan_id: effectiveJurusanId,
            jurusan: effectiveJurusanName,
            academic_year: targetYear,
            is_active: true
          };

          localKelasList.push(targetKelas);
          currentTargetYearClasses.push(targetKelas);
          classesCreatedCount++;

          // Supabase insert jika RPC belum berjalan
          if (!rpcSuccess && this.isSupabaseConnected && this.supabase) {
            try {
              const { data: createdKelas, error: kErr } = await this.supabase
                .from('kelas')
                .insert([{
                  nama_kelas: targetKelas.nama_kelas,
                  tingkat: targetKelas.tingkat,
                  jurusan_id: targetKelas.jurusan_id,
                  jurusan: targetKelas.jurusan,
                  academic_year: targetKelas.academic_year,
                  is_active: true
                }])
                .select()
                .single();

              if (!kErr && createdKelas) {
                targetKelas.id = createdKelas.id;
              }
            } catch (e) {
              console.warn('Supabase insert new class catch:', e);
            }
          }
        }

        const targetKelasId = targetKelas.id;
        let classPromoted = 0;
        let classGraduated = 0;
        let classRetained = 0;

        // Update siswa di kelas asal
        const overrideMap = new Map(student_overrides.map(o => [o.siswa_id, o]));
        const studentUpdates = [];

        localSiswaList = localSiswaList.map(s => {
          if (s.kelas_id === source_kelas_id) {
            const override = overrideMap.get(s.id);
            const stAction = override?.action || 'promote';
            const stTargetId = (stAction === 'promote' && override?.target_kelas_id) ? override.target_kelas_id : targetKelasId;

            if (stAction === 'graduate') {
              classGraduated++;
              studentUpdates.push({ id: s.id, is_active: false });
              return { ...s, is_active: false };
            } else if (stAction === 'retain') {
              classRetained++;
              studentUpdates.push({ id: s.id, is_active: true });
              return { ...s, is_active: true };
            } else {
              classPromoted++;
              studentUpdates.push({ id: s.id, kelas_id: stTargetId, is_active: true });
              return { ...s, kelas_id: stTargetId, is_active: true };
            }
          }
          return s;
        });

        // Supabase batch updates jika RPC belum berjalan
        if (!rpcSuccess && this.isSupabaseConnected && this.supabase) {
          try {
            for (const upd of studentUpdates) {
              const payload = { is_active: upd.is_active };
              if (upd.kelas_id) payload.kelas_id = upd.kelas_id;
              await this.supabase.from('siswa').update(payload).eq('id', upd.id);
            }
          } catch (e) {
            console.warn('Supabase student update batch catch:', e);
          }
        }

        promotedCount += classPromoted;
        graduatedCount += classGraduated;
        retainedCount += classRetained;

        classResults.push({
          source_kelas_id,
          target_kelas_id: targetKelasId,
          target_kelas_nama: target_kelas_nama.trim(),
          action: 'promote',
          promoted: classPromoted,
          graduated: classGraduated,
          retained: classRetained
        });
      }
    }

    // Simpan LocalStorage secara atomik
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(localKelasList));
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(localSiswaList));
    this._invalidateCache();

    return {
      success: true,
      message: 'Kenaikan kelas berhasil diproses secara aman!',
      source_academic_year: sourceYear,
      target_academic_year: targetYear,
      promoted_count: rpcSuccess ? rpcResult.promoted_count : promotedCount,
      graduated_count: rpcSuccess ? rpcResult.graduated_count : graduatedCount,
      retained_count: rpcSuccess ? rpcResult.retained_count : retainedCount,
      classes_created: rpcSuccess ? rpcResult.classes_created : classesCreatedCount,
      details: rpcSuccess ? rpcResult.details : classResults
    };
  }

  // ==========================================================================
  // FITUR LEDGER & KALKULATOR NILAI AKHIR FLEKSIBEL (HYBRID LIVE + SNAPSHOT)
  // ==========================================================================

  /**
   * Mengambil konfigurasi bobot, KKM, predikat, dan komponen aktif per Kelas + Mapel
   */
  async getLedgerConfig({ kelas_id, mapel_id, mapel, academic_year }) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    const activeYear = academic_year || await this.getActiveAcademicYear();

    const defaultConfig = {
      kelas_id,
      mapel_id: mapel_id || null,
      mapel: mapel || '',
      academic_year: activeYear,
      user_id: currentUserId,
      kkm: 75,
      predikat_ranges: { A: 90, B: 80, C: 75, D: 0 },
      components_config: {
        kehadiran:      { active: true, weight: 15 },
        tugas_mandiri:  { active: true, weight: 20 },
        tugas_kelompok: { active: true, weight: 20 },
        pr:             { active: true, weight: 15 },
        ceklis:         { active: true, weight: 10 },
        sumatif_sts:    { active: true, weight: 10 },
        sumatif_sas:    { active: true, weight: 10 },
        sikap:          { active: false, weight: 0, bonus_per_item: 3, penalty_per_item: 3 }
      }
    };

    if (!currentUserId) return defaultConfig;

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId && mapel) {
      try {
        const allMapel = await this.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapel || x.kode === mapel);
        if (m) resolvedMapelId = m.id;
      } catch (e) {}
    }

    const cacheKey = `ledger_cfg_${currentUserId}_${kelas_id || 'all'}_${resolvedMapelId || mapel || 'none'}_${activeYear}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.isSupabaseConnected && this.supabase && kelas_id) {
      try {
        let query = this.supabase
          .from('ledger_config')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('kelas_id', kelas_id)
          .eq('academic_year', activeYear);

        if (resolvedMapelId) {
          query = query.eq('mapel_id', resolvedMapelId);
        } else if (mapel) {
          query = query.eq('mapel', mapel);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          result = data;
        }
      } catch (err) {
        console.warn('Supabase fetch ledger_config error:', err);
      }
    }

    if (!result) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_CONFIG) || '[]');
      const found = localList.find(c => 
        c.user_id === currentUserId &&
        c.kelas_id === kelas_id &&
        c.academic_year === activeYear &&
        ((resolvedMapelId && c.mapel_id === resolvedMapelId) || (!resolvedMapelId && c.mapel === mapel))
      );
      if (found) result = found;
    }

    const finalConfig = result ? { ...defaultConfig, ...result } : defaultConfig;
    return this._setCache(cacheKey, finalConfig);
  }

  /**
   * Menyimpan konfigurasi bobot dan predikat
   */
  async saveLedgerConfig(configData) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    let mapelId = configData.mapel_id || null;
    let mapelNama = configData.mapel || '';
    if (!mapelId && mapelNama) {
      try {
        const allMapel = await this.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapelNama || x.kode === mapelNama);
        if (m) mapelId = m.id;
      } catch (e) {}
    }

    if (!mapelId && !mapelNama) {
      return { success: false, message: 'Validasi gagal: Mata pelajaran wajib diisi.' };
    }

    this._invalidateCache([`ledger_cfg_${currentUserId}_`]);
    const activeYear = configData.academic_year || await this.getActiveAcademicYear();
    const payload = {
      user_id: currentUserId,
      kelas_id: configData.kelas_id,
      mapel_id: mapelId,
      mapel: mapelNama,
      academic_year: activeYear,
      kkm: Number(configData.kkm) || 75,
      predikat_ranges: configData.predikat_ranges || { A: 90, B: 80, C: 75, D: 0 },
      components_config: configData.components_config,
      updated_at: new Date().toISOString()
    };

    let supabaseError = null;
    let savedRow = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        let lookupQuery = this.supabase
          .from('ledger_config')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('kelas_id', payload.kelas_id)
          .eq('academic_year', payload.academic_year);

        if (mapelId) {
          lookupQuery = lookupQuery.eq('mapel_id', mapelId);
        } else {
          lookupQuery = lookupQuery.eq('mapel', payload.mapel);
        }

        const { data: existing } = await lookupQuery.maybeSingle();
        const existingRow = Array.isArray(existing) ? existing[0] : existing;

        if (existingRow && existingRow.id) {
          const { data: updated, error: updateErr } = await this.supabase
            .from('ledger_config')
            .update(payload)
            .eq('id', existingRow.id)
            .eq('user_id', currentUserId)
            .select()
            .single();
          if (updateErr) throw updateErr;
          savedRow = updated;
        } else {
          const { data: inserted, error: insertErr } = await this.supabase
            .from('ledger_config')
            .insert([payload])
            .select()
            .single();
          if (insertErr) throw insertErr;
          savedRow = inserted;
        }
      } catch (err) {
        supabaseError = err;
        console.warn('Supabase save ledger_config error:', err);
      }
    }

    let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_CONFIG) || '[]');
    const idx = localList.findIndex(c => 
      c.user_id === currentUserId &&
      c.kelas_id === payload.kelas_id &&
      c.academic_year === payload.academic_year &&
      ((payload.mapel_id && c.mapel_id === payload.mapel_id) || (!payload.mapel_id && c.mapel === payload.mapel))
    );

    const entry = savedRow || { id: 'lcfg-' + Date.now(), ...payload };

    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...entry };
    } else {
      localList.push(entry);
    }
    localStorage.setItem(STORAGE_KEYS.LEDGER_CONFIG, JSON.stringify(localList));

    if (supabaseError) {
      return { success: true, warning: 'Tersimpan lokal, sinkronisasi Supabase tertunda: ' + supabaseError.message };
    }
    return { success: true, message: 'Konfigurasi bobot & KKM berhasil disimpan!' };
  }

  /**
   * Mesin Kalkulasi Nilai Akhir (Live Engine)
   */
  async calculateLedgerNilai({ kelas_id, mapel_id, mapel, academic_year, semester = 'Ganjil' }) {
    if (!kelas_id) return { students: [], summary: {}, config: null };

    const activeYear = academic_year || await this.getActiveAcademicYear();

    // 1. Ambil seluruh data master & transaksional secara PARALEL (Promise.all)
    const [
      config,
      students,
      allSesi,
      allNilaiTugas,
      allPR,
      allChecklist,
      allKegiatan
    ] = await Promise.all([
      this.getLedgerConfig({ kelas_id, mapel_id, mapel, academic_year: activeYear }),
      this.getSiswaByKelas(kelas_id, true),
      this.getAllSesi(activeYear),
      this.getAllNilaiTugas(activeYear),
      this.getPRList({ academic_year: activeYear }),
      this.getAllChecklist(activeYear),
      this.getAllKegiatanSiswa(activeYear)
    ]);

    // 2. Filter data berdasarkan Kelas, Mapel, dan Semester
    const isAllSemester = semester === 'Semua' || !semester;

    // Filter Sesi Kehadiran
    const kelasSesi = allSesi.filter(s => {
      const matchKelas = s.kelas_id === kelas_id;
      const matchMapel = !mapel || s.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(s.tanggal) === semester;
      return matchKelas && matchMapel && matchSem;
    });
    const totalSesi = kelasSesi.length;

    // Kumpulkan absensi siswa
    const studentAbsensiMap = new Map();
    kelasSesi.forEach(sesi => {
      if (Array.isArray(sesi.absensi)) {
        sesi.absensi.forEach(a => {
          if (!studentAbsensiMap.has(a.siswa_id)) {
            studentAbsensiMap.set(a.siswa_id, { hadir: 0, sakit: 0, izin: 0, alfa: 0 });
          }
          const rec = studentAbsensiMap.get(a.siswa_id);
          const st = String(a.status || '').toLowerCase().trim();
          if (st === 'hadir' || st === 'h') rec.hadir++;
          else if (st === 'sakit' || st === 's') rec.sakit++;
          else if (st === 'izin' || st === 'i') rec.izin++;
          else if (st === 'alfa' || st === 'alpa' || st === 'a') rec.alfa++;
          else rec.hadir++;
        });
      }
    });

    // Filter Tugas Mandiri (non-kelompok, non-sumatif)
    const tugasMandiriList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      const isIndividu = !t.is_kelompok && t.tipe_tugas !== 'kelompok' && t.tipe_tugas !== 'sumatif_sts' && t.tipe_tugas !== 'sumatif_sas';
      return matchKelas && matchMapel && matchSem && isIndividu;
    });

    // Filter Tugas Kelompok
    const tugasKelompokList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      const isKel = t.is_kelompok || t.tipe_tugas === 'kelompok';
      return matchKelas && matchMapel && matchSem && isKel;
    });

    // Filter PR
    const prList = allPR.filter(p => {
      const matchKelas = p.kelas_id === kelas_id;
      const matchMapel = !mapel || p.mapel === mapel || p.mata_pelajaran?.nama_mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(p.tanggal_diberikan) === semester;
      return matchKelas && matchMapel && matchSem;
    });

    // Filter Ceklis Catatan
    const checklistList = allChecklist.filter(c => {
      const matchKelas = c.kelas_id === kelas_id;
      const matchMapel = !mapel || c.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(c.tanggal) === semester;
      const isNoCatatan = c.is_no_catatan || c.bebas_catatan;
      return matchKelas && matchMapel && matchSem && !isNoCatatan;
    });
    const totalChecklist = checklistList.length;

    // Filter Sumatif STS & SAS
    const sumatifSTSList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      return matchKelas && matchMapel && matchSem && t.tipe_tugas === 'sumatif_sts';
    });

    const sumatifSASList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      return matchKelas && matchMapel && matchSem && t.tipe_tugas === 'sumatif_sas';
    });

    // Filter Sikap / Kegiatan
    const sikapList = allKegiatan.filter(k => {
      const matchSem = isAllSemester || getSemesterFromDate(k.tanggal) === semester;
      return matchSem;
    });

    const compCfg = config.components_config || {};
    const kkmVal = Number(config.kkm) || 75;
    const predRanges = config.predikat_ranges || { A: 90, B: 80, C: 75, D: 0 };

    // 3. Kalkulasi per Siswa
    const studentResults = students.map(s => {
      const scores = {};
      const rawDetails = {};

      // 1. Kehadiran (Sakit & Izin = 0.5 Nilai)
      if (compCfg.kehadiran?.active) {
        const rec = studentAbsensiMap.get(s.id) || { hadir: 0, sakit: 0, izin: 0, alfa: 0 };
        if (totalSesi === 0) {
          scores.kehadiran = 100;
          rawDetails.kehadiran = 'Belum ada sesi KBM';
        } else {
          const effectiveHadir = (rec.hadir * 1.0) + (rec.sakit * 0.5) + (rec.izin * 0.5);
          const pct = Math.min(100, Math.max(0, (effectiveHadir / totalSesi) * 100));
          scores.kehadiran = Math.round(pct * 10) / 10;
          rawDetails.kehadiran = `H:${rec.hadir} S:${rec.sakit} I:${rec.izin} A:${rec.alfa} / ${totalSesi} sesi`;
        }
      }

      // 2. Tugas Mandiri
      if (compCfg.tugas_mandiri?.active) {
        const studentGrades = [];
        tugasMandiriList.forEach(t => {
          if (t.is_no_tugas || t.bebas_tugas) return;
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            studentGrades.push(Number(d.nilai));
          }
        });
        if (studentGrades.length > 0) {
          const avg = studentGrades.reduce((a, b) => a + b, 0) / studentGrades.length;
          scores.tugas_mandiri = Math.round(avg * 10) / 10;
          rawDetails.tugas_mandiri = `Rata-rata ${studentGrades.length} tugas`;
        } else {
          scores.tugas_mandiri = null;
          rawDetails.tugas_mandiri = 'Belum ada tugas dinilai';
        }
      }

      // 3. Tugas Kelompok
      if (compCfg.tugas_kelompok?.active) {
        const studentGrades = [];
        tugasKelompokList.forEach(t => {
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            studentGrades.push(Number(d.nilai));
          }
        });
        if (studentGrades.length > 0) {
          const avg = studentGrades.reduce((a, b) => a + b, 0) / studentGrades.length;
          scores.tugas_kelompok = Math.round(avg * 10) / 10;
          rawDetails.tugas_kelompok = `Rata-rata ${studentGrades.length} tugas kelompok`;
        } else {
          scores.tugas_kelompok = null;
          rawDetails.tugas_kelompok = 'Belum ada tugas kelompok';
        }
      }

      // 4. PR
      if (compCfg.pr?.active) {
        const prGrades = [];
        prList.forEach(p => {
          const d = (p.pr_nilai_siswa || []).find(n => n.siswa_id === s.id);
          if (d) {
            if (d.nilai !== null && d.nilai !== undefined && d.nilai !== '' && !isNaN(Number(d.nilai))) {
              prGrades.push(Number(d.nilai));
            } else if (d.mengumpulkan === false) {
              prGrades.push(0);
            }
          }
        });
        if (prGrades.length > 0) {
          const avg = prGrades.reduce((a, b) => a + b, 0) / prGrades.length;
          scores.pr = Math.round(avg * 10) / 10;
          rawDetails.pr = `Rata-rata ${prGrades.length} PR`;
        } else {
          scores.pr = null;
          rawDetails.pr = 'Belum ada PR dinilai';
        }
      }

      // 5. Ceklis Catatan
      if (compCfg.ceklis?.active) {
        if (totalChecklist === 0) {
          scores.ceklis = 100;
          rawDetails.ceklis = 'Belum ada sesi ceklis';
        } else {
          let completeCount = 0;
          checklistList.forEach(c => {
            const d = (c.daftar_ceklis || []).find(n => n.siswa_id === s.id);
            if (d && (d.is_checked === true || d.is_checked === 'true')) {
              completeCount++;
            }
          });
          const pct = (completeCount / totalChecklist) * 100;
          scores.ceklis = Math.round(pct * 10) / 10;
          rawDetails.ceklis = `${completeCount}/${totalChecklist} catatan lengkap`;
        }
      }

      // 6. STS
      if (compCfg.sumatif_sts?.active) {
        const stsGrades = [];
        sumatifSTSList.forEach(t => {
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            stsGrades.push(Number(d.nilai));
          }
        });
        if (stsGrades.length > 0) {
          const avg = stsGrades.reduce((a, b) => a + b, 0) / stsGrades.length;
          scores.sumatif_sts = Math.round(avg * 10) / 10;
          rawDetails.sumatif_sts = `STS: ${scores.sumatif_sts}`;
        } else {
          scores.sumatif_sts = null;
          rawDetails.sumatif_sts = 'Belum ada nilai STS';
        }
      }

      // 7. SAS
      if (compCfg.sumatif_sas?.active) {
        const sasGrades = [];
        sumatifSASList.forEach(t => {
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            sasGrades.push(Number(d.nilai));
          }
        });
        if (sasGrades.length > 0) {
          const avg = sasGrades.reduce((a, b) => a + b, 0) / sasGrades.length;
          scores.sumatif_sas = Math.round(avg * 10) / 10;
          rawDetails.sumatif_sas = `SAS: ${scores.sumatif_sas}`;
        } else {
          scores.sumatif_sas = null;
          rawDetails.sumatif_sas = 'Belum ada nilai SAS';
        }
      }

      // 8. Sikap
      if (compCfg.sikap?.active) {
        const sSikap = sikapList.filter(k => k.siswa_id === s.id);
        let positif = 0, pelanggaran = 0;
        sSikap.forEach(k => {
          const kat = (k.kategori || '').toLowerCase();
          if (kat.includes('positif') || kat.includes('prestasi')) positif++;
          if (kat.includes('pelanggaran') || kat.includes('perilaku')) pelanggaran++;
        });
        const bonus = compCfg.sikap.bonus_per_item || 3;
        const penalty = compCfg.sikap.penalty_per_item || 3;
        const scoreSikap = Math.max(0, Math.min(100, 80 + (positif * bonus) - (pelanggaran * penalty)));
        scores.sikap = scoreSikap;
        rawDetails.sikap = `+${positif} Positif, -${pelanggaran} Pelanggaran (Skor: ${scoreSikap})`;
      }

      // 4. Hitung Rata-Rata Tertimbang Fleksibel (Dynamic Interim Redistribution)
      let weightedSum = 0;
      let activeWeightSum = 0;
      let totalAssignedWeight = 0;
      let hasMissingComponent = false;

      Object.entries(compCfg).forEach(([key, cfg]) => {
        if (!cfg.active) return;
        const weight = Number(cfg.weight) || 0;
        totalAssignedWeight += weight;
        const sc = scores[key];
        if (sc !== null && sc !== undefined && !isNaN(sc)) {
          weightedSum += sc * weight;
          activeWeightSum += weight;
        } else {
          hasMissingComponent = true;
        }
      });

      let finalScore = 0;
      if (activeWeightSum > 0) {
        finalScore = Math.round((weightedSum / activeWeightSum) * 10) / 10;
      }
      const roundedScore = Math.round(finalScore);

      // Tentukan Predikat berdasarkan rentang custom
      let predikat = 'D';
      if (roundedScore >= (predRanges.A ?? 90)) predikat = 'A';
      else if (roundedScore >= (predRanges.B ?? 80)) predikat = 'B';
      else if (roundedScore >= (predRanges.C ?? 75)) predikat = 'C';
      else predikat = 'D';

      const isTuntas = roundedScore >= kkmVal;

      // Generator Deskripsi Capaian Kompetensi Kurikulum Merdeka
      let deskripsi = '';
      if (predikat === 'A') {
        deskripsi = `Menunjukkan penguasaan yang sangat istimewa dan konsisten dalam seluruh aspek pembelajaran ${mapel || 'mata pelajaran'}.`;
      } else if (predikat === 'B') {
        deskripsi = `Menunjukkan pemahaman yang baik dan aktif dalam kegiatan belajar serta tugas ${mapel || 'mata pelajaran'}.`;
      } else if (predikat === 'C') {
        deskripsi = `Mencapai kriteria ketuntasan minimal dengan cukup baik, disarankan untuk terus meningkatkan konsistensi belajar.`;
      } else {
        deskripsi = `Perlu bimbingan intensif dan penguatan konsep dasar pada materi pembelajaran ${mapel || 'mata pelajaran'}.`;
      }

      return {
        siswa_id: s.id,
        nomor_absen: s.nomor_absen || '-',
        nama_lengkap: s.nama_lengkap,
        nisn: s.nisn || '-',
        scores,
        rawDetails,
        final_score: finalScore,
        rounded_score: roundedScore,
        predikat,
        is_tuntas: isTuntas,
        has_missing_component: hasMissingComponent,
        deskripsi_capaian: deskripsi
      };
    });

    // 5. Ringkasan Statistik Kelas
    const validScores = studentResults.map(s => s.final_score).filter(sc => sc > 0);
    const avgKelas = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : 0;
    const maxScore = validScores.length > 0 ? Math.max(...validScores) : 0;
    const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
    const tuntasCount = studentResults.filter(s => s.is_tuntas).length;
    const tuntasPercent = students.length > 0 ? Math.round((tuntasCount / students.length) * 100) : 0;

    return {
      students: studentResults,
      config,
      semester,
      academic_year: activeYear,
      summary: {
        total_siswa: students.length,
        avg_kelas: avgKelas,
        max_score: maxScore,
        min_score: minScore,
        tuntas_count: tuntasCount,
        tuntas_percent: tuntasPercent,
        remedi_count: students.length - tuntasCount
      }
    };
  }

  /**
   * Menyimpan snapshot finalisasi rapor
   */
  async saveLedgerFinalisasi(data) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    let mapelId = data.mapel_id || null;
    let mapelNama = data.mapel || '';
    if (!mapelId && mapelNama) {
      try {
        const allMapel = await this.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapelNama || x.kode === mapelNama);
        if (m) mapelId = m.id;
      } catch (e) {}
    }

    this._invalidateCache([`ledger_fin_${currentUserId}_`, `ledger_cfg_${currentUserId}_`]);
    const activeYear = data.academic_year || await this.getActiveAcademicYear();
    const payload = {
      user_id: currentUserId,
      kelas_id: data.kelas_id,
      mapel_id: mapelId,
      mapel: mapelNama,
      academic_year: activeYear,
      semester: data.semester || 'Ganjil',
      periode_nama: data.periode_nama || `Rapor Semester ${data.semester || 'Ganjil'} ${activeYear}`,
      finalized_at: new Date().toISOString(),
      config_snapshot: data.config_snapshot,
      ledger_data: data.ledger_data,
      is_locked: true
    };

    let newId = 'lfin-' + Date.now();
    let supabaseError = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data: res, error } = await this.supabase
          .from('ledger_finalisasi')
          .insert([payload])
          .select('id')
          .single();
        if (!error && res) {
          newId = res.id;
        } else if (error) {
          supabaseError = error;
        }
      } catch (err) {
        supabaseError = err;
      }
    }

    const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_FINALISASI) || '[]');
    localList.unshift({ id: newId, ...payload });
    localStorage.setItem(STORAGE_KEYS.LEDGER_FINALISASI, JSON.stringify(localList));

    if (supabaseError) {
      return { success: true, id: newId, warning: 'Snapshot tersimpan di lokal (Supabase sync tertunda)' };
    }
    return { success: true, id: newId, message: 'Rapor berhasil difinalisasi & dikunci!' };
  }

  /**
   * Mengambil riwayat snapshot finalisasi rapor
   */
  async getLedgerFinalisasiList({ kelas_id, mapel_id, mapel, academic_year, semester } = {}) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId && mapel) {
      try {
        const allMapel = await this.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapel || x.kode === mapel);
        if (m) resolvedMapelId = m.id;
      } catch (e) {}
    }

    const activeYear = academic_year || await this.getActiveAcademicYear();
    let results = [];

    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase
          .from('ledger_finalisasi')
          .select('*')
          .eq('user_id', currentUserId)
          .order('finalized_at', { ascending: false });

        if (kelas_id) query = query.eq('kelas_id', kelas_id);
        if (resolvedMapelId) query = query.eq('mapel_id', resolvedMapelId);
        else if (mapel) query = query.eq('mapel', mapel);
        if (activeYear) query = query.eq('academic_year', activeYear);
        if (semester && semester !== 'Semua') query = query.eq('semester', semester);

        const { data, error } = await query;
        if (!error && data) {
          results = data;
        }
      } catch (err) {
        console.warn('Supabase fetch ledger_finalisasi error:', err);
      }
    }

    if (results.length === 0) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_FINALISASI) || '[]');
      results = localList.filter(f => {
        if (f.user_id !== currentUserId) return false;
        const matchKelas = !kelas_id || f.kelas_id === kelas_id;
        const matchMapel = resolvedMapelId ? f.mapel_id === resolvedMapelId : (!mapel || f.mapel === mapel);
        const matchYear = !activeYear || f.academic_year === activeYear;
        const matchSem = !semester || semester === 'Semua' || f.semester === semester;
        return matchKelas && matchMapel && matchYear && matchSem;
      });
    }

    return results;
  }

  /**
   * Menghapus snapshot finalisasi rapor
   */
  async deleteLedgerFinalisasi(id) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return { success: false, message: 'Unauthorized' };

    let deletedSuccessfully = false;

    if (this.isSupabaseConnected && this.supabase && isValidUUID(id)) {
      try {
        const { data, error } = await this.supabase
          .from('ledger_finalisasi')
          .delete()
          .eq('id', id)
          .eq('user_id', currentUserId)
          .select('id');

        if (!error && data && data.length > 0) {
          deletedSuccessfully = true;
        } else if (error) {
          console.warn('Delete ledger_finalisasi error:', error);
          return { success: false, message: error.message };
        }
      } catch (e) {
        console.warn('Delete ledger_finalisasi error:', e);
        return { success: false, message: e.message };
      }
    } else {
      deletedSuccessfully = true;
    }

    if (deletedSuccessfully) {
      let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_FINALISASI) || '[]');
      localList = localList.filter(f => !(f.id === id && f.user_id === currentUserId));
      localStorage.setItem(STORAGE_KEYS.LEDGER_FINALISASI, JSON.stringify(localList));
      this._invalidateCache([`ledger_fin_${currentUserId}_`, `ledger_cfg_${currentUserId}_`]);
      return { success: true, message: 'Snapshot finalisasi dihapus' };
    }

    return { success: false, message: 'Snapshot tidak ditemukan atau bukan milik pengguna aktif' };
  }

  /**
   * Simpan Nilai Sumatif (STS / SAS) secara cepat
   */
  async saveNilaiSumatif({ kelas_id, mapel_id, mapel, academic_year, semester, tipe_sumatif, judul, tanggal, daftar_nilai, kkm = 75 }) {
    this._invalidateCache(['nilai_', 'ledger_']);
    const activeYear = academic_year || await this.getActiveAcademicYear();

    return this.saveNilaiTugas({
      kelas_id,
      mapel,
      judul_tugas: judul || (tipe_sumatif === 'sumatif_sts' ? 'Sumatif Tengah Semester (STS)' : 'Sumatif Akhir Semester (SAS)'),
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      kkm: Number(kkm) || 75,
      tipe_tugas: tipe_sumatif,
      academic_year: activeYear,
      daftar_nilai
    });
  }

  // ==========================================================================
  // MASTER JAM PELAJARAN (PER-SATUAN JP)
  // ==========================================================================

  /**
   * Mengambil daftar master slot jam pelajaran (diurutkan nomor_urut)
   */
  async getJamPelajaranMaster() {
    const cacheKey = 'jam_pelajaran_master_list';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('jam_pelajaran_master')
          .select('*')
          .order('nomor_urut', { ascending: true });
        if (!error && data && data.length > 0) {
          result = data;
          localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(data));
        }
      } catch (e) {
        console.warn('Supabase getJamPelajaranMaster fallback:', e);
      }
    }

    if (!result) {
      result = JSON.parse(localStorage.getItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER) || '[]');
      if (result.length === 0 && INITIAL_DATA.jamPelajaranMaster) {
        result = [...INITIAL_DATA.jamPelajaranMaster];
        localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(result));
      }
      result.sort((a, b) => (Number(a.nomor_urut) || 0) - (Number(b.nomor_urut) || 0));
    }

    return this._setCache(cacheKey, result);
  }

  /**
   * Menyimpan atau memperbarui 1 slot jam pelajaran master
   */
  async saveJamPelajaranMaster(item) {
    this._invalidateCache(['jam_pelajaran_', 'jadwal_']);
    let id = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'jp-' + Date.now());
    const payload = {
      nomor_urut: Number(item.nomor_urut) || 1,
      label: item.label || `Jam ke-${item.nomor_urut || 1}`,
      jam_mulai: item.jam_mulai || '07:30',
      jam_selesai: item.jam_selesai || '08:15',
      tipe_slot: item.tipe_slot === 'istirahat' ? 'istirahat' : 'mengajar',
      keterangan: item.keterangan || '',
      updated_at: new Date().toISOString()
    };

    let supabaseError = null;
    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (item.id && isValidUUID(item.id)) {
          const { error } = await this.supabase
            .from('jam_pelajaran_master')
            .update(payload)
            .eq('id', item.id);
          if (error) throw error;
        } else {
          const { data, error } = await this.supabase
            .from('jam_pelajaran_master')
            .insert([{ ...payload, id: isValidUUID(id) ? id : undefined }])
            .select()
            .single();
          if (error) throw error;
          if (data) id = data.id;
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase saveJamPelajaranMaster error:', e);
      }
    }

    // Local Storage Sync
    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER) || '[]');
    const idx = list.findIndex(j => j.id === id || (j.id === item.id));
    const entry = { id, ...payload };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    list.sort((a, b) => a.nomor_urut - b.nomor_urut);
    localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(list));

    return { success: !supabaseError, id, error: supabaseError?.message };
  }

  /**
   * Menghapus 1 slot jam pelajaran master
   */
  async deleteJamPelajaranMaster(id) {
    this._invalidateCache(['jam_pelajaran_', 'jadwal_']);
    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (isValidUUID(id)) {
          await this.supabase.from('jam_pelajaran_master').delete().eq('id', id);
        }
      } catch (e) {
        console.error('Supabase deleteJamPelajaranMaster error:', e);
      }
    }

    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER) || '[]');
    list = list.filter(j => j.id !== id);
    localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(list));
    return { success: true };
  }

  /**
   * Reset master jam pelajaran ke template default
   */
  async resetJamPelajaranMasterToDefault() {
    this._invalidateCache(['jam_pelajaran_', 'jadwal_']);
    const defaultList = INITIAL_DATA.jamPelajaranMaster || [];

    if (this.isSupabaseConnected && this.supabase) {
      try {
        for (const item of defaultList) {
          await this.supabase.from('jam_pelajaran_master').upsert({
            nomor_urut: item.nomor_urut,
            label: item.label,
            jam_mulai: item.jam_mulai.length === 5 ? item.jam_mulai + ':00' : item.jam_mulai,
            jam_selesai: item.jam_selesai.length === 5 ? item.jam_selesai + ':00' : item.jam_selesai,
            tipe_slot: item.tipe_slot || 'mengajar',
            keterangan: item.keterangan || ''
          }, { onConflict: 'nomor_urut' });
        }
      } catch (e) {
        console.warn('Supabase resetJamPelajaranMaster fallback:', e);
      }
    }

    localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(defaultList));
    return { success: true };
  }

  // ==========================================================================
  // JADWAL MENGAJAR GURU (JADWAL RUTIN MINGGUAN)
  // ==========================================================================

  /**
   * Mengambil daftar jadwal mengajar mingguan (filter per user_id, academic_year, hari, kelas_id, mapel)
   * Sekarang DERIVE dari getJadwalMengajarCached() — 0 query DB tambahan.
   */
  async getJadwalMengajarList({ academic_year, hari, kelas_id, mapel } = {}) {
    const activeYear = academic_year || await this.getActiveAcademicYear();

    // Ambil master data dari cache (atau 1 query jika cold)
    const allJadwal = await this.getJadwalMengajarCached(activeYear);

    // Filter in-memory sesuai parameter
    let result = allJadwal;

    if (hari || kelas_id || mapel) {
      result = allJadwal.filter(j => {
        if (hari && j.hari !== hari) return false;
        if (kelas_id && j.kelas_id !== kelas_id) return false;
        if (mapel && j.mapel !== mapel) return false;
        return true;
      });
    }

    return result;
  }

  /**
   * Menyimpan atau memperbarui data jadwal mengajar
   */
  async saveJadwalMengajar(data) {
    this._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();
    const activeYear = data.academic_year || await this.getActiveAcademicYear();
    let id = data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'jadwal-' + Date.now());

    // Hitung jumlah_jp otomatis jika ada nomor_urut (mengabaikan slot istirahat)
    let jumlahJP = Number(data.jumlah_jp);
    if (data.nomor_urut_mulai !== undefined && data.nomor_urut_selesai !== undefined) {
      const uMulai = Number(data.nomor_urut_mulai);
      const uSelesai = Number(data.nomor_urut_selesai);
      const jamMasterList = await this.getJamPelajaranMaster();
      const slotsInRange = jamMasterList.filter(j => Number(j.nomor_urut) >= uMulai && Number(j.nomor_urut) <= uSelesai);
      const teachingSlots = slotsInRange.filter(j => j.tipe_slot !== 'istirahat');
      jumlahJP = teachingSlots.length > 0 ? teachingSlots.length : Math.max(1, (uSelesai - uMulai) + 1);
    }
    if (isNaN(jumlahJP) || jumlahJP <= 0) jumlahJP = 1;

    // Resolve Mapel ID
    let mapelId = data.mapel_id || null;
    let mapelNama = data.mapel || '';
    if (!mapelId && mapelNama) {
      const mapelList = await this.getMataPelajaran();
      const mObj = mapelList.find(m => m.nama_mapel.toLowerCase() === mapelNama.toLowerCase());
      if (mObj) mapelId = mObj.id;
    }

    // Payload DB — sengaja TIDAK memuat user_id.
    // user_id dikelola secara eksplisit per cabang CREATE / UPDATE di bawah.
    // Memisahkan user_id dari payload mencegah ownership tertimpa pada UPDATE.
    const payload = {
      hari: data.hari || 'Senin',
      jam_mulai_id: (data.jam_mulai_id && isValidUUID(data.jam_mulai_id)) ? data.jam_mulai_id : null,
      jam_selesai_id: (data.jam_selesai_id && isValidUUID(data.jam_selesai_id)) ? data.jam_selesai_id : null,
      jam_ke_label: data.jam_ke_label || 'Jam Pelajaran',
      jam_mulai: data.jam_mulai || '07:30',
      jam_selesai: data.jam_selesai || '09:00',
      jumlah_jp: jumlahJP,
      kelas_id: data.kelas_id,
      mapel_id: (mapelId && isValidUUID(mapelId)) ? mapelId : null,
      mapel: mapelNama,
      ruangan: data.ruangan || '',
      academic_year: activeYear,
      updated_at: new Date().toISOString()
    };

    const isUpdate = Boolean(data.id && isValidUUID(data.id));
    let supabaseError = null;
    let supabaseRow   = null; // row aktual yang dikembalikan Supabase — sumber kebenaran localStorage

    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (isUpdate) {
          // UPDATE: payload tidak punya user_id → database mempertahankan owner lama.
          // .select().single() mengembalikan row lengkap termasuk user_id lama.
          const { data: updated, error } = await this.supabase
            .from('jadwal_mengajar')
            .update(payload)
            .eq('id', data.id)
            .select()
            .single();
          if (error) throw error;
          supabaseRow = updated; // updated.user_id = pemilik lama yang dipertahankan DB

        } else {
          // CREATE: wajib ada authenticated user sebelum INSERT.
          // authData.user.id adalah satu-satunya sumber user_id yang valid.
          // Jangan gunakan cache localStorage sebagai sumber user_id.
          const { data: authData, error: authError } =
            await this.supabase.auth.getUser();

          if (authError || !authData?.user?.id) {
            // Sesi tidak valid → tolak, jangan simpan user_id = null ke database
            return {
              success: false,
              id:      null,
              error:   'Sesi pengguna tidak valid. Silakan login kembali.'
            };
          }

          const currentUserId = authData.user.id;

          const { data: created, error } = await this.supabase
            .from('jadwal_mengajar')
            .insert([{
              ...payload,
              id:      isValidUUID(id) ? id : undefined,
              user_id: currentUserId // dari getUser() langsung, bukan dari cache lokal
            }])
            .select()
            .single();
          if (error) throw error;
          if (created) id = created.id;
          supabaseRow = created; // created.user_id = currentUserId, terkonfirmasi dari DB
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase saveJadwalMengajar error:', e);
      }
    }

    // LocalStorage Sync
    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
    const idx = list.findIndex(j => j.id === id || (j.id === data.id));

    let entry;

    if (supabaseRow) {
      // ONLINE (CREATE atau UPDATE berhasil):
      // Gunakan row yang dikembalikan Supabase sebagai sumber kebenaran tunggal.
      //   CREATE → supabaseRow.user_id = authData.user.id yang kita sisipkan
      //   UPDATE → supabaseRow.user_id = pemilik lama yang dipertahankan database
      // Dengan ini localStorage selalu konsisten dengan database.
      entry = { ...supabaseRow };

    } else if (isUpdate) {
      // OFFLINE UPDATE (atau UPDATE cloud gagal):
      // Pertahankan user_id existing dari localStorage jika entry ditemukan.
      // Jika idx = -1 (tidak ada di cache), simpan payload saja tanpa mengarang user_id.
      const existingEntry = idx >= 0 ? list[idx] : null;
      entry = {
        ...(existingEntry || {}), // user_id existing terlindungi jika ada
        ...payload,               // timpa field jadwal yang berubah
        id: data.id               // pastikan id tepat
        // user_id dari existingEntry selamat karena payload tidak punya key user_id
      };

    } else {
      // OFFLINE CREATE:
      // Tidak ada session yang dapat dipercaya → user_id = null.
      // Ini adalah perilaku existing yang dipertahankan untuk mode offline.
      entry = {
        id,
        ...payload,
        user_id: null
      };
    }

    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));

    return { success: !supabaseError, id, error: supabaseError?.message };
  }

  /**
   * Menghapus slot jadwal mengajar
   */
  async deleteJadwalMengajar(id) {
    this._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();
    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (isValidUUID(id)) {
          await this.supabase.from('jadwal_mengajar').delete().eq('id', id);
        }
      } catch (e) {
        console.error('Supabase deleteJadwalMengajar error:', e);
      }
    }

    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
    list = list.filter(j => j.id !== id);
    localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));
    return { success: true };
  }

  /**
   * Mengosongkan seluruh data jadwal mengajar guru (Local Storage & Supabase)
   */
  async resetJadwalMengajar() {
    this._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();
    let supabaseError = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        // Hapus seluruh baris di tabel jadwal_mengajar
        const { error } = await this.supabase
          .from('jadwal_mengajar')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      } catch (e) {
        supabaseError = e;
        console.error('Supabase resetJadwalMengajar error:', e);
      }
    }

    // Bersihkan LocalStorage
    localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify([]));
    this._invalidateCache(['jadwal_mengajar_']);

    return { success: !supabaseError, error: supabaseError?.message };
  }

  /**
   * Mengambil jadwal mengajar untuk hari/tanggal tertentu (untuk smart quick-start)
   * Menggunakan local date parsing untuk mencegah UTC shift bug.
   */
  async getJadwalHariIni(academicYear, dateStr) {
    let targetDate;
    let tanggalStr;
    if (dateStr) {
      const parts = String(dateStr).split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        targetDate = new Date(year, monthIndex, day);
        tanggalStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        targetDate = new Date(dateStr);
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        tanggalStr = `${y}-${m}-${d}`;
      }
    } else {
      targetDate = new Date();
      const y = targetDate.getFullYear();
      const m = String(targetDate.getMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getDate()).padStart(2, '0');
      tanggalStr = `${y}-${m}-${d}`;
    }
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[targetDate.getDay()];

    const allJadwal = await this.getJadwalMengajarList({ academic_year: academicYear, hari: dayName });
    return {
      hari: dayName,
      tanggal: tanggalStr,
      jadwalList: allJadwal || []
    };
  }

  /**
   * Mengambil daftar kelas unik yang diajar oleh guru yang sedang login
   * Berdasarkan penugasan pada jadwal mengajar (Strict Per-User)
   * 
   * @param {string|null} academicYear - Tahun ajaran (opsional, default active year)
   * @returns {Promise<Array<{id: string, nama_kelas: string, tingkat: string, jurusan: string, academic_year: string}>>}
   */
  async getKelasSaya(academicYear = null) {
    try {
      const activeYear = academicYear || await this.getActiveAcademicYear();

      // Ambil dari master cache (0 query DB jika sudah warm)
      const jadwalList = await this.getJadwalMengajarCached(activeYear);
      if (!jadwalList || !Array.isArray(jadwalList) || jadwalList.length === 0) return [];

      // Deduplikasi kelas menggunakan Map langsung dari relasi kelas:kelas_id
      const kelasMap = new Map();

      for (const j of jadwalList) {
        if (!j.kelas_id) continue;
        
        const kelasData = j.kelas;
        // Hanya kelas aktif yang boleh muncul jika data kelas memiliki is_active
        if (kelasData && kelasData.is_active === false) continue;

        if (!kelasMap.has(j.kelas_id)) {
          kelasMap.set(j.kelas_id, {
            id: j.kelas_id,
            nama_kelas: kelasData?.nama_kelas || j.nama_kelas || 'Kelas',
            tingkat: kelasData?.tingkat || '',
            jurusan: kelasData?.jurusan || '',
            academic_year: kelasData?.academic_year || j.academic_year || activeYear,
            is_active: kelasData?.is_active !== undefined ? kelasData.is_active : true
          });
        }
      }

      // Urutkan daftar kelas secara natural berdasarkan nama_kelas
      return Array.from(kelasMap.values()).sort((a, b) => 
        (a.nama_kelas || '').localeCompare(b.nama_kelas || '', 'id', { numeric: true, sensitivity: 'base' })
      );
    } catch (err) {
      console.error('Gagal memuat kelas dari Jadwal Mengajar:', err);
      throw err;
    }
  }

  /**
   * Mengambil daftar mata pelajaran unik yang diajar oleh guru yang sedang login
   * Jika kelasId diberikan, hanya mengembalikan mapel yang diajar di kelas tersebut
   * 
   * @param {string|null} academicYear - Tahun ajaran (opsional)
   * @param {string|null} kelasId - ID Kelas spesifik (opsional)
   * @returns {Promise<Array<{id: string, nama_mapel: string, kode: string}>>}
   */
  async getMapelSaya(academicYear = null, kelasId = null) {
    try {
      if (!kelasId) return [];

      const activeYear = academicYear || await this.getActiveAcademicYear();

      // Ambil dari master cache (0 query DB jika sudah warm)
      const allJadwal = await this.getJadwalMengajarCached(activeYear);
      if (!allJadwal || !Array.isArray(allJadwal) || allJadwal.length === 0) return [];

      // Filter by kelasId in-memory
      const jadwalList = allJadwal.filter(j => j.kelas_id === kelasId);
      if (jadwalList.length === 0) return [];

      // Deduplikasi mata pelajaran menggunakan Map
      const mapelMap = new Map();

      for (const j of jadwalList) {
        const mapelObj = j.mata_pelajaran;
        const namaMapel = mapelObj?.nama_mapel || j.mapel;
        if (!namaMapel) continue;

        const key = j.mapel_id || namaMapel;
        if (!mapelMap.has(key)) {
          mapelMap.set(key, {
            id: j.mapel_id || mapelObj?.id || key,
            nama_mapel: namaMapel,
            kode: mapelObj?.kode || ''
          });
        }
      }

      // Urutkan berdasarkan nama mapel secara rapi & natural
      return Array.from(mapelMap.values()).sort((a, b) => 
        (a.nama_mapel || '').localeCompare(b.nama_mapel || '', 'id', { numeric: true, sensitivity: 'base' })
      );
    } catch (err) {
      console.error('Gagal memuat mata pelajaran dari Jadwal Mengajar:', err);
      throw err;
    }
  }

  resetDemoData() {
    this._invalidateCache();
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(INITIAL_DATA.kelas));
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(INITIAL_DATA.siswa));
    localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(INITIAL_DATA.kegiatanSiswa));
    localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(INITIAL_DATA.checklistNotes || []));
    localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(INITIAL_DATA.nilaiTugasList || []));
    localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(INITIAL_DATA.mapelList));
    localStorage.setItem(STORAGE_KEYS.JAM_LIST, JSON.stringify(INITIAL_DATA.jamPelajaranList));
    localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(INITIAL_DATA.schoolSettings || {}));
    localStorage.setItem(STORAGE_KEYS.SESI, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify([]));
    this._invalidateCache();
    return true;
  }
}

export const db = new DataStore();
