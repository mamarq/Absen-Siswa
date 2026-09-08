import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
// components/JurnalView.js - Modul Jurnal Mengajar Guru Mapel Terintegrasi Sesi (Partial Update Pattern)
import { db } from '../supabase-client.js';

export async function renderJurnalView(container, state, onStateChange, showToast, onNavigateToAbsen, onOpenModal) {
  // Ambil daftar kelas yang diajar oleh guru aktif (Strict Per-User)
  const currentYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  let kelasList = [];
  let loadError = false;

  try {
    kelasList = await db.getKelasSaya(currentYear);
  } catch (err) {
    console.error('Gagal memuat kelas dari Jadwal Mengajar:', err);
    loadError = true;
    kelasList = [];
  }

  // Handle Error State jika query jadwal gagal
  if (loadError) {
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-rose-300 dark:border-rose-800 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
          <i data-lucide="alert-triangle" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">Gagal Memuat Jadwal</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Gagal memuat kelas dari Jadwal Mengajar untuk Jurnal Mengajar.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

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
            Anda belum memiliki penugasan jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> untuk mengisi Jurnal Mengajar.
          </p>
        </div>
        <div class="pt-2">
          <button id="btn-jurnal-empty-add-jadwal" class="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-teal-600/20 transition inline-flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>+ Buka Jadwal Mengajar</span>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    container.querySelector('#btn-jurnal-empty-add-jadwal')?.addEventListener('click', () => onNavigateToAbsen && onNavigateToAbsen('jadwal'));
    return;
  }

  // Tentukan kelas aktif (default kelas pertama guru jika belum dipilih / tidak valid)
  let currentKelasId = (kelasList.some(k => k.id === state.currentKelasId) ? state.currentKelasId : (kelasList[0]?.id || ''));

  // Ambil daftar mapel yang diajar guru pada kelas terpilih (Strict Per-User & Per-Kelas)
  let mapelList = [];
  try {
    mapelList = await db.getMapelSaya(currentYear, currentKelasId);
  } catch (err) {
    console.error('Gagal memuat mapel saya:', err);
    mapelList = [];
  }

  // Handle Empty State jika pada kelas terpilih tidak ditemukan mapel guru
  if (mapelList.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-slate-300 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <i data-lucide="book-x" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 text-base sm:text-lg">Mata Pelajaran Tidak Ditemukan</h3>
          <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Tidak ditemukan mata pelajaran yang Anda ajar pada kelas terpilih di tahun ajaran <strong>${currentYear}</strong>.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Tentukan mapel aktif:
  // 1. Jika 1 mapel -> auto select
  // 2. Jika >1 mapel -> matching atau mapel pertama
  let currentMapel = '';
  if (mapelList.length === 1) {
    currentMapel = mapelList[0].nama_mapel;
  } else if (mapelList.length > 1) {
    currentMapel = mapelList.some(m => m.nama_mapel === state.currentMapel) ? state.currentMapel : (mapelList[0]?.nama_mapel || '');
  }

  const currentTanggal = state.currentTanggal || new Date().toISOString().split('T')[0];

  // Fetch initial data
  const [existingSesi, allSiswa] = await Promise.all([
    (currentKelasId && currentMapel) ? db.findSesi(currentKelasId, currentMapel, currentTanggal) : Promise.resolve(null),
    currentKelasId ? db.getSiswaByKelas(currentKelasId) : Promise.resolve([])
  ]);

  // =========================================================================
  // LOCAL STATE SETUP (Transient UI state isolated from full re-render)
  // =========================================================================
  const localState = {
    currentYear,
    currentKelasId,
    currentMapel,
    currentTanggal,
    kelasList,
    mapelList,
    existingSesi,
    allSiswa
  };

  // Sync background state properties without triggering global app.render()
  state.currentKelasId = localState.currentKelasId;
  state.currentMapel = localState.currentMapel;
  state.currentTanggal = localState.currentTanggal;

  // Stale Request Protection Tokens
  let kelasRequestVersion = 0;
  let jurnalRequestVersion = 0;

  // Helper Penanda Rekap Kehadiran
  function computeAttendanceSummary(sesi, siswaList) {
    let summary = { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0, listIzinSakit: [] };
    if (sesi && sesi.absensi && sesi.absensi.length > 0) {
      sesi.absensi.forEach(a => {
        summary.total++;
        if (a.status === 'Hadir') summary.hadir++;
        else if (a.status === 'Sakit') {
          summary.sakit++;
          const s = siswaList.find(x => x.id === a.siswa_id);
          if (s) summary.listIzinSakit.push(`${s.nama_lengkap} (Sakit)`);
        } else if (a.status === 'Izin') {
          summary.izin++;
          const s = siswaList.find(x => x.id === a.siswa_id);
          if (s) summary.listIzinSakit.push(`${s.nama_lengkap} (Izin)`);
        } else if (a.status === 'Alfa' || a.status === 'Alpa') {
          summary.alfa++;
          const s = siswaList.find(x => x.id === a.siswa_id);
          if (s) summary.listIzinSakit.push(`${s.nama_lengkap} (Alfa)`);
        }
      });
    }
    return summary;
  }

  function renderAttendanceSummaryHTML(kelasObj, mapelName, tanggalVal, summary) {
    const hasAbsensi = summary.total > 0;
    return `
      <div>
        <span class="text-xs font-medium text-teal-300 uppercase tracking-wider">Rekap Kehadiran Sesi Terkoneksi</span>
        <p class="text-sm font-semibold mt-0.5 text-slate-100">
          ${kelasObj?.nama_kelas || 'Kelas'} • ${mapelName || 'Pilih Mapel'} (${tanggalVal})
        </p>
        ${!hasAbsensi ? `
          <p class="text-xs text-slate-300 mt-1">Belum ada data presensi siswa yang tersimpan pada sesi tanggal ini.</p>
        ` : summary.listIzinSakit.length > 0 ? `
          <p class="text-xs text-amber-300 mt-1 font-medium">
            Ketidakhadiran: ${summary.listIzinSakit.join(', ')}
          </p>
        ` : `
          <p class="text-xs text-emerald-300 mt-1">Semua siswa tercatat hadir.</p>
        `}
      </div>

      <div class="flex items-center gap-2 text-xs font-bold flex-wrap">
        <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
          Hadir: ${summary.hadir} / ${summary.total}
        </span>
        ${summary.sakit > 0 ? `<span class="bg-amber-500/20 text-amber-300 px-2.5 py-1.5 rounded-xl">S: ${summary.sakit}</span>` : ''}
        ${summary.izin > 0 ? `<span class="bg-sky-500/20 text-sky-300 px-2.5 py-1.5 rounded-xl">I: ${summary.izin}</span>` : ''}
        ${summary.alfa > 0 ? `<span class="bg-rose-500/20 text-rose-300 px-2.5 py-1.5 rounded-xl">A: ${summary.alfa}</span>` : ''}
      </div>
    `;
  }

  const initialSummary = computeAttendanceSummary(existingSesi, allSiswa);
  const selectedKelasObj = kelasList.find(k => k.id === currentKelasId);
  const initialJurnal = existingSesi?.jurnal_mengajar || null;

  // =========================================================================
  // MAIN VIEW SHELL RENDERING (Static layout created only once)
  // =========================================================================
  container.innerHTML = `
    <div class="space-y-4 pb-20 max-w-4xl mx-auto">
      
      <!-- Card Konfigurasi Sesi -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <i data-lucide="book-open" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="font-bold text-slate-800 text-base sm:text-lg">Jurnal Mengajar Guru</h2>
              <p class="text-xs text-slate-500">Terhubung langsung dengan sesi absensi mengajar</p>
            </div>
          </div>

          <button id="btn-back-to-absen" class="text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 transition">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>Buka Form Absen</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Pilih Kelas (Shadcn Combobox) -->
          <div id="wrapper-jurnal-select-kelas">
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Kelas</label>
            ${renderClassComboboxHTML({
              id: 'jurnal-select-kelas',
              kelasList: localState.kelasList,
              selectedId: localState.currentKelasId
            })}
          </div>

          <!-- Pilih Mapel (Shadcn Combobox) -->
          <div id="wrapper-jurnal-select-mapel">
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Mata Pelajaran</label>
            ${renderMapelComboboxHTML({
              id: 'jurnal-select-mapel',
              mapelList: localState.mapelList,
              selectedValue: localState.currentMapel,
              size: 'md',
              allowManage: true
            })}
          </div>

          <!-- Pilih Tanggal -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal</label>
            ${renderDatePickerHTML({
              id: 'jurnal-input-tanggal',
              value: localState.currentTanggal,
              includeDayName: true
            })}
          </div>
        </div>
      </div>

      <!-- Ringkasan Kehadiran Sesi Otomatis (Partial Container) -->
      <div id="jurnal-attendance-summary-container" class="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        ${renderAttendanceSummaryHTML(selectedKelasObj, localState.currentMapel, localState.currentTanggal, initialSummary)}
      </div>

      <!-- Form Pengisian Jurnal Mengajar -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4 relative" id="jurnal-form-card">
        
        <!-- Loading Overlay Inline for Form -->
        <div id="jurnal-form-loading" class="hidden absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10">
          <div class="flex items-center gap-2 bg-slate-900 text-white text-xs px-4 py-2 rounded-xl shadow-lg">
            <div class="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Memuat data jurnal sesi...</span>
          </div>
        </div>

        <!-- Materi Pokok -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Materi Pokok / Capaian Pembelajaran <span class="text-rose-500">*</span>
          </label>
          <input type="text" id="jurnal-materi" value="${initialJurnal?.materi_pokok || ''}" placeholder="Contoh: Konfigurasi VLAN & Trunking pada Switch Cisco" class="w-full text-sm font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
        </div>

        <!-- Uraian Kegiatan Pembelajaran -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Uraian Kegiatan Pembelajaran / Praktik
          </label>
          <textarea id="jurnal-kegiatan" rows="4" placeholder="Deskripsikan tahapan pembelajaran (Pendahuluan, Penjelasan Konsep, Praktik Mandiri/Kelompok di Lab, Evaluasi)..." class="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition leading-relaxed">${initialJurnal?.kegiatan_pembelajaran || ''}</textarea>
        </div>

        <!-- Kendala / Refleksi Guru -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Kendala / Catatan Refleksi Guru Mapel
          </label>
          <textarea id="jurnal-kendala" rows="3" placeholder="Catatan kendala teknis, respon siswa, tindak lanjut remedial, atau apresiasi kelas..." class="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition leading-relaxed">${initialJurnal?.kendala_refleksi || ''}</textarea>
        </div>

        <!-- Tombol Aksi -->
        <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs text-slate-400" id="jurnal-status-text">
            ${initialJurnal ? `Terakhir disimpan: ${new Date(initialJurnal.updated_at || Date.now()).toLocaleTimeString('id-ID')}` : 'Jurnal belum disimpan'}
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-clear-jurnal-form" type="button" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition" title="Kosongkan seluruh isian jurnal">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-slate-500"></i>
              <span>Kosongkan Form</span>
            </button>

            <button id="btn-print-jurnal" type="button" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition">
              <i data-lucide="printer" class="w-4 h-4"></i>
              <span>Cetak Lembar Jurnal</span>
            </button>

            <button id="btn-save-jurnal" type="button" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition transform active:scale-95">
              <i data-lucide="save" class="w-4 h-4"></i>
              <span>Simpan Jurnal Mengajar</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  `;

  // =========================================================================
  // DATA RELOADER (Partial Fetch & Targeted DOM Update)
  // =========================================================================
  async function reloadJurnalSesiData() {
    const version = ++jurnalRequestVersion;
    const loadingOverlay = container.querySelector('#jurnal-form-loading');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
      const [sesi, sList] = await Promise.all([
        (localState.currentKelasId && localState.currentMapel)
          ? db.findSesi(localState.currentKelasId, localState.currentMapel, localState.currentTanggal)
          : Promise.resolve(null),
        localState.currentKelasId ? db.getSiswaByKelas(localState.currentKelasId) : Promise.resolve([])
      ]);

      if (version !== jurnalRequestVersion) return; // Stale request protection

      localState.existingSesi = sesi;
      localState.allSiswa = sList;

      // 1. Update Attendance Summary Box
      const summaryContainer = container.querySelector('#jurnal-attendance-summary-container');
      const curKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);
      const summary = computeAttendanceSummary(sesi, sList);

      if (summaryContainer) {
        summaryContainer.innerHTML = renderAttendanceSummaryHTML(curKelasObj, localState.currentMapel, localState.currentTanggal, summary);
      }

      // 2. Update Form Fields in-place
      const inputMateri = container.querySelector('#jurnal-materi');
      const inputKegiatan = container.querySelector('#jurnal-kegiatan');
      const inputKendala = container.querySelector('#jurnal-kendala');
      const statusText = container.querySelector('#jurnal-status-text');

      const j = sesi?.jurnal_mengajar || null;
      if (inputMateri) inputMateri.value = j?.materi_pokok || '';
      if (inputKegiatan) inputKegiatan.value = j?.kegiatan_pembelajaran || '';
      if (inputKendala) inputKendala.value = j?.kendala_refleksi || '';
      if (statusText) {
        statusText.textContent = j
          ? `Terakhir disimpan: ${new Date(j.updated_at || Date.now()).toLocaleTimeString('id-ID')}`
          : 'Jurnal belum disimpan';
      }

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error reloading jurnal sesi data:', err);
    } finally {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  }

  // =========================================================================
  // COMBOBOX & FILTER LOGIC (Partial update without page reload)
  // =========================================================================
  async function handleKelasSelection(newKelasId) {
    if (!newKelasId || newKelasId === localState.currentKelasId) return;

    const requestVer = ++kelasRequestVersion;
    localState.currentKelasId = newKelasId;
    state.currentKelasId = newKelasId;

    try {
      const newMapelList = await db.getMapelSaya(localState.currentYear, newKelasId);
      if (requestVer !== kelasRequestVersion) return; // Stale check

      localState.mapelList = newMapelList;
      
      // Auto-select mapel logic
      let matchingMapel = '';
      if (newMapelList.length === 1) {
        matchingMapel = newMapelList[0].nama_mapel;
      } else if (newMapelList.length > 1) {
        matchingMapel = newMapelList.some(m => m.nama_mapel === localState.currentMapel)
          ? localState.currentMapel
          : (newMapelList[0]?.nama_mapel || '');
      }

      localState.currentMapel = matchingMapel;
      state.currentMapel = matchingMapel;

      initMapelDropdown();
      reloadJurnalSesiData();
    } catch (err) {
      console.error('Error handling class selection:', err);
      showToast(`Gagal memuat mata pelajaran kelas: ${err.message || err}`, 'error');
    }
  }

  function handleMapelSelection(newMapel) {
    if (newMapel === localState.currentMapel) return;
    localState.currentMapel = newMapel;
    state.currentMapel = newMapel;
    reloadJurnalSesiData();
  }

  function handleTanggalSelection(newDate) {
    if (newDate === localState.currentTanggal) return;
    localState.currentTanggal = newDate;
    state.currentTanggal = newDate;
    reloadJurnalSesiData();
  }

  function initMapelDropdown() {
    const wrapMapel = container.querySelector('#wrapper-jurnal-select-mapel');
    if (wrapMapel) {
      wrapMapel.innerHTML = `
        <label class="block text-xs font-semibold text-slate-600 mb-1.5">Mata Pelajaran</label>
        ${renderMapelComboboxHTML({
          id: 'jurnal-select-mapel',
          mapelList: localState.mapelList,
          selectedValue: localState.currentMapel,
          size: 'md',
          allowManage: true
        })}
      `;

      initMapelCombobox(container, {
        id: 'jurnal-select-mapel',
        mapelList: localState.mapelList,
        selectedValue: localState.currentMapel,
        size: 'md',
        allowManage: true,
        onSelect: handleMapelSelection,
        onManage: () => {
          if (onOpenModal) onOpenModal('mapel');
        }
      });
    }
  }

  // Inisialisasi awal Class Combobox & DatePicker
  initClassCombobox(container, {
    id: 'jurnal-select-kelas',
    kelasList: localState.kelasList,
    selectedId: localState.currentKelasId,
    onSelect: handleKelasSelection
  });

  initMapelDropdown();

  initDatePicker(container, {
    id: 'jurnal-input-tanggal',
    value: localState.currentTanggal,
    includeDayName: true,
    onChange: handleTanggalSelection
  });

  // Manage Mapel Modal triggers
  const triggerEditJurnalMapel = () => {
    if (onOpenModal) onOpenModal('edit-mapel', localState.currentMapel);
  };
  container.querySelector('#jurnal-btn-edit-mapel')?.addEventListener('click', triggerEditJurnalMapel);
  container.querySelector('#jurnal-btn-icon-edit-mapel')?.addEventListener('click', triggerEditJurnalMapel);

  container.querySelector('#btn-back-to-absen')?.addEventListener('click', () => {
    onNavigateToAbsen();
  });

  // Tombol Kosongkan Form Manual
  container.querySelector('#btn-clear-jurnal-form')?.addEventListener('click', () => {
    const inputMateri = container.querySelector('#jurnal-materi');
    const inputKegiatan = container.querySelector('#jurnal-kegiatan');
    const inputKendala = container.querySelector('#jurnal-kendala');
    if (inputMateri) inputMateri.value = '';
    if (inputKegiatan) inputKegiatan.value = '';
    if (inputKendala) inputKendala.value = '';
    showToast('Form jurnal telah dikosongkan', 'info');
  });

  // Save Jurnal (In-place save without page refresh)
  container.querySelector('#btn-save-jurnal')?.addEventListener('click', async () => {
    const inputMateri = container.querySelector('#jurnal-materi');
    const inputKegiatan = container.querySelector('#jurnal-kegiatan');
    const inputKendala = container.querySelector('#jurnal-kendala');

    const materi = inputMateri?.value.trim() || '';
    const kegiatan = inputKegiatan?.value.trim() || '';
    const kendala = inputKendala?.value.trim() || '';

    if (!localState.currentKelasId) {
      showToast('Harap pilih kelas terlebih dahulu!', 'error');
      return;
    }

    if (!localState.currentMapel) {
      showToast('Harap pilih mata pelajaran terlebih dahulu!', 'error');
      return;
    }

    if (!materi) {
      showToast('Harap isi materi pokok pembelajaran!', 'error');
      return;
    }

    const sesiData = {
      id: localState.existingSesi?.id || null,
      kelas_id: localState.currentKelasId,
      mapel: localState.currentMapel,
      tanggal: localState.currentTanggal,
    };

    const jurnalData = {
      materi_pokok: materi,
      kegiatan_pembelajaran: kegiatan,
      kendala_refleksi: kendala
    };

    const absensiList = localState.existingSesi?.absensi || [];

    const saveBtn = container.querySelector('#btn-save-jurnal');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Menyimpan...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const res = await db.saveSesi({ sesiData, absensiList, jurnalData });
      if (res.success) {
        // Update local session cache
        if (!localState.existingSesi) {
          localState.existingSesi = {
            id: res.id,
            kelas_id: localState.currentKelasId,
            mapel: localState.currentMapel,
            tanggal: localState.currentTanggal,
            absensi: absensiList,
            jurnal_mengajar: {
              ...jurnalData,
              updated_at: new Date().toISOString()
            }
          };
        } else {
          localState.existingSesi.id = res.id || localState.existingSesi.id;
          localState.existingSesi.jurnal_mengajar = {
            ...jurnalData,
            updated_at: new Date().toISOString()
          };
        }

        const statusText = container.querySelector('#jurnal-status-text');
        if (statusText) statusText.innerHTML = `✓ Tersimpan pukul ${new Date().toLocaleTimeString('id-ID')}`;

        showToast('Jurnal mengajar berhasil disimpan! ✨', 'success');
      } else {
        showToast('Gagal menyimpan jurnal: ' + (res.message || res.error), 'error');
      }
    } catch (err) {
      console.error('Error in saveJurnal handler:', err);
      showToast('Terjadi kesalahan saat menyimpan: ' + (err.message || err), 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Jurnal Mengajar</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  });

  // Cetak Lembar Jurnal
  container.querySelector('#btn-print-jurnal')?.addEventListener('click', () => {
    const materi = container.querySelector('#jurnal-materi')?.value.trim() || '-';
    const kegiatan = container.querySelector('#jurnal-kegiatan')?.value.trim() || '-';
    const kendala = container.querySelector('#jurnal-kendala')?.value.trim() || '-';
    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
    const curKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);
    const summary = computeAttendanceSummary(localState.existingSesi, localState.allSiswa);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Jurnal Mengajar - ${curKelasObj?.nama_kelas || 'Kelas'} (${localState.currentTanggal})</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 16px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 13px; font-weight: bold; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .meta-table td { padding: 6px 10px; border: 1px solid #ddd; }
            .meta-table .label { font-weight: bold; background: #f8fafc; width: 22%; }
            .section-title { font-weight: bold; font-size: 13px; margin: 15px 0 5px; text-transform: uppercase; color: #047857; }
            .content-box { border: 1px solid #cbd5e1; padding: 12px; min-height: 70px; border-radius: 6px; white-space: pre-wrap; line-height: 1.5; }
            .footer-sign { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; }
            .sign-col { text-align: center; width: 40%; }
            .sign-space { height: 70px; }
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
              <p class="title">Jurnal Pembelajaran & Catatan Mengajar Guru Mata Pelajaran</p>
            </div>
          </div>

          <table class="meta-table">
            <tr>
              <td class="label">Nama Guru</td>
              <td>${profil.nama_guru || 'Guru Mapel'}</td>
              <td class="label">Mata Pelajaran</td>
              <td>${localState.currentMapel}</td>
            </tr>
            <tr>
              <td class="label">Kelas / Jurusan</td>
              <td>${curKelasObj?.nama_kelas || 'Kelas'} (${curKelasObj?.jurusan || 'Kejuruan'})</td>
              <td class="label">Hari, Tanggal</td>
              <td>${localState.currentTanggal}</td>
            </tr>
            <tr>
              <td class="label">Kehadiran Siswa</td>
              <td colspan="3">Hadir: ${summary.hadir} | Sakit: ${summary.sakit} | Izin: ${summary.izin} | Alfa: ${summary.alfa} (${summary.total} Siswa)</td>
            </tr>
          </table>

          <div class="section-title">A. MATERI POKOK / CAPAIAN PEMBELAJARAN</div>
          <div class="content-box">${materi}</div>

          <div class="section-title">B. URAIAN KEGIATAN PEMBELAJARAN</div>
          <div class="content-box">${kegiatan}</div>

          <div class="section-title">C. KENDALA / REFLEKSI GURU MAPEL</div>
          <div class="content-box">${kendala}</div>

          <div class="footer-sign">
            <div class="sign-col">
              <p>Mengetahui,<br>Kepala Sekolah / Wakasek</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_kepsek || 'Kepala Sekolah'}</strong></u><br>${profil.nip_kepsek ? 'NIP. ' + profil.nip_kepsek : 'NIP. -'}</p>
            </div>
            <div class="sign-col">
              <p>${profil.kota || 'Bantaeng'}, ${localState.currentTanggal}<br>Guru Mata Pelajaran</p>
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
  });

  if (window.lucide) window.lucide.createIcons();
}
