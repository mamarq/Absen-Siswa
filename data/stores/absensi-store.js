// data/stores/absensi-store.js
// Domain Store: Sesi Mengajar & Absensi Siswa
// Bertanggung jawab atas lifecycle sesi_mengajar, absensi, snapshot historis jadwal, dan rekap kehadiran.

import { STORAGE_KEYS, isValidUUID } from './shared-store-utils.js';

export class AbsensiStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  // ==========================================================================
  // SESI MENGAJAR & ABSENSI (READ)
  // ==========================================================================

  /**
   * Mencari sesi mengajar berdasarkan kombinasi kelas, mapel, dan tanggal (Strict Per-User)
   * Menyertakan array absensi dan objek jurnal_mengajar terkait.
   */
  async findSesi(kelasId, mapel, tanggal) {
    // Dapatkan identitas user aktif (Fail-Closed)
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        // Query Cloud: strict per user_id + kelas_id + mapel + tanggal
        const { data, error } = await this.ctx.supabase
          .from('sesi_mengajar')
          .select('*, absensi(*), jurnal_mengajar(*)')
          .eq('user_id', currentUserId)
          .eq('kelas_id', kelasId)
          .eq('mapel', mapel)
          .eq('tanggal', tanggal)
          .maybeSingle();

        if (!error && data) {
          if (!data.absensi || data.absensi.length === 0) {
            const { data: directAbs } = await this.ctx.supabase
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

  /**
   * Mengambil peta kehadiran siswa { [siswaId]: { status, catatan } }
   */
  async getAttendanceMapByKelasAndTanggal(kelasId, tanggal, mapel = null) {
    if (!kelasId || !tanggal) return {};

    // Jika mapel tidak tersedia, tidak bisa menentukan sesi dengan aman
    // (satu guru bisa punya dua mapel berbeda di kelas + tanggal yang sama)
    if (!mapel) return {};

    // findSesi sudah strict per user_id — delegate sepenuhnya
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

  /**
   * Mengambil seluruh sesi mengajar user yang aktif untuk tahun ajaran tertentu
   */
  async getAllSesi(academicYear = null) {
    // 1. Fail-Closed: Hanya tampilkan sesi jika user teridentifikasi
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    // 2. Cache key per user agar data tidak bocor antar sesi login
    const cacheKey = `sesi_year_${currentUserId}_${academicYear || 'all'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let data = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        // 3. Filter wajib: hanya sesi milik user aktif
        let query = this.ctx.supabase
          .from('sesi_mengajar')
          .select('*, kelas:kelas_id(nama_kelas, academic_year), absensi(*), jurnal_mengajar(*)')
          .eq('user_id', currentUserId)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false });

        if (academicYear) {
          const kelasInYear = await this.ctx.getClassesByYear(academicYear, false);
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

    return this.ctx._setCache(cacheKey, data, 60000);
  }

  async getAllSesiByYear(academicYear) {
    return this.getAllSesi(academicYear);
  }

  async getSessionsByYear(academicYear) {
    return this.getAllSesiByYear(academicYear);
  }

  // ==========================================================================
  // SESI MENGAJAR & ABSENSI & JURNAL (WRITE)
  // ==========================================================================

  /**
   * Menyimpan atau memperbarui data sesi_mengajar, absensi, dan jurnal_mengajar
   * Mempertahankan snapshot jadwal historis: jumlah_jp, jam_ke_label, jam_mulai, jam_selesai
   */
  async saveSesi({ sesiData, absensiList, jurnalData }) {
    if (!sesiData) throw new Error('Data sesi wajib diisi.');
    if (sesiData.tanggal) {
      await this.ctx.assertPeriodeWritableByDate(sesiData.tanggal);
    }

    this.ctx._invalidateCache(['sesi_']);
    const timestamp = new Date().toISOString();
    const isUpdate = Boolean(sesiData.id);
    let sesiId = sesiData.id || null;
    let supabaseSuccess = false;
    let savedSesi = null; // Sumber kebenaran tunggal untuk localStorage

    // Identitas user aktif untuk sinkronisasi localStorage
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        // Validasi session untuk SEMUA operasi cloud (CREATE maupun UPDATE)
        const { data: authData, error: authError } = await this.ctx.supabase.auth.getUser();

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
          const updateObj = {
            kelas_id:    sesiData.kelas_id,
            mapel:       sesiData.mapel,
            tanggal:     sesiData.tanggal,
            catatan_sesi: sesiData.catatan_sesi || '',
            updated_at:  timestamp
          };
          if (sesiData.jumlah_jp !== undefined && sesiData.jumlah_jp !== null) updateObj.jumlah_jp = sesiData.jumlah_jp;
          if (sesiData.jam_ke_label !== undefined && sesiData.jam_ke_label !== null) updateObj.jam_ke_label = sesiData.jam_ke_label;
          if (sesiData.jam_mulai !== undefined && sesiData.jam_mulai !== null) updateObj.jam_mulai = sesiData.jam_mulai;
          if (sesiData.jam_selesai !== undefined && sesiData.jam_selesai !== null) updateObj.jam_selesai = sesiData.jam_selesai;

          const { data, error } = await this.ctx.supabase
            .from('sesi_mengajar')
            .update(updateObj)
            .eq('id', sesiId)
            .eq('user_id', authUserId) // Proteksi ownership: hanya owner yang bisa UPDATE
            .select()
            .single();

          if (error) throw error;
          savedSesi = data;

        } else {
          // CREATE: user_id wajib diisi dari session yang tervalidasi
          const insertObj = {
            kelas_id:    sesiData.kelas_id,
            mapel:       sesiData.mapel,
            tanggal:     sesiData.tanggal,
            catatan_sesi: sesiData.catatan_sesi || '',
            user_id:     authUserId, // Wajib terisi — tidak pernah null pada cloud CREATE
            jumlah_jp:   sesiData.jumlah_jp !== undefined ? sesiData.jumlah_jp : null,
            jam_ke_label: sesiData.jam_ke_label || null,
            jam_mulai:   sesiData.jam_mulai || null,
            jam_selesai: sesiData.jam_selesai || null,
            academic_year: sesiData.academic_year || (await this.ctx.getActiveAcademicYear()),
            created_at:  timestamp,
            updated_at:  timestamp
          };

          const { data, error } = await this.ctx.supabase
            .from('sesi_mengajar')
            .insert([insertObj])
            .select()
            .single();

          if (error) throw error;
          savedSesi = data;
          sesiId = savedSesi.id;
        }

        // Child tables: absensi & jurnal_mengajar (ownership inherit via sesi_id)
        await this.ctx.supabase.from('absensi').delete().eq('sesi_id', sesiId);
        if (absensiList && absensiList.length > 0) {
          const absensiToInsert = absensiList.map(a => ({
            sesi_id:  sesiId,
            siswa_id: a.siswa_id,
            status:   a.status || 'Hadir',
            catatan:  a.catatan || ''
          }));
          const { error: absError } = await this.ctx.supabase.from('absensi').insert(absensiToInsert);
          if (absError) console.warn('Supabase insert absensi warning:', absError.message);
        }

        if (jurnalData && (jurnalData.materi_pokok || jurnalData.kegiatan_pembelajaran)) {
          await this.ctx.supabase.from('jurnal_mengajar').delete().eq('sesi_id', sesiId);
          await this.ctx.supabase.from('jurnal_mengajar').insert([{
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
      sesiObject = { ...savedSesi };

    } else if (isUpdate && existingIdx >= 0) {
      // OFFLINE UPDATE: pertahankan user_id existing dari cache lokal
      sesiObject = {
        ...allSesi[existingIdx],        // user_id lama terlindungi
        kelas_id:    sesiData.kelas_id,
        mapel:       sesiData.mapel,
        tanggal:     sesiData.tanggal,
        catatan_sesi: sesiData.catatan_sesi || '',
        jumlah_jp:   sesiData.jumlah_jp !== undefined ? sesiData.jumlah_jp : allSesi[existingIdx].jumlah_jp,
        jam_ke_label: sesiData.jam_ke_label !== undefined ? sesiData.jam_ke_label : allSesi[existingIdx].jam_ke_label,
        jam_mulai:   sesiData.jam_mulai !== undefined ? sesiData.jam_mulai : allSesi[existingIdx].jam_mulai,
        jam_selesai: sesiData.jam_selesai !== undefined ? sesiData.jam_selesai : allSesi[existingIdx].jam_selesai,
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
        jumlah_jp:   sesiData.jumlah_jp !== undefined ? sesiData.jumlah_jp : null,
        jam_ke_label: sesiData.jam_ke_label || null,
        jam_mulai:   sesiData.jam_mulai || null,
        jam_selesai: sesiData.jam_selesai || null,
        user_id:     currentUserId || null,
        academic_year: sesiData.academic_year || (await this.ctx.getActiveAcademicYear()),
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
    if (jurnalData !== undefined) {
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

  /**
   * Menghapus sesi mengajar dan seluruh rekaman absensi serta jurnal terkait
   */
  async deleteSesi(sesiId) {
    if (!sesiId) return false;

    // Cari tanggal sesi terlebih dahulu untuk memvalidasi status periode semester
    let targetTanggal = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data } = await this.ctx.supabase
          .from('sesi_mengajar')
          .select('tanggal')
          .eq('id', sesiId)
          .maybeSingle();
        if (data?.tanggal) targetTanggal = data.tanggal;
      } catch (e) {
        console.warn('Gagal cek tanggal sesi di Supabase:', e);
      }
    }

    if (!targetTanggal) {
      const allSesi = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESI) || '[]');
      const found = allSesi.find(s => s.id === sesiId);
      if (found?.tanggal) targetTanggal = found.tanggal;
    }

    if (targetTanggal) {
      await this.ctx.assertPeriodeWritableByDate(targetTanggal);
    }

    this.ctx._invalidateCache(['sesi_']);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      await this.ctx.supabase.from('sesi_mengajar').delete().eq('id', sesiId);
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
    this.ctx._invalidateCache(['sesi_']);

    return true;
  }

  // ==========================================================================
  // REKAPITULASI & STATISTIK KEHADIRAN (DELEGATED TO RekapStore via ctx)
  // ==========================================================================

  /**
   * Menghitung matriks rekapitulasi kehadiran per kelas & mapel
   */
  async getRekapKehadiran(kelasId, mapel, startDate, endDate, academicYear = null) {
    if (this.ctx._rekapStore) {
      return this.ctx._rekapStore.getRekapKehadiran(kelasId, mapel, startDate, endDate, academicYear);
    }
    return this.ctx.getRekapKehadiran(kelasId, mapel, startDate, endDate, academicYear);
  }

  /**
   * Menghitung rekapitulasi individu siswa (Presensi, Akademik Tugas & Ceklis, Timeline Notes)
   */
  async getRekapIndividuSiswa(siswaId, academicYear = null) {
    if (this.ctx._rekapStore) {
      return this.ctx._rekapStore.getRekapIndividuSiswa(siswaId, academicYear);
    }
    return this.ctx.getRekapIndividuSiswa(siswaId, academicYear);
  }
}
