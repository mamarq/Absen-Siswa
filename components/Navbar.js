// components/Navbar.js - Header Navigasi & Status Bar
import { db } from '../supabase-client.js';

export function renderNavbar(container, state, onNavigate, onOpenModal) {
  const isSupabase = state.isSupabaseConnected;
  const activeTab = state.activeTab;
  const todayKegiatanCount = state.todayKegiatanCount || 0;
  const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
  const profil = db.getProfilGuru ? db.getProfilGuru() : {};
  const schoolName = school.nama_sekolah || 'SMKN 1 Bantaeng';
  const guruName = (profil.nama_guru || 'Ammar').split(',')[0].trim();

  container.innerHTML = `
    <header class="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white shadow-lg sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          
          <!-- Logo & Info Guru -->
          <div class="flex items-center space-x-3 cursor-pointer" id="nav-brand">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner overflow-hidden">
              ${school.logo_url ? `<img src="${school.logo_url}" class="w-8 h-8 object-contain" alt="Logo">` : '<i data-lucide="clipboard-check" class="w-6 h-6"></i>'}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-lg tracking-tight leading-none text-white">SIA-Jurnal</span>
                <span class="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${isSupabase ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
                  ${isSupabase ? 'Supabase Cloud' : 'Mode Offline'}
                </span>
              </div>
              <p class="text-xs text-emerald-200/80 font-medium">${guruName} • ${schoolName}</p>
            </div>
          </div>

          <!-- Desktop Navigation Tabs -->
          <nav class="hidden md:flex items-center space-x-1">
            <button data-tab="absen" class="nav-tab-btn px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'absen' ? 'bg-emerald-600/60 text-white shadow-sm ring-1 ring-emerald-400/40' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'}">
              <i data-lucide="user-check" class="w-4 h-4"></i>
              <span>Absen Siswa</span>
            </button>

            <button data-tab="jurnal" class="nav-tab-btn px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'jurnal' ? 'bg-emerald-600/60 text-white shadow-sm ring-1 ring-emerald-400/40' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'}">
              <i data-lucide="book-open" class="w-4 h-4"></i>
              <span>Jurnal Mengajar</span>
            </button>

            <button data-tab="kegiatan" class="nav-tab-btn px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 relative ${activeTab === 'kegiatan' ? 'bg-emerald-600/60 text-white shadow-sm ring-1 ring-emerald-400/40' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'}">
              <i data-lucide="sparkles" class="w-4 h-4 text-amber-400"></i>
              <span>Kegiatan Siswa</span>
              ${todayKegiatanCount > 0 ? `<span class="bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">${todayKegiatanCount}</span>` : ''}
            </button>

            <button data-tab="tugas" class="nav-tab-btn px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 relative ${activeTab === 'tugas' ? 'bg-emerald-600/60 text-white shadow-sm ring-1 ring-emerald-400/40' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'}">
              <i data-lucide="clipboard-list" class="w-4 h-4 text-sky-300"></i>
              <span>Catatan & Tugas</span>
              ${(state.todayTugasCount || 0) > 0 ? `<span class="bg-sky-400 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full">${state.todayTugasCount}</span>` : ''}
            </button>

            <button data-tab="riwayat" class="nav-tab-btn px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'riwayat' ? 'bg-emerald-600/60 text-white shadow-sm ring-1 ring-emerald-400/40' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'}">
              <i data-lucide="history" class="w-4 h-4"></i>
              <span>Riwayat Sesi</span>
            </button>

            <button data-tab="rekap" class="nav-tab-btn px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'rekap' ? 'bg-emerald-600/60 text-white shadow-sm ring-1 ring-emerald-400/40' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'}">
              <i data-lucide="bar-chart-3" class="w-4 h-4"></i>
              <span>Rekap Kehadiran</span>
            </button>
          </nav>

          <!-- Quick Action Buttons -->
          <div class="flex items-center space-x-2">
            <button id="btn-open-siswa" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700/60 hover:bg-emerald-600 text-white border border-emerald-500/40 flex items-center gap-1.5 transition">
              <i data-lucide="school" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Data Kelas & Siswa</span>
            </button>

            <button id="btn-open-settings" class="p-2 rounded-lg text-emerald-100/80 hover:text-white hover:bg-white/10 transition" title="Pengaturan Database & Supabase">
              <i data-lucide="settings" class="w-5 h-5"></i>
            </button>
          </div>

        </div>
      </div>

      <!-- Mobile Subheader Navigation Bar (Bottom app-style navigation on mobile) -->
      <div class="md:hidden flex items-center justify-around bg-slate-900/95 border-t border-slate-800 px-1 py-1.5 text-[11px]">
        <button data-tab="absen" class="nav-tab-btn flex flex-col items-center py-1 px-2 rounded-lg ${activeTab === 'absen' ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
          <i data-lucide="user-check" class="w-5 h-5 mb-0.5"></i>
          <span>Absen</span>
        </button>

        <button data-tab="jurnal" class="nav-tab-btn flex flex-col items-center py-1 px-2 rounded-lg ${activeTab === 'jurnal' ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
          <i data-lucide="book-open" class="w-5 h-5 mb-0.5"></i>
          <span>Jurnal</span>
        </button>

        <button data-tab="tugas" class="nav-tab-btn flex flex-col items-center py-1 px-2 rounded-lg relative ${activeTab === 'tugas' ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
          <div class="relative">
            <i data-lucide="clipboard-list" class="w-5 h-5 mb-0.5 text-sky-400"></i>
            ${(state.todayTugasCount || 0) > 0 ? `<span class="absolute -top-1 -right-2 bg-sky-400 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">${state.todayTugasCount}</span>` : ''}
          </div>
          <span>Tugas</span>
        </button>

        <button data-tab="kegiatan" class="nav-tab-btn flex flex-col items-center py-1 px-2 rounded-lg relative ${activeTab === 'kegiatan' ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
          <div class="relative">
            <i data-lucide="sparkles" class="w-5 h-5 mb-0.5 text-amber-400"></i>
            ${todayKegiatanCount > 0 ? `<span class="absolute -top-1 -right-2 bg-amber-500 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">${todayKegiatanCount}</span>` : ''}
          </div>
          <span>Kegiatan</span>
        </button>

        <button data-tab="riwayat" class="nav-tab-btn flex flex-col items-center py-1 px-2 rounded-lg ${activeTab === 'riwayat' ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
          <i data-lucide="history" class="w-5 h-5 mb-0.5"></i>
          <span>Riwayat</span>
        </button>

        <button data-tab="rekap" class="nav-tab-btn flex flex-col items-center py-1 px-2 rounded-lg ${activeTab === 'rekap' ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
          <i data-lucide="bar-chart-3" class="w-5 h-5 mb-0.5"></i>
          <span>Rekap</span>
        </button>
      </div>
    </header>
  `;

  // Bind Events
  container.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) onNavigate(tab);
    });
  });

  const brandBtn = container.querySelector('#nav-brand');
  if (brandBtn) {
    brandBtn.addEventListener('click', () => onNavigate('absen'));
  }

  const btnSiswa = container.querySelector('#btn-open-siswa');
  if (btnSiswa) {
    btnSiswa.addEventListener('click', () => onOpenModal('siswa'));
  }

  const btnSettings = container.querySelector('#btn-open-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => onOpenModal('settings'));
  }

  // Render Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
