// components/AcademicYearCombobox.js - Reusable Shadcn/UI Style Academic Year Combobox
// Menyediakan pemilih Tahun Ajaran yang konsisten di Topbar, Modal Kenaikan Kelas, dan halaman lainnya

/**
 * Render HTML Trigger & Popover Dropdown untuk Pemilih Tahun Ajaran
 */
export function renderAcademicYearComboboxHTML({
  id = 'combobox-academic-year',
  years = [],
  selectedYear = '',
  isCustomYear = false,
  customYearValue = '',
  allowCustom = false,
  customLabel = '+ Input Tahun Ajaran Baru...',
  size = 'md', // 'sm' | 'md'
  extraBadgeText = null
}) {
  const isSelectedCustom = isCustomYear === true || isCustomYear === 'true';
  const effectiveYear = isSelectedCustom ? (customYearValue || 'Baru') : (selectedYear || years[0] || '2026/2027');
  
  const heightClass = size === 'sm' ? 'h-9 px-2.5 sm:px-3 text-xs' : 'h-11 px-3 sm:px-3.5 text-xs sm:text-sm';
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const triggerLabel = isSelectedCustom ? `✏️ ${customYearValue || 'T.A Baru'} (Kustom)` : effectiveYear;
  const triggerStyle = isSelectedCustom
    ? 'bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100/80 dark:hover:bg-sky-900/60 text-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-800'
    : 'bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-emerald-500';

  return `
    <div class="relative w-full academic-year-combobox-wrapper" data-combobox-id="${id}">
      
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        class="combobox-academic-year-trigger w-full ${heightClass} font-bold ${triggerStyle} border rounded-xl flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <i data-lucide="graduation-cap" class="${iconSizeClass} text-emerald-600 dark:text-emerald-400 flex-shrink-0"></i>
          <span class="truncate font-extrabold text-slate-900 dark:text-white">${triggerLabel}</span>
          ${!isSelectedCustom && extraBadgeText ? `<span class="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">${extraBadgeText(effectiveYear)}</span>` : ''}
        </div>

        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="w-3.5 h-3.5"></i>
        </div>
      </button>

      <!-- Hidden Input for Form/Standard Value Access -->
      <input type="hidden" id="${id}" value="${isSelectedCustom ? '__custom__' : effectiveYear}">

      <!-- Popover Floating Dropdown (Shadcn Command Menu) -->
      <div 
        id="${id}-menu" 
        class="combobox-academic-year-menu hidden absolute left-0 right-0 sm:right-auto sm:min-w-[240px] mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
      >
        <!-- Section: Tahun Ajaran Tersedia -->
        <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Tahun Ajaran
        </div>

        <div class="max-h-52 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
          ${years.map(yr => {
            const isCurrentActive = !isSelectedCustom && yr === selectedYear;
            const extra = extraBadgeText ? extraBadgeText(yr) : '';

            return `
              <button 
                type="button" 
                class="btn-select-academic-year-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${isCurrentActive ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}" 
                data-year="${yr}"
                data-is-custom="false"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <div class="p-1 rounded-lg ${isCurrentActive ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'} flex-shrink-0">
                    <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                  </div>
                  <div class="min-w-0">
                    <span class="truncate block text-slate-900 dark:text-white font-extrabold">${yr}</span>
                    ${extra ? `<span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal block leading-tight">${extra}</span>` : ''}
                  </div>
                </div>
                ${isCurrentActive ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-1"></i>' : ''}
              </button>
            `;
          }).join('')}
        </div>

        ${allowCustom ? `
          <div class="border-t border-slate-100 dark:border-slate-800 my-1"></div>

          <!-- Section: Custom Year Option -->
          <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Tahun Ajaran Baru
          </div>

          <button 
            type="button" 
            class="btn-select-academic-year-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${isSelectedCustom ? 'bg-sky-50 text-sky-950 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-200/80 dark:border-sky-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}" 
            data-year="__custom__"
            data-is-custom="true"
          >
            <div class="flex items-center gap-2 min-w-0">
              <div class="p-1 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex-shrink-0">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              </div>
              <div class="min-w-0">
                <span class="truncate block text-slate-900 dark:text-white font-extrabold">${customLabel}</span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal block leading-tight">Buat tahun ajaran baru secara mandiri</span>
              </div>
            </div>
            ${isSelectedCustom ? '<i data-lucide="check" class="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0 ml-1"></i>' : ''}
          </button>
        ` : ''}

      </div>

    </div>
  `;
}

/**
 * Inisialisasi Event Listener untuk Academic Year Combobox
 */
export function initAcademicYearCombobox(container, {
  id = 'combobox-academic-year',
  onSelect = () => {}
}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const menu = wrapper.querySelector(`#${id}-menu`);
  const hiddenInput = wrapper.querySelector(`#${id}`);

  if (!trigger || !menu) return;

  // Toggle dropdown popover
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');

    // Tutup semua popover combobox lain
    document.querySelectorAll('.combobox-academic-year-menu, .combobox-menu, .action-dropdown-menu, .combobox-popover').forEach(m => {
      m.classList.add('hidden');
    });
    document.querySelectorAll('.combobox-academic-year-trigger, .combobox-trigger, .btn-toggle-action-dropdown').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
    });

    if (isHidden) {
      menu.classList.remove('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  // Pilih item tahun ajaran
  wrapper.querySelectorAll('.btn-select-academic-year-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const yr = btn.getAttribute('data-year');
      const isCustom = btn.getAttribute('data-is-custom') === 'true';

      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');

      if (hiddenInput) hiddenInput.value = yr;

      if (onSelect) {
        onSelect(yr, isCustom);
      }
    });
  });

  // Tutup saat klik di luar
  const onOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
    }
  };

  document.removeEventListener('click', onOutsideClick);
  document.addEventListener('click', onOutsideClick);
}
