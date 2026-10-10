/**
 * data/stores/rekap-store.js
 * Domain Store untuk Rekapitulasi Presensi Kelas & Mapel, Rekapitulasi Individu Siswa,
 * Matriks Kehadiran, Agregasi Nilai Tugas & Ceklis, dan Timeline Siswa.
 *
 * Aturan:
 * - Decoupled: Mengakses data dari domain lain via this.ctx (getAllSesi, getAllSiswa, getKelas, getAllNilaiTugas, getAllChecklist, getKegiatanSiswaBySiswa).
 * - Read-Only: Seluruh method rekapitulasi adalah murni pembacaan & kalkulasi agregasi data.
 * - Multi-Semester & Mixed-Range: Mendukung filter tanggal dan filter semester, termasuk data riwayat/arsip.
 */

import { STORAGE_KEYS } from './shared-store-utils.js';

export class RekapStore {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Menghitung matriks rekapitulasi kehadiran per kelas & mapel
   */
  async getRekapKehadiran(kelasId, mapel, startDate, endDate, academicYear = null) {
    let allSiswa = await this.ctx.getSiswaByKelas(kelasId);
    const allSesi = await this.ctx.getAllSesi(academicYear);

    const filteredSesi = allSesi.filter(s => {
      const matchKelas = s.kelas_id === kelasId;
      const matchMapel = !mapel || s.mapel === mapel;
      const matchDate = (!startDate || s.tanggal >= startDate) && (!endDate || s.tanggal <= endDate);
      return matchKelas && matchMapel && matchDate;
    }).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    const sesiIds = filteredSesi.map(s => s.id);

    // 1. Kumpulkan seluruh record absensi dari sesi object (Supabase JOIN)
    let combinedAbsensi = [];
    filteredSesi.forEach(s => {
      if (Array.isArray(s.absensi) && s.absensi.length > 0) {
        combinedAbsensi.push(...s.absensi);
      }
    });

    // 2. Jika sesi.absensi kosong tapi terhubung Supabase, query langsung ke tabel absensi
    if (this.ctx.isSupabaseConnected && this.ctx.supabase && sesiIds.length > 0 && combinedAbsensi.length === 0) {
      try {
        const { data, error } = await this.ctx.supabase.from('absensi').select('*').in('sesi_id', sesiIds);
        if (!error && data) {
          combinedAbsensi.push(...data);
        }
      } catch (e) {
        console.warn('Supabase fetch absensi for rekap warning:', e);
      }
    }

    // 3. Gabungkan juga dari LocalStorage
    const localAbs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    combinedAbsensi.push(...localAbs.filter(a => sesiIds.includes(a.sesi_id)));

    // 4. Kumpulkan seluruh siswa yang terdaftar di kelas saat ini ATAU memiliki rekaman absensi di sesi-sesi kelas ini
    if (combinedAbsensi.length > 0) {
      const distinctSiswaIds = [...new Set(combinedAbsensi.map(a => a.siswa_id).filter(Boolean))];
      const existingStudentIds = new Set(allSiswa.map(s => s.id));
      const missingStudentIds = distinctSiswaIds.filter(id => !existingStudentIds.has(id));

      if (missingStudentIds.length > 0) {
        const allMasterSiswa = await this.ctx.getAllSiswa();
        const missingStudents = allMasterSiswa.filter(s => missingStudentIds.includes(s.id));
        allSiswa = [...allSiswa, ...missingStudents].sort(
          (a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999) || (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '')
        );
      }
    }

    // Buat Map absensi dengan key `${sesi_id}_${siswa_id}`
    const absensiMap = new Map();
    combinedAbsensi.forEach(a => {
      if (a.sesi_id && a.siswa_id) {
        const key = `${a.sesi_id}_${a.siswa_id}`;
        if (!absensiMap.has(key) || a.status) {
          absensiMap.set(key, a);
        }
      }
    });

    // Susun matriks kehadiran per siswa
    const siswaRekap = allSiswa.map(siswa => {
      const record = {
        siswa,
        totalSesi: filteredSesi.length,
        hadir: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        persentase: 100,
        perSesi: {} // sesiId -> status
      };

      filteredSesi.forEach(sesi => {
        const key = `${sesi.id}_${siswa.id}`;
        const item = absensiMap.get(key);
        let rawStatus = item ? String(item.status || '').trim() : '';

        // Normalisasi status
        let status = '-';
        if (rawStatus) {
          const lower = rawStatus.toLowerCase();
          if (lower === 'hadir' || lower === 'h') {
            status = 'Hadir';
            record.hadir++;
          } else if (lower === 'sakit' || lower === 's') {
            status = 'Sakit';
            record.sakit++;
          } else if (lower === 'izin' || lower === 'i') {
            status = 'Izin';
            record.izin++;
          } else if (lower === 'alfa' || lower === 'alpa' || lower === 'a') {
            status = 'Alfa';
            record.alfa++;
          } else {
            status = rawStatus;
            record.hadir++;
          }
        }

        record.perSesi[sesi.id] = status;
      });

      if (filteredSesi.length > 0) {
        record.persentase = Math.round((record.hadir / filteredSesi.length) * 100);
      } else {
        record.persentase = 100;
      }

      return record;
    });

    return {
      daftarSesi: filteredSesi,
      siswaRekap,
      totalSesi: filteredSesi.length
    };
  }

  /**
   * Menghitung rekapitulasi individu siswa (Presensi, Akademik Tugas & Ceklis, Timeline Notes)
   */
  async getRekapIndividuSiswa(siswaId, academicYear = null) {
    let siswa = null;
    let allSiswa = await this.ctx.getAllSiswa();
    siswa = allSiswa.find(s => s.id === siswaId);
    if (!siswa && this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const { data } = await this.ctx.supabase.from('siswa').select('*').eq('id', siswaId).single();
        if (data) siswa = data;
      } catch {}
    }
    if (!siswa) {
      const localSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');
      siswa = localSiswa.find(s => s.id === siswaId);
    }
    if (!siswa) return null;

    const allKelas = await this.ctx.getKelas(academicYear);
    const kelas = allKelas.find(k => k.id === siswa.kelas_id) || { nama_kelas: 'Kelas', jurusan: 'Umum' };

    // 1. Presensi Data
    const allSesi = await this.ctx.getAllSesi(academicYear);
    const kelasSesi = allSesi.filter(s => {
      const matchKelas = s.kelas_id === siswa.kelas_id;
      const matchAbsen = Array.isArray(s.absensi) && s.absensi.some(a => a.siswa_id === siswa.id);
      return matchKelas || matchAbsen;
    }).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    const sesiIds = kelasSesi.map(s => s.id);

    let combinedAbsensi = [];
    kelasSesi.forEach(s => {
      if (Array.isArray(s.absensi) && s.absensi.length > 0) {
        combinedAbsensi.push(...s.absensi);
      }
    });

    if (this.ctx.isSupabaseConnected && this.ctx.supabase && sesiIds.length > 0 && combinedAbsensi.length === 0) {
      try {
        const { data, error } = await this.ctx.supabase.from('absensi').select('*').in('sesi_id', sesiIds);
        if (!error && data) combinedAbsensi.push(...data);
      } catch (e) {
        console.warn('Supabase fetch absensi for individual rekap warning:', e);
      }
    }

    const localAbs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ABSENSI) || '[]');
    combinedAbsensi.push(...localAbs.filter(a => sesiIds.includes(a.sesi_id)));

    const absensiMap = new Map();
    combinedAbsensi.forEach(a => {
      if (a.sesi_id && a.siswa_id === siswa.id) {
        absensiMap.set(a.sesi_id, a);
      }
    });

    let hadir = 0, sakit = 0, izin = 0, alfa = 0;
    const riwayatPresensi = [];
    let allJurnal = [];
    try {
      allJurnal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JURNAL) || '[]');
    } catch {}

    kelasSesi.forEach(sesi => {
      const rec = absensiMap.get(sesi.id);
      let rawStatus = rec ? String(rec.status || '').trim() : 'Hadir';
      const catatan = rec?.catatan || '';

      let status = 'Hadir';
      const lower = rawStatus.toLowerCase();
      if (lower === 'hadir' || lower === 'h') {
        status = 'Hadir';
        hadir++;
      } else if (lower === 'sakit' || lower === 's') {
        status = 'Sakit';
        sakit++;
      } else if (lower === 'izin' || lower === 'i') {
        status = 'Izin';
        izin++;
      } else if (lower === 'alfa' || lower === 'alpa' || lower === 'a') {
        status = 'Alfa';
        alfa++;
      } else {
        status = rawStatus;
        hadir++;
      }

      const jRec = allJurnal.find(j => j.sesi_id === sesi.id);
      const materi = sesi.jurnal?.materi_pokok || jRec?.materi_pokok || sesi.materi_pokok || sesi.catatan_sesi || 'Pembelajaran Regular';

      riwayatPresensi.push({
        sesi_id: sesi.id,
        tanggal: sesi.tanggal,
        mapel: sesi.mapel,
        materi,
        status,
        catatan
      });
    });

    const totalSesi = kelasSesi.length;
    const persentaseKehadiran = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 100;

    // 2. Nilai Tugas Data & Ceklis Catatan Data
    const allNilaiTugas = await this.ctx.getAllNilaiTugas(academicYear);
    const allChecklist = await this.ctx.getAllChecklist(academicYear);

    const kelasTugas = allNilaiTugas.filter(nt => nt.kelas_id === siswa.kelas_id).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    const kelasChecklist = allChecklist.filter(c => c.kelas_id === siswa.kelas_id).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    let sumNilai = 0;
    let countNilai = 0;
    let tugasTuntas = 0;
    let tugasRemedi = 0;
    let nilaiTertinggi = 0;
    let nilaiTerendah = 100;

    const riwayatTugas = kelasTugas.map(tugas => {
      const isBebasTugas = tugas.is_no_tugas === true || tugas.is_no_tugas === 'true' || tugas.bebas_tugas === true || tugas.bebas_tugas === 'true';

      // Hitung rata-rata kelas untuk tugas ini
      let sumKelas = 0, countKelas = 0;
      if (!isBebasTugas) {
        (tugas.daftar_nilai || []).forEach(d => {
          const n = parseInt(d.nilai);
          if (!isNaN(n)) {
            sumKelas += n;
            countKelas++;
          }
        });
      }
      const avgKelas = countKelas > 0 ? Math.round(sumKelas / countKelas) : 0;

      // Cari nilai siswa
      const itemSiswa = (tugas.daftar_nilai || []).find(d => d.siswa_id === siswa.id);
      const valNum = (!isBebasTugas && itemSiswa && itemSiswa.nilai !== '' && !isNaN(parseInt(itemSiswa.nilai))) ? parseInt(itemSiswa.nilai) : null;
      const kkm = isBebasTugas ? null : (tugas.kkm || 75);
      const isTuntas = isBebasTugas ? true : (valNum !== null ? valNum >= kkm : null);

      if (!isBebasTugas && valNum !== null && !isNaN(valNum)) {
        sumNilai += valNum;
        countNilai++;
        if (isTuntas) tugasTuntas++;
        else tugasRemedi++;
        if (valNum > nilaiTertinggi) nilaiTertinggi = valNum;
        if (valNum < nilaiTerendah) nilaiTerendah = valNum;
      }

      let status = 'Belum Dinilai';
      if (isBebasTugas) {
        status = 'Bebas';
      } else if (valNum !== null) {
        status = isTuntas ? 'Tuntas' : 'Remedi';
      }

      return {
        id: 'tgs-' + tugas.id,
        rawId: tugas.id,
        tipe: 'Tugas',
        jenisBadge: 'bg-amber-50 text-amber-800 border-amber-200',
        judul: tugas.judul_tugas || 'Tugas Pembelajaran',
        judul_tugas: tugas.judul_tugas || 'Tugas Pembelajaran',
        mapel: tugas.mapel || 'Mata Pelajaran',
        tanggal: tugas.tanggal || '-',
        kkm,
        nilai: valNum,
        avgKelas: isBebasTugas ? null : avgKelas,
        isBebas: isBebasTugas,
        isTuntas,
        status,
        catatan: itemSiswa?.catatan || ''
      };
    });

    const riwayatCeklis = kelasChecklist.map(c => {
      const isBebasCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
      const itemSiswa = (c.daftar_ceklis || []).find(d => d.siswa_id === siswa.id);
      const isChecked = isBebasCatatan ? true : (itemSiswa ? (itemSiswa.is_checked === true || itemSiswa.is_checked === 'true') : false);

      let status = isBebasCatatan ? 'Bebas' : (isChecked ? 'Selesai' : 'Belum Selesai');

      return {
        id: 'chk-' + c.id,
        rawId: c.id,
        tipe: 'Ceklis',
        jenisBadge: 'bg-teal-50 text-teal-800 border-teal-200',
        judul: c.judul_catatan || 'Ceklis Catatan',
        judul_tugas: c.judul_catatan || 'Ceklis Catatan',
        mapel: c.mapel || 'Mata Pelajaran',
        tanggal: c.tanggal || '-',
        kkm: null,
        nilai: null,
        avgKelas: null,
        isBebas: isBebasCatatan,
        isTuntas: isBebasCatatan || isChecked,
        status,
        catatan: itemSiswa?.catatan || ''
      };
    });

    // Gabungkan riwayat tugas dan riwayat ceklis dalam satu array yang diurutkan tanggal ascending
    const riwayatGabungan = [...riwayatTugas, ...riwayatCeklis].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    const rataRataNilai = countNilai > 0 ? Math.round(sumNilai / countNilai) : 0;
    if (countNilai === 0) nilaiTerendah = 0;

    // 3. Catatan Timeline (Kombinasi Kegiatan Siswa, Ceklis, Absensi, dan Tugas)
    const allKegiatan = await this.ctx.getKegiatanSiswaBySiswa(siswa.id);

    const timelineNotes = [];

    // Kegiatan Khusus (Dispensasi, Lomba, Bimbingan, Sikap, Prestasi)
    allKegiatan.forEach(k => {
      let tag = '#Sikap';
      const kat = (k.kategori || '').toLowerCase();
      if (kat.includes('prestasi') || kat.includes('positif') || kat.includes('kejuaraan')) {
        tag = '#Prestasi';
      } else if (kat.includes('dispensasi') || kat.includes('lomba') || kat.includes('izin') || kat.includes('dinas')) {
        tag = '#Kehadiran';
      } else if (kat.includes('bimbingan') || kat.includes('remedial') || kat.includes('konseling') || kat.includes('akademik')) {
        tag = '#Akademik';
      } else if (kat.includes('pelanggaran') || kat.includes('sikap') || kat.includes('perilaku')) {
        tag = '#Sikap';
      }

      timelineNotes.push({
        id: k.id,
        tanggal: k.tanggal,
        judul: k.judul,
        deskripsi: k.keterangan || '',
        kategori: k.kategori,
        tag,
        sumber: 'Catatan Kegiatan Siswa'
      });
    });

    // Catatan Khusus saat Absensi
    riwayatPresensi.filter(r => r.catatan).forEach(r => {
      timelineNotes.push({
        id: 'abs-cat-' + r.sesi_id,
        tanggal: r.tanggal,
        judul: `Catatan Presensi (${r.status})`,
        deskripsi: r.catatan,
        kategori: 'Presensi',
        tag: '#Kehadiran',
        sumber: `Mapel: ${r.mapel}`
      });
    });

    // Catatan Ceklis
    kelasChecklist.forEach(c => {
      const isNoCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
      if (isNoCatatan) return;
      const item = (c.daftar_ceklis || []).find(d => d.siswa_id === siswa.id);
      if (item && item.catatan) {
        timelineNotes.push({
          id: 'chk-cat-' + c.id,
          tanggal: c.tanggal,
          judul: c.judul_catatan,
          deskripsi: `${item.is_checked ? '☑️ Sudah/Lengkap' : '⬜ Belum'}: ${item.catatan}`,
          kategori: 'Ceklis Siswa',
          tag: '#Akademik',
          sumber: `Mapel: ${c.mapel}`
        });
      }
    });

    // Catatan Tugas
    riwayatTugas.filter(r => r.catatan).forEach(r => {
      timelineNotes.push({
        id: 'tgs-cat-' + r.id,
        tanggal: r.tanggal,
        judul: `Catatan Tugas: ${r.judul}`,
        deskripsi: `Nilai: ${r.nilai ?? '-'} • Catatan: ${r.catatan}`,
        kategori: 'Penilaian Tugas',
        tag: '#Akademik',
        sumber: `Mapel: ${r.mapel}`
      });
    });

    timelineNotes.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return {
      siswa,
      kelas,
      presensi: {
        totalSesi,
        hadir,
        sakit,
        izin,
        alfa,
        persentase: persentaseKehadiran,
        riwayat: riwayatPresensi
      },
      akademik: {
        totalTugas: kelasTugas.length,
        totalCeklis: kelasChecklist.length,
        totalGabungan: riwayatGabungan.length,
        tugasDinilai: countNilai,
        tugasTuntas,
        tugasRemedi,
        rataRataNilai,
        nilaiTertinggi,
        nilaiTerendah,
        riwayatTugas,
        riwayatCeklis,
        riwayat: riwayatGabungan
      },
      timelineNotes
    };
  }
}
