// components/SiswaCombobox.js - Reusable Shadcn/UI Style Siswa Combobox (Popover + Real-time Search + Scroll Limit)
// Menyediakan pemilihan siswa target yang efisien, searchable, dan dibatasi max-height untuk kenyamanan pengguna

/**
 * Render Item Siswa di dalam Popover List
 */
export function renderSiswaItemsHTML({
  siswaList = [],
  selectedId = '',
  searchQuery = ''
}) {
  const query = (searchQuery || '').trim().toLowerCase();

  const filteredList = siswaList.filter((s, idx) => {
    if (!query) return true;
    const name = (s.nama_lengkap || '').toLowerCase();
    const nisn = String(s.nisn || '').toLowerCase();
    const absen = String(s.nomor_absen || (idx + 1));
    return name.includes(query) || nisn.includes(query) || absen === query || absen.includes(query);
  });

  if (filteredList.length === 0) {
    return `
      <div class="py-8 px-4 text-center text-slate-400 dark:text-slate-500 space-y-1.5">
        <i data-lucide="user-x" class="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600"></i>
        <p class="text-xs font-semibold text-slate-600 dark:text-slate-400">Tidak ada siswa ditemukan</p>
        <p class="text-[11px]">Coba cari dengan nama lain, nomor absen, atau NISN</p>
      </div>
    `;
  }

  return filteredList.map((s, idx) => {
    const isSelected = s.id === selectedId;
    const absenNo = s.nomor_absen || (idx + 1);
    const initial = (s.nama_lengkap || 'S').charAt(0).toUpperCase();
    const isFemale = s.jenis_kelamin === 'P' || s.jenis_kelamin === 'Perempuan';

    return `
      <button 
        type="button" 
        class="combobox-siswa-item w-full text-left p-2 rounded-xl text-xs font-semibold transition flex items-center justify-between group ${isSelected ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-700/60 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'}" 
        data-id="${s.id}"
        data-nama="${s.nama_lengkap}"
        data-absen="${absenNo}"
        data-nisn="${s.nisn || '-'}"
        data-jk="${isFemale ? 'P' : 'L'}"
      >
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <!-- Avatar Initial Circle -->
          <div class="w-7 h-7 rounded-lg ${isSelected ? 'bg-emerald-600 text-white font-extrabold shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold'} flex items-center justify-center text-xs flex-shrink-0">
            ${initial}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-slate-400 dark:text-slate-500 font-mono text-[11px] font-bold">${absenNo}.</span>
              <span class="truncate font-extrabold text-slate-900 dark:text-white">${s.nama_lengkap}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${isFemale ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'}">
                ${isFemale ? 'P' : 'L'}
              </span>
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate mt-0.5">
              NISN: <span class="font-mono font-medium">${s.nisn || '-'}</span>
            </div>
          </div>
        </div>

        ${isSelected ? `
          <div class="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0 ml-2">
            <i data-lucide="check" class="w-3.5 h-3.5"></i>
          </div>
        ` : ''}
      </button>
    `;
  }).join('');
}

/**
 * Render HTML Combobox Trigger & Popover Dropdown untuk Pemilihan Siswa
 */
export function renderSiswaComboboxHTML({
  id = 'combobox-siswa',
  siswaList = [],
  selectedId = '',
  placeholder = 'Pilih Siswa Target...',
  size = 'md' // 'sm' | 'md'
}) {
  const selectedObj = siswaList.find(s => s.id === selectedId);
  const selectedIdx = siswaList.findIndex(s => s.id === selectedId);
  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-xs sm:text-sm';
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const absenNo = selectedObj ? (selectedObj.nomor_absen || (selectedIdx + 1)) : '';
  const isFemale = selectedObj ? (selectedObj.jenis_kelamin === 'P' || selectedObj.jenis_kelamin === 'Perempuan') : false;

  return `
    <div class="relative w-full siswa-combobox-wrapper" data-combobox-id="${id}">
      
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        class="combobox-siswa-trigger w-full ${heightClass} font-bold bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl px-3 sm:px-3.5 flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          ${selectedObj ? `
            <div class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0">
              ${(selectedObj.nama_lengkap || 'S').charAt(0).toUpperCase()}
            </div>
            <span class="truncate font-black text-slate-900 dark:text-white">
              ${absenNo}. ${selectedObj.nama_lengkap}
            </span>
            <span class="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              • NISN: ${selectedObj.nisn || '-'} (${isFemale ? 'P' : 'L'})
            </span>
          ` : `
            <i data-lucide="user" class="${iconSizeClass} text-slate-400 dark:text-slate-500 flex-shrink-0"></i>
            <span class="text-slate-400 dark:text-slate-500 font-normal truncate">${placeholder}</span>
          `}
        </div>

        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="w-4 h-4"></i>
        </div>
      </button>

      <!-- Hidden Input for Form Compatibility -->
      <input type="hidden" id="${id}" value="${selectedId || ''}">

      <!-- Popover Floating Dropdown (Shadcn Command Menu) -->
      <div 
        id="${id}-popover" 
        class="combobox-siswa-popover hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 sm:min-w-[340px]"
      >
        <!-- Search Input Bar -->
        <div class="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-2">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 dark:text-slate-500 ml-1.5 flex-shrink-0"></i>
          <input 
            type="text" 
            id="${id}-search" 
            placeholder="Cari nama, absen, atau NISN..." 
            class="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-1.5 pr-2"
            autocomplete="off"
          >
          <button type="button" id="${id}-search-clear" class="hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- Section Header Bar -->
        <div class="px-3 py-1.5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span>Daftar Siswa</span>
          <span class="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded-full font-bold">
            ${siswaList.length} Siswa
          </span>
        </div>

        <!-- Scrollable Student List Container (Max-Height ~8-10 Items with Scroll) -->
        <div id="${id}-list" class="max-h-64 sm:max-h-72 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
          ${renderSiswaItemsHTML({ siswaList, selectedId, searchQuery: '' })}
        </div>

      </div>

    </div>
  `;
}

/**
 * Inisialisasi Event Listener untuk Siswa Combobox
 */
export function initSiswaCombobox(container, {
  id = 'combobox-siswa',
  siswaList = [],
  selectedId = '',
  onSelect = () => {}
}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const popover = wrapper.querySelector(`#${id}-popover`);
  const searchInput = wrapper.querySelector(`#${id}-search`);
  const searchClear = wrapper.querySelector(`#${id}-search-clear`);
  const listContainer = wrapper.querySelector(`#${id}-list`);
  const hiddenInput = wrapper.querySelector(`#${id}`);

  let currentSelected = selectedId;

  function openPopover() {
    // Tutup popover lain
    document.querySelectorAll('.combobox-siswa-popover, .combobox-popover, .combobox-academic-year-menu, .combobox-tingkat-menu, .combobox-jurusan-menu').forEach(p => {
      p.classList.add('hidden');
    });
    document.querySelectorAll('.combobox-siswa-trigger, .combobox-trigger, .combobox-academic-year-trigger, .combobox-tingkat-trigger, .combobox-jurusan-trigger').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
    });

    popover.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (searchInput) {
      searchInput.value = '';
      searchClear?.classList.add('hidden');
      renderList('');
      setTimeout(() => searchInput.focus(), 50);
    }
  }

  function closePopover() {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function renderList(query) {
    if (!listContainer) return;
    listContainer.innerHTML = renderSiswaItemsHTML({
      siswaList,
      selectedId: currentSelected,
      searchQuery: query
    });
    if (window.lucide) window.lucide.createIcons();

    // Bind klik setiap item siswa
    listContainer.querySelectorAll('.combobox-siswa-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sId = btn.getAttribute('data-id');
        const sNama = btn.getAttribute('data-nama');
        const sAbsen = btn.getAttribute('data-absen');
        const sNisn = btn.getAttribute('data-nisn');
        const sJk = btn.getAttribute('data-jk');

        currentSelected = sId;
        if (hiddenInput) hiddenInput.value = sId;

        closePopover();

        // Update tampilan trigger
        const triggerContent = trigger.querySelector('.min-w-0');
        if (triggerContent) {
          triggerContent.innerHTML = `
            <div class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0">
              ${(sNama || 'S').charAt(0).toUpperCase()}
            </div>
            <span class="truncate font-black text-slate-900 dark:text-white">
              ${sAbsen}. ${sNama}
            </span>
            <span class="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              • NISN: ${sNisn} (${sJk})
            </span>
          `;
        }

        const selectedObj = siswaList.find(s => s.id === sId);
        if (onSelect) onSelect(sId, selectedObj);
      });
    });
  }

  // Toggle Popover
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) {
      openPopover();
    } else {
      closePopover();
    }
  });

  // Search input real-time handler
  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value;
    if (q.trim().length > 0) {
      searchClear?.classList.remove('hidden');
    } else {
      searchClear?.classList.add('hidden');
    }
    renderList(q);
  });

  // Search clear button
  searchClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    searchInput.value = '';
    searchClear.classList.add('hidden');
    renderList('');
    searchInput.focus();
  });

  // Klik di luar menutup popover
  const onOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      closePopover();
    }
  };

  document.removeEventListener('click', onOutsideClick);
  document.addEventListener('click', onOutsideClick);
}

/**
 * Memperbarui data siswa pada SiswaCombobox yang sudah dirender (misal saat ganti kelas)
 */
export function updateSiswaComboboxList(container, id, newSiswaList = [], newSelectedId = '', onSelect = null) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const listContainer = wrapper.querySelector(`#${id}-list`);
  const countBadge = wrapper.querySelector('.bg-slate-200, .dark\\:bg-slate-700');
  const hiddenInput = wrapper.querySelector(`#${id}`);

  if (countBadge) {
    countBadge.textContent = `${newSiswaList.length} Siswa`;
  }

  if (hiddenInput) {
    hiddenInput.value = newSelectedId;
  }

  const selectedObj = newSiswaList.find(s => s.id === newSelectedId);
  const selectedIdx = newSiswaList.findIndex(s => s.id === newSelectedId);
  const absenNo = selectedObj ? (selectedObj.nomor_absen || (selectedIdx + 1)) : '';
  const isFemale = selectedObj ? (selectedObj.jenis_kelamin === 'P' || selectedObj.jenis_kelamin === 'Perempuan') : false;

  const triggerContent = trigger?.querySelector('.min-w-0');
  if (triggerContent) {
    if (selectedObj) {
      triggerContent.innerHTML = `
        <div class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0">
          ${(selectedObj.nama_lengkap || 'S').charAt(0).toUpperCase()}
        </div>
        <span class="truncate font-black text-slate-900 dark:text-white">
          ${absenNo}. ${selectedObj.nama_lengkap}
        </span>
        <span class="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
          • NISN: ${selectedObj.nisn || '-'} (${isFemale ? 'P' : 'L'})
        </span>
      `;
    } else {
      triggerContent.innerHTML = `
        <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs flex items-center justify-center flex-shrink-0">
          <i data-lucide="user" class="w-3.5 h-3.5"></i>
        </div>
        <span class="text-slate-400 dark:text-slate-500 font-medium truncate">
          ${newSiswaList.length === 0 ? 'Belum ada siswa di kelas ini' : 'Cari / Pilih Siswa...'}
        </span>
      `;
    }
  }

  initSiswaCombobox(container, {
    id,
    siswaList: newSiswaList,
    selectedId: newSelectedId,
    onSelect
  });

  if (window.lucide) window.lucide.createIcons();
}
