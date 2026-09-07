// components/HariCombobox.js - Custom Shadcn/UI Combobox untuk Pemilihan Hari
export const HARI_OPTIONS = [
  { value: 'Senin', label: 'Senin', color: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'Selasa', label: 'Selasa', color: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800' },
  { value: 'Rabu', label: 'Rabu', color: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'Kamis', label: 'Kamis', color: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800' },
  { value: 'Jumat', label: 'Jumat', color: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800' },
  { value: 'Sabtu', label: 'Sabtu', color: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800' }
];

export function renderHariComboboxHTML({
  id = 'combobox-hari',
  selectedValue = 'Senin',
  placeholder = 'Pilih Hari...',
  allowAll = false,
  allLabel = 'Semua Hari',
  size = 'md'
} = {}) {
  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-xs sm:text-sm';

  const currentObj = HARI_OPTIONS.find(h => h.value.toLowerCase() === (selectedValue || '').toLowerCase());
  const displayLabel = selectedValue === 'semua' || (allowAll && !selectedValue) 
    ? allLabel 
    : (currentObj ? currentObj.label : (selectedValue || placeholder));

  return `
    <div class="relative w-full custom-hari-combobox" id="${id}-wrapper" data-combobox-id="${id}">
      <button
        type="button"
        id="${id}-trigger"
        class="combobox-trigger w-full ${heightClass} font-bold bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl px-3 sm:px-3.5 flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 truncate min-w-0 flex-1">
          ${currentObj ? `
            <span class="w-2.5 h-2.5 rounded-full ${currentObj.color} flex-shrink-0"></span>
          ` : `
            <i data-lucide="calendar" class="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0"></i>
          `}
          <span class="truncate ${!currentObj && selectedValue !== 'semua' ? 'text-slate-400 dark:text-slate-500 font-normal' : 'font-extrabold text-slate-900 dark:text-white'}">
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
        <div class="p-1 max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar" id="${id}-options">
          ${allowAll ? `
            <button
              type="button"
              class="w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-between transition ${selectedValue === 'semua' || !selectedValue ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-extrabold border border-emerald-200 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}"
              data-value="semua"
            >
              <div class="flex items-center gap-2">
                <i data-lucide="calendar-days" class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500"></i>
                <span>${allLabel}</span>
              </div>
              ${selectedValue === 'semua' || !selectedValue ? '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"></i>' : ''}
            </button>
          ` : ''}

          ${HARI_OPTIONS.map(h => {
            const isSelected = (selectedValue || '').toLowerCase() === h.value.toLowerCase();
            return `
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between transition ${isSelected ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-black border border-emerald-200 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium'}"
                data-value="${h.value}"
              >
                <div class="flex items-center gap-2.5">
                  <span class="w-2.5 h-2.5 rounded-full ${h.color} flex-shrink-0"></span>
                  <span class="font-bold">${h.label}</span>
                </div>
                ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"></i>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

export function initHariCombobox(container, {
  id = 'combobox-hari',
  selectedValue = 'Senin',
  onSelect = () => {}
} = {}) {
  const wrapper = container.querySelector(`#${id}-wrapper`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const popover = wrapper.querySelector(`#${id}-popover`);
  const arrow = trigger?.querySelector('.dropdown-arrow');

  function open() {
    popover.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (arrow) arrow.classList.add('rotate-180');
  }

  function close() {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    if (arrow) arrow.classList.remove('rotate-180');
  }

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) {
      // Close other comboboxes
      document.querySelectorAll('.custom-hari-combobox [id$="-popover"], .combobox-popover').forEach(p => p.classList.add('hidden'));
      open();
    } else {
      close();
    }
  });

  popover?.querySelectorAll('button[data-value]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.getAttribute('data-value');
      close();
      onSelect(val);
    });
  });

  // Click outside listener
  const handleOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      close();
    }
  };
  document.addEventListener('click', handleOutsideClick);

  if (window.lucide) window.lucide.createIcons();
}
