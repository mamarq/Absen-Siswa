// data/stores/jam-pelajaran-store.js
// Domain Store: Master Jam Pelajaran (Per-Satuan JP)

import { INITIAL_DATA } from '../initialData.js';
import { STORAGE_KEYS, isValidUUID } from './shared-store-utils.js';

export class JamPelajaranStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Mengambil daftar master slot jam pelajaran (diurutkan nomor_urut)
   */
  async getJamPelajaranMaster() {
    const cacheKey = 'jam_pelajaran_master_list';
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
          .from('jam_pelajaran_master')
          .select('*')
          .order('nomor_urut', { ascending: true });
        if (!error && data && data.length > 0) {
          result = data;
          localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(data));
        }
      } catch (e) {
        console.warn('Supabase getJamPelajaranMaster fallback:', e);
      }
    }

    if (!result) {
      result = JSON.parse(localStorage.getItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER) || '[]');
      if (result.length === 0 && INITIAL_DATA.jamPelajaranMaster) {
        result = [...INITIAL_DATA.jamPelajaranMaster];
        localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(result));
      }
      result.sort((a, b) => (Number(a.nomor_urut) || 0) - (Number(b.nomor_urut) || 0));
    }

    return this.ctx._setCache(cacheKey, result);
  }

  /**
   * Menyimpan atau memperbarui 1 slot jam pelajaran master
   */
  async saveJamPelajaranMaster(item) {
    this.ctx._invalidateCache(['jam_pelajaran_', 'jadwal_']);
    let id = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'jp-' + Date.now());
    const payload = {
      nomor_urut: Number(item.nomor_urut) || 1,
      label: item.label || `Jam ke-${item.nomor_urut || 1}`,
      jam_mulai: item.jam_mulai || '07:30',
      jam_selesai: item.jam_selesai || '08:15',
      tipe_slot: item.tipe_slot === 'istirahat' ? 'istirahat' : 'mengajar',
      keterangan: item.keterangan || '',
      updated_at: new Date().toISOString()
    };

    let supabaseError = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (item.id && isValidUUID(item.id)) {
          const { error } = await this.ctx.supabase
            .from('jam_pelajaran_master')
            .update(payload)
            .eq('id', item.id);
          if (error) throw error;
        } else {
          const { data, error } = await this.ctx.supabase
            .from('jam_pelajaran_master')
            .insert([{ ...payload, id: isValidUUID(id) ? id : undefined }])
            .select()
            .single();
          if (error) throw error;
          if (data) id = data.id;
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase saveJamPelajaranMaster error:', e);
      }
    }

    // Local Storage Sync
    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER) || '[]');
    const idx = list.findIndex(j => j.id === id || (j.id === item.id));
    const entry = { id, ...payload };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    list.sort((a, b) => a.nomor_urut - b.nomor_urut);
    localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(list));

    return { success: !supabaseError, id, error: supabaseError?.message };
  }

  /**
   * Menghapus 1 slot jam pelajaran master
   */
  async deleteJamPelajaranMaster(id) {
    this.ctx._invalidateCache(['jam_pelajaran_', 'jadwal_']);
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        if (isValidUUID(id)) {
          await this.ctx.supabase.from('jam_pelajaran_master').delete().eq('id', id);
        }
      } catch (e) {
        console.error('Supabase deleteJamPelajaranMaster error:', e);
      }
    }

    let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER) || '[]');
    list = list.filter(j => j.id !== id);
    localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(list));
    return { success: true };
  }

  /**
   * Reset master jam pelajaran ke template default
   */
  async resetJamPelajaranMasterToDefault() {
    this.ctx._invalidateCache(['jam_pelajaran_', 'jadwal_']);
    const defaultList = INITIAL_DATA.jamPelajaranMaster || [];

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        for (const item of defaultList) {
          await this.ctx.supabase.from('jam_pelajaran_master').upsert({
            nomor_urut: item.nomor_urut,
            label: item.label,
            jam_mulai: item.jam_mulai.length === 5 ? item.jam_mulai + ':00' : item.jam_mulai,
            jam_selesai: item.jam_selesai.length === 5 ? item.jam_selesai + ':00' : item.jam_selesai,
            tipe_slot: item.tipe_slot || 'mengajar',
            keterangan: item.keterangan || ''
          }, { onConflict: 'nomor_urut' });
        }
      } catch (e) {
        console.warn('Supabase resetJamPelajaranMaster fallback:', e);
      }
    }

    localStorage.setItem(STORAGE_KEYS.JAM_PELAJARAN_MASTER, JSON.stringify(defaultList));
    return { success: true };
  }
}
