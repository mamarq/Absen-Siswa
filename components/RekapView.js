import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
// components/RekapView.js - Modul Rekapitulasi & Statistik Kehadiran Siswa (F8)
import { db } from '../supabase-client.js';

export async function renderRekapView(container, state, onStateChange, showToast) {
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
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> sehingga belum ada Rekap Presensi yang dapat ditampilkan.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Penentuan kelas aktif (Prioritas: state.rekapKelasId -> state.currentKelasId -> kelas pertama guru)
  const initialKelasId = (state.rekapKelasId && kelasList.some(k => k.id === state.rekapKelasId))
    ? state.rekapKelasId
    : (state.currentKelasId && kelasList.some(k => k.id === state.currentKelasId)
        ? state.currentKelasId
        : (kelasList[0]?.id || ''));

  // Ambil daftar mapel guru pada kelas terpilih
  let currentMapelList = await db.getMapelSaya(currentYear, initialKelasId);

  // Validasi mapel aktif (Pertahankan jika valid pada kelas aktif, jika tidak reset ke '')
  const initialMapel = (currentMapelList.some(m => m.nama_mapel === state.rekapMapel) ? state.rekapMapel : '');

  // Local UI State (mencegah full view re-render)
  const localState = {
    currentKelasId: initialKelasId,
    currentMapel: initialMapel,
    startDate: state.rekapStartDate || '',
    endDate: state.rekapEndDate || '',
    currentYear: currentYear,
    selectedKelasObj: kelasList.find(k => k.id === initialKelasId)
  };

  // Request version token untuk stale request protection
  let rekapRequestVersion = 0;

  // Cache data rekap terkini untuk keperluan ekspor & cetak
  let currentRekapData = { daftarSesi: [], siswaRekap: [], totalSesi: 0 };

  // Helper untuk cek apakah rentang/tanggal rekap berada di semester yang ditutup
  async function resolveRekapArchiveStatus(startDate, endDate, academicYear) {
    if (startDate) {
      const pStart = await db.getPeriodeByDate(startDate);
      if (pStart && pStart.status === 'ditutup') {
        return { isArchived: true, label: `${pStart.academic_year} (${pStart.semester})` };
      }
    }
    if (endDate) {
      const pEnd = await db.getPeriodeByDate(endDate);
      if (pEnd && pEnd.status === 'ditutup') {
        return { isArchived: true, label: `${pEnd.academic_year} (${pEnd.semester})` };
      }
    }
    // Jika tidak ada filter tanggal, periksa periode aktif terhadap academic_year
    if (!startDate && !endDate && academicYear) {
      const activeSem = await db.getActiveSemester();
      if (activeSem && activeSem.academic_year === academicYear && activeSem.status === 'ditutup') {
        return { isArchived: true, label: `${activeSem.academic_year} (${activeSem.semester})` };
      }
    }
    return { isArchived: false, label: '' };
  }

  const initialArchive = await resolveRekapArchiveStatus(localState.startDate, localState.endDate, currentYear);

  // Render Shell Statis
  container.innerHTML = `
    <div class="space-y-5 pb-20 max-w-6xl mx-auto">

      <!-- Mode Arsip Notice Banner -->
      <div id="rekap-archive-banner" class="${initialArchive.isArchived ? '' : 'hidden'} p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-3.5 shadow-xs">
        <div class="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
          <i data-lucide="archive" class="w-5 h-5"></i>
        </div>
        <div class="text-xs space-y-1">
          <h4 class="font-black text-amber-900 dark:text-amber-200 text-sm">Mode Arsip — Semester ini telah ditutup</h4>
          <p class="text-amber-900/80 dark:text-amber-300/80 leading-relaxed font-medium">
            Data rekapitulasi presensi pada periode semester ini (<span id="rekap-archive-label">${initialArchive.label}</span>) bersifat read-only. Data tetap dapat dilihat, diekspor CSV, dan dicetak.
          </p>
        </div>
      </div>

      <!-- Filter Card (Shell Statis) -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">Rekapitulasi Presensi</h2>
                <span id="rekap-badge-arsip" class="${initialArchive.isArchived ? '' : 'hidden'} px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black uppercase">
                  Arsip
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Analisis kehadiran siswa per kelas & persentase keaktifan</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-export-csv" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Ekspor CSV</span>
            </button>

            <button id="btn-print-rekap" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition transform active:scale-95">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div id="wrapper-rekap-select-kelas">
            <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas</label>
            <div id="container-rekap-select-kelas">
              ${renderClassComboboxHTML({
                id: 'rekap-select-kelas',
                kelasList,
                selectedId: localState.currentKelasId,
                size: 'sm'
              })}
            </div>
          </div>

          <div id="wrapper-rekap-select-mapel">
            <label class="block text-xs font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
            <div id="container-rekap-select-mapel">
              ${renderMapelComboboxHTML({
                id: 'rekap-select-mapel',
                mapelList: currentMapelList,
                selectedValue: localState.currentMapel,
                allowAll: true,
                allLabel: 'Semua Mapel',
                size: 'sm',
                allowManage: false
              })}
            </div>
          </div>

          <div id="wrapper-rekap-start-date">
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal Mulai</label>
            <div id="container-rekap-start-date">
              ${renderDatePickerHTML({
                id: 'rekap-start-date',
                value: localState.startDate,
                size: 'sm'
              })}
            </div>
          </div>

          <div id="wrapper-rekap-end-date">
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal Sampai</label>
            <div id="container-rekap-end-date">
              ${renderDatePickerHTML({
                id: 'rekap-end-date',
                value: localState.endDate,
                size: 'sm'
              })}
            </div>
          </div>
        </div>

        <!-- Alert Validasi Tanggal (Lokal) -->
        <div id="rekap-date-validation-msg" class="hidden mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
          <i data-lucide="alert-circle" class="w-4 h-4 text-rose-600 flex-shrink-0"></i>
          <span>Tanggal mulai tidak boleh melebihi tanggal sampai.</span>
        </div>
      </div>

      <!-- Ringkasan Statistik Kelas (Partial Dynamic Container) -->
      <div id="rekap-summary-container" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <!-- Diisi oleh renderRekapSummaryHTML -->
      </div>

      <!-- Tabel Matriks Rekapitulasi (Partial Dynamic Container) -->
      <div id="rekap-table-container" class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <!-- Diisi oleh renderRekapTableHTML -->
      </div>

    </div>
  `;

  // Helper: Render Ringkasan Statistik
  function renderRekapSummaryHTML(siswaRekap, totalSesi, selectedKelasObj) {
    let totalPersentase = 0;
    let totalAlfa = 0;
    siswaRekap.forEach(s => {
      totalPersentase += s.persentase;
      totalAlfa += s.alfa;
    });
    const avgKehadiran = siswaRekap.length > 0 ? Math.round(totalPersentase / siswaRekap.length) : 100;

    return `
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
        <span class="text-xs font-semibold text-slate-500">Total Sesi Pertemuan</span>
        <p class="text-2xl font-black text-slate-800 mt-1">${totalSesi}</p>
        <span class="text-[11px] text-slate-400">Tercatat di sistem</span>
      </div>

      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
        <span class="text-xs font-semibold text-slate-500">Rata-rata Kehadiran</span>
        <p class="text-2xl font-black ${avgKehadiran >= 85 ? 'text-emerald-600' : 'text-amber-600'} mt-1">${avgKehadiran}%</p>
        <span class="text-[11px] text-slate-400">Tingkat partisipasi</span>
      </div>

      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
        <span class="text-xs font-semibold text-slate-500">Jumlah Siswa</span>
        <p class="text-2xl font-black text-slate-800 mt-1">${siswaRekap.length}</p>
        <span class="text-[11px] text-slate-400">Kelas ${selectedKelasObj?.nama_kelas || ''}</span>
      </div>

      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
        <span class="text-xs font-semibold text-slate-500">Total Ketidakhadiran Alfa</span>
        <p class="text-2xl font-black ${totalAlfa > 0 ? 'text-rose-600' : 'text-emerald-600'} mt-1">${totalAlfa}</p>
        <span class="text-[11px] text-slate-400">Tanpa keterangan</span>
      </div>
    `;
  }

  // Helper: Render Tabel Matriks Kehadiran
  function renderRekapTableHTML(daftarSesi, siswaRekap, selectedKelasObj) {
    return `
      <div class="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="font-bold text-slate-800 text-sm">Daftar Rekap Siswa: ${selectedKelasObj?.nama_kelas || 'Kelas'}</h3>
        <span class="text-xs text-slate-400">Status: <strong class="text-emerald-600">H</strong>adir, <strong class="text-amber-600">S</strong>akit, <strong class="text-sky-600">I</strong>zin, <strong class="text-rose-600">A</strong>lfa</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left" id="table-rekap-data">
          <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th class="py-3 px-3 w-12 text-center">No</th>
              <th class="py-3 px-3 min-w-[180px]">Nama Lengkap</th>
              <th class="py-3 px-2 w-10 text-center text-emerald-700 bg-emerald-50/50">H</th>
              <th class="py-3 px-2 w-10 text-center text-amber-700 bg-amber-50/50">S</th>
              <th class="py-3 px-2 w-10 text-center text-sky-700 bg-sky-50/50">I</th>
              <th class="py-3 px-2 w-10 text-center text-rose-700 bg-rose-50/50">A</th>
              <th class="py-3 px-3 w-20 text-center">Persentase</th>

              <!-- Kolom per Sesi -->
              ${daftarSesi.map(sesi => `
                <th class="py-3 px-2 min-w-[70px] text-center border-l border-slate-200 font-normal">
                  <div class="font-bold text-slate-700">${sesi.tanggal.slice(5)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${sesi.mapel.slice(0, 8)}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${siswaRekap.length === 0 ? `
              <tr>
                <td colspan="${7 + daftarSesi.length}" class="py-8 text-center text-slate-400">
                  Tidak ada data siswa atau data sesi untuk filter ini.
                </td>
              </tr>
            ` : siswaRekap.map((item, idx) => {
              let badgePersenColor = 'bg-emerald-100 text-emerald-800';
              if (item.persentase < 75) badgePersenColor = 'bg-rose-100 text-rose-800';
              else if (item.persentase < 85) badgePersenColor = 'bg-amber-100 text-amber-800';

              return `
                <tr class="hover:bg-slate-50/80 transition">
                  <td class="py-2.5 px-3 text-center font-bold text-slate-500">${item.siswa.nomor_absen || (idx + 1)}</td>
                  <td class="py-2.5 px-3 font-semibold text-slate-800">${item.siswa.nama_lengkap}</td>
                  <td class="py-2.5 px-2 text-center font-bold text-emerald-700 bg-emerald-50/30">${item.hadir}</td>
                  <td class="py-2.5 px-2 text-center font-bold text-amber-600 bg-amber-50/30">${item.sakit}</td>
                  <td class="py-2.5 px-2 text-center font-bold text-sky-600 bg-sky-50/30">${item.izin}</td>
                  <td class="py-2.5 px-2 text-center font-bold text-rose-600 bg-rose-50/30">${item.alfa}</td>
                  <td class="py-2.5 px-3 text-center">
                    <span class="font-bold text-xs px-2 py-0.5 rounded-full ${badgePersenColor}">
                      ${item.persentase}%
                    </span>
                  </td>

                  <!-- Detail per Sesi -->
                  ${daftarSesi.map(sesi => {
                    const st = item.perSesi[sesi.id] || '-';
                    let cellColor = 'text-slate-300';
                    if (st === 'Hadir') cellColor = 'text-emerald-600 font-bold';
                    else if (st === 'Sakit') cellColor = 'text-amber-600 font-bold bg-amber-50';
                    else if (st === 'Izin') cellColor = 'text-sky-600 font-bold bg-sky-50';
                    else if (st === 'Alfa') cellColor = 'text-rose-600 font-black bg-rose-100';

                    return `
                      <td class="py-2.5 px-2 text-center border-l border-slate-100 ${cellColor}">
                        ${st === 'Hadir' ? 'H' : st === 'Sakit' ? 'S' : st === 'Izin' ? 'I' : st === 'Alfa' ? 'A' : '-'}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Fungsi Utama: Reload Data Rekap Secara Parsial dengan Stale Request Protection
  async function reloadRekapData() {
    const summaryContainer = container.querySelector('#rekap-summary-container');
    const tableContainer = container.querySelector('#rekap-table-container');
    const valMsg = container.querySelector('#rekap-date-validation-msg');

    // 1. Validasi Rentang Tanggal
    if (localState.startDate && localState.endDate && localState.startDate > localState.endDate) {
      if (valMsg) valMsg.classList.remove('hidden');
      if (tableContainer) {
        tableContainer.innerHTML = `
          <div class="p-10 text-center text-rose-600 space-y-2">
            <i data-lucide="calendar-x" class="w-8 h-8 mx-auto text-rose-500"></i>
            <p class="font-bold text-sm">Rentang Tanggal Tidak Valid</p>
            <p class="text-xs text-slate-500">Tanggal mulai tidak boleh lebih besar dari tanggal sampai. Silakan perbaiki tanggal filter Anda.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    } else {
      if (valMsg) valMsg.classList.add('hidden');
    }

    // 2. Increment version token
    const currentVersion = ++rekapRequestVersion;

    // 3. Tampilkan status loading lokal (tanpa memblokir filter/toolbar)
    if (tableContainer) {
      tableContainer.innerHTML = `
        <div class="p-12 text-center text-slate-400 space-y-3 animate-pulse">
          <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-xs font-semibold text-slate-600">Memuat data rekapitulasi...</p>
        </div>
      `;
    }

    try {
      localState.selectedKelasObj = kelasList.find(k => k.id === localState.currentKelasId);
      const rekapData = localState.currentKelasId
        ? await db.getRekapKehadiran(localState.currentKelasId, localState.currentMapel, localState.startDate, localState.endDate, localState.currentYear)
        : { daftarSesi: [], siswaRekap: [], totalSesi: 0 };

      // Stale request check
      if (currentVersion !== rekapRequestVersion) return;

      currentRekapData = rekapData;
      const { daftarSesi, siswaRekap, totalSesi } = rekapData;

      if (summaryContainer) {
        summaryContainer.innerHTML = renderRekapSummaryHTML(siswaRekap, totalSesi, localState.selectedKelasObj);
      }
      if (tableContainer) {
        tableContainer.innerHTML = renderRekapTableHTML(daftarSesi, siswaRekap, localState.selectedKelasObj);
      }

      // 4. Update banner status arsip secara reaktif
      const archiveInfo = await resolveRekapArchiveStatus(localState.startDate, localState.endDate, localState.currentYear);
      const banner = container.querySelector('#rekap-archive-banner');
      const label = container.querySelector('#rekap-archive-label');
      const badge = container.querySelector('#rekap-badge-arsip');
      if (banner) {
        if (archiveInfo.isArchived) banner.classList.remove('hidden');
        else banner.classList.add('hidden');
      }
      if (label && archiveInfo.label) label.textContent = archiveInfo.label;
      if (badge) {
        if (archiveInfo.isArchived) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
      }
    } catch (err) {
      if (currentVersion !== rekapRequestVersion) return;
      console.error('Gagal memuat data rekap presensi:', err);
      if (tableContainer) {
        tableContainer.innerHTML = `
          <div class="p-10 text-center text-rose-600 space-y-2">
            <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto text-rose-500"></i>
            <p class="font-bold text-sm">Gagal Memuat Data Rekap Presensi</p>
            <p class="text-xs text-slate-500 max-w-md mx-auto">${err.message || 'Terjadi kesalahan saat memproses data presensi siswa.'}</p>
          </div>
        `;
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Inisialisasi Filter & Combobox
  function initFilters() {
    // DatePicker Mulai
    initDatePicker(container, {
      id: 'rekap-start-date',
      value: localState.startDate,
      size: 'sm',
      onChange: (newDate) => {
        localState.startDate = newDate || '';
        reloadRekapData();
      }
    });

    // DatePicker Sampai
    initDatePicker(container, {
      id: 'rekap-end-date',
      value: localState.endDate,
      size: 'sm',
      onChange: (newDate) => {
        localState.endDate = newDate || '';
        reloadRekapData();
      }
    });

    // Class Combobox
    initClassCombobox(container, {
      id: 'rekap-select-kelas',
      kelasList,
      selectedId: localState.currentKelasId,
      size: 'sm',
      onSelect: async (newKId) => {
        localState.currentKelasId = newKId || '';
        localState.selectedKelasObj = kelasList.find(k => k.id === localState.currentKelasId);

        // Refresh mapel dropdown list berdasarkan kelas baru
        currentMapelList = await db.getMapelSaya(localState.currentYear, localState.currentKelasId);
        const stillValid = currentMapelList.some(m => m.nama_mapel === localState.currentMapel);
        if (!stillValid) {
          localState.currentMapel = '';
        }

        // Re-render Mapel combobox container
        const mapelWrapper = container.querySelector('#container-rekap-select-mapel');
        if (mapelWrapper) {
          mapelWrapper.innerHTML = renderMapelComboboxHTML({
            id: 'rekap-select-mapel',
            mapelList: currentMapelList,
            selectedValue: localState.currentMapel,
            allowAll: true,
            allLabel: 'Semua Mapel',
            size: 'sm',
            allowManage: false
          });
          initMapelCombobox(container, {
            id: 'rekap-select-mapel',
            mapelList: currentMapelList,
            selectedValue: localState.currentMapel,
            allowAll: true,
            allLabel: 'Semua Mapel',
            size: 'sm',
            allowManage: false,
            onSelect: (newMapel) => {
              localState.currentMapel = newMapel || '';
              reloadRekapData();
            }
          });
        }

        reloadRekapData();
      }
    });

    // Mapel Combobox
    initMapelCombobox(container, {
      id: 'rekap-select-mapel',
      mapelList: currentMapelList,
      selectedValue: localState.currentMapel,
      allowAll: true,
      allLabel: 'Semua Mapel',
      size: 'sm',
      allowManage: false,
      onSelect: (newMapel) => {
        localState.currentMapel = newMapel || '';
        reloadRekapData();
      }
    });
  }

  initFilters();

  // Ekspor CSV (Memakai cache local data terbaru)
  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    const { siswaRekap } = currentRekapData;
    if (!siswaRekap || siswaRekap.length === 0) {
      showToast('Tidak ada data rekap untuk diekspor', 'error');
      return;
    }

    let csv = `No,Nama Siswa,NISN,Jenis Kelamin,Hadir,Sakit,Izin,Alfa,Persentase Kehadiran\n`;
    siswaRekap.forEach((item, idx) => {
      csv += `"${item.siswa.nomor_absen || (idx + 1)}","${item.siswa.nama_lengkap}","${item.siswa.nisn || '-'}","${item.siswa.jenis_kelamin || '-'}","${item.hadir}","${item.sakit}","${item.izin}","${item.alfa}","${item.persentase}%"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Presensi_${localState.selectedKelasObj?.nama_kelas || 'Kelas'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV berhasil diunduh!', 'success');
  });

  // Cetak Laporan Rekap (Memakai cache local data terbaru)
  container.querySelector('#btn-print-rekap')?.addEventListener('click', () => {
    const { siswaRekap, totalSesi } = currentRekapData;
    let totalPersentase = 0;
    siswaRekap.forEach(s => { totalPersentase += s.persentase; });
    const avgKehadiran = siswaRekap.length > 0 ? Math.round(totalPersentase / siswaRekap.length) : 100;

    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Rekap Presensi - ${localState.selectedKelasObj?.nama_kelas || 'Kelas'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 16px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 12px; font-weight: bold; }
            .meta { margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #444; padding: 5px 6px; }
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
              <p class="title">Rekapitulasi Kehadiran Siswa • Mata Pelajaran: ${localState.currentMapel || 'Semua Mapel'}</p>
            </div>
          </div>

          <div class="meta">
            <div>
              <strong>Kelas:</strong> ${localState.selectedKelasObj?.nama_kelas || 'Kelas'} (${localState.selectedKelasObj?.jurusan || 'TJKT'})<br>
              <strong>Guru Mapel:</strong> ${profil.nama_guru || 'Guru Mapel'}
            </div>
            <div style="text-align: right;">
              <strong>Total Sesi:</strong> ${totalSesi} Pertemuan<br>
              <strong>Rata-rata Kehadiran:</strong> ${avgKehadiran}%
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th>Nama Siswa</th>
                <th style="width: 30px;">L/P</th>
                <th style="width: 30px;">H</th>
                <th style="width: 30px;">S</th>
                <th style="width: 30px;">I</th>
                <th style="width: 30px;">A</th>
                <th style="width: 50px;">Persen</th>
              </tr>
            </thead>
            <tbody>
              ${siswaRekap.map((s, i) => `
                <tr>
                  <td class="text-center">${s.siswa.nomor_absen || (i + 1)}</td>
                  <td>${s.siswa.nama_lengkap}</td>
                  <td class="text-center">${s.siswa.jenis_kelamin || '-'}</td>
                  <td class="text-center">${s.hadir}</td>
                  <td class="text-center">${s.sakit}</td>
                  <td class="text-center">${s.izin}</td>
                  <td class="text-center">${s.alfa}</td>
                  <td class="text-center"><strong>${s.persentase}%</strong></td>
                </tr>
              `).join('')}
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

  // Trigger initial data load
  await reloadRekapData();
}
