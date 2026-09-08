import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
import { initQuickFillNilai } from './QuickFillNilai.js';
// components/TugasView.js - Modul Catatan (Ceklis Per Siswa) & Penilaian Tugas Sederhana
import { db } from '../supabase-client.js';

export async function renderTugasView(container, state, onStateChange, showToast) {
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
            Gagal memuat kelas dari Jadwal Mengajar untuk Catatan & Tugas.
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
            Anda belum memiliki penugasan jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> untuk mengelola Catatan & Tugas.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
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

  // Tentukan mapel aktif (default mapel pertama guru di kelas tersebut)
  let currentMapel = (mapelList.some(m => m.nama_mapel === state.currentMapel) ? state.currentMapel : (mapelList[0]?.nama_mapel || ''));
  const today = state.currentTanggal || new Date().toISOString().split('T')[0];
  let subTab = state.tugasSubTab || 'ceklis';

  // =========================================================================
  // INITIAL DATA FETCH
  // =========================================================================
  let activeChecklistId = state.activeEditingChecklistId || null;
  let activeNilaiId = state.activeEditingNilaiId || null;

  const [allChecklist, allNilaiTugas] = await Promise.all([
    db.getAllChecklist(currentYear),
    db.getAllNilaiTugas(currentYear)
  ]);

  let currentChecklistObj = activeChecklistId ? allChecklist.find(c => c.id === activeChecklistId) || null : null;
  let currentNilaiObj = activeNilaiId ? allNilaiTugas.find(nt => nt.id === activeNilaiId) || null : null;

  let initialIsNoCatatan = currentChecklistObj?.is_no_catatan === true || currentChecklistObj?.is_no_catatan === 'true' || currentChecklistObj?.bebas_catatan === true || currentChecklistObj?.bebas_catatan === 'true';
  let initialIsNoTugas = currentNilaiObj?.is_no_tugas === true || currentNilaiObj?.is_no_tugas === 'true';

  let targetDateCeklis = currentChecklistObj?.tanggal || today;
  let targetDateNilai = currentNilaiObj?.tanggal || today;

  const [siswaList, ceklisAttendanceMap, nilaiAttendanceMap] = await Promise.all([
    currentKelasId ? db.getSiswaByKelas(currentKelasId) : Promise.resolve([]),
    currentKelasId ? db.getAttendanceMapByKelasAndTanggal(currentKelasId, targetDateCeklis, currentMapel) : Promise.resolve({}),
    currentKelasId ? db.getAttendanceMapByKelasAndTanggal(currentKelasId, targetDateNilai, currentMapel) : Promise.resolve({})
  ]);

  // Helper Penanda Visual Status Absensi Siswa
  function getAttendanceMeta(status) {
    if (status === 'Alfa' || status === 'Alpa') {
      return {
        badge: `<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300" title="Siswa Tidak Hadir (Alfa)"><span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>🔴 Alfa</span>`,
        rowClass: 'bg-rose-50/40 border-l-4 border-l-rose-500'
      };
    }
    if (status === 'Sakit') {
      return {
        badge: `<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300" title="Siswa Tidak Hadir (Sakit)"><span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span>🔵 Sakit</span>`,
        rowClass: 'bg-amber-50/40 border-l-4 border-l-amber-500'
      };
    }
    if (status === 'Izin') {
      return {
        badge: `<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-300" title="Siswa Tidak Hadir (Izin)"><span class="w-1.5 h-1.5 rounded-full bg-sky-600"></span>🟡 Izin</span>`,
        rowClass: 'bg-sky-50/40 border-l-4 border-l-sky-500'
      };
    }
    return {
      badge: '',
      rowClass: ''
    };
  }

  // =========================================================================
  // LOCAL STATE SETUP (Transient UI state isolated from full re-render)
  // =========================================================================
  const localState = {
    subTab,
    currentYear,
    currentKelasId,
    currentMapel,
    today,
    activeChecklistId,
    activeNilaiId,
    allChecklist,
    allNilaiTugas,
    siswaList,
    ceklisAttendanceMap,
    nilaiAttendanceMap,
    kelasList,
    mapelList,
    defaultKKM: currentNilaiObj?.kkm || 75,
    currentCeklisFilter: 'all',
    currentCeklisSearch: '',
    currentNilaiFilter: 'all',
    currentNilaiSearch: ''
  };

  // Sync background state properties without triggering global app.render()
  state.currentKelasId = localState.currentKelasId;
  state.currentMapel = localState.currentMapel;
  state.tugasSubTab = localState.subTab;

  // Stale Request Protection Tokens
  let kelasRequestVersion = 0;
  let ceklisRequestVersion = 0;
  let nilaiRequestVersion = 0;

  // Map status ceklis siswa: siswa_id -> { is_checked: boolean, catatan: string }
  let ceklisMap = {};
  if (currentChecklistObj && currentChecklistObj.daftar_ceklis) {
    currentChecklistObj.daftar_ceklis.forEach(d => {
      ceklisMap[d.siswa_id] = {
        is_checked: d.is_checked === true || d.is_checked === 'true',
        catatan: d.catatan || ''
      };
    });
  } else {
    siswaList.forEach(s => {
      ceklisMap[s.id] = { is_checked: true, catatan: '' };
    });
  }

  // Map nilai siswa: siswa_id -> { nilai: number|string, catatan: string }
  let nilaiMap = {};
  if (currentNilaiObj && currentNilaiObj.daftar_nilai) {
    currentNilaiObj.daftar_nilai.forEach(d => {
      nilaiMap[d.siswa_id] = { nilai: d.nilai, catatan: d.catatan || '' };
    });
  } else {
    siswaList.forEach(s => {
      nilaiMap[s.id] = { nilai: '', catatan: '' };
    });
  }

  // Hitung awal data Ceklis
  let initCeklisBelum = 0;
  siswaList.forEach(s => {
    if (!ceklisMap[s.id]?.is_checked) initCeklisBelum++;
  });

  // Hitung awal data Nilai
  let initNilaiBelum = 0;
  if (!initialIsNoTugas) {
    siswaList.forEach(s => {
      const v = nilaiMap[s.id]?.nilai;
      const n = parseInt(v);
      if (v === '' || isNaN(n)) initNilaiBelum++;
    });
  }

  // Helper untuk rendering HTML Riwayat Ceklis
  function renderChecklistHistoryHTML(list = localState.allChecklist) {
    const activeKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);
    if (list.length === 0) {
      return `
        <div class="text-center py-8 text-slate-400 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          Belum ada data ceklis catatan yang disimpan.
        </div>
      `;
    }

    return `
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100">
        <div class="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100/90 text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b-2 border-slate-200">
          <div class="col-span-2">Tanggal & Kelas</div>
          <div class="col-span-4">Mata Pelajaran & Topik</div>
          <div class="col-span-2 text-center">Jenis Sesi</div>
          <div class="col-span-2 text-left">Ketuntasan</div>
          <div class="col-span-2 text-right">Aksi</div>
        </div>

        ${list.map(chk => {
          const isSessionNoCatatan = chk.is_no_catatan === true || chk.is_no_catatan === 'true' || chk.bebas_catatan === true || chk.bebas_catatan === 'true';
          const checkedCount = (chk.daftar_ceklis || []).filter(d => d.is_checked === true || d.is_checked === 'true').length;
          const total = (chk.daftar_ceklis || []).length;
          const belumCount = isSessionNoCatatan ? 0 : total - checkedCount;
          const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 100;
          const namaKelas = chk.kelas?.nama_kelas || chk.kelas_nama || (chk.kelas_id && !chk.kelas_id.startsWith('k-') && !chk.kelas_id.includes('-') ? chk.kelas_id : (activeKelasObj?.nama_kelas || 'Kelas'));
          const isPending = belumCount > 0;
          const rowBorderClass = isSessionNoCatatan ? 'border-l-4 border-l-teal-500' : (isPending ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500');
          const mapelSubtext = isSessionNoCatatan ? `${chk.mapel} • Bebas Catatan` : `${chk.mapel} • Ceklis Catatan`;

          return `
            <div class="session-item-row group ${rowBorderClass} transition hover:bg-slate-50/70 p-3 sm:px-4 sm:py-3 flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center gap-2.5">
              <div class="md:col-span-2 flex items-center justify-between md:flex-col md:items-start gap-1">
                <div class="flex items-center gap-1.5">
                  <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span class="text-xs font-bold text-slate-800">${chk.tanggal}</span>
                </div>
                <span class="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                  ${namaKelas}
                </span>
              </div>

              <div class="md:col-span-4 min-w-0">
                <div class="text-xs text-slate-500 font-semibold mb-0.5 truncate">
                  ${mapelSubtext}
                </div>
                <h4 class="font-bold text-slate-800 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition" title="${chk.judul_catatan}">
                  ${chk.judul_catatan}
                </h4>
              </div>

              <div class="md:col-span-2 flex items-center md:justify-center">
                <span class="w-24 sm:w-28 text-center justify-center py-1 text-[10px] font-extrabold uppercase px-2 rounded-lg border ${isSessionNoCatatan ? 'bg-teal-50 text-teal-800 border-teal-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'} flex items-center gap-1 shadow-2xs">
                  <i data-lucide="${isSessionNoCatatan ? 'book-check' : 'check-square'}" class="w-3 h-3 flex-shrink-0"></i>
                  <span class="truncate">${isSessionNoCatatan ? 'Bebas Catatan' : 'Ceklis Catatan'}</span>
                </span>
              </div>

              <div class="md:col-span-2 flex items-center gap-2.5">
                <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div class="h-1.5 rounded-full transition-all duration-300 ${isSessionNoCatatan ? 'bg-teal-500' : (isPending ? 'bg-amber-500' : 'bg-emerald-500')}" style="width: ${isSessionNoCatatan ? 100 : pct}%"></div>
                </div>
                <div class="text-right">
                  <span class="text-xs font-black block ${isSessionNoCatatan ? 'text-teal-700' : (isPending ? 'text-amber-700' : 'text-emerald-700')}">
                    ${isSessionNoCatatan ? '100%' : `${pct}%`}
                  </span>
                  <span class="text-[10px] font-bold block ${isSessionNoCatatan ? 'text-teal-600' : (isPending ? `${belumCount} belum tuntas` : `${checkedCount}/${total} tuntas`)}">
                    ${isSessionNoCatatan ? 'Bebas Catatan' : (isPending ? `${belumCount} belum tuntas` : `${checkedCount}/${total} tuntas`)}
                  </span>
                </div>
              </div>

              <div class="md:col-span-2 flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div class="flex items-center gap-1 bg-slate-100/70 p-0.5 rounded-xl border border-slate-200/60">
                  <button class="btn-edit-saved-ceklis p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-white rounded-lg transition" data-id="${chk.id}" title="Edit / Buka Form">
                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                  </button>
                  <button class="btn-delete-saved-ceklis p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" data-id="${chk.id}" title="Hapus Sesi">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Helper untuk rendering HTML Riwayat Nilai
  function renderNilaiHistoryHTML(list = localState.allNilaiTugas) {
    const activeKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);
    if (list.length === 0) {
      return `
        <div class="text-center py-8 text-slate-400 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          Belum ada daftar nilai tugas yang disimpan.
        </div>
      `;
    }

    return `
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100">
        <div class="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100/90 text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b-2 border-slate-200">
          <div class="col-span-2">Tanggal & Kelas</div>
          <div class="col-span-4">Mata Pelajaran & Topik</div>
          <div class="col-span-2 text-center">Jenis Sesi</div>
          <div class="col-span-2 text-left">Ketuntasan</div>
          <div class="col-span-2 text-right">Aksi</div>
        </div>

        ${list.map(nt => {
          const isSessionNoTugas = nt.is_no_tugas === true || nt.is_no_tugas === 'true';
          let avg = 0;
          let count = 0;
          let tuntasCount = 0;
          let unrated = 0;
          const nList = nt.daftar_nilai || [];
          const kkm = nt.kkm || 75;

          nList.forEach(d => {
            const n = parseInt(d.nilai);
            if (!isNaN(n) && d.nilai !== '') {
              avg += n;
              count++;
              if (n >= kkm) tuntasCount++;
            } else {
              unrated++;
            }
          });

          const finalAvg = count > 0 ? Math.round(avg / count) : '-';
          const total = nList.length;
          const belumCount = isSessionNoTugas ? 0 : total - tuntasCount;
          const pct = total > 0 ? Math.round((tuntasCount / total) * 100) : 100;
          const namaKelas = nt.kelas?.nama_kelas || nt.kelas_nama || (nt.kelas_id && !nt.kelas_id.startsWith('nt-') && !nt.kelas_id.includes('-') ? nt.kelas_id : (activeKelasObj?.nama_kelas || 'Kelas'));
          const isPending = unrated > 0 || (total > 0 && belumCount > 0);
          const rowBorderClass = isSessionNoTugas ? 'border-l-4 border-l-blue-500' : (isPending ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500');
          const mapelSubtext = isSessionNoTugas ? `${nt.mapel} • Bebas Tugas` : `${nt.mapel} • KKM ${kkm}`;

          return `
            <div class="session-item-row group ${rowBorderClass} transition hover:bg-slate-50/70 p-3 sm:px-4 sm:py-3 flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center gap-2.5">
              <div class="md:col-span-2 flex items-center justify-between md:flex-col md:items-start gap-1">
                <div class="flex items-center gap-1.5">
                  <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span class="text-xs font-bold text-slate-800">${nt.tanggal}</span>
                </div>
                <span class="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                  ${namaKelas}
                </span>
              </div>

              <div class="md:col-span-4 min-w-0">
                <div class="text-xs text-slate-500 font-semibold mb-0.5 truncate">
                  ${mapelSubtext}
                </div>
                <h4 class="font-bold text-slate-800 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition" title="${nt.judul_tugas}">
                  ${nt.judul_tugas}
                </h4>
              </div>

              <div class="md:col-span-2 flex items-center md:justify-center">
                <span class="w-24 sm:w-28 text-center justify-center py-1 text-[10px] font-extrabold uppercase px-2 rounded-lg border ${isSessionNoTugas ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-amber-50 text-amber-800 border-amber-300'} flex items-center gap-1 shadow-2xs">
                  <i data-lucide="${isSessionNoTugas ? 'coffee' : 'award'}" class="w-3 h-3 flex-shrink-0"></i>
                  <span class="truncate">${isSessionNoTugas ? 'Bebas Tugas' : 'Penilaian'}</span>
                </span>
              </div>

              <div class="md:col-span-2 flex items-center gap-2.5">
                <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div class="h-1.5 rounded-full transition-all duration-300 ${isSessionNoTugas ? 'bg-blue-500' : (isPending ? 'bg-amber-500' : 'bg-emerald-500')}" style="width: ${isSessionNoTugas ? 100 : pct}%"></div>
                </div>
                <div class="text-right">
                  <span class="text-xs font-black block ${isSessionNoTugas ? 'text-blue-700' : (isPending ? 'text-amber-700' : 'text-emerald-700')}">
                    ${isSessionNoTugas ? '100%' : `${pct}%`}
                  </span>
                  <span class="text-[10px] font-bold block ${isSessionNoTugas ? 'text-blue-600' : (unrated > 0 ? 'text-rose-600' : 'text-slate-500')}">
                    ${isSessionNoTugas ? 'Bebas Tugas' : (unrated > 0 ? `${unrated} belum dinilai` : `Rata-rata: ${finalAvg}`)}
                  </span>
                </div>
              </div>

              <div class="md:col-span-2 flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div class="flex items-center gap-1 bg-slate-100/70 p-0.5 rounded-xl border border-slate-200/60">
                  <button class="btn-edit-saved-nilai p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-white rounded-lg transition" data-id="${nt.id}" title="Edit / Buka Form">
                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                  </button>
                  <button class="btn-delete-saved-nilai p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" data-id="${nt.id}" title="Hapus Sesi">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // =========================================================================
  // MAIN VIEW SHELL RENDERING
  // =========================================================================
  container.innerHTML = `
    <div class="space-y-5 pb-24 max-w-5xl mx-auto">
      
      <!-- Header Banner & Subtab Switcher -->
      <div class="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30">
            <i data-lucide="clipboard-check" class="w-6 h-6"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg sm:text-xl">Catatan Ceklis & Nilai Tugas</h2>
            <p class="text-xs text-emerald-200/80">Pantau siswa belum tuntas, input nilai, atau tandai pertemuan bebas tugas</p>
          </div>
        </div>

        <!-- Sub-Tab Switcher -->
        <div class="flex items-center bg-slate-900/90 p-1 rounded-xl border border-emerald-500/30 self-start sm:self-auto text-xs font-bold">
          <button id="btn-subtab-ceklis" class="px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${subTab === 'ceklis' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}">
            <i data-lucide="check-square" class="w-4 h-4 text-emerald-300"></i>
            <span>1. Catatan Ceklis Siswa</span>
            <span id="badge-header-ceklis-count" class="${initCeklisBelum > 0 ? '' : 'hidden'} bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full ml-1">${initCeklisBelum}</span>
          </button>

          <button id="btn-subtab-nilai" class="px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${subTab === 'nilai' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}">
            <i data-lucide="award" class="w-4 h-4 text-amber-300"></i>
            <span>2. Penilaian Nilai Tugas</span>
            <span id="badge-header-nilai-count" class="${initNilaiBelum > 0 ? '' : 'hidden'} bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full ml-1">${initNilaiBelum}</span>
          </button>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- SUB-TAB 1: CATATAN CEKLIS PER SISWA HARI ITU -->
      <!-- =================================================================== -->
      <div id="section-subtab-ceklis" class="${subTab === 'ceklis' ? '' : 'hidden'} space-y-5">
        
        <!-- Filter & Info Sesi Ceklis -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>
              <h3 id="ceklis-form-title" class="font-bold text-slate-800 text-sm sm:text-base">
                ${activeChecklistId ? 'Edit Sesi Ceklis: ' + (currentChecklistObj?.judul_catatan || '') : 'Form Ceklis Catatan Siswa Hari Ini'}
              </h3>
            </div>
            
            <button id="btn-reset-ceklis-form" class="${activeChecklistId ? '' : 'hidden'} text-xs text-rose-600 hover:underline font-semibold">
              + Buat Sesi Ceklis Baru
            </button>
          </div>

          <!-- Pilihan Opsi: Tidak Ada Catatan (Bebas Catatan) -->
          <div class="bg-gradient-to-r from-teal-50 via-emerald-50/70 to-slate-50 border border-teal-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div class="flex items-start sm:items-center gap-3">
              <div class="p-2.5 bg-teal-100 text-teal-700 rounded-xl flex-shrink-0 mt-0.5 sm:mt-0">
                <i data-lucide="book-check" class="w-5 h-5"></i>
              </div>
              <div>
                <label class="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" id="check-no-catatan" class="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer" ${initialIsNoCatatan ? 'checked' : ''}>
                  <span>Bebas Catatan (Tidak Ada Tugas Mencatat pada Pertemuan Ini)</span>
                </label>
                <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Centang jika pertemuan ini hanya ceramah, diskusi, praktikum luring, atau kegiatan non-catatan tanpa tagihan buku catatan/ceklis.
                </p>
              </div>
            </div>

            <div id="badge-no-catatan-indicator" class="${initialIsNoCatatan ? '' : 'hidden'} flex items-center gap-1.5 bg-teal-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs self-start sm:self-auto flex-shrink-0">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              <span>Mode Bebas Catatan Aktif</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Pilih Kelas (Shadcn Combobox) -->
            <div id="wrapper-ceklis-select-kelas">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas Target</label>
              ${renderClassComboboxHTML({
                id: 'ceklis-select-kelas',
                kelasList: localState.kelasList,
                selectedId: localState.currentKelasId,
                size: 'sm'
              })}
            </div>

            <!-- Pilih Mapel (Shadcn Combobox) -->
            <div id="wrapper-ceklis-select-mapel">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
              ${renderMapelComboboxHTML({
                id: 'ceklis-select-mapel',
                mapelList: localState.mapelList,
                selectedValue: localState.currentMapel,
                size: 'sm',
                allowManage: false
              })}
            </div>

            <!-- Tanggal Ceklis (Shadcn DatePicker) -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label>
              ${renderDatePickerHTML({
                id: 'ceklis-input-tanggal',
                value: currentChecklistObj?.tanggal || today,
                size: 'sm'
              })}
            </div>

            <!-- Topik Catatan Ceklis -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Topik / Agenda Ceklis <span class="text-rose-500">*</span></label>
              <input type="text" id="ceklis-input-judul" value="${currentChecklistObj?.judul_catatan || (initialIsNoCatatan ? 'Materi Pembelajaran (Bebas Catatan)' : 'Ceklis Kelengkapan Buku Catatan & PR')}" placeholder="Contoh: Ceklis Buku Catatan / Praktik" class="w-full h-9 text-xs font-bold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none">
            </div>
          </div>

          <!-- Quick Action Toolbar Ceklis -->
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div id="quick-fill-ceklis-toolbar" class="flex items-center gap-2 ${initialIsNoCatatan ? 'hidden' : ''}">
              <button id="btn-ceklis-check-all" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition">
                <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
                <span>Centang Semua Siswa</span>
              </button>
              
              <button id="btn-ceklis-uncheck-all" class="bg-white hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-300 transition">
                Hapus Semua Centang
              </button>
            </div>

            <div id="no-catatan-notice-text" class="text-xs font-semibold text-teal-800 flex items-center gap-1.5 ${initialIsNoCatatan ? '' : 'hidden'}">
              <i data-lucide="info" class="w-4 h-4 text-teal-600"></i>
              <span>Pertemuan ini berstatus Bebas Catatan (siswa tidak ada tagihan catatan).</span>
            </div>

            <!-- Live Stats Ceklis -->
            <div class="flex items-center gap-2 font-bold text-xs flex-wrap">
              <span class="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">
                ✓ Sudah Tuntas: <strong id="stat-ceklis-tuntas">${initialIsNoCatatan ? `${siswaList.length} (Bebas Catatan)` : '0'}</strong> Siswa
              </span>
              <span class="bg-rose-100 text-rose-800 px-3 py-1.5 rounded-lg border border-rose-200 ${initialIsNoCatatan ? 'hidden' : ''}" id="stat-ceklis-belum-wrap">
                ⚠️ Belum Tuntas: <strong id="stat-ceklis-belum">0</strong> Siswa
              </span>
            </div>
          </div>
        </div>

        <!-- Banner Monitoring Siswa Belum Tuntas -->
        <div id="banner-ceklis-belum" class="hidden bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="p-2 bg-amber-100 text-amber-700 rounded-xl flex-shrink-0 mt-0.5">
              <i data-lucide="alert-circle" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-slate-800 text-sm">
                <span id="banner-ceklis-count" class="text-rose-600 font-black">0</span> Siswa Belum Tuntas pada Pertemuan Ini
              </h4>
              <p class="text-xs text-slate-600 mt-0.5 leading-relaxed" id="banner-ceklis-names">
                Daftar siswa yang belum lengkap catatan atau tugasnya.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
            <button id="btn-copy-wa-belum-ceklis" class="bg-white hover:bg-amber-100 text-amber-800 font-bold text-xs px-3.5 py-2 rounded-xl border border-amber-300 shadow-xs flex items-center gap-1.5 transition" title="Salin daftar nama ke WhatsApp">
              <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
              <span>Salin WA</span>
            </button>
          </div>
        </div>

        <!-- Filter & Search Toolbar Ceklis -->
        <div class="bg-white rounded-2xl p-3 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-semibold text-slate-500 mr-1">Filter Tampilan:</span>
            <button id="filter-ceklis-all" class="btn-filter-ceklis px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs transition" data-filter="all">
              Semua (${siswaList.length})
            </button>
            <button id="filter-ceklis-belum" class="btn-filter-ceklis px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-rose-700 transition" data-filter="belum">
              ⚠️ Belum Tuntas (<span id="count-btn-filter-ceklis-belum">0</span>)
            </button>
            <button id="filter-ceklis-sudah" class="btn-filter-ceklis px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-emerald-700 transition" data-filter="sudah">
              ✓ Sudah Tuntas (<span id="count-btn-filter-ceklis-sudah">0</span>)
            </button>
          </div>

          <div class="relative w-full sm:w-64">
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3"></i>
            <input type="text" id="search-ceklis-siswa" placeholder="Cari nama siswa..." class="w-full text-xs font-medium pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
          </div>
        </div>

        <!-- Tabel Ceklis Absen Per Siswa -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 class="font-bold text-slate-800 text-xs sm:text-sm">
              Daftar Siswa & Status Ceklis (<span id="ceklis-table-visible-count">${siswaList.length}</span> Siswa Tampil)
            </h4>
            <span class="text-[11px] text-slate-400">Klik tombol centang untuk mengubah status</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th class="py-3 px-3 w-12 text-center">No</th>
                  <th class="py-3 px-3 min-w-[200px]">Nama Siswa</th>
                  <th class="py-3 px-3 w-40 text-center">Status Ceklis</th>
                  <th class="py-3 px-3 min-w-[180px]">Catatan Siswa (Opsional)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100" id="table-ceklis-body">
                ${renderCeklisTableRows(siswaList, ceklisMap, ceklisAttendanceMap)}
              </tbody>
            </table>
          </div>

          <!-- Bottom Action Toolbar Ceklis -->
          <div class="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-slate-500">
              Hasil ceklis per siswa akan tersimpan untuk catatan pembelajaran harian.
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-print-ceklis" class="bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition">
                <i data-lucide="printer" class="w-4 h-4"></i>
                <span>Cetak Lembar Ceklis</span>
              </button>

              <button id="btn-save-ceklis" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition transform active:scale-95">
                <i data-lucide="save" class="w-4 h-4"></i>
                <span>Simpan Catatan Ceklis</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Riwayat Ceklis yang Pernah Disimpan -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div class="flex items-center gap-2">
              <i data-lucide="history" class="w-4 h-4 text-emerald-600"></i>
              <h4 class="font-bold text-slate-800 text-xs sm:text-sm">Riwayat Catatan Ceklis Tersimpan</h4>
              <span id="badge-total-ceklis-history" class="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                ${allChecklist.length} Sesi
              </span>
            </div>
            
            <button class="btn-goto-pemeriksaan text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition self-start sm:self-auto">
              <span>Buka Menu Pemeriksaan & Filter Lengkap</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <div id="ceklis-history-container">
            ${renderChecklistHistoryHTML(allChecklist)}
          </div>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- SUB-TAB 2: PENILAIAN NILAI TUGAS SISWA (BENTUK NILAI SEDERHANA) -->
      <!-- =================================================================== -->
      <div id="section-subtab-nilai" class="${subTab === 'nilai' ? '' : 'hidden'} space-y-5">
        
        <!-- Form Konfigurasi Tugas -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="edit-3" class="w-4 h-4 text-emerald-600"></i>
              <h3 id="nilai-form-title" class="font-bold text-slate-800 text-sm sm:text-base">
                ${activeNilaiId ? 'Edit Nilai Tugas: ' + (currentNilaiObj?.judul_tugas || '') : 'Input Nilai Tugas Baru'}
              </h3>
            </div>
            
            <button id="btn-reset-nilai-form" class="${activeNilaiId ? '' : 'hidden'} text-xs text-rose-600 hover:underline font-semibold">
              + Buat Tugas Baru
            </button>
          </div>

          <!-- Pilihan Opsi: Tidak Ada Tugas (Bebas Tugas) -->
          <div class="bg-gradient-to-r from-blue-50 via-indigo-50/70 to-slate-50 border border-blue-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div class="flex items-start sm:items-center gap-3">
              <div class="p-2.5 bg-blue-100 text-blue-700 rounded-xl flex-shrink-0 mt-0.5 sm:mt-0">
                <i data-lucide="coffee" class="w-5 h-5"></i>
              </div>
              <div>
                <label class="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" id="check-no-tugas" class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" ${initialIsNoTugas ? 'checked' : ''}>
                  <span>Tidak Ada Tugas pada Pertemuan Ini (Bebas Tugas)</span>
                </label>
                <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Centang jika pertemuan ini hanya berisi penyampaian materi, diskusi, ceramah, atau refleksi tanpa tagihan tugas.
                </p>
              </div>
            </div>

            <div id="badge-no-tugas-indicator" class="${initialIsNoTugas ? '' : 'hidden'} flex items-center gap-1.5 bg-blue-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs self-start sm:self-auto flex-shrink-0">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              <span>Mode Bebas Tugas Aktif</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" id="config-tugas-inputs-grid">
            <!-- Pilih Kelas (Shadcn Combobox) -->
            <div id="wrapper-nilai-select-kelas">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas</label>
              ${renderClassComboboxHTML({
                id: 'nilai-select-kelas',
                kelasList: localState.kelasList,
                selectedId: localState.currentKelasId,
                size: 'sm'
              })}
            </div>

            <!-- Pilih Mapel (Shadcn Combobox) -->
            <div id="wrapper-nilai-select-mapel">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
              ${renderMapelComboboxHTML({
                id: 'nilai-select-mapel',
                mapelList: localState.mapelList,
                selectedValue: localState.currentMapel,
                size: 'sm',
                allowManage: false
              })}
            </div>

            <!-- Tanggal Tugas (Shadcn DatePicker) -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label>
              ${renderDatePickerHTML({
                id: 'nilai-input-tanggal',
                value: currentNilaiObj?.tanggal || today,
                size: 'sm'
              })}
            </div>

            <!-- Judul Tugas -->
            <div class="lg:col-span-1">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Topik / Judul Pertemuan <span class="text-rose-500">*</span></label>
              <input type="text" id="nilai-input-judul" value="${currentNilaiObj?.judul_tugas || (initialIsNoTugas ? 'Materi Pembelajaran (Bebas Tugas)' : 'Tugas 1: Latihan Pembelajaran')}" placeholder="Contoh: Tugas 1 Aljabar / Materi Teori" class="w-full h-9 text-xs font-bold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none">
            </div>

            <!-- Standar KKM -->
            <div id="wrapper-input-kkm" class="${initialIsNoTugas ? 'opacity-40 pointer-events-none' : ''}">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Standar KKM</label>
              <input type="number" id="nilai-input-kkm" value="${localState.defaultKKM}" min="0" max="100" class="w-full h-9 text-xs font-bold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none">
            </div>
          </div>

          <!-- Quick Autofill Nilai & Statistik Live -->
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div id="quick-fill-toolbar" class="flex items-center gap-2 flex-wrap ${initialIsNoTugas ? 'hidden' : ''}">
              <span class="font-semibold text-slate-600">Isi Cepat Nilai:</span>
              <button class="btn-fill-quick bg-white hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200" data-val="75">75</button>
              <button class="btn-fill-quick bg-white hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200" data-val="80">80</button>
              <button class="btn-fill-quick bg-white hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200" data-val="85">85</button>
              <button class="btn-fill-quick bg-white hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200" data-val="90">90</button>
              <button class="btn-fill-quick bg-white hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200" data-val="100">100</button>
              <button id="btn-clear-nilai" class="text-slate-400 hover:text-rose-600 font-semibold ml-1">Kosongkan</button>
            </div>

            <div id="no-tugas-notice-text" class="text-xs font-semibold text-blue-700 flex items-center gap-1.5 ${initialIsNoTugas ? '' : 'hidden'}">
              <i data-lucide="info" class="w-4 h-4 text-blue-600"></i>
              <span>Pertemuan ini berstatus Bebas Tugas (siswa tidak dibebani nilai).</span>
            </div>

            <!-- Live Stats -->
            <div class="flex items-center gap-2 font-bold flex-wrap">
              <span class="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                Rata-rata: <strong id="stat-rata-rata">${initialIsNoTugas ? 'Bebas Tugas' : '-'}</strong>
              </span>
              <span class="bg-teal-100 text-teal-800 px-2.5 py-1 rounded-lg">
                Tuntas: <strong id="stat-tuntas">${initialIsNoTugas ? siswaList.length : 0}</strong> / ${siswaList.length}
              </span>
              <span class="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg" id="wrapper-stat-nilai-belum">
                Belum Dinilai: <strong id="stat-nilai-belum">0</strong>
              </span>
            </div>
          </div>
        </div>

        <!-- Banner Monitoring Siswa Belum Ada Nilai -->
        <div id="banner-nilai-belum" class="hidden bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="p-2 bg-rose-100 text-rose-700 rounded-xl flex-shrink-0 mt-0.5">
              <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-slate-800 text-sm">
                <span id="banner-nilai-count" class="text-rose-600 font-black">0</span> Siswa Belum Memiliki Nilai / Belum Mengumpulkan Tugas
              </h4>
              <p class="text-xs text-slate-600 mt-0.5 leading-relaxed" id="banner-nilai-names">
                Daftar siswa yang belum mengumpulkan tugas pada pertemuan ini.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
            <button id="btn-copy-wa-belum-nilai" class="bg-white hover:bg-rose-100 text-rose-800 font-bold text-xs px-3.5 py-2 rounded-xl border border-rose-300 shadow-xs flex items-center gap-1.5 transition" title="Salin tagihan tugas ke WhatsApp">
              <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
              <span>Salin Tagihan WA</span>
            </button>
          </div>
        </div>

        <!-- Banner Bebas Tugas Informatif -->
        <div id="banner-nilai-bebas-tugas" class="${initialIsNoTugas ? '' : 'hidden'} bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div class="p-2.5 bg-blue-100 text-blue-700 rounded-xl flex-shrink-0">
            <i data-lucide="coffee" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="font-bold text-blue-900 text-sm">Pertemuan Ini Ditandai Bebas Tugas</h4>
            <p class="text-xs text-blue-700 mt-0.5 leading-relaxed">
              Seluruh siswa otomatis dinyatakan bebas dari tagihan nilai tugas untuk sesi pertemuan ini. Klik tombol <strong>Simpan</strong> di bawah untuk mencatat sesi ini.
            </p>
          </div>
        </div>

        <!-- Filter & Search Toolbar Nilai -->
        <div id="nilai-filter-toolbar" class="bg-white rounded-2xl p-3 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${initialIsNoTugas ? 'hidden' : ''}">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-semibold text-slate-500 mr-1">Filter Tampilan:</span>
            <button id="filter-nilai-all" class="btn-filter-nilai px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs transition" data-filter="all">
              Semua (${siswaList.length})
            </button>
            <button id="filter-nilai-belum" class="btn-filter-nilai px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-rose-700 transition" data-filter="belum">
              ⚠️ Belum Ada Nilai (<span id="count-btn-filter-nilai-belum">0</span>)
            </button>
            <button id="filter-nilai-remed" class="btn-filter-nilai px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-amber-700 transition" data-filter="remedial">
              🔄 Remedial (<span id="count-btn-filter-nilai-remed">0</span>)
            </button>
            <button id="filter-nilai-tuntas" class="btn-filter-nilai px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-emerald-700 transition" data-filter="tuntas">
              ✓ Tuntas (<span id="count-btn-filter-nilai-tuntas">0</span>)
            </button>
          </div>

          <div class="relative w-full sm:w-64">
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3"></i>
            <input type="text" id="search-nilai-siswa" placeholder="Cari nama siswa..." class="w-full text-xs font-medium pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
          </div>
        </div>

        <!-- Tabel Sederhana Input Nilai Per Siswa -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 class="font-bold text-slate-800 text-xs sm:text-sm">
              Daftar Siswa & Kolom Nilai (<span id="nilai-table-visible-count">${siswaList.length}</span> Siswa Tampil)
            </h4>
            <span class="text-[11px] text-slate-400" id="nilai-table-sub-note">${initialIsNoTugas ? 'Pertemuan Bebas Tugas' : 'Masukkan angka 0 - 100'}</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th class="py-3 px-3 w-12 text-center">No</th>
                  <th class="py-3 px-3 min-w-[200px]">Nama Siswa</th>
                  <th class="py-3 px-3 w-32 text-center">Nilai (0 - 100)</th>
                  <th class="py-3 px-3 w-36 text-center">Status</th>
                  <th class="py-3 px-3 min-w-[160px]">Catatan Khusus (Opsional)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100" id="table-nilai-body">
                ${renderNilaiTableRows(siswaList, nilaiMap, nilaiAttendanceMap, localState.defaultKKM, initialIsNoTugas)}
              </tbody>
            </table>
          </div>

          <!-- Bottom Action Toolbar Nilai -->
          <div class="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-slate-500">
              Data sesi dan status tugas akan tersimpan untuk catatan administrasi mengajar.
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-print-nilai" class="bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition">
                <i data-lucide="printer" class="w-4 h-4"></i>
                <span>Cetak Lembar Nilai</span>
              </button>

              <button id="btn-save-nilai-tugas" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition transform active:scale-95">
                <i data-lucide="save" class="w-4 h-4"></i>
                <span>Simpan Daftar Nilai</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Riwayat Nilai Tugas yang Pernah Disimpan -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div class="flex items-center gap-2">
              <i data-lucide="history" class="w-4 h-4 text-amber-600"></i>
              <h4 class="font-bold text-slate-800 text-xs sm:text-sm">Riwayat Penilaian Tugas Tersimpan</h4>
              <span id="badge-total-nilai-history" class="text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                ${allNilaiTugas.length} Sesi
              </span>
            </div>
            
            <button class="btn-goto-pemeriksaan text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition self-start sm:self-auto">
              <span>Buka Menu Pemeriksaan & Filter Lengkap</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <div id="nilai-history-container">
            ${renderNilaiHistoryHTML(allNilaiTugas)}
          </div>
        </div>

      </div>

    </div>
  `;

  // =========================================================================
  // HELPER RENDERING ROWS TABLE
  // =========================================================================
  function renderCeklisTableRows(sList, cMap, attMap) {
    if (!localState.currentKelasId) {
      return `
        <tr>
          <td colspan="4" class="py-12 text-center text-slate-500">
            <div class="max-w-sm mx-auto space-y-2">
              <div class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto border border-sky-100">
                <i data-lucide="clipboard-list" class="w-6 h-6"></i>
              </div>
              <p class="font-extrabold text-slate-800 text-sm">Pilih Kelas / Rombel Terlebih Dahulu</p>
              <p class="text-xs text-slate-400">Silakan pilih kelas dan mata pelajaran pada formulir di atas untuk memulai pencatatan ceklis siswa.</p>
            </div>
          </td>
        </tr>
      `;
    }
    if (sList.length === 0) {
      return `
        <tr>
          <td colspan="4" class="py-8 text-center text-slate-400">
            Belum ada data siswa di kelas ini.
          </td>
        </tr>
      `;
    }

    return sList.map((s, idx) => {
      const item = cMap[s.id] || { is_checked: true, catatan: '' };
      const isChecked = item.is_checked;
      const attInfo = attMap[s.id] || { status: 'Hadir', catatan: '' };
      const attMeta = getAttendanceMeta(attInfo.status);

      return `
        <tr class="hover:bg-slate-50/70 transition siswa-ceklis-row ${attMeta.rowClass}" data-siswa-id="${s.id}" data-nama="${s.nama_lengkap.toLowerCase()}" data-checked="${isChecked ? 'true' : 'false'}">
          <td class="py-2.5 px-3 text-center font-bold text-slate-500">${s.nomor_absen || (idx + 1)}</td>
          <td class="py-2.5 px-3">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-semibold text-slate-800 text-sm">${s.nama_lengkap}</span>
              ${attMeta.badge}
            </div>
            <div class="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
              <span>NISN: ${s.nisn || '-'} • (${s.jenis_kelamin || 'L'})</span>
              ${attInfo.status !== 'Hadir' && attInfo.catatan ? `
                <span class="italic text-slate-500 font-medium bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                  "${attInfo.catatan}"
                </span>
              ` : ''}
            </div>
          </td>

          <!-- Tombol Toggle Ceklis Siswa -->
          <td class="py-2 px-3 text-center">
            <button type="button" class="btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${isChecked ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'}" data-siswa-id="${s.id}" data-checked="${isChecked ? 'true' : 'false'}">
              <i data-lucide="${isChecked ? 'check-circle-2' : 'alert-circle'}" class="w-4 h-4 ${isChecked ? 'text-emerald-600' : 'text-rose-500'}"></i>
              <span>${isChecked ? 'Sudah / Tuntas' : 'Belum Tuntas'}</span>
            </button>
          </td>

          <!-- Catatan Khusus Siswa -->
          <td class="py-2 px-3">
            <input type="text" value="${item.catatan}" class="input-ceklis-catatan w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" data-siswa-id="${s.id}" placeholder="Catatan tambahan (misal: buku tertinggal)...">
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderNilaiTableRows(sList, nMap, attMap, kkmVal, isNoTugas) {
    if (!localState.currentKelasId) {
      return `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-500">
            <div class="max-w-sm mx-auto space-y-2">
              <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                <i data-lucide="award" class="w-6 h-6"></i>
              </div>
              <p class="font-extrabold text-slate-800 text-sm">Pilih Kelas / Rombel Terlebih Dahulu</p>
              <p class="text-xs text-slate-400">Silakan pilih kelas dan mata pelajaran pada formulir di atas untuk memulai input penilaian tugas siswa.</p>
            </div>
          </td>
        </tr>
      `;
    }
    if (sList.length === 0) {
      return `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-400">
            Belum ada siswa di kelas ini.
          </td>
        </tr>
      `;
    }

    return sList.map((s, idx) => {
      const val = nMap[s.id]?.nilai ?? '';
      const cat = nMap[s.id]?.catatan ?? '';
      const numVal = parseInt(val);
      const isFilled = !isNaN(numVal) && val !== '';
      const isTuntas = isFilled && numVal >= kkmVal;
      const isRemed = isFilled && numVal < kkmVal;
      const statusCategory = isNoTugas ? 'tuntas' : (!isFilled ? 'belum' : (isTuntas ? 'tuntas' : 'remedial'));
      const attInfo = attMap[s.id] || { status: 'Hadir', catatan: '' };
      const attMeta = getAttendanceMeta(attInfo.status);

      return `
        <tr class="hover:bg-slate-50/70 transition siswa-nilai-row ${attMeta.rowClass}" data-siswa-id="${s.id}" data-nama="${s.nama_lengkap.toLowerCase()}" data-status="${statusCategory}">
          <td class="py-2.5 px-3 text-center font-bold text-slate-500">${s.nomor_absen || (idx + 1)}</td>
          <td class="py-2.5 px-3">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-semibold text-slate-800 text-sm">${s.nama_lengkap}</span>
              ${attMeta.badge}
            </div>
            <div class="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
              <span>NISN: ${s.nisn || '-'} • (${s.jenis_kelamin || 'L'})</span>
              ${attInfo.status !== 'Hadir' && attInfo.catatan ? `
                <span class="italic text-slate-500 font-medium bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                  "${attInfo.catatan}"
                </span>
              ` : ''}
            </div>
          </td>
          
          <!-- Input Nilai -->
          <td class="py-2 px-3 text-center">
            <input type="number" min="0" max="100" value="${val}" ${isNoTugas ? 'disabled' : ''} class="input-nilai-item w-20 text-center font-black text-sm p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition ${isNoTugas ? 'opacity-40 bg-slate-100' : (isFilled ? (isTuntas ? 'text-emerald-700 bg-emerald-50/40 border-emerald-300' : 'text-rose-600 bg-rose-50/40 border-rose-300') : 'text-slate-400')}" data-siswa-id="${s.id}" placeholder="${isNoTugas ? '-' : '0'}">
          </td>

          <!-- Status Tuntas -->
          <td class="py-2.5 px-3 text-center status-tuntas-cell">
            ${isNoTugas ? `
              <span class="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"><i data-lucide="coffee" class="w-3 h-3"></i> Bebas Tugas</span>
            ` : (!isFilled ? `
              <span class="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Belum Ada Nilai</span>
            ` : isTuntas ? `
              <span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">Tuntas</span>
            ` : `
              <span class="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">Remedial</span>
            `)}
          </td>

          <!-- Catatan Khusus Siswa -->
          <td class="py-2 px-3">
            <input type="text" value="${cat}" class="input-catatan-item w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" data-siswa-id="${s.id}" placeholder="Keterangan singkat...">
          </td>
        </tr>
      `;
    }).join('');
  }

  // =========================================================================
  // SUBTAB SWITCHER (Pure Local Toggle, zero re-render, zero scroll jump)
  // =========================================================================
  function switchSubTab(newTab) {
    localState.subTab = newTab;
    state.tugasSubTab = newTab;

    const btnCeklis = container.querySelector('#btn-subtab-ceklis');
    const btnNilai = container.querySelector('#btn-subtab-nilai');
    const secCeklis = container.querySelector('#section-subtab-ceklis');
    const secNilai = container.querySelector('#section-subtab-nilai');

    if (newTab === 'ceklis') {
      secCeklis?.classList.remove('hidden');
      secNilai?.classList.add('hidden');
      if (btnCeklis) btnCeklis.className = 'px-4 py-2 rounded-lg transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-md';
      if (btnNilai) btnNilai.className = 'px-4 py-2 rounded-lg transition flex items-center gap-1.5 text-slate-300 hover:text-white';
    } else {
      secCeklis?.classList.add('hidden');
      secNilai?.classList.remove('hidden');
      if (btnCeklis) btnCeklis.className = 'px-4 py-2 rounded-lg transition flex items-center gap-1.5 text-slate-300 hover:text-white';
      if (btnNilai) btnNilai.className = 'px-4 py-2 rounded-lg transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-md';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  container.querySelector('#btn-subtab-ceklis')?.addEventListener('click', () => switchSubTab('ceklis'));
  container.querySelector('#btn-subtab-nilai')?.addEventListener('click', () => switchSubTab('nilai'));

  // =========================================================================
  // STATS & FILTER HANDLERS: CEKLIS
  // =========================================================================
  function applyCeklisTableFilter() {
    let visibleCount = 0;
    container.querySelectorAll('.siswa-ceklis-row').forEach(row => {
      const isChecked = row.getAttribute('data-checked') === 'true';
      const nama = row.getAttribute('data-nama') || '';

      let matchFilter = true;
      if (localState.currentCeklisFilter === 'belum') matchFilter = !isChecked;
      else if (localState.currentCeklisFilter === 'sudah') matchFilter = isChecked;

      let matchSearch = true;
      if (localState.currentCeklisSearch) {
        matchSearch = nama.includes(localState.currentCeklisSearch.toLowerCase());
      }

      if (matchFilter && matchSearch) {
        row.classList.remove('hidden');
        visibleCount++;
      } else {
        row.classList.add('hidden');
      }
    });

    const countEl = container.querySelector('#ceklis-table-visible-count');
    if (countEl) countEl.textContent = visibleCount;
  }

  function updateLiveChecklistStats() {
    const isNoCatatan = container.querySelector('#check-no-catatan')?.checked === true;
    const badgeIndicator = container.querySelector('#badge-no-catatan-indicator');
    const noticeText = container.querySelector('#no-catatan-notice-text');
    const quickToolbar = container.querySelector('#quick-fill-ceklis-toolbar');
    const statBelumWrap = container.querySelector('#stat-ceklis-belum-wrap');
    const judulInput = container.querySelector('#ceklis-input-judul');

    if (isNoCatatan) {
      badgeIndicator?.classList.remove('hidden');
      noticeText?.classList.remove('hidden');
      quickToolbar?.classList.add('hidden');
      statBelumWrap?.classList.add('hidden');

      if (judulInput && (judulInput.value === 'Ceklis Kelengkapan Buku Catatan & PR' || !judulInput.value.trim())) {
        judulInput.value = 'Materi Pembelajaran (Bebas Catatan)';
      }

      container.querySelectorAll('.siswa-ceklis-row').forEach(row => {
        row.setAttribute('data-checked', 'true');
        row.classList.remove('hidden');
        const btn = row.querySelector('.btn-toggle-siswa-ceklis');
        if (btn) {
          btn.disabled = true;
          btn.className = 'btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-teal-50 text-teal-800 border border-teal-200 opacity-90 cursor-default';
          btn.innerHTML = `<i data-lucide="book-check" class="w-4 h-4 text-teal-600"></i><span>Bebas Catatan</span>`;
        }
      });

      const elTuntas = container.querySelector('#stat-ceklis-tuntas');
      const elBelum = container.querySelector('#stat-ceklis-belum');
      if (elTuntas) elTuntas.textContent = `${localState.siswaList.length} (Bebas Catatan)`;
      if (elBelum) elBelum.textContent = 0;

      const countEl = container.querySelector('#ceklis-table-visible-count');
      if (countEl) countEl.textContent = localState.siswaList.length;

      const banner = container.querySelector('#banner-ceklis-belum');
      banner?.classList.add('hidden');

      const headerBadge = container.querySelector('#badge-header-ceklis-count');
      if (headerBadge) headerBadge.classList.add('hidden');

      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Mode Normal (Ada Catatan / Ceklis)
    badgeIndicator?.classList.add('hidden');
    noticeText?.classList.add('hidden');
    quickToolbar?.classList.remove('hidden');
    statBelumWrap?.classList.remove('hidden');

    let tuntasCount = 0;
    let belumCount = 0;
    const belumNames = [];

    container.querySelectorAll('.siswa-ceklis-row').forEach(row => {
      const isChecked = row.querySelector('.btn-toggle-siswa-ceklis')?.getAttribute('data-checked') === 'true';
      row.setAttribute('data-checked', isChecked ? 'true' : 'false');
      
      const sId = row.getAttribute('data-siswa-id');
      const sObj = localState.siswaList.find(x => x.id === sId);
      const nama = sObj ? sObj.nama_lengkap : 'Siswa';

      const btn = row.querySelector('.btn-toggle-siswa-ceklis');
      if (btn) {
        btn.disabled = false;
        if (isChecked) {
          btn.className = 'btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200';
          btn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i><span>Sudah / Tuntas</span>`;
        } else {
          btn.className = 'btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100';
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-500"></i><span>Belum Tuntas</span>`;
        }
      }

      if (isChecked) {
        tuntasCount++;
      } else {
        belumCount++;
        belumNames.push(nama);
      }
    });

    // Update Counters
    const elTuntas = container.querySelector('#stat-ceklis-tuntas');
    const elBelum = container.querySelector('#stat-ceklis-belum');
    const filterBelumCount = container.querySelector('#count-btn-filter-ceklis-belum');
    const filterSudahCount = container.querySelector('#count-btn-filter-ceklis-sudah');

    if (elTuntas) elTuntas.textContent = tuntasCount;
    if (elBelum) elBelum.textContent = belumCount;
    if (filterBelumCount) filterBelumCount.textContent = belumCount;
    if (filterSudahCount) filterSudahCount.textContent = tuntasCount;

    const headerBadge = container.querySelector('#badge-header-ceklis-count');
    if (headerBadge) {
      if (belumCount > 0) {
        headerBadge.textContent = belumCount;
        headerBadge.classList.remove('hidden');
      } else {
        headerBadge.classList.add('hidden');
      }
    }

    // Update Banner Belum Tuntas
    const banner = container.querySelector('#banner-ceklis-belum');
    const bannerCount = container.querySelector('#banner-ceklis-count');
    const bannerNames = container.querySelector('#banner-ceklis-names');

    if (belumCount > 0) {
      banner?.classList.remove('hidden');
      if (bannerCount) bannerCount.textContent = belumCount;
      if (bannerNames) {
        bannerNames.innerHTML = `<strong>Siswa Belum Tuntas:</strong> ${belumNames.join(', ')}`;
      }
    } else {
      banner?.classList.add('hidden');
    }

    applyCeklisTableFilter();
    if (window.lucide) window.lucide.createIcons();
  }

  function bindCeklisRowEvents() {
    container.querySelectorAll('.btn-toggle-siswa-ceklis').forEach(btn => {
      btn.onclick = () => {
        const isCurrentlyChecked = btn.getAttribute('data-checked') === 'true';
        const nextChecked = !isCurrentlyChecked;

        btn.setAttribute('data-checked', nextChecked ? 'true' : 'false');
        if (nextChecked) {
          btn.className = 'btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200';
          btn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i><span>Sudah / Tuntas</span>`;
        } else {
          btn.className = 'btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100';
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-500"></i><span>Belum Tuntas</span>`;
        }

        if (window.lucide) window.lucide.createIcons();
        updateLiveChecklistStats();
      };
    });
  }

  // =========================================================================
  // STATS & FILTER HANDLERS: NILAI TUGAS
  // =========================================================================
  function applyNilaiTableFilter() {
    let visibleCount = 0;
    container.querySelectorAll('.siswa-nilai-row').forEach(row => {
      const statusCat = row.getAttribute('data-status') || 'belum';
      const nama = row.getAttribute('data-nama') || '';

      let matchFilter = true;
      if (localState.currentNilaiFilter === 'belum') matchFilter = statusCat === 'belum';
      else if (localState.currentNilaiFilter === 'remedial') matchFilter = statusCat === 'remedial';
      else if (localState.currentNilaiFilter === 'tuntas') matchFilter = statusCat === 'tuntas';

      let matchSearch = true;
      if (localState.currentNilaiSearch) {
        matchSearch = nama.includes(localState.currentNilaiSearch.toLowerCase());
      }

      if (matchFilter && matchSearch) {
        row.classList.remove('hidden');
        visibleCount++;
      } else {
        row.classList.add('hidden');
      }
    });

    const countEl = container.querySelector('#nilai-table-visible-count');
    if (countEl) countEl.textContent = visibleCount;
  }

  function updateLiveNilaiStats() {
    const isNoTugas = container.querySelector('#check-no-tugas')?.checked === true;
    const badgeIndicator = container.querySelector('#badge-no-tugas-indicator');
    const noticeText = container.querySelector('#no-tugas-notice-text');
    const quickToolbar = container.querySelector('#quick-fill-toolbar');
    const bannerBebasTugas = container.querySelector('#banner-nilai-bebas-tugas');
    const bannerBelumNilai = container.querySelector('#banner-nilai-belum');
    const filterToolbar = container.querySelector('#nilai-filter-toolbar');
    const tableSubNote = container.querySelector('#nilai-table-sub-note');
    const kkmWrapper = container.querySelector('#wrapper-input-kkm');
    const judulInput = container.querySelector('#nilai-input-judul');

    if (isNoTugas) {
      badgeIndicator?.classList.remove('hidden');
      noticeText?.classList.remove('hidden');
      bannerBebasTugas?.classList.remove('hidden');
      bannerBelumNilai?.classList.add('hidden');
      quickToolbar?.classList.add('hidden');
      filterToolbar?.classList.add('hidden');
      kkmWrapper?.classList.add('opacity-40', 'pointer-events-none');
      if (tableSubNote) tableSubNote.textContent = 'Pertemuan Bebas Tugas (Tidak Dinilai)';

      if (judulInput && (judulInput.value === 'Tugas 1: Latihan Pembelajaran' || !judulInput.value.trim())) {
        judulInput.value = 'Materi Pembelajaran (Bebas Tugas)';
      }

      container.querySelectorAll('.siswa-nilai-row').forEach(row => {
        row.setAttribute('data-status', 'tuntas');
        row.classList.remove('hidden');
        const inp = row.querySelector('.input-nilai-item');
        if (inp) {
          inp.disabled = true;
          inp.placeholder = '-';
          inp.className = 'input-nilai-item w-20 text-center font-black text-sm p-2 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl opacity-50';
        }
        const statusCell = row.querySelector('.status-tuntas-cell');
        if (statusCell) {
          statusCell.innerHTML = `<span class="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"><i data-lucide="coffee" class="w-3 h-3"></i> Bebas Tugas</span>`;
        }
      });

      const elAvg = container.querySelector('#stat-rata-rata');
      const elTuntas = container.querySelector('#stat-tuntas');
      const elUnrated = container.querySelector('#stat-nilai-belum');
      if (elAvg) elAvg.textContent = 'Bebas Tugas';
      if (elTuntas) elTuntas.textContent = localState.siswaList.length;
      if (elUnrated) elUnrated.textContent = 0;

      const countEl = container.querySelector('#nilai-table-visible-count');
      if (countEl) countEl.textContent = localState.siswaList.length;

      const headerBadge = container.querySelector('#badge-header-nilai-count');
      if (headerBadge) headerBadge.classList.add('hidden');

      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Mode Normal (Ada Tugas)
    badgeIndicator?.classList.add('hidden');
    noticeText?.classList.add('hidden');
    bannerBebasTugas?.classList.add('hidden');
    quickToolbar?.classList.remove('hidden');
    filterToolbar?.classList.remove('hidden');
    kkmWrapper?.classList.remove('opacity-40', 'pointer-events-none');
    if (tableSubNote) tableSubNote.textContent = 'Masukkan angka 0 - 100';

    let sum = 0;
    let count = 0;
    let tuntas = 0;
    let remed = 0;
    let unrated = 0;
    const unratedNames = [];
    const kkmVal = parseInt(container.querySelector('#nilai-input-kkm')?.value) || 75;

    container.querySelectorAll('.input-nilai-item').forEach(inp => {
      inp.disabled = false;
      const val = parseInt(inp.value);
      const row = inp.closest('.siswa-nilai-row');
      const statusCell = row?.querySelector('.status-tuntas-cell');
      const sId = row?.getAttribute('data-siswa-id');
      const sObj = localState.siswaList.find(x => x.id === sId);
      const nama = sObj ? sObj.nama_lengkap : 'Siswa';

      if (!isNaN(val) && inp.value !== '') {
        sum += val;
        count++;

        if (val >= kkmVal) {
          tuntas++;
          row?.setAttribute('data-status', 'tuntas');
          inp.className = 'input-nilai-item w-20 text-center font-black text-sm p-2 bg-emerald-50/40 border border-emerald-300 text-emerald-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition';
          if (statusCell) statusCell.innerHTML = `<span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">Tuntas</span>`;
        } else {
          remed++;
          row?.setAttribute('data-status', 'remedial');
          inp.className = 'input-nilai-item w-20 text-center font-black text-sm p-2 bg-amber-50/40 border border-amber-300 text-amber-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition';
          if (statusCell) statusCell.innerHTML = `<span class="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">Remedial</span>`;
        }
      } else {
        unrated++;
        unratedNames.push(nama);
        row?.setAttribute('data-status', 'belum');
        inp.className = 'input-nilai-item w-20 text-center font-black text-sm p-2 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition';
        if (statusCell) statusCell.innerHTML = `<span class="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Belum Ada Nilai</span>`;
      }
    });

    const elAvg = container.querySelector('#stat-rata-rata');
    const elTuntas = container.querySelector('#stat-tuntas');
    const elUnrated = container.querySelector('#stat-nilai-belum');
    const filterBelumCount = container.querySelector('#count-btn-filter-nilai-belum');
    const filterRemedCount = container.querySelector('#count-btn-filter-nilai-remed');
    const filterTuntasCount = container.querySelector('#count-btn-filter-nilai-tuntas');

    if (elAvg) elAvg.textContent = count > 0 ? Math.round(sum / count) : '-';
    if (elTuntas) elTuntas.textContent = tuntas;
    if (elUnrated) elUnrated.textContent = unrated;
    if (filterBelumCount) filterBelumCount.textContent = unrated;
    if (filterRemedCount) filterRemedCount.textContent = remed;
    if (filterTuntasCount) filterTuntasCount.textContent = tuntas;

    const headerBadge = container.querySelector('#badge-header-nilai-count');
    if (headerBadge) {
      if (unrated > 0) {
        headerBadge.textContent = unrated;
        headerBadge.classList.remove('hidden');
      } else {
        headerBadge.classList.add('hidden');
      }
    }

    // Update Banner Belum Ada Nilai
    const banner = container.querySelector('#banner-nilai-belum');
    const bannerCount = container.querySelector('#banner-nilai-count');
    const bannerNames = container.querySelector('#banner-nilai-names');

    if (unrated > 0) {
      banner?.classList.remove('hidden');
      if (bannerCount) bannerCount.textContent = unrated;
      if (bannerNames) {
        bannerNames.innerHTML = `<strong>Siswa Belum Ada Nilai:</strong> ${unratedNames.join(', ')}`;
      }
    } else {
      banner?.classList.add('hidden');
    }

    applyNilaiTableFilter();
    if (window.lucide) window.lucide.createIcons();
  }

  function bindNilaiRowEvents() {
    container.querySelectorAll('.input-nilai-item').forEach(inp => {
      inp.oninput = updateLiveNilaiStats;
    });
  }

  // =========================================================================
  // DATA RELOADER: RELOAD CEKLIS SECTION
  // =========================================================================
  async function reloadChecklistData(targetChecklistObj = null) {
    const version = ++ceklisRequestVersion;
    const tbody = container.querySelector('#table-ceklis-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center text-slate-400">
            <div class="flex items-center justify-center gap-2">
              <div class="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Memuat data catatan siswa...</span>
            </div>
          </td>
        </tr>
      `;
    }

    const tgl = targetChecklistObj?.tanggal || container.querySelector('#ceklis-input-tanggal')?.value || localState.today;
    
    try {
      const [sList, attMap] = await Promise.all([
        localState.currentKelasId ? db.getSiswaByKelas(localState.currentKelasId) : Promise.resolve([]),
        localState.currentKelasId ? db.getAttendanceMapByKelasAndTanggal(localState.currentKelasId, tgl, localState.currentMapel) : Promise.resolve({})
      ]);

      if (version !== ceklisRequestVersion) return; // Stale request check

      localState.siswaList = sList;
      localState.ceklisAttendanceMap = attMap;

      // Update Map
      ceklisMap = {};
      if (targetChecklistObj && targetChecklistObj.daftar_ceklis) {
        targetChecklistObj.daftar_ceklis.forEach(d => {
          ceklisMap[d.siswa_id] = {
            is_checked: d.is_checked === true || d.is_checked === 'true',
            catatan: d.catatan || ''
          };
        });
      } else {
        sList.forEach(s => {
          ceklisMap[s.id] = { is_checked: true, catatan: '' };
        });
      }

      if (tbody) {
        tbody.innerHTML = renderCeklisTableRows(sList, ceklisMap, attMap);
      }

      const totalFilterBtn = container.querySelector('#filter-ceklis-all');
      if (totalFilterBtn) totalFilterBtn.textContent = `Semua (${sList.length})`;

      bindCeklisRowEvents();
      updateLiveChecklistStats();
    } catch (err) {
      console.error('Error in reloadChecklistData:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="py-6 text-center text-rose-500 font-semibold">
              Gagal memuat data siswa: ${err.message || err}
            </td>
          </tr>
        `;
      }
    }
  }

  // =========================================================================
  // DATA RELOADER: RELOAD NILAI SECTION
  // =========================================================================
  async function reloadNilaiData(targetNilaiObj = null) {
    const version = ++nilaiRequestVersion;
    const tbody = container.querySelector('#table-nilai-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-400">
            <div class="flex items-center justify-center gap-2">
              <div class="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Memuat data nilai tugas...</span>
            </div>
          </td>
        </tr>
      `;
    }

    const tgl = targetNilaiObj?.tanggal || container.querySelector('#nilai-input-tanggal')?.value || localState.today;
    const kkmVal = parseInt(container.querySelector('#nilai-input-kkm')?.value) || localState.defaultKKM;
    const isNoTugas = container.querySelector('#check-no-tugas')?.checked === true;

    try {
      const [sList, attMap] = await Promise.all([
        localState.currentKelasId ? db.getSiswaByKelas(localState.currentKelasId) : Promise.resolve([]),
        localState.currentKelasId ? db.getAttendanceMapByKelasAndTanggal(localState.currentKelasId, tgl, localState.currentMapel) : Promise.resolve({})
      ]);

      if (version !== nilaiRequestVersion) return; // Stale request check

      localState.siswaList = sList;
      localState.nilaiAttendanceMap = attMap;

      // Update Map
      nilaiMap = {};
      if (targetNilaiObj && targetNilaiObj.daftar_nilai) {
        targetNilaiObj.daftar_nilai.forEach(d => {
          nilaiMap[d.siswa_id] = { nilai: d.nilai, catatan: d.catatan || '' };
        });
      } else {
        sList.forEach(s => {
          nilaiMap[s.id] = { nilai: '', catatan: '' };
        });
      }

      if (tbody) {
        tbody.innerHTML = renderNilaiTableRows(sList, nilaiMap, attMap, kkmVal, isNoTugas);
      }

      const totalFilterBtn = container.querySelector('#filter-nilai-all');
      if (totalFilterBtn) totalFilterBtn.textContent = `Semua (${sList.length})`;

      bindNilaiRowEvents();
      updateLiveNilaiStats();
    } catch (err) {
      console.error('Error in reloadNilaiData:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-6 text-center text-rose-500 font-semibold">
              Gagal memuat data nilai tugas: ${err.message || err}
            </td>
          </tr>
        `;
      }
    }
  }

  // =========================================================================
  // RELOAD HISTORY CONTAINERS (After save/delete without full page refresh)
  // =========================================================================
  async function reloadChecklistHistory() {
    try {
      const list = await db.getAllChecklist(localState.currentYear);
      localState.allChecklist = list;
      const historyContainer = container.querySelector('#ceklis-history-container');
      if (historyContainer) {
        historyContainer.innerHTML = renderChecklistHistoryHTML(list);
      }
      const badge = container.querySelector('#badge-total-ceklis-history');
      if (badge) badge.textContent = `${list.length} Sesi`;

      bindHistoryActionEvents();
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error reloading checklist history:', err);
    }
  }

  async function reloadNilaiHistory() {
    try {
      const list = await db.getAllNilaiTugas(localState.currentYear);
      localState.allNilaiTugas = list;
      const historyContainer = container.querySelector('#nilai-history-container');
      if (historyContainer) {
        historyContainer.innerHTML = renderNilaiHistoryHTML(list);
      }
      const badge = container.querySelector('#badge-total-nilai-history');
      if (badge) badge.textContent = `${list.length} Sesi`;

      bindHistoryActionEvents();
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error reloading nilai history:', err);
    }
  }

  // =========================================================================
  // EDIT & RESET FORM HELPERS (Local In-Place Update)
  // =========================================================================
  function setEditingChecklist(chkObj) {
    localState.activeChecklistId = chkObj?.id || null;
    const formTitle = container.querySelector('#ceklis-form-title');
    const resetBtn = container.querySelector('#btn-reset-ceklis-form');
    const judulInput = container.querySelector('#ceklis-input-judul');
    const tanggalInp = container.querySelector('#ceklis-input-tanggal');
    const chkNoCatatan = container.querySelector('#check-no-catatan');

    if (chkObj) {
      if (formTitle) formTitle.textContent = `Edit Sesi Ceklis: ${chkObj.judul_catatan || ''}`;
      if (resetBtn) resetBtn.classList.remove('hidden');
      if (judulInput) judulInput.value = chkObj.judul_catatan || '';
      if (tanggalInp) tanggalInp.value = chkObj.tanggal || localState.today;
      const isNoCat = chkObj.is_no_catatan === true || chkObj.is_no_catatan === 'true' || chkObj.bebas_catatan === true || chkObj.bebas_catatan === 'true';
      if (chkNoCatatan) chkNoCatatan.checked = isNoCat;

      // Update selected class & mapel if match
      if (chkObj.kelas_id && chkObj.kelas_id !== localState.currentKelasId) {
        localState.currentKelasId = chkObj.kelas_id;
        state.currentKelasId = chkObj.kelas_id;
        initComboboxes();
      }
      if (chkObj.mapel && chkObj.mapel !== localState.currentMapel) {
        localState.currentMapel = chkObj.mapel;
        state.currentMapel = chkObj.mapel;
        initComboboxes();
      }

      reloadChecklistData(chkObj);
    } else {
      // Reset to new checklist form
      if (formTitle) formTitle.textContent = 'Form Ceklis Catatan Siswa Hari Ini';
      if (resetBtn) resetBtn.classList.add('hidden');
      if (judulInput) judulInput.value = 'Ceklis Kelengkapan Buku Catatan & PR';
      if (tanggalInp) tanggalInp.value = localState.today;
      if (chkNoCatatan) chkNoCatatan.checked = false;

      reloadChecklistData(null);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function setEditingNilai(ntObj) {
    localState.activeNilaiId = ntObj?.id || null;
    const formTitle = container.querySelector('#nilai-form-title');
    const resetBtn = container.querySelector('#btn-reset-nilai-form');
    const judulInput = container.querySelector('#nilai-input-judul');
    const tanggalInp = container.querySelector('#nilai-input-tanggal');
    const kkmInp = container.querySelector('#nilai-input-kkm');
    const chkNoTugas = container.querySelector('#check-no-tugas');

    if (ntObj) {
      if (formTitle) formTitle.textContent = `Edit Nilai Tugas: ${ntObj.judul_tugas || ''}`;
      if (resetBtn) resetBtn.classList.remove('hidden');
      if (judulInput) judulInput.value = ntObj.judul_tugas || '';
      if (tanggalInp) tanggalInp.value = ntObj.tanggal || localState.today;
      if (kkmInp) kkmInp.value = ntObj.kkm || localState.defaultKKM;
      const isNoTug = ntObj.is_no_tugas === true || ntObj.is_no_tugas === 'true';
      if (chkNoTugas) chkNoTugas.checked = isNoTug;

      // Update selected class & mapel if match
      if (ntObj.kelas_id && ntObj.kelas_id !== localState.currentKelasId) {
        localState.currentKelasId = ntObj.kelas_id;
        state.currentKelasId = ntObj.kelas_id;
        initComboboxes();
      }
      if (ntObj.mapel && ntObj.mapel !== localState.currentMapel) {
        localState.currentMapel = ntObj.mapel;
        state.currentMapel = ntObj.mapel;
        initComboboxes();
      }

      reloadNilaiData(ntObj);
    } else {
      // Reset to new nilai form
      if (formTitle) formTitle.textContent = 'Input Nilai Tugas Baru';
      if (resetBtn) resetBtn.classList.add('hidden');
      if (judulInput) judulInput.value = 'Tugas 1: Latihan Pembelajaran';
      if (tanggalInp) tanggalInp.value = localState.today;
      if (kkmInp) kkmInp.value = localState.defaultKKM;
      if (chkNoTugas) chkNoTugas.checked = false;

      reloadNilaiData(null);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // COMBOBOX & FILTER UPDATE LOGIC (Partial update without page reload)
  // =========================================================================
  async function handleKelasSelection(newKelasId) {
    if (!newKelasId || newKelasId === localState.currentKelasId) return;

    const requestVer = ++kelasRequestVersion;
    localState.currentKelasId = newKelasId;
    state.currentKelasId = newKelasId;
    localState.activeChecklistId = null;
    localState.activeNilaiId = null;

    try {
      const newMapelList = await db.getMapelSaya(localState.currentYear, newKelasId);
      if (requestVer !== kelasRequestVersion) return; // Stale request protection

      localState.mapelList = newMapelList;
      const matchingMapel = newMapelList.some(m => m.nama_mapel === localState.currentMapel)
        ? localState.currentMapel
        : (newMapelList[0]?.nama_mapel || '');

      localState.currentMapel = matchingMapel;
      state.currentMapel = matchingMapel;

      initComboboxes();

      // Reload active subtab data immediately
      if (localState.subTab === 'ceklis') {
        reloadChecklistData(null);
      } else {
        reloadNilaiData(null);
      }
    } catch (err) {
      console.error('Error handling class selection:', err);
      showToast(`Gagal memuat mata pelajaran kelas: ${err.message || err}`, 'error');
    }
  }

  function handleMapelSelection(newMapel) {
    if (newMapel === localState.currentMapel) return;
    localState.currentMapel = newMapel;
    state.currentMapel = newMapel;

    if (localState.subTab === 'ceklis') {
      reloadChecklistData(null);
    } else {
      reloadNilaiData(null);
    }
  }

  function initComboboxes() {
    // 1. Ceklis Comboboxes
    const wrapCeklisKelas = container.querySelector('#wrapper-ceklis-select-kelas');
    if (wrapCeklisKelas) {
      wrapCeklisKelas.innerHTML = `
        <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas Target</label>
        ${renderClassComboboxHTML({
          id: 'ceklis-select-kelas',
          kelasList: localState.kelasList,
          selectedId: localState.currentKelasId,
          size: 'sm'
        })}
      `;
      initClassCombobox(container, {
        id: 'ceklis-select-kelas',
        kelasList: localState.kelasList,
        selectedId: localState.currentKelasId,
        size: 'sm',
        onSelect: handleKelasSelection
      });
    }

    const wrapCeklisMapel = container.querySelector('#wrapper-ceklis-select-mapel');
    if (wrapCeklisMapel) {
      wrapCeklisMapel.innerHTML = `
        <label class="block text-xs font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
        ${renderMapelComboboxHTML({
          id: 'ceklis-select-mapel',
          mapelList: localState.mapelList,
          selectedValue: localState.currentMapel,
          size: 'sm',
          allowManage: false
        })}
      `;
      initMapelCombobox(container, {
        id: 'ceklis-select-mapel',
        mapelList: localState.mapelList,
        selectedValue: localState.currentMapel,
        size: 'sm',
        allowManage: false,
        onSelect: handleMapelSelection
      });
    }

    // 2. Nilai Comboboxes
    const wrapNilaiKelas = container.querySelector('#wrapper-nilai-select-kelas');
    if (wrapNilaiKelas) {
      wrapNilaiKelas.innerHTML = `
        <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas</label>
        ${renderClassComboboxHTML({
          id: 'nilai-select-kelas',
          kelasList: localState.kelasList,
          selectedId: localState.currentKelasId,
          size: 'sm'
        })}
      `;
      initClassCombobox(container, {
        id: 'nilai-select-kelas',
        kelasList: localState.kelasList,
        selectedId: localState.currentKelasId,
        size: 'sm',
        onSelect: handleKelasSelection
      });
    }

    const wrapNilaiMapel = container.querySelector('#wrapper-nilai-select-mapel');
    if (wrapNilaiMapel) {
      wrapNilaiMapel.innerHTML = `
        <label class="block text-xs font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
        ${renderMapelComboboxHTML({
          id: 'nilai-select-mapel',
          mapelList: localState.mapelList,
          selectedValue: localState.currentMapel,
          size: 'sm',
          allowManage: false
        })}
      `;
      initMapelCombobox(container, {
        id: 'nilai-select-mapel',
        mapelList: localState.mapelList,
        selectedValue: localState.currentMapel,
        size: 'sm',
        allowManage: false,
        onSelect: handleMapelSelection
      });
    }
  }

  // Inisialisasi awal Comboboxes & DatePickers
  initComboboxes();

  initDatePicker(container, {
    id: 'ceklis-input-tanggal',
    value: currentChecklistObj?.tanggal || today,
    size: 'sm',
    onChange: (d) => {
      const inp = container.querySelector('#ceklis-input-tanggal');
      if (inp) inp.value = d;
      reloadChecklistData(null);
    }
  });

  initDatePicker(container, {
    id: 'nilai-input-tanggal',
    value: currentNilaiObj?.tanggal || today,
    size: 'sm',
    onChange: (d) => {
      const inp = container.querySelector('#nilai-input-tanggal');
      if (inp) inp.value = d;
      reloadNilaiData(null);
    }
  });

  // Initial event bindings for rows
  bindCeklisRowEvents();
  bindNilaiRowEvents();
  updateLiveChecklistStats();
  updateLiveNilaiStats();

  // =========================================================================
  // CEKLIS TOOLBAR & FORM EVENTS
  // =========================================================================
  container.querySelector('#check-no-catatan')?.addEventListener('change', updateLiveChecklistStats);

  container.querySelectorAll('.btn-filter-ceklis').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.btn-filter-ceklis').forEach(b => {
        b.className = 'btn-filter-ceklis px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition';
      });
      btn.className = 'btn-filter-ceklis px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs transition';
      localState.currentCeklisFilter = btn.getAttribute('data-filter') || 'all';
      applyCeklisTableFilter();
    });
  });

  const inpSearchCeklis = container.querySelector('#search-ceklis-siswa');
  inpSearchCeklis?.addEventListener('input', (e) => {
    localState.currentCeklisSearch = e.target.value.trim();
    applyCeklisTableFilter();
  });

  container.querySelector('#btn-ceklis-check-all')?.addEventListener('click', () => {
    container.querySelectorAll('.btn-toggle-siswa-ceklis').forEach(btn => {
      btn.setAttribute('data-checked', 'true');
      btn.className = 'btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200';
      btn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i><span>Sudah / Tuntas</span>`;
    });
    if (window.lucide) window.lucide.createIcons();
    updateLiveChecklistStats();
    showToast('Semua siswa ditandai sudah / tercentang', 'info');
  });

  container.querySelector('#btn-ceklis-uncheck-all')?.addEventListener('click', () => {
    container.querySelectorAll('.btn-toggle-siswa-ceklis').forEach(btn => {
      btn.setAttribute('data-checked', 'false');
      btn.className = 'btn-toggle-siswa-ceklis w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100';
      btn.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-500"></i><span>Belum Tuntas</span>`;
    });
    if (window.lucide) window.lucide.createIcons();
    updateLiveChecklistStats();
  });

  container.querySelector('#btn-reset-ceklis-form')?.addEventListener('click', () => {
    setEditingChecklist(null);
  });

  container.querySelector('#btn-copy-wa-belum-ceklis')?.addEventListener('click', () => {
    const belumList = [];
    container.querySelectorAll('.siswa-ceklis-row').forEach(row => {
      if (row.getAttribute('data-checked') === 'false') {
        const sId = row.getAttribute('data-siswa-id');
        const sObj = localState.siswaList.find(x => x.id === sId);
        if (sObj) belumList.push(`- ${sObj.nama_lengkap}`);
      }
    });

    if (belumList.length === 0) {
      showToast('Semua siswa sudah tuntas!', 'info');
      return;
    }

    const tgl = container.querySelector('#ceklis-input-tanggal')?.value || localState.today;
    const judul = container.querySelector('#ceklis-input-judul')?.value || 'Ceklis Catatan';
    const activeKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);
    const textWA = `📢 *PEMBERITAHUAN TUGAS/CATATAN BELUM TUNTAS*\nKelas: ${activeKelasObj?.nama_kelas || 'Kelas'}\nMapel: ${localState.currentMapel}\nTopik: ${judul} (${tgl})\n\nBerikut ${belumList.length} siswa yang belum tuntas:\n${belumList.join('\n')}\n\n_Mohon segera diselesaikan. Terima kasih!_`;

    navigator.clipboard.writeText(textWA).then(() => {
      showToast('Daftar siswa belum tuntas berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
      prompt('Salin teks laporan WA berikut:', textWA);
    });
  });

  // Save Catatan Ceklis
  container.querySelector('#btn-save-ceklis')?.addEventListener('click', async () => {
    const judul = container.querySelector('#ceklis-input-judul')?.value?.trim() || '';
    const tgl = container.querySelector('#ceklis-input-tanggal')?.value || localState.today;
    const targetKelasId = localState.currentKelasId;
    const targetMapel = localState.currentMapel;

    if (!judul) {
      showToast('Harap masukkan topik / agenda ceklis catatan!', 'error');
      return;
    }
    if (!targetKelasId) {
      showToast('Harap pilih kelas terlebih dahulu!', 'error');
      return;
    }
    if (!targetMapel) {
      showToast('Harap pilih mata pelajaran terlebih dahulu!', 'error');
      return;
    }

    const daftarCeklis = [];
    container.querySelectorAll('.siswa-ceklis-row').forEach(row => {
      const sId = row.getAttribute('data-siswa-id');
      const isChecked = row.querySelector('.btn-toggle-siswa-ceklis')?.getAttribute('data-checked') === 'true';
      const cat = row.querySelector('.input-ceklis-catatan')?.value || '';
      daftarCeklis.push({
        siswa_id: sId,
        is_checked: isChecked,
        catatan: cat.trim()
      });
    });

    const isNoCatatan = container.querySelector('#check-no-catatan')?.checked === true;
    const saveBtn = container.querySelector('#btn-save-ceklis');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Menyimpan...</span>`;
    }

    try {
      const res = await db.saveChecklist({
        id: localState.activeChecklistId || null,
        kelas_id: targetKelasId,
        mapel: targetMapel,
        tanggal: tgl,
        judul_catatan: judul,
        is_no_catatan: isNoCatatan,
        bebas_catatan: isNoCatatan,
        daftar_ceklis: daftarCeklis
      });

      if (res.success) {
        showToast(isNoCatatan ? 'Sesi Bebas Catatan berhasil disimpan ke database!' : 'Catatan ceklis siswa berhasil disimpan ke database!', 'success');
        localState.activeChecklistId = res.id;
        reloadChecklistHistory();
      } else {
        showToast(`Gagal menyimpan ke Supabase: ${res.error || 'Periksa koneksi database'}`, 'error');
        if (res.savedLocally) {
          localState.activeChecklistId = res.id;
          reloadChecklistHistory();
        }
      }
    } catch (err) {
      console.error('Error in saveChecklist handler:', err);
      showToast(`Terjadi kesalahan saat menyimpan: ${err.message || err}`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Catatan Ceklis</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  });

  // =========================================================================
  // NILAI TOOLBAR & FORM EVENTS
  // =========================================================================
  container.querySelector('#check-no-tugas')?.addEventListener('change', updateLiveNilaiStats);
  container.querySelector('#nilai-input-kkm')?.addEventListener('input', updateLiveNilaiStats);

  container.querySelectorAll('.btn-filter-nilai').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.btn-filter-nilai').forEach(b => {
        b.className = 'btn-filter-nilai px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition';
      });
      btn.className = 'btn-filter-nilai px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs transition';
      localState.currentNilaiFilter = btn.getAttribute('data-filter') || 'all';
      applyNilaiTableFilter();
    });
  });

  const inpSearchNilai = container.querySelector('#search-nilai-siswa');
  inpSearchNilai?.addEventListener('input', (e) => {
    localState.currentNilaiSearch = e.target.value.trim();
    applyNilaiTableFilter();
  });

  container.querySelector('#btn-reset-nilai-form')?.addEventListener('click', () => {
    setEditingNilai(null);
  });

  container.querySelectorAll('.btn-fill-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-val');
      container.querySelectorAll('.input-nilai-item').forEach(inp => {
        inp.value = v;
      });
      updateLiveNilaiStats();
      showToast(`Nilai semua siswa diisi: ${v}`, 'info');
    });
  });

  container.querySelector('#btn-clear-nilai')?.addEventListener('click', () => {
    container.querySelectorAll('.input-nilai-item').forEach(inp => {
      inp.value = '';
    });
    updateLiveNilaiStats();
  });

  initQuickFillNilai({
    container,
    inputSelector: '.input-nilai-item',
    onSelect: () => {
      updateLiveNilaiStats();
    }
  });

  container.querySelector('#btn-copy-wa-belum-nilai')?.addEventListener('click', () => {
    const unratedList = [];
    container.querySelectorAll('.siswa-nilai-row').forEach(row => {
      if (row.getAttribute('data-status') === 'belum') {
        const sId = row.getAttribute('data-siswa-id');
        const sObj = localState.siswaList.find(x => x.id === sId);
        if (sObj) unratedList.push(`- ${sObj.nama_lengkap}`);
      }
    });

    if (unratedList.length === 0) {
      showToast('Semua siswa sudah memiliki nilai!', 'info');
      return;
    }

    const tgl = container.querySelector('#nilai-input-tanggal')?.value || localState.today;
    const judul = container.querySelector('#nilai-input-judul')?.value || 'Tugas Siswa';
    const activeKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);
    const textWA = `📢 *TAGIHAN TUGAS SISWA BELUM MENGUMPULKAN*\nKelas: ${activeKelasObj?.nama_kelas || 'Kelas'}\nMapel: ${localState.currentMapel}\nTugas: ${judul} (${tgl})\n\nBerikut ${unratedList.length} siswa yang belum ada nilai / belum mengumpulkan tugas:\n${unratedList.join('\n')}\n\n_Mohon segera mengumpulkan tugas ke guru pengampu. Terima kasih!_`;

    navigator.clipboard.writeText(textWA).then(() => {
      showToast('Daftar tagihan tugas berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
      prompt('Salin teks tagihan WA berikut:', textWA);
    });
  });

  // Save Nilai Tugas
  container.querySelector('#btn-save-nilai-tugas')?.addEventListener('click', async () => {
    const judul = container.querySelector('#nilai-input-judul')?.value?.trim() || '';
    const tgl = container.querySelector('#nilai-input-tanggal')?.value || localState.today;
    const kkm = parseInt(container.querySelector('#nilai-input-kkm')?.value) || 75;
    const isNoTugas = container.querySelector('#check-no-tugas')?.checked === true;
    const targetKelasId = localState.currentKelasId;
    const targetMapel = localState.currentMapel;

    if (!judul) {
      showToast('Harap masukkan nama / judul tugas atau topik pembelajaran!', 'error');
      return;
    }
    if (!targetKelasId) {
      showToast('Harap pilih kelas terlebih dahulu!', 'error');
      return;
    }
    if (!targetMapel) {
      showToast('Harap pilih mata pelajaran terlebih dahulu!', 'error');
      return;
    }

    const daftarNilai = [];
    container.querySelectorAll('.siswa-nilai-row').forEach(row => {
      const sId = row.getAttribute('data-siswa-id');
      const val = isNoTugas ? '' : (row.querySelector('.input-nilai-item')?.value || '');
      const cat = row.querySelector('.input-catatan-item')?.value || '';
      daftarNilai.push({
        siswa_id: sId,
        nilai: val,
        catatan: cat.trim()
      });
    });

    const saveBtn = container.querySelector('#btn-save-nilai-tugas');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Menyimpan...</span>`;
    }

    try {
      const res = await db.saveNilaiTugas({
        id: localState.activeNilaiId || null,
        kelas_id: targetKelasId,
        mapel: targetMapel,
        tanggal: tgl,
        judul_tugas: judul,
        kkm,
        is_no_tugas: isNoTugas,
        daftar_nilai: daftarNilai
      });

      if (res.success) {
        showToast(isNoTugas ? 'Sesi Bebas Tugas berhasil disimpan ke database!' : 'Daftar nilai tugas berhasil disimpan ke database!', 'success');
        localState.activeNilaiId = res.id;
        reloadNilaiHistory();
      } else {
        showToast(`Gagal menyimpan ke Supabase: ${res.error || 'Periksa koneksi database'}`, 'error');
        if (res.savedLocally) {
          localState.activeNilaiId = res.id;
          reloadNilaiHistory();
        }
      }
    } catch (err) {
      console.error('Error in saveNilaiTugas handler:', err);
      showToast(`Terjadi kesalahan saat menyimpan: ${err.message || err}`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Daftar Nilai</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  });

  // =========================================================================
  // BIND HISTORY ACTIONS (Edit & Delete In-Place without full page reload)
  // =========================================================================
  function bindHistoryActionEvents() {
    // Edit Ceklis
    container.querySelectorAll('.btn-edit-saved-ceklis').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const chk = localState.allChecklist.find(c => c.id === id);
        if (chk) {
          setEditingChecklist(chk);
          showToast(`Membuka sesi ceklis: ${chk.judul_catatan}`, 'info');
        }
      };
    });

    // Delete Ceklis
    container.querySelectorAll('.btn-delete-saved-ceklis').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        if (id && confirm('Apakah Anda yakin ingin menghapus data ceklis catatan ini?')) {
          await db.deleteChecklist(id);
          showToast('Data ceklis catatan berhasil dihapus', 'info');
          if (localState.activeChecklistId === id) {
            setEditingChecklist(null);
          }
          reloadChecklistHistory();
        }
      };
    });

    // Edit Nilai
    container.querySelectorAll('.btn-edit-saved-nilai').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const nt = localState.allNilaiTugas.find(n => n.id === id);
        if (nt) {
          setEditingNilai(nt);
          showToast(`Membuka sesi tugas: ${nt.judul_tugas}`, 'info');
        }
      };
    });

    // Delete Nilai
    container.querySelectorAll('.btn-delete-saved-nilai').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        if (id && confirm('Apakah Anda yakin ingin menghapus data nilai tugas ini?')) {
          await db.deleteNilaiTugas(id);
          showToast('Data nilai tugas berhasil dihapus', 'info');
          if (localState.activeNilaiId === id) {
            setEditingNilai(null);
          }
          reloadNilaiHistory();
        }
      };
    });
  }

  bindHistoryActionEvents();

  // =========================================================================
  // PRINT ACTION HANDLERS
  // =========================================================================
  container.querySelector('#btn-print-ceklis')?.addEventListener('click', () => {
    const judul = container.querySelector('#ceklis-input-judul').value.trim() || 'Lembar Ceklis Catatan Siswa';
    const tgl = container.querySelector('#ceklis-input-tanggal').value;
    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
    const activeKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${judul} - ${activeKelasObj?.nama_kelas || 'Kelas'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 16px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 12px; font-weight: bold; }
            .meta { margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #444; padding: 6px 8px; }
            th { background: #f0f0f0; text-align: center; }
            .text-center { text-align: center; }
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
              <p class="title">LEMBAR CATATAN CEKLIS SISWA • Mata Pelajaran: ${localState.currentMapel} • Topik: ${judul}</p>
            </div>
          </div>

          <div class="meta">
            <div>
              <strong>Kelas:</strong> ${activeKelasObj?.nama_kelas || 'Kelas'} (${activeKelasObj?.jurusan || 'TJKT'})<br>
              <strong>Tanggal:</strong> ${tgl}
            </div>
            <div style="text-align: right;">
              <strong>Guru Mapel:</strong> ${profil.nama_guru || 'Guru Mapel'}<br>
              <strong>Total Siswa:</strong> ${localState.siswaList.length} Orang
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th>Nama Lengkap Siswa</th>
                <th style="width: 45px;">L/P</th>
                <th style="width: 100px;">Status Ceklis</th>
                <th>Keterangan / Catatan Khusus</th>
              </tr>
            </thead>
            <tbody>
              ${localState.siswaList.map((s, i) => {
                const isChecked = container.querySelector(`.btn-toggle-siswa-ceklis[data-siswa-id="${s.id}"]`)?.getAttribute('data-checked') === 'true';
                const cat = container.querySelector(`.input-ceklis-catatan[data-siswa-id="${s.id}"]`)?.value || '-';

                return `
                  <tr>
                    <td class="text-center">${s.nomor_absen || (i + 1)}</td>
                    <td>${s.nama_lengkap}</td>
                    <td class="text-center">${s.jenis_kelamin || '-'}</td>
                    <td class="text-center font-bold">${isChecked ? '☑️ SUDAH / TUNTAS' : '❌ BELUM TUNTAS'}</td>
                    <td>${cat}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer-sign">
            <div class="sign-col">
              <p>Mengetahui,<br>Kepala Sekolah</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_kepsek || 'Kepala Sekolah'}</strong></u><br>${profil.nip_kepsek ? 'NIP. ' + profil.nip_kepsek : 'NIP. -'}</p>
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
  });

  container.querySelector('#btn-print-nilai')?.addEventListener('click', () => {
    const judul = container.querySelector('#nilai-input-judul').value.trim() || 'Daftar Nilai Tugas';
    const tgl = container.querySelector('#nilai-input-tanggal').value;
    const kkmVal = parseInt(container.querySelector('#nilai-input-kkm').value) || 75;
    const isNoTugas = container.querySelector('#check-no-tugas')?.checked === true;
    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
    const activeKelasObj = localState.kelasList.find(k => k.id === localState.currentKelasId);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${judul} - ${activeKelasObj?.nama_kelas || 'Kelas'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 16px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 12px; font-weight: bold; }
            .meta { margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #444; padding: 6px 8px; }
            th { background: #f0f0f0; text-align: center; }
            .text-center { text-align: center; }
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
              <p class="title">${isNoTugas ? 'LEMBAR LAPORAN PERTEMUAN (BEBAS TUGAS)' : 'DAFTAR NILAI TUGAS SISWA'} • Mapel: ${localState.currentMapel} • Topik: ${judul}</p>
            </div>
          </div>

          <div class="meta">
            <div>
              <strong>Kelas:</strong> ${activeKelasObj?.nama_kelas || 'Kelas'} (${activeKelasObj?.jurusan || 'TJKT'})<br>
              <strong>Tanggal:</strong> ${tgl}<br>
              <strong>Status Pertemuan:</strong> ${isNoTugas ? 'BEBAS TUGAS (Materi / Diskusi)' : 'Penilaian Berkelanjutan (KKM: ' + kkmVal + ')'}
            </div>
            <div style="text-align: right;">
              <strong>Guru Mapel:</strong> ${profil.nama_guru || 'Guru Mapel'}<br>
              <strong>Total Siswa:</strong> ${localState.siswaList.length} Orang
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th>Nama Lengkap Siswa</th>
                <th style="width: 45px;">L/P</th>
                <th style="width: 60px;">Nilai</th>
                <th style="width: 100px;">Status</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${localState.siswaList.map((s, i) => {
                const val = container.querySelector(`.input-nilai-item[data-siswa-id="${s.id}"]`)?.value || '';
                const cat = container.querySelector(`.input-catatan-item[data-siswa-id="${s.id}"]`)?.value || '-';
                const num = parseInt(val);
                const isFilled = !isNaN(num) && val !== '';
                const isTuntas = isFilled && num >= kkmVal;

                return `
                  <tr>
                    <td class="text-center">${s.nomor_absen || (i + 1)}</td>
                    <td>${s.nama_lengkap}</td>
                    <td class="text-center">${s.jenis_kelamin || '-'}</td>
                    <td class="text-center"><strong>${isNoTugas ? '-' : (val || '-')}</strong></td>
                    <td class="text-center font-bold">${isNoTugas ? 'BEBAS TUGAS' : (!isFilled ? 'BELUM ADA NILAI' : (isTuntas ? 'TUNTAS' : 'REMEDIAL'))}</td>
                    <td>${cat}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer-sign">
            <div class="sign-col">
              <p>Mengetahui,<br>Kepala Sekolah</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_kepsek || 'Kepala Sekolah'}</strong></u><br>${profil.nip_kepsek ? 'NIP. ' + profil.nip_kepsek : 'NIP. -'}</p>
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
  });

  // Navigasi ke Pemeriksaan Catatan & Tugas (Genuine Tab Navigation)
  container.querySelectorAll('.btn-goto-pemeriksaan').forEach(btn => {
    btn.addEventListener('click', () => {
      onStateChange({ activeTab: 'pemeriksaan-tugas' });
    });
  });

  if (window.lucide) window.lucide.createIcons();
}
