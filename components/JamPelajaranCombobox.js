// components/JamPelajaranCombobox.js - Custom Shadcn/UI Combobox untuk Pemilihan Slot Jam Pelajaran (Per-JP)
import { DEFAULT_MASTER_JAM } from '../constants/masterJam.js';

export function renderJamPelajaranComboboxHTML({
  id = 'combobox-jam-pelajaran',
  jamList = [],
  selectedId = '',
  placeholder = 'Pilih Jam...',
  size = 'md'
} = {}) {
  const effectiveJamList = (Array.isArray(jamList) && jamList.length > 0) ? jamList : DEFAULT_MASTER_JAM;
  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-xs sm:text-sm';

  const currentObj = (effectiveJamList || []).find(j => j.id === selectedId || String(j.nomor_urut) === String(selectedId));
  const isCurrentIstirahat = currentObj?.tipe_slot === 'istirahat' || currentObj?.is_istirahat === true;
  const displayLabel = currentObj
    ? `${currentObj.label} (${(currentObj.jam_mulai || '').substring(0, 5)} - ${(currentObj.jam_selesai || '').substring(0, 5)})${isCurrentIstirahat ? ' [Istirahat]' : ''}`
    : placeholder;

  return `
    <div class="relative w-full custom-jam-combobox" id="${id}-wrapper" data-combobox-id="${id}">
      <button
        type="button"
        id="${id}-trigger"
        class="combobox-trigger w-full ${heightClass} font-bold bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl px-3 sm:px-3.5 flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 truncate min-w-0 flex-1">
          <span class="w-5 h-5 rounded-md ${currentObj ? (isCurrentIstirahat ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700') : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'} font-black text-[10px] flex items-center justify-center flex-shrink-0">
            ${currentObj ? currentObj.nomor_urut : '-'}
          </span>
          <span class="truncate ${!currentObj ? 'text-slate-400 dark:text-slate-500 font-normal' : 'font-extrabold text-slate-900 dark:text-white'}">
            ${displayLabel}
          </span>
        </div>
        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200 dropdown-arrow"></i>
        </div>
      </button>

      <!-- Dropdown Popover -->
      <div
        id="${id}-popover"
        class="absolute left-0 right-0 top-full mt-1 z-50 hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      >
        <!-- Search Filter -->
        <div class="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div class="relative flex items-center">
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 pointer-events-none"></i>
            <input
              type="text"
              id="${id}-search"
              placeholder="Cari jam / waktu..."
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div class="p-1 max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar" id="${id}-options">
          ${(effectiveJamList || []).length === 0 ? `
            <div class="py-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">Belum ada master jam pelajaran</div>
          ` : (effectiveJamList || []).map(j => {
            const isSelected = j.id === selectedId || String(j.nomor_urut) === String(selectedId);
            const isSlotIstirahat = j.tipe_slot === 'istirahat' || j.is_istirahat === true;
            const jamMulaiTrim = (j.jam_mulai || '').substring(0, 5);
            const jamSelesaiTrim = (j.jam_selesai || '').substring(0, 5);
            return `
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between transition ${isSelected ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-black border border-emerald-200 dark:border-emerald-800' : isSlotIstirahat ? 'hover:bg-amber-50/60 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium'}"
                data-id="${j.id}"
                data-urut="${j.nomor_urut}"
                data-label="${j.label}"
                data-mulai="${jamMulaiTrim}"
                data-selesai="${jamSelesaiTrim}"
                data-search="${(j.label + ' ' + jamMulaiTrim + ' ' + jamSelesaiTrim + ' ' + (j.keterangan || '') + (isSlotIstirahat ? ' istirahat' : '')).toLowerCase()}"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-5 h-5 rounded-md ${isSelected ? 'bg-emerald-600 text-white' : isSlotIstirahat ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'} font-extrabold text-[10px] flex items-center justify-center flex-shrink-0">
                    ${j.nomor_urut}
                  </span>
                  <div class="truncate">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-slate-800 dark:text-slate-100 truncate">${j.label}</span>
                      ${isSlotIstirahat ? `
                        <span class="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded">Istirahat</span>
                      ` : ''}
                    </div>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 block">${jamMulaiTrim} - ${jamSelesaiTrim} ${j.keterangan ? '• ' + j.keterangan : ''}</span>
                  </div>
                </div>
                ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0"></i>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

export function initJamPelajaranCombobox(container, {
  id = 'combobox-jam-pelajaran',
  jamList = [],
  selectedId = '',
  onSelect = () => {}
} = {}) {
  const wrapper = container.querySelector(`#${id}-wrapper`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const popover = wrapper.querySelector(`#${id}-popover`);
  const searchInput = wrapper.querySelector(`#${id}-search`);
  const optionsContainer = wrapper.querySelector(`#${id}-options`);
  const arrow = trigger?.querySelector('.dropdown-arrow');

  function open() {
    popover.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (arrow) arrow.classList.add('rotate-180');
    if (searchInput) {
      searchInput.value = '';
      filterOptions('');
      setTimeout(() => searchInput.focus(), 50);
    }
  }

  function close() {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    if (arrow) arrow.classList.remove('rotate-180');
  }

  function filterOptions(query) {
    const q = (query || '').toLowerCase().trim();
    const buttons = optionsContainer.querySelectorAll('button[data-search]');
    let hasVisible = false;
    buttons.forEach(btn => {
      const text = btn.getAttribute('data-search') || '';
      if (!q || text.includes(q)) {
        btn.classList.remove('hidden');
        hasVisible = true;
      } else {
        btn.classList.add('hidden');
      }
    });

    let emptyMsg = optionsContainer.querySelector('.no-results-msg');
    if (!hasVisible) {
      if (!emptyMsg) {
        emptyMsg = document.createElement('div');
        emptyMsg.className = 'no-results-msg py-4 text-center text-xs text-slate-400 dark:text-slate-500 italic';
        emptyMsg.textContent = 'Tidak ada jam pelajaran yang cocok.';
        optionsContainer.appendChild(emptyMsg);
      }
      emptyMsg.classList.remove('hidden');
    } else if (emptyMsg) {
      emptyMsg.classList.add('hidden');
    }
  }

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) {
      document.querySelectorAll('.custom-jam-combobox [id$="-popover"], .combobox-popover').forEach(p => p.classList.add('hidden'));
      open();
    } else {
      close();
    }
  });

  searchInput?.addEventListener('input', (e) => {
    filterOptions(e.target.value);
  });

  optionsContainer?.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.getAttribute('data-id');
      const itemObj = (jamList || []).find(j => j.id === itemId);
      close();
      onSelect(itemObj || { id: itemId, nomor_urut: Number(btn.getAttribute('data-urut')) || 1, label: btn.getAttribute('data-label') });
    });
  });

  const handleOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      close();
    }
  };
  document.addEventListener('click', handleOutsideClick);

  if (window.lucide) window.lucide.createIcons();
}
