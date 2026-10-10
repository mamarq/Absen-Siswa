// data/stores/jurnal-store.js
// Domain Store: Jurnal Pembelajaran Guru (jurnal_mengajar)
// Berkolaborasi dengan lifecycle sesi_mengajar via context facade (this.ctx)

import { STORAGE_KEYS } from './shared-store-utils.js';

export class JurnalStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Mengambil jurnal pembelajaran untuk suatu sesi tertentu
   * @param {string} sesiId
   * @returns {Promise<Object|null>}
   */
  async getJurnalBySesiId(sesiId) {
    if (!sesiId) return null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
          .from('jurnal_mengajar')
          .select('*')
          .eq('sesi_id', sesiId)
          .maybeSingle();

        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase getJurnalBySesiId error:', e);
      }
    }

    const allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');
    return allJurnal.find(j => j.sesi_id === sesiId) || null;
  }

  /**
   * Mengambil seluruh rekaman jurnal pembelajaran (dengan opsi filter tahun ajaran)
   * Menggunakan sesi_mengajar milik user aktif sebagai relasi
   * @param {string|null} academicYear
   * @returns {Promise<Array<Object>>}
   */
  async getAllJurnal(academicYear = null) {
    const allSesi = await this.ctx.getAllSesi(academicYear);
    return allSesi
      .filter(s => Boolean(s.jurnal_mengajar))
      .map(s => ({
        ...s.jurnal_mengajar,
        sesi: {
          id: s.id,
          tanggal: s.tanggal,
          kelas_id: s.kelas_id,
          nama_kelas: s.kelas?.nama_kelas || '',
          mapel: s.mapel,
          academic_year: s.academic_year || s.kelas?.academic_year || ''
        }
      }));
  }

  /**
   * Menyimpan atau memperbarui data jurnal pembelajaran untuk suatu sesi
   * Memvalidasi guard mode arsip jika tanggal sesi diketahui
   * @param {string} sesiId
   * @param {Object} jurnalData
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async saveJurnal(sesiId, jurnalData) {
    if (!sesiId) throw new Error('ID sesi wajib diisi.');
    if (!jurnalData) throw new Error('Data jurnal wajib diisi.');

    // 1. Cek tanggal sesi untuk validasi archive guard
    const allSesi = await this.ctx.getAllSesi();
    const existingSesi = allSesi.find(s => s.id === sesiId);
    if (existingSesi?.tanggal) {
      await this.ctx.assertPeriodeWritableByDate(existingSesi.tanggal);
    }

    const timestamp = new Date().toISOString();
    let savedRow = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        await this.ctx.supabase.from('jurnal_mengajar').delete().eq('sesi_id', sesiId);
        const { data, error } = await this.ctx.supabase
          .from('jurnal_mengajar')
          .insert([{
            sesi_id: sesiId,
            materi_pokok: jurnalData.materi_pokok || '-',
            kegiatan_pembelajaran: jurnalData.kegiatan_pembelajaran || '',
            kendala_refleksi: jurnalData.kendala_refleksi || '',
            created_at: timestamp,
            updated_at: timestamp
          }])
          .select()
          .single();

        if (!error && data) {
          savedRow = data;
        }
      } catch (err) {
        console.warn('Supabase saveJurnal warning:', err);
      }
    }

    // LocalStorage Sync
    let allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');
    allJurnal = allJurnal.filter(j => j.sesi_id !== sesiId);

    const newJurnal = savedRow || {
      id: 'jur-' + Date.now(),
      sesi_id: sesiId,
      materi_pokok: jurnalData.materi_pokok || '-',
      kegiatan_pembelajaran: jurnalData.kegiatan_pembelajaran || '',
      kendala_refleksi: jurnalData.kendala_refleksi || '',
      created_at: timestamp,
      updated_at: timestamp
    };

    allJurnal.push(newJurnal);
    localStorage.setItem(STORAGE_KEYS.JURNAL, JSON.stringify(allJurnal));

    this.ctx._invalidateCache(['sesi_']);

    return { success: true, data: newJurnal };
  }
}
