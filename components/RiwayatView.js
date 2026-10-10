// components/RiwayatView.js - Modul Riwayat Sesi Mengajar (F7)
import { db } from '../supabase-client.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';

export async function renderRiwayatView(container, state, onStateChange, showToast, onEditSesi, onOpenJurnalSesi) {
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
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> sehingga belum ada Riwayat Sesi yang dapat ditampilkan.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Validasi filter kelas awal: tetap '' jika Semua Kelas, atau pastikan ID kelas valid dalam kelasList
  const initialFilterKelas = (kelasList.some(k => k.id === state.riwayatFilterKelas) ? state.riwayatFilterKelas : '');

  // Ambil mapel milik user awal
  const initialMapelList = await db.getMapelSaya(currentYear, initialFilterKelas || null);

  // Validasi filter mapel awal: tetap '' jika Semua Mapel, atau pastikan nama mapel valid dalam mapelList
  const initialFilterMapel = (initialMapelList.some(m => m.nama_mapel === state.riwayatFilterMapel) ? state.riwayatFilterMapel : '');

  // Local State untuk Partial Update
  const localState = {
    filterKelas: initialFilterKelas,
    filterMapel: initialFilterMapel,
    mapelList: initialMapelList,
    allSesi: [],
    currentYear
  };

  let riwayatRequestVersion = 0;

  // =========================================================================
  // INITIAL STATIC SHELL RENDER
  // =========================================================================
  container.innerHTML = `
    <div class="space-y-4 pb-20 max-w-4xl mx-auto">

      <!-- Header & Filter Bar (SHELL STATIS) -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <i data-lucide="history" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="font-bold text-slate-800 text-base sm:text-lg">Riwayat Sesi Mengajar</h2>
              <p class="text-xs text-slate-500">Daftar sesi absensi & jurnal yang telah tersimpan</p>
            </div>
          </div>

          <!-- Summary Counter Badge -->
          <div id="riwayat-summary-counter">
            <span class="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl self-start sm:self-auto inline-block">
              Total: <strong>0</strong> Sesi
            </span>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div id="container-filter-riwayat-kelas">
            <label class="block text-xs font-semibold text-slate-600 mb-1">Filter Kelas</label>
            ${renderClassComboboxHTML({
              id: 'filter-riwayat-kelas',
              kelasList,
              selectedId: localState.filterKelas,
              allowAll: true,
              allLabel: 'Semua Kelas',
              size: 'sm'
            })}
          </div>

          <div id="container-filter-riwayat-mapel">
            <!-- Rendered by updateMapelCombobox() -->
          </div>
        </div>
      </div>

      <!-- List Sesi Mengajar: DYNAMIC PARTIAL CONTAINER -->
      <div id="riwayat-list-container" class="space-y-3">
        <div class="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-200 flex flex-col items-center justify-center gap-3">
          <div class="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-semibold text-slate-500">Memuat riwayat sesi mengajar...</span>
        </div>
      </div>

    </div>
  `;

  // Helper untuk update counter
  function updateRiwayatCounter(count) {
    const counterEl = container.querySelector('#riwayat-summary-counter');
    if (!counterEl) return;
    counterEl.innerHTML = `
      <span class="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl self-start sm:self-auto inline-block">
        Total: <strong>${count}</strong> Sesi
      </span>
    `;
  }

  // Helper untuk update Mapel Combobox
  function updateMapelCombobox() {
    const mapelContainer = container.querySelector('#container-filter-riwayat-mapel');
    if (!mapelContainer) return;

    mapelContainer.innerHTML = `
      <label class="block text-xs font-semibold text-slate-600 mb-1">Filter Mata Pelajaran</label>
      ${renderMapelComboboxHTML({
        id: 'filter-riwayat-mapel',
        mapelList: localState.mapelList,
        selectedValue: localState.filterMapel,
        allowAll: true,
        allLabel: 'Semua Mata Pelajaran',
        size: 'sm',
        allowManage: false
      })}
    `;

    initMapelCombobox(mapelContainer, {
      id: 'filter-riwayat-mapel',
      mapelList: localState.mapelList,
      selectedValue: localState.filterMapel,
      allowAll: true,
      allLabel: 'Semua Mata Pelajaran',
      size: 'sm',
      allowManage: false,
      onSelect: (newMapel) => {
        localState.filterMapel = newMapel;
        renderFilteredList();
      }
    });
  }

  // Helper untuk filter data in-memory dan render list
  async function renderFilteredList() {
    const listContainer = container.querySelector('#riwayat-list-container');
    if (!listContainer) return;

    const filteredList = localState.allSesi.filter(sesi => {
      const matchK = !localState.filterKelas || sesi.kelas_id === localState.filterKelas;
      const matchM = !localState.filterMapel || sesi.mapel === localState.filterMapel;
      return matchK && matchM;
    });

    updateRiwayatCounter(filteredList.length);

    if (filteredList.length === 0) {
      listContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-10 text-center text-slate-400 border border-dashed border-slate-200">
          <i data-lucide="folder-x" class="w-12 h-12 mx-auto text-slate-300 mb-2"></i>
          <p class="text-sm font-medium text-slate-600">Belum ada riwayat sesi mengajar tersimpan.</p>
          <p class="text-xs text-slate-400 mt-1">Buka tab "Absen Siswa" untuk memulai dan menyimpan sesi pertama Anda.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Pre-resolve status periode untuk tiap sesi
    const sesiArchiveMap = new Map();
    await Promise.all(filteredList.map(async (sesi) => {
      if (sesi.tanggal) {
        const p = await db.getPeriodeByDate(sesi.tanggal);
        if (p && p.status === 'ditutup') {
          sesiArchiveMap.set(sesi.id, true);
        } else {
          sesiArchiveMap.set(sesi.id, false);
        }
      } else {
        sesiArchiveMap.set(sesi.id, false);
      }
    }));

    listContainer.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100">

        <!-- Table Header -->
        <div class="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100/90 text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b-2 border-slate-200">
          <div class="col-span-3">Tanggal & Kelas</div>
          <div class="col-span-4">Mata Pelajaran & Materi Jurnal</div>
          <div class="col-span-3 text-left">Kehadiran Siswa</div>
          <div class="col-span-2 text-right">Aksi</div>
        </div>

        <!-- Rows -->
        ${filteredList.map(sesi => {
          let h = 0, s = 0, i = 0, a = 0;
          if (sesi.absensi) {
            sesi.absensi.forEach(x => {
              if (x.status === 'Hadir') h++;
              else if (x.status === 'Sakit') s++;
              else if (x.status === 'Izin') i++;
              else if (x.status === 'Alfa') a++;
            });
          }
          const totalSiswa = (sesi.absensi || []).length;
          const materi = sesi.jurnal_mengajar?.materi_pokok;
          const hasAlfa = a > 0;
          const isArchived = sesiArchiveMap.get(sesi.id) || false;
          const rowBorderClass = hasAlfa ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-emerald-500';

          return `
            <div class="session-item-row group ${rowBorderClass} transition hover:bg-slate-50/70 p-3 sm:px-4 sm:py-3 flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center gap-2.5">

              <!-- 1. Tanggal & Kelas -->
              <div class="md:col-span-3 flex items-center justify-between md:flex-col md:items-start gap-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span class="text-xs font-bold text-slate-800">${sesi.tanggal}</span>
                  ${isArchived ? `
                    <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5" title="Sesi pada semester tertutup (Read-Only)">
                      <i data-lucide="archive" class="w-2.5 h-2.5"></i>
                      <span>Arsip</span>
                    </span>
                  ` : ''}
                </div>
                <span class="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                  ${sesi.kelas?.nama_kelas || 'Kelas'}
                </span>
              </div>

              <!-- 2. Mata Pelajaran & Materi -->
              <div class="md:col-span-4 min-w-0">
                <div class="text-xs text-slate-500 font-semibold mb-0.5 truncate flex items-center gap-1.5 flex-wrap">
                  <span>${sesi.mapel}</span>
                  ${sesi.jumlah_jp ? `<span class="bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-1.5 py-0.5 rounded text-[10px] font-bold">${sesi.jumlah_jp} JP${sesi.jam_ke_label ? ` • ${sesi.jam_ke_label}` : ''}</span>` : ''}
                </div>
                <h4 class="font-bold text-slate-800 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition" title="${materi || 'Jurnal belum diisi'}">
                  ${materi || '<span class="italic text-slate-400 font-normal">Jurnal belum diisi</span>'}
                </h4>
              </div>

              <!-- 3. Stat Kehadiran -->
              <div class="md:col-span-3 flex items-center gap-1 flex-wrap">
                <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">H: ${h}</span>
                ${s > 0 ? `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">S: ${s}</span>` : ''}
                ${i > 0 ? `<span class="bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">I: ${i}</span>` : ''}
                ${a > 0 ? `<span class="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">A: ${a}</span>` : ''}
                <span class="text-slate-400 text-[10px]">(${totalSiswa} siswa)</span>
              </div>

              <!-- 4. Kolom Aksi -->
              <div class="md:col-span-2 flex items-center justify-end gap-1 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button class="btn-open-jurnal-sesi p-1.5 text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition" data-sesi-id="${sesi.id}" title="${isArchived ? 'Lihat Jurnal (Arsip)' : 'Lihat Jurnal'}">
                  <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                </button>
                <button class="btn-edit-sesi p-1.5 ${isArchived ? 'text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border-indigo-200' : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'} rounded-lg border transition" data-sesi-id="${sesi.id}" title="${isArchived ? 'Lihat Absensi (Mode Arsip / Read-Only)' : 'Buka / Edit Absensi'}">
                  <i data-lucide="${isArchived ? 'eye' : 'edit-3'}" class="w-3.5 h-3.5"></i>
                </button>
                <button class="btn-delete-sesi p-1.5 ${isArchived ? 'opacity-30 cursor-not-allowed text-slate-300' : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'} rounded-lg transition" data-sesi-id="${sesi.id}" ${isArchived ? 'disabled title="Sesi berada di semester tertutup (Read-Only)"' : 'title="Hapus Sesi"'}>
                  <i data-lucide="${isArchived ? 'lock' : 'trash-2'}" class="w-3.5 h-3.5"></i>
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    bindRiwayatActions(filteredList);
    if (window.lucide) window.lucide.createIcons();
  }

  // Helper untuk bind aksi-aksi baris sesi
  function bindRiwayatActions(currentFilteredList) {
    const listContainer = container.querySelector('#riwayat-list-container');
    if (!listContainer) return;

    // Event: Buka Jurnal Sesi
    listContainer.querySelectorAll('.btn-open-jurnal-sesi').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-sesi-id');
        const sesi = currentFilteredList.find(s => s.id === id);
        if (sesi && typeof onOpenJurnalSesi === 'function') {
          onOpenJurnalSesi(sesi);
        }
      });
    });

    // Event: Edit Absensi Sesi
    listContainer.querySelectorAll('.btn-edit-sesi').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-sesi-id');
        const sesi = currentFilteredList.find(s => s.id === id);
        if (sesi && typeof onEditSesi === 'function') {
          onEditSesi(sesi);
        }
      });
    });

    // Event: Hapus Sesi (In-Place Deletion)
    listContainer.querySelectorAll('.btn-delete-sesi').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-sesi-id');
        if (!id) return;

        const sesi = currentFilteredList.find(s => s.id === id);
        if (sesi && sesi.tanggal) {
          const p = await db.getPeriodeByDate(sesi.tanggal);
          if (p && p.status === 'ditutup') {
            showToast('Tidak dapat menghapus: Sesi mengajar ini berada di semester yang telah ditutup (Mode Arsip).', 'error');
            return;
          }
        }

        if (confirm('Apakah Anda yakin ingin menghapus sesi mengajar ini beserta data absensinya?')) {
          try {
            await db.deleteSesi(id);
            localState.allSesi = localState.allSesi.filter(s => s.id !== id);
            showToast('Sesi mengajar berhasil dihapus', 'info');
            await renderFilteredList();
          } catch (err) {
            console.error('Gagal menghapus sesi:', err);
            showToast('Gagal menghapus sesi: ' + (err.message || 'Terjadi kesalahan'), 'error');
          }
        }
      });
    });
  }

  // Helper untuk memuat data sesi mengajar secara asinkron (dengan stale check)
  async function reloadRiwayatData() {
    const currentVersion = ++riwayatRequestVersion;
    const listContainer = container.querySelector('#riwayat-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-200 flex flex-col items-center justify-center gap-3">
        <div class="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold text-slate-500">Memuat riwayat sesi mengajar...</span>
      </div>
    `;

    try {
      const data = await db.getAllSesi(localState.currentYear);
      if (currentVersion !== riwayatRequestVersion) return;

      localState.allSesi = data || [];
      renderFilteredList();
    } catch (err) {
      if (currentVersion !== riwayatRequestVersion) return;
      console.error('Gagal memuat riwayat sesi:', err);
      listContainer.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-700 space-y-2">
          <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto text-rose-500"></i>
          <h4 class="font-bold text-sm">Gagal Memuat Riwayat</h4>
          <p class="text-xs text-rose-600 max-w-md mx-auto">${err.message || 'Terjadi kesalahan saat mengambil riwayat sesi mengajar.'}</p>
          <button id="btn-retry-riwayat" class="mt-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition">
            Coba Lagi
          </button>
        </div>
      `;
      listContainer.querySelector('#btn-retry-riwayat')?.addEventListener('click', reloadRiwayatData);
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // =========================================================================
  // INITIALIZE CONTROLS (CLASS COMBOBOX, MAPEL COMBOBOX, DATA LOAD)
  // =========================================================================

  // Inisialisasi Class Combobox
  initClassCombobox(container, {
    id: 'filter-riwayat-kelas',
    kelasList,
    selectedId: localState.filterKelas,
    allowAll: true,
    allLabel: 'Semua Kelas',
    size: 'sm',
    onSelect: async (newKId) => {
      localState.filterKelas = newKId;

      try {
        // Ambil daftar mapel baru berdasarkan kelas terpilih
        const newMapelList = await db.getMapelSaya(localState.currentYear, newKId || null);
        localState.mapelList = newMapelList || [];

        // Validasi apakah mapel terpilih saat ini masih ada dalam daftar baru
        const stillValid = localState.mapelList.some(m => m.nama_mapel === localState.filterMapel);
        if (!stillValid) {
          localState.filterMapel = '';
        }

        // Re-render Mapel combobox
        updateMapelCombobox();

        // Render ulang daftar sesi yang terfilter
        renderFilteredList();
      } catch (err) {
        console.error('Gagal memperbarui filter kelas:', err);
        showToast('Gagal memuat mata pelajaran: ' + err.message, 'error');
      }
    }
  });

  // Render Mapel Combobox awal
  updateMapelCombobox();

  // Load data awal riwayat sesi
  await reloadRiwayatData();

  if (window.lucide) window.lucide.createIcons();
}
