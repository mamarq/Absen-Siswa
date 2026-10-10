// data/stores/periode-store.js
// Domain Store: Master Periode Semester & Lifecycle Archive Guards

import { INITIAL_DATA } from '../initialData.js';
import { STORAGE_KEYS, isValidUUID } from './shared-store-utils.js';

export class PeriodeStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Mengambil SELURUH daftar periode semester yang terdaftar, diurutkan tanggal_mulai ASC.
   */
  async getPeriodeSemesterList() {
    const cacheKey = 'periode_semester_list';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
          .from('periode_semester')
          .select('*')
          .order('tanggal_mulai', { ascending: true });

        if (!error && data && data.length > 0) {
          result = data;
        }
      } catch (e) {
        console.warn('Supabase getPeriodeSemesterList fallback:', e);
      }
    }

    if (result.length === 0) {
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.PERIODE_SEMESTER) || '[]');
      if (localData.length > 0) {
        result = localData;
      } else {
        result = INITIAL_DATA.periodeSemester || [];
        try {
          localStorage.setItem(STORAGE_KEYS.PERIODE_SEMESTER, JSON.stringify(result));
        } catch {}
      }
      result.sort((a, b) => (a.tanggal_mulai || '').localeCompare(b.tanggal_mulai || ''));
    }

    return this.ctx._setCache(cacheKey, result);
  }

  /**
   * Mengambil periode semester yang saat ini AKTIF (is_active = true / status = 'aktif')
   */
  async getActiveSemester() {
    const cacheKey = 'active_semester_period';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    const list = await this.getPeriodeSemesterList();
    const active = list.find(p => p.is_active === true) || null;

    return this.ctx._setCache(cacheKey, active);
  }

  /**
   * Mengambil periode semester yang menaungi suatu tanggal tertentu (tanggal_mulai <= date <= tanggal_selesai)
   * PURE DATE LOOKUP: Jika tanggal null/invalid atau berada di luar periode yang terdaftar, kembalikan null.
   */
  async getPeriodeByDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const cleanDate = dateStr.trim().substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;

    const list = await this.getPeriodeSemesterList();
    if (!Array.isArray(list) || list.length === 0) return null;

    const matched = list.find(p => {
      const start = p.tanggal_mulai ? p.tanggal_mulai.substring(0, 10) : '';
      const end = p.tanggal_selesai ? p.tanggal_selesai.substring(0, 10) : '';
      return start && end && cleanDate >= start && cleanDate <= end;
    });

    return matched || null;
  }

  /**
   * Memastikan tanggal yang dituju dapat ditulis (tidak berada dalam semester yang ditutup).
   * Fail-open untuk unmapped dates / sistem lama tanpa periode semester:
   * Jika tidak ada periode yang menaungi tanggal ini, atau statusnya draft / aktif, izinkan penulisan.
   * Hanya lempar error jika tanggal berada dalam periode dengan status = 'ditutup'.
   */
  async assertPeriodeWritableByDate(dateStr) {
    if (!dateStr) return true;
    const periode = await this.getPeriodeByDate(dateStr);
    if (periode && periode.status === 'ditutup') {
      const periodeLabel = `${periode.academic_year || ''} (${periode.semester || ''})`.trim();
      throw new Error(`Operasi ditolak: Periode semester ${periodeLabel} telah ditutup (Mode Arsip / Read-Only).`);
    }
    return true;
  }

  /**
   * Mengambil satu periode semester spesifik berdasarkan academic_year dan semester.
   * @param {string} academicYear
   * @param {string} semester
   * @returns {Promise<Object|null>}
   */
  async getPeriodeSemester(academicYear, semester) {
    if (!academicYear || !semester) return null;
    const cleanYear = String(academicYear).trim();
    const cleanSem = String(semester).trim();
    const list = await this.getPeriodeSemesterList();
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.find(p => p.academic_year === cleanYear && p.semester === cleanSem) || null;
  }

  /**
   * Memastikan periode semester yang dituju dapat ditulis (tidak berstatus 'ditutup').
   * Fail-open untuk unmapped periods / data legacy tanpa record periode:
   * Jika tidak ditemukan periode untuk kombinasi tahun ajaran & semester tersebut, izinkan (return true).
   * Jika periode ditemukan dan status === 'ditutup', lempar error operasional.
   * @param {string} academicYear
   * @param {string} semester
   * @returns {Promise<boolean>}
   */
  async assertPeriodeWritableBySemester(academicYear, semester) {
    if (!academicYear || !semester) return true;
    const cleanSem = String(semester).trim();
    if (cleanSem === 'Semua') {
      throw new Error('Operasi ditolak: Operasi penulisan / mutasi data memerlukan semester spesifik (Ganjil atau Genap), bukan "Semua".');
    }
    const periode = await this.getPeriodeSemester(academicYear, cleanSem);
    if (periode && periode.status === 'ditutup') {
      const periodeLabel = `${periode.academic_year || academicYear} (${periode.semester || cleanSem})`.trim();
      throw new Error(`Operasi ditolak: Periode semester ${periodeLabel} telah ditutup (Mode Arsip / Read-Only).`);
    }
    return true;
  }

  /**
   * Mengambil seluruh periode semester untuk tahun ajaran tertentu
   */
  async getPeriodeByAcademicYear(academicYear) {
    const list = await this.getPeriodeSemesterList();
    if (!academicYear) return list;
    return list.filter(p => p.academic_year === academicYear);
  }

  /**
   * Menambahkan atau mengupdate periode semester dengan validasi ketat
   */
  async savePeriodeSemester(periodeData) {
    if (!periodeData) throw new Error('Data periode semester wajib diisi.');
    const academicYear = (periodeData.academic_year || '').trim();
    const semester = (periodeData.semester || '').trim();
    const start = (periodeData.tanggal_mulai || '').trim().substring(0, 10);
    const end = (periodeData.tanggal_selesai || '').trim().substring(0, 10);

    if (!academicYear) throw new Error('Tahun ajaran wajib diisi.');
    if (!['Ganjil', 'Genap'].includes(semester)) throw new Error('Semester wajib dipilih (Ganjil atau Genap).');
    if (!start) throw new Error('Tanggal mulai wajib diisi.');
    if (!end) throw new Error('Tanggal selesai wajib diisi.');
    if (start > end) throw new Error('Tanggal mulai tidak boleh melebihi tanggal selesai.');

    // Validasi duplikasi & overlap terhadap seluruh data periode
    const existingList = await this.getPeriodeSemesterList();
    const editingId = periodeData.id || null;

    if (editingId) {
      const existing = existingList.find(p => String(p.id) === String(editingId));
      if (existing && existing.status === 'ditutup') {
        throw new Error('Periode yang sudah ditutup bersifat permanen (read-only) dan tidak dapat diubah.');
      }
    }

    for (const p of existingList) {
      if (editingId && p.id === editingId) continue;
      if (p.academic_year === academicYear) {
        // Cek duplikasi semester pada tahun ajaran yang sama
        if (p.semester === semester) {
          throw new Error(`Periode ${semester} untuk Tahun Ajaran ${academicYear} sudah terdaftar.`);
        }
        // Cek overlap tanggal pada tahun ajaran yang sama
        const pStart = p.tanggal_mulai ? p.tanggal_mulai.substring(0, 10) : '';
        const pEnd = p.tanggal_selesai ? p.tanggal_selesai.substring(0, 10) : '';
        if (pStart && pEnd && start <= pEnd && end >= pStart) {
          throw new Error(`Rentang tanggal (${start} s.d ${end}) tumpang tindih dengan periode ${p.semester} (${pStart} s.d ${pEnd}).`);
        }
      }
    }

    this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);

    const payload = {
      ...periodeData,
      academic_year: academicYear,
      semester: semester,
      tanggal_mulai: start,
      tanggal_selesai: end,
      status: periodeData.status || (periodeData.is_active ? 'aktif' : 'draft'),
      is_active: periodeData.is_active === true || periodeData.status === 'aktif',
      updated_at: new Date().toISOString()
    };

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (payload.is_active) {
          // Hanya ubah status='draft' untuk periode yang status='aktif' (JANGAN ubah status 'ditutup')
          await this.ctx.supabase
            .from('periode_semester')
            .update({ is_active: false, status: 'draft', updated_at: new Date().toISOString() })
            .eq('status', 'aktif')
            .neq('id', payload.id || '00000000-0000-0000-0000-000000000000');

          await this.ctx.supabase
            .from('periode_semester')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('is_active', true)
            .neq('id', payload.id || '00000000-0000-0000-0000-000000000000');
        }
        if (payload.id && isValidUUID(payload.id)) {
          const { data, error } = await this.ctx.supabase
            .from('periode_semester')
            .update(payload)
            .eq('id', payload.id)
            .select()
            .single();
          if (error) throw error;
          this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);
          return data;
        } else {
          const { data, error } = await this.ctx.supabase
            .from('periode_semester')
            .insert([payload])
            .select()
            .single();
          if (error) throw error;
          this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);
          return data;
        }
      } catch (e) {
        console.warn('Supabase savePeriodeSemester fallback:', e);
      }
    }

    let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PERIODE_SEMESTER) || '[]');
    if (payload.is_active) {
      localList = localList.map(p => ({
        ...p,
        is_active: false,
        status: p.status === 'aktif' ? 'draft' : p.status
      }));
    }
    if (payload.id) {
      const idx = localList.findIndex(p => p.id === payload.id);
      if (idx >= 0) {
        localList[idx] = { ...localList[idx], ...payload };
      } else {
        localList.push(payload);
      }
    } else {
      payload.id = 'ps-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      localList.push(payload);
    }
    localStorage.setItem(STORAGE_KEYS.PERIODE_SEMESTER, JSON.stringify(localList));
    this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);
    return payload;
  }

  /**
   * Menetapkan satu periode semester menjadi AKTIF secara atomik (is_active = true, status = 'aktif')
   * menggunakan RPC database public.set_active_periode dengan fallback offline/localStorage yang aman.
   * @param {string} id - ID Periode Semester yang akan diaktifkan
   */
  async setActivePeriode(id) {
    if (!id) throw new Error('ID periode semester wajib diisi.');

    this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);

    // 1. Eksekusi Atomic RPC via Supabase bila terhubung
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase.rpc('set_active_periode', { target_id: id });
        if (error) throw error;
        this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);
        return data;
      } catch (e) {
        console.warn('Supabase set_active_periode RPC fallback / error:', e);
        if (e.message && !e.message.includes('fetch failed') && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
          throw e;
        }
      }
    }

    // 2. LocalStorage Fallback (dan in-memory testing environment)
    const list = await this.getPeriodeSemesterList();
    const target = list.find(p => String(p.id) === String(id));
    if (!target) {
      throw new Error('Periode semester tidak ditemukan.');
    }
    if (target.status === 'ditutup') {
      throw new Error('Periode yang sudah ditutup tidak dapat diaktifkan kembali.');
    }
    if (target.status === 'aktif' && target.is_active === true) {
      return target;
    }

    let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PERIODE_SEMESTER) || '[]');
    let targetPeriod = null;
    localList = localList.map(p => {
      if (String(p.id) === String(id)) {
        targetPeriod = { ...p, is_active: true, status: 'aktif', updated_at: new Date().toISOString() };
        return targetPeriod;
      } else {
        // ATURAN KETAT:
        // status='aktif' -> is_active=false, status='draft'
        // status='draft' -> is_active=false, status='draft'
        // status='ditutup' -> is_active=false, status='ditutup' (JANGAN DIUBAH MENJADI DRAFT)
        return {
          ...p,
          is_active: false,
          status: p.status === 'aktif' ? 'draft' : p.status,
          updated_at: new Date().toISOString()
        };
      }
    });

    localStorage.setItem(STORAGE_KEYS.PERIODE_SEMESTER, JSON.stringify(localList));
    this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);
    return targetPeriod;
  }

  /**
   * Menutup periode semester yang sedang aktif (status = 'ditutup', is_active = false)
   * Menggunakan RPC database public.tutup_semester dengan fallback offline/localStorage yang aman.
   * Hanya periode dengan status 'aktif' yang dapat ditutup.
   * @param {string} id - ID Periode Semester yang akan ditutup
   */
  async closePeriode(id) {
    if (!id) throw new Error('ID periode semester wajib diisi.');

    this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);

    // 1. Eksekusi Atomic RPC via Supabase bila terhubung
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase.rpc('tutup_semester', { target_id: id });
        if (error) throw error;
        this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);
        return data;
      } catch (e) {
        console.warn('Supabase tutup_semester RPC fallback / error:', e);
        if (e.message && !e.message.includes('fetch failed') && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
          throw e;
        }
      }
    }

    // 2. LocalStorage Fallback (dan in-memory testing environment)
    const list = await this.getPeriodeSemesterList();
    const target = list.find(p => String(p.id) === String(id));
    if (!target) {
      throw new Error('Periode semester tidak ditemukan.');
    }
    if (target.status === 'ditutup') {
      throw new Error('Periode sudah dalam status ditutup.');
    }
    if (target.status === 'draft') {
      throw new Error('Periode dengan status draft tidak dapat ditutup. Hanya periode aktif yang dapat ditutup.');
    }

    const currentUser = (typeof this.ctx.getCurrentUser === 'function') ? await this.ctx.getCurrentUser() : null;
    const closedBy = currentUser?.id || 'admin';
    const nowIso = new Date().toISOString();

    let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PERIODE_SEMESTER) || '[]');
    let targetPeriod = null;
    localList = localList.map(p => {
      if (String(p.id) === String(id)) {
        targetPeriod = {
          ...p,
          status: 'ditutup',
          is_active: false,
          closed_at: nowIso,
          closed_by: closedBy,
          updated_at: nowIso
        };
        return targetPeriod;
      }
      return p;
    });

    localStorage.setItem(STORAGE_KEYS.PERIODE_SEMESTER, JSON.stringify(localList));
    this.ctx._invalidateCache(['periode_semester_', 'active_semester_']);
    return targetPeriod;
  }
}
