// data/stores/akademik-store.js
// Domain Store: Master Akademik (Tahun Ajaran, Kelas, Siswa, Mata Pelajaran, Jurusan, Kenaikan Kelas)

import { STORAGE_KEYS } from './shared-store-utils.js';
import { INITIAL_DATA } from '../initialData.js';

export class AkademikStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  // ==========================================================================
  // HELPER GROUPING & SORTING TINGKAT KELAS
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
  // TAHUN AJARAN
  // ==========================================================================
  async getDistinctAcademicYears() {
    const cacheKey = 'academic_years';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let years = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
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
    return this.ctx._setCache(cacheKey, sorted, 10 * 60 * 1000);
  }

  async getActiveAcademicYear() {
    const cacheKey = 'active_academic_year';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let activeYear = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
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

    return this.ctx._setCache(cacheKey, activeYear, 10 * 60 * 1000);
  }

  // ==========================================================================
  // MASTER KELAS
  // ==========================================================================
  async getClassesByYear(academicYear, onlyActive = false) {
    return this.getKelasByTahunAjaran(academicYear, onlyActive);
  }

  async getKelasByTahunAjaran(academicYear, onlyActive = false) {
    const cacheKey = `classes_${academicYear || 'all'}_active_${onlyActive}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let query = this.ctx.supabase.from('kelas').select('*, jurusan_master:jurusan_id (id, nama, kode, is_active)');
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
    return this.ctx._setCache(cacheKey, grouped);
  }

  async getKelas(academicYear) {
    if (academicYear) {
      return this.getKelasByTahunAjaran(academicYear);
    }
    const cacheKey = 'classes_all_master';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
          .from('kelas')
          .select('*, jurusan_master:jurusan_id (id, nama, kode, is_active)')
          .order('nama_kelas');
        if (!error && data && data.length > 0) {
          const grouped = this.groupAndSortKelas(data);
          return this.ctx._setCache(cacheKey, grouped);
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
    return this.ctx._setCache(cacheKey, grouped);
  }

  async addKelas(kelasData) {
    this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);

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

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
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
          this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
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
    this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
    return newKelas;
  }

  async updateKelas(id, updatedData) {
    this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);

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
        } catch (e) {}
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

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
          .from('kelas')
          .update(payload)
          .eq('id', id)
          .select('*, jurusan_master:jurusan_id (id, nama, kode, is_active)')
          .single();
        if (!error && data) {
          this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
          return data;
        }
      } catch (err) {
        console.warn('Supabase updateKelas catch:', err);
      }
    }

    let allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    allKelas = allKelas.map(k => (k.id === id ? { ...k, ...payload } : k));
    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(allKelas));
    this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
    return true;
  }

  async deleteKelas(id) {
    this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        await this.ctx.supabase.from('kelas').delete().eq('id', id);
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
    this.ctx._invalidateCache(['classes_', 'master_jurusan_list', 'master_jurusan_all', 'academic_year', 'active_academic_year', 'siswa_']);

    return true;
  }

  // ==========================================================================
  // MASTER JURUSAN
  // ==========================================================================
  async getJurusanList() {
    const cacheKey = 'master_jurusan_list';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
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

    return this.ctx._setCache(cacheKey, formatted);
  }

  async getAllJurusan() {
    const cacheKey = 'master_jurusan_all';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
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

    return this.ctx._setCache(cacheKey, formatted);
  }

  async addJurusan(jurusanData) {
    const currentUser = await this.ctx.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Hanya Administrator yang memiliki akses untuk mengelola master jurusan.');
    }

    const nama = (jurusanData?.nama || '').trim();
    if (!nama) {
      throw new Error('Nama jurusan wajib diisi.');
    }
    const rawKode = (jurusanData?.kode || '').trim();
    const kode = rawKode ? rawKode.toUpperCase() : null;

    this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
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
      this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
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
    this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
    return {
      ...newJurusan,
      code: newJurusan.kode || newJurusan.nama,
      label: newJurusan.kode ? `${newJurusan.kode} - ${newJurusan.nama}` : newJurusan.nama
    };
  }

  async updateJurusan(id, updatedData) {
    const currentUser = await this.ctx.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Hanya Administrator yang memiliki akses untuk mengelola master jurusan.');
    }

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

    this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all', 'classes_']);

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
        .from('jurusan')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateJurusan error:', error);
        throw error;
      }

      if (payload.nama) {
        try {
          await this.ctx.supabase
            .from('kelas')
            .update({ jurusan: payload.nama })
            .eq('jurusan_id', id);
        } catch (syncErr) {
          console.warn('Sync legacy kelas.jurusan error:', syncErr);
        }
      }

      this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all', 'classes_']);
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

    this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all', 'classes_']);
    return updatedItem ? {
      ...updatedItem,
      code: updatedItem.kode || updatedItem.nama,
      label: updatedItem.kode ? `${updatedItem.kode} - ${updatedItem.nama}` : updatedItem.nama
    } : null;
  }

  async deactivateJurusan(id) {
    if (!id) throw new Error('ID jurusan wajib diisi.');

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { count, error: countError } = await this.ctx.supabase
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

      const { data, error } = await this.ctx.supabase
        .from('jurusan')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase deactivateJurusan error:', error);
        throw error;
      }

      this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
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
    this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
    return true;
  }

  async reactivateJurusan(id) {
    if (!id) throw new Error('ID jurusan wajib diisi.');

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
        .from('jurusan')
        .update({ is_active: true })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase reactivateJurusan error:', error);
        throw error;
      }

      this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
      return data;
    }

    let localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURUSAN) || '[]');
    localData = localData.map(j => (j.id === id ? { ...j, is_active: true } : j));
    localStorage.setItem(STORAGE_KEYS.JURUSAN, JSON.stringify(localData));
    this.ctx._invalidateCache(['master_jurusan_list', 'master_jurusan_all']);
    return true;
  }

  async deleteJurusan(id) {
    return this.deactivateJurusan(id);
  }

  // ==========================================================================
  // MASTER MATA PELAJARAN
  // ==========================================================================
  async getMataPelajaran() {
    const cacheKey = 'mapel_all';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase.from('mata_pelajaran').select('*').order('nama_mapel');
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

    return this.ctx._setCache(cacheKey, result);
  }

  async getMapelList() {
    const list = await this.getMataPelajaran();
    return list.map(m => m.nama_mapel);
  }

  async addMataPelajaran(mapelData) {
    this.ctx._invalidateCache(['mapel_']);
    const rawCat = (mapelData.kategori || 'UMUM').toString().trim().toUpperCase();
    const isPilihan = rawCat === 'PILIHAN' || rawCat === 'KEJURUAN';
    const kategori = isPilihan ? 'PILIHAN' : 'UMUM';

    const newMapel = {
      id: 'mp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nama_mapel: mapelData.nama_mapel.trim(),
      kode: (mapelData.kode || '').trim().toUpperCase() || mapelData.nama_mapel.substring(0, 3).toUpperCase(),
      kategori
    };

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase.from('mata_pelajaran').insert([{
          nama_mapel: newMapel.nama_mapel,
          kode: newMapel.kode,
          kategori: newMapel.kategori
        }]).select().single();
        if (!error && data) {
          this.ctx._invalidateCache(['mapel_']);
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
    this.ctx._invalidateCache(['mapel_']);
    return newMapel;
  }

  async updateMataPelajaran(id, updatedData) {
    this.ctx._invalidateCache(['mapel_']);
    const rawCat = (updatedData.kategori || 'UMUM').toString().trim().toUpperCase();
    const isPilihan = rawCat === 'PILIHAN' || rawCat === 'KEJURUAN';
    const kategori = isPilihan ? 'PILIHAN' : 'UMUM';

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase.from('mata_pelajaran').update({
          nama_mapel: updatedData.nama_mapel.trim(),
          kode: (updatedData.kode || '').trim().toUpperCase(),
          kategori
        }).eq('id', id).select().single();
        if (!error && data) {
          this.ctx._invalidateCache(['mapel_']);
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
    this.ctx._invalidateCache(['mapel_']);
    return true;
  }

  async deleteMataPelajaran(id) {
    this.ctx._invalidateCache(['mapel_']);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        await this.ctx.supabase.from('mata_pelajaran').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase deleteMataPelajaran error:', e);
      }
    }

    let list = await this.getMataPelajaran();
    list = list.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MATA_PELAJARAN, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.MAPEL_LIST, JSON.stringify(list.map(m => m.nama_mapel)));
    this.ctx._invalidateCache(['mapel_']);
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
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
        .from('siswa')
        .select('*')
        .order('nomor_absen', { ascending: true })
        .order('nama_lengkap', { ascending: true });
      if (!error && data) result = data;
    }

    if (!result) {
      result = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    }

    return this.ctx._setCache(cacheKey, result);
  }

  async getSiswaByKelas(kelasId, onlyActive = false) {
    const cacheKey = `siswa_kelas_${kelasId || 'none'}_active_${onlyActive}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      let query = this.ctx.supabase
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

    return this.ctx._setCache(cacheKey, result);
  }

  async addSiswa(siswaData) {
    this.ctx._invalidateCache(['siswa_']);
    const newSiswa = {
      id: 's-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      ...siswaData
    };

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase.from('siswa').insert([siswaData]).select().single();
      if (!error && data) {
        this.ctx._invalidateCache(['siswa_']);
        return data;
      }
    }

    const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa.push(newSiswa);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this.ctx._invalidateCache(['siswa_']);
    return newSiswa;
  }

  async updateSiswa(id, updatedData) {
    this.ctx._invalidateCache(['siswa_']);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase.from('siswa').update(updatedData).eq('id', id).select().single();
      if (!error && data) {
        this.ctx._invalidateCache(['siswa_']);
        return data;
      }
    }

    let allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa = allSiswa.map(s => (s.id === id ? { ...s, ...updatedData } : s));
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this.ctx._invalidateCache(['siswa_']);
    return true;
  }

  async deleteSiswa(id) {
    this.ctx._invalidateCache(['siswa_']);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      await this.ctx.supabase.from('siswa').delete().eq('id', id);
    }
    let allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
    allSiswa = allSiswa.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(allSiswa));
    this.ctx._invalidateCache(['siswa_']);
    return true;
  }

  async bulkImportSiswa(kelasId, namesList) {
    this.ctx._invalidateCache(['siswa_']);
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

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { error } = await this.ctx.supabase.from('siswa').insert(newEntries.map(e => ({
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
    this.ctx._invalidateCache(['siswa_']);
    return newEntries;
  }

  // ==========================================================================
  // KENAIKAN KELAS (GRADE PROMOTION)
  // ==========================================================================
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

  async processKenaikanKelas(payload) {
    const { sourceYear, targetYear, mappings } = payload;
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return { success: false, message: 'Mapping kelas belum ditentukan.' };
    }

    let rpcSuccess = false;
    let rpcResult = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase.rpc('process_kenaikan_kelas_batch', {
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

    let localKelasList = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
    let localSiswaList = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');

    let promotedCount = 0;
    let graduatedCount = 0;
    let retainedCount = 0;
    let classesCreatedCount = 0;
    const classResults = [];

    let currentTargetYearClasses = localKelasList.filter(k => (k.academic_year || '').trim() === targetYear.trim());

    for (const mapping of mappings) {
      const {
        source_kelas_id,
        target_kelas_nama,
        target_tingkat = 'XI',
        target_jurusan = null,
        target_jurusan_id = null,
        target_jurusan_master = null,
        action = 'promote',
        student_overrides = []
      } = mapping;

      if (action === 'skip') {
        continue;
      }

      if (action === 'graduate') {
        let gradInThisClass = 0;
        localSiswaList = localSiswaList.map(s => {
          if (s.kelas_id === source_kelas_id) {
            gradInThisClass++;
            return { ...s, is_active: false };
          }
          return s;
        });

        if (!rpcSuccess && this.ctx.isSupabaseConnected && this.ctx.supabase) {
          try {
            await this.ctx.supabase
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

      if (action === 'promote' && target_kelas_nama) {
        let targetKelas = currentTargetYearClasses.find(
          k => k.nama_kelas.toLowerCase().trim() === target_kelas_nama.toLowerCase().trim()
        );

        if (!targetKelas) {
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

          if (!rpcSuccess && this.ctx.isSupabaseConnected && this.ctx.supabase) {
            try {
              const { data: createdKelas, error: kErr } = await this.ctx.supabase
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

        if (!rpcSuccess && this.ctx.isSupabaseConnected && this.ctx.supabase) {
          try {
            for (const upd of studentUpdates) {
              const payload = { is_active: upd.is_active };
              if (upd.kelas_id) payload.kelas_id = upd.kelas_id;
              await this.ctx.supabase.from('siswa').update(payload).eq('id', upd.id);
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

    localStorage.setItem(STORAGE_KEYS.KELAS, JSON.stringify(localKelasList));
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(localSiswaList));
    this.ctx._invalidateCache();

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
}
