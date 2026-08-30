// components/ClassCombobox.js - Modern Shadcn/UI Style Combobox (Popover + Command)
import { db } from '../supabase-client.js';

/**
 * Helper untuk mendapatkan warna dot dan ringkasan jurusan
 */
export function getJurusanMeta(namaKelas, jurusanName) {
  const text = `${namaKelas || ''} ${jurusanName || ''}`.toUpperCase();
  if (text.includes('TJKT') || text.includes('TKJ') || text.includes('JARINGAN')) {
    return {
      code: 'TJKT',
      dotColor: 'bg-sky-500 shadow-sky-500/50 ring-sky-300',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      label: 'Teknik Jaringan Komputer & Telko'
    };
  }
  if (text.includes('DKV') || text.includes('DESAIN') || text.includes('VISUAL')) {
    return {
      code: 'DKV',
      dotColor: 'bg-amber-500 shadow-amber-500/50 ring-amber-300',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Desain Komunikasi Visual'
    };
  }
  if (text.includes('MPLB') || text.includes('OTKP') || text.includes('PERKANTORAN') || text.includes('BISNIS')) {
    return {
      code: 'MPLB',
      dotColor: 'bg-purple-500 shadow-purple-500/50 ring-purple-300',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      label: 'Manajemen Perkantoran & Bisnis'
    };
  }
  if (text.includes('AKL') || text.includes('AKUNTANSI') || text.includes('KEUANGAN')) {
    return {
      code: 'AKL',
      dotColor: 'bg-emerald-500 shadow-emerald-500/50 ring-emerald-300',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Akuntansi & Keuangan Lembaga'
    };
  }
  return {
    code: 'UMUM',
    dotColor: 'bg-indigo-500 shadow-indigo-500/50 ring-indigo-300',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    label: jurusanName || 'Kejuruan'
  };
}

/**
 * Render HTML Combobox Trigger & Popover Dropdown
 */
export function renderClassComboboxHTML({
  id = 'combobox-kelas',
  kelasList = [],
  selectedId = '',
  placeholder = 'Pilih Kelas...',
  allowAll = false,
  allLabel = 'Semua Kelas',
  size = 'md', // 'sm' | 'md'
  darkTheme = false
}) {
  const selectedObj = kelasList.find(k => k.id === selectedId);
  const isAll = allowAll && (!selectedId || selectedId === '');
  const selectedMeta = selectedObj ? getJurusanMeta(selectedObj.nama_kelas, selectedObj.jurusan) : null;

  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-xs sm:text-sm';

  return `
    <div class="relative w-full class-combobox-wrapper" data-combobox-id="${id}">
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
            <span class="w-2.5 h-2.5 rounded-full ${selectedMeta.dotColor} flex-shrink-0 ring-2"></span>
            <span class="truncate font-black ${darkTheme ? 'text-white' : 'text-slate-900 dark:text-white'}">${selectedObj.nama_kelas}</span>
            <span class="hidden sm:inline text-[11px] font-medium ${darkTheme ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'} truncate">• ${selectedMeta.label}</span>
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
            placeholder="Cari kelas (contoh: X, TJKT, AKL)..." 
            class="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none py-1.5 pr-2"
            autocomplete="off"
          >
          <button type="button" id="${id}-search-clear" class="hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- Grouped List Container -->
        <div id="${id}-list" class="max-h-72 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
          ${renderComboboxItemsHTML({ kelasList, selectedId, allowAll, allLabel })}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render List Items inside Popover
 */
export function renderComboboxItemsHTML({
  kelasList = [],
  selectedId = '',
  allowAll = false,
  allLabel = 'Semua Kelas',
  searchQuery = ''
}) {
  const query = (searchQuery || '').trim().toLowerCase();

  // Filter items matching search
  const filtered = kelasList.filter(k => {
    if (!query) return true;
    const nameMatch = (k.nama_kelas || '').toLowerCase().includes(query);
    const jurMatch = (k.jurusan || '').toLowerCase().includes(query);
    const tkMatch = (k.tingkat || '').toLowerCase().includes(query);
    return nameMatch || jurMatch || tkMatch;
  });

  if (filtered.length === 0 && (!allowAll || (query && !allLabel.toLowerCase().includes(query)))) {
    return `
      <div class="text-center py-6 text-slate-400 text-xs space-y-1">
        <i data-lucide="search-x" class="w-6 h-6 mx-auto text-slate-300"></i>
        <p class="font-semibold text-slate-600 dark:text-slate-300">Kelas tidak ditemukan</p>
        <p class="text-[10px]">Coba cari dengan kata kunci lain (misal: "X", "TJKT", "AKL")</p>
      </div>
    `;
  }

  let html = '';

  // Opsi "Semua Kelas" jika diizinkan
  if (allowAll && (!query || allLabel.toLowerCase().includes(query))) {
    const isSelected = !selectedId || selectedId === '';
    html += `
      <div class="pb-1">
        <button 
          type="button" 
          class="combobox-item w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${isSelected ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}"
          data-value=""
          data-label="${allLabel}"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0"></span>
            <div>
              <p class="text-xs font-bold">${allLabel}</p>
              <p class="text-[10px] text-slate-400">Tampilkan seluruh data kelas aktif</p>
            </div>
          </div>
          ${isSelected ? `<i data-lucide="check" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 font-bold"></i>` : ''}
        </button>
      </div>
    `;
  }

  // Kelompokkan kelas per tingkat
  const groups = db.getGroupedKelasMap(filtered);
  const groupOrder = ['Tingkat X', 'Tingkat XI', 'Tingkat XII', 'Lainnya'];

  groupOrder.forEach(grpName => {
    const items = groups[grpName] || [];
    if (items.length > 0) {
      html += `
        <div class="pt-2 first:pt-0">
          <!-- Non-interactive Group Header -->
          <div class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 pb-1 flex items-center gap-1.5 select-none">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            <span>${grpName.toUpperCase()}</span>
            <span class="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded-md ml-auto">${items.length} Kelas</span>
          </div>

          <!-- Items in Group -->
          <div class="space-y-1 mt-0.5">
            ${items.map(k => {
              const isSelected = k.id === selectedId;
              const meta = getJurusanMeta(k.nama_kelas, k.jurusan);

              return `
                <button 
                  type="button" 
                  class="combobox-item w-full flex items-center justify-between p-2 rounded-xl text-left transition group min-h-[44px] ${isSelected ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800 shadow-2xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'}"
                  data-value="${k.id}"
                  data-label="${k.nama_kelas}"
                >
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <!-- Jurusan Dot Indicator -->
                    <span class="w-2.5 h-2.5 rounded-full ${meta.dotColor} flex-shrink-0 ring-2"></span>

                    <div class="min-w-0 flex-1">
                      <!-- Baris 1: Kode Kelas Singkat & Tebal -->
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-black tracking-tight">${k.nama_kelas}</span>
                        <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${meta.badgeBg}">
                          ${meta.code}
                        </span>
                      </div>

                      <!-- Baris 2: Sub-teks Nama Jurusan Lengkap -->
                      <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                        ${meta.label}
                      </p>
                    </div>
                  </div>

                  <!-- Right Checkmark Icon -->
                  ${isSelected ? `
                    <div class="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 ml-2 flex-shrink-0">
                      <i data-lucide="check" class="w-3.5 h-3.5 font-bold"></i>
                    </div>
                  ` : `
                    <div class="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 transition ml-2 flex-shrink-0">
                      <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                    </div>
                  `}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  });

  return html;
}

/**
 * Inisialisasi event listener dan interaktivitas Combobox
 */
export function initClassCombobox(container, {
  id = 'combobox-kelas',
  kelasList = [],
  selectedId = '',
  allowAll = false,
  allLabel = 'Semua Kelas',
  darkTheme = false,
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
    popover.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    searchInput.value = '';
    searchClear.classList.add('hidden');
    renderList('');
    setTimeout(() => searchInput.focus(), 50);
  }

  function closePopover() {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function renderList(query) {
    listContainer.innerHTML = renderComboboxItemsHTML({
      kelasList,
      selectedId: currentSelected,
      allowAll,
      allLabel,
      searchQuery: query
    });
    if (window.lucide) window.lucide.createIcons();

    // Bind item clicks
    listContainer.querySelectorAll('.combobox-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = btn.getAttribute('data-value');
        currentSelected = val;
        if (hiddenInput) hiddenInput.value = val;

        const selectedObj = kelasList.find(k => k.id === val);
        closePopover();

        // Update trigger UI
        const isAll = allowAll && (!val || val === '');
        const meta = selectedObj ? getJurusanMeta(selectedObj.nama_kelas, selectedObj.jurusan) : null;
        
        const triggerContent = trigger.querySelector('.min-w-0');
        if (triggerContent) {
          if (isAll) {
            triggerContent.innerHTML = `
              <span class="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0"></span>
              <span class="truncate font-bold ${darkTheme ? 'text-white' : 'text-slate-900 dark:text-white'}">${allLabel}</span>
            `;
          } else if (selectedObj) {
            triggerContent.innerHTML = `
              <span class="w-2.5 h-2.5 rounded-full ${meta.dotColor} flex-shrink-0 ring-2"></span>
              <span class="truncate font-black ${darkTheme ? 'text-white' : 'text-slate-900 dark:text-white'}">${selectedObj.nama_kelas}</span>
              <span class="hidden sm:inline text-[11px] font-medium ${darkTheme ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'} truncate">• ${meta.label}</span>
            `;
          }
        }

        onSelect(val, selectedObj);
      });
    });
  }

  // Toggle Popover
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) {
      // Close other open comboboxes first
      document.querySelectorAll('.combobox-popover').forEach(p => p.classList.add('hidden'));
      openPopover();
    } else {
      closePopover();
    }
  });

  // Search filter
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value;
    searchClear.classList.toggle('hidden', !q);
    renderList(q);
  });

  searchClear.addEventListener('click', (e) => {
    e.stopPropagation();
    searchInput.value = '';
    searchClear.classList.add('hidden');
    renderList('');
    searchInput.focus();
  });

  // Click outside to close
  const handleOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      closePopover();
    }
  };
  document.addEventListener('click', handleOutsideClick);

  // Escape key to close
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopover();
      trigger.focus();
    }
  });

  // Initial render of list
  renderList('');
}
