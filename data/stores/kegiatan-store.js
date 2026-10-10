// data/stores/kegiatan-store.js
// Domain Store: Kegiatan Siswa & Badges Sikap

import { STORAGE_KEYS } from './shared-store-utils.js';

export class KegiatanStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  async getKegiatanSiswaByTanggal(tanggal) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `kegiatan_tgl_${currentUserId}_${tanggal || 'none'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
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

    return this.ctx._setCache(cacheKey, result, 60000); // 1 min cache
  }

  async getAllKegiatanSiswa(academicYear) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const cacheKey = `kegiatan_year_${currentUserId}_${academicYear || 'all'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let rawData = [];
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let query = this.ctx.supabase
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
      allSiswa = await this.ctx.getAllSiswa();
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

    return this.ctx._setCache(cacheKey, result, 60000);
  }

  async getKegiatanSiswaBySiswa(siswaId) {
    const list = await this.getAllKegiatanSiswa();
    return list.filter(k => k.siswa_id === siswaId);
  }

  async addKegiatanSiswa(kegiatanData) {
    const currentUser = await this.ctx.getCurrentUser();
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
      academic_year: cleanPayload.academic_year || (await this.ctx.getActiveAcademicYear())
    };

    if (payload.tanggal) {
      await this.ctx.assertPeriodeWritableByDate(payload.tanggal);
    }

    let newItem = {
      id: 'act-' + Date.now(),
      created_at: new Date().toISOString(),
      ...payload
    };

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase
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
    this.ctx._invalidateCache([
      `kegiatan_tgl_${currentUserId}_`,
      `kegiatan_year_${currentUserId}_`
    ]);
    return newItem;
  }

  async deleteKegiatanSiswa(id) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !id) return false;

    // Mode Arsip Guard: Lookup target kegiatan_siswa untuk memeriksa tanggal terhadap status periode
    let targetTanggal = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: item } = await this.ctx.supabase
          .from('kegiatan_siswa')
          .select('id, tanggal, user_id')
          .eq('id', id)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (item && item.tanggal) targetTanggal = item.tanggal;
      } catch (err) {
        console.warn('Error fetching kegiatan_siswa for delete guard:', err);
      }
    }

    if (!targetTanggal) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.KEGIATAN) || '[]');
      const localItem = localList.find(k => k.id === id && k.user_id === currentUserId);
      if (localItem && localItem.tanggal) targetTanggal = localItem.tanggal;
    }

    if (targetTanggal) {
      await this.ctx.assertPeriodeWritableByDate(targetTanggal);
    }

    let deletedSuccessfully = false;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
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
      this.ctx._invalidateCache([
        `kegiatan_tgl_${currentUserId}_`,
        `kegiatan_year_${currentUserId}_`
      ]);
      return true;
    }

    return false;
  }
}
