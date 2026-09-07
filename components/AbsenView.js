import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
// components/AbsenView.js - Modul Form Absensi Siswa Mobile-First
import { db } from '../supabase-client.js';

export async function renderAbsenView(container, state, onStateChange, showToast, onNavigateToJurnal, onOpenModal) {
  // Ambil daftar kelas yang diajar oleh guru aktif (Strict Per-User)
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
            Anda belum memiliki penugasan jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong>. Silakan tambahkan jadwal mengajar Anda terlebih dahulu.
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
  const mapelList = await db.getMapelSaya(currentYear, currentKelasId);

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
  const currentMapel = (mapelList.some(m => m.nama_mapel === state.currentMapel) ? state.currentMapel : (mapelList[0]?.nama_mapel || ''));
  const currentTanggal = state.currentTanggal || new Date().toISOString().split('T')[0];

  // Ambil data sesi, siswa, kegiatan, checklist, dan jadwal hari ini secara PARALEL
  const [siswaList, kegiatanHariIni, checklistHariIni, existingSesi, jadwalHariIni] = await Promise.all([
    db.getSiswaByKelas(currentKelasId),
    db.getKegiatanSiswaByTanggal(currentTanggal),
    db.getChecklistHariIni(currentTanggal, currentYear),
    db.findSesi(currentKelasId, currentMapel, currentTanggal),
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

  // Hitung ringkasan status
  function getCounts() {
    let h = 0, s = 0, i = 0, a = 0;
    siswaList.forEach(sis => {
      const st = attendanceMap[sis.id]?.status || 'Hadir';
      if (st === 'Hadir') h++;
      else if (st === 'Sakit') s++;
      else if (st === 'Izin') i++;
      else if (st === 'Alfa') a++;
    });
    return { h, s, i, a, total: siswaList.length };
  }

  const counts = getCounts();
  const selectedKelasObj = kelasList.find(k => k.id === currentKelasId);

  container.innerHTML = `
    <div class="space-y-4 pb-24 max-w-4xl mx-auto">
      
      <!-- Banner Saran Jadwal Mengajar Hari Ini (100% Pasif & Opt-In) -->
      ${(jadwalHariIni?.jadwalList || []).length > 0 ? `
        <div class="bg-gradient-to-r from-emerald-900/90 via-teal-900 to-slate-900 text-white p-4 rounded-2xl shadow-xs border border-emerald-700/40 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/30">
                <i data-lucide="calendar-clock" class="w-4 h-4"></i>
              </span>
              <div>
                <span class="text-xs font-black tracking-tight block">Jadwal Mengajar Hari Ini (${jadwalHariIni.hari})</span>
                <span class="text-[10px] text-emerald-200/80">Saran jadwal rutin mingguan. Klik tombol untuk memuat kelas & mapel ke form absen.</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            ${jadwalHariIni.jadwalList.map(j => {
              const isActive = j.kelas_id === currentKelasId && j.mapel === currentMapel;
              const mulaiTrim = (j.jam_mulai || '').substring(0, 5);
              const selesaiTrim = (j.jam_selesai || '').substring(0, 5);
              return `
                <div class="p-2.5 rounded-xl ${isActive ? 'bg-emerald-600/40 border-emerald-400' : 'bg-white/10 hover:bg-white/15 border-white/10'} border flex items-center justify-between gap-2 transition">
                  <div class="min-w-0">
                    <div class="font-extrabold text-xs text-white truncate">${j.nama_kelas}</div>
                    <div class="text-[10px] text-emerald-200 truncate font-semibold">${j.mapel}</div>
                    <div class="text-[9px] text-slate-300 font-mono mt-0.5">${j.jam_ke_label || 'Jam KBM'} (${mulaiTrim}-${selesaiTrim})</div>
                  </div>
                  <button
                    type="button"
                    class="btn-select-jadwal px-2.5 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-1 flex-shrink-0 ${isActive ? 'bg-emerald-400 text-emerald-950 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-slate-700'}"
                    data-kelas-id="${j.kelas_id}"
                    data-mapel="${j.mapel}"
                  >
                    <span>${isActive ? 'Sedang Aktif' : 'Pilih Sesi'}</span>
                    ${isActive ? '<i data-lucide="check" class="w-3 h-3"></i>' : '<i data-lucide="arrow-right" class="w-3 h-3"></i>'}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

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
          
          ${existingSesi ? `
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              Sesi Tersimpan
            </span>
          ` : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Pilih Kelas (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Kelas</label>
            ${renderClassComboboxHTML({
              id: 'select-kelas',
              kelasList,
              selectedId: currentKelasId
            })}
          </div>

          <!-- Pilih Mapel (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Mata Pelajaran</label>
            ${renderMapelComboboxHTML({
              id: 'select-mapel',
              mapelList,
              selectedValue: currentMapel,
              size: 'md',
              allowManage: true
            })}
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
          <button id="btn-set-all-hadir" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow transition transform active:scale-95">
            <i data-lucide="check-check" class="w-4 h-4"></i>
            <span>Set Semua Hadir</span>
          </button>
          
          <button id="btn-link-jurnal" class="bg-slate-700/80 hover:bg-slate-600 text-slate-100 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 border border-slate-600 transition">
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
            Total: <strong>${counts.total}</strong>
          </span>
        </div>
      </div>

      <!-- Banner Catatan Ceklis Hari Ini jika ada -->
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

      <!-- Petunjuk Singkat -->
      <div class="flex items-center justify-between text-xs text-slate-500 px-2">
        <span>Klik tombol status <strong class="text-emerald-700 font-bold">H</strong> (Hadir), <strong class="text-amber-600 font-bold">S</strong> (Sakit), <strong class="text-sky-600 font-bold">I</strong> (Izin), <strong class="text-rose-600 font-bold">A</strong> (Alfa)</span>
        <span>Daftar Siswa: <strong>${selectedKelasObj?.nama_kelas || 'Kelas'}</strong></span>
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
                Silakan pilih kelas dan mata pelajaran pada formulir di atas, atau klik salah satu slot dari <strong>Jadwal Mengajar Hari Ini</strong> untuk memulai presensi.
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
          const kegiatanList = kegiatanMap[siswa.id] || [];
          const hasKegiatan = kegiatanList.length > 0;

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
                      <button class="btn-view-kegiatan inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse transition" data-kegiatan='${JSON.stringify(kegiatanList).replace(/'/g, "&apos;")}' title="Klik untuk lihat rincian kegiatan">
                        <i data-lucide="sparkles" class="w-3 h-3 text-amber-600"></i>
                        <span>${kegiatanList[0].kategori}</span>
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
                <!-- Hadir -->
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Hadir' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500' : 'bg-slate-100 hover:bg-emerald-50 text-slate-700'}" data-status="Hadir" data-siswa-id="${siswa.id}">
                  H
                </button>

                <!-- Sakit -->
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Sakit' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400' : 'bg-slate-100 hover:bg-amber-50 text-slate-700'}" data-status="Sakit" data-siswa-id="${siswa.id}">
                  S
                </button>

                <!-- Izin -->
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Izin' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 ring-2 ring-sky-400' : 'bg-slate-100 hover:bg-sky-50 text-slate-700'}" data-status="Izin" data-siswa-id="${siswa.id}">
                  I
                </button>

                <!-- Alfa -->
                <button type="button" class="btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${currentStatus === 'Alfa' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-500' : 'bg-slate-100 hover:bg-rose-50 text-slate-700'}" data-status="Alfa" data-siswa-id="${siswa.id}">
                  A
                </button>

                <!-- Tombol Catatan Per Siswa -->
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
            <p class="text-xs font-semibold text-slate-800">${selectedKelasObj?.nama_kelas || 'Kelas'} • ${currentMapel}</p>
            <p class="text-[11px] text-slate-500">Tanggal: ${currentTanggal}</p>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button id="btn-save-absen" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition transform active:scale-95">
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
          <button id="btn-close-modal-kegiatan" class="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div id="modal-kegiatan-body" class="space-y-3 max-h-80 overflow-y-auto pr-1">
          <!-- Injected via JS -->
        </div>
        <div class="pt-2 border-t border-slate-100 flex justify-end">
          <button id="btn-modal-kegiatan-ok" class="bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-700 transition">
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
          <button id="btn-close-modal-note" class="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Keterangan Tambahan (misal: "Datang telat 15 menit", "Sakit demam", dll.)</label>
          <textarea id="input-siswa-note" rows="3" class="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Tulis catatan..."></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button id="btn-save-note" class="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition">
            Simpan Catatan
          </button>
        </div>
      </div>
    </div>
  `;

  // Helper untuk refresh status counts di UI
  function updateLiveCounters() {
    const c = getCounts();
    const elH = container.querySelector('#stat-h');
    const elS = container.querySelector('#stat-s');
    const elI = container.querySelector('#stat-i');
    const elA = container.querySelector('#stat-a');
    if (elH) elH.textContent = c.h;
    if (elS) elS.textContent = c.s;
    if (elI) elI.textContent = c.i;
    if (elA) elA.textContent = c.a;
  }

  // Event: Ganti Filter Sesi
  const selectKelas = container.querySelector('#select-kelas');
  const selectMapel = container.querySelector('#select-mapel');
  const inputTanggal = container.querySelector('#input-tanggal');

  async function triggerSessionReload() {
    if (selectMapel.value === '__ADD_NEW_MAPEL__') {
      selectMapel.value = currentMapel;
      if (onOpenModal) onOpenModal('mapel');
      return;
    }
    const newKId = selectKelas?.value || currentKelasId;
    const newMapelList = await db.getMapelSaya(currentYear, newKId);
    const newMapel = newMapelList.some(m => m.nama_mapel === selectMapel.value)
      ? selectMapel.value
      : (newMapelList[0]?.nama_mapel || '');

    onStateChange({
      currentKelasId: newKId,
      currentMapel: newMapel,
      currentTanggal: inputTanggal.value,
      currentAttendanceMap: null // reload from storage/session
    });
  }

  initDatePicker(container, {
    id: 'input-tanggal',
    value: currentTanggal,
    onChange: (newDate) => {
      onStateChange({
        currentKelasId: selectKelas?.value || currentKelasId,
        currentMapel: selectMapel?.value || currentMapel,
        currentTanggal: newDate,
        currentAttendanceMap: null
      });
    }
  });

  initClassCombobox(container, {
    id: 'select-kelas',
    kelasList,
    selectedId: currentKelasId,
    onSelect: async (newKId) => {
      const newMapelList = await db.getMapelSaya(currentYear, newKId);
      const newMapel = newMapelList.some(m => m.nama_mapel === currentMapel)
        ? currentMapel
        : (newMapelList[0]?.nama_mapel || '');

      onStateChange({
        currentKelasId: newKId,
        currentMapel: newMapel,
        currentTanggal: inputTanggal?.value || currentTanggal,
        currentAttendanceMap: null
      });
    }
  });

  initMapelCombobox(container, {
    id: 'select-mapel',
    mapelList,
    selectedValue: currentMapel,
    size: 'md',
    allowManage: true,
    onSelect: (newMapel) => {
      onStateChange({
        currentKelasId: selectKelas?.value || currentKelasId,
        currentMapel: newMapel,
        currentTanggal: inputTanggal?.value || currentTanggal,
        currentAttendanceMap: null
      });
    },
    onManage: () => {
      if (onOpenModal) onOpenModal('mapel');
    }
  });

  selectKelas?.addEventListener('change', triggerSessionReload);
  inputTanggal?.addEventListener('change', triggerSessionReload);

  container.querySelector('#btn-quick-manage-kelas')?.addEventListener('click', () => {
    if (onOpenModal) onOpenModal('siswa');
  });

  container.querySelector('#btn-quick-manage-mapel')?.addEventListener('click', () => {
    if (onOpenModal) onOpenModal('mapel');
  });

  const triggerEditMapel = () => {
    if (onOpenModal) onOpenModal('edit-mapel', selectMapel.value || currentMapel);
  };
  container.querySelector('#btn-quick-edit-mapel')?.addEventListener('click', triggerEditMapel);
  container.querySelector('#btn-icon-edit-mapel')?.addEventListener('click', triggerEditMapel);

  // Event: Set Semua Hadir (1-Klik cepat)
  container.querySelector('#btn-set-all-hadir')?.addEventListener('click', () => {
    siswaList.forEach(s => {
      if (!attendanceMap[s.id]) attendanceMap[s.id] = {};
      attendanceMap[s.id].status = 'Hadir';
    });

    // Update UI tombol
    container.querySelectorAll('.siswa-row').forEach(row => {
      row.className = row.className.replace(/border-rose-300|border-amber-300|border-sky-300|bg-rose-50\/20|bg-amber-50\/20|bg-sky-50\/20/g, '').trim();
      row.classList.add('border-slate-200/80');

      row.querySelectorAll('.btn-status').forEach(btn => {
        const st = btn.getAttribute('data-status');
        btn.className = `btn-status w-10 h-10 sm:w-11 sm:h-10 rounded-xl font-bold text-xs flex items-center justify-center transition transform active:scale-90 ${st === 'Hadir' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500' : 'bg-slate-100 hover:bg-emerald-50 text-slate-700'}`;
      });
    });

    updateLiveCounters();
    showToast('Semua siswa diset Hadir', 'info');
  });

  // Event: Toggle Status per Siswa
  container.querySelectorAll('.btn-status').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const siswaId = btn.getAttribute('data-siswa-id');
      const newStatus = btn.getAttribute('data-status');
      if (!siswaId || !newStatus) return;

      if (!attendanceMap[siswaId]) attendanceMap[siswaId] = {};
      attendanceMap[siswaId].status = newStatus;

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

  // Modal Catatan Siswa
  let currentEditingNoteSiswaId = null;
  const modalNote = container.querySelector('#modal-catatan-siswa');
  const inputNote = container.querySelector('#input-siswa-note');
  const noteName = container.querySelector('#note-siswa-name');

  container.querySelectorAll('.btn-edit-note').forEach(btn => {
    btn.addEventListener('click', () => {
      currentEditingNoteSiswaId = btn.getAttribute('data-siswa-id');
      noteName.textContent = btn.getAttribute('data-nama') || '';
      inputNote.value = attendanceMap[currentEditingNoteSiswaId]?.catatan || '';
      modalNote.classList.remove('hidden');
    });
  });

  container.querySelector('#btn-close-modal-note')?.addEventListener('click', () => {
    modalNote.classList.add('hidden');
  });

  container.querySelector('#btn-save-note')?.addEventListener('click', () => {
    if (currentEditingNoteSiswaId) {
      if (!attendanceMap[currentEditingNoteSiswaId]) attendanceMap[currentEditingNoteSiswaId] = { status: 'Hadir' };
      attendanceMap[currentEditingNoteSiswaId].catatan = inputNote.value.trim();
      modalNote.classList.add('hidden');
      showToast('Catatan siswa diperbarui', 'success');
      // Update state
      onStateChange({ currentAttendanceMap: attendanceMap });
    }
  });

  // Modal Kegiatan Siswa Detail (F6)
  const modalKegiatan = container.querySelector('#modal-kegiatan-detail');
  const modalKegiatanBody = container.querySelector('#modal-kegiatan-body');

  container.querySelectorAll('.btn-view-kegiatan').forEach(btn => {
    btn.addEventListener('click', () => {
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

  container.querySelector('#btn-close-modal-kegiatan')?.addEventListener('click', () => {
    modalKegiatan.classList.add('hidden');
  });
  container.querySelector('#btn-modal-kegiatan-ok')?.addEventListener('click', () => {
    modalKegiatan.classList.add('hidden');
  });

  // Event: Simpan Sesi & Absensi (F4)
  container.querySelector('#btn-save-absen')?.addEventListener('click', async () => {
    const saveBtn = container.querySelector('#btn-save-absen');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Menyimpan...</span>`;
    if (window.lucide) window.lucide.createIcons();

    const absensiList = siswaList.map(s => ({
      siswa_id: s.id,
      status: attendanceMap[s.id]?.status || 'Hadir',
      catatan: attendanceMap[s.id]?.catatan || ''
    }));

    const sesiData = {
      id: existingSesi?.id || null,
      kelas_id: currentKelasId,
      mapel: currentMapel,
      tanggal: currentTanggal,
    };

    const res = await db.saveSesi({ sesiData, absensiList, jurnalData: null });
    saveBtn.disabled = false;

    if (res.success) {
      showToast(`Absensi kelas ${selectedKelasObj?.nama_kelas} berhasil disimpan!`, 'success');
      onStateChange({
        currentKelasId,
        currentMapel,
        currentTanggal,
        currentAttendanceMap: attendanceMap
      });
    } else {
      showToast('Gagal menyimpan absensi: ' + res.message, 'error');
    }
  });

  // Event: Pindah ke Jurnal
  container.querySelector('#btn-link-jurnal')?.addEventListener('click', () => {
    onNavigateToJurnal({
      kelasId: currentKelasId,
      mapel: currentMapel,
      tanggal: currentTanggal
    });
  });

  // Event: Pilih Sesi dari Jadwal Hari Ini (Opt-In Pasif)
  container.querySelectorAll('.btn-select-jadwal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetKelasId = btn.getAttribute('data-kelas-id');
      const targetMapel = btn.getAttribute('data-mapel');
      if (targetKelasId && targetMapel) {
        showToast(`Memuat sesi ${targetMapel} untuk kelas terpilih...`, 'info');
        onStateChange({
          currentKelasId: targetKelasId,
          currentMapel: targetMapel
        });
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}
