// components/MapelCombobox.js - Modern Shadcn/UI Style Reusable Combobox for Mata Pelajaran
import { db } from '../supabase-client.js';

/**
 * Helper untuk membuat kode singkatan otomatis jika belum ada di database
 */
function generateShortCode(name = '') {
  const clean = name.trim();
  if (!clean) return 'MPL';
  const words = clean.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0][0] + words[1].substring(0, 2)).toUpperCase();
  }
  return clean.substring(0, 3).toUpperCase();
}

/**
 * Normalisasi daftar mapel menjadi array object terstruktur { id, nama_mapel, kode, kategori }
 * Membaca LANGSUNG dari Master Mapel database tanpa tebak-tebakan kata kunci nama!
 */
export function normalizeMapelList(rawList = []) {
  if (!Array.isArray(rawList)) return [];

  // Ambil cache master mapel dari localStorage jika rawList hanya berupa string
  let masterMap = null;
  try {
    const cachedMaster = JSON.parse(localStorage.getItem('absen_db_mata_pelajaran') || '[]');
    if (Array.isArray(cachedMaster) && cachedMaster.length > 0) {
      masterMap = new Map();
      cachedMaster.forEach(m => {
        if (m && m.nama_mapel) {
          masterMap.set(m.nama_mapel.trim().toLowerCase(), m);
        }
      });
    }
  } catch (e) {
    // ignore
  }

  return rawList.map((item, idx) => {
    if (!item) return null;

    // Jika sudah berupa object mapel lengkap dari database
    if (typeof item === 'object' && item.nama_mapel) {
      const nama = item.nama_mapel.trim();
      const kat = item.kategori ? item.kategori.trim() : 'Umum';
      const kd = item.kode ? item.kode.trim().toUpperCase() : generateShortCode(nama);
      return {
        id: item.id || `mp-${idx + 1}`,
        nama_mapel: nama,
        kode: kd,
        kategori: kat
      };
    }

    // Jika berupa string nama mapel murni (misal dari getMapelList())
    if (typeof item === 'string') {
      const nama = item.trim();
      const lower = nama.toLowerCase();
      let matched = masterMap ? masterMap.get(lower) : null;

      return {
        id: matched?.id || `mp-${idx + 1}`,
        nama_mapel: nama,
        kode: matched?.kode ? matched.kode.trim().toUpperCase() : generateShortCode(nama),
        kategori: matched?.kategori ? matched.kategori.trim() : 'Umum'
      };
    }

    return null;
  }).filter(Boolean);
}

/**
 * Helper untuk mendapatkan meta visual mata pelajaran (Kode, Warna Dot, Kategori)
 * 100% Mengikuti field kategori & kode dari Database Master Mapel!
 */
export function getMapelMeta(mapelItem, normalizedList = []) {
  let targetObj = null;

  if (mapelItem && typeof mapelItem === 'object' && mapelItem.nama_mapel) {
    targetObj = mapelItem;
  } else if (typeof mapelItem === 'string') {
    const name = mapelItem.trim().toLowerCase();
    targetObj = normalizedList.find(m => m.nama_mapel.toLowerCase() === name);

    if (!targetObj) {
      // Coba cari dari master mapel di localStorage
      try {
        const cachedMaster = JSON.parse(localStorage.getItem('absen_db_mata_pelajaran') || '[]');
        targetObj = cachedMaster.find(m => (m.nama_mapel || '').trim().toLowerCase() === name);
      } catch (e) {
        // ignore
      }
    }
  }

  const category = (targetObj?.kategori || 'Umum').trim();
  const code = (targetObj?.kode || generateShortCode(targetObj?.nama_mapel || String(mapelItem || ''))).trim().toUpperCase();

  // Styling dot & badge strictly berdasarkan kategori dari database
  const catLower = category.toLowerCase();
  if (catLower === 'kejuruan') {
    return {
      code,
      dotColor: 'bg-sky-500 shadow-sky-500/50 ring-sky-300',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      category: 'Kejuruan'
    };
  }
  if (catLower === 'umum') {
    return {
      code,
      dotColor: 'bg-emerald-500 shadow-emerald-500/50 ring-emerald-300',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      category: 'Umum'
    };
  }

  // Kategori kustom lainnya (Pilihan, Muatan Lokal, dll)
  return {
    code,
    dotColor: 'bg-purple-500 shadow-purple-500/50 ring-purple-300',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    category
  };
}

/**
 * Render HTML Combobox Trigger & Popover Dropdown untuk Mata Pelajaran
 */
export function renderMapelComboboxHTML({
  id = 'combobox-mapel',
  mapelList = [],
  selectedValue = '',
  placeholder = 'Pilih Mata Pelajaran...',
  allowAll = false,
  allLabel = 'Semua Mata Pelajaran',
  allowManage = true,
  manageLabel = '+ Tambah / Atur Mata Pelajaran...',
  size = 'md', // 'sm' | 'md'
  disabled = false
}) {
  const normalizedList = normalizeMapelList(mapelList);
  const selectedName = (selectedValue || '').trim();
  const isAll = allowAll && (!selectedName || selectedName === '');
  const selectedObj = normalizedList.find(m => m.nama_mapel === selectedName) || null;
  const selectedMeta = selectedName && !isAll ? getMapelMeta(selectedObj || selectedName, normalizedList) : null;

  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-xs sm:text-sm';

  return `
    <div class="relative w-full mapel-combobox-wrapper" data-combobox-id="${id}">
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        ${disabled ? 'disabled' : ''}
        class="combobox-trigger w-full ${heightClass} font-bold ${disabled ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 opacity-70 cursor-not-allowed border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500'} rounded-xl px-3 sm:px-3.5 flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          ${isAll ? `
            <span class="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0"></span>
            <span class="truncate font-bold text-slate-900 dark:text-white">${allLabel}</span>
          ` : selectedName ? `
            <span class="w-2.5 h-2.5 rounded-full ${selectedMeta.dotColor} flex-shrink-0 ring-2"></span>
            <span class="truncate font-black text-slate-900 dark:text-white">${selectedName}</span>
            <span class="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">• ${selectedMeta.category}</span>
          ` : `
            <span class="text-slate-400 dark:text-slate-500 font-normal truncate">${placeholder}</span>
          `}
        </div>

        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 ${disabled ? '' : 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400'} transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="w-4 h-4"></i>
        </div>
      </button>

      <!-- Hidden Input for standard form compatibility -->
      <input type="hidden" id="${id}" value="${selectedName || ''}">

      <!-- Popover Floating Dropdown (Shadcn Command Menu) -->
      <div 
        id="${id}-popover" 
        class="combobox-popover hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <!-- Search Input Bar -->
        <div class="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-2">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 dark:text-slate-500 ml-1.5 flex-shrink-0"></i>
          <input 
            type="text" 
            id="${id}-search" 
            placeholder="Cari mata pelajaran (contoh: MTK, INF)..." 
            class="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-1.5 pr-2"
            autocomplete="off"
          >
          <button type="button" id="${id}-search-clear" class="hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- Grouped List Container -->
        <div id="${id}-list" class="max-h-64 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
          ${renderMapelItemsHTML({ mapelList: normalizedList, selectedValue: selectedName, allowAll, allLabel })}
        </div>

        <!-- Bottom Action: Kelola / Tambah Mata Pelajaran Baru -->
        ${allowManage ? `
          <div class="p-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <button 
              type="button" 
              id="${id}-btn-manage" 
              class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-dashed border-emerald-300 dark:border-emerald-700/60 transition group"
            >
              <i data-lucide="book-plus" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"></i>
              <span>${manageLabel}</span>
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render List Items inside Popover for Mapel
 * Grouping 100% DIBACA DARI KOLOM KATEGORI DI DATABASE MASTER MAPEL!
 */
export function renderMapelItemsHTML({
  mapelList = [],
  selectedValue = '',
  allowAll = false,
  allLabel = 'Semua Mata Pelajaran',
  searchQuery = ''
}) {
  const query = (searchQuery || '').trim().toLowerCase();
  const normalizedList = normalizeMapelList(mapelList);

  // Filter items matching search
  const filtered = normalizedList.filter(m => {
    if (!query) return true;
    const nameMatch = m.nama_mapel.toLowerCase().includes(query);
    const codeMatch = (m.kode || '').toLowerCase().includes(query);
    const catMatch = (m.kategori || '').toLowerCase().includes(query);
    return nameMatch || codeMatch || catMatch;
  });

  if (filtered.length === 0 && (!allowAll || (query && !allLabel.toLowerCase().includes(query)))) {
    return `
      <div class="text-center py-6 text-slate-400 dark:text-slate-500 text-xs space-y-1">
        <i data-lucide="book-x" class="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600"></i>
        <p class="font-semibold text-slate-600 dark:text-slate-300">Mata pelajaran tidak ditemukan</p>
        <p class="text-[10px]">Coba cari dengan kata kunci lain atau gunakan tombol tambah di bawah</p>
      </div>
    `;
  }

  let html = '';

  // Opsi "Semua Mata Pelajaran" jika diizinkan (untuk filter)
  if (allowAll && (!query || allLabel.toLowerCase().includes(query))) {
    const isSelected = !selectedValue || selectedValue === '';
    html += `
      <div class="pb-1">
        <button 
          type="button" 
          class="combobox-item w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${isSelected ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}"
          data-value=""
          data-label="${allLabel}"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0"></span>
            <div>
              <p class="text-xs font-bold">${allLabel}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500">Tampilkan seluruh data tanpa filter mapel</p>
            </div>
          </div>
          ${isSelected ? `<i data-lucide="check" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 font-bold"></i>` : ''}
        </button>
      </div>
    `;
  }

  // GROUPING DINAMIS BERDASARKAN FIELD KATEGORI DATABASE
  // Tidak ada tebak-tebakan berdasarkan kata kunci nama!
  const categoryGroups = {};
  filtered.forEach(m => {
    const cat = (m.kategori || 'Umum').trim();
    if (!categoryGroups[cat]) {
      categoryGroups[cat] = [];
    }
    categoryGroups[cat].push(m);
  });

  // Urutkan kelompok kategori: Kejuruan, Umum, lalu lainnya
  const sortedCategories = Object.keys(categoryGroups).sort((a, b) => {
    if (a.toLowerCase() === 'kejuruan') return -1;
    if (b.toLowerCase() === 'kejuruan') return 1;
    if (a.toLowerCase() === 'umum') return -1;
    if (b.toLowerCase() === 'umum') return 1;
    return a.localeCompare(b);
  });

  sortedCategories.forEach(catName => {
    const items = categoryGroups[catName] || [];
    if (items.length === 0) return;

    const catLower = catName.toLowerCase();
    const dotBg = catLower === 'kejuruan' ? 'bg-sky-400' : (catLower === 'umum' ? 'bg-emerald-400' : 'bg-purple-400');

    html += `
      <div class="pt-2 first:pt-0">
        <!-- Group Header -->
        <div class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 pb-1 flex items-center gap-1.5 select-none">
          <span class="w-1.5 h-1.5 rounded-full ${dotBg}"></span>
          <span>MATA PELAJARAN ${catName.toUpperCase()}</span>
          <span class="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.2 rounded-md ml-auto">${items.length} Mapel</span>
        </div>

        <!-- Group Items -->
        <div class="space-y-1 mt-0.5">
          ${items.map(m => {
            const isSelected = m.nama_mapel === selectedValue;
            const meta = getMapelMeta(m, normalizedList);

            return `
              <button 
                type="button" 
                class="combobox-item w-full flex items-center justify-between p-2 rounded-xl text-left transition group min-h-[42px] ${isSelected ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800 shadow-2xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'}"
                data-value="${m.nama_mapel}"
                data-label="${m.nama_mapel}"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <!-- Dot Indicator -->
                  <span class="w-2.5 h-2.5 rounded-full ${meta.dotColor} flex-shrink-0 ring-2"></span>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-black tracking-tight">${m.nama_mapel}</span>
                      <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${meta.badgeBg}">
                        ${meta.code}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Checkmark -->
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
  });

  return html;
}

/**
 * Inisialisasi event listener dan interaktivitas MapelCombobox
 */
export function initMapelCombobox(container, {
  id = 'combobox-mapel',
  mapelList = [],
  selectedValue = '',
  allowAll = false,
  allLabel = 'Semua Mata Pelajaran',
  allowManage = true,
  onSelect = () => {},
  onManage = () => {}
}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const popover = wrapper.querySelector(`#${id}-popover`);
  const searchInput = wrapper.querySelector(`#${id}-search`);
  const searchClear = wrapper.querySelector(`#${id}-search-clear`);
  const listContainer = wrapper.querySelector(`#${id}-list`);
  const hiddenInput = wrapper.querySelector(`#${id}`);
  const btnManage = wrapper.querySelector(`#${id}-btn-manage`);

  const normalizedList = normalizeMapelList(mapelList);
  let currentSelected = (selectedValue || '').trim();

  function openPopover() {
    if (trigger?.disabled || trigger?.hasAttribute('disabled')) return;
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
    listContainer.innerHTML = renderMapelItemsHTML({
      mapelList: normalizedList,
      selectedValue: currentSelected,
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

        closePopover();

        // Update trigger UI
        const isAll = allowAll && (!val || val === '');
        const selectedObj = normalizedList.find(m => m.nama_mapel === val);
        const meta = val && !isAll ? getMapelMeta(selectedObj || val, normalizedList) : null;
        
        const triggerContent = trigger.querySelector('.min-w-0');
        if (triggerContent) {
          if (isAll) {
            triggerContent.innerHTML = `
              <span class="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0"></span>
              <span class="truncate font-bold text-slate-900 dark:text-white">${allLabel}</span>
            `;
          } else if (val) {
            triggerContent.innerHTML = `
              <span class="w-2.5 h-2.5 rounded-full ${meta.dotColor} flex-shrink-0 ring-2"></span>
              <span class="truncate font-black text-slate-900 dark:text-white">${val}</span>
              <span class="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">• ${meta.category}</span>
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

  // Manage button click
  if (btnManage) {
    btnManage.addEventListener('click', (e) => {
      e.stopPropagation();
      closePopover();
      if (onManage) onManage();
    });
  }

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

  // Initial render
  renderList('');
}
