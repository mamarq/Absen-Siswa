import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderSiswaComboboxHTML, initSiswaCombobox, updateSiswaComboboxList } from './SiswaCombobox.js';
import { renderKategoriKegiatanComboboxHTML, initKategoriKegiatanCombobox } from './KategoriKegiatanCombobox.js';
// components/KegiatanView.js - Modul Catatan & Agenda Kegiatan Siswa (Partial Update Pattern)
import { db } from '../supabase-client.js';

export async function renderKegiatanView(container, state, onStateChange, showToast) {
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
            Gagal memuat data kelas dari Jadwal Mengajar.
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
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> sehingga belum ada Kegiatan Siswa yang dapat dikelola.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Initial Data Fetching
  const allKegiatan = await db.getAllKegiatanSiswa(currentYear);

  // Penentuan kelas aktif (Prioritas: state.currentKelasId jika valid di kelasList, jika tidak gunakan kelas pertama guru)
  let selectedKelasId = (kelasList.some(k => k.id === state.currentKelasId)
    ? state.currentKelasId
    : (kelasList[0]?.id || ''));

  const siswaList = selectedKelasId ? await db.getSiswaByKelas(selectedKelasId) : [];
  let selectedSiswaId = siswaList[0]?.id || '';
  let selectedKategori = 'Catatan Positif / Prestasi';

  // Mode Arsip Check: cek tanggal form awal
  let formTanggal = new Date().toISOString().split('T')[0];
  const initialPeriode = await db.getPeriodeByDate(formTanggal);
  let isDateArchived = initialPeriode?.status === 'ditutup';
  let dateArchivedLabel = initialPeriode ? `${initialPeriode.academic_year} (${initialPeriode.semester})` : '';

  // =========================================================================
  // LOCAL STATE SETUP (Transient UI state isolated from full re-render)
  // =========================================================================
  const localState = {
    currentYear,
    kelasList,
    selectedKelasId,
    siswaList,
    selectedSiswaId,
    selectedKategori,
    allKegiatan,
    formTanggal,
    isDateArchived,
    dateArchivedLabel
  };

  // Sync background state properties without triggering global app.render()
  state.currentKelasId = localState.selectedKelasId;

  // Stale Request Protection Token
  let kegiatanRequestVersion = 0;

  // Helper Renderer Item Catatan Kegiatan HTML
  function renderKegiatanListItemsHTML(list = localState.allKegiatan) {
    if (list.length === 0) {
      return `
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800">
          <i data-lucide="sparkles" class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2"></i>
          <p class="text-sm font-medium">Belum ada catatan kegiatan siswa.</p>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Tambahkan catatan pada formulir di sebelah kiri.</p>
        </div>
      `;
    }

    return list.map(keg => {
      let badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700';
      const kat = (keg.kategori || '').toLowerCase();
      if (kat.includes('positif') || kat.includes('prestasi')) {
        badgeColor = 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700';
      } else if (kat.includes('pelanggaran') || kat.includes('perilaku')) {
        badgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700';
      } else if (kat.includes('bimbingan') || kat.includes('remedial')) {
        badgeColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700';
      } else if (kat.includes('dispensasi') || kat.includes('lomba')) {
        badgeColor = 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700';
      } else if (kat.includes('izin') || kat.includes('dinas')) {
        badgeColor = 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-700';
      }

      return `
        <div class="kegiatan-card-item bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-start justify-between gap-3" data-id="${keg.id}" data-tanggal="${keg.tanggal || ''}">
          <div class="space-y-1.5 flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">
                ${keg.kategori}
              </span>
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">
                <i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-0.5 text-slate-400"></i>
                ${keg.tanggal}
              </span>
            </div>

            <div>
              <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">${keg.judul}</h4>
              <p class="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                <i data-lucide="user" class="w-3.5 h-3.5 inline mr-0.5"></i>
                ${keg.siswa?.nama_lengkap || 'Siswa'}
              </p>
            </div>

            ${keg.keterangan ? `
              <p class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed">
                ${keg.keterangan}
              </p>
            ` : ''}
          </div>

          <button class="btn-delete-kegiatan p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition" data-id="${keg.id}" data-tanggal="${keg.tanggal || ''}" title="Hapus catatan">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // MAIN VIEW SHELL RENDERING (Rendered ONCE)
  // =========================================================================
  container.innerHTML = `
    <div class="space-y-6 pb-20 max-w-4xl mx-auto">

      <!-- Header Modul (Statis) -->
      <div class="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/30">
            <i data-lucide="sparkles" class="w-6 h-6"></i>
          </div>
          <div>
            <h2 class="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Catatan & Kegiatan Siswa</h2>
            <p class="text-xs text-slate-600 dark:text-slate-400">Catatan bimbingan, dispensasi lomba, atau agenda khusus yang otomatis muncul sebagai badge di Modul Absen.</p>
          </div>
        </div>
      </div>

      <!-- Mode Arsip Notice Banner -->
      <div id="kegiatan-archive-banner" class="${localState.isDateArchived ? '' : 'hidden'} p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-3.5 shadow-xs">
        <div class="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
          <i data-lucide="archive" class="w-5 h-5"></i>
        </div>
        <div class="text-xs space-y-1">
          <h4 class="font-black text-amber-900 dark:text-amber-200 text-sm">Mode Arsip — Semester ini telah ditutup</h4>
          <p class="text-amber-900/80 dark:text-amber-300/80 leading-relaxed font-medium">
            Tanggal yang dipilih berada pada periode semester yang telah ditutup (<span id="kegiatan-archive-label">${localState.dateArchivedLabel}</span>). Data hanya dapat dilihat dan tidak dapat ditambah atau diubah.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Form Tambah Catatan Baru (1 Kolom - Statis) -->
        <div class="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Tambah Catatan Siswa</h3>
          </div>

          <!-- Filter Kelas untuk pilih siswa (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Kelas Siswa</label>
            ${renderClassComboboxHTML({
              id: 'kegiatan-form-kelas',
              kelasList: localState.kelasList,
              selectedId: localState.selectedKelasId,
              size: 'sm'
            })}
          </div>

          <!-- Dropdown Siswa (Searchable Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Pilih Siswa <span class="text-rose-500">*</span></label>
            ${renderSiswaComboboxHTML({
              id: 'kegiatan-form-siswa',
              siswaList: localState.siswaList,
              selectedId: localState.selectedSiswaId,
              placeholder: localState.selectedKelasId ? 'Cari / Pilih Siswa...' : 'Pilih kelas terlebih dahulu...',
              size: 'sm'
            })}
          </div>

          <!-- Tanggal Kegiatan -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tanggal Berlaku <span class="text-rose-500">*</span></label>
            ${renderDatePickerHTML({
              id: 'kegiatan-form-tanggal',
              value: localState.formTanggal,
              size: 'sm'
            })}
          </div>

          <!-- Kategori Catatan (Custom Badge Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Kategori Catatan</label>
            ${renderKategoriKegiatanComboboxHTML({
              id: 'kegiatan-form-kategori',
              selectedValue: localState.selectedKategori,
              size: 'sm'
            })}
          </div>

          <!-- Judul / Agenda -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Judul / Agenda Singkat <span class="text-rose-500">*</span></label>
            <input type="text" id="kegiatan-form-judul" placeholder="Contoh: Latihan LKS IT Network" class="w-full text-xs font-bold p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500">
          </div>

          <!-- Keterangan Tambahan -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Keterangan / Rincian</label>
            <textarea id="kegiatan-form-keterangan" rows="3" placeholder="Rincian dispensasi, surat izin, materi remedial..." class="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"></textarea>
          </div>

          <button id="btn-save-kegiatan" ${localState.isDateArchived ? 'disabled' : ''} class="w-full ${localState.isDateArchived ? 'opacity-50 cursor-not-allowed bg-slate-400 dark:bg-slate-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 transform active:scale-95'} font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition">
            <i data-lucide="${localState.isDateArchived ? 'lock' : 'plus'}" class="w-4 h-4"></i>
            <span>${localState.isDateArchived ? 'Semester Ditutup (Read-Only)' : 'Simpan Catatan Kegiatan'}</span>
          </button>
        </div>

        <!-- Daftar Log Catatan (2 Kolom - Partial Update) -->
        <div class="lg:col-span-2 space-y-3">
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="list-checks" class="w-4 h-4 text-slate-500 dark:text-slate-400"></i>
              <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Riwayat Catatan Kegiatan Siswa</h3>
            </div>
            <span id="kegiatan-list-count" class="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              ${localState.allKegiatan.length} Catatan
            </span>
          </div>

          <div id="kegiatan-list-container" class="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            ${renderKegiatanListItemsHTML(localState.allKegiatan)}
          </div>
        </div>

      </div>

    </div>
  `;

  // =========================================================================
  // DATA RELOADER: RELOAD DAFTAR CATATAN (PARTIAL)
  // =========================================================================
  async function reloadKegiatanList() {
    const version = ++kegiatanRequestVersion;
    const listContainer = container.querySelector('#kegiatan-list-container');
    const countBadge = container.querySelector('#kegiatan-list-count');

    try {
      const updatedList = await db.getAllKegiatanSiswa(localState.currentYear);
      if (version !== kegiatanRequestVersion) return; // Stale request protection

      localState.allKegiatan = updatedList;

      if (countBadge) {
        countBadge.textContent = `${updatedList.length} Catatan`;
      }

      if (listContainer) {
        listContainer.innerHTML = renderKegiatanListItemsHTML(updatedList);
      }

      bindKegiatanDeleteEvents();
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error reloading kegiatan list:', err);
      showToast('Gagal memperbarui riwayat catatan kegiatan: ' + (err.message || err), 'error');
    }
  }

  // Helper untuk update UI status arsip berdasarkan tanggal formulir
  async function updateFormArchiveState(selectedDate) {
    localState.formTanggal = selectedDate;
    const p = await db.getPeriodeByDate(selectedDate);
    const isArchived = p?.status === 'ditutup';
    localState.isDateArchived = isArchived;
    localState.dateArchivedLabel = p ? `${p.academic_year} (${p.semester})` : '';

    const banner = container.querySelector('#kegiatan-archive-banner');
    const label = container.querySelector('#kegiatan-archive-label');
    const saveBtn = container.querySelector('#btn-save-kegiatan');

    if (banner) {
      if (isArchived) banner.classList.remove('hidden');
      else banner.classList.add('hidden');
    }
    if (label && localState.dateArchivedLabel) {
      label.textContent = localState.dateArchivedLabel;
    }
    if (saveBtn) {
      saveBtn.disabled = isArchived;
      if (isArchived) {
        saveBtn.className = 'w-full opacity-50 cursor-not-allowed bg-slate-400 dark:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition';
        saveBtn.innerHTML = `<i data-lucide="lock" class="w-4 h-4"></i><span>Semester Ditutup (Read-Only)</span>`;
      } else {
        saveBtn.className = 'w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition transform active:scale-95';
        saveBtn.innerHTML = `<i data-lucide="plus" class="w-4 h-4"></i><span>Simpan Catatan Kegiatan</span>`;
      }
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // =========================================================================
  // EVENT BINDINGS: DELETE ACTION (Delegated/Re-bound locally)
  // =========================================================================
  function bindKegiatanDeleteEvents() {
    container.querySelectorAll('.btn-delete-kegiatan').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const tanggal = btn.getAttribute('data-tanggal');

        // Mode Arsip UI check sebelum prompt
        if (tanggal) {
          const p = await db.getPeriodeByDate(tanggal);
          if (p && p.status === 'ditutup') {
            showToast('Tidak dapat menghapus: Periode semester untuk tanggal catatan ini telah ditutup (Mode Arsip).', 'error');
            return;
          }
        }

        if (id && confirm('Yakin ingin menghapus catatan kegiatan ini?')) {
          btn.disabled = true;
          try {
            await db.deleteKegiatanSiswa(id);
            showToast('Catatan kegiatan berhasil dihapus', 'info');
            await reloadKegiatanList();
          } catch (err) {
            console.error('Error deleting kegiatan:', err);
            showToast('Gagal menghapus catatan: ' + (err.message || err), 'error');
          }
        }
      };
    });
  }

  // Inisialisasi awal listener delete
  bindKegiatanDeleteEvents();

  // Inisialisasi DatePicker
  initDatePicker(container, {
    id: 'kegiatan-form-tanggal',
    value: localState.formTanggal,
    size: 'sm',
    onChange: async (newDate) => {
      await updateFormArchiveState(newDate);
    }
  });

  // Inisialisasi ClassCombobox di Form Catatan Kegiatan (Partial update Siswa Combobox)
  initClassCombobox(container, {
    id: 'kegiatan-form-kelas',
    kelasList: localState.kelasList,
    selectedId: localState.selectedKelasId,
    size: 'sm',
    onSelect: async (newKId) => {
      localState.selectedKelasId = newKId;
      state.currentKelasId = newKId;
      try {
        const sList = await db.getSiswaByKelas(newKId);
        localState.siswaList = sList;
        localState.selectedSiswaId = sList[0]?.id || '';
        updateSiswaComboboxList(container, 'kegiatan-form-siswa', sList, localState.selectedSiswaId);
      } catch (err) {
        console.error('Error loading siswa by kelas:', err);
      }
    }
  });

  // Inisialisasi SiswaCombobox di Form Catatan Kegiatan
  initSiswaCombobox(container, {
    id: 'kegiatan-form-siswa',
    siswaList: localState.siswaList,
    selectedId: localState.selectedSiswaId,
    size: 'sm',
    placeholder: localState.selectedKelasId ? 'Cari / Pilih Siswa...' : 'Pilih kelas terlebih dahulu...',
    onSelect: (sId) => {
      localState.selectedSiswaId = sId;
    }
  });

  // Inisialisasi KategoriKegiatanCombobox di Form Catatan Kegiatan
  initKategoriKegiatanCombobox(container, {
    id: 'kegiatan-form-kategori',
    selectedValue: localState.selectedKategori,
    onSelect: (val) => {
      localState.selectedKategori = val;
    }
  });

  // Event: Simpan Catatan Baru (In-place submit without page refresh)
  container.querySelector('#btn-save-kegiatan')?.addEventListener('click', async () => {
    const hiddenSiswa = container.querySelector('#kegiatan-form-siswa');
    const siswaId = localState.selectedSiswaId || hiddenSiswa?.value;
    const tanggal = container.querySelector('#kegiatan-form-tanggal')?.value;
    const hiddenKat = container.querySelector('#kegiatan-form-kategori');
    const kategori = localState.selectedKategori || hiddenKat?.value;
    const inputJudul = container.querySelector('#kegiatan-form-judul');
    const inputKeterangan = container.querySelector('#kegiatan-form-keterangan');

    const judul = inputJudul?.value?.trim();
    const keterangan = inputKeterangan?.value?.trim();

    if (!siswaId || !tanggal || !judul) {
      showToast('Harap lengkapi nama siswa, tanggal, dan judul kegiatan!', 'error');
      return;
    }

    const saveBtn = container.querySelector('#btn-save-kegiatan');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Menyimpan...</span>`;
    }

    try {
      await db.addKegiatanSiswa({
        siswa_id: siswaId,
        tanggal,
        kategori,
        judul,
        keterangan
      });

      // Reset hanya input field judul dan keterangan
      if (inputJudul) inputJudul.value = '';
      if (inputKeterangan) inputKeterangan.value = '';

      showToast('Catatan kegiatan siswa berhasil ditambahkan! ✨', 'success');

      // Reload hanya daftar catatan secara partial
      await reloadKegiatanList();
    } catch (err) {
      console.error('Error adding kegiatan siswa:', err);
      showToast('Gagal menambahkan catatan: ' + (err.message || err), 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="plus" class="w-4 h-4"></i><span>Simpan Catatan Kegiatan</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  });

  if (window.lucide) window.lucide.createIcons();
}
