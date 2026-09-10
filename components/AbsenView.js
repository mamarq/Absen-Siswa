import { renderDatePickerHTML, initDatePicker, formatIndonesianDate, toISODateString } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
// components/AbsenView.js - Modul Form Absensi Siswa Mobile-First
import { db } from '../supabase-client.js';

export async function renderAbsenView(container, state, onStateChange, showToast, onNavigateToJurnal, onOpenModal) {
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
            Gagal memuat kelas dari Jadwal Mengajar.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Handle Empty State jika guru belum memiliki jadwal mengajar di tahun ajaran ini
  if (!kelasList || kelasList.length === 0) {
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-slate-300 dark:border-slate-800 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
          <i data-lucide="calendar-off" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">Belum Ada Jadwal Mengajar</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Belum ada kelas yang dapat dipilih. Silakan isi Jadwal Mengajar terlebih dahulu agar kelas muncul pada menu Absen.
          </p>
        </div>
        <div class="pt-2">
          <button id="btn-empty-add-jadwal" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition inline-flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>+ Buka Jadwal Mengajar</span>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    container.querySelector('#btn-empty-add-jadwal')?.addEventListener('click', () => onNavigateToJurnal && onNavigateToJurnal('jadwal'));
    return;
  }

  // Tentukan kelas aktif (default kelas pertama guru jika belum dipilih / tidak valid)
  const currentKelasId = (kelasList.some(k => k.id === state.currentKelasId) ? state.currentKelasId : (kelasList[0]?.id || ''));

  // Ambil daftar mapel yang diajar guru pada kelas terpilih (Strict Per-User & Per-Kelas)
  let mapelList = [];
  let mapelLoadError = false;

  if (currentKelasId) {
    try {
      mapelList = await db.getMapelSaya(currentYear, currentKelasId);
    } catch (err) {
      console.error('Gagal memuat mata pelajaran dari Jadwal Mengajar:', err);
      mapelLoadError = true;
      mapelList = [];
    }
  }

  // Tentukan mapel aktif:
  // 1. Jika 1 mapel -> auto-select langsung
  // 2. Jika >1 mapel -> pertahankan state.currentMapel jika valid, atau kosongkan ('')
  // 3. Jika 0 mapel / error -> kosongkan ('')
  let currentMapel = '';
  if (!mapelLoadError && mapelList.length === 1) {
    currentMapel = mapelList[0].nama_mapel;
  } else if (!mapelLoadError && mapelList.length > 1) {
    currentMapel = mapelList.some(m => m.nama_mapel === state.currentMapel) ? state.currentMapel : '';
  }

  // Tentukan placeholder & status disabled untuk combobox mapel
  let mapelPlaceholder = 'Pilih Mata Pelajaran';
  let isMapelDisabled = false;

  if (mapelLoadError) {
    mapelPlaceholder = 'Gagal memuat mata pelajaran dari Jadwal Mengajar.';
    isMapelDisabled = true;
  } else if (mapelList.length === 0) {
    mapelPlaceholder = 'Tidak ada mata pelajaran pada Jadwal Mengajar untuk kelas ini.';
    isMapelDisabled = true;
  }

  const currentTanggal = state.currentTanggal || toISODateString(new Date());

  // Ambil data sesi, siswa, kegiatan, checklist, dan jadwal hari ini secara PARALEL
  const [siswaList, kegiatanHariIni, checklistHariIni, existingSesi, jadwalHariIni] = await Promise.all([
    currentKelasId ? db.getSiswaByKelas(currentKelasId) : Promise.resolve([]),
    db.getKegiatanSiswaByTanggal(currentTanggal),
    db.getChecklistHariIni(currentTanggal, currentYear),
    (currentKelasId && currentMapel) ? db.findSesi(currentKelasId, currentMapel, currentTanggal) : Promise.resolve(null),
    db.getJadwalHariIni(currentYear, currentTanggal)
  ]);

  const kegiatanMap = {};
  kegiatanHariIni.forEach(k => {
    if (!kegiatanMap[k.siswa_id]) kegiatanMap[k.siswa_id] = [];
    kegiatanMap[k.siswa_id].push(k);
  });

  const checklistKelasHariIni = checklistHariIni.filter(c => (!c.kelas_id || c.kelas_id === currentKelasId) && !c.is_done);
  
  // Siapkan map status absensi: siswa_id -> { status: 'Hadir'|'Sakit'|'Izin'|'Alfa', catatan: '' }
  let attendanceMap = {};
  if (state.currentAttendanceMap && Object.keys(state.currentAttendanceMap).length > 0) {
    attendanceMap = { ...state.currentAttendanceMap };
  } else if (existingSesi && existingSesi.absensi && existingSesi.absensi.length > 0) {
    existingSesi.absensi.forEach(a => {
      attendanceMap[a.siswa_id] = {
        status: a.status,
        catatan: a.catatan || ''
      };
    });
  } else {
    // Default: Semua Hadir
    siswaList.forEach(s => {
      attendanceMap[s.id] = { status: 'Hadir', catatan: '' };
    });
  }

  // Local State untuk sinkronisasi tanpa full re-render
  const localState = {
    currentKelasId,
    currentMapel,
    currentTanggal,
    currentAttendanceMap: attendanceMap,
    siswaList,
    existingSesi,
    kegiatanMap,
    mapelList,
    jadwalHariIni,
    selectedScheduleId: state.selectedScheduleId || null
  };

  // Sinkronisasi state lokal ke app state (tanpa memicu app.render())
  state.currentKelasId = localState.currentKelasId;
  state.currentMapel = localState.currentMapel;
  state.currentTanggal = localState.currentTanggal;
  state.currentAttendanceMap = localState.currentAttendanceMap;
  state.selectedScheduleId = localState.selectedScheduleId;

  // Versi Request untuk Stale Request Protection
  let kelasRequestVersion = 0;
  let attendanceRequestVersion = 0;

  // Hitung ringkasan status
  function getCounts(list = localState.siswaList) {
    let h = 0, s = 0, i = 0, a = 0;
    (list || []).forEach(sis => {
      const st = localState.currentAttendanceMap[sis.id]?.status || 'Hadir';
      if (st === 'Hadir') h++;
      else if (st === 'Sakit') s++;
      else if (st === 'Izin') i++;
      else if (st === 'Alfa') a++;
    });
    return { h, s, i, a, total: (list || []).length };
  }

  // Helper untuk refresh status counts di UI
  function updateLiveCounters(list = localState.siswaList) {
    const c = getCounts(list);
    const elH = container.querySelector('#stat-h');
    const elS = container.querySelector('#stat-s');
    const elI = container.querySelector('#stat-i');
    const elA = container.querySelector('#stat-a');
    const elTot = container.querySelector('#stat-total');
    if (elH) elH.textContent = c.h;
    if (elS) elS.textContent = c.s;
    if (elI) elI.textContent = c.i;
    if (elA) elA.textContent = c.a;
    if (elTot) elTot.textContent = c.total;
  }

  function updateStickyInfo() {
    const selectedKelasObj = kelasList.find(k => k.id === localState.currentKelasId);
    const stickySession = container.querySelector('#sticky-session-info');
    const stickyTanggal = container.querySelector('#sticky-tanggal-info');
    if (stickySession) {
      const mapelLabel = localState.currentMapel || 'Belum pilih mapel';
      stickySession.innerHTML = `${selectedKelasObj?.nama_kelas || 'Kelas'} • ${mapelLabel}`;
    }
    if (stickyTanggal) {
      stickyTanggal.textContent = `Tanggal: ${localState.currentTanggal}`;
    }
  }

  // Helper: Render HTML Banner Jadwal Mengajar / Sesi (Sesuai Selected Date)
  function renderJadwalBannerHTML(jadwalData, currentKelasId, currentMapel, currentTanggal) {
    const todayIso = toISODateString(new Date());
    const isToday = !jadwalData?.tanggal || jadwalData.tanggal === todayIso;
    const headerTitle = isToday 
      ? `Jadwal Mengajar Hari Ini (${jadwalData?.hari || 'Hari Ini'})` 
      : `Jadwal Mengajar Tanggal Ini (${jadwalData?.hari || ''}${jadwalData?.tanggal ? ', ' + formatIndonesianDate(jadwalData.tanggal) : ''})`;
    const headerSubtitle = isToday
      ? 'Saran jadwal rutin mingguan. Klik tombol untuk memuat kelas & mapel ke form absen.'
      : 'Jadwal rutin untuk tanggal yang dipilih. Klik tombol untuk memuat kelas & mapel ke form absen.';

    const list = jadwalData?.jadwalList || [];

    if (list.length === 0) {
      return `
        <div class="bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs">
          <div class="flex items-center gap-2.5">
            <span class="p-1.5 bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 rounded-lg">
              <i data-lucide="calendar-off" class="w-4 h-4"></i>
            </span>
            <div>
              <span class="font-bold block text-slate-800 dark:text-slate-200">Tidak ada jadwal mengajar pada tanggal ini${jadwalData?.hari ? ` (${jadwalData.hari})` : ''}.</span>
              <span class="text-[11px] text-slate-500 dark:text-slate-400">Guru tidak memiliki jam mengajar yang terdaftar pada hari ini.</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-gradient-to-r from-emerald-900/90 via-teal-900 to-slate-900 text-white p-4 rounded-2xl shadow-xs border border-emerald-700/40 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/30">
              <i data-lucide="calendar-clock" class="w-4 h-4"></i>
            </span>
            <div>
              <span class="text-xs font-black tracking-tight block">${headerTitle}</span>
              <span class="text-[10px] text-emerald-200/80">${headerSubtitle}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
          ${list.map(j => {
            const isActive = j.kelas_id === currentKelasId && j.mapel === currentMapel && jadwalData.tanggal === currentTanggal;
            const mulaiTrim = (j.jam_mulai || '').substring(0, 5);
            const selesaiTrim = (j.jam_selesai || '').substring(0, 5);
            return `
              <div class="p-2.5 rounded-xl ${isActive ? 'bg-emerald-600/40 border-emerald-400 ring-1 ring-emerald-400/50' : 'bg-white/10 hover:bg-white/15 border-white/10'} border flex items-center justify-between gap-2 transition">
                <div class="min-w-0">
                  <div class="font-extrabold text-xs text-white truncate">${j.nama_kelas || 'Kelas'}</div>
                  <div class="text-[10px] text-emerald-200 truncate font-semibold">${j.mapel || '-'}</div>
                  <div class="text-[9px] text-slate-300 font-mono mt-0.5">${j.jam_ke_label || 'Jam KBM'} (${mulaiTrim}-${selesaiTrim})</div>
                </div>
                <button
                  type="button"
                  class="btn-select-jadwal px-2.5 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-1 flex-shrink-0 ${isActive ? 'bg-emerald-400 text-emerald-950 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-slate-700'}"
                  data-jadwal-id="${j.id || ''}"
                  data-kelas-id="${j.kelas_id || ''}"
                  data-mapel-id="${j.mapel_id || ''}"
                  data-mapel="${j.mapel || ''}"
                  data-tanggal="${jadwalData.tanggal || ''}"
                  data-hari="${jadwalData.hari || ''}"
                  data-jam-mulai="${j.jam_mulai || ''}"
                  data-jam-selesai="${j.jam_selesai || ''}"
                >
                  <span>${isActive ? 'Sedang Aktif' : 'Pilih Sesi'}</span>
                  ${isActive ? '<i data-lucide="check" class="w-3 h-3"></i>' : '<i data-lucide="arrow-right" class="w-3 h-3"></i>'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  const counts = getCounts();
  const selectedKelasObj = kelasList.find(k => k.id === currentKelasId);

  // Render Initial Static Framework Layout (hanya sekali)
  container.innerHTML = `
    <div class="space-y-4 pb-24 max-w-4xl mx-auto">
      
      <!-- Banner Saran Jadwal Mengajar (100% Pasif & Opt-In) -->
      <div id="jadwal-banner-container">
        ${renderJadwalBannerHTML(jadwalHariIni, currentKelasId, currentMapel, currentTanggal)}
      </div>

      <!-- Card Konfigurasi Sesi Mengajar (F1) -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 transition hover:shadow-md">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <i data-lucide="calendar-check" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="font-bold text-slate-800 text-base sm:text-lg">Sesi Mengajar</h2>
              <p class="text-xs text-slate-500">Pilih kombinasi kelas, mata pelajaran, & tanggal mengajar</p>
            </div>
          </div>
          
          <div id="session-saved-badge-container">
            ${existingSesi ? `
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                Sesi Tersimpan
              </span>
            ` : ''}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Pilih Kelas (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Kelas</label>
            <div id="kelas-combobox-container">
              ${renderClassComboboxHTML({
                id: 'select-kelas',
                kelasList,
                selectedId: currentKelasId
              })}
            </div>
          </div>

          <!-- Pilih Mapel (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Mata Pelajaran</label>
            <div id="mapel-combobox-container">
              ${renderMapelComboboxHTML({
                id: 'select-mapel',
                mapelList,
                selectedValue: currentMapel,
                placeholder: mapelPlaceholder,
                disabled: isMapelDisabled,
                size: 'md',
                allowManage: !isMapelDisabled
              })}
            </div>
          </div>

          <!-- Pilih Tanggal -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal</label>
            ${renderDatePickerHTML({
              id: 'input-tanggal',
              value: currentTanggal,
              includeDayName: true
            })}
          </div>
        </div>
      </div>

      <!-- Toolbar Tindakan Cepat & Ringkasan Realtime -->
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <button id="btn-set-all-hadir" type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow transition transform active:scale-95">
            <i data-lucide="check-check" class="w-4 h-4"></i>
            <span>Set Semua Hadir</span>
          </button>
          
          <button id="btn-link-jurnal" type="button" class="bg-slate-700/80 hover:bg-slate-600 text-slate-100 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 border border-slate-600 transition">
            <i data-lucide="file-text" class="w-4 h-4 text-emerald-400"></i>
            <span>Jurnal Sesi Ini</span>
          </button>
        </div>

        <!-- Ringkasan Live Stat -->
        <div id="live-stat-badges" class="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold">
          <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            H: <strong id="stat-h">${counts.h}</strong>
          </span>
          <span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg">
            S: <strong id="stat-s">${counts.s}</strong>
          </span>
          <span class="bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2.5 py-1 rounded-lg">
            I: <strong id="stat-i">${counts.i}</strong>
          </span>
          <span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg">
            A: <strong id="stat-a">${counts.a}</strong>
          </span>
          <span class="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-600">
            Total: <strong id="stat-total">${counts.total}</strong>
          </span>
        </div>
      </div>

      <!-- Banner Catatan Ceklis Hari Ini jika ada -->
      <div id="checklist-banner-container">
        ${checklistKelasHariIni.length > 0 ? `
          <div class="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 border border-sky-200/90 dark:border-sky-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-sky-500 text-white rounded-xl shadow-md shadow-sky-500/20 flex-shrink-0">
                <i data-lucide="check-square" class="w-5 h-5"></i>
              </div>
              <div>
                <p class="font-bold text-sky-950 dark:text-sky-200 text-xs sm:text-sm">Ada ${checklistKelasHariIni.length} Catatan Ceklis Hari Ini</p>
                <p class="text-sky-800 dark:text-sky-300 text-[11px] mt-0.5">${checklistKelasHariIni.map(c => `• ${c.teks}`).join(' ')}</p>
              </div>
            </div>
            <button id="btn-view-class-tasks" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap self-start sm:self-auto">
              <span>Buka Ceklis Catatan</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Petunjuk Singkat -->
      <div class="flex items-center justify-between text-xs text-slate-500 px-2">
        <span>Klik tombol status <strong class="text-emerald-700 font-bold">H</strong> (Hadir), <strong class="text-amber-600 font-bold">S</strong> (Sakit), <strong class="text-sky-600 font-bold">I</strong> (Izin), <strong class="text-rose-600 font-bold">A</strong> (Alfa)</span>
        <span id="header-class-name">Daftar Siswa: <strong>${selectedKelasObj?.nama_kelas || 'Kelas'}</strong></span>
      </div>

      <!-- Daftar Siswa & Toggle Kehadiran (F2 & F3) -->
      <div class="space-y-2" id="student-list-container">
        ${!currentKelasId ? `
          <div class="bg-white rounded-3xl p-10 text-center text-slate-500 border border-dashed border-slate-300 space-y-2 my-2">
            <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <i data-lucide="graduation-cap" class="w-7 h-7"></i>
            </div>
            <div class="space-y-1">
              <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Pilih Kelas / Rombel Terlebih Dahulu</h3>
              <p class="text-xs text-slate-400 max-w-sm mx-auto">
                Silakan pilih kelas dan mata pelajaran pada formulir di atas untuk memulai presensi.
              </p>
            </div>
          </div>
        ` : !currentMapel ? `
          <div class="bg-white rounded-3xl p-8 sm:p-10 text-center text-slate-500 border border-dashed border-slate-300 space-y-2 my-2">
            <div class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
              <i data-lucide="book-open" class="w-6 h-6"></i>
            </div>
            <div class="space-y-1">
              <h3 class="font-bold text-slate-800 text-sm sm:text-base">Pilih Mata Pelajaran</h3>
              <p class="text-xs text-slate-400 max-w-sm mx-auto">
                Silakan pilih mata pelajaran pada formulir di atas untuk memuat data absensi sesi mengajar.
              </p>
            </div>
          </div>
        ` : siswaList.length === 0 ? `
          <div class="bg-white rounded-2xl p-8 text-center text-slate-500 border border-dashed border-slate-300">
            <i data-lucide="users" class="w-12 h-12 mx-auto text-slate-400 mb-2"></i>
            <p class="font-medium">Belum ada data siswa di kelas ini.</p>
            <p class="text-xs text-slate-400 mt-1">Klik tombol "Data Siswa" di menu atas untuk menambah atau mengimpor siswa.</p>
          </div>
        ` : siswaList.map((siswa, idx) => {
          const statusObj = attendanceMap[siswa.id] || { status: 'Hadir', catatan: '' };
          const currentStatus = statusObj.status;
          const kList = kegiatanMap[siswa.id] || [];
          const hasKegiatan = kList.length > 0;

          return `
            <div class="siswa-row bg-white rounded-xl p-3 sm:p-3.5 shadow-sm border ${currentStatus === 'Alfa' ? 'border-rose-300 bg-rose-50/20' : currentStatus === 'Sakit' ? 'border-amber-300 bg-amber-50/20' : currentStatus === 'Izin' ? 'border-sky-300 bg-sky-50/20' : 'border-slate-200/80'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition" data-siswa-id="${siswa.id}">
              
              <!-- Info Siswa & Badge Kegiatan (F6) -->
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  ${siswa.nomor_absen || (idx + 1)}
                </span>
                
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-slate-800 text-sm truncate">${siswa.nama_lengkap}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">${siswa.jenis_kelamin || '-'}</span>
                    
                    ${hasKegiatan ? `
                      <button type="button" class="btn-view-kegiatan inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse transition" data-kegiatan='${JSON.stringify(kList).replace(/'/g, "&apos;")}' title="Klik untuk lihat rincian kegiatan">
                        <i data-lucide="sparkles" class="w-3 h-3 text-amber-600"></i>
                        <span>${kList[0].kategori}</span>
                      </button>
                    ` : ''}
                  </div>
                  
                  <div class="flex items-center gap-2 mt-0.5">
                    ${statusObj.catatan ? `
                      <span class="text-[11px] text-slate-500 italic flex items-center gap-1">
                        <i data-lucide="message-square" class="w-3 h-3 text-slate-400"></i>
                        "${statusObj.catatan}"
                      </span>
                    ` : ''}
                  </div>
                </div>
              </div>

              <!-- Tombol Status Kehadiran Cepat (H / S / I / A) & Catatan -->
              <div class="flex items-center justify-end gap-1.5 flex-shrink-0">
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Hadir' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500' : 'bg-slate-100 hover:bg-emerald-50 text-slate-700'}" data-status="Hadir" data-siswa-id="${siswa.id}">
                  H
                </button>
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Sakit' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400' : 'bg-slate-100 hover:bg-amber-50 text-slate-700'}" data-status="Sakit" data-siswa-id="${siswa.id}">
                  S
                </button>
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Izin' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 ring-2 ring-sky-400' : 'bg-slate-100 hover:bg-sky-50 text-slate-700'}" data-status="Izin" data-siswa-id="${siswa.id}">
                  I
                </button>
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Alfa' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-500' : 'bg-slate-100 hover:bg-rose-50 text-slate-700'}" data-status="Alfa" data-siswa-id="${siswa.id}">
                  A
                </button>
                <button type="button" class="btn-edit-note p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" data-siswa-id="${siswa.id}" data-nama="${siswa.nama_lengkap}" data-catatan="${statusObj.catatan || ''}" title="Beri catatan khusus">
                  <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>

      <!-- Sticky Floating Action Bar di HP & Desktop (F4) -->
      <div class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-4 z-30 shadow-2xl">
        <div class="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div class="hidden sm:block">
            <p id="sticky-session-info" class="text-xs font-semibold text-slate-800">${selectedKelasObj?.nama_kelas || 'Kelas'} • ${currentMapel || (isMapelDisabled ? mapelPlaceholder : 'Pilih Mapel')}</p>
            <p id="sticky-tanggal-info" class="text-[11px] text-slate-500">Tanggal: ${currentTanggal}</p>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button id="btn-save-absen" type="button" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition transform active:scale-95">
              <i data-lucide="save" class="w-4 h-4"></i>
              <span>Simpan Absensi Sesi Ini</span>
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Modal Detail Kegiatan Siswa (F6 Popup) -->
    <div id="modal-kegiatan-detail" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2 text-amber-600">
            <i data-lucide="sparkles" class="w-5 h-5"></i>
            <h3 class="font-bold text-slate-800">Catatan Kegiatan Siswa</h3>
          </div>
          <button id="btn-close-modal-kegiatan" type="button" class="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div id="modal-kegiatan-body" class="space-y-3 max-h-80 overflow-y-auto pr-1"></div>
        <div class="pt-2 border-t border-slate-100 flex justify-end">
          <button id="btn-modal-kegiatan-ok" type="button" class="bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-700 transition">
            Tutup
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Catatan Siswa -->
    <div id="modal-catatan-siswa" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="font-bold text-slate-800 text-sm">Catatan Siswa: <span id="note-siswa-name" class="text-emerald-700"></span></h3>
          <button id="btn-close-modal-note" type="button" class="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Keterangan Tambahan (misal: "Datang telat 15 menit", "Sakit demam", dll.)</label>
          <textarea id="input-siswa-note" rows="3" class="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Tulis catatan..."></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button id="btn-save-note" type="button" class="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition">
            Simpan Catatan
          </button>
        </div>
      </div>
    </div>
  `;

  // Helper untuk Re-binding event list siswa
  function bindStudentRowsEvents() {
    // Event: Toggle Status per Siswa
    container.querySelectorAll('.btn-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const siswaId = btn.getAttribute('data-siswa-id');
        const newStatus = btn.getAttribute('data-status');
        if (!siswaId || !newStatus) return;

        if (!localState.currentAttendanceMap[siswaId]) localState.currentAttendanceMap[siswaId] = {};
        localState.currentAttendanceMap[siswaId].status = newStatus;
        state.currentAttendanceMap = localState.currentAttendanceMap;

        // Update style row & buttons
        const row = btn.closest('.siswa-row');
        if (row) {
          row.classList.remove('border-rose-300', 'border-amber-300', 'border-sky-300', 'bg-rose-50/20', 'bg-amber-50/20', 'bg-sky-50/20', 'border-slate-200/80');
          if (newStatus === 'Alfa') row.classList.add('border-rose-300', 'bg-rose-50/20');
          else if (newStatus === 'Sakit') row.classList.add('border-amber-300', 'bg-amber-50/20');
          else if (newStatus === 'Izin') row.classList.add('border-sky-300', 'bg-sky-50/20');
          else row.classList.add('border-slate-200/80');

          row.querySelectorAll('.btn-status').forEach(b => {
            const st = b.getAttribute('data-status');
            if (st === newStatus) {
              let activeBg = 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500';
              if (st === 'Sakit') activeBg = 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400';
              else if (st === 'Izin') activeBg = 'bg-sky-500 text-white shadow-md shadow-sky-500/30 ring-2 ring-sky-400';
              else if (st === 'Alfa') activeBg = 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-500';
              b.className = `btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${activeBg}`;
            } else {
              b.className = `btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 bg-slate-100 hover:bg-slate-200 text-slate-700`;
            }
          });
        }

        updateLiveCounters();
      });
    });

    // Modal Catatan Siswa trigger
    container.querySelectorAll('.btn-edit-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentEditingNoteSiswaId = btn.getAttribute('data-siswa-id');
        noteName.textContent = btn.getAttribute('data-nama') || '';
        inputNote.value = localState.currentAttendanceMap[currentEditingNoteSiswaId]?.catatan || '';
        modalNote.classList.remove('hidden');
      });
    });

    // Modal Kegiatan Siswa Detail trigger
    container.querySelectorAll('.btn-view-kegiatan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const raw = btn.getAttribute('data-kegiatan');
        if (raw) {
          const list = JSON.parse(raw);
          modalKegiatanBody.innerHTML = list.map(item => `
            <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-amber-900">${item.kategori}</span>
                <span class="text-[10px] text-amber-700">${item.tanggal}</span>
              </div>
              <p class="text-xs font-semibold text-slate-800">${item.judul}</p>
              <p class="text-xs text-slate-600 leading-relaxed">${item.keterangan || '-'}</p>
            </div>
          `).join('');
          modalKegiatan.classList.remove('hidden');
          if (window.lucide) window.lucide.createIcons();
        }
      });
    });
  }

  // PARTIAL UPDATER: Refresh Area Data Absensi Siswa
  async function refreshAttendanceSection(kelasId, mapel, tanggal) {
    const reqVer = ++attendanceRequestVersion;
    const studentListContainer = container.querySelector('#student-list-container');
    const badgeContainer = container.querySelector('#session-saved-badge-container');
    const checklistContainer = container.querySelector('#checklist-banner-container');
    const headerClassSpan = container.querySelector('#header-class-name');

    const selectedKelas = kelasList.find(k => k.id === kelasId);
    if (headerClassSpan) {
      headerClassSpan.innerHTML = `Daftar Siswa: <strong>${selectedKelas?.nama_kelas || 'Kelas'}</strong>`;
    }

    // Jika kelas belum dipilih
    if (!kelasId) {
      if (studentListContainer) {
        studentListContainer.innerHTML = `
          <div class="bg-white rounded-3xl p-10 text-center text-slate-500 border border-dashed border-slate-300 space-y-2 my-2">
            <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <i data-lucide="graduation-cap" class="w-7 h-7"></i>
            </div>
            <div class="space-y-1">
              <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Pilih Kelas / Rombel Terlebih Dahulu</h3>
              <p class="text-xs text-slate-400 max-w-sm mx-auto">
                Silakan pilih kelas dan mata pelajaran pada formulir di atas untuk memulai presensi.
              </p>
            </div>
          </div>
        `;
      }
      if (badgeContainer) badgeContainer.innerHTML = '';
      if (checklistContainer) checklistContainer.innerHTML = '';
      localState.siswaList = [];
      updateLiveCounters([]);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Jika mapel belum dipilih
    if (!mapel) {
      if (studentListContainer) {
        studentListContainer.innerHTML = `
          <div class="bg-white rounded-3xl p-8 sm:p-10 text-center text-slate-500 border border-dashed border-slate-300 space-y-2 my-2">
            <div class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
              <i data-lucide="book-open" class="w-6 h-6"></i>
            </div>
            <div class="space-y-1">
              <h3 class="font-bold text-slate-800 text-sm sm:text-base">Pilih Mata Pelajaran</h3>
              <p class="text-xs text-slate-400 max-w-sm mx-auto">
                Silakan pilih mata pelajaran pada formulir di atas untuk memuat data absensi sesi mengajar.
              </p>
            </div>
          </div>
        `;
      }
      if (badgeContainer) badgeContainer.innerHTML = '';
      if (checklistContainer) checklistContainer.innerHTML = '';
      localState.siswaList = [];
      updateLiveCounters([]);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Tampilkan loading subtle khusus area data siswa
    if (studentListContainer) {
      studentListContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-100 space-y-2">
          <div class="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-xs font-medium">Memuat data siswa & presensi...</p>
        </div>
      `;
    }

    const [siswaList, kegiatanHariIni, checklistHariIni, existingSesi] = await Promise.all([
      db.getSiswaByKelas(kelasId),
      db.getKegiatanSiswaByTanggal(tanggal),
      db.getChecklistHariIni(tanggal, currentYear),
      db.findSesi(kelasId, mapel, tanggal)
    ]);

    // Stale Request Protection: Jika ada request attendance baru, batalkan hasil request ini
    if (reqVer !== attendanceRequestVersion) {
      return;
    }

    localState.siswaList = siswaList;
    localState.existingSesi = existingSesi;

    const kegiatanMap = {};
    kegiatanHariIni.forEach(k => {
      if (!kegiatanMap[k.siswa_id]) kegiatanMap[k.siswa_id] = [];
      kegiatanMap[k.siswa_id].push(k);
    });
    localState.kegiatanMap = kegiatanMap;

    // Siapkan attendanceMap
    let attMap = {};
    if (existingSesi && existingSesi.absensi && existingSesi.absensi.length > 0) {
      existingSesi.absensi.forEach(a => {
        attMap[a.siswa_id] = {
          status: a.status,
          catatan: a.catatan || ''
        };
      });
    } else {
      siswaList.forEach(s => {
        attMap[s.id] = { status: 'Hadir', catatan: '' };
      });
    }
    localState.currentAttendanceMap = attMap;
    state.currentAttendanceMap = attMap;

    // Render Sesi Tersimpan Badge
    if (badgeContainer) {
      badgeContainer.innerHTML = existingSesi ? `
        <span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          Sesi Tersimpan
        </span>
      ` : '';
    }

    // Render Checklist Banner
    const checklistKelasHariIni = checklistHariIni.filter(c => (!c.kelas_id || c.kelas_id === kelasId) && !c.is_done);
    if (checklistContainer) {
      checklistContainer.innerHTML = checklistKelasHariIni.length > 0 ? `
        <div class="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 border border-sky-200/90 dark:border-sky-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm mb-4">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-sky-500 text-white rounded-xl shadow-md shadow-sky-500/20 flex-shrink-0">
              <i data-lucide="check-square" class="w-5 h-5"></i>
            </div>
            <div>
              <p class="font-bold text-sky-950 dark:text-sky-200 text-xs sm:text-sm">Ada ${checklistKelasHariIni.length} Catatan Ceklis Hari Ini</p>
              <p class="text-sky-800 dark:text-sky-300 text-[11px] mt-0.5">${checklistKelasHariIni.map(c => `• ${c.teks}`).join(' ')}</p>
            </div>
          </div>
          <button id="btn-view-class-tasks" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap self-start sm:self-auto">
            <span>Buka Ceklis Catatan</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      ` : '';
    }

    // Render List Siswa
    if (studentListContainer) {
      if (siswaList.length === 0) {
        studentListContainer.innerHTML = `
          <div class="bg-white rounded-2xl p-8 text-center text-slate-500 border border-dashed border-slate-300">
            <i data-lucide="users" class="w-12 h-12 mx-auto text-slate-400 mb-2"></i>
            <p class="font-medium">Belum ada data siswa di kelas ini.</p>
            <p class="text-xs text-slate-400 mt-1">Klik tombol "Data Siswa" di menu atas untuk menambah atau mengimpor siswa.</p>
          </div>
        `;
      } else {
        studentListContainer.innerHTML = siswaList.map((siswa, idx) => {
          const statusObj = attMap[siswa.id] || { status: 'Hadir', catatan: '' };
          const currentStatus = statusObj.status;
          const kList = kegiatanMap[siswa.id] || [];
          const hasKegiatan = kList.length > 0;

          return `
            <div class="siswa-row bg-white rounded-xl p-3 sm:p-3.5 shadow-sm border ${currentStatus === 'Alfa' ? 'border-rose-300 bg-rose-50/20' : currentStatus === 'Sakit' ? 'border-amber-300 bg-amber-50/20' : currentStatus === 'Izin' ? 'border-sky-300 bg-sky-50/20' : 'border-slate-200/80'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition" data-siswa-id="${siswa.id}">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  ${siswa.nomor_absen || (idx + 1)}
                </span>
                
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-slate-800 text-sm truncate">${siswa.nama_lengkap}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">${siswa.jenis_kelamin || '-'}</span>
                    
                    ${hasKegiatan ? `
                      <button type="button" class="btn-view-kegiatan inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse transition" data-kegiatan='${JSON.stringify(kList).replace(/'/g, "&apos;")}' title="Klik untuk lihat rincian kegiatan">
                        <i data-lucide="sparkles" class="w-3 h-3 text-amber-600"></i>
                        <span>${kList[0].kategori}</span>
                      </button>
                    ` : ''}
                  </div>
                  
                  <div class="flex items-center gap-2 mt-0.5">
                    ${statusObj.catatan ? `
                      <span class="text-[11px] text-slate-500 italic flex items-center gap-1">
                        <i data-lucide="message-square" class="w-3 h-3 text-slate-400"></i>
                        "${statusObj.catatan}"
                      </span>
                    ` : ''}
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-1.5 flex-shrink-0">
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Hadir' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500' : 'bg-slate-100 hover:bg-emerald-50 text-slate-700'}" data-status="Hadir" data-siswa-id="${siswa.id}">
                  H
                </button>
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Sakit' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400' : 'bg-slate-100 hover:bg-amber-50 text-slate-700'}" data-status="Sakit" data-siswa-id="${siswa.id}">
                  S
                </button>
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Izin' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 ring-2 ring-sky-400' : 'bg-slate-100 hover:bg-sky-50 text-slate-700'}" data-status="Izin" data-siswa-id="${siswa.id}">
                  I
                </button>
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Alfa' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-500' : 'bg-slate-100 hover:bg-rose-50 text-slate-700'}" data-status="Alfa" data-siswa-id="${siswa.id}">
                  A
                </button>
                <button type="button" class="btn-edit-note p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" data-siswa-id="${siswa.id}" data-nama="${siswa.nama_lengkap}" data-catatan="${statusObj.catatan || ''}" title="Beri catatan khusus">
                  <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    bindStudentRowsEvents();
    updateLiveCounters(siswaList);
    if (window.lucide) window.lucide.createIcons();
  }

  // PARTIAL UPDATER: Refresh Dropdown Mapel secara Terisolasi
  async function refreshMapelSection(kelasId, explicitMapel = null) {
    const reqVer = ++kelasRequestVersion;
    const mapelContainer = container.querySelector('#mapel-combobox-container');

    // 1. Tampilkan subtle loading di area Mapel
    if (mapelContainer) {
      mapelContainer.innerHTML = `
        <div class="h-11 rounded-xl px-3.5 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500">
          <div class="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <span class="truncate font-medium">Memuat mata pelajaran...</span>
        </div>
      `;
    }

    // Reset local mapel & sync ke parent
    localState.currentMapel = '';
    state.currentMapel = '';

    let newMapelList = [];
    let loadErr = false;

    if (kelasId) {
      try {
        newMapelList = await db.getMapelSaya(currentYear, kelasId);
      } catch (err) {
        console.error('Gagal memuat mata pelajaran dari Jadwal Mengajar:', err);
        loadErr = true;
        newMapelList = [];
      }
    }

    // Stale Request Protection: Jika user telah memilih kelas lain, abaikan response ini
    if (reqVer !== kelasRequestVersion) {
      return;
    }

    localState.mapelList = newMapelList;

    let selectedMapel = '';
    if (!loadErr && explicitMapel && newMapelList.some(m => m.nama_mapel === explicitMapel)) {
      selectedMapel = explicitMapel;
    } else if (!loadErr && newMapelList.length === 1) {
      selectedMapel = newMapelList[0].nama_mapel;
    }

    let placeholder = 'Pilih Mata Pelajaran';
    let isDisabled = false;

    if (loadErr) {
      placeholder = 'Gagal memuat mata pelajaran dari Jadwal Mengajar.';
      isDisabled = true;
    } else if (newMapelList.length === 0) {
      placeholder = 'Tidak ada mata pelajaran pada Jadwal Mengajar untuk kelas ini.';
      isDisabled = true;
    }

    localState.currentMapel = selectedMapel;
    state.currentMapel = selectedMapel;

    if (mapelContainer) {
      mapelContainer.innerHTML = renderMapelComboboxHTML({
        id: 'select-mapel',
        mapelList: newMapelList,
        selectedValue: selectedMapel,
        placeholder,
        disabled: isDisabled,
        size: 'md',
        allowManage: !isDisabled
      });

      initMapelCombobox(mapelContainer, {
        id: 'select-mapel',
        mapelList: newMapelList,
        selectedValue: selectedMapel,
        size: 'md',
        allowManage: !isDisabled,
        onSelect: (chosenMapel) => {
          localState.currentMapel = chosenMapel;
          state.currentMapel = chosenMapel;
          refreshAttendanceSection(localState.currentKelasId, chosenMapel, localState.currentTanggal);
          updateStickyInfo();
        },
        onManage: () => {
          if (onOpenModal) onOpenModal('mapel');
        }
      });
    }

    if (window.lucide) window.lucide.createIcons();

    // Partial Refresh area data absensi siswa
    await refreshAttendanceSection(kelasId, selectedMapel, localState.currentTanggal);

    // Refresh status aktif di banner jadwal mengajar
    const bannerContainer = container.querySelector('#jadwal-banner-container');
    if (bannerContainer && localState.jadwalHariIni) {
      bannerContainer.innerHTML = renderJadwalBannerHTML(localState.jadwalHariIni, kelasId, selectedMapel, localState.currentTanggal);
      bindJadwalBannerEvents();
    }

    updateStickyInfo();
  }

  // PARTIAL UPDATER: Refresh Banner Jadwal Mengajar berdasarkan Tanggal
  async function refreshJadwalBanner(tanggal) {
    const bannerContainer = container.querySelector('#jadwal-banner-container');
    if (!bannerContainer) return;

    try {
      const jadwalData = await db.getJadwalHariIni(currentYear, tanggal);
      localState.jadwalHariIni = jadwalData;
      bannerContainer.innerHTML = renderJadwalBannerHTML(jadwalData, localState.currentKelasId, localState.currentMapel, tanggal);
      bindJadwalBannerEvents();
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Gagal memuat jadwal untuk tanggal:', tanggal, err);
    }
  }

  // BIND EVENT: Listener Tombol Pilih Sesi dari Banner Jadwal
  function bindJadwalBannerEvents() {
    const bannerContainer = container.querySelector('#jadwal-banner-container');
    if (!bannerContainer) return;

    bannerContainer.querySelectorAll('.btn-select-jadwal').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetJadwalId = btn.getAttribute('data-jadwal-id');
        const targetKelasId = btn.getAttribute('data-kelas-id');
        const targetMapel = btn.getAttribute('data-mapel');
        const targetTanggal = btn.getAttribute('data-tanggal') || localState.currentTanggal;

        if (!targetKelasId) return;

        showToast(`Memuat sesi ${targetMapel || ''} untuk kelas terpilih...`, 'info');

        // 1. Urutan state update: tanggal -> kelas -> mapel -> jadwal/sesi
        localState.currentTanggal = targetTanggal;
        state.currentTanggal = targetTanggal;
        localState.currentKelasId = targetKelasId;
        state.currentKelasId = targetKelasId;
        localState.currentMapel = targetMapel;
        state.currentMapel = targetMapel;
        localState.selectedScheduleId = targetJadwalId;
        state.selectedScheduleId = targetJadwalId;

        // 2. Sinkronkan input & trigger DatePicker DOM
        const dateInput = container.querySelector('#input-tanggal');
        const dateTriggerLabel = container.querySelector('#input-tanggal-trigger .datepicker-label');
        if (dateInput) dateInput.value = targetTanggal;
        if (dateTriggerLabel) dateTriggerLabel.textContent = formatIndonesianDate(targetTanggal);

        // 3. Sinkronkan visual combobox kelas trigger & hidden input
        const classTrigger = container.querySelector('#select-kelas-trigger');
        const classHidden = container.querySelector('#select-kelas');
        const targetK = kelasList.find(k => k.id === targetKelasId);
        if (classTrigger && targetK) {
          const content = classTrigger.querySelector('.min-w-0');
          if (content) {
            content.innerHTML = `
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300 flex-shrink-0"></span>
              <span class="truncate font-black text-slate-900 dark:text-white">${targetK.nama_kelas}</span>
            `;
          }
        }
        if (classHidden) classHidden.value = targetKelasId;

        // 4. Update Mapel Combobox & Load Siswa / Absensi untuk tanggal dan sesi terpilih
        await handleKelasChange(targetKelasId, targetMapel);

        // 5. Update Banner active status
        if (localState.jadwalHariIni) {
          bannerContainer.innerHTML = renderJadwalBannerHTML(localState.jadwalHariIni, targetKelasId, targetMapel, targetTanggal);
          bindJadwalBannerEvents();
          if (window.lucide) window.lucide.createIcons();
        }
      });
    });
  }

  // HANDLER: Pemilihan Kelas Baru (100% Smooth Partial Update)
  async function handleKelasChange(newKelasId, explicitMapel = null) {
    localState.currentKelasId = newKelasId;
    state.currentKelasId = newKelasId;

    if (explicitMapel) {
      localState.currentMapel = explicitMapel;
      state.currentMapel = explicitMapel;
    }

    await refreshMapelSection(newKelasId, explicitMapel);
  }

  // Inisialisasi DatePicker
  initDatePicker(container, {
    id: 'input-tanggal',
    value: localState.currentTanggal,
    onChange: async (newDate) => {
      localState.currentTanggal = newDate;
      state.currentTanggal = newDate;
      await refreshJadwalBanner(newDate);
      await refreshAttendanceSection(localState.currentKelasId, localState.currentMapel, newDate);
      updateStickyInfo();
    }
  });

  // Inisialisasi Class Combobox
  initClassCombobox(container, {
    id: 'select-kelas',
    kelasList,
    selectedId: localState.currentKelasId,
    onSelect: (newKId) => {
      handleKelasChange(newKId);
    }
  });

  // Inisialisasi Initial Mapel Combobox
  initMapelCombobox(container, {
    id: 'select-mapel',
    mapelList: localState.mapelList,
    selectedValue: localState.currentMapel,
    size: 'md',
    allowManage: !isMapelDisabled,
    onSelect: async (newMapel) => {
      localState.currentMapel = newMapel;
      state.currentMapel = newMapel;
      await refreshAttendanceSection(localState.currentKelasId, newMapel, localState.currentTanggal);
      const bannerContainer = container.querySelector('#jadwal-banner-container');
      if (bannerContainer && localState.jadwalHariIni) {
        bannerContainer.innerHTML = renderJadwalBannerHTML(localState.jadwalHariIni, localState.currentKelasId, newMapel, localState.currentTanggal);
        bindJadwalBannerEvents();
        if (window.lucide) window.lucide.createIcons();
      }
      updateStickyInfo();
    },
    onManage: () => {
      if (onOpenModal) onOpenModal('mapel');
    }
  });

  // Inisialisasi Event Handlers Baris Siswa & Banner Pertama Kali
  bindStudentRowsEvents();
  bindJadwalBannerEvents();

  // Modal Catatan Siswa DOM references & events
  let currentEditingNoteSiswaId = null;
  const modalNote = container.querySelector('#modal-catatan-siswa');
  const inputNote = container.querySelector('#input-siswa-note');
  const noteName = container.querySelector('#note-siswa-name');

  container.querySelector('#btn-close-modal-note')?.addEventListener('click', () => {
    modalNote.classList.add('hidden');
  });

  container.querySelector('#btn-save-note')?.addEventListener('click', () => {
    if (currentEditingNoteSiswaId) {
      if (!localState.currentAttendanceMap[currentEditingNoteSiswaId]) {
        localState.currentAttendanceMap[currentEditingNoteSiswaId] = { status: 'Hadir' };
      }
      const noteVal = inputNote.value.trim();
      localState.currentAttendanceMap[currentEditingNoteSiswaId].catatan = noteVal;
      state.currentAttendanceMap = localState.currentAttendanceMap;
      
      // Update badge catatan pada baris siswa di DOM
      const row = container.querySelector(`.siswa-row[data-siswa-id="${currentEditingNoteSiswaId}"]`);
      if (row) {
        let noteSpan = row.querySelector('.text-slate-500.italic');
        if (noteVal) {
          if (noteSpan) {
            noteSpan.innerHTML = `<i data-lucide="message-square" class="w-3 h-3 text-slate-400"></i>"${noteVal}"`;
          } else {
            const containerName = row.querySelector('.min-w-0.flex-1 > div:last-child');
            if (containerName) {
              containerName.innerHTML = `
                <span class="text-[11px] text-slate-500 italic flex items-center gap-1">
                  <i data-lucide="message-square" class="w-3 h-3 text-slate-400"></i>
                  "${noteVal}"
                </span>
              `;
            }
          }
        } else if (noteSpan) {
          noteSpan.remove();
        }
        const editBtn = row.querySelector('.btn-edit-note');
        if (editBtn) editBtn.setAttribute('data-catatan', noteVal);
      }

      modalNote.classList.add('hidden');
      showToast('Catatan siswa diperbarui', 'success');
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Modal Kegiatan Siswa Detail DOM references & events
  const modalKegiatan = container.querySelector('#modal-kegiatan-detail');
  const modalKegiatanBody = container.querySelector('#modal-kegiatan-body');

  container.querySelector('#btn-close-modal-kegiatan')?.addEventListener('click', () => {
    modalKegiatan.classList.add('hidden');
  });
  container.querySelector('#btn-modal-kegiatan-ok')?.addEventListener('click', () => {
    modalKegiatan.classList.add('hidden');
  });

  // Event: Set Semua Hadir (1-Klik Cepat)
  container.querySelector('#btn-set-all-hadir')?.addEventListener('click', () => {
    const list = localState.siswaList || [];
    list.forEach(s => {
      if (!localState.currentAttendanceMap[s.id]) localState.currentAttendanceMap[s.id] = {};
      localState.currentAttendanceMap[s.id].status = 'Hadir';
    });
    state.currentAttendanceMap = localState.currentAttendanceMap;

    // Update UI tombol
    container.querySelectorAll('.siswa-row').forEach(row => {
      row.className = row.className.replace(/border-rose-300|border-amber-300|border-sky-300|bg-rose-50\/20|bg-amber-50\/20|bg-sky-50\/20/g, '').trim();
      row.classList.add('border-slate-200/80');

      row.querySelectorAll('.btn-status').forEach(btn => {
        const st = btn.getAttribute('data-status');
        btn.className = `btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${st === 'Hadir' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500' : 'bg-slate-100 hover:bg-emerald-50 text-slate-700'}`;
      });
    });

    updateLiveCounters(list);
    showToast('Semua siswa diset Hadir', 'info');
  });

  // Event: Simpan Sesi & Absensi (F4)
  container.querySelector('#btn-save-absen')?.addEventListener('click', async () => {
    if (!localState.currentKelasId) {
      showToast('Silakan pilih kelas terlebih dahulu.', 'warning');
      return;
    }
    if (!localState.currentMapel) {
      showToast('Silakan pilih mata pelajaran terlebih dahulu.', 'warning');
      return;
    }

    const saveBtn = container.querySelector('#btn-save-absen');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Menyimpan...</span>`;
    if (window.lucide) window.lucide.createIcons();

    const list = localState.siswaList || [];
    const absensiList = list.map(s => ({
      siswa_id: s.id,
      status: localState.currentAttendanceMap[s.id]?.status || 'Hadir',
      catatan: localState.currentAttendanceMap[s.id]?.catatan || ''
    }));

    const sesiData = {
      id: localState.existingSesi?.id || null,
      kelas_id: localState.currentKelasId,
      mapel: localState.currentMapel,
      tanggal: localState.currentTanggal,
    };

    const res = await db.saveSesi({ sesiData, absensiList, jurnalData: null });
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Absensi Sesi Ini</span>`;
    if (window.lucide) window.lucide.createIcons();

    if (res.success) {
      const selectedKelas = kelasList.find(k => k.id === localState.currentKelasId);
      showToast(`Absensi kelas ${selectedKelas?.nama_kelas || ''} berhasil disimpan!`, 'success');
      
      // Update local existingSesi & badge Sesi Tersimpan
      localState.existingSesi = res.data || { id: res.id || 'sesi-' + Date.now() };
      const badgeContainer = container.querySelector('#session-saved-badge-container');
      if (badgeContainer) {
        badgeContainer.innerHTML = `
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            Sesi Tersimpan
          </span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    } else {
      showToast('Gagal menyimpan absensi: ' + res.message, 'error');
    }
  });

  // Event: Pindah ke Jurnal
  container.querySelector('#btn-link-jurnal')?.addEventListener('click', () => {
    if (!localState.currentKelasId) {
      showToast('Silakan pilih kelas terlebih dahulu.', 'warning');
      return;
    }
    if (!localState.currentMapel) {
      showToast('Silakan pilih mata pelajaran terlebih dahulu.', 'warning');
      return;
    }
    onNavigateToJurnal({
      kelasId: localState.currentKelasId,
      mapel: localState.currentMapel,
      tanggal: localState.currentTanggal
    });
  });

  if (window.lucide) window.lucide.createIcons();
}
