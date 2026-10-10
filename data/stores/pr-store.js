// data/stores/pr-store.js
// Domain Store: Pekerjaan Rumah (PR) - Master Tugas & Nilai Siswa (pr_tugas & pr_nilai_siswa)

import { STORAGE_KEYS, isValidUUID } from './shared-store-utils.js';

export class PRStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Mengambil daftar PR dengan filter status, kelas_id, dan academic_year (Strict Per-User)
   */
  async getPRList({ status, kelas_id, academic_year } = {}) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();
    const cacheKey = `pr_list_${currentUserId}_${status || 'all'}_${kelas_id || 'all'}_${activeYear || 'all'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let query = this.ctx.supabase
          .from('pr_tugas')
          .select(`
            *,
            kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year),
            mata_pelajaran:mapel_id (id, nama_mapel, kode, kategori),
            pr_nilai_siswa (*)
          `)
          .eq('user_id', currentUserId)
          .order('tanggal_diberikan', { ascending: false })
          .order('created_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }
        if (kelas_id) {
          query = query.eq('kelas_id', kelas_id);
        }
        if (activeYear) {
          query = query.eq('academic_year', activeYear);
        }

        const { data, error } = await query;
        if (!error && data) result = data;
      } catch (e) {
        console.warn('Supabase getPRList fallback:', e);
      }
    }

    if (!result) {
      // Fallback Local Storage: strict p.user_id === currentUserId
      const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
      const allNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
      const allKelas = await this.ctx.getKelas(activeYear);
      const allMapel = await this.ctx.getMataPelajaran();

      const kelasMap = new Map(allKelas.map(k => [k.id, k]));
      const mapelMap = new Map(allMapel.map(m => [m.id, m]));

      let filtered = allPR.filter(p => p.user_id === currentUserId).map(pr => {
        const k = kelasMap.get(pr.kelas_id) || null;
        const m = pr.mapel_id ? mapelMap.get(pr.mapel_id) : null;
        const nilaiRows = allNilai.filter(n => n.pr_tugas_id === pr.id);
        return {
          ...pr,
          kelas: k,
          mata_pelajaran: m,
          pr_nilai_siswa: (Array.isArray(pr.pr_nilai_siswa) && pr.pr_nilai_siswa.length > 0) ? pr.pr_nilai_siswa : nilaiRows
        };
      });

      if (status) {
        filtered = filtered.filter(p => p.status === status);
      }
      if (kelas_id) {
        filtered = filtered.filter(p => p.kelas_id === kelas_id);
      }
      if (activeYear) {
        filtered = filtered.filter(p => {
          if (p.academic_year) return p.academic_year === activeYear;
          return p.kelas?.academic_year === activeYear;
        });
      }

      result = filtered.sort((a, b) => new Date(b.tanggal_diberikan) - new Date(a.tanggal_diberikan));
    }

    return this.ctx._setCache(cacheKey, result, 60000);
  }

  /**
   * Mengambil detail lengkap 1 data PR beserta seluruh baris nilai siswa (Strict Per-User)
   */
  async getPRDetail(prId) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !prId) return null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data, error } = await this.ctx.supabase
          .from('pr_tugas')
          .select(`
            *,
            kelas:kelas_id (id, nama_kelas, tingkat, jurusan, academic_year),
            mata_pelajaran:mapel_id (id, nama_mapel, kode, kategori),
            pr_nilai_siswa (
              id,
              siswa_id,
              nilai,
              mengumpulkan,
              tanggal_diperiksa,
              catatan,
              siswa:siswa_id (id, nama_lengkap, nomor_absen, jenis_kelamin, nisn)
            )
          `)
          .eq('id', prId)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!error && data) {
          if (Array.isArray(data.pr_nilai_siswa)) {
            data.pr_nilai_siswa.sort((a, b) => {
              const noA = a.siswa?.nomor_absen || 999;
              const noB = b.siswa?.nomor_absen || 999;
              return noA - noB;
            });
          }
          return data;
        }
      } catch (e) {
        console.warn('Supabase getPRDetail fallback:', e);
      }
    }

    // Fallback Local Storage (Strict Parent Ownership)
    const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const pr = allPR.find(p => p.id === prId && p.user_id === currentUserId);
    if (!pr) return null;

    const allKelas = await this.ctx.getKelas();
    const allMapel = await this.ctx.getMataPelajaran();
    const allSiswa = await this.ctx.getSiswaByKelas(pr.kelas_id);
    const allNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');

    const kelas = allKelas.find(k => k.id === pr.kelas_id) || null;
    const mapel = pr.mapel_id ? allMapel.find(m => m.id === pr.mapel_id) : null;
    const nilaiRows = allNilai.filter(n => n.pr_tugas_id === pr.id).map(n => {
      const s = allSiswa.find(x => x.id === n.siswa_id) || null;
      return {
        ...n,
        siswa: s
      };
    }).sort((a, b) => (a.siswa?.nomor_absen || 999) - (b.siswa?.nomor_absen || 999));

    return {
      ...pr,
      kelas,
      mata_pelajaran: mapel,
      pr_nilai_siswa: nilaiRows
    };
  }

  /**
   * Membuat penugasan PR baru dan otomatis meng-generate baris awal pr_nilai_siswa (Strict Per-User)
   */
  async createPR(data) {
    if (!data) throw new Error('Data PR wajib diisi.');
    const tglDiberikan = data.tanggal_diberikan || new Date().toISOString().split('T')[0];
    await this.ctx.assertPeriodeWritableByDate(tglDiberikan);

    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    this.ctx._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    const currentYear = data.academic_year || await this.ctx.getActiveAcademicYear();

    const payload = {
      kelas_id: data.kelas_id,
      mapel_id: data.mapel_id || null,
      topik: (data.topik || '').trim(),
      tanggal_diberikan: tglDiberikan,
      status: 'menunggu',
      academic_year: currentYear,
      user_id: currentUserId,
      updated_at: timestamp
    };

    let prId = data.id || ('pr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4));
    let supabaseError = null;
    let isPartialFailure = false;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: insertedPR, error: prErr } = await this.ctx.supabase
          .from('pr_tugas')
          .insert([{ ...payload, created_at: timestamp }])
          .select()
          .single();

        if (prErr) throw prErr;
        prId = insertedPR.id;

        // Ambil seluruh siswa aktif di kelas tersebut
        const activeStudents = await this.ctx.getSiswaByKelas(data.kelas_id, true);
        if (activeStudents && activeStudents.length > 0) {
          const initialNilaiRows = activeStudents.map(s => ({
            pr_tugas_id: prId,
            siswa_id: s.id,
            nilai: null,
            mengumpulkan: true,
            created_at: timestamp,
            updated_at: timestamp
          }));

          const { error: childErr } = await this.ctx.supabase.from('pr_nilai_siswa').insert(initialNilaiRows);
          if (childErr) {
            isPartialFailure = true;
            supabaseError = new Error('Penugasan PR berhasil dibuat, tetapi gagal menginisialisasi daftar siswa: ' + childErr.message);
          }
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase createPR error:', e);
      }
    }

    // Simpan ke Cache Offline LocalStorage
    const localPREntry = { id: prId, ...payload, created_at: timestamp };
    let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    prList = prList.filter(p => !(p.id === prId && p.user_id === currentUserId));
    prList.unshift(localPREntry);
    localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));

    // Generate baris nilai lokal
    const activeStudents = await this.ctx.getSiswaByKelas(data.kelas_id, true);
    let allPRNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
    allPRNilai = allPRNilai.filter(n => n.pr_tugas_id !== prId);
    const localNilaiRows = activeStudents.map(s => ({
      id: 'prn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      pr_tugas_id: prId,
      siswa_id: s.id,
      nilai: null,
      mengumpulkan: true,
      tanggal_diperiksa: null,
      catatan: null,
      created_at: timestamp,
      updated_at: timestamp
    }));
    allPRNilai.push(...localNilaiRows);
    localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(allPRNilai));
    this.ctx._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);

    if (supabaseError) {
      return {
        success: false,
        id: prId,
        partial: isPartialFailure,
        error: supabaseError.message || String(supabaseError)
      };
    }

    return { success: true, id: prId };
  }

  /**
   * Submit hasil pemeriksaan nilai PR per siswa dan ubah status pr_tugas jadi 'selesai_diperiksa' (Strict Per-User)
   */
  async submitPemeriksaanPR(prId, { items = [], tanggal_diperiksa } = {}) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !prId) {
      return { success: false, error: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    // Guard: Pastikan periode semester PR belum ditutup (menggunakan tanggal_diberikan parent)
    let parentPRDate = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: prRow } = await this.ctx.supabase
          .from('pr_tugas')
          .select('tanggal_diberikan')
          .eq('id', prId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (prRow && prRow.tanggal_diberikan) {
          parentPRDate = prRow.tanggal_diberikan;
        }
      } catch (err) {
        console.warn('Lookup parent PR date cloud error:', err);
      }
    }
    if (!parentPRDate) {
      try {
        const prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
        const localPR = prList.find(p => p.id === prId && p.user_id === currentUserId);
        if (localPR && localPR.tanggal_diberikan) {
          parentPRDate = localPR.tanggal_diberikan;
        }
      } catch (err) {
        console.warn('Lookup parent PR date local error:', err);
      }
    }
    if (parentPRDate) {
      await this.ctx.assertPeriodeWritableByDate(parentPRDate);
    }

    this.ctx._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    const timestamp = new Date().toISOString();
    const checkDate = tanggal_diperiksa || timestamp;
    let supabaseError = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        // 1. Update status pr_tugas (Guarded by user_id)
        const { data: updatedPR, error: prErr } = await this.ctx.supabase
          .from('pr_tugas')
          .update({
            status: 'selesai_diperiksa',
            updated_at: timestamp
          })
          .eq('id', prId)
          .eq('user_id', currentUserId)
          .select()
          .maybeSingle();

        if (prErr) {
          throw prErr;
        }
        if (!updatedPR) {
          throw new Error('Penugasan PR tidak ditemukan atau Anda tidak memiliki izin untuk mengedit PR ini.');
        }

        // 2. Upsert masing-masing baris nilai siswa (Hanya setelah parent tervalidasi)
        for (const item of items) {
          const payload = {
            pr_tugas_id: prId,
            siswa_id: item.siswa_id,
            nilai: item.mengumpulkan === false ? null : (item.nilai !== null && item.nilai !== '' && !isNaN(item.nilai) ? Number(item.nilai) : null),
            mengumpulkan: item.mengumpulkan !== false,
            tanggal_diperiksa: checkDate,
            catatan: (item.catatan || '').trim() || null,
            updated_at: timestamp
          };

          if (item.id && isValidUUID(item.id)) {
            await this.ctx.supabase.from('pr_nilai_siswa').update(payload).eq('id', item.id);
          } else {
            await this.ctx.supabase.from('pr_nilai_siswa').upsert([payload], { onConflict: 'pr_tugas_id, siswa_id' });
          }
        }
      } catch (e) {
        supabaseError = e;
        console.error('Supabase submitPemeriksaanPR error:', e);
      }
    }

    // Update LocalStorage: Pastikan parent milik user aktif
    let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
    const targetPR = prList.find(p => p.id === prId && p.user_id === currentUserId);
    if (targetPR) {
      targetPR.status = 'selesai_diperiksa';
      targetPR.updated_at = timestamp;
      localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));

      let allPRNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
      for (const item of items) {
        const existingIdx = allPRNilai.findIndex(n => n.pr_tugas_id === prId && n.siswa_id === item.siswa_id);
        const updatedRow = {
          id: item.id || (existingIdx >= 0 ? allPRNilai[existingIdx].id : ('prn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6))),
          pr_tugas_id: prId,
          siswa_id: item.siswa_id,
          nilai: item.mengumpulkan === false ? null : (item.nilai !== null && item.nilai !== '' && !isNaN(item.nilai) ? Number(item.nilai) : null),
          mengumpulkan: item.mengumpulkan !== false,
          tanggal_diperiksa: checkDate,
          catatan: (item.catatan || '').trim() || null,
          updated_at: timestamp
        };

        if (existingIdx >= 0) {
          allPRNilai[existingIdx] = updatedRow;
        } else {
          allPRNilai.push(updatedRow);
        }
      }
      localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(allPRNilai));
    }
    this.ctx._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);

    if (supabaseError) {
      return { success: false, error: supabaseError.message || String(supabaseError) };
    }

    return { success: true };
  }

  /**
   * Hapus penugasan PR dan seluruh detail nilainya (Strict Per-User)
   */
  async deletePR(prId) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId || !prId) return false;

    // Guard: Pastikan periode semester PR belum ditutup (menggunakan tanggal_diberikan parent)
    let parentPRDate = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: prRow } = await this.ctx.supabase
          .from('pr_tugas')
          .select('tanggal_diberikan')
          .eq('id', prId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (prRow && prRow.tanggal_diberikan) {
          parentPRDate = prRow.tanggal_diberikan;
        }
      } catch (err) {
        console.warn('Lookup parent PR date cloud error:', err);
      }
    }
    if (!parentPRDate) {
      try {
        const prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
        const localPR = prList.find(p => p.id === prId && p.user_id === currentUserId);
        if (localPR && localPR.tanggal_diberikan) {
          parentPRDate = localPR.tanggal_diberikan;
        }
      } catch (err) {
        console.warn('Lookup parent PR date local error:', err);
      }
    }
    if (parentPRDate) {
      await this.ctx.assertPeriodeWritableByDate(parentPRDate);
    }

    this.ctx._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    let deleteSuccess = true;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { error } = await this.ctx.supabase
          .from('pr_tugas')
          .delete()
          .eq('id', prId)
          .eq('user_id', currentUserId);

        if (error) {
          console.warn('Supabase deletePR error:', error);
          deleteSuccess = false;
        }
      } catch (e) {
        console.warn('Supabase deletePR exception:', e);
        deleteSuccess = false;
      }
    }

    if (deleteSuccess) {
      let prList = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
      prList = prList.filter(p => !(p.id === prId && p.user_id === currentUserId));
      localStorage.setItem(STORAGE_KEYS.PR_TUGAS, JSON.stringify(prList));

      let allPRNilai = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_NILAI_SISWA) || '[]');
      allPRNilai = allPRNilai.filter(n => n.pr_tugas_id !== prId);
      localStorage.setItem(STORAGE_KEYS.PR_NILAI_SISWA, JSON.stringify(allPRNilai));
      this.ctx._invalidateCache([`pr_list_${currentUserId}_`, `pr_pending_count_${currentUserId}_`]);
    }

    return deleteSuccess;
  }

  /**
   * Menghitung jumlah PR dengan status 'menunggu' untuk badge notifikasi sidebar (Strict Per-User)
   */
  async getPendingPRCount(academicYear) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return 0;

    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const cacheKey = `pr_pending_count_${currentUserId}_${activeYear || 'all'}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached !== null) return cached;

    let countResult = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let query = this.ctx.supabase
          .from('pr_tugas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', currentUserId)
          .eq('status', 'menunggu');

        if (activeYear) {
          query = query.eq('academic_year', activeYear);
        }

        const { count, error } = await query;
        if (!error && count !== null) countResult = count;
      } catch (e) {
        console.warn('Supabase getPendingPRCount fallback:', e);
      }
    }

    if (countResult === null) {
      const allPR = JSON.parse(localStorage.getItem(STORAGE_KEYS.PR_TUGAS) || '[]');
      const allKelas = await this.ctx.getKelas(activeYear);
      const kelasMap = new Map(allKelas.map(k => [k.id, k]));

      const pending = allPR.filter(pr => {
        if (pr.user_id !== currentUserId) return false;
        if (pr.status !== 'menunggu') return false;
        if (!activeYear) return true;
        if (pr.academic_year === activeYear) return true;
        const k = kelasMap.get(pr.kelas_id);
        return k && k.academic_year === activeYear;
      });

      countResult = pending.length;
    }

    return this.ctx._setCache(cacheKey, countResult, 60000);
  }

  /**
   * Mengambil riwayat PR untuk satu siswa tertentu (untuk Rekap Per Siswa)
   */
  async getRekapPRBySiswa(siswaId, academicYear) {
    const activeYear = academicYear || await this.ctx.getActiveAcademicYear();
    const prList = await this.getPRList({ academic_year: activeYear });

    const results = [];
    for (const pr of prList) {
      const studentRow = (pr.pr_nilai_siswa || []).find(n => n.siswa_id === siswaId);
      if (studentRow) {
        results.push({
          pr_id: pr.id,
          topik: pr.topik,
          tanggal_diberikan: pr.tanggal_diberikan,
          status_pr: pr.status,
          mapel: pr.mata_pelajaran?.nama_mapel || 'Mapel Tidak Diketahui',
          mapel_kode: pr.mata_pelajaran?.kode || 'MPL',
          kelas: pr.kelas?.nama_kelas || 'Kelas',
          nilai: studentRow.nilai,
          mengumpulkan: studentRow.mengumpulkan !== false,
          tanggal_diperiksa: studentRow.tanggal_diperiksa,
          catatan: studentRow.catatan
        });
      }
    }

    return results;
  }
}
