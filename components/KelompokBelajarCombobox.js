// components/KelompokBelajarCombobox.js - Modern Shadcn/UI Style Combobox untuk Pemilihan Kelompok Belajar
// Reusable, Searchable, Keyboard Accessible, & Responsive

const GROUP_COLORS = [
  { dot: 'bg-emerald-500 shadow-emerald-500/50 ring-emerald-300', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { dot: 'bg-blue-500 shadow-blue-500/50 ring-blue-300', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
  { dot: 'bg-purple-500 shadow-purple-500/50 ring-purple-300', badge: 'bg-purple-50 text-purple-800 border-purple-200' },
  { dot: 'bg-amber-500 shadow-amber-500/50 ring-amber-300', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { dot: 'bg-rose-500 shadow-rose-500/50 ring-rose-300', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
  { dot: 'bg-teal-500 shadow-teal-500/50 ring-teal-300', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
  { dot: 'bg-indigo-500 shadow-indigo-500/50 ring-indigo-300', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' }
];

export function getGroupColorMeta(index = 0) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

/**
 * Render HTML Combobox Trigger & Popover Dropdown untuk Kelompok Belajar
 */
export function renderKelompokBelajarComboboxHTML({
  id = 'combobox-kelompok',
  kelompokList = [],
  selectedId = '',
  placeholder = 'Pilih Kelompok...',
  allowAll = false,
  allLabel = 'Semua Kelompok',
  size = 'md', // 'sm' | 'md'
  darkTheme = false
}) {
  const selectedIndex = kelompokList.findIndex(k => k.id === selectedId);
  const selectedObj = selectedIndex !== -1 ? kelompokList[selectedIndex] : null;
  const isAll = allowAll && (!selectedId || selectedId === '');
  const selectedColor = selectedIndex !== -1 ? getGroupColorMeta(selectedIndex) : null;

  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-xs sm:text-sm';

  return `
    <div class="relative w-full kelompok-belajar-combobox-wrapper" data-combobox-id="${id}">
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        class="combobox-trigger w-full ${heightClass} font-bold ${darkTheme ? 'bg-slate-900/90 hover:bg-slate-900 text-white border-emerald-500/40' : 'bg-slate-50 hover:bg-white text-slate-800 border-slate-200 hover:border-emerald-500'} border rounded-xl px-3 sm:px-3.5 flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          ${isAll ? `
            <span class="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0"></span>
            <span class="truncate font-bold ${darkTheme ? 'text-white' : 'text-slate-900 dark:text-white'}">${allLabel}</span>
          ` : selectedObj ? `
            <span class="w-2.5 h-2.5 rounded-full ${selectedColor.dot} flex-shrink-0 ring-2"></span>
            <span class="truncate font-black ${darkTheme ? 'text-white' : 'text-slate-900 dark:text-white'}">${selectedObj.nama_kelompok}</span>
            <span class="text-[11px] font-medium ${darkTheme ? 'text-emerald-200' : 'text-slate-500'} truncate">(${selectedObj.anggota?.length || 0} siswa)</span>
          ` : `
            <span class="${darkTheme ? 'text-slate-300' : 'text-slate-400'} font-normal truncate">${placeholder}</span>
          `}
        </div>

        <div class="flex items-center gap-1 ${darkTheme ? 'text-emerald-300' : 'text-slate-400 group-hover:text-emerald-600'} transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="w-4 h-4"></i>
        </div>
      </button>

      <!-- Hidden Input for standard form compatibility -->
      <input type="hidden" id="${id}" value="${selectedId || ''}">

      <!-- Popover Floating Dropdown (Shadcn Command Menu) -->
      <div 
        id="${id}-popover" 
        class="combobox-popover hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <!-- Search Input Bar -->
        <div class="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-2">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 ml-1.5 flex-shrink-0"></i>
          <input 
            type="text" 
            id="${id}-search" 
            placeholder="Cari kelompok..." 
            class="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none py-1.5 pr-2"
            autocomplete="off"
          >
          <button type="button" id="${id}-search-clear" class="hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- List Container -->
        <div id="${id}-list" class="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
          ${renderComboboxKelompokItemsHTML({ kelompokList, selectedId, allowAll, allLabel })}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render List Items inside Popover
 */
export function renderComboboxKelompokItemsHTML({
  kelompokList = [],
  selectedId = '',
  allowAll = false,
  allLabel = 'Semua Kelompok',
  searchQuery = ''
}) {
  const query = (searchQuery || '').trim().toLowerCase();

  const filtered = kelompokList.filter(k => {
    if (!query) return true;
    const nameMatch = (k.nama_kelompok || '').toLowerCase().includes(query);
    const descMatch = (k.deskripsi || '').toLowerCase().includes(query);
    return nameMatch || descMatch;
  });

  if (filtered.length === 0 && (!allowAll || (query && !allLabel.toLowerCase().includes(query)))) {
    return `
      <div class="p-4 text-center text-xs text-slate-400 space-y-1">
        <i data-lucide="alert-circle" class="w-5 h-5 mx-auto text-slate-300"></i>
        <p class="font-medium">Kelompok tidak ditemukan</p>
      </div>
    `;
  }

  let html = '';

  // Option: Semua Kelompok (jika diizinkan)
  if (allowAll && (!query || allLabel.toLowerCase().includes(query))) {
    const isSelected = !selectedId || selectedId === '';
    html += `
      <div 
        role="option" 
        aria-selected="${isSelected}"
        data-value=""
        class="combobox-item p-2 rounded-xl text-xs cursor-pointer flex items-center justify-between transition select-none ${isSelected ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-50 text-slate-700 font-semibold'}"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0"></span>
          <span class="truncate">${allLabel}</span>
        </div>
        ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 flex-shrink-0 ml-1"></i>' : ''}
      </div>
    `;
  }

  filtered.forEach((k, idx) => {
    const isSelected = k.id === selectedId;
    const color = getGroupColorMeta(idx);
    const memberCount = (k.anggota || []).length;

    html += `
      <div 
        role="option" 
        aria-selected="${isSelected}"
        data-value="${k.id}"
        data-name="${k.nama_kelompok}"
        class="combobox-item p-2 rounded-xl text-xs cursor-pointer flex items-center justify-between transition select-none ${isSelected ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-50 text-slate-700 font-semibold'}"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full ${color.dot} flex-shrink-0 ring-2"></span>
          <div class="min-w-0 flex-1 truncate">
            <span class="truncate block text-slate-900">${k.nama_kelompok}</span>
            ${k.deskripsi ? `<span class="text-[10px] text-slate-400 block truncate font-normal">${k.deskripsi}</span>` : ''}
          </div>
          <span class="px-2 py-0.5 rounded-md ${color.badge} text-[10px] font-black border flex-shrink-0">
            ${memberCount} Siswa
          </span>
        </div>
        ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 flex-shrink-0 ml-1"></i>' : ''}
      </div>
    `;
  });

  return html;
}

/**
 * Inisialisasi Event Listener untuk Kelompok Belajar Combobox
 */
export function initKelompokBelajarCombobox(container, {
  id = 'combobox-kelompok',
  kelompokList = [],
  selectedId = '',
  allowAll = false,
  allLabel = 'Semua Kelompok',
  onSelect = () => {}
}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const popover = wrapper.querySelector(`#${id}-popover`);
  const hiddenInput = wrapper.querySelector(`#${id}`);
  const searchInput = wrapper.querySelector(`#${id}-search`);
  const clearBtn = wrapper.querySelector(`#${id}-search-clear`);
  const listContainer = wrapper.querySelector(`#${id}-list`);

  let currentSelectedId = selectedId || '';
  let activeIndex = -1;

  function openPopover() {
    // Tutup combobox lain
    document.querySelectorAll('.kelompok-belajar-combobox-wrapper .combobox-popover, .class-combobox-wrapper .combobox-popover, .mapel-combobox-wrapper .combobox-popover').forEach(p => {
      if (p !== popover) p.classList.add('hidden');
    });

    popover.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (searchInput) {
      searchInput.value = '';
      if (clearBtn) clearBtn.classList.add('hidden');
      renderItems('');
      setTimeout(() => searchInput.focus(), 50);
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function closePopover() {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }

  function renderItems(query) {
    listContainer.innerHTML = renderComboboxKelompokItemsHTML({
      kelompokList,
      selectedId: currentSelectedId,
      allowAll,
      allLabel,
      searchQuery: query
    });
    if (window.lucide) window.lucide.createIcons();
    bindItemEvents();
  }

  function selectItem(value) {
    currentSelectedId = value;
    if (hiddenInput) hiddenInput.value = value;
    closePopover();
    onSelect(value);
  }

  function bindItemEvents() {
    const items = listContainer.querySelectorAll('.combobox-item');
    items.forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = item.getAttribute('data-value');
        selectItem(val);
      });

      item.addEventListener('mouseenter', () => {
        activeIndex = idx;
        highlightActiveItem();
      });
    });
  }

  function highlightActiveItem() {
    const items = listContainer.querySelectorAll('.combobox-item');
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add('bg-slate-100', 'dark:bg-slate-800');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('bg-slate-100', 'dark:bg-slate-800');
      }
    });
  }

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) {
      openPopover();
    } else {
      closePopover();
    }
  });

  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value;
    if (clearBtn) {
      if (q) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }
    activeIndex = 0;
    renderItems(q);
  });

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    renderItems('');
    searchInput.focus();
  });

  // Keyboard navigation
  wrapper.addEventListener('keydown', (e) => {
    if (popover.classList.contains('hidden')) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPopover();
      }
      return;
    }

    const items = listContainer.querySelectorAll('.combobox-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      highlightActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlightActiveItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        const val = items[activeIndex].getAttribute('data-value');
        selectItem(val);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePopover();
      trigger.focus();
    }
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closePopover();
    }
  });

  bindItemEvents();
}
