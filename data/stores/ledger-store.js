/**
 * data/stores/ledger-store.js
 * Domain Store untuk Ledger Nilai, Konfigurasi Bobot & KKM, Perhitungan Nilai Akhir, dan Finalisasi Rapor.
 *
 * Aturan:
 * - Decoupled: Akses dependency domain lain melalui this.ctx (tanpa circular import).
 * - Preservasi formula nilai & KKM: Menjaga 100% konsistensi perhitungan nilai akhir & predikat.
 * - Guard Semester & Mode Arsip: Semester "Semua" dilarang untuk mutasi (save/finalize/unfinalize).
 *   Hanya boleh untuk READ / kalkulasi agregasi.
 */

import { STORAGE_KEYS, getSemesterFromDate, isValidUUID } from './shared-store-utils.js';

export class LedgerStore {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Mengambil konfigurasi bobot, KKM, predikat, dan komponen aktif per Kelas + Mapel
   */
  async getLedgerConfig({ kelas_id, mapel_id, mapel, academic_year }) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();

    const defaultConfig = {
      kelas_id,
      mapel_id: mapel_id || null,
      mapel: mapel || '',
      academic_year: activeYear,
      user_id: currentUserId,
      kkm: 75,
      predikat_ranges: { A: 90, B: 80, C: 75, D: 0 },
      components_config: {
        kehadiran:      { active: true, weight: 15 },
        tugas_mandiri:  { active: true, weight: 20 },
        tugas_kelompok: { active: true, weight: 20 },
        pr:             { active: true, weight: 15 },
        ceklis:         { active: true, weight: 10 },
        sumatif_sts:    { active: true, weight: 10 },
        sumatif_sas:    { active: true, weight: 10 },
        sikap:          { active: false, weight: 0, bonus_per_item: 3, penalty_per_item: 3 }
      }
    };

    if (!currentUserId) return defaultConfig;

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId && mapel) {
      try {
        const allMapel = await this.ctx.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapel || x.kode === mapel);
        if (m) resolvedMapelId = m.id;
      } catch (e) {}
    }

    const cacheKey = `ledger_cfg_${currentUserId}_${kelas_id || 'all'}_${resolvedMapelId || mapel || 'none'}_${activeYear}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    let result = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase && kelas_id) {
      try {
        let query = this.ctx.supabase
          .from('ledger_config')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('kelas_id', kelas_id)
          .eq('academic_year', activeYear);

        if (resolvedMapelId) {
          query = query.eq('mapel_id', resolvedMapelId);
        } else if (mapel) {
          query = query.eq('mapel', mapel);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          result = data;
        }
      } catch (err) {
        console.warn('Supabase fetch ledger_config error:', err);
      }
    }

    if (!result) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_CONFIG) || '[]');
      const found = localList.find(c =>
        c.user_id === currentUserId &&
        c.kelas_id === kelas_id &&
        c.academic_year === activeYear &&
        ((resolvedMapelId && c.mapel_id === resolvedMapelId) || (!resolvedMapelId && c.mapel === mapel))
      );
      if (found) result = found;
    }

    const finalConfig = result ? { ...defaultConfig, ...result } : defaultConfig;
    return this.ctx._setCache(cacheKey, finalConfig);
  }

  /**
   * Menyimpan konfigurasi bobot dan predikat
   */
  async saveLedgerConfig(configData) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    // Guard: semester "Semua" dilarang untuk mutasi
    if (configData.semester === 'Semua') {
      throw new Error('Semester "Semua" bersifat read-only dan tidak dapat digunakan untuk menyimpan konfigurasi');
    }

    let mapelId = configData.mapel_id || null;
    let mapelNama = configData.mapel || '';
    if (!mapelId && mapelNama) {
      try {
        const allMapel = await this.ctx.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapelNama || x.kode === mapelNama);
        if (m) mapelId = m.id;
      } catch (e) {}
    }

    if (!mapelId && !mapelNama) {
      return { success: false, message: 'Validasi gagal: Mata pelajaran wajib diisi.' };
    }

    const activeYear = configData.academic_year || await this.ctx.getActiveAcademicYear();

    // Guard Mode Arsip / Read-Only jika semester diteruskan
    if (configData.semester) {
      await this.ctx.assertPeriodeWritableBySemester(activeYear, configData.semester);
    }

    this.ctx._invalidateCache([`ledger_cfg_${currentUserId}_`]);
    const payload = {
      user_id: currentUserId,
      kelas_id: configData.kelas_id,
      mapel_id: mapelId,
      mapel: mapelNama,
      academic_year: activeYear,
      kkm: Number(configData.kkm) || 75,
      predikat_ranges: configData.predikat_ranges || { A: 90, B: 80, C: 75, D: 0 },
      components_config: configData.components_config,
      updated_at: new Date().toISOString()
    };

    let supabaseError = null;
    let savedRow = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let lookupQuery = this.ctx.supabase
          .from('ledger_config')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('kelas_id', payload.kelas_id)
          .eq('academic_year', payload.academic_year);

        if (mapelId) {
          lookupQuery = lookupQuery.eq('mapel_id', mapelId);
        } else {
          lookupQuery = lookupQuery.eq('mapel', payload.mapel);
        }

        const { data: existing } = await lookupQuery.maybeSingle();
        const existingRow = Array.isArray(existing) ? existing[0] : existing;

        if (existingRow && existingRow.id) {
          const { data: updated, error: updateErr } = await this.ctx.supabase
            .from('ledger_config')
            .update(payload)
            .eq('id', existingRow.id)
            .eq('user_id', currentUserId)
            .select()
            .single();
          if (updateErr) throw updateErr;
          savedRow = updated;
        } else {
          const { data: inserted, error: insertErr } = await this.ctx.supabase
            .from('ledger_config')
            .insert([payload])
            .select()
            .single();
          if (insertErr) throw insertErr;
          savedRow = inserted;
        }
      } catch (err) {
        supabaseError = err;
        console.warn('Supabase save ledger_config error:', err);
      }
    }

    let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_CONFIG) || '[]');
    const idx = localList.findIndex(c =>
      c.user_id === currentUserId &&
      c.kelas_id === payload.kelas_id &&
      c.academic_year === payload.academic_year &&
      ((payload.mapel_id && c.mapel_id === payload.mapel_id) || (!payload.mapel_id && c.mapel === payload.mapel))
    );

    const entry = savedRow || { id: 'lcfg-' + Date.now(), ...payload };

    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...entry };
    } else {
      localList.push(entry);
    }
    localStorage.setItem(STORAGE_KEYS.LEDGER_CONFIG, JSON.stringify(localList));

    if (supabaseError) {
      return { success: true, warning: 'Tersimpan lokal, sinkronisasi Supabase tertunda: ' + supabaseError.message };
    }
    return { success: true, message: 'Konfigurasi bobot & KKM berhasil disimpan!' };
  }

  /**
   * Mesin Kalkulasi Nilai Akhir (Live Engine)
   */
  async calculateLedgerNilai({ kelas_id, mapel_id, mapel, academic_year, semester = 'Ganjil' }) {
    if (!kelas_id) return { students: [], summary: {}, config: null };

    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();

    // 1. Ambil seluruh data master & transaksional secara PARALEL (Promise.all)
    const [
      config,
      students,
      allSesi,
      allNilaiTugas,
      allPR,
      allChecklist,
      allKegiatan
    ] = await Promise.all([
      this.getLedgerConfig({ kelas_id, mapel_id, mapel, academic_year: activeYear }),
      this.ctx.getSiswaByKelas(kelas_id, true),
      this.ctx.getAllSesi(activeYear),
      this.ctx.getAllNilaiTugas(activeYear),
      this.ctx.getPRList({ academic_year: activeYear }),
      this.ctx.getAllChecklist(activeYear),
      this.ctx.getAllKegiatanSiswa(activeYear)
    ]);

    // 2. Filter data berdasarkan Kelas, Mapel, dan Semester
    const isAllSemester = semester === 'Semua' || !semester;

    // Filter Sesi Kehadiran
    const kelasSesi = allSesi.filter(s => {
      const matchKelas = s.kelas_id === kelas_id;
      const matchMapel = !mapel || s.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(s.tanggal) === semester;
      return matchKelas && matchMapel && matchSem;
    });
    const totalSesi = kelasSesi.length;

    // Kumpulkan absensi siswa
    const studentAbsensiMap = new Map();
    kelasSesi.forEach(sesi => {
      if (Array.isArray(sesi.absensi)) {
        sesi.absensi.forEach(a => {
          if (!studentAbsensiMap.has(a.siswa_id)) {
            studentAbsensiMap.set(a.siswa_id, { hadir: 0, sakit: 0, izin: 0, alfa: 0 });
          }
          const rec = studentAbsensiMap.get(a.siswa_id);
          const st = String(a.status || '').toLowerCase().trim();
          if (st === 'hadir' || st === 'h') rec.hadir++;
          else if (st === 'sakit' || st === 's') rec.sakit++;
          else if (st === 'izin' || st === 'i') rec.izin++;
          else if (st === 'alfa' || st === 'alpa' || st === 'a') rec.alfa++;
          else rec.hadir++;
        });
      }
    });

    // Filter Tugas Mandiri (non-kelompok, non-sumatif)
    const tugasMandiriList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      const isIndividu = !t.is_kelompok && t.tipe_tugas !== 'kelompok' && t.tipe_tugas !== 'sumatif_sts' && t.tipe_tugas !== 'sumatif_sas';
      return matchKelas && matchMapel && matchSem && isIndividu;
    });

    // Filter Tugas Kelompok
    const tugasKelompokList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      const isKel = t.is_kelompok || t.tipe_tugas === 'kelompok';
      return matchKelas && matchMapel && matchSem && isKel;
    });

    // Filter PR
    const prList = allPR.filter(p => {
      const matchKelas = p.kelas_id === kelas_id;
      const matchMapel = !mapel || p.mapel === mapel || p.mata_pelajaran?.nama_mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(p.tanggal_diberikan) === semester;
      return matchKelas && matchMapel && matchSem;
    });

    // Filter Ceklis Catatan
    const checklistList = allChecklist.filter(c => {
      const matchKelas = c.kelas_id === kelas_id;
      const matchMapel = !mapel || c.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(c.tanggal) === semester;
      const isNoCatatan = c.is_no_catatan || c.bebas_catatan;
      return matchKelas && matchMapel && matchSem && !isNoCatatan;
    });
    const totalChecklist = checklistList.length;

    // Filter Sumatif STS & SAS
    const sumatifSTSList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      return matchKelas && matchMapel && matchSem && t.tipe_tugas === 'sumatif_sts';
    });

    const sumatifSASList = allNilaiTugas.filter(t => {
      const matchKelas = t.kelas_id === kelas_id;
      const matchMapel = !mapel || t.mapel === mapel;
      const matchSem = isAllSemester || getSemesterFromDate(t.tanggal) === semester;
      return matchKelas && matchMapel && matchSem && t.tipe_tugas === 'sumatif_sas';
    });

    // Filter Sikap / Kegiatan
    const sikapList = allKegiatan.filter(k => {
      const matchSem = isAllSemester || getSemesterFromDate(k.tanggal) === semester;
      return matchSem;
    });

    const compCfg = config.components_config || {};
    const kkmVal = Number(config.kkm) || 75;
    const predRanges = config.predikat_ranges || { A: 90, B: 80, C: 75, D: 0 };

    // 3. Kalkulasi per Siswa
    const studentResults = students.map(s => {
      const scores = {};
      const rawDetails = {};

      // 1. Kehadiran (Sakit & Izin = 0.5 Nilai)
      if (compCfg.kehadiran?.active) {
        const rec = studentAbsensiMap.get(s.id) || { hadir: 0, sakit: 0, izin: 0, alfa: 0 };
        if (totalSesi === 0) {
          scores.kehadiran = 100;
          rawDetails.kehadiran = 'Belum ada sesi KBM';
        } else {
          const effectiveHadir = (rec.hadir * 1.0) + (rec.sakit * 0.5) + (rec.izin * 0.5);
          const pct = Math.min(100, Math.max(0, (effectiveHadir / totalSesi) * 100));
          scores.kehadiran = Math.round(pct * 10) / 10;
          rawDetails.kehadiran = `H:${rec.hadir} S:${rec.sakit} I:${rec.izin} A:${rec.alfa} / ${totalSesi} sesi`;
        }
      }

      // 2. Tugas Mandiri
      if (compCfg.tugas_mandiri?.active) {
        const studentGrades = [];
        tugasMandiriList.forEach(t => {
          if (t.is_no_tugas || t.bebas_tugas) return;
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            studentGrades.push(Number(d.nilai));
          }
        });
        if (studentGrades.length > 0) {
          const avg = studentGrades.reduce((a, b) => a + b, 0) / studentGrades.length;
          scores.tugas_mandiri = Math.round(avg * 10) / 10;
          rawDetails.tugas_mandiri = `Rata-rata ${studentGrades.length} tugas`;
        } else {
          scores.tugas_mandiri = null;
          rawDetails.tugas_mandiri = 'Belum ada tugas dinilai';
        }
      }

      // 3. Tugas Kelompok
      if (compCfg.tugas_kelompok?.active) {
        const studentGrades = [];
        tugasKelompokList.forEach(t => {
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            studentGrades.push(Number(d.nilai));
          }
        });
        if (studentGrades.length > 0) {
          const avg = studentGrades.reduce((a, b) => a + b, 0) / studentGrades.length;
          scores.tugas_kelompok = Math.round(avg * 10) / 10;
          rawDetails.tugas_kelompok = `Rata-rata ${studentGrades.length} tugas kelompok`;
        } else {
          scores.tugas_kelompok = null;
          rawDetails.tugas_kelompok = 'Belum ada tugas kelompok';
        }
      }

      // 4. PR
      if (compCfg.pr?.active) {
        const prGrades = [];
        prList.forEach(p => {
          const d = (p.pr_nilai_siswa || []).find(n => n.siswa_id === s.id);
          if (d) {
            if (d.nilai !== null && d.nilai !== undefined && d.nilai !== '' && !isNaN(Number(d.nilai))) {
              prGrades.push(Number(d.nilai));
            } else if (d.mengumpulkan === false) {
              prGrades.push(0);
            }
          }
        });
        if (prGrades.length > 0) {
          const avg = prGrades.reduce((a, b) => a + b, 0) / prGrades.length;
          scores.pr = Math.round(avg * 10) / 10;
          rawDetails.pr = `Rata-rata ${prGrades.length} PR`;
        } else {
          scores.pr = null;
          rawDetails.pr = 'Belum ada PR dinilai';
        }
      }

      // 5. Ceklis Catatan
      if (compCfg.ceklis?.active) {
        if (totalChecklist === 0) {
          scores.ceklis = 100;
          rawDetails.ceklis = 'Belum ada sesi ceklis';
        } else {
          let completeCount = 0;
          checklistList.forEach(c => {
            const d = (c.daftar_ceklis || []).find(n => n.siswa_id === s.id);
            if (d && (d.is_checked === true || d.is_checked === 'true')) {
              completeCount++;
            }
          });
          const pct = (completeCount / totalChecklist) * 100;
          scores.ceklis = Math.round(pct * 10) / 10;
          rawDetails.ceklis = `${completeCount}/${totalChecklist} catatan lengkap`;
        }
      }

      // 6. STS
      if (compCfg.sumatif_sts?.active) {
        const stsGrades = [];
        sumatifSTSList.forEach(t => {
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            stsGrades.push(Number(d.nilai));
          }
        });
        if (stsGrades.length > 0) {
          const avg = stsGrades.reduce((a, b) => a + b, 0) / stsGrades.length;
          scores.sumatif_sts = Math.round(avg * 10) / 10;
          rawDetails.sumatif_sts = `STS: ${scores.sumatif_sts}`;
        } else {
          scores.sumatif_sts = null;
          rawDetails.sumatif_sts = 'Belum ada nilai STS';
        }
      }

      // 7. SAS
      if (compCfg.sumatif_sas?.active) {
        const sasGrades = [];
        sumatifSASList.forEach(t => {
          const d = (t.daftar_nilai || []).find(n => n.siswa_id === s.id);
          if (d && d.nilai !== '' && d.nilai !== null && !isNaN(Number(d.nilai))) {
            sasGrades.push(Number(d.nilai));
          }
        });
        if (sasGrades.length > 0) {
          const avg = sasGrades.reduce((a, b) => a + b, 0) / sasGrades.length;
          scores.sumatif_sas = Math.round(avg * 10) / 10;
          rawDetails.sumatif_sas = `SAS: ${scores.sumatif_sas}`;
        } else {
          scores.sumatif_sas = null;
          rawDetails.sumatif_sas = 'Belum ada nilai SAS';
        }
      }

      // 8. Sikap
      if (compCfg.sikap?.active) {
        const sSikap = sikapList.filter(k => k.siswa_id === s.id);
        let positif = 0, pelanggaran = 0;
        sSikap.forEach(k => {
          const kat = (k.kategori || '').toLowerCase();
          if (kat.includes('positif') || kat.includes('prestasi')) positif++;
          if (kat.includes('pelanggaran') || kat.includes('perilaku')) pelanggaran++;
        });
        const bonus = compCfg.sikap.bonus_per_item || 3;
        const penalty = compCfg.sikap.penalty_per_item || 3;
        const scoreSikap = Math.max(0, Math.min(100, 80 + (positif * bonus) - (pelanggaran * penalty)));
        scores.sikap = scoreSikap;
        rawDetails.sikap = `+${positif} Positif, -${pelanggaran} Pelanggaran (Skor: ${scoreSikap})`;
      }

      // 4. Hitung Rata-Rata Tertimbang Fleksibel (Dynamic Interim Redistribution)
      let weightedSum = 0;
      let activeWeightSum = 0;
      let totalAssignedWeight = 0;
      let hasMissingComponent = false;

      Object.entries(compCfg).forEach(([key, cfg]) => {
        if (!cfg.active) return;
        const weight = Number(cfg.weight) || 0;
        totalAssignedWeight += weight;
        const sc = scores[key];
        if (sc !== null && sc !== undefined && !isNaN(sc)) {
          weightedSum += sc * weight;
          activeWeightSum += weight;
        } else {
          hasMissingComponent = true;
        }
      });

      let finalScore = 0;
      if (activeWeightSum > 0) {
        finalScore = Math.round((weightedSum / activeWeightSum) * 10) / 10;
      }
      const roundedScore = Math.round(finalScore);

      // Tentukan Predikat berdasarkan rentang custom
      let predikat = 'D';
      if (roundedScore >= (predRanges.A ?? 90)) predikat = 'A';
      else if (roundedScore >= (predRanges.B ?? 80)) predikat = 'B';
      else if (roundedScore >= (predRanges.C ?? 75)) predikat = 'C';
      else predikat = 'D';

      const isTuntas = roundedScore >= kkmVal;

      // Generator Deskripsi Capaian Kompetensi Kurikulum Merdeka
      let deskripsi = '';
      if (predikat === 'A') {
        deskripsi = `Menunjukkan penguasaan yang sangat istimewa dan konsisten dalam seluruh aspek pembelajaran ${mapel || 'mata pelajaran'}.`;
      } else if (predikat === 'B') {
        deskripsi = `Menunjukkan pemahaman yang baik dan aktif dalam kegiatan belajar serta tugas ${mapel || 'mata pelajaran'}.`;
      } else if (predikat === 'C') {
        deskripsi = `Mencapai kriteria ketuntasan minimal dengan cukup baik, disarankan untuk terus meningkatkan konsistensi belajar.`;
      } else {
        deskripsi = `Perlu bimbingan intensif dan penguatan konsep dasar pada materi pembelajaran ${mapel || 'mata pelajaran'}.`;
      }

      return {
        siswa_id: s.id,
        nomor_absen: s.nomor_absen || '-',
        nama_lengkap: s.nama_lengkap,
        nisn: s.nisn || '-',
        scores,
        rawDetails,
        final_score: finalScore,
        rounded_score: roundedScore,
        predikat,
        is_tuntas: isTuntas,
        has_missing_component: hasMissingComponent,
        deskripsi_capaian: deskripsi
      };
    });

    // 5. Ringkasan Statistik Kelas
    const validScores = studentResults.map(s => s.final_score).filter(sc => sc > 0);
    const avgKelas = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : 0;
    const maxScore = validScores.length > 0 ? Math.max(...validScores) : 0;
    const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
    const tuntasCount = studentResults.filter(s => s.is_tuntas).length;
    const tuntasPercent = students.length > 0 ? Math.round((tuntasCount / students.length) * 100) : 0;

    return {
      students: studentResults,
      config,
      semester,
      academic_year: activeYear,
      summary: {
        total_siswa: students.length,
        avg_kelas: avgKelas,
        max_score: maxScore,
        min_score: minScore,
        tuntas_count: tuntasCount,
        tuntas_percent: tuntasPercent,
        remedi_count: students.length - tuntasCount
      }
    };
  }

  /**
   * Menyimpan snapshot finalisasi rapor
   */
  async saveLedgerFinalisasi(data) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    const targetSemester = data.semester || 'Ganjil';
    if (targetSemester === 'Semua') {
      throw new Error('Semester "Semua" bersifat agregasi read-only dan tidak dapat difinalisasi');
    }

    let mapelId = data.mapel_id || null;
    let mapelNama = data.mapel || '';
    if (!mapelId && mapelNama) {
      try {
        const allMapel = await this.ctx.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapelNama || x.kode === mapelNama);
        if (m) mapelId = m.id;
      } catch (e) {}
    }

    const activeYear = data.academic_year || await this.ctx.getActiveAcademicYear();

    // Guard Mode Arsip / Read-Only
    await this.ctx.assertPeriodeWritableBySemester(activeYear, targetSemester);

    this.ctx._invalidateCache([`ledger_fin_${currentUserId}_`, `ledger_cfg_${currentUserId}_`]);
    const payload = {
      user_id: currentUserId,
      kelas_id: data.kelas_id,
      mapel_id: mapelId,
      mapel: mapelNama,
      academic_year: activeYear,
      semester: targetSemester,
      periode_nama: data.periode_nama || `Rapor Semester ${targetSemester} ${activeYear}`,
      finalized_at: new Date().toISOString(),
      config_snapshot: data.config_snapshot,
      ledger_data: data.ledger_data,
      is_locked: true
    };

    let newId = 'lfin-' + Date.now();
    let supabaseError = null;

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data: res, error } = await this.ctx.supabase
          .from('ledger_finalisasi')
          .insert([payload])
          .select('id')
          .single();
        if (!error && res) {
          newId = res.id;
        } else if (error) {
          supabaseError = error;
        }
      } catch (err) {
        supabaseError = err;
      }
    }

    const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_FINALISASI) || '[]');
    localList.unshift({ id: newId, ...payload });
    localStorage.setItem(STORAGE_KEYS.LEDGER_FINALISASI, JSON.stringify(localList));

    if (supabaseError) {
      return { success: true, id: newId, warning: 'Snapshot tersimpan di lokal (Supabase sync tertunda)' };
    }
    return { success: true, id: newId, message: 'Rapor berhasil difinalisasi & dikunci!' };
  }

  /**
   * Mengambil riwayat snapshot finalisasi rapor
   */
  async getLedgerFinalisasiList({ kelas_id, mapel_id, mapel, academic_year, semester } = {}) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return [];

    let resolvedMapelId = mapel_id || null;
    if (!resolvedMapelId && mapel) {
      try {
        const allMapel = await this.ctx.getMataPelajaran();
        const m = allMapel.find(x => x.nama_mapel === mapel || x.kode === mapel);
        if (m) resolvedMapelId = m.id;
      } catch (e) {}
    }

    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();
    let results = [];

    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        let query = this.ctx.supabase
          .from('ledger_finalisasi')
          .select('*')
          .eq('user_id', currentUserId)
          .order('finalized_at', { ascending: false });

        if (kelas_id) query = query.eq('kelas_id', kelas_id);
        if (resolvedMapelId) query = query.eq('mapel_id', resolvedMapelId);
        else if (mapel) query = query.eq('mapel', mapel);
        if (activeYear) query = query.eq('academic_year', activeYear);
        if (semester && semester !== 'Semua') query = query.eq('semester', semester);

        const { data, error } = await query;
        if (!error && data) {
          results = data;
        }
      } catch (err) {
        console.warn('Supabase fetch ledger_finalisasi error:', err);
      }
    }

    if (results.length === 0) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_FINALISASI) || '[]');
      results = localList.filter(f => {
        if (f.user_id !== currentUserId) return false;
        const matchKelas = !kelas_id || f.kelas_id === kelas_id;
        const matchMapel = resolvedMapelId ? f.mapel_id === resolvedMapelId : (!mapel || f.mapel === mapel);
        const matchYear = !activeYear || f.academic_year === activeYear;
        const matchSem = !semester || semester === 'Semua' || f.semester === semester;
        return matchKelas && matchMapel && matchYear && matchSem;
      });
    }

    return results;
  }

  /**
   * Menghapus snapshot finalisasi rapor (Unfinalize)
   */
  async deleteLedgerFinalisasi(id) {
    const currentUser = await this.ctx.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) return { success: false, message: 'Unauthorized' };

    let deletedSuccessfully = false;

    // Lookup snapshot untuk mendapatkan academic_year dan semester guna pengecekan Mode Arsip
    let targetSnapshot = null;
    if (this.ctx.isSupabaseConnected && this.ctx.supabase && isValidUUID(id)) {
      try {
        const { data: found } = await this.ctx.supabase
          .from('ledger_finalisasi')
          .select('academic_year, semester')
          .eq('id', id)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (found) targetSnapshot = found;
      } catch (e) {}
    }
    if (!targetSnapshot) {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_FINALISASI) || '[]');
      targetSnapshot = localList.find(f => f.id === id && f.user_id === currentUserId) || null;
    }

    if (targetSnapshot && targetSnapshot.academic_year && targetSnapshot.semester) {
      await this.ctx.assertPeriodeWritableBySemester(targetSnapshot.academic_year, targetSnapshot.semester);
    }

    if (this.ctx.isSupabaseConnected && this.ctx.supabase && isValidUUID(id)) {
      try {
        const { data, error } = await this.ctx.supabase
          .from('ledger_finalisasi')
          .delete()
          .eq('id', id)
          .eq('user_id', currentUserId)
          .select('id');

        if (!error && data && data.length > 0) {
          deletedSuccessfully = true;
        } else if (error) {
          console.warn('Delete ledger_finalisasi error:', error);
          return { success: false, message: error.message };
        }
      } catch (e) {
        console.warn('Delete ledger_finalisasi error:', e);
        return { success: false, message: e.message };
      }
    } else {
      deletedSuccessfully = true;
    }

    if (deletedSuccessfully) {
      let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER_FINALISASI) || '[]');
      localList = localList.filter(f => !(f.id === id && f.user_id === currentUserId));
      localStorage.setItem(STORAGE_KEYS.LEDGER_FINALISASI, JSON.stringify(localList));
      this.ctx._invalidateCache([`ledger_fin_${currentUserId}_`, `ledger_cfg_${currentUserId}_`]);
      return { success: true, message: 'Snapshot finalisasi dihapus' };
    }

    return { success: false, message: 'Snapshot tidak ditemukan atau bukan milik pengguna aktif' };
  }

  /**
   * Simpan Nilai Sumatif (STS / SAS) secara cepat
   */
  async saveNilaiSumatif({ kelas_id, mapel_id, mapel, academic_year, semester, tipe_sumatif, judul, tanggal, daftar_nilai, kkm = 75 }) {
    this.ctx._invalidateCache(['nilai_', 'ledger_']);
    const activeYear = academic_year || await this.ctx.getActiveAcademicYear();

    return this.ctx.saveNilaiTugas({
      kelas_id,
      mapel,
      judul_tugas: judul || (tipe_sumatif === 'sumatif_sts' ? 'Sumatif Tengah Semester (STS)' : 'Sumatif Akhir Semester (SAS)'),
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      kkm: Number(kkm) || 75,
      tipe_tugas: tipe_sumatif,
      academic_year: activeYear,
      daftar_nilai
    });
  }
}
