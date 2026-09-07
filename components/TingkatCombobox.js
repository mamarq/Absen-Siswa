// components/TingkatCombobox.js - Reusable Shadcn/UI Style Tingkat (Grade Level) Combobox
// Digunakan pada Form Master Kelas & Siswa untuk pemilihan Kelas X, XI, XII

export const TINGKAT_OPTIONS = [
  { value: 'X', label: 'Kelas X (Sepuluh)', badge: 'X', desc: 'Tingkat Pertama / Fase E' },
  { value: 'XI', label: 'Kelas XI (Sebelas)', badge: 'XI', desc: 'Tingkat Kedua / Fase F' },
  { value: 'XII', label: 'Kelas XII (Duabelas)', badge: 'XII', desc: 'Tingkat Akhir / Kelulusan' }
];

/**
 * Render HTML Trigger & Popover Dropdown untuk Tingkat Kelas
 */
export function renderTingkatComboboxHTML({
  id = 'combobox-tingkat',
  selectedValue = 'X',
  size = 'md', // 'sm' | 'md'
  placeholder = 'Pilih Tingkat...'
}) {
  const currentOption = TINGKAT_OPTIONS.find(o => o.value === selectedValue) || TINGKAT_OPTIONS[0];
  const heightClass = size === 'sm' ? 'h-9 px-2.5 sm:px-3 text-xs' : 'h-11 px-3 sm:px-3.5 text-xs sm:text-sm';
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return `
    <div class="relative w-full tingkat-combobox-wrapper" data-combobox-id="${id}">
      
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        class="combobox-tingkat-trigger w-full ${heightClass} font-bold bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[11px] flex items-center justify-center flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
            ${currentOption.badge}
          </span>
          <span class="truncate font-extrabold text-slate-900 dark:text-white">${currentOption.label}</span>
        </div>

        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="${iconSizeClass}"></i>
        </div>
      </button>

      <!-- Hidden Input for standard form compatibility -->
      <input type="hidden" id="${id}" value="${currentOption.value}">

      <!-- Popover Floating Dropdown (Shadcn Command Menu) -->
      <div 
        id="${id}-menu" 
        class="combobox-tingkat-menu hidden absolute left-0 right-0 sm:min-w-[220px] mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Tingkat Kelas (Jenjang)
        </div>

        <div class="space-y-0.5">
          ${TINGKAT_OPTIONS.map(opt => {
            const isActive = opt.value === selectedValue;
            return `
              <button 
                type="button" 
                class="btn-select-tingkat-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${isActive ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}" 
                data-value="${opt.value}"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-7 h-7 rounded-lg ${isActive ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold'} flex items-center justify-center text-xs flex-shrink-0">
                    ${opt.badge}
                  </div>
                  <div class="min-w-0">
                    <span class="truncate block text-slate-900 dark:text-white font-extrabold">${opt.label}</span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal block leading-tight">${opt.desc}</span>
                  </div>
                </div>
                ${isActive ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-1"></i>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

    </div>
  `;
}

/**
 * Inisialisasi Event Listener untuk Tingkat Combobox
 */
export function initTingkatCombobox(container, {
  id = 'combobox-tingkat',
  onSelect = () => {}
}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const menu = wrapper.querySelector(`#${id}-menu`);
  const hiddenInput = wrapper.querySelector(`#${id}`);

  if (!trigger || !menu) return;

  // Toggle Popover Dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');

    // Tutup combobox/popover lain yang terbuka
    document.querySelectorAll('.combobox-tingkat-menu, .combobox-jurusan-menu, .combobox-academic-year-menu, .combobox-menu, .combobox-popover').forEach(m => {
      m.classList.add('hidden');
    });
    document.querySelectorAll('.combobox-tingkat-trigger, .combobox-jurusan-trigger, .combobox-academic-year-trigger, .combobox-trigger').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
    });

    if (isHidden) {
      menu.classList.remove('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  // Pilih item
  wrapper.querySelectorAll('.btn-select-tingkat-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.getAttribute('data-value');
      const opt = TINGKAT_OPTIONS.find(o => o.value === val) || TINGKAT_OPTIONS[0];

      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');

      if (hiddenInput) hiddenInput.value = val;

      // Update UI trigger
      trigger.innerHTML = `
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[11px] flex items-center justify-center flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
            ${opt.badge}
          </span>
          <span class="truncate font-extrabold text-slate-900 dark:text-white">${opt.label}</span>
        </div>
        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="w-4 h-4"></i>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();

      if (onSelect) {
        onSelect(val);
      }
    });
  });

  // Tutup jika klik di luar
  const onOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
    }
  };

  document.removeEventListener('click', onOutsideClick);
  document.addEventListener('click', onOutsideClick);
}
