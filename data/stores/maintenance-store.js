// data/stores/maintenance-store.js - Maintenance, Schema Verification, Seeding & Backup/Restore Logic
import { INITIAL_DATA } from '../initialData.js';
import { STORAGE_KEYS } from './shared-store-utils.js';

export class MaintenanceStore {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Pemeriksaan Kesehatan & Struktur Tabel Database Supabase Cloud
   */
  async checkDatabaseSchema() {
    if (!this.ctx.isSupabaseConnected || !this.ctx.supabase) {
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
        const { error } = await this.ctx.supabase.from(t.name).select('id').limit(1);
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
      const { error } = await this.ctx.supabase.rpc('process_kenaikan_kelas_batch', {
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

  /**
   * Inisialisasi Data Awal (Seed) Netral ke Supabase Cloud
   */
  async seedInitialDatabase() {
    if (!this.ctx.isSupabaseConnected || !this.ctx.supabase) {
      return { success: false, message: 'Supabase belum terhubung.' };
    }

    try {
      // 1. Seed Mata Pelajaran dasar jika kosong
      const { data: existingMapel } = await this.ctx.supabase.from('mata_pelajaran').select('id').limit(1);
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
        await this.ctx.supabase.from('mata_pelajaran').upsert(defaultMapels, { onConflict: 'nama_mapel' });
      }

      // 2. Seed School Settings jika kosong
      const { data: existingSchool } = await this.ctx.supabase.from('school_settings').select('id').limit(1);
      if (!existingSchool || existingSchool.length === 0) {
        const currentLocalSchool = this.ctx.getSchoolSettings();
        await this.ctx.supabase.from('school_settings').insert([{
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
      const currentUser = await this.ctx.getCurrentUser();
      const currentUserId = currentUser?.id || null;
      if (currentUserId) {
        const { data: existingProfil } = await this.ctx.supabase
          .from('profil_guru')
          .select('id')
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!existingProfil) {
          const currentLocalProfil = this.ctx.getProfilGuru();
          await this.ctx.supabase.from('profil_guru').insert([{
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

  /**
   * Ekspor seluruh data offline ke file JSON
   */
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
      profil_guru: this.ctx.getProfilGuru(),
      school_settings: this.ctx.getSchoolSettings()
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Impor dataset backup JSON ke localStorage
   */
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

  /**
   * Mengosongkan data transaksi dummy lokal
   */
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

  /**
   * Reset seluruh dataset lokal ke INITIAL_DATA
   */
  resetDemoData() {
    this.ctx._invalidateCache();
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
    this.ctx._invalidateCache();
    return true;
  }
}
