// components/Sidebar.js - Left Navigation Sidebar (Collapsible & Responsive)
import { db } from '../supabase-client.js';

// State global untuk mengingat status expand/collapse folder grup
const sidebarGroupState = {
  catatan: true,
  pr: true
};

export function renderSidebar(container, state, onNavigate, onOpenModal, onToggleCollapse, onCloseMobile, onLogout) {
  const isCollapsed = state.isSidebarCollapsed || false;
  const isMobileOpen = state.isMobileSidebarOpen || false;
  const isSupabase = state.isSupabaseConnected;
  const activeTab = state.activeTab;
  const todayKegiatanCount = state.todayKegiatanCount || 0;
  const todayTugasCount = state.todayTugasCount || 0;
  const pendingPRCount = state.pendingPRCount || 0;
  const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
  const schoolName = school.nama_sekolah || 'SMKN 1 Bantaeng';
  const isAdmin = state.currentUser?.role === 'admin';

  // Auto-expand group jika item child-nya sedang aktif
  if (activeTab === 'tugas' || activeTab === 'pemeriksaan-tugas' || activeTab === 'kelompok' || activeTab === 'tugas-kelompok') {
    sidebarGroupState.catatan = true;
  }
  if (activeTab === 'pr-buat' || activeTab === 'pr-periksa') {
    sidebarGroupState.pr = true;
  }

  const isCatatanOpen = sidebarGroupState.catatan;
  const isPROpen = sidebarGroupState.pr;

  // Update backdrop visibility on mobile
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) {
    if (isMobileOpen) {
      backdrop.classList.remove('hidden');
      backdrop.onclick = onCloseMobile;
    } else {
      backdrop.classList.add('hidden');
    }
  }

  container.className = `
    fixed md:static inset-y-0 left-0 z-50 flex flex-col
    bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200
    border-r border-slate-800 shadow-xl md:shadow-none
    transition-all duration-300 ease-in-out
    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    ${isCollapsed ? 'md:w-20' : 'md:w-64'}
    w-72
  `;

  container.innerHTML = `
    <!-- Top Brand & Header Section -->
    <div class="h-16 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'} border-b border-slate-800/80 flex-shrink-0">
      ${isCollapsed ? `
        <button id="btn-expand-sidebar" class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/40 hover:scale-105 transition transform overflow-hidden" title="SIA-Jurnal ${schoolName} (Klik untuk lebarkan sidebar)">
          ${school.logo_url ? `<img src="${school.logo_url}" class="w-6 h-6 object-contain" alt="Logo">` : '<i data-lucide="clipboard-check" class="w-5 h-5"></i>'}
        </button>
      ` : `
        <div class="flex items-center gap-3 cursor-pointer min-w-0" id="sidebar-brand">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/40 flex-shrink-0 overflow-hidden">
            ${school.logo_url ? `<img src="${school.logo_url}" class="w-7 h-7 object-contain" alt="Logo">` : '<i data-lucide="clipboard-check" class="w-5 h-5"></i>'}
          </div>
          <div class="min-w-0 transition-opacity duration-200">
            <h1 class="font-extrabold text-base tracking-tight text-white leading-none truncate">SIA-Jurnal</h1>
            <p class="text-[11px] text-emerald-400 font-medium tracking-wide mt-0.5 truncate">${schoolName}</p>
          </div>
        </div>

        <!-- Close button on mobile -->
        <button id="btn-close-sidebar-mobile" class="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>

        <!-- Desktop Collapse Toggle Icon -->
        <button id="btn-collapse-sidebar" class="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Ciutkan Sidebar">
          <i data-lucide="panel-left-close" class="w-4 h-4"></i>
        </button>
      `}
    </div>

    <!-- Main Navigation Menu (Vertical List) -->
    <div class="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      
      <!-- Group 1: Menu Utama Pembelajaran -->
      <div class="space-y-1">
        ${!isCollapsed ? `
          <p class="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Menu Utama</p>
        ` : `
          <div class="h-1 border-t border-slate-800 my-2"></div>
        `}

        <!-- 1. Absen Siswa -->
        <button data-tab="absen" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'absen' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Absen Siswa">
          ${activeTab === 'absen' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="user-check" class="w-5 h-5 ${activeTab === 'absen' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? '<span class="flex-1 text-left truncate">Absen Siswa</span>' : ''}
        </button>

        <!-- 2. Jurnal Mengajar -->
        <button data-tab="jurnal" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'jurnal' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Jurnal Mengajar">
          ${activeTab === 'jurnal' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="book-open" class="w-5 h-5 ${activeTab === 'jurnal' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? '<span class="flex-1 text-left truncate">Jurnal Mengajar</span>' : ''}
        </button>

        <!-- 3. Collapsible Group: Catatan & Tugas -->
        <div class="sidebar-group pt-0.5">
          ${!isCollapsed ? `
            <button class="btn-toggle-group w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${activeTab === 'tugas' || activeTab === 'pemeriksaan-tugas' || activeTab === 'kelompok' || activeTab === 'tugas-kelompok' ? 'text-sky-400' : 'text-slate-300 hover:text-white'} hover:bg-slate-800/60 transition group" data-group="catatan">
              <div class="flex items-center gap-2.5 min-w-0">
                <i data-lucide="clipboard-list" class="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform"></i>
                <span class="truncate">Catatan & Tugas</span>
              </div>
              <div class="flex items-center gap-1.5">
                ${todayTugasCount > 0 ? `
                  <span class="bg-sky-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    ${todayTugasCount}
                  </span>
                ` : ''}
                <i data-lucide="${isCatatanOpen ? 'chevron-down' : 'chevron-right'}" class="w-3.5 h-3.5 text-slate-400"></i>
              </div>
            </button>

            <div class="pl-3.5 pr-1 pt-1 space-y-1 ${isCatatanOpen ? '' : 'hidden'}">
              <!-- Sub 1: Catatan & Tugas -->
              <button data-tab="tugas" class="sidebar-nav-item w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition relative ${activeTab === 'tugas' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}">
                <div class="flex items-center gap-2 min-w-0">
                  <i data-lucide="clipboard-check" class="w-3.5 h-3.5 ${activeTab === 'tugas' ? 'text-white' : 'text-slate-400'}"></i>
                  <span class="truncate">Catatan & Tugas</span>
                </div>
                ${todayTugasCount > 0 ? `
                  <span class="bg-sky-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    ${todayTugasCount}
                  </span>
                ` : ''}
              </button>

              <!-- Sub 2: Pemeriksaan Catatan & Tugas -->
              <button data-tab="pemeriksaan-tugas" class="sidebar-nav-item w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition relative ${activeTab === 'pemeriksaan-tugas' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}">
                <i data-lucide="file-check-2" class="w-3.5 h-3.5 ${activeTab === 'pemeriksaan-tugas' ? 'text-white' : 'text-slate-400'}"></i>
                <span class="truncate">Pemeriksaan Catatan</span>
              </button>

              <!-- Sub 3: Data Kelompok (Master Data) -->
              <button data-tab="kelompok" class="sidebar-nav-item w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition relative ${activeTab === 'kelompok' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}">
                <i data-lucide="users" class="w-3.5 h-3.5 ${activeTab === 'kelompok' ? 'text-white' : 'text-slate-400'}"></i>
                <span class="truncate">Data Kelompok</span>
              </button>

              <!-- Sub 4: Tugas Kelompok (Penilaian Terpadu) -->
              <button data-tab="tugas-kelompok" class="sidebar-nav-item w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition relative ${activeTab === 'tugas-kelompok' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}">
                <i data-lucide="award" class="w-3.5 h-3.5 ${activeTab === 'tugas-kelompok' ? 'text-white' : 'text-slate-400'}"></i>
                <span class="truncate">Tugas Kelompok</span>
              </button>
            </div>
          ` : `
            <button data-tab="tugas" class="sidebar-nav-item w-full flex items-center justify-center p-2.5 rounded-xl transition ${activeTab === 'tugas' || activeTab === 'pemeriksaan-tugas' || activeTab === 'kelompok' || activeTab === 'tugas-kelompok' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}" title="Catatan & Tugas">
              <i data-lucide="clipboard-list" class="w-5 h-5"></i>
            </button>
          `}
        </div>

        <!-- 4. Collapsible Group: Pekerjaan Rumah (PR, BARU) -->
        <div class="sidebar-group pt-0.5">
          ${!isCollapsed ? `
            <button class="btn-toggle-group w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${activeTab === 'pr-buat' || activeTab === 'pr-periksa' ? 'text-purple-400' : 'text-slate-300 hover:text-white'} hover:bg-slate-800/60 transition group" data-group="pr">
              <div class="flex items-center gap-2.5 min-w-0">
                <i data-lucide="home" class="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform"></i>
                <span class="truncate">Pekerjaan Rumah (PR)</span>
              </div>
              <div class="flex items-center gap-1.5">
                ${pendingPRCount > 0 ? `
                  <span class="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full ring-1 ring-amber-300" title="${pendingPRCount} PR Menunggu Diperiksa">
                    ${pendingPRCount}
                  </span>
                ` : ''}
                <i data-lucide="${isPROpen ? 'chevron-down' : 'chevron-right'}" class="w-3.5 h-3.5 text-slate-400"></i>
              </div>
            </button>

            <div class="pl-3.5 pr-1 pt-1 space-y-1 ${isPROpen ? '' : 'hidden'}">
              <!-- Sub 1: Buat PR -->
              <button data-tab="pr-buat" class="sidebar-nav-item w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition relative ${activeTab === 'pr-buat' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}">
                <i data-lucide="plus-circle" class="w-3.5 h-3.5 ${activeTab === 'pr-buat' ? 'text-white' : 'text-slate-400'}"></i>
                <span class="truncate">Buat PR</span>
              </button>

              <!-- Sub 2: Pemeriksaan PR -->
              <button data-tab="pr-periksa" class="sidebar-nav-item w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition relative ${activeTab === 'pr-periksa' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}">
                <div class="flex items-center gap-2 min-w-0">
                  <i data-lucide="clipboard-check" class="w-3.5 h-3.5 ${activeTab === 'pr-periksa' ? 'text-white' : 'text-slate-400'}"></i>
                  <span class="truncate">Pemeriksaan PR</span>
                </div>
                ${pendingPRCount > 0 ? `
                  <span class="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    ${pendingPRCount}
                  </span>
                ` : ''}
              </button>
            </div>
          ` : `
            <button data-tab="pr-periksa" class="sidebar-nav-item w-full flex items-center justify-center p-2.5 rounded-xl transition relative ${activeTab === 'pr-buat' || activeTab === 'pr-periksa' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}" title="Pekerjaan Rumah (PR)">
              <i data-lucide="home" class="w-5 h-5"></i>
              ${pendingPRCount > 0 ? `
                <span class="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900"></span>
              ` : ''}
            </button>
          `}
        </div>

        <!-- 5. Kegiatan Siswa -->
        <button data-tab="kegiatan" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'kegiatan' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Kegiatan Siswa">
          ${activeTab === 'kegiatan' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="sparkles" class="w-5 h-5 ${activeTab === 'kegiatan' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? `
            <span class="flex-1 text-left truncate">Kegiatan Siswa</span>
            ${todayKegiatanCount > 0 ? `
              <span class="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0">
                ${todayKegiatanCount}
              </span>
            ` : ''}
          ` : todayKegiatanCount > 0 ? `
            <span class="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900"></span>
          ` : ''}
        </button>

        <!-- 6. Riwayat Sesi -->
        <button data-tab="riwayat" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'riwayat' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Riwayat Sesi">
          ${activeTab === 'riwayat' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="history" class="w-5 h-5 ${activeTab === 'riwayat' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? '<span class="flex-1 text-left truncate">Riwayat Sesi</span>' : ''}
        </button>

        <!-- 7. Rekap Kehadiran -->
        <button data-tab="rekap" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'rekap' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Rekap Kehadiran">
          ${activeTab === 'rekap' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="bar-chart-3" class="w-5 h-5 ${activeTab === 'rekap' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? '<span class="flex-1 text-left truncate">Rekap Kehadiran</span>' : ''}
        </button>

        <!-- 8. Rekap Per Siswa -->
        <button data-tab="rekap-siswa" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'rekap-siswa' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Rekap Per Siswa">
          ${activeTab === 'rekap-siswa' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="graduation-cap" class="w-5 h-5 ${activeTab === 'rekap-siswa' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? '<span class="flex-1 text-left truncate">Rekap Per Siswa</span>' : ''}
        </button>

        <!-- 9. Ledger & Nilai Akhir -->
        <button data-tab="ledger" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'ledger' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Ledger & Nilai Akhir">
          ${activeTab === 'ledger' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="calculator" class="w-5 h-5 ${activeTab === 'ledger' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? '<span class="flex-1 text-left truncate">Ledger Nilai Akhir</span>' : ''}
        </button>

        <!-- 10. Jadwal Mengajar Guru -->
        <button data-tab="jadwal" class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${activeTab === 'jadwal' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'}" title="Jadwal Mengajar">
          ${activeTab === 'jadwal' ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-300 rounded-r-full"></span>' : ''}
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="calendar-clock" class="w-5 h-5 ${activeTab === 'jadwal' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}"></i>
          </div>
          ${!isCollapsed ? '<span class="flex-1 text-left truncate">Jadwal Mengajar</span>' : ''}
        </button>
      </div>

      <!-- Group 2: Manajemen & Pengaturan Data -->
      <div class="space-y-1">
        ${!isCollapsed ? `
          <p class="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Kelola Data</p>
        ` : `
          <div class="h-1 border-t border-slate-800 my-2"></div>
        `}

        <button id="sidebar-btn-siswa" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition group" title="Data Kelas & Siswa">
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="school" class="w-5 h-5 text-slate-400 group-hover:text-emerald-400"></i>
          </div>
          ${!isCollapsed ? `
            <span class="flex-1 text-left truncate">Data Kelas & Siswa</span>
          ` : ''}
        </button>

        ${isAdmin ? `
        <button id="sidebar-btn-kenaikan-kelas" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition group" title="Kenaikan Kelas & Pemindahan Rombel">
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="trending-up" class="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform"></i>
          </div>
          ${!isCollapsed ? `
            <span class="flex-1 text-left truncate">Kenaikan Kelas</span>
            <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0.5 rounded-md">Naik</span>
          ` : ''}
        </button>
        ` : ''}

        <button id="sidebar-btn-settings" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition group" title="Pengaturan Database">
          <div class="flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'mx-auto' : ''}">
            <i data-lucide="settings" class="w-5 h-5 text-slate-400 group-hover:text-emerald-400"></i>
          </div>
          ${!isCollapsed ? `
            <span class="flex-1 text-left truncate">Pengaturan DB</span>
          ` : ''}
        </button>
      </div>

    </div>

    <!-- Bottom Teacher Profile Card & Database Pill -->
    <div class="p-3 border-t border-slate-800/80 flex-shrink-0 bg-slate-950/60">
      ${!isCollapsed ? `
        <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-emerald-500/40 flex-shrink-0">
              ${(state.currentUser?.name || 'Ammar').charAt(0)}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1">
                <p class="text-xs font-bold text-white truncate">${state.currentUser?.name || 'Ammar'}</p>
                <span class="w-2 h-2 rounded-full ${isSupabase ? 'bg-emerald-400 ring-2 ring-emerald-950' : 'bg-amber-400 ring-2 ring-amber-950'}" title="${isSupabase ? 'Supabase Terhubung' : 'Offline Lokal'}"></span>
              </div>
              <p class="text-[10px] text-slate-400 truncate">${state.currentUser?.email || 'Guru Mapel'}</p>
              <span class="inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md mt-0.5 ${isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">${isAdmin ? 'Administrator' : 'Guru'}</span>
            </div>
          </div>

          <button id="btn-sidebar-logout" class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition" title="Keluar (Logout)">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </div>
      ` : `
        <div class="flex flex-col items-center gap-2" title="${state.currentUser?.name || 'Ammar'}">
          <div class="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center ring-2 ring-emerald-500/30">
            ${(state.currentUser?.name || 'Ammar').charAt(0)}
          </div>
          <button id="btn-sidebar-logout" class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition" title="Keluar (Logout)">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `}
    </div>
  `;

  // Bind Events: Navigation Item Clicks
  container.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        onNavigate(tab);
        if (window.innerWidth < 768 && onCloseMobile) {
          onCloseMobile();
        }
      }
    });
  });

  // Bind Events: Brand Click
  container.querySelector('#sidebar-brand')?.addEventListener('click', () => {
    onNavigate('absen');
    if (window.innerWidth < 768 && onCloseMobile) {
      onCloseMobile();
    }
  });

  // Bind Events: Modal Buttons
  container.querySelector('#sidebar-btn-siswa')?.addEventListener('click', () => {
    onOpenModal('siswa');
    if (window.innerWidth < 768 && onCloseMobile) {
      onCloseMobile();
    }
  });

  container.querySelector('#sidebar-btn-kenaikan-kelas')?.addEventListener('click', () => {
    onOpenModal('kenaikan-kelas');
    if (window.innerWidth < 768 && onCloseMobile) {
      onCloseMobile();
    }
  });

  container.querySelector('#sidebar-btn-settings')?.addEventListener('click', () => {
    onOpenModal('settings');
    if (window.innerWidth < 768 && onCloseMobile) {
      onCloseMobile();
    }
  });

  // Bind Events: Toggle Group Collapsible
  container.querySelectorAll('.btn-toggle-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const grp = btn.getAttribute('data-group');
      if (grp) {
        sidebarGroupState[grp] = !sidebarGroupState[grp];
        renderSidebar(container, state, onNavigate, onOpenModal, onToggleCollapse, onCloseMobile, onLogout);
      }
    });
  });

  // Bind Events: Desktop Collapse Toggle
  container.querySelector('#btn-collapse-sidebar')?.addEventListener('click', onToggleCollapse);
  container.querySelector('#btn-expand-sidebar')?.addEventListener('click', onToggleCollapse);

  // Bind Events: Mobile Close
  container.querySelector('#btn-close-sidebar-mobile')?.addEventListener('click', onCloseMobile);

  // Bind Events: Logout
  container.querySelectorAll('#btn-sidebar-logout').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onLogout) onLogout();
    });
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
