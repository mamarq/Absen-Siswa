// data/stores/kelompok-store.js
// Domain Store: Kelompok Belajar (kelompok_belajar & kelompok_anggota) serta Tugas Kelompok terkait

import { STORAGE_KEYS, isValidUUID } from './shared-store-utils.js';

export class KelompokStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Mengambil daftar kelompok beserta anggota siswanya per Kelas + Mapel + Tahun Ajaran (Strict Per-User)
   */
  async getKelompokList({ kelas_id, mapel_id, mapel, academic_year } = {}) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId && mapel) {
      const allMapel = await this.ctx.getMataPelajaran();
      const m = allMapel.find(x => x.nama_mapel === mapel);
      if (m) resolvedMapelId = m.id;
    }

    const cacheKey = `kelompok_list_${currentUserId}_${kelas_id || 'all'}_${resolvedMapelId || mapel || 'all'}_${activeYear || 'all'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let query = this.ctx.supabase
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
      const allSiswa = await this.ctx.getAllSiswa();
      const allKelas = await this.ctx.getKelas(activeYear);
      const allMapel = await this.ctx.getMataPelajaran();

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

    return this.ctx._setCache(cacheKey, result, 60000);
  }

  /**
   * Menyimpan / membuat kelompok baru (Strict Per-User & Mandatory mapel_id)
   */
  async saveKelompok(data) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    let mapelId = data.mapel_id || null;
    let mapelNama = data.mapel || '';
    if (!mapelId && mapelNama) {
      const allMapel = await this.ctx.getMataPelajaran();
      const m = allMapel.find(x => x.nama_mapel === mapelNama);
      if (m) mapelId = m.id;
    }

    if (!mapelId) {
      return { success: false, error: 'Validasi gagal: Mata Pelajaran (mapel_id) wajib dipilih untuk membuat kelompok belajar.' };
    }

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    let activeYear = data.academic_year;

    // Jika updating tanpa passing academic_year eksplisit, cari dari existing kelompok
    if (!activeYear && data.id) {
      if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
        try {
          const { data: exGroup } = await this.ctx.supabase
            .from('kelompok_belajar')
            .select('academic_year')
            .eq('id', data.id)
            .eq('user_id', currentUserId)
            .maybeSingle();
          if (exGroup && exGroup.academic_year) activeYear = exGroup.academic_year;
        } catch (e) {}
      }
      if (!activeYear) {
        const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK) || '[]');
        const exLocal = localList.find(k => k.id === data.id && k.user_id === currentUserId);
        if (exLocal && exLocal.academic_year) activeYear = exLocal.academic_year;
      }
    }

    if (!activeYear) {
      activeYear = await this.ctx.getActiveAcademicYear();
    }

    // Resolusi semester untuk Mode Arsip guard
    let targetSemester = data.semester || null;
    if (!targetSemester) {
      const activeSem = await this.ctx.getActiveSemester();
      if (activeSem && activeSem.academic_year === activeYear) {
        targetSemester = activeSem.semester;
      }
    }

    if (activeYear && targetSemester) {
      try {
        await this.ctx.assertPeriodeWritableBySemester(activeYear, targetSemester);
      } catch (guardErr) {
        return { success: false, error: guardErr.message };
      }
    }

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

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (data.id && isValidUUID(data.id)) {
          // UPDATE: Guard .eq('id', data.id).eq('user_id', currentUserId)
          const { data: updated, error } = await this.ctx.supabase
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
          const { data: created, error } = await this.ctx.supabase
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
    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, id: kelompokId, error: supabaseError.message || String(supabaseError) };
    }

    return { success: true, id: kelompokId };
  }

  /**
   * Menghapus 1 data kelompok dan seluruh anggotanya (Strict Per-User)
   */
  async deleteKelompok(kelompokId) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelompokId) return false;

    // Mode Arsip Guard: Lookup kelompok untuk cek academic_year & semester
    let targetYear = null;
    let targetSemester = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: group } = await this.ctx.supabase
          .from('kelompok_belajar')
          .select('id, academic_year, user_id')
          .eq('id', kelompokId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (group && group.academic_year) targetYear = group.academic_year;
      } catch (e) {
        console.warn('Error fetching kelompok_belajar for delete guard:', e);
      }
    }

    if (!targetYear) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK) || '[]');
      const localG = localList.find(k => k.id === kelompokId && k.user_id === currentUserId);
      if (localG && localG.academic_year) targetYear = localG.academic_year;
    }

    if (targetYear) {
      const activeSem = await this.ctx.getActiveSemester();
      if (activeSem && activeSem.academic_year === targetYear) {
        targetSemester = activeSem.semester;
      }
      if (targetSemester) {
        await this.ctx.assertPeriodeWritableBySemester(targetYear, targetSemester);
      }
    }

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);
    let deleteSuccess = true;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { error } = await this.ctx.supabase
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
      this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);
    }

    return deleteSuccess;
  }

  /**
   * Menambahkan siswa ke dalam kelompok (Strict Parent Ownership & Mandatory mapel_id)
   */
  async addAnggotaKelompok({ kelompok_id, siswa_id, kelas_id, mapel_id, academic_year, semester }) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelompok_id || !siswa_id) {
      return { success: false, error: 'Autentikasi gagal atau parameter tidak lengkap' };
    }

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId) {
      return { success: false, error: 'Validasi gagal: mapel_id wajib disertakan untuk menambahkan anggota kelompok.' };
    }

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    let activeYear = academic_year;
    let targetSemester = semester || null;

    // Mode Arsip Guard: Lookup kelompok parent
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: parentG } = await this.ctx.supabase
          .from('kelompok_belajar')
          .select('id, academic_year')
          .eq('id', kelompok_id)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (parentG && parentG.academic_year) {
          activeYear = parentG.academic_year;
        }
      } catch (e) {}
    }

    if (!activeYear) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK) || '[]');
      const localG = localList.find(k => k.id === kelompok_id && k.user_id === currentUserId);
      if (localG && localG.academic_year) activeYear = localG.academic_year;
    }

    if (!activeYear) {
      activeYear = await this.ctx.getActiveAcademicYear();
    }

    if (!targetSemester) {
      const activeSem = await this.ctx.getActiveSemester();
      if (activeSem && activeSem.academic_year === activeYear) {
        targetSemester = activeSem.semester;
      }
    }

    if (activeYear && targetSemester) {
      try {
        await this.ctx.assertPeriodeWritableBySemester(activeYear, targetSemester);
      } catch (guardErr) {
        return { success: false, error: guardErr.message };
      }
    }

    let supabaseError = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        // 1. Verifikasi kepemilikan parent (kelompok_belajar.user_id === currentUserId)
        const { data: parent, error: parentErr } = await this.ctx.supabase
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
        const { error: delError } = await this.ctx.supabase
          .from('kelompok_anggota')
          .delete()
          .eq('siswa_id', siswa_id)
          .eq('kelas_id', kelas_id)
          .eq('mapel_id', resolvedMapelId)
          .eq('academic_year', activeYear);

        if (delError) throw delError;

        // 3. Insert keanggotaan baru
        const { error: insError } = await this.ctx.supabase.from('kelompok_anggota').insert([{
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

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, error: supabaseError.message || String(supabaseError) };
    }

    return { success: true };
  }

  /**
   * Menghapus siswa dari anggota kelompok (Strict Parent Ownership)
   */
  async removeAnggotaKelompok(kelompokId, siswaId) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelompokId || !siswaId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    // Mode Arsip Guard: Lookup kelompok parent
    let targetYear = null;
    let targetSemester = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: parentG } = await this.ctx.supabase
          .from('kelompok_belajar')
          .select('id, academic_year')
          .eq('id', kelompokId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (parentG && parentG.academic_year) {
          targetYear = parentG.academic_year;
        }
      } catch (e) {}
    }

    if (!targetYear) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELOMPOK) || '[]');
      const localG = localList.find(k => k.id === kelompokId && k.user_id === currentUserId);
      if (localG && localG.academic_year) targetYear = localG.academic_year;
    }

    if (targetYear) {
      const activeSem = await this.ctx.getActiveSemester();
      if (activeSem && activeSem.academic_year === targetYear) {
        targetSemester = activeSem.semester;
      }
      if (targetSemester) {
        try {
          await this.ctx.assertPeriodeWritableBySemester(targetYear, targetSemester);
        } catch (guardErr) {
          return { success: false, error: guardErr.message };
        }
      }
    }

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);
    let supabaseError = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        // 1. Verifikasi kepemilikan parent sebelum delete child
        const { data: parent, error: parentErr } = await this.ctx.supabase
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

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, error: supabaseError.message || String(supabaseError) };
    }
    return { success: true };
  }

  /**
   * Mengambil daftar siswa yang BELUM masuk kelompok manapun pada kombinasi Kelas + Mapel aktif (Strict Per-User)
   */
  async getSiswaBelumBerkelompok(kelasId, mapelId, academicYear) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !kelasId) return [];

    let resolvedMapelId = mapelId || null;
    if (!resolvedMapelId) return []; // Fail-closed jika mapel_id kosong

    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const [allStudents, kelompokList] = await Promise.all([
      this.ctx.getSiswaByKelas(kelasId, true),
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
   */
  async generateKelompokOtomatis({ kelas_id, mapel_id, mapel, jumlah_kelompok = 4, format_nama = 'Kelompok {N}', academic_year, semester }) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    let resolvedMapelId = mapel_id || null;
    let resolvedMapelNama = mapel || '';
    if (!resolvedMapelId && resolvedMapelNama) {
      const allMapel = await this.ctx.getMataPelajaran();
      const m = allMapel.find(x => x.nama_mapel === resolvedMapelNama);
      if (m) resolvedMapelId = m.id;
    }

    // A. Pre-validation: mapel_id WAJIB
    if (!resolvedMapelId) {
      return { success: false, message: 'Validasi gagal: Mata Pelajaran (mapel_id) wajib dipilih untuk pembagian kelompok otomatis.' };
    }

    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();

    // Mode Arsip Guard
    let targetSemester = semester || null;
    if (!targetSemester) {
      const activeSem = await this.ctx.getActiveSemester();
      if (activeSem && activeSem.academic_year === activeYear) {
        targetSemester = activeSem.semester;
      }
    }
    if (activeYear && targetSemester) {
      try {
        await this.ctx.assertPeriodeWritableBySemester(activeYear, targetSemester);
      } catch (guardErr) {
        return { success: false, message: guardErr.message };
      }
    }

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`, 'siswa_']);

    const allStudents = await this.ctx.getSiswaByKelas(kelas_id, true);
    if (!allStudents || allStudents.length === 0) {
      return { success: false, message: 'Tidak ada siswa aktif di kelas ini' };
    }

    // B. Snapshot Memory
    let oldUserGroupsSnapshot = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: oldGroups } = await this.ctx.supabase
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

    // C. Scoped Delete
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        await this.ctx.supabase
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

    // D. Controlled Recreate
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
      if (oldUserGroupsSnapshot.length > 0 && this.ctx.isSupabaseConnected && this.ctx.supabase) {
        try {
          for (const k of createdKelompok) {
            await this.deleteKelompok(k.id);
          }

          for (const oldG of oldUserGroupsSnapshot) {
            const { data: restoredG } = await this.ctx.supabase
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
                await this.ctx.supabase.from('kelompok_anggota').insert([{
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

      this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`, 'siswa_']);
      return {
        success: false,
        partial: true,
        recovered: isRecovered,
        message: `Gagal membuat susunan kelompok: ${recreateError.message}. ${isRecovered ? 'Susunan kelompok lama berhasil dipulihkan.' : 'Susunan kelompok lama belum dapat dipulihkan.'}`
      };
    }

    this.ctx._invalidateCache([`kelompok_list_${currentUserId}_`, 'siswa_']);

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
    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();
    const allNilai = await this.ctx.getAllNilaiTugas(activeYear);
    let filtered = allNilai.filter(n => n.is_kelompok === true || n.tipe_tugas === 'kelompok');
    if (kelas_id) filtered = filtered.filter(n => n.kelas_id === kelas_id);
    if (mapel) filtered = filtered.filter(n => n.mapel === mapel);
    return filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }

  /**
   * Mengambil riwayat nilai tugas kelompok untuk satu siswa tertentu (untuk Rekap Per Siswa)
   */
  async getRekapTugasKelompokBySiswa(siswaId, academicYear) {
    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const cacheKey = `rekap_tugas_kelompok_${siswaId}_${activeYear}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    const allNilai = await this.ctx.getAllNilaiTugas(activeYear);
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
    return this.ctx._setCache(cacheKey, results);
  }

  /**
   * Menyimpan nilai tugas kelompok
   */
  async saveTugasKelompok(data) {
    this.ctx._invalidateCache(['nilai_', 'kelompok_']);
    return this.ctx.saveNilaiTugas({
      ...data,
      is_kelompok: true,
      tipe_tugas: 'kelompok'
    });
  }

  /**
   * Menghapus tugas kelompok
   */
  async deleteTugasKelompok(tugasId) {
    this.ctx._invalidateCache(['nilai_', 'kelompok_']);
    return this.ctx.deleteNilaiTugas(tugasId);
  }
}
