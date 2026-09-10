// components/RekapSiswaView.js - Modul Rekap Per Siswa (Profil & Portofolio Akademik Siswa)
import { db } from '../supabase-client.js';
import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderSiswaComboboxHTML, initSiswaCombobox } from './SiswaCombobox.js';
import { renderKategoriKegiatanComboboxHTML, initKategoriKegiatanCombobox } from './KategoriKegiatanCombobox.js';
import { renderLaporanSiswaModal } from './LaporanSiswaModal.js';

export async function renderRekapSiswaView(container, state, onStateChange, showToast) {
  const currentYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const kelasList = await db.getKelasSaya(currentYear);

  // Handle Empty State jika guru belum memiliki jadwal mengajar di tahun ajaran ini
  if (kelasList.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-slate-300 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <i data-lucide="calendar-off" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 text-base sm:text-lg">Belum Ada Jadwal Mengajar</h3>
          <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> sehingga belum ada Rekap Per Siswa yang dapat ditampilkan.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Penentuan kelas aktif (Prioritas: state.rekapSiswaKelasId -> state.currentKelasId -> kelas pertama guru)
  let currentKelasId = (state.rekapSiswaKelasId && kelasList.some(k => k.id === state.rekapSiswaKelasId))
    ? state.rekapSiswaKelasId
    : (state.currentKelasId && kelasList.some(k => k.id === state.currentKelasId)
        ? state.currentKelasId
        : (kelasList[0]?.id || ''));
  
  // Ambil data siswa pada kelas terpilih
  let siswaList = currentKelasId ? await db.getSiswaByKelas(currentKelasId) : [];
  
  // Tentukan siswa terpilih
  let currentSiswaId = state.rekapSiswaSelectedId;
  if (!currentSiswaId || !siswaList.some(s => s.id === currentSiswaId)) {
    currentSiswaId = siswaList[0]?.id || '';
  }

  // Local State untuk Partial Update
  const localState = {
    currentKelasId,
    currentSiswaId,
    siswaList,
    activeSubTab: state.rekapSiswaSubTab || 'presensi', // 'presensi' | 'nilai' | 'timeline' | 'pr' | 'kelompok'
    timelineFilterTag: state.rekapSiswaTimelineFilter || 'semua',
    currentYear,
    rekapData: null,
    riwayatPR: [],
    riwayatTugasKelompok: []
  };

  let activeRequestVersion = 0;

  // =========================================================================
  // INITIAL STATIC SHELL RENDER
  // =========================================================================
  container.innerHTML = `
    <div class="space-y-6 pb-24 max-w-6xl mx-auto">
      
      <!-- ================================================================= -->
      <!-- 1. FILTER & SELECTOR SISWA (HEADER MODUL - STATIC SHELL) -->
      <!-- ================================================================= -->
      <div class="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-700/50 space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30 flex-shrink-0">
              <i data-lucide="graduation-cap" class="w-6 h-6"></i>
            </div>
            <div>
              <h2 class="font-bold text-lg sm:text-xl">Rekap Per Siswa (Profil & Portofolio)</h2>
              <p class="text-xs text-emerald-200/80">Riwayat kehadiran individual lengkap, tren nilai tugas, dan catatan sikap</p>
            </div>
          </div>

          <!-- Quick Action Buttons Container -->
          <div id="rekap-siswa-action-buttons" class="flex items-center gap-2 self-start lg:self-auto flex-wrap">
            <!-- Buttons rendered dynamically based on student selection -->
          </div>
        </div>

        <!-- Selector Controls -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-emerald-700/40 text-xs">
          <!-- Dropdown Kelas (Shadcn Combobox) -->
          <div>
            <label class="block font-semibold text-emerald-200 mb-1">Pilih Kelas</label>
            ${renderClassComboboxHTML({
              id: 'rekap-select-kelas',
              kelasList,
              selectedId: localState.currentKelasId,
              size: 'sm'
            })}
          </div>

          <!-- Dropdown Siswa Container (Shadcn Siswa Combobox) -->
          <div class="sm:col-span-2" id="container-rekap-select-siswa">
            <!-- Rendered by renderSiswaDropdown() -->
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- DYNAMIC CONTENT AREA (PROFILE, STATS, TABS) -->
      <!-- ================================================================= -->
      <div id="rekap-siswa-dynamic-area" class="space-y-6">
        <div class="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200 flex flex-col items-center justify-center gap-3">
          <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-semibold text-slate-500">Memuat data portofolio siswa...</span>
        </div>
      </div>

    </div>
  `;

  // Helper untuk render Action Buttons di Header Banner
  function renderActionButtons() {
    const actionContainer = container.querySelector('#rekap-siswa-action-buttons');
    if (!actionContainer) return;

    const currentSiswa = localState.siswaList.find(s => s.id === localState.currentSiswaId);
    if (!currentSiswa || !localState.rekapData) {
      actionContainer.innerHTML = '';
      return;
    }

    actionContainer.innerHTML = `
      <!-- Tombol Cetak Laporan Catatan & Tugas Siswa -->
      <button id="btn-print-laporan-catatan-tugas" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition transform active:scale-95" title="Cetak Laporan Tagihan Tugas & Catatan Siswa">
        <i data-lucide="file-check" class="w-4 h-4 text-indigo-200"></i>
        <span>Cetak Laporan Tugas & Ceklis</span>
      </button>

      <!-- Tombol Cetak PDF Riwayat Kehadiran -->
      <button id="btn-print-presensi-siswa" class="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition transform active:scale-95" title="Cetak Riwayat Kehadiran Lengkap Siswa (PDF)">
        <i data-lucide="printer" class="w-4 h-4 text-teal-200"></i>
        <span>Cetak Kehadiran (PDF)</span>
      </button>
      
      <!-- Tombol Export Excel Riwayat Kehadiran -->
      <button id="btn-export-excel-siswa" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition transform active:scale-95" title="Unduh Riwayat Kehadiran Siswa ke File Excel (.xlsx)">
        <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-200"></i>
        <span>Export Excel (.xlsx)</span>
      </button>

      <!-- Tombol Cetak Rapor Lengkap Portofolio -->
      <button id="btn-print-rapor" class="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 transition" title="Cetak Rapor Portofolio Lengkap (Presensi + Nilai + Catatan)">
        <i data-lucide="file-text" class="w-4 h-4"></i>
        <span class="hidden sm:inline">Rapor Lengkap</span>
      </button>

      <!-- Tombol Kirim Ringkasan WA -->
      <button id="btn-export-wa" class="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 transition" title="Salin Ringkasan untuk Pesan WhatsApp">
        <i data-lucide="message-circle" class="w-4 h-4 text-emerald-300"></i>
        <span>WA</span>
      </button>
    `;

    // Bind action events
    bindHeaderActionEvents();
  }

  // Helper untuk render dropdown Siswa
  function renderSiswaDropdown() {
    const siswaContainer = container.querySelector('#container-rekap-select-siswa');
    if (!siswaContainer) return;

    siswaContainer.innerHTML = `
      <label class="block font-semibold text-emerald-200 mb-1">Pilih Siswa Target (${localState.siswaList.length} Siswa Terdaftar)</label>
      ${renderSiswaComboboxHTML({
        id: 'rekap-select-siswa',
        siswaList: localState.siswaList,
        selectedId: localState.currentSiswaId,
        size: 'sm'
      })}
    `;

    initSiswaCombobox(siswaContainer, {
      id: 'rekap-select-siswa',
      siswaList: localState.siswaList,
      selectedId: localState.currentSiswaId,
      size: 'sm',
      onSelect: (newSId) => {
        if (newSId === localState.currentSiswaId) return;
        localState.currentSiswaId = newSId;
        loadAndRenderStudentData();
      }
    });
  }

  // =========================================================================
  // DATA FETCHER & RENDERER (PARTIAL UPDATE)
  // =========================================================================
  async function loadAndRenderStudentData() {
    const currentVersion = ++activeRequestVersion;
    const dynamicArea = container.querySelector('#rekap-siswa-dynamic-area');
    if (!dynamicArea) return;

    if (!localState.currentSiswaId || localState.siswaList.length === 0) {
      localState.rekapData = null;
      localState.riwayatPR = [];
      localState.riwayatTugasKelompok = [];
      renderActionButtons();
      dynamicArea.innerHTML = `
        <div class="bg-white rounded-2xl p-12 text-center text-slate-400 border border-dashed border-slate-200">
          <i data-lucide="user-x" class="w-12 h-12 mx-auto text-slate-300 mb-3"></i>
          <p class="font-semibold text-slate-700">Tidak ada siswa yang dipilih atau kelas masih kosong.</p>
          <p class="text-xs text-slate-400 mt-1">Silakan tambahkan siswa di menu Kelola Data Kelas & Siswa.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Tampilkan loading skeleton/spinner di dynamic area saja
    dynamicArea.innerHTML = `
      <div class="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200 flex flex-col items-center justify-center gap-3">
        <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold text-slate-500">Memuat data portofolio siswa...</span>
      </div>
    `;

    try {
      const [rekapData, riwayatPR, riwayatTugasKelompok] = await Promise.all([
        db.getRekapIndividuSiswa(localState.currentSiswaId, localState.currentYear),
        db.getRekapPRBySiswa(localState.currentSiswaId, localState.currentYear),
        db.getRekapTugasKelompokBySiswa(localState.currentSiswaId, localState.currentYear)
      ]);

      // Stale check
      if (currentVersion !== activeRequestVersion) return;

      localState.rekapData = rekapData;
      localState.riwayatPR = riwayatPR || [];
      localState.riwayatTugasKelompok = riwayatTugasKelompok || [];

      renderActionButtons();
      renderStudentPortofolioContent();
    } catch (err) {
      if (currentVersion !== activeRequestVersion) return;
      console.error('Gagal memuat rekap siswa:', err);
      dynamicArea.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-700 space-y-2">
          <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto text-rose-500"></i>
          <h4 class="font-bold text-sm">Gagal Memuat Data Siswa</h4>
          <p class="text-xs text-rose-600 max-w-md mx-auto">${err.message || 'Terjadi kesalahan saat mengambil data portofolio siswa.'}</p>
          <button id="btn-retry-rekap-siswa" class="mt-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition">
            Coba Lagi
          </button>
        </div>
      `;
      dynamicArea.querySelector('#btn-retry-rekap-siswa')?.addEventListener('click', loadAndRenderStudentData);
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // =========================================================================
  // RENDER COMPLETE PORTOFOLIO SECTIONS (PROFILE + STATS + SUBTABS)
  // =========================================================================
  function renderStudentPortofolioContent() {
    const dynamicArea = container.querySelector('#rekap-siswa-dynamic-area');
    if (!dynamicArea) return;

    const { rekapData, riwayatPR, riwayatTugasKelompok, activeSubTab, timelineFilterTag, currentYear } = localState;

    if (!rekapData || !rekapData.siswa) {
      dynamicArea.innerHTML = `
        <div class="bg-white rounded-2xl p-12 text-center text-slate-400 border border-dashed border-slate-200">
          <i data-lucide="user-x" class="w-12 h-12 mx-auto text-slate-300 mb-3"></i>
          <p class="font-semibold text-slate-700">Data siswa tidak ditemukan.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const siswa = rekapData.siswa;
    const kelas = rekapData.kelas || localState.siswaList.find(s => s.id === siswa.id)?.kelas || {};
    const presensi = rekapData.presensi || { totalSesi: 0, hadir: 0, sakit: 0, izin: 0, alfa: 0, persentase: 0, riwayat: [] };
    const akademik = rekapData.akademik || { totalTugas: 0, tugasDinilai: 0, tugasTuntas: 0, tugasRemedi: 0, rataRataNilai: 0, nilaiTertinggi: 0, nilaiTerendah: 0, riwayat: [], riwayatTugas: [] };
    const timelineNotes = rekapData.timelineNotes || [];

    const countPRMengumpulkan = riwayatPR.filter(p => p.mengumpulkan).length;
    const countPRTidakMengumpulkan = riwayatPR.filter(p => !p.mengumpulkan).length;
    const prNilaiList = riwayatPR.filter(p => p.nilai !== null && !isNaN(p.nilai)).map(p => Number(p.nilai));
    const rataRataPR = prNilaiList.length > 0 ? (prNilaiList.reduce((a, b) => a + b, 0) / prNilaiList.length).toFixed(1) : '-';

    const countKelompokTuntas = riwayatTugasKelompok.filter(t => t.isTuntas).length;
    const countKelompokRemedi = riwayatTugasKelompok.filter(t => t.isTuntas === false).length;
    const kelNilaiList = riwayatTugasKelompok.filter(t => t.nilai !== null && !isNaN(t.nilai)).map(t => Number(t.nilai));
    const rataRataKelompok = kelNilaiList.length > 0 ? (kelNilaiList.reduce((a, b) => a + b, 0) / kelNilaiList.length).toFixed(1) : '-';

    // Hitung jumlah catatan untuk 6 Kategori Baku
    const countPositif = timelineNotes.filter(n => {
      const k = (n.kategori || '').toLowerCase();
      return k.includes('positif') || k.includes('prestasi');
    }).length;

    const countPelanggaran = timelineNotes.filter(n => {
      const k = (n.kategori || '').toLowerCase();
      return k.includes('pelanggaran') || k.includes('perilaku');
    }).length;

    const countBimbingan = timelineNotes.filter(n => {
      const k = (n.kategori || '').toLowerCase();
      return k.includes('bimbingan') || k.includes('remedial');
    }).length;

    const countDispensasi = timelineNotes.filter(n => {
      const k = (n.kategori || '').toLowerCase();
      return k.includes('dispensasi') || k.includes('lomba');
    }).length;

    const countIzinKhusus = timelineNotes.filter(n => {
      const k = (n.kategori || '').toLowerCase();
      return k.includes('izin') || k.includes('dinas');
    }).length;

    const countLainnya = timelineNotes.filter(n => {
      const k = (n.kategori || '').toLowerCase();
      return k.includes('lainnya') || k === 'presensi' || k === 'ceklis siswa' || k === 'penilaian tugas';
    }).length;

    // Tentukan Predikat Siswa
    let predikatLabel = 'Belum Ada Data';
    let predikatColor = 'bg-slate-100 text-slate-700 border-slate-300';
    if (akademik && presensi) {
      if (akademik.rataRataNilai >= 85 && presensi.persentase >= 90) {
        predikatLabel = '🌟 Sangat Baik & Berprestasi';
        predikatColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      } else if (akademik.rataRataNilai >= (akademik.riwayatTugas?.[0]?.kkm || 75) && presensi.persentase >= 80) {
        predikatLabel = '🟢 Tuntas & Memenuhi KKM';
        predikatColor = 'bg-teal-100 text-teal-800 border-teal-300';
      } else if (presensi.alfa >= 3 || (akademik.tugasRemedi > 0 && akademik.tugasRemedi > akademik.tugasTuntas)) {
        predikatLabel = '⚠️ Perlu Perhatian & Remedial';
        predikatColor = 'bg-rose-100 text-rose-800 border-rose-300';
      } else {
        predikatLabel = '🔵 Cukup (Perlu Ditingkatkan)';
        predikatColor = 'bg-sky-100 text-sky-800 border-sky-300';
      }
    }

    dynamicArea.innerHTML = `
      <!-- ================================================================= -->
      <!-- 2. KARTU PROFIL & RINGKASAN STATISTIK (TOP SECTION) -->
      <!-- ================================================================= -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        <!-- Kartu Profil Siswa -->
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div class="flex items-start gap-4">
            <!-- Avatar Placeholder -->
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-emerald-700/20 flex-shrink-0 ring-4 ring-emerald-50">
              ${siswa.nama_lengkap.charAt(0)}
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-bold text-slate-900 text-base leading-snug truncate">${siswa.nama_lengkap}</h3>
              <p class="text-xs text-slate-500 font-medium mt-0.5">
                No. Absen: <strong class="text-slate-700">${siswa.nomor_absen || '-'}</strong> • NISN: <strong class="text-slate-700">${siswa.nisn || '-'}</strong>
              </p>
              <p class="text-xs text-emerald-700 font-semibold mt-0.5">
                ${kelas.nama_kelas || ''}${kelas.jurusan ? ` (${kelas.jurusan})` : ''}
              </p>
            </div>
          </div>

          <!-- Predikat Status -->
          <div class="pt-3 border-t border-slate-100">
            <span class="text-[11px] font-bold block text-slate-400 uppercase tracking-wider mb-1">Status Ketuntasan Umum</span>
            <span class="inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-xl border ${predikatColor}">
              ${predikatLabel}
            </span>
          </div>
        </div>

        <!-- Statistik Presensi Siswa -->
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <i data-lucide="calendar-check" class="w-4 h-4 text-emerald-600"></i>
              <span>Statistik Kehadiran</span>
            </span>
            <span class="text-sm font-black ${presensi.persentase >= 85 ? 'text-emerald-700' : presensi.persentase >= 75 ? 'text-amber-600' : 'text-rose-600'}">
              ${presensi.persentase}% (${presensi.totalSesi} Sesi)
            </span>
          </div>

          <!-- Progress Bar -->
          <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500 ${presensi.persentase >= 85 ? 'bg-emerald-500' : presensi.persentase >= 75 ? 'bg-amber-500' : 'bg-rose-500'}" style="width: ${presensi.persentase}%"></div>
          </div>

          <!-- Breakdown Grid -->
          <div class="grid grid-cols-4 gap-1.5 text-center pt-1">
            <div class="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
              <span class="text-[10px] font-bold text-emerald-800 block">Hadir</span>
              <strong class="text-sm text-emerald-900">${presensi.hadir}</strong>
            </div>
            <div class="bg-amber-50 p-2 rounded-xl border border-amber-200">
              <span class="text-[10px] font-bold text-amber-800 block">Sakit</span>
              <strong class="text-sm text-amber-900">${presensi.sakit}</strong>
            </div>
            <div class="bg-sky-50 p-2 rounded-xl border border-sky-200">
              <span class="text-[10px] font-bold text-sky-800 block">Izin</span>
              <strong class="text-sm text-sky-900">${presensi.izin}</strong>
            </div>
            <div class="bg-rose-50 p-2 rounded-xl border border-rose-200">
              <span class="text-[10px] font-bold text-rose-800 block">Alfa</span>
              <strong class="text-sm text-rose-900">${presensi.alfa}</strong>
            </div>
          </div>
        </div>

        <!-- Statistik Akademik Siswa -->
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <i data-lucide="award" class="w-4 h-4 text-amber-500"></i>
              <span>Statistik Akademik</span>
            </span>
            <span class="text-xs font-semibold text-slate-500">
              ${akademik.tugasDinilai} / ${akademik.totalTugas} Tugas
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center pt-1">
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span class="text-[10px] font-bold text-slate-500 block">Rata-Rata</span>
              <strong class="text-base text-emerald-700 font-extrabold">${akademik.rataRataNilai || '-'}</strong>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span class="text-[10px] font-bold text-slate-500 block">Tertinggi</span>
              <strong class="text-base text-sky-700 font-extrabold">${akademik.nilaiTertinggi || '-'}</strong>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span class="text-[10px] font-bold text-slate-500 block">Terendah</span>
              <strong class="text-base text-amber-700 font-extrabold">${akademik.nilaiTerendah || '-'}</strong>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs font-semibold pt-1">
            <span class="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              ✅ Tuntas: <strong>${akademik.tugasTuntas}</strong>
            </span>
            <span class="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              ⚠️ Remedi: <strong>${akademik.tugasRemedi}</strong>
            </span>
          </div>
        </div>

      </div>

      <!-- ================================================================= -->
      <!-- 3. TAB NAVIGASI KONTEN (5 SUBTABS) -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        
        <!-- Subtab Headers -->
        <div id="rekap-siswa-tab-nav" class="flex items-center border-b border-slate-200 px-4 pt-2 bg-slate-50/70 gap-2 flex-wrap sm:flex-nowrap">
          <!-- TAB 1: RIWAYAT KEHADIRAN -->
          <button id="tab-btn-presensi" data-tab="presensi" class="rekap-subtab-btn px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${activeSubTab === 'presensi' ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            <i data-lucide="calendar-check-2" class="w-4 h-4 text-emerald-600"></i>
            <span>1. Riwayat Kehadiran Lengkap</span>
            <span class="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">${presensi.riwayat.length}</span>
          </button>

          <!-- TAB 2: RIWAYAT TUGAS & CATATAN -->
          <button id="tab-btn-nilai" data-tab="nilai" class="rekap-subtab-btn px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${activeSubTab === 'nilai' ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            <i data-lucide="clipboard-list" class="w-4 h-4 text-sky-600"></i>
            <span>2. Riwayat Tugas & Catatan</span>
            <span class="bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">${akademik.riwayat.length}</span>
          </button>

          <!-- TAB 3: TIMELINE CATATAN -->
          <button id="tab-btn-timeline" data-tab="timeline" class="rekap-subtab-btn px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${activeSubTab === 'timeline' ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            <i data-lucide="clock" class="w-4 h-4 text-purple-600"></i>
            <span>3. Timeline Catatan & Sikap</span>
            <span class="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">${timelineNotes.length}</span>
          </button>

          <!-- TAB 4: RIWAYAT PEKERJAAN RUMAH (PR) -->
          <button id="tab-btn-pr" data-tab="pr" class="rekap-subtab-btn px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${activeSubTab === 'pr' ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            <i data-lucide="home" class="w-4 h-4 text-indigo-600"></i>
            <span>4. Pekerjaan Rumah (PR)</span>
            <span class="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">${riwayatPR.length}</span>
          </button>

          <!-- TAB 5: RIWAYAT TUGAS KELOMPOK -->
          <button id="tab-btn-kelompok" data-tab="kelompok" class="rekap-subtab-btn px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${activeSubTab === 'kelompok' ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            <i data-lucide="award" class="w-4 h-4 text-teal-600"></i>
            <span>5. Tugas Kelompok</span>
            <span class="bg-teal-100 text-teal-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">${riwayatTugasKelompok.length}</span>
          </button>
        </div>

        <!-- Subtab Content Containers -->
        <div id="rekap-siswa-subtab-panels">
          
          <!-- ============================================================= -->
          <!-- SUBTAB 1: TABEL RIWAYAT KEHADIRAN INDIVIDUAL LENGKAP -->
          <!-- ============================================================= -->
          <div id="subtab-panel-presensi" class="${activeSubTab === 'presensi' ? '' : 'hidden'} p-4 sm:p-6 space-y-4">
            
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <h4 class="font-bold text-slate-800 text-xs sm:text-sm">Riwayat Presensi Individual: ${siswa.nama_lengkap}</h4>
                <p class="text-[11px] text-slate-500 mt-0.5">Daftar sesi pertemuan diurutkan dari awal hingga terakhir</p>
              </div>

              <!-- Action buttons inside table card -->
              <div class="flex items-center gap-2 flex-wrap">
                <button class="btn-sub-print-presensi bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition">
                  <i data-lucide="printer" class="w-4 h-4 text-emerald-600"></i>
                  <span>Cetak Lembar Kehadiran</span>
                </button>
                <button class="btn-sub-export-excel bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition">
                  <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
                  <span>Download Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            <!-- Tabel Riwayat Kehadiran Sesi -->
            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-3 text-center w-12">No</th>
                    <th class="py-3 px-3 w-28 text-center">Tanggal</th>
                    <th class="py-3 px-3 min-w-[180px]">Mata Pelajaran</th>
                    <th class="py-3 px-3 text-center w-28">Status Kehadiran</th>
                    <th class="py-3 px-3 min-w-[200px]">Materi Pembelajaran</th>
                    <th class="py-3 px-3 min-w-[150px]">Catatan Khusus</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${presensi.riwayat.length === 0 ? `
                    <tr>
                      <td colspan="6" class="py-8 text-center text-slate-400">
                        Belum ada riwayat sesi presensi yang tercatat untuk siswa ini.
                      </td>
                    </tr>
                  ` : presensi.riwayat.map((r, idx) => {
                    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                    let iconName = 'check-circle-2';
                    if (r.status === 'Sakit') {
                      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                      iconName = 'thermometer';
                    } else if (r.status === 'Izin') {
                      badgeClass = 'bg-sky-100 text-sky-800 border-sky-300';
                      iconName = 'info';
                    } else if (r.status === 'Alfa') {
                      badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
                      iconName = 'alert-circle';
                    }

                    return `
                      <tr class="hover:bg-slate-50/80 transition">
                        <td class="py-2.5 px-3 text-center font-semibold text-slate-500">${idx + 1}</td>
                        <td class="py-2.5 px-3 text-center font-bold text-slate-700">${r.tanggal}</td>
                        <td class="py-2.5 px-3 font-semibold text-slate-800">${r.mapel}</td>
                        
                        <!-- Status Badge -->
                        <td class="py-2.5 px-3 text-center">
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}">
                            <i data-lucide="${iconName}" class="w-3.5 h-3.5"></i>
                            <span>${r.status}</span>
                          </span>
                        </td>

                        <!-- Materi Pokok -->
                        <td class="py-2.5 px-3 text-slate-800 font-medium">${r.materi || '-'}</td>

                        <!-- Catatan -->
                        <td class="py-2.5 px-3 text-slate-500 text-[11px]">${r.catatan || '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Rekapitulasi Bar Bawah -->
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="text-slate-600 font-medium">
                Total Pertemuan: <strong>${presensi.totalSesi} Sesi</strong> • Keaktifan: <strong class="${presensi.persentase >= 85 ? 'text-emerald-700' : 'text-rose-600'}">${presensi.persentase}%</strong>
              </div>
              <div class="flex items-center gap-2 font-bold">
                <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">H: ${presensi.hadir}</span>
                <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800">S: ${presensi.sakit}</span>
                <span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800">I: ${presensi.izin}</span>
                <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800">A: ${presensi.alfa}</span>
              </div>
            </div>

          </div>

          <!-- ============================================================= -->
          <!-- SUBTAB 2: RIWAYAT TUGAS & CATATAN CEKLIS (GABUNGAN) -->
          <!-- ============================================================= -->
          <div id="subtab-panel-nilai" class="${activeSubTab === 'nilai' ? '' : 'hidden'} p-4 sm:p-6 space-y-6">
            
            <!-- GRAFIK TREN PERFORMA BELAJAR (SVG LINE CHART) -->
            <div class="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 class="font-bold text-slate-800 text-xs sm:text-sm">Grafik Tren Nilai Siswa vs KKM & Rata-rata Kelas</h4>
                  <p class="text-[11px] text-slate-500">Perkembangan nilai tugas & ulangan berangka sepanjang pembelajaran</p>
                </div>
                
                <!-- Legend -->
                <div class="flex items-center gap-3 text-xs font-semibold flex-wrap">
                  <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-full bg-emerald-600"></span>
                    <span class="text-slate-700">Nilai Siswa</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-3 h-0.5 bg-rose-500 border-b border-dashed border-rose-500"></span>
                    <span class="text-slate-700">Standar KKM (75)</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-3 h-0.5 bg-slate-400"></span>
                    <span class="text-slate-700">Rata-rata Kelas</span>
                  </div>
                </div>
              </div>

              <!-- Render Chart SVG -->
              <div class="w-full overflow-x-auto pt-2">
                ${renderPerformanceChartSVG(akademik.riwayatTugas || akademik.riwayat.filter(r => r.tipe === 'Tugas' && !r.isBebas))}
              </div>
            </div>

            <!-- TABEL GABUNGAN RIWAYAT TUGAS & CATATAN CEKLIS -->
            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-3 text-center w-12">No</th>
                    <th class="py-3 px-3 text-center w-24">Tipe</th>
                    <th class="py-3 px-3 min-w-[150px]">Mata Pelajaran</th>
                    <th class="py-3 px-3 min-w-[200px]">Nama / Judul</th>
                    <th class="py-3 px-3 text-center w-28">Tanggal</th>
                    <th class="py-3 px-3 text-center w-16">KKM</th>
                    <th class="py-3 px-3 text-center w-24">Nilai Siswa</th>
                    <th class="py-3 px-3 text-center w-32">Status</th>
                    <th class="py-3 px-3 min-w-[150px]">Catatan Guru</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${akademik.riwayat.length === 0 ? `
                    <tr>
                      <td colspan="9" class="py-8 text-center text-slate-400">
                        Belum ada data tugas atau catatan ceklis untuk siswa ini.
                      </td>
                    </tr>
                  ` : akademik.riwayat.map((t, idx) => {
                    const isTugas = t.tipe === 'Tugas';
                    const isFilled = t.nilai !== null && t.nilai !== undefined;

                    let statusBadge = '';
                    if (t.isBebas || t.status === 'Bebas') {
                      statusBadge = `
                        <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-300 px-2.5 py-0.5 rounded-full">
                          <i data-lucide="sparkles" class="w-3 h-3 text-teal-600"></i>
                          <span>Bebas</span>
                        </span>
                      `;
                    } else if (isTugas) {
                      if (!isFilled) {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="help-circle" class="w-3 h-3"></i>
                            <span>Belum Dinilai</span>
                          </span>
                        `;
                      } else if (t.isTuntas) {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>
                            <span>Tuntas</span>
                          </span>
                        `;
                      } else {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="alert-circle" class="w-3 h-3 text-rose-600"></i>
                            <span>Remedi</span>
                          </span>
                        `;
                      }
                    } else {
                      if (t.status === 'Selesai') {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="check-check" class="w-3 h-3 text-emerald-600"></i>
                            <span>Selesai</span>
                          </span>
                        `;
                      } else {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="clock" class="w-3 h-3 text-amber-600"></i>
                            <span>Belum Selesai</span>
                          </span>
                        `;
                      }
                    }

                    return `
                      <tr class="hover:bg-slate-50/80 transition">
                        <td class="py-2.5 px-3 text-center font-semibold text-slate-500">${idx + 1}</td>
                        <td class="py-2.5 px-3 text-center">
                          <span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${isTugas ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-teal-50 text-teal-800 border-teal-200'}">
                            <i data-lucide="${isTugas ? 'file-text' : 'check-square'}" class="w-3 h-3"></i>
                            <span>${isTugas ? 'Tugas' : 'Ceklis'}</span>
                          </span>
                        </td>
                        <td class="py-2.5 px-3 font-semibold text-slate-800">${t.mapel}</td>
                        <td class="py-2.5 px-3 font-bold text-slate-900">${t.judul || t.judul_tugas}</td>
                        <td class="py-2.5 px-3 text-center text-slate-600 font-medium">${t.tanggal}</td>
                        <td class="py-2.5 px-3 text-center font-bold text-slate-600">${t.isBebas || !isTugas || t.kkm === null ? '-' : t.kkm}</td>
                        <td class="py-2.5 px-3 text-center">
                          ${t.isBebas || !isTugas || !isFilled ? `
                            <span class="text-slate-400 font-bold">-</span>
                          ` : `
                            <strong class="text-sm ${t.isTuntas ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}">
                              ${t.nilai}
                            </strong>
                          `}
                        </td>
                        <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                        <td class="py-2.5 px-3 text-slate-600 text-[11px]">${t.catatan || '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

          </div>

          <!-- ============================================================= -->
          <!-- SUBTAB 3: TIMELINE CATATAN SIKAP & KEGIATAN SISWA -->
          <!-- ============================================================= -->
          <div id="subtab-panel-timeline" class="${activeSubTab === 'timeline' ? '' : 'hidden'} p-4 sm:p-6 space-y-4">
            
            <!-- Filter Kategori Toolbar & Action Button -->
            <div class="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-slate-100">
              <div id="rekap-siswa-timeline-filters" class="flex items-center gap-1.5 text-xs font-semibold flex-wrap">
                <button class="btn-timeline-filter px-3 py-1.5 rounded-xl transition ${(!timelineFilterTag || timelineFilterTag === 'semua') ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-tag="semua">
                  Semua (${timelineNotes.length})
                </button>
                <button class="btn-timeline-filter px-3 py-1.5 rounded-xl transition ${timelineFilterTag === 'Catatan Positif / Prestasi' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-tag="Catatan Positif / Prestasi">
                  🌟 Catatan Positif / Prestasi (${countPositif})
                </button>
                <button class="btn-timeline-filter px-3 py-1.5 rounded-xl transition ${timelineFilterTag === 'Catatan Perilaku / Pelanggaran' ? 'bg-rose-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-tag="Catatan Perilaku / Pelanggaran">
                  ⚠️ Catatan Perilaku / Pelanggaran (${countPelanggaran})
                </button>
                <button class="btn-timeline-filter px-3 py-1.5 rounded-xl transition ${timelineFilterTag === 'Bimbingan / Remedial' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-tag="Bimbingan / Remedial">
                  📘 Bimbingan / Remedial (${countBimbingan})
                </button>
                <button class="btn-timeline-filter px-3 py-1.5 rounded-xl transition ${timelineFilterTag === 'Dispensasi / Lomba' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-tag="Dispensasi / Lomba">
                  🏆 Dispensasi / Lomba (${countDispensasi})
                </button>
                <button class="btn-timeline-filter px-3 py-1.5 rounded-xl transition ${timelineFilterTag === 'Izin Khusus / Dinas Luar' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-tag="Izin Khusus / Dinas Luar">
                  📄 Izin Khusus / Dinas Luar (${countIzinKhusus})
                </button>
                <button class="btn-timeline-filter px-3 py-1.5 rounded-xl transition ${timelineFilterTag === 'Catatan Lainnya' ? 'bg-slate-700 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-tag="Catatan Lainnya">
                  📌 Catatan Lainnya (${countLainnya})
                </button>
              </div>

              <!-- Quick Add Note Button -->
              <button id="btn-quick-add-sikap" class="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition transform active:scale-95" title="Input Catatan Sikap / Kegiatan untuk Siswa Ini">
                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                <span>+ Tambah Catatan Sikap</span>
              </button>
            </div>

            <!-- Timeline Cards Container -->
            <div id="rekap-siswa-timeline-list" class="space-y-3">
              ${renderTimelineListHTML(timelineNotes, timelineFilterTag)}
            </div>

          </div>

          <!-- ============================================================= -->
          <!-- SUBTAB 4: RIWAYAT PEKERJAAN RUMAH (PR) -->
          <!-- ============================================================= -->
          <div id="subtab-panel-pr" class="${activeSubTab === 'pr' ? '' : 'hidden'} p-4 sm:p-6 space-y-4">
            
            <!-- PR Summary Stats Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Total PR</div>
                <div class="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-100">${riwayatPR.length}</div>
                <p class="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Tahun ${currentYear}</p>
              </div>

              <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Mengumpulkan</div>
                <div class="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100">${countPRMengumpulkan}</div>
                <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Tugas diserahkan</p>
              </div>

              <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Tidak Mengumpulkan</div>
                <div class="text-xl sm:text-2xl font-black text-rose-950 dark:text-rose-100">${countPRTidakMengumpulkan}</div>
                <p class="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Tanpa pengerjaan</p>
              </div>

              <div class="bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Rata-rata Nilai</div>
                <div class="text-xl sm:text-2xl font-black text-purple-950 dark:text-purple-100">${rataRataPR}</div>
                <p class="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Dari PR yang dinilai</p>
              </div>
            </div>

            <!-- Table Riwayat PR -->
            <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div class="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-slate-800 text-xs sm:text-sm">Riwayat Pekerjaan Rumah: ${siswa.nama_lengkap}</h4>
                  <p class="text-[11px] text-slate-500">Histori penugasan PR dan evaluasi pengerjaan</p>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th class="py-3 px-3.5 text-center w-12">No</th>
                      <th class="py-3 px-3.5">Tanggal</th>
                      <th class="py-3 px-3.5">Mata Pelajaran</th>
                      <th class="py-3 px-3.5">Topik / Soal PR</th>
                      <th class="py-3 px-3.5 text-center">Status Siswa</th>
                      <th class="py-3 px-3.5 text-center">Nilai</th>
                      <th class="py-3 px-3.5">Catatan Guru</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${riwayatPR.length === 0 ? `
                      <tr>
                        <td colspan="7" class="py-10 text-center text-slate-400">
                          Belum ada data penugasan Pekerjaan Rumah untuk siswa ini di tahun ajaran ${currentYear}.
                        </td>
                      </tr>
                    ` : riwayatPR.map((pr, idx) => {
                      const tglStr = new Date(pr.tanggal_diberikan).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      });
                      const isMengumpulkan = pr.mengumpulkan !== false;
                      const nilaiText = pr.nilai !== null && !isNaN(pr.nilai) ? pr.nilai : (isMengumpulkan ? '-' : '0');

                      return `
                        <tr class="hover:bg-slate-50/70 transition">
                          <td class="py-3 px-3.5 text-center font-bold text-slate-500">${idx + 1}</td>
                          <td class="py-3 px-3.5 font-semibold text-slate-700 whitespace-nowrap">${tglStr}</td>
                          <td class="py-3 px-3.5">
                            <span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-bold border border-purple-200 text-[10px]">
                              ${pr.mapel}
                            </span>
                          </td>
                          <td class="py-3 px-3.5 font-bold text-slate-800 min-w-[200px]">${pr.topik}</td>
                          <td class="py-3 px-3.5 text-center">
                            ${isMengumpulkan ? `
                              <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1">
                                <i data-lucide="check" class="w-3 h-3"></i> Mengumpulkan
                              </span>
                            ` : `
                              <span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] inline-flex items-center gap-1">
                                <i data-lucide="x" class="w-3 h-3"></i> Tidak Mengumpulkan
                              </span>
                            `}
                          </td>
                          <td class="py-3 px-3.5 text-center font-black ${pr.nilai !== null && pr.nilai >= 75 ? 'text-emerald-700' : 'text-slate-700'}">
                            ${nilaiText}
                          </td>
                          <td class="py-3 px-3.5 text-slate-500 italic text-[11px]">${pr.catatan || '-'}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- ============================================================= -->
          <!-- SUBTAB 5: RIWAYAT NILAI TUGAS KELOMPOK -->
          <!-- ============================================================= -->
          <div id="subtab-panel-kelompok" class="${activeSubTab === 'kelompok' ? '' : 'hidden'} p-4 sm:p-6 space-y-4">
            
            <!-- Group Summary Stats Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider">Total Tugas Kelompok</div>
                <div class="text-xl sm:text-2xl font-black text-teal-950 dark:text-teal-100">${riwayatTugasKelompok.length}</div>
                <p class="text-[10px] text-teal-600 dark:text-teal-400 font-medium">Tahun ${currentYear}</p>
              </div>

              <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Tuntas KKM</div>
                <div class="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100">${countKelompokTuntas}</div>
                <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Nilai ≥ Standar KKM</p>
              </div>

              <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Remedial</div>
                <div class="text-xl sm:text-2xl font-black text-rose-950 dark:text-rose-100">${countKelompokRemedi}</div>
                <p class="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Perlu bimbingan</p>
              </div>

              <div class="bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800 rounded-2xl p-3.5 space-y-1">
                <div class="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">Rata-rata Nilai</div>
                <div class="text-xl sm:text-2xl font-black text-sky-950 dark:text-sky-100">${rataRataKelompok}</div>
                <p class="text-[10px] text-sky-600 dark:text-sky-400 font-medium">Kerja kelompok</p>
              </div>
            </div>

            <!-- Table Riwayat Tugas Kelompok -->
            <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div class="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-slate-800 text-xs sm:text-sm">Riwayat Penilaian Tugas Kelompok: ${siswa.nama_lengkap}</h4>
                  <p class="text-[11px] text-slate-500">Histori tugas kolaboratif, nama kelompok saat pengerjaan, dan evaluasi guru</p>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th class="py-3 px-3.5 text-center w-12">No</th>
                      <th class="py-3 px-3.5">Tanggal</th>
                      <th class="py-3 px-3.5">Mata Pelajaran</th>
                      <th class="py-3 px-3.5">Judul Tugas Kelompok</th>
                      <th class="py-3 px-3.5 text-center">Kelompok Siswa</th>
                      <th class="py-3 px-3.5 text-center">KKM</th>
                      <th class="py-3 px-3.5 text-center">Nilai Siswa</th>
                      <th class="py-3 px-3.5 text-center">Status</th>
                      <th class="py-3 px-3.5">Catatan Guru</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${riwayatTugasKelompok.length === 0 ? `
                      <tr>
                        <td colspan="9" class="py-10 text-center text-slate-400">
                          Belum ada data penilaian Tugas Kelompok untuk siswa ini di tahun ajaran ${currentYear}.
                        </td>
                      </tr>
                    ` : riwayatTugasKelompok.map((t, idx) => {
                      const tglStr = new Date(t.tanggal).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      });
                      const isFilled = t.nilai !== null && t.nilai !== undefined && !isNaN(t.nilai);

                      let statusBadge = '';
                      if (!isFilled) {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="help-circle" class="w-3 h-3"></i>
                            <span>Belum Dinilai</span>
                          </span>
                        `;
                      } else if (t.isTuntas) {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>
                            <span>Tuntas</span>
                          </span>
                        `;
                      } else {
                        statusBadge = `
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full">
                            <i data-lucide="alert-circle" class="w-3 h-3 text-rose-600"></i>
                            <span>Remedi</span>
                          </span>
                        `;
                      }

                      return `
                        <tr class="hover:bg-slate-50/70 transition">
                          <td class="py-3 px-3.5 text-center font-bold text-slate-500">${idx + 1}</td>
                          <td class="py-3 px-3.5 font-semibold text-slate-700 whitespace-nowrap">${tglStr}</td>
                          <td class="py-3 px-3.5">
                            <span class="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold border border-teal-200 text-[10px]">
                              ${t.mapel}
                            </span>
                          </td>
                          <td class="py-3 px-3.5 font-bold text-slate-800 min-w-[200px]">${t.judul_tugas}</td>
                          <td class="py-3 px-3.5 text-center">
                            <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-extrabold text-[10px] border border-emerald-200 inline-flex items-center gap-1">
                              <i data-lucide="users" class="w-3 h-3 text-emerald-600"></i>
                              <span>${t.nama_kelompok}</span>
                            </span>
                          </td>
                          <td class="py-3 px-3.5 text-center font-bold text-slate-600">${t.kkm || 75}</td>
                          <td class="py-3 px-3.5 text-center font-black ${isFilled && t.nilai >= (t.kkm || 75) ? 'text-emerald-700' : 'text-slate-700'}">
                            ${isFilled ? t.nilai : '-'}
                          </td>
                          <td class="py-3 px-3.5 text-center">
                            ${statusBadge}
                          </td>
                          <td class="py-3 px-3.5 text-slate-500 italic text-[11px]">${t.catatan || '-'}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

      </div>
    `;

    bindDynamicPortofolioEvents();
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // HELPER: RENDER TIMELINE LIST HTML
  // =========================================================================
  function renderTimelineListHTML(timelineNotes, filterTag) {
    const filteredTimeline = (timelineNotes || []).filter(n => {
      if (!filterTag || filterTag === 'semua' || filterTag === 'all') return true;
      const k = (n.kategori || '').toLowerCase();

      if (filterTag === 'Catatan Positif / Prestasi') {
        return k.includes('positif') || k.includes('prestasi');
      }
      if (filterTag === 'Catatan Perilaku / Pelanggaran') {
        return k.includes('pelanggaran') || k.includes('perilaku');
      }
      if (filterTag === 'Bimbingan / Remedial') {
        return k.includes('bimbingan') || k.includes('remedial');
      }
      if (filterTag === 'Dispensasi / Lomba') {
        return k.includes('dispensasi') || k.includes('lomba');
      }
      if (filterTag === 'Izin Khusus / Dinas Luar') {
        return k.includes('izin') || k.includes('dinas');
      }
      if (filterTag === 'Catatan Lainnya') {
        return k.includes('lainnya') || k === 'presensi' || k === 'ceklis siswa' || k === 'penilaian tugas';
      }
      return n.kategori === filterTag;
    });

    if (filteredTimeline.length === 0) {
      return `
        <div class="text-center py-10 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <i data-lucide="message-square-dashed" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
          <p class="font-semibold text-slate-600">Belum ada catatan untuk filter kategori ini.</p>
          <p class="text-[11px] text-slate-400 mt-1">Klik tombol "+ Tambah Catatan Sikap" di atas untuk menambahkan evaluasi siswa.</p>
        </div>
      `;
    }

    return filteredTimeline.map(note => {
      let badgeColor = 'bg-slate-100 text-slate-800 border-slate-300';
      let badgeLabel = note.kategori || 'Catatan';
      const kat = (note.kategori || '').toLowerCase();

      if (kat.includes('positif') || kat.includes('prestasi')) {
        badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
        badgeLabel = '🌟 ' + (note.kategori || 'Positif / Prestasi');
      } else if (kat.includes('pelanggaran') || kat.includes('perilaku')) {
        badgeColor = 'bg-rose-100 text-rose-900 border-rose-300';
        badgeLabel = '⚠️ ' + (note.kategori || 'Perilaku / Pelanggaran');
      } else if (kat.includes('bimbingan') || kat.includes('remedial')) {
        badgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
        badgeLabel = '📘 ' + (note.kategori || 'Bimbingan / Remedial');
      } else if (kat.includes('dispensasi') || kat.includes('lomba')) {
        badgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
        badgeLabel = '🏆 ' + (note.kategori || 'Dispensasi / Lomba');
      } else if (kat.includes('izin') || kat.includes('dinas')) {
        badgeColor = 'bg-sky-100 text-sky-900 border-sky-300';
        badgeLabel = '📄 ' + (note.kategori || 'Izin Khusus / Dinas Luar');
      } else if (note.kategori === 'Presensi') {
        badgeColor = 'bg-blue-100 text-blue-900 border-blue-300';
        badgeLabel = '📝 Presensi Harian';
      } else if (note.kategori === 'Ceklis Siswa' || note.kategori === 'Penilaian Tugas') {
        badgeColor = 'bg-teal-100 text-teal-900 border-teal-300';
        badgeLabel = '📋 ' + (note.kategori === 'Ceklis Siswa' ? 'Ceklis Catatan' : 'Nilai Tugas');
      }

      return `
        <div class="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-xs transition space-y-2">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}">
                ${badgeLabel}
              </span>
              <span class="font-bold text-slate-800 text-xs sm:text-sm">${note.judul}</span>
            </div>

            <div class="flex items-center gap-2 text-xs text-slate-400">
              <span><i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i>${note.tanggal}</span>
              <span>•</span>
              <span class="font-medium text-slate-500">${note.sumber}</span>
            </div>
          </div>

          <p class="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
            ${note.deskripsi}
          </p>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // HELPER: RENDER INTERACTIVE SVG PERFORMANCE CHART
  // =========================================================================
  function renderPerformanceChartSVG(taskList) {
    const validTasks = (taskList || []).filter(t => t.nilai !== null && t.nilai !== undefined && !isNaN(t.nilai) && !t.isBebas).slice(-10);

    if (validTasks.length === 0) {
      return `
        <div class="h-44 flex items-center justify-center text-slate-400 text-xs font-medium">
          Belum ada data nilai tugas untuk digrafikkan.
        </div>
      `;
    }

    const width = 760;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 35, left: 40 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const minScore = 40;
    const maxScore = 100;

    const points = [];
    const avgPoints = [];

    const stepX = validTasks.length > 1 ? chartW / (validTasks.length - 1) : chartW / 2;

    validTasks.forEach((t, i) => {
      const x = padding.left + (validTasks.length > 1 ? i * stepX : chartW / 2);
      
      // Nilai Siswa
      if (t.nilai !== null) {
        const valClamped = Math.max(minScore, Math.min(maxScore, t.nilai));
        const y = padding.top + chartH - ((valClamped - minScore) / (maxScore - minScore)) * chartH;
        points.push({ x, y, val: t.nilai, label: t.judul_tugas });
      }

      // Rata-rata Kelas
      if (t.avgKelas) {
        const valAvgClamped = Math.max(minScore, Math.min(maxScore, t.avgKelas));
        const yAvg = padding.top + chartH - ((valAvgClamped - minScore) / (maxScore - minScore)) * chartH;
        avgPoints.push({ x, y: yAvg, val: t.avgKelas });
      }
    });

    const kkmY = padding.top + chartH - ((75 - minScore) / (maxScore - minScore)) * chartH;

    // SVG Line Paths
    const pathStudent = points.length > 1 ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';
    const pathAvg = avgPoints.length > 1 ? avgPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';

    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-44 select-none">
        <!-- Grid Lines & Labels -->
        <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="#e2e8f0" stroke-width="1" />
        <text x="${padding.left - 8}" y="${padding.top + 4}" text-anchor="end" font-size="10" fill="#94a3b8" font-weight="600">100</text>

        <line x1="${padding.left}" y1="${padding.top + chartH / 2}" x2="${width - padding.right}" y2="${padding.top + chartH / 2}" stroke="#e2e8f0" stroke-width="1" />
        <text x="${padding.left - 8}" y="${padding.top + chartH / 2 + 4}" text-anchor="end" font-size="10" fill="#94a3b8" font-weight="600">70</text>

        <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${padding.left - 8}" y="${padding.top + chartH + 4}" text-anchor="end" font-size="10" fill="#94a3b8" font-weight="600">40</text>

        <!-- KKM Line (Dashed Red) -->
        <line x1="${padding.left}" y1="${kkmY}" x2="${width - padding.right}" y2="${kkmY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
        <text x="${width - padding.right + 4}" y="${kkmY + 3}" font-size="9" fill="#ef4444" font-weight="bold">KKM 75</text>

        <!-- Average Class Line (Slate) -->
        ${pathAvg ? `<path d="${pathAvg}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linejoin="round" />` : ''}

        <!-- Student Line (Emerald) -->
        ${pathStudent ? `<path d="${pathStudent}" fill="none" stroke="#059669" stroke-width="3" stroke-linejoin="round" />` : ''}

        <!-- Student Points & Value Bubbles -->
        ${points.map((p, idx) => `
          <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#ffffff" stroke="#059669" stroke-width="2.5" />
          <rect x="${p.x - 14}" y="${p.y - 20}" width="28" height="15" rx="4" fill="#047857" />
          <text x="${p.x}" y="${p.y - 9}" text-anchor="middle" font-size="9" fill="#ffffff" font-weight="bold">${p.val}</text>
          
          <!-- X Axis Labels (T1, T2, etc.) -->
          <text x="${p.x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="600">T${idx + 1}</text>
        `).join('')}
      </svg>
    `;
  }

  // =========================================================================
  // SUBTAB SWITCHING & IN-MEMORY FILTERING
  // =========================================================================
  function switchSubTab(tabName) {
    localState.activeSubTab = tabName;

    // Update Nav Buttons Styles
    container.querySelectorAll('.rekap-subtab-btn').forEach(btn => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab === tabName) {
        btn.className = 'rekap-subtab-btn px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-xs';
      } else {
        btn.className = 'rekap-subtab-btn px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800';
      }
    });

    // Show/Hide Panels
    const panels = ['presensi', 'nilai', 'timeline', 'pr', 'kelompok'];
    panels.forEach(p => {
      const panelEl = container.querySelector(`#subtab-panel-${p}`);
      if (panelEl) {
        if (p === tabName) {
          panelEl.classList.remove('hidden');
        } else {
          panelEl.classList.add('hidden');
        }
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function filterTimeline(tag) {
    localState.timelineFilterTag = tag;

    // Update filter buttons styling
    const filterContainer = container.querySelector('#rekap-siswa-timeline-filters');
    if (filterContainer) {
      filterContainer.querySelectorAll('.btn-timeline-filter').forEach(btn => {
        const btnTag = btn.getAttribute('data-tag');
        if (btnTag === tag || (!tag && btnTag === 'semua')) {
          if (btnTag === 'Catatan Positif / Prestasi') btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-amber-600 text-white font-bold shadow-xs';
          else if (btnTag === 'Catatan Perilaku / Pelanggaran') btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-rose-600 text-white font-bold shadow-xs';
          else if (btnTag === 'Bimbingan / Remedial') btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-teal-600 text-white font-bold shadow-xs';
          else if (btnTag === 'Dispensasi / Lomba') btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-indigo-600 text-white font-bold shadow-xs';
          else if (btnTag === 'Izin Khusus / Dinas Luar') btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-sky-600 text-white font-bold shadow-xs';
          else if (btnTag === 'Catatan Lainnya') btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-slate-700 text-white font-bold shadow-xs';
          else btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-emerald-600 text-white font-bold shadow-xs';
        } else {
          btn.className = 'btn-timeline-filter px-3 py-1.5 rounded-xl transition bg-slate-100 text-slate-600 hover:bg-slate-200';
        }
      });
    }

    // Re-render timeline list
    const timelineListEl = container.querySelector('#rekap-siswa-timeline-list');
    if (timelineListEl && localState.rekapData) {
      timelineListEl.innerHTML = renderTimelineListHTML(localState.rekapData.timelineNotes || [], tag);
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // =========================================================================
  // PRINT & EXPORT FUNCTIONS
  // =========================================================================
  function printRiwayatKehadiranIndividual() {
    const siswa = localState.rekapData?.siswa;
    const kelas = localState.rekapData?.kelas || localState.siswaList.find(s => s.id === siswa?.id)?.kelas || {};
    const presensi = localState.rekapData?.presensi;
    if (!siswa || !presensi) return;

    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Kehadiran - ${siswa.nama_lengkap} (${kelas.nama_kelas || ''})</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 16px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 12px; font-weight: bold; }
            .profile-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; }
            .summary-box { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 15px; text-align: center; }
            .summary-card { border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; }
            .summary-card strong { font-size: 15px; display: block; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #444; padding: 6px 8px; }
            th { background: #f0f0f0; text-align: center; }
            .text-center { text-align: center; }
            .status-hadir { font-weight: bold; color: #047857; }
            .status-sakit { font-weight: bold; color: #b45309; }
            .status-izin { font-weight: bold; color: #0369a1; }
            .status-alfa { font-weight: bold; color: #b91c1c; }
            .footer-sign { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; }
            .sign-col { text-align: center; width: 35%; }
            .sign-space { height: 60px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${school.logo_url ? `<img src="${school.logo_url}" style="position: absolute; left: 0; top: 0; width: 55px; height: 55px; object-fit: contain;">` : ''}
            <div style="${school.logo_url ? 'padding: 0 60px;' : ''}">
              <h2>${school.instansi_induk || 'PEMERINTAH PROVINSI SULAWESI SELATAN'}</h2>
              <h3>${school.dinas ? school.dinas + ' • ' : ''}${school.nama_sekolah || 'SMKN 1 BANTAENG'}</h3>
              <p class="address">${school.alamat || ''} ${school.telepon ? '• Telp: ' + school.telepon : ''} ${school.website ? '• Web: ' + school.website : ''}</p>
              <p class="title">LAPORAN REKAPITULASI KEHADIRAN INDIVIDUAL SISWA</p>
            </div>
          </div>

          <div class="profile-box">
            <div>
              <strong>Nama Lengkap:</strong> ${siswa.nama_lengkap}<br>
              <strong>NISN:</strong> ${siswa.nisn || '-'}<br>
              <strong>Kelas / Jurusan:</strong> ${kelas.nama_kelas || ''}${kelas.jurusan ? ` (${kelas.jurusan})` : ''}
            </div>
            <div style="text-align: right;">
              <strong>No. Absen:</strong> ${siswa.nomor_absen || '-'}<br>
              <strong>Jenis Kelamin:</strong> ${siswa.jenis_kelamin === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}<br>
              <strong>Guru Pengampu:</strong> ${profil.nama_guru || 'Guru Mapel'}
            </div>
          </div>

          <!-- Ringkasan Statistik Presensi -->
          <div class="summary-box">
            <div class="summary-card" style="background: #f8fafc;">
              <span>Total Pertemuan</span>
              <strong>${presensi.totalSesi} Sesi</strong>
            </div>
            <div class="summary-card" style="background: #ecfdf5; border-color: #a7f3d0;">
              <span style="color: #065f46;">Hadir (H)</span>
              <strong style="color: #047857;">${presensi.hadir}</strong>
            </div>
            <div class="summary-card" style="background: #fffbeb; border-color: #fde68a;">
              <span style="color: #92400e;">Sakit (S)</span>
              <strong style="color: #b45309;">${presensi.sakit}</strong>
            </div>
            <div class="summary-card" style="background: #f0f9ff; border-color: #bae6fd;">
              <span style="color: #075985;">Izin (I)</span>
              <strong style="color: #0369a1;">${presensi.izin}</strong>
            </div>
            <div class="summary-card" style="background: #fef2f2; border-color: #fecaca;">
              <span style="color: #991b1b;">Alfa (A)</span>
              <strong style="color: #b91c1c;">${presensi.alfa}</strong>
            </div>
          </div>

          <p style="font-weight: bold; margin: 10px 0 5px; font-size: 12px;">
            Persentase Kehadiran: <span style="color: ${presensi.persentase >= 85 ? '#047857' : presensi.persentase >= 75 ? '#b45309' : '#b91c1c'};">${presensi.persentase}%</span>
          </p>

          <!-- Tabel Riwayat Kehadiran Sesi -->
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 85px;">Tanggal</th>
                <th style="width: 160px;">Mata Pelajaran</th>
                <th style="width: 80px;">Status</th>
                <th>Materi Pembelajaran / Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${presensi.riwayat.length === 0 ? `
                <tr>
                  <td colspan="5" class="text-center">Belum ada riwayat sesi kehadiran tercatat untuk siswa ini.</td>
                </tr>
              ` : presensi.riwayat.map((r, idx) => {
                let statusClass = 'status-hadir';
                if (r.status === 'Sakit') statusClass = 'status-sakit';
                else if (r.status === 'Izin') statusClass = 'status-izin';
                else if (r.status === 'Alfa') statusClass = 'status-alfa';

                const keterangan = r.catatan ? `${r.materi || '-'} (Catatan: ${r.catatan})` : (r.materi || '-');

                return `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td class="text-center">${r.tanggal}</td>
                    <td>${r.mapel}</td>
                    <td class="text-center ${statusClass}">${r.status}</td>
                    <td>${keterangan}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer-sign">
            <div class="sign-col">
              <p>Mengetahui,<br>Orang Tua / Wali Siswa</p>
              <div class="sign-space"></div>
              <p><u>_________________________</u><br>Orang Tua / Wali</p>
            </div>
            <div class="sign-col">
              <p>${profil.kota || 'Bantaeng'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>Guru Mata Pelajaran</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_guru || 'Guru Mapel'}</strong></u><br>${profil.nip_guru ? 'NIP. ' + profil.nip_guru : 'NIP. -'}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  }

  function exportRiwayatKehadiranExcel() {
    const siswa = localState.rekapData?.siswa;
    const kelas = localState.rekapData?.kelas || localState.siswaList.find(s => s.id === siswa?.id)?.kelas || {};
    const presensi = localState.rekapData?.presensi;
    if (!siswa || !presensi) return;

    if (!window.XLSX) {
      showToast('Library XLSX belum termuat!', 'error');
      return;
    }
    const profil = db.getProfilGuru();

    const rows = [
      ['LAPORAN REKAPITULASI KEHADIRAN INDIVIDUAL SISWA'],
      [profil.nama_sekolah || 'UPT SMKN 1 BANTAENG'],
      [''],
      ['Nama Siswa', siswa.nama_lengkap, '', 'Kelas / Jurusan', `${kelas.nama_kelas || ''}${kelas.jurusan ? ` (${kelas.jurusan})` : ''}`],
      ['NISN', siswa.nisn || '-', '', 'No. Absen', siswa.nomor_absen || '-'],
      ['Jenis Kelamin', siswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan', '', 'Guru Pengampu', profil.nama_guru || 'Guru Mapel'],
      ['Tanggal Unduh', new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), '', 'Persentase Kehadiran', `${presensi.persentase}%`],
      [''],
      ['RINGKASAN KEHADIRAN:'],
      ['Total Sesi Pertemuan', `${presensi.totalSesi} Sesi`],
      ['Jumlah Hadir (H)', presensi.hadir],
      ['Jumlah Sakit (S)', presensi.sakit],
      ['Jumlah Izin (I)', presensi.izin],
      ['Jumlah Alfa (A)', presensi.alfa],
      [''],
      ['NO', 'TANGGAL', 'MATA PELAJARAN', 'STATUS KEHADIRAN', 'MATERI PEMBELAJARAN', 'CATATAN KHUSUS']
    ];

    if (presensi.riwayat.length === 0) {
      rows.push(['-', '-', 'Belum ada data sesi presensi', '-', '-', '-']);
    } else {
      presensi.riwayat.forEach((r, idx) => {
        rows.push([
          idx + 1,
          r.tanggal,
          r.mapel,
          r.status,
          r.materi || '-',
          r.catatan || '-'
        ]);
      });
    }

    rows.push(['']);
    rows.push(['', '', '', '', 'Mengetahui,', '', `${profil.kota || 'Bantaeng'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`]);
    rows.push(['', '', '', '', 'Kepala Sekolah,', '', 'Guru Mata Pelajaran,']);
    rows.push(['']);
    rows.push(['']);
    rows.push(['', '', '', '', profil.nama_kepsek || 'Kepala Sekolah', '', profil.nama_guru || 'Guru Mapel']);
    rows.push(['', '', '', '', profil.nip_kepsek ? 'NIP. ' + profil.nip_kepsek : 'NIP. -', '', profil.nip_guru ? 'NIP. ' + profil.nip_guru : 'NIP. -']);

    const ws = window.XLSX.utils.aoa_to_sheet(rows);

    // Styling column widths
    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 14 }, // Tanggal
      { wch: 28 }, // Mapel
      { wch: 18 }, // Status
      { wch: 40 }, // Materi
      { wch: 25 }  // Catatan
    ];

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Kehadiran Siswa');

    const cleanNama = siswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Kehadiran_${cleanNama}_${(kelas.nama_kelas || 'Kelas').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    window.XLSX.writeFile(wb, filename);
    showToast(`File Excel ${filename} berhasil diunduh!`, 'success');
  }

  function printRaporPortofolioLengkap() {
    const siswa = localState.rekapData?.siswa;
    const kelas = localState.rekapData?.kelas || localState.siswaList.find(s => s.id === siswa?.id)?.kelas || {};
    const presensi = localState.rekapData?.presensi;
    const akademik = localState.rekapData?.akademik;
    const timelineNotes = localState.rekapData?.timelineNotes || [];
    if (!siswa || !presensi || !akademik) return;

    let predikatLabel = 'Belum Ada Data';
    if (akademik && presensi) {
      if (akademik.rataRataNilai >= 85 && presensi.persentase >= 90) {
        predikatLabel = '🌟 Sangat Baik & Berprestasi';
      } else if (akademik.rataRataNilai >= (akademik.riwayatTugas?.[0]?.kkm || 75) && presensi.persentase >= 80) {
        predikatLabel = '🟢 Tuntas & Memenuhi KKM';
      } else if (presensi.alfa >= 3 || (akademik.tugasRemedi > 0 && akademik.tugasRemedi > akademik.tugasTuntas)) {
        predikatLabel = '⚠️ Perlu Perhatian & Remedial';
      } else {
        predikatLabel = '🔵 Cukup (Perlu Ditingkatkan)';
      }
    }

    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Rapor Portofolio - ${siswa.nama_lengkap}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; font-size: 11px; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 15px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 12px; font-weight: bold; }
            .profile-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 12px; font-size: 10px; }
            th, td { border: 1px solid #444; padding: 5px 6px; }
            th { background: #f0f0f0; text-align: center; font-weight: bold; }
            .text-center { text-align: center; }
            .section-title { font-weight: bold; font-size: 11px; margin-top: 10px; color: #047857; text-transform: uppercase; }
            .footer-sign { margin-top: 25px; display: flex; justify-content: space-between; font-size: 11px; }
            .sign-col { text-align: center; width: 35%; }
            .sign-space { height: 50px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${school.logo_url ? `<img src="${school.logo_url}" style="position: absolute; left: 0; top: 0; width: 55px; height: 55px; object-fit: contain;">` : ''}
            <div style="${school.logo_url ? 'padding: 0 60px;' : ''}">
              <h2>${school.instansi_induk || 'PEMERINTAH PROVINSI SULAWESI SELATAN'}</h2>
              <h3>${school.dinas ? school.dinas + ' • ' : ''}${school.nama_sekolah || 'SMKN 1 BANTAENG'}</h3>
              <p class="address">${school.alamat || ''} ${school.telepon ? '• Telp: ' + school.telepon : ''} ${school.website ? '• Web: ' + school.website : ''}</p>
              <p class="title">LAPORAN PORTOFOLIO & REKAPITULASI CAPAIAN SISWA</p>
            </div>
          </div>

          <div class="profile-box">
            <div>
              <strong>Nama Lengkap:</strong> ${siswa.nama_lengkap}<br>
              <strong>NISN:</strong> ${siswa.nisn || '-'}<br>
              <strong>Kelas / Jurusan:</strong> ${kelas.nama_kelas || ''}${kelas.jurusan ? ` (${kelas.jurusan})` : ''}
            </div>
            <div style="text-align: right;">
              <strong>No. Absen:</strong> ${siswa.nomor_absen || '-'}<br>
              <strong>Jenis Kelamin:</strong> ${siswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}<br>
              <strong>Predikat:</strong> ${predikatLabel}
            </div>
          </div>

          <div class="section-title">I. REKAPITULASI KEHADIRAN (PRESENSI)</div>
          <table>
            <thead>
              <tr>
                <th>Total Pertemuan</th>
                <th>Hadir</th>
                <th>Sakit</th>
                <th>Izin</th>
                <th>Alfa</th>
                <th>Persentase Kehadiran</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center">${presensi.totalSesi} Sesi</td>
                <td class="text-center"><strong>${presensi.hadir}</strong></td>
                <td class="text-center">${presensi.sakit}</td>
                <td class="text-center">${presensi.izin}</td>
                <td class="text-center">${presensi.alfa}</td>
                <td class="text-center"><strong>${presensi.persentase}%</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">II. RIWAYAT CAPAIAN NILAI TUGAS & ULANGAN</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th>Mata Pelajaran</th>
                <th>Judul Tugas / Materi</th>
                <th style="width: 70px;">Tanggal</th>
                <th style="width: 45px;">KKM</th>
                <th style="width: 50px;">Nilai</th>
                <th style="width: 65px;">Status</th>
                <th>Catatan Guru</th>
              </tr>
            </thead>
            <tbody>
              ${akademik.riwayat.length === 0 ? `<tr><td colspan="8" class="text-center">Belum ada nilai tugas.</td></tr>` : akademik.riwayat.map((t, i) => `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td>${t.mapel}</td>
                  <td>${t.judul_tugas}</td>
                  <td class="text-center">${t.tanggal}</td>
                  <td class="text-center">${t.kkm}</td>
                  <td class="text-center"><strong>${t.nilai ?? '-'}</strong></td>
                  <td class="text-center">${t.nilai !== null ? (t.isTuntas ? 'Tuntas' : 'Remedial') : '-'}</td>
                  <td>${t.catatan || '-'}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="5" style="text-align: right;">RATA-RATA NILAI KESELURUHAN:</td>
                <td class="text-center">${akademik.rataRataNilai}</td>
                <td class="text-center">${akademik.tugasTuntas}/${akademik.totalTugas} Tuntas</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">III. CATATAN PERILAKU & KEGIATAN SISWA</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th style="width: 75px;">Tanggal</th>
                <th style="width: 85px;">Kategori</th>
                <th>Uraian Catatan Khusus Guru</th>
              </tr>
            </thead>
            <tbody>
              ${timelineNotes.slice(0, 5).map((n, i) => `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td class="text-center">${n.tanggal}</td>
                  <td class="text-center font-bold">${n.tag || n.kategori}</td>
                  <td>${n.judul}: ${n.deskripsi}</td>
                </tr>
              `).join('') || `<tr><td colspan="4" class="text-center">Tidak ada catatan pelanggaran/khusus.</td></tr>`}
            </tbody>
          </table>

          <div class="footer-sign">
            <div class="sign-col">
              <p>Mengetahui,<br>Orang Tua / Wali Siswa</p>
              <div class="sign-space"></div>
              <p><u>_________________________</u><br>Orang Tua / Wali</p>
            </div>
            <div class="sign-col">
              <p>${profil.kota || 'Bantaeng'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>Guru Mata Pelajaran</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_guru || 'Guru Mapel'}</strong></u><br>${profil.nip_guru ? 'NIP. ' + profil.nip_guru : 'NIP. -'}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  }

  // =========================================================================
  // BIND HEADER ACTIONS EVENTS
  // =========================================================================
  function bindHeaderActionEvents() {
    // Action Buttons: Print Laporan Catatan & Tagihan Tugas Siswa
    container.querySelector('#btn-print-laporan-catatan-tugas')?.addEventListener('click', async () => {
      const siswa = localState.rekapData?.siswa;
      const kelas = localState.rekapData?.kelas || localState.siswaList.find(s => s.id === siswa?.id)?.kelas || {};
      if (!siswa) return;

      let modalDiv = document.querySelector('#modal-root');
      if (!modalDiv) {
        modalDiv = document.createElement('div');
        modalDiv.id = 'modal-root';
        document.body.appendChild(modalDiv);
      }
      await renderLaporanSiswaModal(modalDiv, {
        siswa,
        kelas,
        rekapData: localState.rekapData,
        academicYear: localState.currentYear,
        onClose: () => (modalDiv.innerHTML = ''),
        showToast
      });
    });

    // Action Buttons: Print Kehadiran
    container.querySelector('#btn-print-presensi-siswa')?.addEventListener('click', printRiwayatKehadiranIndividual);

    // Action Buttons: Export Excel Kehadiran
    container.querySelector('#btn-export-excel-siswa')?.addEventListener('click', exportRiwayatKehadiranExcel);

    // Action Buttons: Print Rapor Lengkap
    container.querySelector('#btn-print-rapor')?.addEventListener('click', printRaporPortofolioLengkap);

    // Action Buttons: Salin Format WhatsApp
    container.querySelector('#btn-export-wa')?.addEventListener('click', () => {
      const siswa = localState.rekapData?.siswa;
      const kelas = localState.rekapData?.kelas || localState.siswaList.find(s => s.id === siswa?.id)?.kelas || {};
      const presensi = localState.rekapData?.presensi;
      const akademik = localState.rekapData?.akademik;
      if (!siswa || !presensi || !akademik) return;

      const profil = db.getProfilGuru();

      let predikatLabel = 'Belum Ada Data';
      if (akademik.rataRataNilai >= 85 && presensi.persentase >= 90) {
        predikatLabel = '🌟 Sangat Baik & Berprestasi';
      } else if (akademik.rataRataNilai >= (akademik.riwayatTugas?.[0]?.kkm || 75) && presensi.persentase >= 80) {
        predikatLabel = '🟢 Tuntas & Memenuhi KKM';
      } else if (presensi.alfa >= 3 || (akademik.tugasRemedi > 0 && akademik.tugasRemedi > akademik.tugasTuntas)) {
        predikatLabel = '⚠️ Perlu Perhatian & Remedial';
      } else {
        predikatLabel = '🔵 Cukup (Perlu Ditingkatkan)';
      }

      const textWA = `📋 *LAPORAN CAPAIAN BELAJAR SISWA*\n*${profil.nama_sekolah || 'UPT SMKN 1 BANTAENG'}*\n\n` +
        `👤 *Nama:* ${siswa.nama_lengkap}\n` +
        `🏫 *Kelas:* ${kelas.nama_kelas || ''}\n` +
        `🔢 *No. Absen / NISN:* ${siswa.nomor_absen || '-'} / ${siswa.nisn || '-'}\n` +
        `👨‍🏫 *Guru Mapel:* ${profil.nama_guru || 'Guru Mapel'}\n\n` +
        `📊 *PRESENSI KEHADIRAN:*\n` +
        `• Total Pertemuan: ${presensi.totalSesi} Sesi\n` +
        `• Kehadiran: ${presensi.persentase}% (H: ${presensi.hadir}, S: ${presensi.sakit}, I: ${presensi.izin}, A: ${presensi.alfa})\n\n` +
        `🎯 *CAPAIAN AKADEMIK:*\n` +
        `• Rata-rata Nilai Tugas: ${akademik.rataRataNilai || '-'}\n` +
        `• Ketuntasan: ${akademik.tugasTuntas} Tuntas / ${akademik.totalTugas} Tugas\n` +
        `• Status: *${predikatLabel}*\n\n` +
        `_Pemberitahuan resmi perkembangan belajar siswa. Terima kasih!_`;

      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textWA).then(() => {
          showToast('Laporan ringkasan siswa berhasil disalin ke clipboard!', 'success');
        }).catch(() => {
          if (typeof prompt === 'function') prompt('Salin teks laporan WA berikut:', textWA);
        });
      } else if (typeof prompt === 'function') {
        prompt('Salin teks laporan WA berikut:', textWA);
      }
    });
  }

  // =========================================================================
  // BIND DYNAMIC PORTOFOLIO EVENTS (TABS, MODALS, FILTERS)
  // =========================================================================
  function bindDynamicPortofolioEvents() {
    const siswa = localState.rekapData?.siswa;
    const kelas = localState.rekapData?.kelas || localState.siswaList.find(s => s.id === siswa?.id)?.kelas || {};

    // Subtab Switches (In-place tabs toggle)
    container.querySelectorAll('.rekap-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (tabName) switchSubTab(tabName);
      });
    });

    // Timeline Tag Filters
    container.querySelectorAll('.btn-timeline-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        filterTimeline(tag);
      });
    });

    // Subtab action buttons (Print & Excel)
    container.querySelectorAll('.btn-sub-print-presensi').forEach(btn => {
      btn.addEventListener('click', printRiwayatKehadiranIndividual);
    });

    container.querySelectorAll('.btn-sub-export-excel').forEach(btn => {
      btn.addEventListener('click', exportRiwayatKehadiranExcel);
    });

    // Action Button: Quick Add Catatan Sikap Modal
    container.querySelector('#btn-quick-add-sikap')?.addEventListener('click', () => {
      if (!siswa) return;

      const modalDiv = document.createElement('div');
      modalDiv.innerHTML = `
        <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div class="flex items-center gap-2">
                <div class="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl">
                  <i data-lucide="award" class="w-5 h-5"></i>
                </div>
                <div>
                  <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Tambah Catatan Sikap / Perilaku</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Siswa: <strong>${siswa.nama_lengkap}</strong> (${kelas.nama_kelas || ''})</p>
                </div>
              </div>
              <button id="btn-close-quick-sikap" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <i data-lucide="x" class="w-5 h-5"></i>
              </button>
            </div>

            <form id="form-quick-sikap" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori Catatan <span class="text-rose-500">*</span></label>
                ${renderKategoriKegiatanComboboxHTML({
                  id: 'quick-sikap-kategori',
                  selectedValue: 'Catatan Positif / Prestasi',
                  size: 'sm'
                })}
              </div>

              <div>
                <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tanggal Berlaku</label>
                ${renderDatePickerHTML({
                  id: 'quick-sikap-tanggal',
                  value: new Date().toISOString().split('T')[0]
                })}
              </div>

              <div>
                <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Judul / Uraian Ringkas <span class="text-rose-500">*</span></label>
                <input type="text" id="quick-sikap-judul" required placeholder="Contoh: Sangat aktif memimpin diskusi praktikum" class="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500">
              </div>

              <div>
                <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Keterangan Tambahan (Opsional)</label>
                <textarea id="quick-sikap-deskripsi" rows="3" placeholder="Tuliskan catatan evaluasi sikap atau rincian pembinaan..." class="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"></textarea>
              </div>

              <div class="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" id="btn-cancel-quick-sikap" class="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold px-4 py-2 rounded-xl transition">
                  Batal
                </button>
                <button type="submit" class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5">
                  <i data-lucide="save" class="w-4 h-4"></i>
                  <span>Simpan Catatan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(modalDiv);
      if (window.lucide) window.lucide.createIcons();
      initDatePicker(modalDiv, {
        id: 'quick-sikap-tanggal',
        value: new Date().toISOString().split('T')[0]
      });
      initKategoriKegiatanCombobox(modalDiv, {
        id: 'quick-sikap-kategori',
        selectedValue: 'Catatan Positif / Prestasi'
      });

      const closeModal = () => modalDiv.remove();
      modalDiv.querySelector('#btn-close-quick-sikap')?.addEventListener('click', closeModal);
      modalDiv.querySelector('#btn-cancel-quick-sikap')?.addEventListener('click', closeModal);

      modalDiv.querySelector('#form-quick-sikap')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kategori = modalDiv.querySelector('#quick-sikap-kategori').value;
        const tanggal = modalDiv.querySelector('#quick-sikap-tanggal').value;
        const judul = modalDiv.querySelector('#quick-sikap-judul').value.trim();
        const keterangan = modalDiv.querySelector('#quick-sikap-deskripsi').value.trim();

        if (!judul) {
          showToast('Judul catatan wajib diisi!', 'error');
          return;
        }

        try {
          await db.addKegiatanSiswa({
            siswa_id: siswa.id,
            kelas_id: kelas.id || localState.currentKelasId,
            kategori,
            tanggal,
            judul,
            keterangan
          });

          showToast(`Catatan sikap untuk "${siswa.nama_lengkap}" berhasil disimpan!`, 'success');
          closeModal();
          localState.activeSubTab = 'timeline';
          loadAndRenderStudentData();
        } catch (err) {
          console.error('Gagal menyimpan catatan sikap:', err);
          showToast('Gagal menyimpan catatan sikap: ' + (err.message || 'Error'), 'error');
        }
      });
    });
  }

  // =========================================================================
  // INITIALIZE STATIC CONTROLS (CLASS COMBOBOX & FIRST STUDENT LOAD)
  // =========================================================================
  
  // Selector Kelas (Shadcn Combobox)
  initClassCombobox(container, {
    id: 'rekap-select-kelas',
    kelasList,
    selectedId: localState.currentKelasId,
    size: 'sm',
    onSelect: async (newKId) => {
      if (newKId === localState.currentKelasId) return;
      localState.currentKelasId = newKId;

      // Ambil daftar siswa kelas baru
      try {
        const newSiswaList = await db.getSiswaByKelas(newKId);
        localState.siswaList = newSiswaList || [];
        localState.currentSiswaId = localState.siswaList[0]?.id || '';
        
        // Re-render dropdown siswa
        renderSiswaDropdown();
        // Load data siswa pertama
        loadAndRenderStudentData();
      } catch (err) {
        console.error('Gagal memuat siswa kelas baru:', err);
        showToast('Gagal memuat siswa kelas: ' + err.message, 'error');
      }
    }
  });

  // Render dropdown siswa awal
  renderSiswaDropdown();

  // Load data awal siswa terpilih
  loadAndRenderStudentData();

  if (window.lucide) window.lucide.createIcons();
}
