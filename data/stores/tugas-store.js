// data/stores/tugas-store.js
// Domain Store: Tugas & Checklist (catatan_checklist & nilai_tugas)

import { STORAGE_KEYS, isValidUUID } from './shared-store-utils.js';

export class TugasStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  // ==========================================================================
  // CATATAN CEKLIS SISWA (BENTUK CEKLIS ABSEN PER SISWA HARI ITU)
  // ==========================================================================
  async getAllChecklist(academicYear) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `checklist_${currentUserId}_${academicYear || 'all'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let list = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let q = this.ctx.supabase
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
    const allKelas = await this.ctx.getKelas(academicYear);
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

    return this.ctx._setCache(cacheKey, result, 60000);
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
    if (!data) throw new Error('Data checklist wajib diisi.');
    if (data.tanggal) {
      await this.ctx.assertPeriodeWritableByDate(data.tanggal);
    }

    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan', savedLocally: false };
    }

    this.ctx._invalidateCache([`checklist_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    let id = data.id;
    const isDbUUID = isValidUUID(id);
    const currentYear = data.academic_year || await this.ctx.getActiveAcademicYear();
    const allKelas = await this.ctx.getKelas(currentYear);
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

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (isDbUUID) {
          // UPDATE: Guard .eq('user_id', currentUserId)
          let { data: updatedData, error: err1 } = await this.ctx.supabase
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
          let { data: insertedData, error: err1 } = await this.ctx.supabase
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
    this.ctx._invalidateCache([`checklist_${currentUserId}_`]);

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
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !id) return false;

    // Cari tanggal catatan_checklist untuk validasi periode semester
    let targetTanggal = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data } = await this.ctx.supabase
          .from('catatan_checklist')
          .select('tanggal')
          .eq('id', id)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (data?.tanggal) targetTanggal = data.tanggal;
      } catch (e) {
        console.warn('Gagal cek tanggal catatan_checklist di Supabase:', e);
      }
    }

    if (!targetTanggal) {
      const allChecklist = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKLIST) || '[]');
      const found = allChecklist.find(c => c.id === id && c.user_id === currentUserId);
      if (found?.tanggal) targetTanggal = found.tanggal;
    }

    if (targetTanggal) {
      await this.ctx.assertPeriodeWritableByDate(targetTanggal);
    }

    this.ctx._invalidateCache([`checklist_${currentUserId}_`]);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        await this.ctx.supabase
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
    this.ctx._invalidateCache([`checklist_${currentUserId}_`]);
    return true;
  }

  // ==========================================================================
  // NILAI TUGAS (BENTUK NILAI SEDERHANA PER SISWA)
  // ==========================================================================
  async getAllNilaiTugas(academicYear) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `nilai_${currentUserId}_${academicYear || 'all'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let list = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let q = this.ctx.supabase
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
    const allKelas = await this.ctx.getKelas(academicYear);
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

    return this.ctx._setCache(cacheKey, result, 60000);
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
    if (!data) throw new Error('Data nilai tugas wajib diisi.');
    if (data.tanggal) {
      await this.ctx.assertPeriodeWritableByDate(data.tanggal);
    }

    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan', savedLocally: false };
    }

    this.ctx._invalidateCache([`nilai_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    let id = data.id;
    const isDbUUID = isValidUUID(id);
    const currentYear = data.academic_year || await this.ctx.getActiveAcademicYear();
    const allKelas = await this.ctx.getKelas(currentYear);
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

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (isDbUUID) {
          // UPDATE: Guard .eq('user_id', currentUserId)
          const { data: updatedData, error } = await this.ctx.supabase
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
          const { data: insertedData, error } = await this.ctx.supabase
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
    this.ctx._invalidateCache([`nilai_${currentUserId}_`]);

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
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !id) return false;

    // Cari tanggal nilai_tugas untuk validasi periode semester
    let targetTanggal = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data } = await this.ctx.supabase
          .from('nilai_tugas')
          .select('tanggal')
          .eq('id', id)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (data?.tanggal) targetTanggal = data.tanggal;
      } catch (e) {
        console.warn('Gagal cek tanggal nilai_tugas di Supabase:', e);
      }
    }

    if (!targetTanggal) {
      const allNilaiTugas = JSON.parse(localStorage.getItem(STORAGE_KEYS.NILAI_TUGAS) || '[]');
      const found = allNilaiTugas.find(nt => nt.id === id && nt.user_id === currentUserId);
      if (found?.tanggal) targetTanggal = found.tanggal;
    }

    if (targetTanggal) {
      await this.ctx.assertPeriodeWritableByDate(targetTanggal);
    }

    this.ctx._invalidateCache([`nilai_${currentUserId}_`]);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        await this.ctx.supabase
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
    this.ctx._invalidateCache([`nilai_${currentUserId}_`]);
    return true;
  }
}
