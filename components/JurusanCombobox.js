// components/JurusanCombobox.js - Reusable Shadcn/UI Style Dynamic Jurusan Combobox
// 100% dinamis berdasarkan master data public.jurusan (db.getJurusanList())

/**
 * Format label tampilan untuk jurusan
 * Contoh: "AKL — Akuntansi dan Keuangan Lembaga" atau "Animasi" jika tanpa kode
 */
export function formatJurusanLabel(item) {
  if (!item) return '';
  const nama = (item.nama || '').trim();
  const kode = (item.kode || '').trim();
  if (kode && nama) {
    return `[${kode}] ${nama}`;
  }
  return nama || kode || '';
}

/**
 * Format badge singkat untuk jurusan
 * Contoh: "AKL" atau "Animasi"
 */
export function formatJurusanShort(item) {
  if (!item) return '';
  return (item.kode || item.nama || '').trim();
}

/**
 * Render HTML Trigger & Popover Dropdown untuk Jurusan
 */
export function renderJurusanComboboxHTML({
  id = 'combobox-jurusan',
  selectedId = '',
  jurusanList = [],
  isAdmin = false,
  size = 'md', // 'sm' | 'md'
  placeholder = 'Pilih Program Keahlian / Jurusan...',
  disabled = false
}) {
  const items = Array.isArray(jurusanList) ? jurusanList.filter(j => j.is_active !== false) : [];
  const selectedObj = items.find(j => j.id === selectedId) || null;

  const heightClass = size === 'sm' ? 'h-9 px-2.5 sm:px-3 text-xs' : 'h-11 px-3 sm:px-3.5 text-xs sm:text-sm';
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const hasItems = items.length > 0;
  const triggerLabel = selectedObj ? formatJurusanShort(selectedObj) : (hasItems ? 'Pilih Jurusan' : 'Belum ada jurusan');
  const triggerFullName = selectedObj ? selectedObj.nama : (hasItems ? placeholder : (isAdmin ? 'Belum ada jurusan terdaftar' : 'Belum ada jurusan yang tersedia.'));
  const triggerDotColor = selectedObj ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-400 ring-slate-200';

  return `
    <div class="relative w-full jurusan-combobox-wrapper space-y-1.5" data-combobox-id="${id}">
      
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        ${disabled || !hasItems ? 'disabled' : ''}
        class="combobox-jurusan-trigger w-full ${heightClass} font-bold bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left disabled:opacity-60 disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full ${triggerDotColor} ring-2 flex-shrink-0"></span>
          <span class="font-extrabold text-slate-900 dark:text-white truncate">${triggerLabel}</span>
          <span class="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">• ${triggerFullName}</span>
        </div>

        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="${iconSizeClass}"></i>
        </div>
      </button>

      <!-- Hidden Input for Form Access (Primary Value = jurusan_id) -->
      <input type="hidden" id="${id}" value="${selectedObj ? selectedObj.id : ''}">

      <!-- Popover Floating Dropdown (Shadcn Command Menu) -->
      <div 
        id="${id}-menu" 
        class="combobox-jurusan-menu hidden absolute left-0 right-0 sm:min-w-[280px] mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Master Jurusan (${items.length})
        </div>

        ${!hasItems ? `
          <div class="p-3 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
            <p class="font-semibold">${isAdmin ? 'Belum ada jurusan' : 'Belum ada jurusan yang tersedia.'}</p>
            ${isAdmin ? `
              <p class="text-[10px] text-slate-400">Tambahkan jurusan baru melalui menu Master Jurusan di Pengaturan.</p>
            ` : ''}
          </div>
        ` : `
          <div class="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
            ${items.map(j => {
              const isSelected = selectedObj && selectedObj.id === j.id;
              const formattedLabel = formatJurusanLabel(j);
              const shortCode = formatJurusanShort(j);

              return `
                <button 
                  type="button" 
                  class="btn-select-jurusan-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${isSelected ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}" 
                  data-id="${j.id}"
                  data-nama="${j.nama}"
                  data-kode="${j.kode || ''}"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900 flex-shrink-0"></span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-slate-900 dark:text-white font-extrabold">${shortCode}</span>
                      </div>
                      <span class="text-[11px] text-slate-500 dark:text-slate-400 font-normal block leading-tight truncate">${j.nama}</span>
                    </div>
                  </div>
                  ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-1"></i>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        `}

      </div>

    </div>
  `;
}

/**
 * Inisialisasi Event Listener untuk Jurusan Combobox
 */
export function initJurusanCombobox(container, {
  id = 'combobox-jurusan',
  jurusanList = [],
  onSelect = () => {}
}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const menu = wrapper.querySelector(`#${id}-menu`);
  const hiddenInput = wrapper.querySelector(`#${id}`);

  if (!trigger || !menu) return;

  // Toggle Dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');

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

  // Pilih Jurusan dari menu
  wrapper.querySelectorAll('.btn-select-jurusan-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const jId = btn.getAttribute('data-id');
      const nama = btn.getAttribute('data-nama');
      const kode = btn.getAttribute('data-kode');

      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');

      if (hiddenInput) hiddenInput.value = jId;

      const shortCode = kode || nama;
      trigger.innerHTML = `
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300 flex-shrink-0"></span>
          <span class="font-extrabold text-slate-900 dark:text-white truncate">${shortCode}</span>
          <span class="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">• ${nama}</span>
        </div>
        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevrons-up-down" class="w-4 h-4"></i>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();

      const selectedObj = { id: jId, nama, kode, is_active: true };
      if (onSelect) onSelect(jId, selectedObj);
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

