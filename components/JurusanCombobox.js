// components/JurusanCombobox.js - Reusable Shadcn/UI Style Jurusan (Major/Vocational Program) Combobox
// Menyediakan pilihan Program Keahlian / Jurusan dengan dukungan inline custom entry

export const STANDARD_JURUSAN = [
  {
    code: 'TJKT',
    nama: 'Teknik Jaringan Komputer dan Telekomunikasi',
    label: 'TJKT - Komputer & Jaringan',
    dotColor: 'bg-sky-500 shadow-sky-500/50 ring-sky-300',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200'
  },
  {
    code: 'DKV',
    nama: 'Desain Komunikasi Visual',
    label: 'DKV - Desain Komunikasi Visual',
    dotColor: 'bg-amber-500 shadow-amber-500/50 ring-amber-300',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    code: 'MPLB',
    nama: 'Manajemen Perkantoran dan Layanan Bisnis',
    label: 'MPLB - Manajemen Perkantoran',
    dotColor: 'bg-purple-500 shadow-purple-500/50 ring-purple-300',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  {
    code: 'AKL',
    nama: 'Akuntansi dan Keuangan Lembaga',
    label: 'AKL - Akuntansi & Keuangan',
    dotColor: 'bg-emerald-500 shadow-emerald-500/50 ring-emerald-300',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }
];

/**
 * Render HTML Trigger & Popover Dropdown untuk Jurusan / Program Keahlian
 */
export function renderJurusanComboboxHTML({
  id = 'combobox-jurusan',
  selectedValue = 'Teknik Jaringan Komputer dan Telekomunikasi',
  allowCustom = true,
  size = 'md', // 'sm' | 'md'
  placeholder = 'Pilih Program Keahlian / Jurusan...'
}) {
  const isCustom = !STANDARD_JURUSAN.some(j => j.nama === selectedValue) && selectedValue !== '';
  const standardObj = STANDARD_JURUSAN.find(j => j.nama === selectedValue) || STANDARD_JURUSAN[0];

  const heightClass = size === 'sm' ? 'h-9 px-2.5 text-xs' : 'h-10 px-3 text-xs sm:text-sm';
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const triggerLabel = isCustom ? `✏️ ${selectedValue} (Kustom)` : (standardObj?.code || 'Pilih');
  const triggerFullName = isCustom ? selectedValue : (standardObj?.nama || placeholder);
  const triggerDotColor = isCustom ? 'bg-indigo-500 ring-indigo-300' : (standardObj?.dotColor || 'bg-slate-400');

  return `
    <div class="relative w-full jurusan-combobox-wrapper space-y-1.5" data-combobox-id="${id}">
      
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        class="combobox-jurusan-trigger w-full ${heightClass} font-bold bg-slate-50 hover:bg-white text-slate-800 border border-slate-200 hover:border-emerald-500 rounded-xl flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full ${triggerDotColor} ring-2 flex-shrink-0"></span>
          <span class="font-extrabold text-slate-900 truncate">${triggerLabel}</span>
          <span class="hidden sm:inline text-[11px] font-medium text-slate-500 truncate">• ${triggerFullName}</span>
        </div>

        <div class="flex items-center gap-1 text-slate-400 group-hover:text-emerald-600 transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="${iconSizeClass}"></i>
        </div>
      </button>

      <!-- Hidden Input for Form Access -->
      <input type="hidden" id="${id}" value="${selectedValue || standardObj?.nama || ''}">

      <!-- Popover Floating Dropdown (Shadcn Command Menu) -->
      <div 
        id="${id}-menu" 
        class="combobox-jurusan-menu hidden absolute left-0 right-0 sm:min-w-[280px] mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Program Keahlian / Jurusan
        </div>

        <div class="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
          ${STANDARD_JURUSAN.map(j => {
            const isActive = !isCustom && j.nama === selectedValue;
            return `
              <button 
                type="button" 
                class="btn-select-jurusan-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${isActive ? 'bg-emerald-50 text-emerald-950 border border-emerald-200/80' : 'hover:bg-slate-50 text-slate-700'}" 
                data-nama="${j.nama}"
                data-code="${j.code}"
                data-is-custom="false"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-full ${j.dotColor} ring-2 flex-shrink-0"></span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-900 font-extrabold">${j.code}</span>
                      <span class="text-[10px] px-1.5 py-0.2 rounded font-bold ${j.badgeClass}">SMKN 1</span>
                    </div>
                    <span class="text-[11px] text-slate-500 font-normal block leading-tight truncate">${j.nama}</span>
                  </div>
                </div>
                ${isActive ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 flex-shrink-0 ml-1"></i>' : ''}
              </button>
            `;
          }).join('')}
        </div>

        ${allowCustom ? `
          <div class="border-t border-slate-100 my-1"></div>

          <!-- Section: Custom Major Option -->
          <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Jurusan Tambahan / Kustom
          </div>

          <button 
            type="button" 
            class="btn-select-jurusan-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${isCustom ? 'bg-indigo-50 text-indigo-950 border border-indigo-200/80' : 'hover:bg-slate-50 text-slate-700'}" 
            data-nama="__custom__"
            data-code="Kustom"
            data-is-custom="true"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="p-1 rounded-lg bg-indigo-100 text-indigo-700 flex-shrink-0">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              </div>
              <div class="min-w-0">
                <span class="truncate block text-slate-900 font-extrabold">+ Tambah Jurusan Baru...</span>
                <span class="text-[10px] text-slate-400 font-normal block leading-tight">Input nama jurusan kustom secara mandiri</span>
              </div>
            </div>
            ${isCustom ? '<i data-lucide="check" class="w-4 h-4 text-indigo-600 flex-shrink-0 ml-1"></i>' : ''}
          </button>
        ` : ''}

      </div>

      <!-- Input Text Jurusan Kustom (Muncul jika mode kustom aktif) -->
      <div id="${id}-custom-container" class="${isCustom ? '' : 'hidden'} animate-in fade-in duration-150">
        <input 
          type="text" 
          id="${id}-custom-input" 
          value="${isCustom ? selectedValue : ''}" 
          placeholder="Ketik Nama Jurusan Baru (contoh: Animasi / RPL)..." 
          class="w-full text-xs p-2.5 bg-indigo-50/50 border border-indigo-200 focus:bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
        >
      </div>

    </div>
  `;
}

/**
 * Inisialisasi Event Listener untuk Jurusan Combobox
 */
export function initJurusanCombobox(container, {
  id = 'combobox-jurusan',
  onSelect = () => {}
}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const menu = wrapper.querySelector(`#${id}-menu`);
  const hiddenInput = wrapper.querySelector(`#${id}`);
  const customContainer = wrapper.querySelector(`#${id}-custom-container`);
  const customInput = wrapper.querySelector(`#${id}-custom-input`);

  if (!trigger || !menu) return;

  // Toggle Dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');

    document.querySelectorAll('.combobox-tingkat-menu, .combobox-jurusan-menu, .combobox-academic-year-menu, .combobox-menu').forEach(m => {
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

  // Pilih Jurusan
  wrapper.querySelectorAll('.btn-select-jurusan-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCustom = btn.getAttribute('data-is-custom') === 'true';
      const nama = btn.getAttribute('data-nama');
      const code = btn.getAttribute('data-code');

      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');

      if (isCustom) {
        customContainer?.classList.remove('hidden');
        customInput?.focus();
        const customVal = customInput?.value.trim() || 'Kejuruan Kustom';
        if (hiddenInput) hiddenInput.value = customVal;

        trigger.innerHTML = `
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-300 flex-shrink-0"></span>
            <span class="font-extrabold text-indigo-900 truncate">✏️ Jurusan Kustom</span>
            <span class="hidden sm:inline text-[11px] font-medium text-slate-500 truncate">• Tambah Mandiri</span>
          </div>
          <div class="flex items-center gap-1 text-slate-400 group-hover:text-emerald-600 transition flex-shrink-0">
            <i data-lucide="chevrons-up-down" class="w-4 h-4"></i>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();

        if (onSelect) onSelect(customVal, true);
      } else {
        customContainer?.classList.add('hidden');
        if (hiddenInput) hiddenInput.value = nama;

        const std = STANDARD_JURUSAN.find(j => j.nama === nama) || STANDARD_JURUSAN[0];
        trigger.innerHTML = `
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="w-2.5 h-2.5 rounded-full ${std.dotColor} ring-2 flex-shrink-0"></span>
            <span class="font-extrabold text-slate-900 truncate">${std.code}</span>
            <span class="hidden sm:inline text-[11px] font-medium text-slate-500 truncate">• ${std.nama}</span>
          </div>
          <div class="flex items-center gap-1 text-slate-400 group-hover:text-emerald-600 transition flex-shrink-0">
            <i data-lucide="chevrons-up-down" class="w-4 h-4"></i>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();

        if (onSelect) onSelect(nama, false);
      }
    });
  });

  // Listener input kustom
  customInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (hiddenInput) hiddenInput.value = val || 'Kejuruan Kustom';
    if (onSelect) onSelect(val, true);
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
