// components/Topbar.js - Minimalist Top Header (56px - 64px)
import { renderAcademicYearComboboxHTML, initAcademicYearCombobox } from './AcademicYearCombobox.js';

export function renderTopbar(container, state, onToggleSidebar, onOpenModal, onToggleTheme, onSelectAcademicYear) {
  const isSupabase = state.isSupabaseConnected;
  const isDarkMode = state.isDarkMode || false;
  const activeTab = state.activeTab;
  const academicYears = state.academicYears && state.academicYears.length > 0 ? state.academicYears : ['2026/2027'];
  const selectedYear = state.selectedAcademicYear || academicYears[0];

  // Generate dynamic breadcrumb and page title
  let breadcrumbCategory = 'Pembelajaran';
  let pageTitle = 'Absen Siswa';
  let pageIcon = 'user-check';

  switch (activeTab) {
    case 'absen':
      breadcrumbCategory = 'Presensi Harian';
      pageTitle = 'Absen Siswa Per Sesi';
      pageIcon = 'user-check';
      break;
    case 'jurnal':
      breadcrumbCategory = 'Administrasi Mengajar';
      pageTitle = 'Jurnal Mengajar Guru';
      pageIcon = 'book-open';
      break;
    case 'tugas':
      breadcrumbCategory = 'Catatan & Penilaian';
      pageTitle = state.tugasSubTab === 'nilai' ? 'Penilaian Nilai Tugas Siswa' : 'Catatan Ceklis Siswa';
      pageIcon = state.tugasSubTab === 'nilai' ? 'award' : 'clipboard-check';
      break;
    case 'pemeriksaan-tugas':
      breadcrumbCategory = 'Evaluasi & Pemeriksaan';
      pageTitle = 'Pemeriksaan Catatan & Tugas';
      pageIcon = 'file-check-2';
      break;
    case 'kegiatan':
      breadcrumbCategory = 'Kesiswaan';
      pageTitle = 'Catatan Kegiatan & Agenda Siswa';
      pageIcon = 'sparkles';
      break;
    case 'riwayat':
      breadcrumbCategory = 'Riwayat';
      pageTitle = 'Riwayat Sesi Mengajar';
      pageIcon = 'history';
      break;
    case 'rekap':
      breadcrumbCategory = 'Laporan';
      pageTitle = 'Rekapitulasi Presensi & Ekspor';
      pageIcon = 'bar-chart-3';
      break;
    case 'rekap-siswa':
      breadcrumbCategory = 'Portofolio';
      pageTitle = 'Rekap Individual Siswa & Rapor';
      pageIcon = 'graduation-cap';
      break;
  }

  container.innerHTML = `
    <div class="h-16 px-3 sm:px-5 flex items-center justify-between gap-3 sm:gap-4 w-full">
      
      <!-- Left Side: Toggle Button & Dynamic Breadcrumb -->
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <!-- Hamburger / Sidebar Toggle Button -->
        <button id="btn-toggle-sidebar" class="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition border border-slate-200 shadow-xs flex-shrink-0" title="Buka / Tutup Sidebar">
          <i data-lucide="menu" class="w-5 h-5"></i>
        </button>

        <!-- Breadcrumb & Active Page Title (Never Squished) -->
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
            <span>SIA-Jurnal</span>
            <span>/</span>
            <span class="text-emerald-600 font-extrabold">${breadcrumbCategory}</span>
          </div>
          <div class="flex items-center gap-2">
            <i data-lucide="${pageIcon}" class="w-4 h-4 text-emerald-600 flex-shrink-0"></i>
            <h2 class="text-sm sm:text-base font-extrabold text-slate-900 truncate leading-tight">
              ${pageTitle}
            </h2>
          </div>
        </div>
      </div>

      <!-- Right Side: Academic Year Selector, Status Badge, & Quick Actions -->
      <div class="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        
        <!-- Global Dropdown Filter Tahun Ajaran (Shadcn Combobox Style) -->
        <div class="w-36 sm:w-44">
          ${renderAcademicYearComboboxHTML({
            id: 'topbar-select-academic-year',
            years: academicYears,
            selectedYear: selectedYear,
            allowCustom: false,
            size: 'sm'
          })}
        </div>

        <!-- Connection Status Pill -->
        <button id="topbar-status-pill" type="button" class="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${isSupabase ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'} cursor-pointer" title="${isSupabase ? 'Database Supabase Cloud Terhubung (Klik untuk kelola)' : 'Mode Penyimpanan Lokal (Offline) - Klik untuk Hubungkan Supabase Cloud'}">
          <span class="w-2 h-2 rounded-full ${isSupabase ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
          <span class="hidden lg:inline">${isSupabase ? 'Supabase Terhubung' : 'Mode Offline (Lokal)'}</span>
          <span class="lg:hidden text-[10px]">${isSupabase ? 'Cloud' : 'Offline'}</span>
        </button>

        <!-- Dark Mode Toggle Button -->
        <button id="topbar-btn-theme" class="p-2 rounded-xl text-slate-600 hover:text-amber-500 hover:bg-slate-100 border border-slate-200 shadow-2xs transition" title="${isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}">
          <i data-lucide="${isDarkMode ? 'sun' : 'moon'}" class="w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-slate-600'}"></i>
        </button>

        <!-- Quick Action: Kelola Mata Pelajaran -->
        <button id="topbar-btn-mapel" class="hidden sm:flex p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs items-center gap-1.5 transition transform active:scale-95" title="Kelola Master Mata Pelajaran">
          <i data-lucide="book-marked" class="w-3.5 h-3.5 text-emerald-600"></i>
          <span class="hidden lg:inline">Mata Pelajaran</span>
        </button>

        <!-- Quick Action: Kelola Kelas & Siswa -->
        <button id="topbar-btn-siswa" class="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5 transition transform active:scale-95" title="Kelola Data Kelas & Siswa">
          <i data-lucide="school" class="w-3.5 h-3.5"></i>
          <span class="hidden md:inline">Kelas & Siswa</span>
        </button>

        <!-- Quick Action: Settings -->
        <button id="topbar-btn-settings" class="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition shadow-2xs" title="Pengaturan Database & Profil Guru">
          <i data-lucide="settings" class="w-4 h-4"></i>
        </button>

      </div>

    </div>
  `;

  // Bind Events
  container.querySelector('#btn-toggle-sidebar')?.addEventListener('click', onToggleSidebar);
  container.querySelector('#topbar-status-pill')?.addEventListener('click', () => onOpenModal('settings'));
  container.querySelector('#topbar-btn-theme')?.addEventListener('click', onToggleTheme);
  container.querySelector('#topbar-btn-mapel')?.addEventListener('click', () => onOpenModal('mapel'));
  container.querySelector('#topbar-btn-siswa')?.addEventListener('click', () => onOpenModal('siswa'));
  container.querySelector('#topbar-btn-settings')?.addEventListener('click', () => onOpenModal('settings'));
  
  // Init Academic Year Combobox
  initAcademicYearCombobox(container, {
    id: 'topbar-select-academic-year',
    onSelect: (newYear) => {
      if (onSelectAcademicYear) onSelectAcademicYear(newYear);
    }
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
