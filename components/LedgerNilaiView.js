// components/LedgerNilaiView.js - Tampilan Utama Ledger & Kalkulator Nilai Akhir Fleksibel + Simulator Katrol
import { db, getSemesterFromDate, calculateNilaiKatrol } from '../supabase-client.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
import { openLedgerConfigModal } from './LedgerConfigModal.js';
import { openLedgerFinalisasiModal } from './LedgerFinalisasiModal.js';

/**
 * Helper READ Khusus Ledger: Mengambil daftar kelas sesuai semester aktif Ledger.
 * - 'Ganjil' -> getKelasSaya(year, null, 'Ganjil')
 * - 'Genap'  -> getKelasSaya(year, null, 'Genap')
 * - 'Semua'  -> Eksplisit gabungkan (Union & Dedupe) kelas dari Ganjil + Genap
 */
async function getLedgerKelasList(academicYear, semester) {
  if (semester === 'Ganjil' || semester === 'Genap') {
    return await db.getKelasSaya(academicYear, null, semester);
  }
  // Mode 'Semua': Explicit intentional annual union Ganjil and Genap
  const [kelasGanjil, kelasGenap] = await Promise.all([
    db.getKelasSaya(academicYear, null, 'Ganjil'),
    db.getKelasSaya(academicYear, null, 'Genap')
  ]);

  const map = new Map();
  for (const k of [...kelasGanjil, ...kelasGenap]) {
    if (k && k.id && !map.has(k.id)) {
      map.set(k.id, k);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.nama_kelas || '').localeCompare(b.nama_kelas || '', 'id', { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Helper READ Khusus Ledger: Mengambil daftar mapel sesuai semester aktif Ledger.
 * - 'Ganjil' -> getMapelSaya(year, kelasId, null, 'Ganjil')
 * - 'Genap'  -> getMapelSaya(year, kelasId, null, 'Genap')
 * - 'Semua'  -> Eksplisit gabungkan (Union & Dedupe) mapel dari Ganjil + Genap pada kelas tersebut
 */
async function getLedgerMapelList(academicYear, kelasId, semester) {
  if (!kelasId) return [];
  if (semester === 'Ganjil' || semester === 'Genap') {
    return await db.getMapelSaya(academicYear, kelasId, null, semester);
  }
  // Mode 'Semua': Explicit intentional annual union Ganjil and Genap for this class
  const [mapelGanjil, mapelGenap] = await Promise.all([
    db.getMapelSaya(academicYear, kelasId, null, 'Ganjil'),
    db.getMapelSaya(academicYear, kelasId, null, 'Genap')
  ]);

  const map = new Map();
  for (const m of [...mapelGanjil, ...mapelGenap]) {
    const key = m.id || m.nama_mapel;
    if (key && !map.has(key)) {
      map.set(key, m);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.nama_mapel || '').localeCompare(b.nama_mapel || '', 'id', { numeric: true, sensitivity: 'base' })
  );
}

export async function renderLedgerNilaiView(container, state, onNavigate, showToast) {
  const currentAcademicYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  let selectedSemester = state.ledgerSemester || 'Ganjil'; // 'Ganjil' | 'Genap' | 'Semua'
  let activeSubTab = state.ledgerSubTab || 'matriks'; // 'matriks' | 'katrol'

  // 1. Ambil daftar kelas yang diajar oleh guru aktif sesuai semester eksplisit / mode Semua
  let kelasList = await getLedgerKelasList(currentAcademicYear, selectedSemester);

  // 2. Handle Empty State jika guru belum memiliki jadwal mengajar di semester/tahun ajaran ini
  if (kelasList.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-slate-300 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <i data-lucide="calendar-off" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 text-base sm:text-lg">Belum Ada Jadwal Mengajar</h3>
          <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Anda belum memiliki penugasan jadwal mengajar pada tahun ajaran <strong>${currentAcademicYear}</strong> (${selectedSemester}) untuk melihat Ledger Nilai.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // 3. Tentukan kelas aktif (default kelas pertama guru jika belum dipilih / tidak valid)
  let selectedKelasId = (kelasList.some(k => k.id === state.currentKelasId) ? state.currentKelasId : (kelasList[0]?.id || ''));

  // 4. Ambil daftar mapel yang diajar guru pada kelas terpilih sesuai semester eksplisit / mode Semua
  let mapelList = await getLedgerMapelList(currentAcademicYear, selectedKelasId, selectedSemester);

  // 5. Handle Empty State jika pada kelas terpilih tidak ditemukan mapel guru
  if (mapelList.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-slate-300 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <i data-lucide="book-x" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 text-base sm:text-lg">Mata Pelajaran Tidak Ditemukan</h3>
          <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Tidak ditemukan mata pelajaran yang Anda ajar pada kelas terpilih di tahun ajaran <strong>${currentAcademicYear}</strong> (${selectedSemester}).
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // 6. Tentukan mapel aktif tanpa fallback hardcoded 'Matematika'
  let selectedMapel = (mapelList.some(m => m.nama_mapel === state.currentMapel) ? state.currentMapel : (mapelList[0]?.nama_mapel || ''));
  let selectedMapelObj = mapelList.find(m => m.nama_mapel === selectedMapel) || mapelList[0];
  let selectedMapelId = selectedMapelObj?.id || null;

  // State memori kalkulator katrol (tidak disimpan ke DB)
  let katrolBawah = state.katrolBawah !== undefined ? state.katrolBawah : 75;
  let katrolAtas = state.katrolAtas !== undefined ? state.katrolAtas : 85;

  async function loadData() {
    return db.calculateLedgerNilai({
      kelas_id: selectedKelasId,
      mapel_id: selectedMapelId,
      mapel: selectedMapel,
      academic_year: currentAcademicYear,
      semester: selectedSemester
    });
  }

  async function render() {
    const { students, summary, config } = await loadData();
    const selectedKelasObj = kelasList.find(k => k.id === selectedKelasId);
    const compCfg = config?.components_config || {};
    const kkmVal = Number(config?.kkm) || 75;
    const predRanges = config?.predikat_ranges || { A: 90, B: 80, C: 75, D: 0 };

    const activeComponents = [
      { key: 'kehadiran', label: 'Presensi', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      { key: 'tugas_mandiri', label: 'Tugas Mandiri', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
      { key: 'tugas_kelompok', label: 'Tugas Kelompok', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
      { key: 'pr', label: 'PR', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
      { key: 'ceklis', label: 'Ceklis', badge: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
      { key: 'sumatif_sts', label: 'STS', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
      { key: 'sumatif_sas', label: 'SAS', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
      { key: 'sikap', label: 'Sikap', badge: 'bg-purple-50 text-purple-800 border-purple-200' }
    ].filter(c => compCfg[c.key]?.active);

    // Filter statistik untuk fitur Katrol: Siswa yang memiliki nilai (meski sebagian komponen berstatus progres)
    const validStudents = students.filter(s => s.rounded_score !== null && !isNaN(s.rounded_score) && s.rounded_score > 0);
    const validScores = validStudents.map(s => s.rounded_score);
    const minKelas = validScores.length > 0 ? Math.min(...validScores) : 0;
    const maxKelas = validScores.length > 0 ? Math.max(...validScores) : 0;
    const rentangKelas = maxKelas - minKelas;
    const noDataCount = students.length - validStudents.length;

    // Validasi input batas katrol
    const isKatrolInvalid = katrolBawah > katrolAtas || katrolBawah < 0 || katrolAtas > 100;

    // Hitung nilai katrol untuk seluruh siswa
    const katrolResults = students.map(s => {
      const hasScore = s.rounded_score !== null && !isNaN(s.rounded_score) && s.rounded_score > 0;

      if (!hasScore || isKatrolInvalid || validStudents.length === 0) {
        return {
          ...s,
          nilai_katrol: null,
          selisih: null,
          predikat_katrol: '-',
          is_tuntas_katrol: false,
          is_incomplete: true
        };
      }

      const nKatrol = calculateNilaiKatrol({
        nilaiAsli: s.rounded_score,
        minKelas,
        maxKelas,
        batasBawah: katrolBawah,
        batasAtas: katrolAtas,
        kkm: kkmVal
      });

      const selisih = nKatrol !== null ? (nKatrol - s.rounded_score) : 0;

      // Hitung predikat dari nilai katrol
      let predikatKatrol = 'D';
      if (nKatrol >= (predRanges.A ?? 90)) predikatKatrol = 'A';
      else if (nKatrol >= (predRanges.B ?? 80)) predikatKatrol = 'B';
      else if (nKatrol >= (predRanges.C ?? 75)) predikatKatrol = 'C';
      else predikatKatrol = 'D';

      const isTuntasKatrol = nKatrol >= kkmVal;

      return {
        ...s,
        nilai_katrol: nKatrol,
        selisih,
        predikat_katrol: predikatKatrol,
        is_tuntas_katrol: isTuntasKatrol,
        is_incomplete: false
      };
    });

    // Cek status periode semester aktif untuk Mode Arsip
    let isArchived = false;
    let archivedMessage = '';
    if (selectedSemester === 'Ganjil' || selectedSemester === 'Genap') {
      const periodeSem = await db.getPeriodeSemester(currentAcademicYear, selectedSemester);
      if (periodeSem && periodeSem.status === 'ditutup') {
        isArchived = true;
        archivedMessage = `Semester ${selectedSemester} Tahun Ajaran ${currentAcademicYear} telah ditutup. Data nilai rapor hanya dapat dilihat, dicetak, atau diekspor (Mode Arsip / Read-Only).`;
      }
    }

    container.innerHTML = `
      <div class="space-y-6 pb-24 max-w-7xl mx-auto">

        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 text-white p-4 sm:p-6 rounded-3xl shadow-sm border border-indigo-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-400/30">
              <i data-lucide="calculator" class="w-7 h-7"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-extrabold text-lg sm:text-2xl tracking-tight">Ledger & Kalkulator Nilai Akhir</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase">
                  ${currentAcademicYear}
                </span>
                ${isArchived ? `
                  <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase flex items-center gap-1">
                    <i data-lucide="archive" class="w-3 h-3"></i>
                    <span>Mode Arsip</span>
                  </span>
                ` : ''}
              </div>
              <p class="text-xs text-indigo-200/80 mt-0.5">
                Kalkulasi otomatis nilai rapor semester, pembobotan fleksibel, konversi predikat KKM, dan simulator penyesuaian nilai (katrol).
              </p>
            </div>
          </div>

          <!-- Quick Action Buttons Top -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              id="btn-open-config-modal"
              class="px-3.5 py-2 ${isArchived ? 'opacity-50 cursor-not-allowed bg-white/5 text-slate-300 border-white/10' : 'bg-white/10 hover:bg-white/20 text-white border-white/20 active:scale-95'} font-bold text-xs rounded-xl border transition flex items-center gap-1.5"
              ${isArchived ? 'disabled title="Semester telah ditutup (Mode Arsip)"' : ''}
            >
              <i data-lucide="sliders" class="w-4 h-4 text-emerald-300"></i>
              <span>Atur Bobot & KKM</span>
            </button>

            <button
              id="btn-open-finalisasi-modal"
              class="px-3.5 py-2 ${isArchived ? 'opacity-50 cursor-not-allowed bg-indigo-950 text-indigo-300 border-indigo-900' : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 active:scale-95 shadow-sm'} font-bold text-xs rounded-xl border transition flex items-center gap-1.5"
              ${isArchived ? 'disabled title="Semester telah ditutup (Mode Arsip)"' : ''}
            >
              <i data-lucide="lock" class="w-4 h-4"></i>
              <span>Finalisasi Rapor</span>
            </button>
          </div>
        </div>

        ${isArchived ? `
          <!-- Mode Arsip Notice Banner -->
          <div class="p-4 rounded-3xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-3.5 shadow-xs">
            <div class="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
              <i data-lucide="archive" class="w-5 h-5"></i>
            </div>
            <div class="text-xs space-y-1">
              <h4 class="font-black text-amber-900 dark:text-amber-200 text-sm">Mode Arsip Aktif (Read-Only)</h4>
              <p class="text-amber-900/80 dark:text-amber-300/80 leading-relaxed font-medium">
                ${archivedMessage}
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Filter & Control Toolbar Card -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">

            <!-- Kelas Combobox -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Kelas</label>
              ${renderClassComboboxHTML({
                id: 'ledger-select-kelas',
                kelasList,
                selectedId: selectedKelasId,
                size: 'sm'
              })}
            </div>

            <!-- Mapel Combobox -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Mata Pelajaran</label>
              ${renderMapelComboboxHTML({
                id: 'ledger-select-mapel',
                mapelList,
                selectedValue: selectedMapel,
                size: 'sm'
              })}
            </div>

            <!-- Semester Switcher -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Periode Semester</label>
              <div class="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-9">
                <button
                  type="button"
                  class="btn-sem-switch flex-1 h-full text-center text-xs font-bold rounded-lg transition ${selectedSemester === 'Ganjil' ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-indigo-200 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
                  data-sem="Ganjil"
                >
                  Ganjil
                </button>
                <button
                  type="button"
                  class="btn-sem-switch flex-1 h-full text-center text-xs font-bold rounded-lg transition ${selectedSemester === 'Genap' ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-indigo-200 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
                  data-sem="Genap"
                >
                  Genap
                </button>
                <button
                  type="button"
                  class="btn-sem-switch flex-1 h-full text-center text-xs font-bold rounded-lg transition ${selectedSemester === 'Semua' ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-indigo-200 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
                  data-sem="Semua"
                >
                  1 Tahun
                </button>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="flex items-center gap-2">
              <button
                id="btn-export-excel"
                class="flex-1 h-9 px-3 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                title="Ekspor Data Nilai ke Format Excel / CSV"
              >
                <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                <span>Ekspor CSV</span>
              </button>

              <button
                id="btn-print-ledger"
                class="h-9 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                title="Cetak Lembar Ledger Nilai"
              >
                <i data-lucide="printer" class="w-4 h-4 text-slate-600 dark:text-slate-400"></i>
                <span>Cetak</span>
              </button>
            </div>

          </div>

          <!-- Formula Info Chips Bar -->
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Formula Aktif:</span>
              ${activeComponents.map(c => `
                <span class="px-2 py-0.5 rounded-lg ${c.badge} border text-[10px] font-bold inline-flex items-center gap-1">
                  <span>${c.label}</span>
                  <strong class="font-black text-slate-900 dark:text-white">(${compCfg[c.key]?.weight || 0}%)</strong>
                </span>
              `).join('')}
            </div>

            <div class="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Standar KKM: <strong class="text-slate-900 dark:text-white font-black">${config?.kkm || 75}</strong></span>
              <span>•</span>
              <span class="text-emerald-700 dark:text-emerald-400">A ≥ ${config?.predikat_ranges?.A ?? 90}</span>
              <span class="text-sky-700 dark:text-sky-400">B ≥ ${config?.predikat_ranges?.B ?? 80}</span>
              <span class="text-amber-700 dark:text-amber-400">C ≥ ${config?.predikat_ranges?.C ?? 75}</span>
            </div>
          </div>
        </div>

        <!-- Sub-Tab Switcher Navigation -->
        <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-2">
          <button
            type="button"
            id="tab-btn-matriks"
            class="px-5 py-3 text-xs font-extrabold transition flex items-center gap-2 border-b-2 ${activeSubTab === 'matriks' ? 'border-emerald-600 text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
          >
            <i data-lucide="layout-grid" class="w-4 h-4"></i>
            <span>Matriks Nilai Akhir (Resmi)</span>
          </button>

          <button
            type="button"
            id="tab-btn-katrol"
            class="px-5 py-3 text-xs font-extrabold transition flex items-center gap-2 border-b-2 ${activeSubTab === 'katrol' ? 'border-teal-600 text-teal-900 dark:text-teal-300 bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
          >
            <i data-lucide="scale" class="w-4 h-4 text-teal-600 dark:text-teal-400"></i>
            <span>Penyesuaian Nilai (Katrol)</span>
            <span class="px-1.5 py-0.2 rounded-md bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[9px] font-black border border-teal-200 dark:border-teal-800 uppercase">
              Simulator
            </span>
          </button>
        </div>

        ${activeSubTab === 'matriks' ? `

          <!-- TAB 1: MATRIKS NILAI AKHIR LENGKAP -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" id="ledger-printable-area">

            <div class="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  Matriks Nilai Rapor: ${selectedKelasObj?.nama_kelas || 'Kelas'} — ${selectedMapel}
                </h3>
                <p class="text-[11px] text-slate-400 dark:text-slate-500">
                  Periode: Semester ${selectedSemester} • Tahun Ajaran ${currentAcademicYear} • ${students.length} Siswa
                </p>
              </div>

              <div class="flex items-center gap-2 text-xs">
                <span class="px-2.5 py-1 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-extrabold border border-emerald-200/80 dark:border-emerald-800">
                  Tuntas: ${summary.tuntas_count || 0} (${summary.tuntas_percent || 0}%)
                </span>
                <span class="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                  Rata-rata: ${summary.avg_kelas || 0}
                </span>
              </div>
            </div>

            <div class="overflow-x-auto custom-scrollbar">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700 select-none">
                  <tr>
                    <th class="py-3 px-3 text-center w-12 border-r border-slate-200 dark:border-slate-700">No</th>
                    <th class="py-3 px-3.5 min-w-[180px] border-r border-slate-200 dark:border-slate-700">Nama Siswa</th>
                    <th class="py-3 px-3 text-center w-24 border-r border-slate-200 dark:border-slate-700">NISN</th>

                    <!-- Dynamic Component Column Headers -->
                    ${activeComponents.map(c => `
                      <th class="py-3 px-3 text-center min-w-[90px] border-r border-slate-200 dark:border-slate-700">
                        <div class="font-black text-slate-800 dark:text-slate-100">${c.label}</div>
                        <div class="text-[9px] text-indigo-700 dark:text-indigo-400 font-extrabold">${compCfg[c.key]?.weight || 0}%</div>
                      </th>
                    `).join('')}

                    <!-- Final Grade Columns -->
                    <th class="py-3 px-3 text-center w-24 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 border-r border-indigo-200 dark:border-indigo-800">
                      <div class="font-black">Nilai Akhir</div>
                      <div class="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">Skala 100</div>
                    </th>
                    <th class="py-3 px-3 text-center w-20 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 border-r border-indigo-200 dark:border-indigo-800">
                      <div class="font-black">Predikat</div>
                      <div class="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">A/B/C/D</div>
                    </th>
                    <th class="py-3 px-3 text-center w-24 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 border-r border-indigo-200 dark:border-indigo-800">
                      <div class="font-black">Status KKM</div>
                      <div class="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">(${config?.kkm || 75})</div>
                    </th>
                    <th class="py-3 px-3 text-center w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${students.length === 0 ? `
                    <tr>
                      <td colspan="${4 + activeComponents.length + 4}" class="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                        Belum ada data siswa di kelas ini.
                      </td>
                    </tr>
                  ` : students.map((s, idx) => {

                    // Predikat badge styling
                    let predBg = 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
                    if (s.predikat === 'A') predBg = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-black';
                    else if (s.predikat === 'B') predBg = 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-black';
                    else if (s.predikat === 'C') predBg = 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-black';

                    return `
                      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                        <td class="py-2.5 px-3 text-center font-bold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">${idx + 1}</td>
                        <td class="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 min-w-[180px]">
                          ${s.nama_lengkap}
                        </td>
                        <td class="py-2.5 px-3 text-center font-medium text-slate-500 dark:text-slate-400 text-[11px] border-r border-slate-100 dark:border-slate-800">${s.nisn}</td>

                        <!-- Dynamic Component Values -->
                        ${activeComponents.map(c => {
                          const val = s.scores[c.key];
                          const isValExist = val !== null && val !== undefined && !isNaN(val);
                          const detail = s.rawDetails[c.key] || '';
                          return `
                            <td class="py-2.5 px-3 text-center font-bold border-r border-slate-100 dark:border-slate-800" title="${detail}">
                              ${isValExist ? `
                                <span class="${val >= (config?.kkm || 75) ? 'text-slate-800 dark:text-slate-200' : 'text-amber-700 dark:text-amber-400 font-black'}">
                                  ${val}
                                </span>
                              ` : `
                                <span class="text-slate-300 dark:text-slate-600 text-[10px] font-normal">-</span>
                              `}
                            </td>
                          `;
                        }).join('')}

                        <!-- Nilai Akhir -->
                        <td class="py-2.5 px-3 text-center font-black text-sm bg-indigo-50/30 dark:bg-indigo-950/30 border-r border-indigo-100 dark:border-indigo-900/60 ${s.is_tuntas ? 'text-indigo-950 dark:text-indigo-200' : 'text-rose-700 dark:text-rose-400'}">
                          ${s.rounded_score}
                          ${s.has_missing_component ? '<span class="text-[9px] text-amber-600 dark:text-amber-400 block font-normal" title="Beberapa komponen belum lengkap">(Progres)</span>' : ''}
                        </td>

                        <!-- Predikat -->
                        <td class="py-2.5 px-3 text-center border-r border-indigo-100 dark:border-indigo-900/60">
                          <span class="px-2 py-0.5 rounded-md text-xs border ${predBg}">
                            ${s.predikat}
                          </span>
                        </td>

                        <!-- Status KKM -->
                        <td class="py-2.5 px-3 text-center border-r border-indigo-100 dark:border-indigo-900/60">
                          ${s.is_tuntas ? `
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
                              <i data-lucide="check" class="w-3 h-3"></i> Tuntas
                            </span>
                          ` : `
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1">
                              <i data-lucide="alert-circle" class="w-3 h-3"></i> Remedi
                            </span>
                          `}
                        </td>

                        <!-- Detail Preview Button -->
                        <td class="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            class="btn-view-student-report p-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition"
                            data-idx="${idx}"
                            title="Lihat Deskripsi Rapor & Capaian"
                          >
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Bottom Performance Summary Grid -->
            <div class="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div class="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Rata-rata Kelas</span>
                <span class="text-lg font-black text-slate-800 dark:text-slate-100">${summary.avg_kelas || 0}</span>
              </div>
              <div class="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Nilai Tertinggi</span>
                <span class="text-lg font-black text-emerald-700 dark:text-emerald-400">${summary.max_score || 0}</span>
              </div>
              <div class="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Nilai Terendah</span>
                <span class="text-lg font-black text-rose-700 dark:text-rose-400">${summary.min_score || 0}</span>
              </div>
              <div class="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Ketuntasan Klasikal</span>
                <span class="text-lg font-black text-indigo-700 dark:text-indigo-400">${summary.tuntas_percent || 0}% (${summary.tuntas_count}/${students.length})</span>
              </div>
            </div>

          </div>

        ` : `

          <!-- TAB 2: SIMULATOR PENYESUAIAN NILAI (KATROL) -->
          <div class="space-y-5">

            <!-- Disclaimer Alert -->
            <div class="p-4 rounded-3xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-950 dark:text-teal-200 flex items-start gap-3.5">
              <div class="p-2 bg-teal-100 dark:bg-teal-900/60 rounded-xl text-teal-700 dark:text-teal-300 flex-shrink-0 mt-0.5">
                <i data-lucide="info" class="w-5 h-5"></i>
              </div>
              <div class="text-xs space-y-1">
                <h4 class="font-extrabold text-teal-900 dark:text-teal-200 text-sm">Mode Pratinjau Simulator Penyesuaian Nilai (Katrol)</h4>
                <p class="text-teal-900/80 dark:text-teal-300/80 leading-relaxed font-medium">
                  Fitur ini melakukan penyebaran ulang (*Min-Max Rescaling*) nilai akhir satu kelas secara proporsional ke rentang target baru sambil menjaga urutan peringkat siswa.
                  <strong>Kalkulator ini murni pratinjau di layar dan TIDAK mengubah data nilai asli di database maupun rapor resmi.</strong>
                </p>
              </div>
            </div>

            <!-- Configuration & Stats Card -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">

              <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                    <i data-lucide="sliders-horizontal" class="w-4 h-4 text-teal-600 dark:text-teal-400"></i>
                    <span>Tentukan Batas Rentang Target Katrol</span>
                  </h4>
                  <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Masukkan batas minimal dan maksimal target nilai yang diinginkan untuk kelas ini.
                  </p>
                </div>

                <!-- Input Controls -->
                <div class="flex items-center gap-3 flex-wrap">
                  <div class="flex items-center gap-1.5">
                    <label for="input-katrol-bawah" class="text-xs font-bold text-slate-600 dark:text-slate-300">Batas Terendah:</label>
                    <input
                      type="number"
                      id="input-katrol-bawah"
                      value="${katrolBawah}"
                      min="0"
                      max="100"
                      class="w-16 h-9 text-center font-black text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none text-teal-900 dark:text-teal-200"
                    >
                  </div>

                  <span class="text-slate-300 dark:text-slate-600 font-bold">s/d</span>

                  <div class="flex items-center gap-1.5">
                    <label for="input-katrol-atas" class="text-xs font-bold text-slate-600 dark:text-slate-300">Batas Tertinggi:</label>
                    <input
                      type="number"
                      id="input-katrol-atas"
                      value="${katrolAtas}"
                      min="0"
                      max="100"
                      class="w-16 h-9 text-center font-black text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none text-teal-900 dark:text-teal-200"
                    >
                  </div>

                  <button
                    type="button"
                    id="btn-apply-katrol"
                    class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 active:scale-95"
                  >
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                    <span>Terapkan</span>
                  </button>
                </div>
              </div>

              ${isKatrolInvalid ? `
                <!-- Error Alert Input Tidak Valid -->
                <div class="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2.5">
                  <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0"></i>
                  <span class="font-bold">
                    Batas Terendah Katrol (${katrolBawah}) tidak boleh lebih besar dari Batas Tertinggi Katrol (${katrolAtas}). Silakan masukkan rentang angka yang valid.
                  </span>
                </div>
              ` : `
                <!-- Live Distribution Summary Stats -->
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Min Nilai Asli</span>
                    <span class="text-base font-black text-rose-700 dark:text-rose-400">${minKelas}</span>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Max Nilai Asli</span>
                    <span class="text-base font-black text-emerald-700 dark:text-emerald-400">${maxKelas}</span>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Rentang Asli</span>
                    <span class="text-base font-black text-slate-800 dark:text-slate-100">${rentangKelas} Poin</span>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Siswa Dihitung</span>
                    <span class="text-base font-black text-teal-700 dark:text-teal-400">${validStudents.length} Siswa</span>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Tanpa Nilai</span>
                    <span class="text-base font-black ${noDataCount > 0 ? 'text-amber-700 dark:text-amber-400 font-black' : 'text-slate-400 dark:text-slate-500'}">
                      ${noDataCount} Siswa
                    </span>
                  </div>
                </div>
              `}

            </div>

            <!-- Table Comparison Side-by-Side -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

              <div class="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                    Tabel Komparasi Penyesuaian Nilai: ${selectedKelasObj?.nama_kelas || 'Kelas'} — ${selectedMapel}
                  </h3>
                  <p class="text-[11px] text-slate-400 dark:text-slate-500">
                    Target Skala: ${katrolBawah} s/d ${katrolAtas} • KKM: ${kkmVal}
                  </p>
                </div>

                <!-- Export & Print Katrol -->
                <div class="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    id="btn-export-katrol-csv"
                    class="h-8 px-3 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5 text-teal-600 dark:text-teal-400"></i>
                    <span>Ekspor CSV Katrol</span>
                  </button>

                  <button
                    type="button"
                    id="btn-print-katrol"
                    class="h-8 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <i data-lucide="printer" class="w-3.5 h-3.5 text-slate-600 dark:text-slate-400"></i>
                    <span>Cetak</span>
                  </button>
                </div>
              </div>

              <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700 select-none">
                    <tr>
                      <th class="py-3 px-3 text-center w-12 border-r border-slate-200 dark:border-slate-700">No</th>
                      <th class="py-3 px-3.5 min-w-[180px] border-r border-slate-200 dark:border-slate-700">Nama Siswa</th>
                      <th class="py-3 px-3 text-center w-24 border-r border-slate-200 dark:border-slate-700">NISN</th>

                      <!-- Nilai Asli -->
                      <th class="py-3 px-3 text-center w-28 bg-slate-200/60 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700">
                        <div class="font-black text-slate-800 dark:text-slate-100">Nilai Asli</div>
                        <div class="text-[9px] text-slate-500 dark:text-slate-400 font-bold">(Sebelum Katrol)</div>
                      </th>

                      <!-- Nilai Katrol -->
                      <th class="py-3 px-3 text-center w-32 bg-teal-50/90 dark:bg-teal-950/60 text-teal-950 dark:text-teal-200 border-r border-teal-200 dark:border-teal-800">
                        <div class="font-black">Nilai Katrol</div>
                        <div class="text-[9px] text-teal-700 dark:text-teal-400 font-bold">(Target: ${katrolBawah}-${katrolAtas})</div>
                      </th>

                      <!-- Selisih -->
                      <th class="py-3 px-3 text-center w-24 bg-teal-50/90 dark:bg-teal-950/60 text-teal-950 dark:text-teal-200 border-r border-teal-200 dark:border-teal-800">
                        <div class="font-black">Selisih</div>
                        <div class="text-[9px] text-teal-700 dark:text-teal-400 font-bold">Delta (±)</div>
                      </th>

                      <!-- Predikat Katrol -->
                      <th class="py-3 px-3 text-center w-24 bg-teal-50/90 dark:bg-teal-950/60 text-teal-950 dark:text-teal-200 border-r border-teal-200 dark:border-teal-800">
                        <div class="font-black">Predikat</div>
                        <div class="text-[9px] text-teal-700 dark:text-teal-400 font-bold">Hasil Katrol</div>
                      </th>

                      <!-- Status KKM Katrol -->
                      <th class="py-3 px-3 text-center w-28 bg-teal-50/90 dark:bg-teal-950/60 text-teal-950 dark:text-teal-200">
                        <div class="font-black">Status KKM</div>
                        <div class="text-[9px] text-teal-700 dark:text-teal-400 font-bold">(KKM: ${kkmVal})</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${isKatrolInvalid ? `
                      <tr>
                        <td colspan="8" class="py-12 text-center text-rose-500 font-bold text-xs">
                          Kalkulasi tidak dapat ditampilkan karena batas rentang target katrol tidak valid.
                        </td>
                      </tr>
                    ` : katrolResults.length === 0 ? `
                      <tr>
                        <td colspan="8" class="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                          Belum ada data siswa di kelas ini.
                        </td>
                      </tr>
                    ` : katrolResults.map((s, idx) => {

                      // Predikat badge styling
                      let predBg = 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
                      if (s.predikat_katrol === 'A') predBg = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-black';
                      else if (s.predikat_katrol === 'B') predBg = 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-black';
                      else if (s.predikat_katrol === 'C') predBg = 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-black';

                      return `
                        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                          <td class="py-2.5 px-3 text-center font-bold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">${idx + 1}</td>
                          <td class="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 min-w-[180px]">
                            ${s.nama_lengkap}
                          </td>
                          <td class="py-2.5 px-3 text-center font-medium text-slate-500 dark:text-slate-400 text-[11px] border-r border-slate-100 dark:border-slate-800">${s.nisn}</td>

                          <!-- Nilai Asli -->
                          <td class="py-2.5 px-3 text-center font-bold text-sm bg-slate-50/60 dark:bg-slate-800/40 border-r border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100">
                            ${s.rounded_score}
                            ${s.is_incomplete ? '<span class="text-[9px] text-amber-600 dark:text-amber-400 block font-normal">(Progres)</span>' : ''}
                          </td>

                          <!-- Nilai Katrol -->
                          <td class="py-2.5 px-3 text-center font-black text-sm bg-teal-50/30 dark:bg-teal-950/30 border-r border-teal-100 dark:border-teal-900/60 ${s.is_incomplete ? 'text-slate-300 dark:text-slate-600' : 'text-teal-950 dark:text-teal-200'}">
                            ${s.is_incomplete ? '-' : s.nilai_katrol}
                          </td>

                          <!-- Selisih Delta -->
                          <td class="py-2.5 px-3 text-center font-bold border-r border-teal-100 dark:border-teal-900/60">
                            ${s.is_incomplete ? '-' : s.selisih > 0 ? `
                              <span class="text-emerald-700 dark:text-emerald-400 font-black">+${s.selisih}</span>
                            ` : s.selisih === 0 ? `
                              <span class="text-slate-400 dark:text-slate-500">0</span>
                            ` : `
                              <span class="text-rose-700 dark:text-rose-400 font-black">${s.selisih}</span>
                            `}
                          </td>

                          <!-- Predikat Katrol -->
                          <td class="py-2.5 px-3 text-center border-r border-teal-100 dark:border-teal-900/60">
                            ${s.is_incomplete ? `
                              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Belum Lengkap
                              </span>
                            ` : `
                              <span class="px-2 py-0.5 rounded-md text-xs border ${predBg}">
                                ${s.predikat_katrol}
                              </span>
                            `}
                          </td>

                          <!-- Status KKM Katrol -->
                          <td class="py-2.5 px-3 text-center">
                            ${s.is_incomplete ? `
                              <span class="text-slate-400 dark:text-slate-500 text-[10px]">-</span>
                            ` : s.is_tuntas_katrol ? `
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
                                <i data-lucide="check" class="w-3 h-3"></i> Tuntas
                              </span>
                            ` : `
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1">
                                <i data-lucide="alert-circle" class="w-3 h-3"></i> Remedi
                              </span>
                            `}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

            </div>

          </div>

        `}

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // 1. Inisialisasi ClassCombobox
    initClassCombobox(container, {
      id: 'ledger-select-kelas',
      kelasList,
      selectedId: selectedKelasId,
      onSelect: async (kId) => {
        selectedKelasId = kId;
        state.currentKelasId = kId;

        // Cascading mapel list per guru & per kelas sesuai semester terpilih / mode Semua
        mapelList = await getLedgerMapelList(currentAcademicYear, selectedKelasId, selectedSemester);
        if (!mapelList.some(m => m.nama_mapel === selectedMapel)) {
          selectedMapel = mapelList[0]?.nama_mapel || '';
          selectedMapelObj = mapelList[0] || null;
          selectedMapelId = selectedMapelObj?.id || null;
        } else {
          selectedMapelObj = mapelList.find(m => m.nama_mapel === selectedMapel) || mapelList[0];
          selectedMapelId = selectedMapelObj?.id || null;
        }
        state.currentMapel = selectedMapel;
        render();
      }
    });

    // 2. Inisialisasi MapelCombobox
    initMapelCombobox(container, {
      id: 'ledger-select-mapel',
      mapelList,
      selectedValue: selectedMapel,
      onSelect: (mNama) => {
        selectedMapel = mNama;
        state.currentMapel = mNama;
        selectedMapelObj = mapelList.find(m => m.nama_mapel === mNama) || null;
        selectedMapelId = selectedMapelObj?.id || null;
        render();
      }
    });

    // 3. Semester Switch Handler
    container.querySelectorAll('.btn-sem-switch').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sem = btn.getAttribute('data-sem');
        selectedSemester = sem;
        state.ledgerSemester = sem;

        // Muat ulang daftar kelas & mapel sesuai semester yang dipilih / mode Semua
        kelasList = await getLedgerKelasList(currentAcademicYear, selectedSemester);
        if (!kelasList.some(k => k.id === selectedKelasId)) {
          selectedKelasId = kelasList[0]?.id || '';
          state.currentKelasId = selectedKelasId;
        }

        if (selectedKelasId) {
          mapelList = await getLedgerMapelList(currentAcademicYear, selectedKelasId, selectedSemester);
          if (!mapelList.some(m => m.nama_mapel === selectedMapel)) {
            selectedMapel = mapelList[0]?.nama_mapel || '';
            selectedMapelObj = mapelList[0] || null;
            selectedMapelId = selectedMapelObj?.id || null;
            state.currentMapel = selectedMapel;
          } else {
            selectedMapelObj = mapelList.find(m => m.nama_mapel === selectedMapel) || mapelList[0];
            selectedMapelId = selectedMapelObj?.id || null;
          }
        } else {
          mapelList = [];
          selectedMapel = '';
          selectedMapelObj = null;
          selectedMapelId = null;
        }

        render();
      });
    });

    // 4. Sub-Tab Switcher Handler (Matriks vs Katrol)
    container.querySelector('#tab-btn-matriks')?.addEventListener('click', () => {
      activeSubTab = 'matriks';
      state.ledgerSubTab = 'matriks';
      render();
    });

    container.querySelector('#tab-btn-katrol')?.addEventListener('click', () => {
      activeSubTab = 'katrol';
      state.ledgerSubTab = 'katrol';
      render();
    });

    // 5. Open Config Modal Handler
    container.querySelector('#btn-open-config-modal')?.addEventListener('click', () => {
      openLedgerConfigModal({
        kelasId: selectedKelasId,
        mapelId: selectedMapelId,
        mapelNama: selectedMapel,
        academicYear: currentAcademicYear,
        semester: selectedSemester,
        currentConfig: config,
        onSaved: () => render(),
        showToast
      });
    });

    // 6. Open Finalisasi Modal Handler
    container.querySelector('#btn-open-finalisasi-modal')?.addEventListener('click', () => {
      openLedgerFinalisasiModal({
        kelasId: selectedKelasId,
        kelasNama: selectedKelasObj?.nama_kelas || 'Kelas',
        mapelId: selectedMapelId,
        mapelNama: selectedMapel,
        academicYear: currentAcademicYear,
        semester: selectedSemester,
        calculatedData: { students, summary, config },
        onFinalized: () => render(),
        showToast
      });
    });

    // 7. Student Report Card Preview Modal (Tab Matriks)
    container.querySelectorAll('.btn-view-student-report').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const st = students[idx];
        if (!st) return;

        let modalRoot = document.querySelector('#modal-root');
        if (!modalRoot) {
          modalRoot = document.createElement('div');
          modalRoot.id = 'modal-root';
          document.body.appendChild(modalRoot);
        }

        modalRoot.innerHTML = `
          <div id="modal-student-report" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h4 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">${st.nama_lengkap}</h4>
                  <p class="text-[11px] text-slate-400 dark:text-slate-500">NISN: ${st.nisn} • ${selectedKelasObj?.nama_kelas || 'Kelas'}</p>
                </div>
                <button id="btn-close-st-report" class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl">
                  <i data-lucide="x" class="w-5 h-5"></i>
                </button>
              </div>

              <div class="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Nilai Akhir Rapor</span>
                  <div class="text-2xl font-black text-indigo-950 dark:text-indigo-100">${st.rounded_score}</div>
                </div>
                <div class="text-right">
                  <span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Predikat</span>
                  <div class="text-2xl font-black text-indigo-950 dark:text-indigo-100">${st.predikat}</div>
                </div>
              </div>

              <!-- Deskripsi Capaian Kompetensi Kurikulum Merdeka -->
              <div class="space-y-1.5">
                <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Deskripsi Capaian Kompetensi (Kurikulum Merdeka):</label>
                <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                  ${st.deskripsi_capaian}
                </div>
              </div>

              <div class="pt-2 flex justify-end">
                <button id="btn-ok-st-report" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();

        const closeStModal = () => { modalRoot.innerHTML = ''; };
        modalRoot.querySelector('#btn-close-st-report')?.addEventListener('click', closeStModal);
        modalRoot.querySelector('#btn-ok-st-report')?.addEventListener('click', closeStModal);
      });
    });

    // 8. Terapkan Batas Katrol Handler (Tab Katrol)
    container.querySelector('#btn-apply-katrol')?.addEventListener('click', () => {
      const bBawah = parseInt(container.querySelector('#input-katrol-bawah')?.value) || 0;
      const bAtas = parseInt(container.querySelector('#input-katrol-atas')?.value) || 0;

      if (bBawah > bAtas) {
        showToast('Batas Terendah (' + bBawah + ') tidak boleh lebih besar dari Batas Tertinggi (' + bAtas + ')!', 'error');
      } else {
        showToast(`Target katrol ${bBawah} s/d ${bAtas} berhasil dihitung!`, 'success');
      }

      katrolBawah = bBawah;
      katrolAtas = bAtas;
      state.katrolBawah = bBawah;
      state.katrolAtas = bAtas;
      render();
    });

    // 9. Ekspor CSV Handler (Tab Matriks)
    container.querySelector('#btn-export-excel')?.addEventListener('click', () => {
      if (students.length === 0) {
        showToast('Tidak ada data siswa untuk diekspor', 'warning');
        return;
      }

      const headers = ['No', 'Nama Siswa', 'NISN'];
      activeComponents.forEach(c => headers.push(`${c.label} (${compCfg[c.key]?.weight || 0}%)`));
      headers.push('Nilai Akhir', 'Predikat', 'Status KKM', 'Deskripsi Capaian');

      const rows = students.map((s, i) => {
        const r = [i + 1, `"${s.nama_lengkap}"`, `"${s.nisn}"`];
        activeComponents.forEach(c => {
          const v = s.scores[c.key];
          r.push(v !== null && v !== undefined ? v : '');
        });
        r.push(s.rounded_score, s.predikat, s.is_tuntas ? 'Tuntas' : 'Remedial', `"${s.deskripsi_capaian}"`);
        return r.join(',');
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Ledger_Nilai_${selectedKelasObj?.nama_kelas || 'Kelas'}_${selectedMapel}_Sem${selectedSemester}_${currentAcademicYear.replace('/', '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File CSV Ledger Nilai berhasil diunduh!', 'success');
    });

    // 10. Ekspor CSV Hasil Katrol Handler (Tab Katrol)
    container.querySelector('#btn-export-katrol-csv')?.addEventListener('click', () => {
      if (katrolResults.length === 0 || isKatrolInvalid) {
        showToast('Data katrol belum valid untuk diekspor', 'warning');
        return;
      }

      const headers = ['No', 'Nama Siswa', 'NISN', 'Nilai Asli', 'Nilai Katrol', 'Selisih (Delta)', 'Predikat Katrol', 'Status KKM'];
      const rows = katrolResults.map((s, i) => {
        return [
          i + 1,
          `"${s.nama_lengkap}"`,
          `"${s.nisn}"`,
          s.rounded_score,
          s.is_incomplete ? '-' : s.nilai_katrol,
          s.is_incomplete ? '-' : (s.selisih > 0 ? `+${s.selisih}` : s.selisih),
          s.is_incomplete ? 'Belum Lengkap' : s.predikat_katrol,
          s.is_incomplete ? '-' : (s.is_tuntas_katrol ? 'Tuntas' : 'Remedial')
        ].join(',');
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Penyesuaian_Katrol_${selectedKelasObj?.nama_kelas || 'Kelas'}_${selectedMapel}_Sem${selectedSemester}_${katrolBawah}-${katrolAtas}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File CSV Hasil Katrol berhasil diunduh!', 'success');
    });

    // 11. Print Handlers (Clean Dedicated Standalone Document)
    container.querySelector('#btn-print-ledger')?.addEventListener('click', async () => {
      const [schoolSettings, profilGuru] = await Promise.all([
        db.getSchoolSettings ? db.getSchoolSettings() : {},
        db.getProfilGuru ? db.getProfilGuru() : {}
      ]);

      printMatriksLedger({
        students,
        activeComponents,
        compCfg,
        config,
        summary,
        selectedKelasObj,
        selectedMapel,
        selectedSemester,
        currentAcademicYear,
        schoolSettings,
        profilGuru
      });
    });

    container.querySelector('#btn-print-katrol')?.addEventListener('click', async () => {
      const [schoolSettings, profilGuru] = await Promise.all([
        db.getSchoolSettings ? db.getSchoolSettings() : {},
        db.getProfilGuru ? db.getProfilGuru() : {}
      ]);

      printTabelKatrol({
        students,
        katrolResults,
        katrolBawah,
        katrolAtas,
        minKelas,
        maxKelas,
        config,
        selectedKelasObj,
        selectedMapel,
        selectedSemester,
        currentAcademicYear,
        schoolSettings,
        profilGuru
      });
    });
  }

  await render();
}

/**
 * Print Engine: Lembar Matriks Ledger Nilai Akhir Siswa Resmi (A4 Landscape)
 */
function printMatriksLedger({
  students = [],
  activeComponents = [],
  compCfg = {},
  config = {},
  summary = {},
  selectedKelasObj = {},
  selectedMapel = '',
  selectedSemester = 'Ganjil',
  currentAcademicYear = '',
  schoolSettings = {},
  profilGuru = {}
}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up cetak terblokir oleh browser. Izinkan pop-up untuk mencetak dokumen.');
    return;
  }

  const formulaStr = activeComponents.map(c => `${c.label} (${compCfg[c.key]?.weight || 0}%)`).join(', ');

  const printHTML = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Ledger Nilai Akhir - ${selectedKelasObj?.nama_kelas || 'Kelas'} - ${selectedMapel}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm 12mm 10mm 12mm; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 9pt; color: #000; margin: 0; line-height: 1.25; }
        .kop-table { width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #000; margin-bottom: 8px; }
        .kop-logo { width: 55px; height: 55px; object-fit: contain; }
        .kop-text { text-align: center; }
        .kop-instansi { font-size: 9.5pt; font-weight: bold; text-transform: uppercase; margin: 0; }
        .kop-dinas { font-size: 9.5pt; font-weight: bold; text-transform: uppercase; margin: 0; }
        .kop-sekolah { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 2px 0; }
        .kop-alamat { font-size: 8pt; margin: 0; }

        .title { text-align: center; font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 6px 0 2px 0; }
        .subtitle { text-align: center; font-size: 9.5pt; margin-bottom: 8px; }

        .meta-info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8.5pt; }
        .meta-info-table td { padding: 2px 4px; vertical-align: top; border: none; }

        table.ledger-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 8.5pt; }
        table.ledger-table th, table.ledger-table td { border: 1px solid #000; padding: 4px 5px; }
        table.ledger-table th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
        .text-center { text-align: center; }
        .text-bold { font-weight: bold; }
        .text-right { text-align: right; }

        .summary-box { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 8.5pt; }
        .summary-box td { border: 1px solid #000; padding: 4px 8px; background-color: #fafafa; }

        .signature-table { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 9pt; page-break-inside: avoid; }
        .signature-table td { width: 50%; vertical-align: top; text-align: center; border: none; }
      </style>
    </head>
    <body>
      <table class="kop-table">
        <tr>
          ${schoolSettings?.logo_url ? `<td style="width: 65px; text-align: center; vertical-align: middle;"><img src="${schoolSettings.logo_url}" class="kop-logo" /></td>` : ''}
          <td class="kop-text">
            <p class="kop-instansi">${schoolSettings?.instansi_induk || 'Pemerintah Provinsi'}</p>
            <p class="kop-dinas">${schoolSettings?.dinas || 'Dinas Pendidikan'}</p>
            <h2 class="kop-sekolah">${schoolSettings?.nama_sekolah || 'Nama Sekolah'}</h2>
            <p class="kop-alamat">${schoolSettings?.alamat || ''} ${schoolSettings?.telepon ? 'Telp: ' + schoolSettings.telepon : ''} ${schoolSettings?.website ? '• ' + schoolSettings.website : ''}</p>
          </td>
        </tr>
      </table>

      <div class="title">LEDGER NILAI AKHIR SISWA</div>
      <div class="subtitle">Tahun Ajaran: ${currentAcademicYear}</div>

      <table class="meta-info-table">
        <tr>
          <td style="width: 14%;"><strong>Mata Pelajaran</strong></td>
          <td style="width: 36%;">: ${selectedMapel}</td>
          <td style="width: 14%;"><strong>Standar KKM</strong></td>
          <td style="width: 36%;">: ${config?.kkm || 75}</td>
        </tr>
        <tr>
          <td><strong>Kelas / Rombel</strong></td>
          <td>: ${selectedKelasObj?.nama_kelas || '-'}</td>
          <td><strong>Skala Predikat</strong></td>
          <td>: A ≥ ${config?.predikat_ranges?.A ?? 90} | B ≥ ${config?.predikat_ranges?.B ?? 80} | C ≥ ${config?.predikat_ranges?.C ?? 75} | D < ${config?.predikat_ranges?.C ?? 75}</td>
        </tr>
        <tr>
          <td><strong>Semester</strong></td>
          <td>: ${selectedSemester === 'Semua' ? '1 Tahun Penuh' : `Semester ${selectedSemester}`}</td>
          <td><strong>Formula Bobot</strong></td>
          <td>: ${formulaStr || '-'}</td>
        </tr>
      </table>

      <table class="ledger-table">
        <thead>
          <tr>
            <th style="width: 25px;">No</th>
            <th style="width: 75px;">NISN</th>
            <th style="text-align: left; min-width: 160px;">Nama Siswa</th>
            ${activeComponents.map(c => `
              <th style="width: 55px;">
                ${c.label}<br><small>(${compCfg[c.key]?.weight || 0}%)</small>
              </th>
            `).join('')}
            <th style="width: 55px;">Nilai Akhir</th>
            <th style="width: 45px;">Nilai Bulat</th>
            <th style="width: 45px;">Predikat</th>
            <th style="width: 65px;">Status KKM</th>
          </tr>
        </thead>
        <tbody>
          ${students.length === 0 ? `
            <tr><td colspan="${4 + activeComponents.length + 3}" class="text-center" style="padding: 15px;">Tidak ada data siswa.</td></tr>
          ` : students.map((s, idx) => `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td class="text-center">${s.nisn || '-'}</td>
              <td class="text-bold">${s.nama_lengkap}</td>
              ${activeComponents.map(c => {
                const val = s.scores[c.key];
                return `<td class="text-center">${val !== null && val !== undefined && !isNaN(val) ? val : '-'}</td>`;
              }).join('')}
              <td class="text-center">${s.final_score !== null ? s.final_score.toFixed(2) : '-'}</td>
              <td class="text-center text-bold">${s.rounded_score !== null ? s.rounded_score : '-'}</td>
              <td class="text-center text-bold">${s.predikat || '-'}</td>
              <td class="text-center text-bold">${s.is_tuntas ? 'Tuntas' : 'Remedial'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f5f5f5; font-weight: bold;">
            <td colspan="3" class="text-right" style="padding-right: 8px;">RATA-RATA KELAS:</td>
            ${activeComponents.map(c => {
              const compScores = students.map(s => s.scores[c.key]).filter(v => v !== null && v !== undefined && !isNaN(v));
              const avgComp = compScores.length > 0 ? (compScores.reduce((a, b) => a + b, 0) / compScores.length).toFixed(1) : '-';
              return `<td class="text-center">${avgComp}</td>`;
            }).join('')}
            <td colspan="2" class="text-center">${summary?.avg_kelas || 0}</td>
            <td colspan="2" class="text-center">${summary?.tuntas_count || 0}/${students.length} Tuntas (${summary?.tuntas_percent || 0}%)</td>
          </tr>
        </tfoot>
      </table>

      <table class="summary-box">
        <tr>
          <td style="width: 25%;"><strong>Nilai Tertinggi:</strong> ${summary?.max_score || 0}</td>
          <td style="width: 25%;"><strong>Nilai Terendah:</strong> ${summary?.min_score || 0}</td>
          <td style="width: 25%;"><strong>Jumlah Tuntas:</strong> ${summary?.tuntas_count || 0} Siswa</td>
          <td style="width: 25%;"><strong>Jumlah Remedial:</strong> ${students.length - (summary?.tuntas_count || 0)} Siswa</td>
        </tr>
      </table>

      <table class="signature-table">
        <tr>
          <td>
            Mengetahui,<br>Kepala Sekolah<br><br><br><br><br>
            <strong><u>${profilGuru?.nama_kepsek || 'Nama Kepala Sekolah'}</u></strong><br>
            NIP. ${profilGuru?.nip_kepsek || '....................................'}
          </td>
          <td>
            ${profilGuru?.kota || 'Kota'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>
            Guru Mata Pelajaran<br><br><br><br><br>
            <strong><u>${profilGuru?.nama_guru || 'Nama Guru Mata Pelajaran'}</u></strong><br>
            NIP. ${profilGuru?.nip_guru || '....................................'}
          </td>
        </tr>
      </table>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(printHTML);
  printWindow.document.close();
}

/**
 * Print Engine: Laporan Hasil Penyesuaian Nilai (Katrol) (A4 Portrait)
 */
function printTabelKatrol({
  students = [],
  katrolResults = [],
  katrolBawah = 75,
  katrolAtas = 85,
  minKelas = 0,
  maxKelas = 0,
  config = {},
  selectedKelasObj = {},
  selectedMapel = '',
  selectedSemester = 'Ganjil',
  currentAcademicYear = '',
  schoolSettings = {},
  profilGuru = {}
}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up cetak terblokir oleh browser. Izinkan pop-up untuk mencetak dokumen.');
    return;
  }

  const validKatrols = katrolResults.filter(k => k.nilai_katrol !== null);
  const avgAsli = validKatrols.length > 0
    ? (validKatrols.reduce((acc, k) => acc + (k.rounded_score || 0), 0) / validKatrols.length).toFixed(1)
    : 0;
  const avgKatrol = validKatrols.length > 0
    ? (validKatrols.reduce((acc, k) => acc + (k.nilai_katrol || 0), 0) / validKatrols.length).toFixed(1)
    : 0;
  const tuntasKatrolCount = validKatrols.filter(k => k.is_tuntas_katrol).length;

  const printHTML = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Hasil Penyesuaian Nilai Katrol - ${selectedKelasObj?.nama_kelas || 'Kelas'} - ${selectedMapel}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; margin: 0; line-height: 1.3; }
        .kop-table { width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #000; margin-bottom: 12px; }
        .kop-logo { width: 60px; height: 60px; object-fit: contain; }
        .kop-text { text-align: center; }
        .kop-instansi { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; margin: 0; }
        .kop-dinas { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; margin: 0; }
        .kop-sekolah { font-size: 13.5pt; font-weight: bold; text-transform: uppercase; margin: 2px 0; }
        .kop-alamat { font-size: 8.5pt; margin: 0; }

        .title { text-align: center; font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 10px 0 2px 0; }
        .subtitle { text-align: center; font-size: 10pt; margin-bottom: 12px; }

        .meta-info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5pt; }
        .meta-info-table td { padding: 2.5px 4px; vertical-align: top; border: none; }

        .formula-box { width: 100%; border: 1px dashed #444; background-color: #f9f9f9; padding: 6px 10px; font-size: 9pt; margin-bottom: 12px; box-sizing: border-box; }

        table.katrol-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9.5pt; }
        table.katrol-table th, table.katrol-table td { border: 1px solid #000; padding: 5px 8px; }
        table.katrol-table th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
        .text-center { text-align: center; }
        .text-bold { font-weight: bold; }
        .text-right { text-align: right; }

        .signature-table { width: 100%; margin-top: 22px; border-collapse: collapse; font-size: 10pt; page-break-inside: avoid; }
        .signature-table td { width: 50%; vertical-align: top; text-align: center; border: none; }
      </style>
    </head>
    <body>
      <table class="kop-table">
        <tr>
          ${schoolSettings?.logo_url ? `<td style="width: 70px; text-align: center; vertical-align: middle;"><img src="${schoolSettings.logo_url}" class="kop-logo" /></td>` : ''}
          <td class="kop-text">
            <p class="kop-instansi">${schoolSettings?.instansi_induk || 'Pemerintah Provinsi'}</p>
            <p class="kop-dinas">${schoolSettings?.dinas || 'Dinas Pendidikan'}</p>
            <h2 class="kop-sekolah">${schoolSettings?.nama_sekolah || 'Nama Sekolah'}</h2>
            <p class="kop-alamat">${schoolSettings?.alamat || ''} ${schoolSettings?.telepon ? 'Telp: ' + schoolSettings.telepon : ''}</p>
          </td>
        </tr>
      </table>

      <div class="title">LAPORAN PENYESUAIAN NILAI AKHIR (KATROL)</div>
      <div class="subtitle">Tahun Ajaran: ${currentAcademicYear}</div>

      <table class="meta-info-table">
        <tr>
          <td style="width: 18%;"><strong>Mata Pelajaran</strong></td>
          <td style="width: 32%;">: ${selectedMapel}</td>
          <td style="width: 22%;"><strong>Standar KKM</strong></td>
          <td style="width: 28%;">: ${config?.kkm || 75}</td>
        </tr>
        <tr>
          <td><strong>Kelas / Rombel</strong></td>
          <td>: ${selectedKelasObj?.nama_kelas || '-'}</td>
          <td><strong>Distribusi Asli Kelas</strong></td>
          <td>: Min ${minKelas} s.d. Max ${maxKelas}</td>
        </tr>
        <tr>
          <td><strong>Semester</strong></td>
          <td>: ${selectedSemester === 'Semua' ? '1 Tahun Penuh' : `Semester ${selectedSemester}`}</td>
          <td><strong>Rentang Target Katrol</strong></td>
          <td>: ${katrolBawah} s.d. ${katrolAtas}</td>
        </tr>
      </table>

      <div class="formula-box">
        <strong>Metode Penyesuaian:</strong> <em>Min-Max Linear Rescaling (Penyebaran Ulang Proporsional)</em><br>
        Rumus: <code>Nilai_Katrol = ${katrolBawah} + ((Nilai_Asli - ${minKelas}) / (${maxKelas} - ${minKelas})) × (${katrolAtas} - ${katrolBawah})</code>
      </div>

      <table class="katrol-table">
        <thead>
          <tr>
            <th style="width: 30px;">No</th>
            <th style="width: 85px;">NISN</th>
            <th style="text-align: left;">Nama Siswa</th>
            <th style="width: 75px;">Nilai Asli</th>
            <th style="width: 85px;">Nilai Katrol</th>
            <th style="width: 60px;">Selisih</th>
            <th style="width: 60px;">Predikat</th>
            <th style="width: 75px;">Status KKM</th>
          </tr>
        </thead>
        <tbody>
          ${katrolResults.length === 0 ? `
            <tr><td colspan="8" class="text-center" style="padding: 15px;">Tidak ada data siswa.</td></tr>
          ` : katrolResults.map((k, idx) => `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td class="text-center">${k.nisn || '-'}</td>
              <td class="text-bold">${k.nama_lengkap}</td>
              <td class="text-center">${k.rounded_score !== null ? k.rounded_score : '-'}</td>
              <td class="text-center text-bold" style="background-color: #f9fdf9;">${k.nilai_katrol !== null ? k.nilai_katrol : '-'}</td>
              <td class="text-center" style="color: ${k.selisih >= 0 ? '#166534' : '#991b1b'}; font-weight: bold;">
                ${k.selisih !== null ? (k.selisih >= 0 ? '+' + k.selisih : k.selisih) : '-'}
              </td>
              <td class="text-center text-bold">${k.predikat_katrol || '-'}</td>
              <td class="text-center text-bold">${k.nilai_katrol !== null ? (k.is_tuntas_katrol ? 'Tuntas' : 'Remedial') : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f5f5f5; font-weight: bold;">
            <td colspan="3" class="text-right" style="padding-right: 10px;">RATA-RATA KELAS:</td>
            <td class="text-center">${avgAsli}</td>
            <td class="text-center" style="background-color: #e6f4ea;">${avgKatrol}</td>
            <td class="text-center">+${(avgKatrol - avgAsli).toFixed(1)}</td>
            <td colspan="2" class="text-center">${tuntasKatrolCount}/${validKatrols.length} Tuntas</td>
          </tr>
        </tfoot>
      </table>

      <table class="signature-table">
        <tr>
          <td>
            Mengetahui,<br>Kepala Sekolah<br><br><br><br><br>
            <strong><u>${profilGuru?.nama_kepsek || 'Nama Kepala Sekolah'}</u></strong><br>
            NIP. ${profilGuru?.nip_kepsek || '....................................'}
          </td>
          <td>
            ${profilGuru?.kota || 'Kota'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>
            Guru Mata Pelajaran<br><br><br><br><br>
            <strong><u>${profilGuru?.nama_guru || 'Nama Guru Mata Pelajaran'}</u></strong><br>
            NIP. ${profilGuru?.nip_guru || '....................................'}
          </td>
        </tr>
      </table>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(printHTML);
  printWindow.document.close();
}
