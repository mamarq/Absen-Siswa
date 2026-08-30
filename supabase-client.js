function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// supabase-client.js - Database Access Layer (Supabase + LocalStorage Fallback)
import { INITIAL_DATA } from './data/initialData.js';

const STORAGE_KEYS = {
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
  PR_NILAI_SISWA: 'absen_db_pr_nilai_siswa'
};

class DataStore {
  constructor() {
    this.supabase = null;
    this.isSupabaseConnected = false;
    this.initLocalStorage();
    this.initSupabaseClient();
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
      localStorage.setItem(STORAGE_KEYS.JAM_LIST, JSON.stringify(INITIAL_DATA.jamPelajaranList));
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
        this.supabase = window.supabase.createClient(url, key);
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
      const client = window.supabase.createClient(url, key);
      // Test query
      const { error } = await client.from('kelas').select('id').limit(1);
      if (error) throw error;

      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ url, key }));
      this.supabase = client;
      this.isSupabaseConnected = true;
      return { success: true, message: 'Koneksi ke Supabase berhasil!' };
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
        totalTables: 11,
        existingCount: 0,
        missingCount: 11,
        isFullyInstalled: false,
        rpcExists: false,
        message: 'Aplikasi belum terhubung ke project Supabase Cloud.',
        tables: []
      };
    }

    const tableDefs = [
      { name: 'kelas', label: 'Data Kelas & Rombel', desc: 'Rombel kelas, tingkat, jurusan, & academic_year' },
      { name: 'mata_pelajaran', label: 'Master Mata Pelajaran', desc: 'Daftar mapel dan kategori (Umum/Kejuruan)' },
      { name: 'siswa', label: 'Data Siswa', desc: 'Identitas siswa, NISN, no absen, & kelas_id' },
      { name: 'sesi_mengajar', label: 'Sesi Mengajar', desc: 'Pertemuan KBM kelas, mapel, & tanggal' },
      { name: 'absensi', label: 'Absensi / Presensi Siswa', desc: 'Status kehadiran H/S/I/A per sesi' },
      { name: 'jurnal_mengajar', label: 'Jurnal Pembelajaran', desc: 'Materi pokok, kegiatan, & kendala guru' },
      { name: 'catatan_checklist', label: 'Catatan Ceklis & Tugas', desc: 'Ceklis ketuntasan & fitur Bebas Catatan' },
      { name: 'nilai_tugas', label: 'Penilaian Nilai Tugas', desc: 'Nilai tugas siswa & fitur Bebas Tugas' },
      { name: 'kegiatan_siswa', label: 'Catatan Kegiatan Siswa', desc: 'Keaktifan, dispensasi, pelanggaran siswa' },
      { name: 'pr_tugas', label: 'Pekerjaan Rumah (PR)', desc: 'Penugasan PR 2 tahap (menunggu / selesai diperiksa)' },
      { name: 'pr_nilai_siswa', label: 'Nilai PR Siswa', desc: 'Detail nilai & status pengumpulan PR per siswa' },
      { name: 'school_settings', label: 'Pengaturan Data Sekolah', desc: 'Nama sekolah, instansi, alamat, & logo' },
      { name: 'profil_guru', label: 'Profil Guru & Kepala Sekolah', desc: 'Pejabat penandatangan laporan & NIP' }
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
          { nama_mapel: 'Informatika', kategori: 'Umum' },
          { nama_mapel: 'Matematika', kategori: 'Umum' },
          { nama_mapel: 'Bahasa Indonesia', kategori: 'Umum' },
          { nama_mapel: 'Bahasa Inggris', kategori: 'Umum' },
          { nama_mapel: 'Pendidikan Pancasila', kategori: 'Umum' },
          { nama_mapel: 'Koding dan Kecerdasan Artifisial', kategori: 'Umum' },
          { nama_mapel: 'Konsentrasi Kejuruan', kategori: 'Kejuruan' },
          { nama_mapel: 'Projek Kreatif dan Kewirausahaan', kategori: 'Kejuruan' }
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

      // 3. Seed Profil Guru jika kosong
      const { data: existingProfil } = await this.supabase.from('profil_guru').select('id').limit(1);
      if (!existingProfil || existingProfil.length === 0) {
        const currentLocalProfil = this.getProfilGuru();
        await this.supabase.from('profil_guru').insert([{
          nama_guru: currentLocalProfil.nama_guru || 'Guru Mata Pelajaran',
          nip_guru: currentLocalProfil.nip_guru || '',
          nama_sekolah: currentLocalProfil.nama_sekolah || 'Nama Sekolah Anda',
          nama_kepsek: currentLocalProfil.nama_kepsek || 'Kepala Sekolah',
          nip_kepsek: currentLocalProfil.nip_kepsek || '',
          kota: currentLocalProfil.kota || 'Kota'
        }]);
      }

      return { success: true, message: 'Data awal (seed) berhasil diinisialisasi ke Supabase Cloud!' };
    } catch (err) {
      return { success: false, message: `Gagal inisialisasi data awal: ${err.message}` };
    }
  }

  // ==========================================================================
  // DATA SEKOLAH & KOP LAPORAN (SINGLE SOURCE OF TRUTH)
  // ==========================================================================
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
        this.saveProfilGuru({ ...profil, nama_sekolah: updated.nama_sekolah });
      }

      // Sync ke Supabase table school_settings jika terhubung
      if (this.isSupabaseConnected && this.supabase) {
        try {
          await this.supabase.from('school_settings').upsert([{
            id: 1,
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
          }]);
        } catch (errSup) {
          console.warn('Supabase saveSchoolSettings sync warning:', errSup);
        }
      }

      return { success: true, message: 'Data sekolah berhasil disimpan!' };
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan data sekolah: ' + e.message };
    }
  }

  // ==========================================================================
  // PROFIL GURU & IDENTITAS SEKOLAH (UNTUK CETAK LAPORAN RESMI)
  // ==========================================================================
  getProfilGuru() {
    const school = this.getSchoolSettings();
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFIL_GURU) || '{}');
      return {
        nama_guru: p.nama_guru || 'Ammar, S.Pd.',
        nip_guru: p.nip_guru || '',
        nama_sekolah: p.nama_sekolah || school?.nama_sekolah || 'SMKN 1 Bantaeng',
        nama_kepsek: p.nama_kepsek || 'Drs. H. Syamsuddin, M.Pd.',
        nip_kepsek: p.nip_kepsek || '',
        kota: p.kota || 'Bantaeng'
      };
    } catch {
      return {
        nama_guru: 'Ammar, S.Pd.',
        nip_guru: '',
        nama_sekolah: school?.nama_sekolah || 'SMKN 1 Bantaeng',
        nama_kepsek: 'Drs. H. Syamsuddin, M.Pd.',
        nip_kepsek: '',
        kota: 'Bantaeng'
      };
    }
  }

  saveProfilGuru(profil) {
    try {
      const current = this.getProfilGuru();
      const updated = {
        ...current,
        ...profil,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.PROFIL_GURU, JSON.stringify(updated));
      return { success: true, message: 'Profil guru & tanda tangan berhasil disimpan!' };
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan profil: ' + e.message };
    }
  }

  // ==========================================================================
  // AUTENTIKASI & USER MANAGEMENT
  // ==========================================================================
  async getCurrentUser() {
    // 1. Cek sesi lokal terlebih dahulu untuk respons 0ms
    const localUser = localStorage.getItem('absen_local_auth_user');
    if (localUser) {
      try {
        return JSON.parse(localUser);
      } catch {
        // ignore
      }
    }

    // 2. Cek sesi Supabase jika terhubung
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
        const userPromise = this.supabase.auth.getUser();
        const res = await Promise.race([userPromise, timeoutPromise]);
        if (res && res.data && res.data.user) {
          const user = {
            id: res.data.user.id,
            email: res.data.user.email,
            name: res.data.user.user_metadata?.full_name || 'Muammar Qadafie',
            role: 'Guru Mata Pelajaran',
            isCloud: true
          };
          localStorage.setItem('absen_local_auth_user', JSON.stringify(user));
          return user;
        }
      } catch (e) {
        console.warn('Check Supabase auth user:', e);
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
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
        const authPromise = this.supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPwd
        });
        const res = await Promise.race([authPromise, timeoutPromise]);
        if (res && res.data && res.data.user && !res.error) {
          const user = {
            id: res.data.user.id,
            email: res.data.user.email,
            name: res.data.user.user_metadata?.full_name || 'Muammar Qadafie',
            role: 'Guru Mata Pelajaran',
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
      role: 'Guru Mata Pelajaran',
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
          jurusan: k.jurusan || 'Kejuruan',
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
          html += `<option value="${k.id}" ${isSel}>${k.nama_kelas} (${k.jurusan || 'Kejuruan'})</option>`;
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

    return years.sort().reverse();
  }

  async getActiveAcademicYear() {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kelas')
          .select('academic_year')
          .eq('is_active', true)
          .limit(1);
        if (!error && data && data.length > 0 && data[0].academic_year) {
          return data[0].academic_year;
        }
      } catch (e) {
        console.warn('Supabase getActiveAcademicYear fallback:', e);
      }
    }

    const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    const activeKelas = allKelas.find(k => k.is_active === true && k.academic_year);
    if (activeKelas) return activeKelas.academic_year;

    const allYears = await this.getDistinctAcademicYears();
    return allYears[0] || '2026/2027';
  }

  // Wrapper Query getClassesByYear (Bagian 1)
  async getClassesByYear(academicYear, onlyActive = false) {
    return this.getKelasByTahunAjaran(academicYear, onlyActive);
  }

  async getKelasByTahunAjaran(academicYear, onlyActive = false) {
    let result = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase.from('kelas').select('*');
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
    }

    return this.groupAndSortKelas(result);
  }

  // Wrapper Query getSessionsByYear (Bagian 1)
  async getSessionsByYear(academicYear) {
    return this.getAllSesiByYear(academicYear);
  }

  async getAllSesiByYear(academicYear) {
    const allSesi = await this.getAllSesi();
    if (!academicYear) return allSesi;

    const kelasInYear = await this.getKelasByTahunAjaran(academicYear, false);
    const kelasIds = new Set(kelasInYear.map(k => k.id));

    return allSesi.filter(s => kelasIds.has(s.kelas_id));
  }

  async getKelas(academicYear) {
    if (academicYear) {
      return this.getKelasByTahunAjaran(academicYear);
    }
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('kelas').select('*').order('nama_kelas');
        if (!error && data && data.length > 0) return this.groupAndSortKelas(data);
      } catch (e) {
        console.warn('Supabase getKelas fallback:', e);
      }
    }
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    return this.groupAndSortKelas(raw);
  }

  async addKelas(kelasData) {
    const newKelas = {
      id: 'k-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nama_kelas: kelasData.nama_kelas.trim(),
      tingkat: kelasData.tingkat || 'X',
      jurusan: kelasData.jurusan || 'Teknik Jaringan Komputer dan Telekomunikasi',
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
            jurusan: newKelas.jurusan,
            academic_year: newKelas.academic_year,
            is_active: newKelas.is_active
          }])
          .select()
          .single();
        if (!error && data) return data;
        if (error) console.error('Supabase addKelas error:', error);
      } catch (err) {
        console.warn('Supabase addKelas catch:', err);
      }
    }

    const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    allKelas.push(newKelas);
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(allKelas));
    return newKelas;
  }

  async updateKelas(id, updatedData) {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('kelas')
          .update(updatedData)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase updateKelas catch:', err);
      }
    }

    let allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    allKelas = allKelas.map(k => (k.id === id ? { ...k, ...updatedData } : k));
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(allKelas));
    return true;
  }

  async deleteKelas(id) {
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

    return true;
  }

  // ==========================================================================
  // MASTER MATA PELAJARAN (CRUD)
  // ==========================================================================
  async getMataPelajaran() {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('mata_pelajaran').select('*').order('nama_mapel');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase getMataPelajaran fallback:', e);
      }
    }

    let raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.MATA_PELAJARAN) || 'null');
    if (!raw || raw.length === 0) {
      const oldList = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAPEL_LIST) || '[]');
      if (oldList.length > 0) {
        raw = oldList.map((m, idx) => ({
          id: 'mp-' + (idx + 1),
          nama_mapel: typeof m === 'string' ? m : m.nama_mapel || 'Mapel',
          kode: (typeof m === 'string' ? m : m.kode || 'MPL').substring(0, 4).toUpperCase(),
          kategori: 'Umum'
        }));
      } else {
        raw = INITIAL_DATA.mataPelajaran;
      }
      localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(raw));
    }
    return raw;
  }

  async getMapelList() {
    const list = await this.getMataPelajaran();
    return list.map(m => m.nama_mapel);
  }

  async addMataPelajaran(mapelData) {
    const newMapel = {
      id: 'mp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nama_mapel: mapelData.nama_mapel.trim(),
      kode: (mapelData.kode || '').trim().toUpperCase() || mapelData.nama_mapel.substring(0, 3).toUpperCase(),
      kategori: mapelData.kategori || 'Umum'
    };

    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('mata_pelajaran').insert([{
          nama_mapel: newMapel.nama_mapel,
          kode: newMapel.kode,
          kategori: newMapel.kategori
        }]).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase addMataPelajaran error:', e);
      }
    }

    const list = await this.getMataPelajaran();
    list.push(newMapel);
    localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(list.map(m => m.nama_mapel)));
    return newMapel;
  }

  async updateMataPelajaran(id, updatedData) {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('mata_pelajaran').update({
          nama_mapel: updatedData.nama_mapel.trim(),
          kode: (updatedData.kode || '').trim().toUpperCase(),
          kategori: updatedData.kategori || 'Umum'
        }).eq('id', id).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase updateMataPelajaran error:', e);
      }
    }

    let list = await this.getMataPelajaran();
    list = list.map(m => (m.id === id ? { ...m, ...updatedData } : m));
    localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(list.map(m => m.nama_mapel)));
    return true;
  }

  async deleteMataPelajaran(id) {
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
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('siswa')
        .select('*')
        .order('nomor_absen', { ascending: true })
        .order('nama_lengkap', { ascending: true });
      if (!error && data) return data;
    }

    const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    return allSiswa;
  }

  async getSiswaByKelas(kelasId, onlyActive = false) {
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
      if (!error && data) return data;
    }

    const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    return allSiswa
      .filter(s => s.kelas_id === kelasId && (!onlyActive || s.is_active !== false))
      .sort((a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999) || a.nama_lengkap.localeCompare(b.nama_lengkap));
  }

  async addSiswa(siswaData) {
    const newSiswa = {
      id: 's-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      ...siswaData
    };

    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase.from('siswa').insert([siswaData]).select().single();
      if (!error && data) return data;
    }

    const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa.push(newSiswa);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    return newSiswa;
  }

  async updateSiswa(id, updatedData) {
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase.from('siswa').update(updatedData).eq('id', id).select().single();
      if (!error && data) return data;
    }

    let allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa = allSiswa.map(s => (s.id === id ? { ...s, ...updatedData } : s));
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    return true;
  }

  async deleteSiswa(id) {
    if (this.isSupabaseConnected && this.supabase) {
      await this.supabase.from('siswa').delete().eq('id', id);
    }
    let allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa = allSiswa.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    return true;
  }

  async bulkImportSiswa(kelasId, namesList) {
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
    return newEntries;
  }

  // ==========================================================================
  // KEGIATAN SISWA & BADGES
  // ==========================================================================
  async getKegiatanSiswaByTanggal(tanggal) {
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('kegiatan_siswa')
        .select('*, siswa:siswa_id(nama_lengkap, kelas_id, nomor_absen)')
        .eq('tanggal', tanggal);
      if (!error && data) return data;
    }

    const allKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
    const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');

    return allKegiatan
      .filter(k => k.tanggal === tanggal)
      .map(k => {
        const s = allSiswa.find(x => x.id === k.siswa_id);
        return {
          ...k,
          siswa: s ? { nama_lengkap: s.nama_lengkap, kelas_id: s.kelas_id, nomor_absen: s.nomor_absen } : null
        };
      });
  }

  async getAllKegiatanSiswa(academicYear) {
    let rawData = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase.from('kegiatan_siswa').select('*').order('tanggal', { ascending: false });
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
      rawData = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
      if (academicYear) {
        rawData = rawData.filter(k => !k.academic_year || k.academic_year === academicYear);
      }
    }

    let allSiswa = [];
    try {
      allSiswa = await this.getSiswa();
    } catch {
      allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    }

    const siswaMap = new Map(allSiswa.map(s => [s.id, s]));

    return rawData
      .map(k => {
        const s = siswaMap.get(k.siswa_id);
        return {
          ...k,
          siswa: s ? { nama_lengkap: s.nama_lengkap, kelas_id: s.kelas_id, nomor_absen: s.nomor_absen } : (k.siswa || null)
        };
      })
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }

  async getKegiatanSiswaBySiswa(siswaId) {
    const list = await this.getAllKegiatanSiswa();
    return list.filter(k => k.siswa_id === siswaId);
  }

  async addKegiatanSiswa(kegiatanData) {
    const newItem = {
      id: 'act-' + Date.now(),
      created_at: new Date().toISOString(),
      ...kegiatanData
    };

    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase.from('kegiatan_siswa').insert([kegiatanData]).select().single();
      if (!error && data) return data;
    }

    const allKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
    allKegiatan.unshift(newItem);
    localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(allKegiatan));
    return newItem;
  }

  async deleteKegiatanSiswa(id) {
    if (this.isSupabaseConnected && this.supabase) {
      await this.supabase.from('kegiatan_siswa').delete().eq('id', id);
    }
    let allKegiatan = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
    allKegiatan = allKegiatan.filter(k => k.id !== id);
    localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(allKegiatan));
    return true;
  }

  // ==========================================================================
  // CATATAN CEKLIS SISWA (BENTUK CEKLIS ABSEN PER SISWA HARI ITU)
  // ==========================================================================
  // CATATAN CEKLIS SISWA (BENTUK CEKLIS ABSEN PER SISWA HARI ITU)
  // ==========================================================================
  async getAllChecklist(academicYear) {
    let list = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        // Coba tabel catatan_checklist (nama tabel skema asli)
        let q = this.supabase.from('catatan_checklist').select('*').order('tanggal', { ascending: false });
        if (academicYear) {
          q = q.or(`academic_year.eq.${academicYear},academic_year.is.null`);
        }
        let { data, error } = await q;
        if (!error && data && data.length > 0) {
          list = data;
        } else {
          // Coba fallback tabel checklist_catatan
          let q2 = this.supabase.from('checklist_catatan').select('*').order('tanggal', { ascending: false });
          if (academicYear) {
            q2 = q2.or(`academic_year.eq.${academicYear},academic_year.is.null`);
          }
          let { data: d2, error: e2 } = await q2;
          if (!e2 && d2 && d2.length > 0) list = d2;
        }
      } catch (e) {
        console.warn('Supabase getAllChecklist fallback:', e);
      }
    }
    if (list.length === 0) {
      list = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]');
      if (academicYear) {
        list = list.filter(c => !c.academic_year || c.academic_year === academicYear);
      }
    }
    const allKelas = await this.getKelas(academicYear);
    return list.map(c => {
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
  }

  async getChecklistById(id) {
    const list = await this.getAllChecklist();
    return list.find(c => c.id === id) || null;
  }

  async getChecklistHariIni(tanggal) {
    const list = await this.getAllChecklist();
    return list.filter(c => c.tanggal === tanggal);
  }

  async getChecklistByKelasAndTanggal(kelasId, tanggal) {
    const list = await this.getAllChecklist();
    return list.filter(c => (c.kelas_id === kelasId || c.kelas?.id === kelasId) && c.tanggal === tanggal);
  }

  async saveChecklist(data) {
    const timestamp = new Date().toISOString();
    let id = data.id;
    const isDbUUID = isValidUUID(id);
    const currentYear = data.academic_year || await this.getActiveAcademicYear();
    const allKelas = await this.getKelas();
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
          let { data: updatedData, error: err1 } = await this.supabase
            .from('catatan_checklist')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
          if (err1) {
            let { data: updatedData2, error: err2 } = await this.supabase
              .from('checklist_catatan')
              .update(payload)
              .eq('id', id)
              .select()
              .single();
            if (err2) {
              supabaseError = err2;
            } else {
              savedFromSupabase = updatedData2;
            }
          } else {
            savedFromSupabase = updatedData;
          }
        } else {
          let { data: insertedData, error: err1 } = await this.supabase
            .from('catatan_checklist')
            .insert([{ ...payload, created_at: timestamp }])
            .select()
            .single();
          if (err1) {
            let { data: insertedData2, error: err2 } = await this.supabase
              .from('checklist_catatan')
              .insert([{ ...payload, created_at: timestamp }])
              .select()
              .single();
            if (err2) {
              supabaseError = err2;
            } else {
              savedFromSupabase = insertedData2;
            }
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
    const localEntry = {
      id,
      ...payload,
      kelas_nama: kelasNama,
      created_at: timestamp
    };
    list = list.filter(c => c.id !== id);
    list.unshift(localEntry);
    localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(list));

    if (supabaseError) {
      console.error('Gagal menyimpan Catatan Ceklis ke Supabase:', supabaseError);
      return {
        success: false,
        error: supabaseError.message || String(supabaseError),
        id,
        savedLocally: true
      };
    }

    return { success: true, id };
  }

  async deleteChecklist(id) {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase.from('catatan_checklist').delete().eq('id', id);
        await this.supabase.from('checklist_catatan').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase deleteChecklist error:', e);
      }
    }
    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]');
    list = list.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(list));
    return true;
  }

  // ==========================================================================
  // NILAI TUGAS (BENTUK NILAI SEDERHANA PER SISWA)
  // ==========================================================================
  async getAllNilaiTugas(academicYear) {
    let list = [];
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let q = this.supabase.from('nilai_tugas').select('*').order('tanggal', { ascending: false });
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
      list = JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]');
      if (academicYear) {
        list = list.filter(nt => !nt.academic_year || nt.academic_year === academicYear);
      }
    }
    const allKelas = await this.getKelas(academicYear);
    return list.map(nt => {
      const foundKelas = allKelas.find(k => k.id === nt.kelas_id || k.nama_kelas === nt.kelas_id);
      return {
        ...nt,
        kelas: foundKelas || {
          id: nt.kelas_id,
          nama_kelas: nt.kelas_nama || (nt.kelas_id && !nt.kelas_id.startsWith('nt-') && !nt.kelas_id.includes('-') ? nt.kelas_id : 'Kelas')
        }
      };
    }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }

  async getNilaiTugasById(id) {
    const list = await this.getAllNilaiTugas();
    return list.find(nt => nt.id === id) || null;
  }

  async getNilaiTugasHariIni(tanggal) {
    const list = await this.getAllNilaiTugas();
    return list.filter(nt => nt.tanggal === tanggal);
  }

  async saveNilaiTugas(data) {
    const timestamp = new Date().toISOString();
    let id = data.id;
    const isDbUUID = isValidUUID(id);
    const currentYear = data.academic_year || await this.getActiveAcademicYear();
    const allKelas = await this.getKelas();
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
      academic_year: currentYear,
      updated_at: timestamp
    };

    let supabaseError = null;
    let savedFromSupabase = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        if (isDbUUID) {
          const { data: updatedData, error } = await this.supabase
            .from('nilai_tugas')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
          if (error) {
            supabaseError = error;
          } else {
            savedFromSupabase = updatedData;
          }
        } else {
          const { data: insertedData, error } = await this.supabase
            .from('nilai_tugas')
            .insert([{ ...payload, created_at: timestamp }])
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
    const localEntry = {
      id,
      ...payload,
      kelas_nama: kelasNama,
      created_at: timestamp
    };
    list = list.filter(nt => nt.id !== id);
    list.unshift(localEntry);
    localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(list));

    if (supabaseError) {
      console.error('Gagal menyimpan Nilai Tugas ke Supabase:', supabaseError);
      return {
        success: false,
        error: supabaseError.message || String(supabaseError),
        id,
        savedLocally: true
      };
    }

    return { success: true, id };
  }

  async deleteNilaiTugas(id) {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase.from('nilai_tugas').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase deleteNilaiTugas error:', e);
      }
    }
    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]');
    list = list.filter(nt => nt.id !== id);
    localStorage.setItem(STORAGE_KEYS.NILAI_TUGAS, JSON.stringify(list));
    return true;
  }

  // ==========================================================================
  // PEKERJAAN RUMAH (PR) - MASTER TUGAS & NILAI SISWA (2 TAHAP: PEMBERIAN & PEMERIKSAAN)
  // ==========================================================================

  /**
   * Mengambil daftar PR dengan filter status, kelas_id, dan academic_year
   */
  async getPRList({ status, kelas_id, academic_year } = {}) {
    const activeYear = academic_year || await this.getActiveAcademicYear();

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
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase getPRList fallback:', e);
      }
    }

    // Fallback Local Storage
    const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const allNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
    const allKelas = await this.getKelas();
    const allMapel = await this.getMataPelajaran();

    const kelasMap = new Map(allKelas.map(k => [k.id, k]));
    const mapelMap = new Map(allMapel.map(m => [m.id, m]));

    let filtered = allPR.map(pr => {
      const k = kelasMap.get(pr.kelas_id) || null;
      const m = pr.mapel_id ? mapelMap.get(pr.mapel_id) : null;
      const nilaiRows = allNilai.filter(n => n.pr_tugas_id === pr.id);
      return {
        ...pr,
        kelas: k,
        mata_pelajaran: m,
        pr_nilai_siswa: nilaiRows
      };
    });

    if (status) {
      filtered = filtered.filter(pr => pr.status === status);
    }
    if (kelas_id) {
      filtered = filtered.filter(pr => pr.kelas_id === kelas_id);
    }
    if (activeYear) {
      filtered = filtered.filter(pr => pr.academic_year === activeYear || (pr.kelas && pr.kelas.academic_year === activeYear));
    }

    return filtered.sort((a, b) => new Date(b.tanggal_diberikan) - new Date(a.tanggal_diberikan));
  }

  /**
   * Mengambil detail satu PR beserta daftar siswa dan nilai
   */
  async getPRDetail(prId) {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('pr_tugas')
          .select(`
            *,
            kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year),
            mata_pelajaran:mapel_id (id, nama_mapel, kode, kategori),
            pr_nilai_siswa (
              *,
              siswa:siswa_id (id, nama_lengkap, nisn, nomor_absen, jenis_kelamin, is_active)
            )
          `)
          .eq('id', prId)
          .single();

        if (!error && data) {
          if (data.pr_nilai_siswa) {
            data.pr_nilai_siswa.sort((a, b) => (a.siswa?.nomor_absen || 999) - (b.siswa?.nomor_absen || 999) || (a.siswa?.nama_lengkap || '').localeCompare(b.siswa?.nama_lengkap || ''));
          }
          return data;
        }
      } catch (e) {
        console.warn('Supabase getPRDetail fallback:', e);
      }
    }

    // Fallback Local Storage
    const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const targetPR = allPR.find(p => p.id === prId);
    if (!targetPR) return null;

    const allKelas = await this.getKelas();
    const allMapel = await this.getMataPelajaran();
    const allSiswa = await this.getSiswaByKelas(targetPR.kelas_id, false);
    const allNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');

    const siswaMap = new Map(allSiswa.map(s => [s.id, s]));
    let nilaiRows = allNilai.filter(n => n.pr_tugas_id === prId).map(n => ({
      ...n,
      siswa: siswaMap.get(n.siswa_id) || null
    }));

    if (nilaiRows.length === 0) {
      const activeSiswa = allSiswa.filter(s => s.is_active !== false);
      nilaiRows = activeSiswa.map(s => ({
        id: 'prn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        pr_tugas_id: prId,
        siswa_id: s.id,
        nilai: null,
        mengumpulkan: true,
        tanggal_diperiksa: null,
        catatan: null,
        siswa: s
      }));
    }

    nilaiRows.sort((a, b) => (a.siswa?.nomor_absen || 999) - (b.siswa?.nomor_absen || 999) || (a.siswa?.nama_lengkap || '').localeCompare(b.siswa?.nama_lengkap || ''));

    return {
      ...targetPR,
      kelas: allKelas.find(k => k.id === targetPR.kelas_id) || null,
      mata_pelajaran: targetPR.mapel_id ? allMapel.find(m => m.id === targetPR.mapel_id) : null,
      pr_nilai_siswa: nilaiRows
    };
  }

  /**
   * Membuat penugasan PR baru dan otomatis meng-generate baris awal pr_nilai_siswa
   */
  async createPR(data) {
    const timestamp = new Date().toISOString();
    const currentYear = data.academic_year || await this.getActiveAcademicYear();

    const payload = {
      kelas_id: data.kelas_id,
      mapel_id: data.mapel_id || null,
      topik: (data.topik || '').trim(),
      tanggal_diberikan: data.tanggal_diberikan || new Date().toISOString().split('T')[0],
      status: 'menunggu',
      academic_year: currentYear,
      updated_at: timestamp
    };

    let prId = data.id || ('pr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4));
    let supabaseError = null;

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

          await this.supabase.from('pr_nilai_siswa').insert(initialNilaiRows);
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase createPR error:', e);
      }
    }

    // Simpan ke Cache Offline LocalStorage
    const localPREntry = { id: prId, ...payload, created_at: timestamp };
    let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    prList = prList.filter(p => p.id !== prId);
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

    return { success: !supabaseError, id: prId, error: supabaseError?.message };
  }

  /**
   * Submit hasil pemeriksaan nilai PR per siswa dan ubah status pr_tugas jadi 'selesai_diperiksa'
   */
  async submitPemeriksaanPR(prId, { items = [], tanggal_diperiksa } = {}) {
    const timestamp = new Date().toISOString();
    const checkDate = tanggal_diperiksa || timestamp;
    let supabaseError = null;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        // 1. Update status pr_tugas
        const { error: prErr } = await this.supabase
          .from('pr_tugas')
          .update({
            status: 'selesai_diperiksa',
            updated_at: timestamp
          })
          .eq('id', prId);

        if (prErr) throw prErr;

        // 2. Upsert masing-masing baris nilai siswa
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

    // Update LocalStorage
    let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const targetPR = prList.find(p => p.id === prId);
    if (targetPR) {
      targetPR.status = 'selesai_diperiksa';
      targetPR.updated_at = timestamp;
      localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));
    }

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

    return { success: !supabaseError, error: supabaseError?.message };
  }

  /**
   * Hapus penugasan PR dan seluruh detail nilainya
   */
  async deletePR(prId) {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        await this.supabase.from('pr_tugas').delete().eq('id', prId);
      } catch (e) {
        console.warn('Supabase deletePR error:', e);
      }
    }

    let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    prList = prList.filter(p => p.id !== prId);
    localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));

    let allPRNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
    allPRNilai = allPRNilai.filter(n => n.pr_tugas_id !== prId);
    localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(allPRNilai));

    return true;
  }

  /**
   * Menghitung jumlah PR dengan status 'menunggu' untuk badge notifikasi sidebar
   */
  async getPendingPRCount(academicYear) {
    const activeYear = academicYear || await this.getActiveAcademicYear();

    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase
          .from('pr_tugas')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'menunggu');

        if (activeYear) {
          query = query.eq('academic_year', activeYear);
        }

        const { count, error } = await query;
        if (!error && count !== null) return count;
      } catch (e) {
        console.warn('Supabase getPendingPRCount fallback:', e);
      }
    }

    const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const allKelas = await this.getKelas();
    const kelasMap = new Map(allKelas.map(k => [k.id, k]));

    const pending = allPR.filter(pr => {
      if (pr.status !== 'menunggu') return false;
      if (!activeYear) return true;
      if (pr.academic_year === activeYear) return true;
      const k = kelasMap.get(pr.kelas_id);
      return k && k.academic_year === activeYear;
    });

    return pending.length;
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
  // SESI MENGAJAR & ABSENSI & JURNAL
  // ==========================================================================
  async findSesi(kelasId, mapel, tanggal) {
    if (this.isSupabaseConnected && this.supabase) {
      try {
        let query = this.supabase
          .from('sesi_mengajar')
          .select('*, absensi(*), jurnal_mengajar(*)')
          .eq('kelas_id', kelasId)
          .eq('mapel', mapel)
          .eq('tanggal', tanggal);

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          if (!data.absensi || data.absensi.length === 0) {
            const { data: directAbs } = await this.supabase.from('absensi').select('*').eq('sesi_id', data.id);
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

    const allSesi = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI) || '[]');
    const matchingSesi = allSesi.find(s =>
      s.kelas_id === kelasId &&
      s.mapel === mapel &&
      s.tanggal === tanggal
    );

    if (!matchingSesi) return null;

    const allAbsensi = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    const allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');

    return {
      ...matchingSesi,
      absensi: allAbsensi.filter(a => a.sesi_id === matchingSesi.id),
      jurnal_mengajar: allJurnal.find(j => j.sesi_id === matchingSesi.id) || null
    };
  }

  async getAllSesi() {
    if (this.isSupabaseConnected && this.supabase) {
      const { data, error } = await this.supabase
        .from('sesi_mengajar')
        .select('*, kelas:kelas_id(nama_kelas), absensi(*), jurnal_mengajar(*)')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    }

    const allSesi = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI) || '[]');
    const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    const allAbsensi = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    const allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');

    return allSesi
      .map(sesi => {
        const k = allKelas.find(x => x.id === sesi.kelas_id);
        return {
          ...sesi,
          kelas: k ? { nama_kelas: k.nama_kelas } : { nama_kelas: 'Kelas' },
          absensi: allAbsensi.filter(a => a.sesi_id === sesi.id),
          jurnal_mengajar: allJurnal.find(j => j.sesi_id === sesi.id) || null
        };
      })
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }

  async saveSesi({ sesiData, absensiList, jurnalData }) {
    const timestamp = new Date().toISOString();
    let sesiId = sesiData.id;
    let supabaseSuccess = false;

    if (this.isSupabaseConnected && this.supabase) {
      try {
        let savedSesi;
        if (sesiId) {
          const { data, error } = await this.supabase
            .from('sesi_mengajar')
            .update({
              kelas_id: sesiData.kelas_id,
              mapel: sesiData.mapel,
              tanggal: sesiData.tanggal,
              catatan_sesi: sesiData.catatan_sesi || '',
              updated_at: timestamp
            })
            .eq('id', sesiId)
            .select()
            .single();
          if (error) throw error;
          savedSesi = data;
        } else {
          const { data, error } = await this.supabase
            .from('sesi_mengajar')
            .insert([{
              kelas_id: sesiData.kelas_id,
              mapel: sesiData.mapel,
              tanggal: sesiData.tanggal,
              catatan_sesi: sesiData.catatan_sesi || '',
              created_at: timestamp,
              updated_at: timestamp
            }])
            .select()
            .single();
          if (error) throw error;
          savedSesi = data;
          sesiId = savedSesi.id;
        }

        // Hapus absensi lama sesi ini lalu insert baru
        await this.supabase.from('absensi').delete().eq('sesi_id', sesiId);
        if (absensiList && absensiList.length > 0) {
          const absensiToInsert = absensiList.map(a => ({
            sesi_id: sesiId,
            siswa_id: a.siswa_id,
            status: a.status || 'Hadir',
            catatan: a.catatan || ''
          }));
          const { error: absError } = await this.supabase.from('absensi').insert(absensiToInsert);
          if (absError) console.warn('Supabase insert absensi warning:', absError.message);
        }

        // Simpan jurnal jika ada
        if (jurnalData && (jurnalData.materi_pokok || jurnalData.kegiatan_pembelajaran)) {
          await this.supabase.from('jurnal_mengajar').delete().eq('sesi_id', sesiId);
          await this.supabase.from('jurnal_mengajar').insert([{
            sesi_id: sesiId,
            materi_pokok: jurnalData.materi_pokok || '-',
            kegiatan_pembelajaran: jurnalData.kegiatan_pembelajaran || '',
            kendala_refleksi: jurnalData.kendala_refleksi || '',
            created_at: timestamp,
            updated_at: timestamp
          }]);
        }

        supabaseSuccess = true;
      } catch (err) {
        console.warn('Gagal simpan ke Supabase, fallback ke LocalStorage:', err);
      }
    }

    // SELALU SINKRONKAN JUGA KE LOCAL STORAGE SEBAGAI OFFLINE CACHE
    let allSesi = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI) || '[]');
    let allAbsensi = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    let allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');

    if (!sesiId) {
      // Periksa apakah sudah ada sesi dengan kelas + mapel + tanggal yang sama
      const existing = allSesi.find(s =>
        s.kelas_id === sesiData.kelas_id &&
        s.mapel === sesiData.mapel &&
        s.tanggal === sesiData.tanggal
      );
      if (existing) {
        sesiId = existing.id;
      } else {
        sesiId = 'sesi-' + Date.now();
      }
    }

    const sesiObject = {
      id: sesiId,
      kelas_id: sesiData.kelas_id,
      mapel: sesiData.mapel,
      tanggal: sesiData.tanggal,
      catatan_sesi: sesiData.catatan_sesi || '',
      created_at: timestamp,
      updated_at: timestamp
    };

    allSesi = allSesi.filter(s => s.id !== sesiId);
    allSesi.unshift(sesiObject);
    localStorage.setItem(STORAGE_KEYS.SESI, JSON.stringify(allSesi));

    // Update Absensi di LocalStorage
    allAbsensi = allAbsensi.filter(a => a.sesi_id !== sesiId);
    if (absensiList && absensiList.length > 0) {
      const newAbsensi = absensiList.map(a => ({
        id: 'abs-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        sesi_id: sesiId,
        siswa_id: a.siswa_id,
        status: a.status || 'Hadir',
        catatan: a.catatan || '',
        created_at: timestamp
      }));
      allAbsensi.push(...newAbsensi);
    }
    localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify(allAbsensi));

    // Update Jurnal di LocalStorage
    allJurnal = allJurnal.filter(j => j.sesi_id !== sesiId);
    if (jurnalData && (jurnalData.materi_pokok || jurnalData.kegiatan_pembelajaran)) {
      allJurnal.push({
        id: 'jur-' + Date.now(),
        sesi_id: sesiId,
        materi_pokok: jurnalData.materi_pokok || '-',
        kegiatan_pembelajaran: jurnalData.kegiatan_pembelajaran || '',
        kendala_refleksi: jurnalData.kendala_refleksi || '',
        created_at: timestamp,
        updated_at: timestamp
      });
    }
    localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify(allJurnal));

    return {
      success: true,
      sesiId,
      message: supabaseSuccess ? 'Data absensi & sesi berhasil disimpan ke Supabase' : 'Data absensi & sesi berhasil disimpan ke Penyimpanan Lokal'
    };
  }

  async deleteSesi(sesiId) {
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

    return true;
  }

  // ==========================================================================
  // REKAPITULASI & STATISTIK
  // ==========================================================================
  async getRekapKehadiran(kelasId, mapel, startDate, endDate) {
    let allSiswa = await this.getSiswaByKelas(kelasId);
    const allSesi = await this.getAllSesi();

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

  async getRekapIndividuSiswa(siswaId) {
    let allSiswa = [];
    try {
      const allKelas = await this.getKelas();
      for (const k of allKelas) {
        const sList = await this.getSiswaByKelas(k.id);
        allSiswa.push(...sList);
      }
    } catch {
      allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    }

    const siswa = allSiswa.find(s => s.id === siswaId);
    if (!siswa) return null;

    const allKelas = await this.getKelas();
    const kelas = allKelas.find(k => k.id === siswa.kelas_id) || { nama_kelas: 'Kelas', jurusan: 'Umum' };

    // 1. Presensi Data
    const allSesi = await this.getAllSesi();
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
    const allNilaiTugas = await this.getAllNilaiTugas();
    const allChecklist = await this.getAllChecklist();

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
      version: '1.0.0',
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
        target_jurusan = 'Teknik Jaringan Komputer dan Telekomunikasi',
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
          targetKelas = {
            id: newKelasId,
            nama_kelas: target_kelas_nama.trim(),
            tingkat: target_tingkat,
            jurusan: target_jurusan,
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

  resetDemoData() {
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
    return true;
  }
}

export const db = new DataStore();
