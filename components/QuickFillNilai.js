// components/QuickFillNilai.js - Floating Quick-Fill Nilai Component
// Reusable singleton component for fast student grade assignment with auto-advance & auto-flip

const DEFAULT_GRADES = [70, 75, 80, 85, 90, 95, 100];
const MENU_ID = 'floating-quick-fill-nilai';

let activeController = null;

function getOrCreateFloatingMenu(values = DEFAULT_GRADES) {
  let menu = document.getElementById(MENU_ID);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'floating-quickfill-popover fixed z-[9999] hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700 shadow-2xl rounded-2xl p-1.5 flex items-center gap-1 transition-all duration-150 select-none';
    menu.setAttribute('role', 'toolbar');
    menu.setAttribute('aria-label', 'Pilihan Cepat Nilai');
    document.body.appendChild(menu);
  }

  // Update chips if values changed
  menu.innerHTML = values.map(val => {
    const isTopScore = val === 100;
    return `
      <button 
        type="button" 
        data-grade="${val}" 
        class="quick-fill-chip min-w-[34px] h-[34px] px-2 rounded-xl text-xs font-black transition flex items-center justify-center cursor-pointer shadow-xs active:scale-95 touch-manipulation ${isTopScore ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600 dark:hover:bg-emerald-600 hover:text-white dark:hover:text-white border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 dark:hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-200'}"
      >
        ${val}
      </button>
    `;
  }).join('');

  return menu;
}

/**
 * Inisialisasi Floating Quick-Fill Nilai pada kontainer
 * @param {Object} options
 * @param {HTMLElement} options.container - Root kontainer tabel / form
 * @param {string} options.inputSelector - CSS Selector untuk target input nilai
 * @param {Array<number>} [options.values] - Daftar nilai cepat (default: [70, 75, 80, 85, 90, 95, 100])
 * @param {Function} [options.onSelect] - Callback setelah nilai dipilih (inputEl, val)
 * @returns {Object} Controller { destroy, hide, show, position }
 */
export function initQuickFillNilai({
  container,
  inputSelector = '.input-nilai-item',
  values = DEFAULT_GRADES,
  onSelect = null
} = {}) {
  if (!container) return null;

  // Cleanup controller sebelumnya jika ada di container yang sama
  if (activeController && typeof activeController.destroy === 'function') {
    activeController.destroy();
  }

  const menuEl = getOrCreateFloatingMenu(values);
  let activeInput = null;
  let isProgrammaticFocus = false;
  let isVisible = false;

  function positionMenu(inputEl) {
    if (!inputEl || !menuEl) return;
    const inputRect = inputEl.getBoundingClientRect();
    
    // Pastikan menu sementara tampil agar dimensi terukur
    menuEl.style.visibility = 'hidden';
    menuEl.classList.remove('hidden');

    const menuRect = menuEl.getBoundingClientRect();
    const menuWidth = menuRect.width || 310;
    const menuHeight = menuRect.height || 46;
    const margin = 6;

    // Sumbu X: Center align relative to input, clamp in viewport
    let left = inputRect.left + (inputRect.width / 2) - (menuWidth / 2);
    const maxLeft = window.innerWidth - menuWidth - 8;
    left = Math.max(8, Math.min(left, maxLeft));

    // Sumbu Y: Deteksi ruang viewport (Auto-Flip)
    const spaceBelow = window.innerHeight - inputRect.bottom;
    const spaceAbove = inputRect.top;
    const neededHeight = menuHeight + margin + 8;

    let top;
    if (spaceBelow < neededHeight && spaceAbove > spaceBelow) {
      top = inputRect.top - menuHeight - margin;
      menuEl.setAttribute('data-placement', 'top');
    } else {
      top = inputRect.bottom + margin;
      menuEl.setAttribute('data-placement', 'bottom');
    }

    menuEl.style.left = `${Math.round(left)}px`;
    menuEl.style.top = `${Math.round(top)}px`;
    menuEl.style.visibility = 'visible';
  }

  function show(inputEl) {
    if (!inputEl || inputEl.disabled) return;
    if (inputEl.closest('.hidden')) return;

    activeInput = inputEl;
    positionMenu(inputEl);
    menuEl.classList.remove('hidden');
    isVisible = true;
  }

  function hide() {
    if (!menuEl) return;
    menuEl.classList.add('hidden');
    menuEl.style.visibility = 'hidden';
    isVisible = false;
    activeInput = null;
  }

  function handleGradeSelect(val) {
    if (!activeInput) return;

    const targetInput = activeInput;
    targetInput.value = val;

    // Dispatch native events for live recalculations / validation
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));

    if (typeof onSelect === 'function') {
      try {
        onSelect(targetInput, val);
      } catch (e) {
        console.warn('QuickFillNilai onSelect error:', e);
      }
    }

    // Traversal: Cari input terlihat berikutnya di live DOM order
    const visibleInputs = Array.from(container.querySelectorAll(inputSelector)).filter(inp => {
      if (inp.disabled) return false;
      if (inp.offsetParent === null) return false;
      if (inp.closest('.hidden')) return false;
      return true;
    });

    const currentIndex = visibleInputs.indexOf(targetInput);
    const nextInput = currentIndex >= 0 ? visibleInputs[currentIndex + 1] : null;

    // Tutup floating menu
    hide();

    if (nextInput) {
      isProgrammaticFocus = true;
      nextInput.focus();
      if (typeof nextInput.select === 'function') {
        nextInput.select();
      }
      setTimeout(() => {
        isProgrammaticFocus = false;
      }, 150);
    } else {
      targetInput.blur();
      isProgrammaticFocus = false;
    }
  }

  // Delegated click pada chip floating menu
  function onMenuClick(e) {
    const chip = e.target.closest('.quick-fill-chip');
    if (!chip) return;
    e.preventDefault();
    e.stopPropagation();
    const gradeVal = chip.getAttribute('data-grade');
    if (gradeVal !== null) {
      handleGradeSelect(Number(gradeVal));
    }
  }

  // Input event handlers
  function onInputFocus(e) {
    const inp = e.target.closest(inputSelector);
    if (!inp || inp.disabled) return;
    if (isProgrammaticFocus) return;
    show(inp);
  }

  function onInputPointerDown(e) {
    const inp = e.target.closest(inputSelector);
    if (!inp || inp.disabled) return;
    isProgrammaticFocus = false;
    show(inp);
  }

  function onInputKeydown(e) {
    const inp = e.target.closest(inputSelector);
    if (!inp) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    } else if (e.key === 'Tab') {
      hide();
    } else if (e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Control') {
      // Guru mulai mengetik manual angka
      hide();
    }
  }

  function onInputManualInput(e) {
    const inp = e.target.closest(inputSelector);
    if (inp && isVisible) {
      hide();
    }
  }

  // Outside click / blur handler
  function onDocumentPointerDown(e) {
    if (!isVisible) return;
    if (menuEl.contains(e.target)) return;
    if (activeInput && (activeInput === e.target || activeInput.contains(e.target))) return;
    hide();
  }

  // Scroll handler: Tutup menu saat scroll terdeteksi di window atau kontainer tabel
  function onScrollCapture(e) {
    if (!isVisible) return;
    if (e.target !== menuEl && !menuEl.contains(e.target)) {
      hide();
    }
  }

  // Resize handler
  function onWindowResize() {
    if (isVisible && activeInput) {
      positionMenu(activeInput);
    }
  }

  // Bind event listeners
  container.addEventListener('focusin', onInputFocus);
  container.addEventListener('pointerdown', onInputPointerDown);
  container.addEventListener('keydown', onInputKeydown);
  container.addEventListener('input', onInputManualInput);

  menuEl.addEventListener('click', onMenuClick);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('scroll', onScrollCapture, { capture: true, passive: true });
  window.addEventListener('resize', onWindowResize);

  const controller = {
    show,
    hide,
    position: () => activeInput && positionMenu(activeInput),
    destroy: () => {
      hide();
      container.removeEventListener('focusin', onInputFocus);
      container.removeEventListener('pointerdown', onInputPointerDown);
      container.removeEventListener('keydown', onInputKeydown);
      container.removeEventListener('input', onInputManualInput);
      menuEl.removeEventListener('click', onMenuClick);
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      window.removeEventListener('scroll', onScrollCapture, { capture: true });
      window.removeEventListener('resize', onWindowResize);
      if (activeController === controller) {
        activeController = null;
      }
    }
  };

  activeController = controller;
  return controller;
}
