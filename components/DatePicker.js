// components/DatePicker.js - Modern Shadcn/UI Style DatePicker (Popover + Indonesian Calendar)

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const SHORT_MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const SHORT_DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Format string tanggal ISO (YYYY-MM-DD) ke format teks Indonesia ringkas & ramah baca
 * Contoh: "2026-08-28" -> "28 Agu 2026"
 */
export function formatIndonesianDate(isoString) {
  if (!isoString) return '';
  try {
    const parts = isoString.split('-');
    if (parts.length !== 3) return isoString;
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const dateObj = new Date(year, monthIndex, day);
    if (isNaN(dateObj.getTime())) return isoString;

    return `${day} ${SHORT_MONTH_NAMES_ID[monthIndex]} ${year}`;
  } catch {
    return isoString;
  }
}

/**
 * Helper untuk mendapatkan format ISO YYYY-MM-DD dari Date object
 */
export function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Render HTML Trigger & Popover Calendar Container
 */
export function renderDatePickerHTML({
  id = 'datepicker-input',
  value = '',
  placeholder = 'Pilih Tanggal...',
  size = 'md', // 'sm' | 'md'
  align = 'right' // 'left' | 'right'
}) {
  const initialValue = value || toISODateString(new Date());
  const formattedText = formatIndonesianDate(initialValue);
  const heightClass = size === 'sm' ? 'h-9 text-xs px-2.5 py-1.5' : 'h-11 text-xs sm:text-sm px-3 py-2';
  const alignClass = align === 'left' ? 'left-0' : 'right-0';

  return `
    <div class="relative w-full datepicker-wrapper" data-datepicker-id="${id}">
      <!-- Trigger Button (Shadcn Popover Trigger) -->
      <button 
        type="button" 
        id="${id}-trigger" 
        class="datepicker-trigger w-full ${heightClass} font-bold bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group text-left"
        aria-haspopup="dialog"
        aria-expanded="false"
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 group-hover:scale-105 transition-transform"></i>
          <span class="truncate font-black text-slate-900 dark:text-white datepicker-label text-xs sm:text-sm">${formattedText || placeholder}</span>
        </div>

        <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0">
          <i data-lucide="chevron-down" class="w-3 h-3"></i>
        </div>
      </button>

      <!-- Hidden Input for Form & State Compatibility (Format standard: YYYY-MM-DD) -->
      <input type="hidden" id="${id}" value="${initialValue}">

      <!-- Popover Floating Calendar (Shadcn Calendar Popover) -->
      <div 
        id="${id}-popover" 
        class="datepicker-popover hidden absolute z-50 mt-1.5 w-64 sm:w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 animate-in fade-in zoom-in-95 duration-150 select-none ${alignClass}"
        style="min-width: 256px;"
      >
        <div class="datepicker-calendar-content space-y-2.5"></div>
      </div>
    </div>
  `;
}

/**
 * Inisialisasi event listener dan interaktivitas Popover Calendar
 */
export function initDatePicker(container, {
  id = 'datepicker-input',
  value = '',
  onChange = () => {}
}) {
  const wrapper = container.querySelector(`[data-datepicker-id="${id}"]`);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(`#${id}-trigger`);
  const popover = wrapper.querySelector(`#${id}-popover`);
  const hiddenInput = wrapper.querySelector(`#${id}`);
  const labelEl = trigger.querySelector('.datepicker-label');
  const calendarContent = popover.querySelector('.datepicker-calendar-content');

  let selectedDateStr = hiddenInput?.value || value || toISODateString(new Date());

  // View state untuk navigasi bulan & tahun
  let viewYear, viewMonth;
  try {
    const parts = selectedDateStr.split('-');
    viewYear = parseInt(parts[0], 10) || new Date().getFullYear();
    viewMonth = (parseInt(parts[1], 10) - 1) || new Date().getMonth();
  } catch {
    viewYear = new Date().getFullYear();
    viewMonth = new Date().getMonth();
  }

  function openPopover() {
    // Tutup datepicker atau combobox lain yang sedang terbuka
    document.querySelectorAll('.datepicker-popover, .combobox-popover').forEach(p => {
      if (p !== popover) p.classList.add('hidden');
    });
    
    popover.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    renderCalendar();
  }

  function closePopover() {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function selectDate(newIsoStr) {
    selectedDateStr = newIsoStr;
    if (hiddenInput) {
      hiddenInput.value = newIsoStr;
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (labelEl) {
      labelEl.textContent = formatIndonesianDate(newIsoStr);
    }
    closePopover();
    onChange(newIsoStr);
  }

  function renderCalendar() {
    const todayIso = toISODateString(new Date());

    // Hari pertama bulan
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    // Total hari dalam bulan ini
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Total hari dalam bulan sebelumnya
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Hitung tanggal-tanggal untuk grid kalender
    const calendarDays = [];

    // Hari-hari bulan sebelumnya
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({ day: d, iso, isCurrentMonth: false });
    }

    // Hari-hari bulan aktif
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({ day: d, iso, isCurrentMonth: true });
    }

    // Hari-hari bulan berikutnya untuk melengkapi kelipatan 7
    const remaining = (7 - (calendarDays.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const iso = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({ day: d, iso, isCurrentMonth: false });
    }

    calendarContent.innerHTML = `
      <!-- Calendar Header: Month/Year and Nav Arrows -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <button type="button" class="btn-cal-prev p-1 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-800 transition">
          <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
        </button>

        <div class="flex items-center gap-1 text-xs font-black text-slate-800 dark:text-white">
          <span>${MONTH_NAMES_ID[viewMonth]}</span>
          <span>${viewYear}</span>
        </div>

        <button type="button" class="btn-cal-next p-1 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-800 transition">
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <!-- Day Names Header -->
      <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        ${SHORT_DAY_NAMES_ID.map(d => `<span>${d}</span>`).join('')}
      </div>

      <!-- Days Grid -->
      <div class="grid grid-cols-7 gap-1 text-xs">
        ${calendarDays.map(item => {
          const isSelected = item.iso === selectedDateStr;
          const isToday = item.iso === todayIso;

          let btnClass = 'w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-lg flex items-center justify-center transition text-xs font-bold ';

          if (isSelected) {
            btnClass += 'bg-emerald-600 text-white shadow-xs font-black';
          } else if (isToday) {
            btnClass += 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-extrabold hover:bg-emerald-100';
          } else if (item.isCurrentMonth) {
            btnClass += 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';
          } else {
            btnClass += 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40';
          }

          return `
            <button 
              type="button" 
              class="btn-cal-day ${btnClass}" 
              data-iso="${item.iso}"
            >
              ${item.day}
            </button>
          `;
        }).join('')}
      </div>

      <!-- Quick Shortcuts Footer -->
      <div class="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button 
          type="button" 
          class="btn-cal-today text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200 transition"
        >
          Hari Ini
        </button>

        <button 
          type="button" 
          class="btn-cal-close text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition"
        >
          Tutup
        </button>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Bind Navigation Arrows
    calendarContent.querySelector('.btn-cal-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (viewMonth === 0) {
        viewMonth = 11;
        viewYear--;
      } else {
        viewMonth--;
      }
      renderCalendar();
    });

    calendarContent.querySelector('.btn-cal-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (viewMonth === 11) {
        viewMonth = 0;
        viewYear++;
      } else {
        viewMonth++;
      }
      renderCalendar();
    });

    // Bind Day clicks
    calendarContent.querySelectorAll('.btn-cal-day').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const iso = btn.getAttribute('data-iso');
        if (iso) selectDate(iso);
      });
    });

    // Bind Quick Shortcuts
    calendarContent.querySelector('.btn-cal-today')?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectDate(toISODateString(new Date()));
    });

    calendarContent.querySelector('.btn-cal-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closePopover();
    });
  }

  // Clean up any existing listeners on this wrapper to prevent double-binding
  if (wrapper.__datePickerCleanup) {
    wrapper.__datePickerCleanup();
  }

  // Toggle Popover Trigger
  trigger.onclick = (e) => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) {
      openPopover();
    } else {
      closePopover();
    }
  };

  // Click outside to close
  const handleOutsideClick = (e) => {
    if (!wrapper.contains(e.target)) {
      closePopover();
    }
  };
  document.addEventListener('click', handleOutsideClick);

  // Store cleanup function
  wrapper.__datePickerCleanup = () => {
    document.removeEventListener('click', handleOutsideClick);
    trigger.onclick = null;
  };

  // Escape key to close
  wrapper.onkeydown = (e) => {
    if (e.key === 'Escape') {
      closePopover();
      trigger.focus();
    }
  };
}
