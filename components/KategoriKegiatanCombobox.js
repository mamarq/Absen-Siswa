// components/KategoriKegiatanCombobox.js - Custom Shadcn/UI Style Combobox untuk Kategori Catatan & Sikap Siswa
// Menyediakan pemilihan kategori catatan dengan badge ikon & warna visual yang jelas serta dukungan Dark Mode

export const KATEGORI_KEGIATAN_LIST = [
  {
    id: 'Catatan Positif / Prestasi',
    label: 'Catatan Positif / Prestasi',
    shortLabel: '🌟 Prestasi / Positif',
    icon: 'sparkles',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    desc: 'Keaktifan kelas, prestasi lomba, teladan'
  },
  {
    id: 'Catatan Perilaku / Pelanggaran',
    label: 'Catatan Perilaku / Pelanggaran',
    shortLabel: '⚠️ Perilaku / Pelanggaran',
    icon: 'alert-triangle',
    badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700',
    desc: 'Pelanggaran tata tertib, terlambat, indisipliner'
  },
  {
    id: 'Bimbingan / Remedial',
    label: 'Bimbingan / Remedial',
    shortLabel: '📘 Bimbingan / Remedial',
    icon: 'book-open',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
    desc: 'Sesi konseling belajar, perbaikan nilai, tutor sebaya'
  },
  {
    id: 'Dispensasi / Lomba',
    label: 'Dispensasi / Lomba',
    shortLabel: '🏆 Dispensasi / Lomba',
    icon: 'trophy',
    badgeClass: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
    desc: 'Tugas perwakilan sekolah, olimpiade, pertandingan'
  },
  {
    id: 'Izin Khusus / Dinas Luar',
    label: 'Izin Khusus / Dinas Luar',
    shortLabel: '📄 Izin Khusus / Dinas',
    icon: 'file-text',
    badgeClass: 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-700',
    desc: 'Izin resmi dengan surat keterangan, acara keluarga'
  },
  {
    id: 'Lainnya',
    label: 'Lainnya',
    shortLabel: '📌 Catatan Lainnya',
    icon: 'pin',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    desc: 'Catatan umum atau informasi tambahan'
  }
];

export function renderKategoriKegiatanComboboxHTML({
  id = 'combobox-kategori-kegiatan',
  selectedValue = 'Catatan Positif / Prestasi',
  size = 'sm'
} = {}) {
  const currentObj = KATEGORI_KEGIATAN_LIST.find(k => k.id === selectedValue || k.label === selectedValue) || KATEGORI_KEGIATAN_LIST[0];
  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-xs sm:text-sm';

  return `
    <div class="relative w-full custom-kategori-combobox" id="${id}-wrapper" data-combobox-id="${id}">
      <input type="hidden" id="${id}" value="${currentObj.id}" />

      <!-- Trigger Button -->
      <button
        type="button"
        id="${id}-trigger"
        class="combobox-trigger w-full ${heightClass} font-bold bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl px-3 sm:px-3.5 flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentObj.badgeClass} flex-shrink-0">
            ${currentObj.shortLabel}
          </span>
        </div>
        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200 dropdown-arrow"></i>
        </div>
      </button>

      <!-- Deskripsi Kategori di Bawah Dropdown -->
      <p id="${id}-desc" class="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 px-0.5 leading-relaxed flex items-center gap-1.5">
        <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0"></i>
        <span class="desc-text">${currentObj.desc}</span>
      </p>

      <!-- Dropdown Popover -->
      <div
        id="${id}-popover"
        class="absolute left-0 right-0 top-full mt-1 z-50 hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="p-1.5 max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
          ${KATEGORI_KEGIATAN_LIST.map(k => {
            const isSelected = k.id === currentObj.id;
            return `
              <button
                type="button"
                class="w-full text-left p-2 rounded-xl text-xs transition flex items-center justify-between group ${isSelected ? 'bg-slate-100 dark:bg-slate-800 font-bold border border-slate-300 dark:border-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'}"
                data-value="${k.id}"
              >
                <div class="space-y-0.5 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ${k.badgeClass}">
                      ${k.shortLabel}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate pl-0.5">${k.desc}</p>
                </div>
                ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0"></i>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

export function initKategoriKegiatanCombobox(container, {
  id = 'combobox-kategori-kegiatan',
  selectedValue = 'Catatan Positif / Prestasi',
  onSelect = null
} = {}) {
  const wrapper = container.querySelector(`[data-combobox-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const popover = wrapper.querySelector(`#${id}-popover`);
  const hiddenInput = wrapper.querySelector(`#${id}`);
  const arrow = trigger?.querySelector('.dropdown-arrow');
  const descElement = wrapper.querySelector(`#${id}-desc .desc-text`);

  if (!trigger || !popover) return;

  let currentValue = selectedValue;

  function openPopover() {
    popover.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  }

  function closePopover() {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    if (arrow) arrow.style.transform = '';
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) {
      openPopover();
    } else {
      closePopover();
    }
  });

  popover.querySelectorAll('button[data-value]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.getAttribute('data-value');
      currentValue = val;
      if (hiddenInput) hiddenInput.value = val;

      const obj = KATEGORI_KEGIATAN_LIST.find(k => k.id === val) || KATEGORI_KEGIATAN_LIST[0];
      const displayContent = trigger.querySelector('.min-w-0');
      if (displayContent) {
        displayContent.innerHTML = `
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${obj.badgeClass} flex-shrink-0">
            ${obj.shortLabel}
          </span>
        `;
      }

      if (descElement) {
        descElement.textContent = obj.desc;
      }

      closePopover();
      if (onSelect) onSelect(val, obj);
    });
  });

  const onOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      closePopover();
    }
  };

  document.removeEventListener('click', onOutsideClick);
  document.addEventListener('click', onOutsideClick);
}
