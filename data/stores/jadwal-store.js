// data/stores/jadwal-store.js
// Domain Store: Jadwal Mengajar Guru (Jadwal Rutin Mingguan & Versioning Historis)

import { STORAGE_KEYS, isValidUUID } from './shared-store-utils.js';

export class JadwalStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  // ==========================================================================
  // CACHE MANAGEMENT (Jadwal Mengajar)
  // State cache dipegang oleh facade (this.ctx._scheduleCache, this.ctx._pendingScheduleRequests)
  // ==========================================================================

  /**
   * Mengosongkan in-memory cache jadwal mengajar (per user/tahun atau seluruhnya)
   */
  invalidateJadwalMengajarCache(userId = null, academicYear = null) {
    if (!this.ctx._scheduleCache) this.ctx._scheduleCache = new Map();
    if (!this.ctx._pendingScheduleRequests) this.ctx._pendingScheduleRequests = new Map();

    if (userId && academicYear) {
      const key = `${userId}:${academicYear}`;
      this.ctx._scheduleCache.delete(key);
      this.ctx._pendingScheduleRequests.delete(key);
    } else if (userId) {
      for (const key of this.ctx._scheduleCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.ctx._scheduleCache.delete(key);
        }
      }
      for (const key of this.ctx._pendingScheduleRequests.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.ctx._pendingScheduleRequests.delete(key);
        }
      }
    } else {
      this.ctx._scheduleCache.clear();
      this.ctx._pendingScheduleRequests.clear();
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
    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    if (!currentUserId) return [];

    const key = `${currentUserId}:${activeYear}`;

    // 1. Cek cache hit
    if (this.ctx._scheduleCache.has(key)) {
      const entry = this.ctx._scheduleCache.get(key);
      if (entry && Date.now() <= entry.expiry) {
        return entry.data;
      }
      this.ctx._scheduleCache.delete(key);
    }

    // 2. Dedup: jika ada request in-flight untuk key sama, tunggu itu
    if (this.ctx._pendingScheduleRequests.has(key)) {
      return this.ctx._pendingScheduleRequests.get(key);
    }

    // 3. Buat Promise baru
    const fetchPromise = (async () => {
      try {
        let result = null;

        if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
          try {
            const { data, error } = await this.ctx.supabase
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
            this.ctx.getClassesByYear(activeYear, false),
            this.ctx.getMataPelajaran()
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
        this.ctx._scheduleCache.set(key, {
          data: result,
          expiry: Date.now() + (this.ctx._cacheTTL || 5 * 60 * 1000)
        });

        return result;
      } finally {
        // SELALU hapus pending, baik sukses maupun error
        this.ctx._pendingScheduleRequests.delete(key);
      }
    })();

    this.ctx._pendingScheduleRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  // ==========================================================================
  // HELPER INTERNAL TANGGAL BERLAKU HISTORIS
  // ==========================================================================

  _getDefaultEffectiveFrom(academicYear) {
    if (academicYear && typeof academicYear === 'string' && /^\d{4}\/\d{4}$/.test(academicYear)) {
      return `${academicYear.split('/')[0]}-07-01`;
    }
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  _getPreviousDateString(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, monthIndex, day);
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const prevDay = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${prevDay}`;
    }
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const prevDay = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${prevDay}`;
  }

  // ==========================================================================
  // JADWAL MENGAJAR GURU (JADWAL RUTIN MINGGUAN)
  // ==========================================================================

  /**
   * Mengambil daftar jadwal mengajar mingguan (filter per user_id, academic_year, hari, kelas_id, mapel, tanggal)
   * Sekarang DERIVE dari getJadwalMengajarCached() — 0 query DB tambahan.
   *
   * @param {Object} [filter]
   * @param {string} [filter.academic_year] - Tahun ajaran
   * @param {string} [filter.hari] - Filter hari tertentu (e.g. 'Senin')
   * @param {string} [filter.kelas_id] - Filter ID kelas
   * @param {string} [filter.mapel] - Filter nama mapel
   * @param {string} [filter.tanggal] - Tanggal target (YYYY-MM-DD)
   * @param {boolean} [filter.only_active=true] - Jika true & tanggal null, default ke tanggal hari ini lokal
   * @returns {Promise<Array<Object>>}
   */
  async getJadwalMengajarList({ academic_year, hari, kelas_id, mapel, tanggal, only_active = true } = {}) {
    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();

    // Ambil master data dari cache (atau 1 query jika cold)
    const allJadwal = await this.ctx.getJadwalMengajarCached(activeYear);

    // Tentukan tanggal acuan untuk filtering jadwal aktif:
    // 1. Jika parameter tanggal diberikan (misal '2026-09-10' atau '2026-10-01'), gunakan tanggal tersebut.
    // 2. Jika tanggal tidak diberikan dan only_active !== false, gunakan tanggal hari ini lokal (YYYY-MM-DD).
    // 3. Jika only_active === false dan tanggal tidak diberikan, jangan filter rentang tanggal (kembalikan semua histori).
    let targetDate = tanggal;
    if (!targetDate && only_active !== false) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      targetDate = `${y}-${m}-${d}`;
    }

    // Filter in-memory sesuai parameter
    let result = allJadwal;

    if (hari || kelas_id || mapel || targetDate) {
      result = allJadwal.filter(j => {
        if (hari && j.hari !== hari) return false;
        if (kelas_id && j.kelas_id !== kelas_id) return false;
        if (mapel && j.mapel !== mapel) return false;
        if (targetDate) {
          if (j.effective_from && j.effective_from > targetDate) return false;
          if (j.effective_until && j.effective_until < targetDate) return false;
        }
        return true;
      });
    }

    return result;
  }

  /**
   * Menyimpan atau memperbarui data jadwal mengajar (dengan dukungan versioning historis)
   */
  async saveJadwalMengajar(data) {
    this.ctx._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();
    const activeYear = data.academic_year || await this.ctx.getActiveAcademicYear();
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    let id = data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'jadwal-' + Date.now());

    // Hitung jumlah_jp otomatis jika ada nomor_urut (mengabaikan slot istirahat)
    let jumlahJP = Number(data.jumlah_jp);
    if (data.nomor_urut_mulai !== undefined && data.nomor_urut_selesai !== undefined) {
      const uMulai = Number(data.nomor_urut_mulai);
      const uSelesai = Number(data.nomor_urut_selesai);
      const jamMasterList = await this.ctx.getJamPelajaranMaster();
      const slotsInRange = jamMasterList.filter(j => Number(j.nomor_urut) >= uMulai && Number(j.nomor_urut) <= uSelesai);
      const teachingSlots = slotsInRange.filter(j => j.tipe_slot !== 'istirahat');
      jumlahJP = teachingSlots.length > 0 ? teachingSlots.length : Math.max(1, (uSelesai - uMulai) + 1);
    }
    if (isNaN(jumlahJP) || jumlahJP <= 0) jumlahJP = 1;

    // Resolve Mapel ID
    let mapelId = data.mapel_id || null;
    let mapelNama = data.mapel || '';
    if (!mapelId && mapelNama) {
      const mapelList = await this.ctx.getMataPelajaran();
      const mObj = mapelList.find(m => m.nama_mapel.toLowerCase() === mapelNama.toLowerCase());
      if (mObj) mapelId = mObj.id;
    }

    // Tanggal efektif
    let effectiveFrom = data.effective_from || null;
    if (!effectiveFrom && !data.id) {
      effectiveFrom = this._getDefaultEffectiveFrom(activeYear);
    }
    const effectiveUntil = data.effective_until || null;

    // Ambil list jadwal existing untuk user & academic_year guna validasi overlap / versioning
    const allExisting = await this.getJadwalMengajarCached(activeYear);
    const existingEntry = data.id ? allExisting.find(j => j.id === data.id) : null;

    // Guard Mode Arsip / Read-Only untuk Jadwal Mengajar:
    // 1. Jika semester diteruskan secara eksplisit, verifikasi semester tersebut
    if (data.semester) {
      await this.ctx.assertPeriodeWritableBySemester(activeYear, data.semester);
    }
    // 2. Jika tanggal berlaku efektif ditentukan atau ada pada data yang diedit, verifikasi tanggal tersebut
    if (effectiveFrom) {
      await this.ctx.assertPeriodeWritableByDate(effectiveFrom);
    } else if (existingEntry && existingEntry.effective_from) {
      await this.ctx.assertPeriodeWritableByDate(existingEntry.effective_from);
    }

    // Cek apakah ini aksi versioning (edit jadwal yang sudah aktif dengan tanggal berlaku baru)
    const isVersioning = Boolean(data.is_versioning || (
      data.id &&
      existingEntry &&
      effectiveFrom &&
      existingEntry.effective_from &&
      effectiveFrom > existingEntry.effective_from
    ));

    // Overlap validation helper
    const checkOverlap = (targetFrom, targetUntil, excludeId = null) => {
      const startB = targetFrom || '0000-01-01';
      const endB = targetUntil || '9999-12-31';

      return allExisting.some(j => {
        if (excludeId && j.id === excludeId) return false;
        if (j.hari !== (data.hari || 'Senin')) return false;
        if (j.kelas_id !== data.kelas_id) return false;
        if (j.mapel !== mapelNama) return false;

        const startA = j.effective_from || '0000-01-01';
        const endA = j.effective_until || '9999-12-31';

        return startA <= endB && startB <= endA;
      });
    };

    if (isVersioning && existingEntry) {
      // 1. Tutup masa berlaku jadwal lama (H - 1 hari dari tanggal berlaku baru)
      const prevDate = this._getPreviousDateString(effectiveFrom);

      // Update jadwal lama di Supabase
      if (this.ctx.isSupabaseConnected && this.ctx.supabase && isValidUUID(existingEntry.id)) {
        try {
          await this.ctx.supabase
            .from('jadwal_mengajar')
            .update({ effective_until: prevDate, updated_at: new Date().toISOString() })
            .eq('id', existingEntry.id);
        } catch (e) {
          console.error('Supabase update effective_until error:', e);
        }
      }

      // Update jadwal lama di LocalStorage
      let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
      const oldIdx = list.findIndex(j => j.id === existingEntry.id);
      if (oldIdx >= 0) {
        list[oldIdx] = { ...list[oldIdx], effective_until: prevDate, updated_at: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));
      }

      // 2. Insert jadwal baru sebagai baris baru
      const newId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'jadwal-' + Date.now());
      const newPayload = {
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
        effective_from: effectiveFrom,
        effective_until: null,
        updated_at: new Date().toISOString()
      };

      let createdRow = null;
      if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
        const { data: authData } = await this.ctx.supabase.auth.getUser();
        if (authData?.user?.id) {
          const { data: inserted, error } = await this.ctx.supabase
            .from('jadwal_mengajar')
            .insert([{
              ...newPayload,
              id: isValidUUID(newId) ? newId : undefined,
              user_id: authData.user.id
            }])
            .select()
            .single();
          if (!error && inserted) createdRow = inserted;
        }
      }

      // LocalStorage insert
      list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
      list.push(createdRow || { id: newId, ...newPayload, user_id: currentUserId || null });
      localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));

      this.ctx._invalidateCache(['jadwal_mengajar_']);
      this.invalidateJadwalMengajarCache();
      return { success: true, id: createdRow?.id || newId, versioned: true };
    }

    // Validasi overlap jika bukan versioning
    if (checkOverlap(effectiveFrom, effectiveUntil, data.id || null)) {
      return {
        success: false,
        error: 'Rentang tanggal berlaku jadwal bertabrakan (overlap) dengan jadwal lain pada hari dan kelas yang sama.'
      };
    }

    // Payload DB — sengaja TIDAK memuat user_id.
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
      effective_from: effectiveFrom,
      effective_until: effectiveUntil,
      updated_at: new Date().toISOString()
    };

    const isUpdate = Boolean(data.id && isValidUUID(data.id));
    let supabaseError = null;
    let supabaseRow   = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (isUpdate) {
          const { data: updated, error } = await this.ctx.supabase
            .from('jadwal_mengajar')
            .update(payload)
            .eq('id', data.id)
            .select()
            .single();
          if (error) throw error;
          supabaseRow = updated;

        } else {
          const { data: authData, error: authError } =
            await this.ctx.supabase.auth.getUser();

          if (authError || !authData?.user?.id) {
            return {
              success: false,
              id:      null,
              error:   'Sesi pengguna tidak valid. Silakan login kembali.'
            };
          }

          const currentUserId = authData.user.id;

          const { data: created, error } = await this.ctx.supabase
            .from('jadwal_mengajar')
            .insert([{
              ...payload,
              id:      isValidUUID(id) ? id : undefined,
              user_id: currentUserId
            }])
            .select()
            .single();
          if (error) throw error;
          if (created) id = created.id;
          supabaseRow = created;
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
      entry = { ...supabaseRow };
    } else if (isUpdate) {
      const existingItem = idx >= 0 ? list[idx] : null;
      entry = {
        ...(existingItem || {}),
        ...payload,
        id: data.id
      };
    } else {
      entry = {
        id,
        ...payload,
        user_id: currentUserId || null
      };
    }

    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));

    this.ctx._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();

    return { success: !supabaseError, id, error: supabaseError?.message };
  }

  /**
   * Menghapus atau menutup slot jadwal mengajar
   */
  async deleteJadwalMengajar(id, options = {}) {
    const activeYear = options.academic_year || await this.ctx.getActiveAcademicYear();
    const allExisting = await this.getJadwalMengajarCached(activeYear);
    const existing = allExisting.find(j => j.id === id);

    // Guard Mode Arsip / Read-Only:
    // Cek tanggal acuan penghapusan atau tanggal berlaku jadwal itu sendiri
    if (existing && existing.effective_from) {
      await this.ctx.assertPeriodeWritableByDate(existing.effective_from);
    }
    if (options.untilDate) {
      await this.ctx.assertPeriodeWritableByDate(options.untilDate);
    } else if (options.todayDate) {
      await this.ctx.assertPeriodeWritableByDate(options.todayDate);
    }

    this.ctx._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();

    // Jika softClose diaktifkan atau jadwal memiliki masa berlaku lampau:
    if (options.softClose || (existing && existing.effective_from && existing.effective_from <= (options.todayDate || new Date().toISOString().slice(0, 10)) && !options.forceDelete)) {
      const closeDate = options.untilDate || this._getPreviousDateString(options.todayDate || new Date().toISOString().slice(0, 10));

      if (this.ctx.isSupabaseConnected && this.ctx.supabase && isValidUUID(id)) {
        try {
          await this.ctx.supabase
            .from('jadwal_mengajar')
            .update({ effective_until: closeDate, updated_at: new Date().toISOString() })
            .eq('id', id);
        } catch (e) {
          console.error('Supabase soft-close jadwal error:', e);
        }
      }

      let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
      const idx = list.findIndex(j => j.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], effective_until: closeDate, updated_at: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));
      }
      return { success: true, softClosed: true, effective_until: closeDate };
    }

    // Hard delete
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (isValidUUID(id)) {
          await this.ctx.supabase.from('jadwal_mengajar').delete().eq('id', id);
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
   * Mengganti satu atau lebih slot jadwal lama dengan satu atau lebih slot jadwal baru
   * mulai dari tanggal efektif tertentu (Replace Schedule From Date).
   *
   * Jadwal lama akan ditutup dengan effective_until = H-1 dari effectiveFrom.
   * Jadwal baru akan dibuat dengan effective_from = effectiveFrom dan effective_until = null.
   *
   * @param {Object} params
   * @param {string|string[]} params.oldJadwalIds - ID atau array ID jadwal lama yang akan ditutup
   * @param {string} params.effectiveFrom - Tanggal mulai berlaku jadwal baru (YYYY-MM-DD)
   * @param {Array<Object>} params.newSchedules - Array payload jadwal baru
   * @param {string} [params.academicYear] - Tahun ajaran
   * @returns {Promise<{success: boolean, closedCount: number, insertedCount: number, error?: string}>}
   */
  async replaceJadwalMengajar({ oldJadwalIds = [], effectiveFrom, newSchedules = [], academicYear = null }) {
    if (!effectiveFrom) {
      return { success: false, error: 'Tanggal mulai berlaku jadwal baru (effectiveFrom) wajib diisi.' };
    }

    // Guard Mode Arsip / Read-Only:
    await this.ctx.assertPeriodeWritableByDate(effectiveFrom);

    this.ctx._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();

    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;

    const prevDate = this._getPreviousDateString(effectiveFrom);
    const targetOldIds = Array.isArray(oldJadwalIds) ? oldJadwalIds.filter(Boolean) : [oldJadwalIds].filter(Boolean);

    // 1. Tutup masa berlaku jadwal lama
    let closedCount = 0;
    if (targetOldIds.length > 0) {
      if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
        try {
          const validUUIDs = targetOldIds.filter(isValidUUID);
          if (validUUIDs.length > 0) {
            const { error: closeErr } = await this.ctx.supabase
              .from('jadwal_mengajar')
              .update({ effective_until: prevDate, updated_at: new Date().toISOString() })
              .in('id', validUUIDs);
            if (!closeErr) closedCount = validUUIDs.length;
          }
        } catch (e) {
          console.error('Supabase replaceJadwalMengajar close error:', e);
        }
      }

      // LocalStorage close
      let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
      list = list.map(j => {
        if (targetOldIds.includes(j.id)) {
          if (!this.ctx.isSupabaseConnected) closedCount++;
          return { ...j, effective_until: prevDate, updated_at: new Date().toISOString() };
        }
        return j;
      });
      localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));
    }

    // 2. Insert jadwal baru
    let insertedCount = 0;
    const jamMasterList = await this.ctx.getJamPelajaranMaster();
    const mapelList = await this.ctx.getMataPelajaran();

    for (const sched of newSchedules) {
      let jumlahJP = Number(sched.jumlah_jp);
      if (sched.nomor_urut_mulai !== undefined && sched.nomor_urut_selesai !== undefined) {
        const uMulai = Number(sched.nomor_urut_mulai);
        const uSelesai = Number(sched.nomor_urut_selesai);
        const slotsInRange = jamMasterList.filter(j => Number(j.nomor_urut) >= uMulai && Number(j.nomor_urut) <= uSelesai);
        const teachingSlots = slotsInRange.filter(j => j.tipe_slot !== 'istirahat');
        jumlahJP = teachingSlots.length > 0 ? teachingSlots.length : Math.max(1, (uSelesai - uMulai) + 1);
      }
      if (isNaN(jumlahJP) || jumlahJP <= 0) jumlahJP = 1;

      let mapelId = sched.mapel_id || null;
      let mapelNama = sched.mapel || '';
      if (!mapelId && mapelNama) {
        const mObj = mapelList.find(m => m.nama_mapel.toLowerCase() === mapelNama.toLowerCase());
        if (mObj) mapelId = mObj.id;
      }

      const newId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'jadwal-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7));
      const newPayload = {
        hari: sched.hari || 'Senin',
        jam_mulai_id: (sched.jam_mulai_id && isValidUUID(sched.jam_mulai_id)) ? sched.jam_mulai_id : null,
        jam_selesai_id: (sched.jam_selesai_id && isValidUUID(sched.jam_selesai_id)) ? sched.jam_selesai_id : null,
        jam_ke_label: sched.jam_ke_label || 'Jam Pelajaran',
        jam_mulai: sched.jam_mulai || '07:30',
        jam_selesai: sched.jam_selesai || '09:00',
        jumlah_jp: jumlahJP,
        kelas_id: sched.kelas_id,
        mapel_id: (mapelId && isValidUUID(mapelId)) ? mapelId : null,
        mapel: mapelNama,
        ruangan: sched.ruangan || '',
        academic_year: activeYear,
        effective_from: effectiveFrom,
        effective_until: null,
        updated_at: new Date().toISOString()
      };

      let createdRow = null;
      if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
        const { data: authData } = await this.ctx.supabase.auth.getUser();
        if (authData?.user?.id) {
          const { data: inserted, error: insErr } = await this.ctx.supabase
            .from('jadwal_mengajar')
            .insert([{
              ...newPayload,
              id: isValidUUID(newId) ? newId : undefined,
              user_id: authData.user.id
            }])
            .select()
            .single();
          if (!insErr && inserted) {
            createdRow = inserted;
            insertedCount++;
          }
        }
      }

      let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JADWAL_MENGAJAR) || '[]');
      list.push(createdRow || { id: newId, ...newPayload, user_id: currentUserId || null });
      localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(list));
      if (!this.ctx.isSupabaseConnected) insertedCount++;
    }

    this.ctx._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();

    return { success: true, closedCount, insertedCount };
  }

  /**
   * Mengosongkan seluruh data jadwal mengajar guru (Local Storage & Supabase)
   */
  async resetJadwalMengajar(academicYear = null) {
    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const allExisting = await this.getJadwalMengajarCached(activeYear);

    // Guard Mode Arsip / Read-Only:
    // Jika ada satu saja jadwal yang berasal dari periode tertutup, tolak reset global
    for (const j of allExisting) {
      if (j.effective_from) {
        await this.ctx.assertPeriodeWritableByDate(j.effective_from);
      }
    }

    this.ctx._invalidateCache(['jadwal_mengajar_']);
    this.invalidateJadwalMengajarCache();
    let supabaseError = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        // Hapus seluruh baris di tabel jadwal_mengajar
        const { error } = await this.ctx.supabase
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
    this.ctx._invalidateCache(['jadwal_mengajar_']);

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

    const allJadwal = typeof this.ctx?.getJadwalMengajarList === 'function'
      ? await this.ctx.getJadwalMengajarList({ academic_year: academicYear, hari: dayName, tanggal: tanggalStr })
      : await this.getJadwalMengajarList({ academic_year: academicYear, hari: dayName, tanggal: tanggalStr });
    return {
      hari: dayName,
      tanggal: tanggalStr,
      jadwalList: allJadwal || []
    };
  }
}
