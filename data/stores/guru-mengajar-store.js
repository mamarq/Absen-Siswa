// data/stores/guru-mengajar-store.js
// Domain Store: Penugasan Guru (guru_mengajar) & Derived Getters (getKelasSaya, getMapelSaya)

import { STORAGE_KEYS } from './shared-store-utils.js';

export class GuruMengajarStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  // ==========================================================================
  // CACHE MANAGEMENT (Penugasan Guru)
  // State cache dipegang oleh facade (this.ctx._assignmentCache, this.ctx._pendingAssignmentRequests)
  // ==========================================================================

  /**
   * Mengosongkan in-memory cache penugasan guru (per user/tahun atau seluruhnya)
   */
  invalidateGuruMengajarCache(userId = null, academicYear = null) {
    if (!this.ctx._assignmentCache) this.ctx._assignmentCache = new Map();
    if (!this.ctx._pendingAssignmentRequests) this.ctx._pendingAssignmentRequests = new Map();

    if (userId && academicYear) {
      const key = `${userId}:${academicYear}`;
      this.ctx._assignmentCache.delete(key);
      this.ctx._pendingAssignmentRequests.delete(key);
    } else if (userId) {
      for (const key of this.ctx._assignmentCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.ctx._assignmentCache.delete(key);
        }
      }
      for (const key of this.ctx._pendingAssignmentRequests.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.ctx._pendingAssignmentRequests.delete(key);
        }
      }
    } else {
      this.ctx._assignmentCache.clear();
      this.ctx._pendingAssignmentRequests.clear();
    }
  }

  /**
   * Master cache: mengambil SELURUH penugasan guru (guru_mengajar) untuk satu tahun ajaran
   * dalam 1 query, lalu menyimpannya di _assignmentCache.
   * Method getKelasSaya dan getMapelSaya memprioritaskan data dari master cache ini.
   *
   * Concurrent requests untuk key yang sama share 1 Promise (dedup).
   */
  async getGuruMengajarCached(academicYear, semester = null) {
    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    if (!currentUserId) return [];

    const key = `${currentUserId}:${activeYear}`;

    // 1. Cek cache hit
    if (this.ctx._assignmentCache.has(key)) {
      const entry = this.ctx._assignmentCache.get(key);
      if (entry && Date.now() <= entry.expiry) {
        const cachedList = entry.data || [];
        return semester ? cachedList.filter(g => !g.semester || g.semester === semester) : cachedList;
      }
      this.ctx._assignmentCache.delete(key);
    }

    // 2. Dedup: jika ada request in-flight untuk key sama, tunggu itu
    if (this.ctx._pendingAssignmentRequests.has(key)) {
      const pendingRes = await this.ctx._pendingAssignmentRequests.get(key);
      return semester ? (pendingRes || []).filter(g => !g.semester || g.semester === semester) : (pendingRes || []);
    }

    // 3. Buat Promise baru
    const fetchPromise = (async () => {
      try {
        let result = null;

        if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
          try {
            const { data, error } = await this.ctx.supabase
              .from('guru_mengajar')
              .select(`
                *,
                kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year, is_active),
                mata_pelajaran:mapel_id (id, nama_mapel, kode)
              `)
              .eq('academic_year', activeYear)
              .eq('user_id', currentUserId)
              .order('created_at', { ascending: true });

            if (!error && data) {
              result = data.map(g => ({
                ...g,
                nama_kelas: g.kelas?.nama_kelas || '',
                mapel: g.mata_pelajaran?.nama_mapel || g.mapel || '',
                kode_mapel: g.mata_pelajaran?.kode || ''
              }));
            }
          } catch (e) {
            console.warn('Supabase getGuruMengajarCached fallback:', e);
          }
        }

        if (!result) {
          // Fallback localStorage
          const allAssignments = JSON.parse(localStorage.getItem(STORAGE_KEYS.GURU_MENGAJAR) || '[]');
          const [kelasList, mapelList] = await Promise.all([
            this.ctx.getClassesByYear(activeYear, false),
            this.ctx.getMataPelajaran()
          ]);

          result = allAssignments.filter(g => {
            if (g.user_id !== currentUserId) return false;
            if (g.academic_year && g.academic_year !== activeYear) return false;
            return true;
          }).map(g => {
            const kObj = kelasList.find(k => k.id === g.kelas_id);
            const mObj = mapelList.find(m => m.id === g.mapel_id || m.nama_mapel === g.mapel);
            return {
              ...g,
              nama_kelas: kObj?.nama_kelas || g.nama_kelas || '',
              mapel: mObj?.nama_mapel || g.mapel || '',
              kode_mapel: mObj?.kode || '',
              kelas: kObj || null,
              mata_pelajaran: mObj || null
            };
          });
        }

        // Simpan di assignment cache (TTL 5 menit)
        this.ctx._assignmentCache.set(key, {
          data: result,
          expiry: Date.now() + (this.ctx._cacheTTL || 5 * 60 * 1000)
        });

        return result;
      } finally {
        this.ctx._pendingAssignmentRequests.delete(key);
      }
    })();

    this.ctx._pendingAssignmentRequests.set(key, fetchPromise);
    const fullResult = await fetchPromise;
    return semester ? (fullResult || []).filter(g => !g.semester || g.semester === semester) : (fullResult || []);
  }

  // ==========================================================================
  // PENUGASAN GURU (GURU_MENGAJAR CRUD)
  // ==========================================================================

  /**
   * Mengambil seluruh daftar penugasan guru (guru_mengajar) untuk user yang sedang login
   */
  async getGuruMengajarList(academicYear = null, semester = null) {
    return this.getGuruMengajarCached(academicYear, semester);
  }

  /**
   * Menambahkan penugasan guru baru (Wajib mencantumkan semester secara eksplisit)
   */
  async addGuruMengajar(assignmentData) {
    const activeYear = assignmentData.academic_year || await this.ctx.getActiveAcademicYear();
    const rawSemester = assignmentData.semester ? String(assignmentData.semester).trim() : '';

    if (!rawSemester || !['Ganjil', 'Genap'].includes(rawSemester)) {
      throw new Error('Semester wajib ditentukan saat menyimpan penugasan (Ganjil atau Genap).');
    }

    // Guard Mode Arsip / Read-Only
    await this.ctx.assertPeriodeWritableBySemester(activeYear, rawSemester);

    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    if (!currentUserId) throw new Error('Pengguna belum terautentikasi.');
    if (!assignmentData.kelas_id) throw new Error('Kelas wajib dipilih.');
    if (!assignmentData.mapel) throw new Error('Mata pelajaran wajib diisi.');

    // Validasi duplikasi lokal jika offline / fallback
    const localAssignments = JSON.parse(localStorage.getItem(STORAGE_KEYS.GURU_MENGAJAR) || '[]');
    const isDuplicate = localAssignments.some(g => {
      if (g.user_id !== currentUserId) return false;
      if (g.academic_year !== activeYear) return false;
      if (g.semester !== rawSemester) return false;
      if (g.kelas_id !== assignmentData.kelas_id) return false;
      if (assignmentData.mapel_id && g.mapel_id) {
        return g.mapel_id === assignmentData.mapel_id;
      }
      return (g.mapel || '').trim().toLowerCase() === (assignmentData.mapel || '').trim().toLowerCase();
    });

    if (isDuplicate) {
      throw new Error(`Penugasan untuk kelas dan mata pelajaran ini pada semester ${rawSemester} sudah terdaftar.`);
    }

    const newAssignment = {
      id: assignmentData.id || ('gm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      user_id: currentUserId,
      academic_year: activeYear,
      semester: rawSemester,
      kelas_id: assignmentData.kelas_id,
      mapel_id: assignmentData.mapel_id || null,
      mapel: (assignmentData.mapel || '').trim(),
      is_active: assignmentData.is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.invalidateGuruMengajarCache(currentUserId, activeYear);

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
        .from('guru_mengajar')
        .insert([{
          user_id: newAssignment.user_id,
          academic_year: newAssignment.academic_year,
          semester: newAssignment.semester,
          kelas_id: newAssignment.kelas_id,
          mapel_id: newAssignment.mapel_id,
          mapel: newAssignment.mapel,
          is_active: newAssignment.is_active
        }])
        .select(`
          *,
          kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year, is_active),
          mata_pelajaran:mapel_id (id, nama_mapel, kode)
        `)
        .single();

      if (error) {
        console.error('Supabase addGuruMengajar error:', error);
        throw error;
      }
      this.invalidateGuruMengajarCache(currentUserId, activeYear);
      return {
        ...data,
        nama_kelas: data.kelas?.nama_kelas || '',
        mapel: data.mata_pelajaran?.nama_mapel || data.mapel || '',
        kode_mapel: data.mata_pelajaran?.kode || ''
      };
    }

    // LocalStorage Fallback
    localAssignments.push(newAssignment);
    localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify(localAssignments));
    this.invalidateGuruMengajarCache(currentUserId, activeYear);
    return newAssignment;
  }

  /**
   * Mengupdate data penugasan guru
   */
  async updateGuruMengajar(id, updatedData) {
    if (!id) throw new Error('ID penugasan wajib diisi.');
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    // Lookup existing assignment untuk guard Mode Arsip
    let targetAssignment = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: found } = await this.ctx.supabase
          .from('guru_mengajar')
          .select('academic_year, semester')
          .eq('id', id)
          .maybeSingle();
        if (found) targetAssignment = found;
      } catch (e) {}
    }
    if (!targetAssignment) {
      const localAssignments = JSON.parse(localStorage.getItem(STORAGE_KEYS.GURU_MENGAJAR) || '[]');
      targetAssignment = localAssignments.find(g => g.id === id) || null;
    }

    const checkYear = targetAssignment?.academic_year || updatedData?.academic_year || await this.ctx.getActiveAcademicYear();
    const checkSem = targetAssignment?.semester || updatedData?.semester;
    if (checkYear && checkSem) {
      await this.ctx.assertPeriodeWritableBySemester(checkYear, checkSem);
    }

    const payload = { ...updatedData, updated_at: new Date().toISOString() };

    this.invalidateGuruMengajarCache();

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
        .from('guru_mengajar')
        .update(payload)
        .eq('id', id)
        .select(`
          *,
          kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year, is_active),
          mata_pelajaran:mapel_id (id, nama_mapel, kode)
        `)
        .single();

      if (error) {
        console.error('Supabase updateGuruMengajar error:', error);
        throw error;
      }
      this.invalidateGuruMengajarCache();
      return {
        ...data,
        nama_kelas: data.kelas?.nama_kelas || '',
        mapel: data.mata_pelajaran?.nama_mapel || data.mapel || '',
        kode_mapel: data.mata_pelajaran?.kode || ''
      };
    }

    // LocalStorage Fallback
    let localAssignments = JSON.parse(localStorage.getItem(STORAGE_KEYS.GURU_MENGAJAR) || '[]');
    let updatedItem = null;
    localAssignments = localAssignments.map(g => {
      if (g.id === id) {
        updatedItem = { ...g, ...payload };
        return updatedItem;
      }
      return g;
    });
    localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify(localAssignments));
    this.invalidateGuruMengajarCache();
    return updatedItem;
  }

  /**
   * Menghapus penugasan guru
   */
  async deleteGuruMengajar(id) {
    if (!id) throw new Error('ID penugasan wajib diisi.');

    // Lookup existing assignment untuk guard Mode Arsip
    let targetAssignment = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: found } = await this.ctx.supabase
          .from('guru_mengajar')
          .select('academic_year, semester')
          .eq('id', id)
          .maybeSingle();
        if (found) targetAssignment = found;
      } catch (e) {}
    }
    if (!targetAssignment) {
      const localAssignments = JSON.parse(localStorage.getItem(STORAGE_KEYS.GURU_MENGAJAR) || '[]');
      targetAssignment = localAssignments.find(g => g.id === id) || null;
    }

    if (targetAssignment && targetAssignment.academic_year && targetAssignment.semester) {
      await this.ctx.assertPeriodeWritableBySemester(targetAssignment.academic_year, targetAssignment.semester);
    }

    this.invalidateGuruMengajarCache();

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { error } = await this.ctx.supabase
        .from('guru_mengajar')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase deleteGuruMengajar error:', error);
        throw error;
      }
      this.invalidateGuruMengajarCache();
      return true;
    }

    let localAssignments = JSON.parse(localStorage.getItem(STORAGE_KEYS.GURU_MENGAJAR) || '[]');
    localAssignments = localAssignments.filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify(localAssignments));
    this.invalidateGuruMengajarCache();
    return true;
  }

  // ==========================================================================
  // DERIVED GETTERS (getKelasSaya & getMapelSaya)
  // Cross-domain fallback ke Jadwal melalui this.ctx.getJadwalMengajarCached
  // ==========================================================================

  /**
   * Mengambil daftar kelas unik yang diajar oleh guru yang sedang login.
   *
   * SUMBER PRIORITAS:
   * 1. public.guru_mengajar (Decoupled Assignment Model)
   * 2. Fallback sementara ke public.jadwal_mengajar HANYA jika guru_mengajar
   *    untuk user & tahun ajaran tersebut benar-benar 0 data.
   *
   * @param {string|null} academicYear - Tahun ajaran (opsional, default active year)
   * @param {string|null} targetDate - Tanggal acuan aktif (opsional, default today)
   * @param {string|null} semester - Semester spesifik ('Ganjil' | 'Genap', opsional)
   * @returns {Promise<Array<{id: string, nama_kelas: string, tingkat: string, jurusan: string, academic_year: string, is_active: boolean}>>}
   */
  async getKelasSaya(academicYear = null, targetDate = null, semester = null) {
    try {
      const activeYear = academicYear || await this.ctx.getActiveAcademicYear();

      // 1. Ambil seluruh assignment user pada tahun ajaran ini (master cache)
      const allYearAssignments = await this.getGuruMengajarCached(activeYear, null);

      if (Array.isArray(allYearAssignments) && allYearAssignments.length > 0) {
        let assignmentList = [];

        if (semester) {
          // Semester eksplisit ('Ganjil' | 'Genap'): filter ketat pada semester tersebut
          assignmentList = allYearAssignments.filter(g => g.semester === semester);
        } else {
          // Semester omitted: periksa semester unik di seluruh assignment user
          const uniqueSemesters = [...new Set(allYearAssignments.map(g => g.semester).filter(Boolean))];

          if (uniqueSemesters.length === 1) {
            // Kompatibilitas single-semester: seluruh assignment berasal dari 1 semester unik
            // (Menjaga backward compatibility produksi saat ini di mana seluruh 9 assignment berstatus 'Ganjil')
            assignmentList = allYearAssignments.filter(g => g.semester === uniqueSemesters[0]);
          } else if (uniqueSemesters.length > 1) {
            // Multi-semester (>1 semester berbeda): JANGAN gabungkan diam-diam, return [] fail-closed
            return [];
          } else {
            // Seluruh assignment memiliki semester null/undefined (legacy fixture)
            assignmentList = allYearAssignments;
          }
        }

        if (assignmentList.length === 0) {
          return [];
        }

        const activeAssignments = assignmentList.filter(g => g.is_active !== false);
        const kelasMap = new Map();

        for (const g of activeAssignments) {
          if (!g.kelas_id) continue;
          const kelasData = g.kelas;
          if (kelasData && kelasData.is_active === false) continue;

          if (!kelasMap.has(g.kelas_id)) {
            kelasMap.set(g.kelas_id, {
              id: g.kelas_id,
              nama_kelas: kelasData?.nama_kelas || g.nama_kelas || 'Kelas',
              tingkat: kelasData?.tingkat || '',
              jurusan: kelasData?.jurusan || '',
              academic_year: kelasData?.academic_year || g.academic_year || activeYear,
              is_active: kelasData?.is_active !== undefined ? kelasData.is_active : true
            });
          }
        }

        return this.ctx.groupAndSortKelas(Array.from(kelasMap.values()));
      }

      // 2. Fallback Sementara: HANYA jika guru_mengajar pada tahun ajaran ini benar-benar 0 data (legacy)
      const jadwalList = await this.ctx.getJadwalMengajarCached(activeYear);
      if (!jadwalList || !Array.isArray(jadwalList) || jadwalList.length === 0) return [];

      let filterDate = targetDate;
      if (!filterDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        filterDate = `${y}-${m}-${d}`;
      }

      const kelasMap = new Map();

      for (const j of jadwalList) {
        if (!j.kelas_id) continue;

        if (filterDate) {
          if (j.effective_from && j.effective_from > filterDate) continue;
          if (j.effective_until && j.effective_until < filterDate) continue;
        }

        const kelasData = j.kelas;
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

      return this.ctx.groupAndSortKelas(Array.from(kelasMap.values()));
    } catch (err) {
      console.error('Gagal memuat kelas guru (getKelasSaya):', err);
      throw err;
    }
  }

  /**
   * Mengambil daftar mata pelajaran unik yang diajar oleh guru yang sedang login.
   * Jika kelasId diberikan, hanya mengembalikan mapel yang diajar di kelas tersebut.
   *
   * SUMBER PRIORITAS:
   * 1. public.guru_mengajar (Decoupled Assignment Model)
   * 2. Fallback sementara ke public.jadwal_mengajar HANYA jika guru_mengajar
   *    untuk user & tahun ajaran tersebut benar-benar 0 data.
   *
   * @param {string|null} academicYear - Tahun ajaran (opsional)
   * @param {string|null} kelasId - ID Kelas spesifik (opsional)
   * @param {string|null} targetDate - Tanggal acuan aktif (opsional, default today)
   * @param {string|null} semester - Semester spesifik ('Ganjil' | 'Genap', opsional)
   * @returns {Promise<Array<{id: string, nama_mapel: string, kode: string}>>}
   */
  async getMapelSaya(academicYear = null, kelasId = null, targetDate = null, semester = null) {
    try {
      if (!kelasId) return [];

      const activeYear = academicYear || await this.ctx.getActiveAcademicYear();

      // 1. Ambil seluruh assignment user pada tahun ajaran ini (master cache)
      const allYearAssignments = await this.getGuruMengajarCached(activeYear, null);

      if (Array.isArray(allYearAssignments) && allYearAssignments.length > 0) {
        let assignmentList = [];

        if (semester) {
          // Semester eksplisit ('Ganjil' | 'Genap'): filter ketat pada semester tersebut
          assignmentList = allYearAssignments.filter(g => g.semester === semester);
        } else {
          // Semester omitted: periksa semester unik di seluruh assignment user
          const uniqueSemesters = [...new Set(allYearAssignments.map(g => g.semester).filter(Boolean))];

          if (uniqueSemesters.length === 1) {
            // Kompatibilitas single-semester: seluruh assignment berasal dari 1 semester unik
            assignmentList = allYearAssignments.filter(g => g.semester === uniqueSemesters[0]);
          } else if (uniqueSemesters.length > 1) {
            // Multi-semester (>1 semester berbeda): JANGAN gabungkan diam-diam, return [] fail-closed
            return [];
          } else {
            // Seluruh assignment memiliki semester null/undefined (legacy fixture)
            assignmentList = allYearAssignments;
          }
        }

        const matched = assignmentList.filter(g => g.kelas_id === kelasId && g.is_active !== false);
        if (matched.length === 0) return [];

        const mapelMap = new Map();

        for (const g of matched) {
          const mapelObj = g.mata_pelajaran;
          const namaMapel = mapelObj?.nama_mapel || g.mapel;
          if (!namaMapel) continue;

          const key = g.mapel_id || namaMapel;
          if (!mapelMap.has(key)) {
            mapelMap.set(key, {
              id: g.mapel_id || mapelObj?.id || key,
              nama_mapel: namaMapel,
              kode: mapelObj?.kode || g.kode_mapel || ''
            });
          }
        }

        return Array.from(mapelMap.values()).sort((a, b) =>
          (a.nama_mapel || '').localeCompare(b.nama_mapel || '', 'id', { numeric: true, sensitivity: 'base' })
        );
      }

      // 2. Fallback Sementara: HANYA jika guru_mengajar pada tahun ajaran ini benar-benar 0 data
      const allJadwal = await this.ctx.getJadwalMengajarCached(activeYear);
      if (!allJadwal || !Array.isArray(allJadwal) || allJadwal.length === 0) return [];

      let filterDate = targetDate;
      if (!filterDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        filterDate = `${y}-${m}-${d}`;
      }

      const jadwalList = allJadwal.filter(j => {
        if (j.kelas_id !== kelasId) return false;
        if (filterDate) {
          if (j.effective_from && j.effective_from > filterDate) return false;
          if (j.effective_until && j.effective_until < filterDate) return false;
        }
        return true;
      });
      if (jadwalList.length === 0) return [];

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

      return Array.from(mapelMap.values()).sort((a, b) =>
        (a.nama_mapel || '').localeCompare(b.nama_mapel || '', 'id', { numeric: true, sensitivity: 'base' })
      );
    } catch (err) {
      console.error('Gagal memuat mata pelajaran guru (getMapelSaya):', err);
      throw err;
    }
  }
}
