import { db } from './supabase-client.js';
import { renderAuthView } from './components/AuthView.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderTopbar } from './components/Topbar.js';
import { renderAbsenView } from './components/AbsenView.js';
import { renderJurnalView } from './components/JurnalView.js';
import { renderKegiatanView } from './components/KegiatanView.js';
import { renderTugasView } from './components/TugasView.js';
import { renderPemeriksaanTugasView } from './components/PemeriksaanTugasView.js';
import { renderRiwayatView } from './components/RiwayatView.js';
import { renderRekapView } from './components/RekapView.js';
import { renderRekapSiswaView } from './components/RekapSiswaView.js';
import { renderPRBuatView } from './components/PRBuatView.js';
import { renderPRPemeriksaanView } from './components/PRPemeriksaanView.js';
import { renderKelompokView } from './components/KelompokView.js';
import { renderTugasKelompokView } from './components/TugasKelompokView.js';
import { renderLedgerNilaiView } from './components/LedgerNilaiView.js';
import { renderJadwalMengajarView } from './components/JadwalMengajarView.js';
import { renderSiswaModal } from './components/SiswaModal.js';
import { renderKenaikanKelasModal } from './components/KenaikanKelasModal.js';
import { renderSettingsModal, renderQuickEditMapelModal } from './components/SettingsModal.js';

class App {
  constructor() {
    const urlParams = new URLSearchParams(window.location.search);
    this.state = {
      currentUser: null,
      activeTab: 'absen',
      isSidebarCollapsed: localStorage.getItem('absen_sidebar_collapsed') === 'true',
      isMobileSidebarOpen: false,
      selectedAcademicYear: urlParams.get('year') || '',
      academicYears: [],
      currentKelasId: '',
      currentMapel: '',
      currentTanggal: new Date().toISOString().split('T')[0],
      currentAttendanceMap: null,
      todayKegiatanCount: 0,
      todayTugasCount: 0,
      pendingPRCount: 0,
      targetInspectionPRId: null,
      isDarkMode: localStorage.getItem('absen_dark_mode') === 'true',
      tugasSubTab: 'ceklis',
      tugasFilterTab: 'semua',
      tugasFilterKelas: '',
      isSupabaseConnected: db.isSupabaseConnected,
      riwayatFilterKelas: '',
      riwayatFilterMapel: '',
      rekapKelasId: '',
      rekapMapel: '',
      rekapStartDate: '',
      rekapEndDate: '',
      rekapSiswaKelasId: '',
      rekapSiswaSelectedId: '',
      rekapSiswaSubTab: 'nilai',
      rekapSiswaTimelineFilter: 'semua'
    };

    // Listen to browser Back/Forward navigation
    window.addEventListener('popstate', async () => {
      const yearFromUrl = new URLSearchParams(window.location.search).get('year');
      if (yearFromUrl && yearFromUrl !== this.state.selectedAcademicYear) {
        await this.setAcademicYear(yearFromUrl, false);
      }
    });

    this.sidebarRoot = document.getElementById('sidebar-root');
    this.topbarRoot = document.getElementById('topbar-root');
    this.mainRoot = document.getElementById('main-root');
    this.modalRoot = document.getElementById('modal-root');
    this.toastContainer = document.getElementById('toast-container');
  }

  async init() {
    try {
      // 0. Terapkan mode gelap dari cache
      document.documentElement.classList.toggle('dark', this.state.isDarkMode);

      // 1. Periksa sesi login guru & sinkronisasi data sekolah/profil dari cloud jika terhubung
      this.state.currentUser = await db.getCurrentUser();
      if (db.isSupabaseConnected) {
        await db.syncSchoolAndProfileFromSupabase();
      }
      if (!this.state.currentUser) {
        this.render();
        return;
      }

      // 2. Ambil daftar tahun ajaran & set default tahun aktif
      this.state.academicYears = await db.getDistinctAcademicYears();
      if (!this.state.selectedAcademicYear) {
        this.state.selectedAcademicYear = await db.getActiveAcademicYear();
      }
      this.syncUrlParams();

      // 3. Ambil default kelas untuk tahun ajaran terpilih dan mapel pertama
      const kelasList = await db.getClassesByYear(this.state.selectedAcademicYear, true);
      const mapelList = await db.getMapelList();

      if (kelasList.length > 0) {
        if (!this.state.currentKelasId || !kelasList.some(k => k.id === this.state.currentKelasId)) {
          this.state.currentKelasId = kelasList[0].id;
        }
        if (!this.state.rekapKelasId || !kelasList.some(k => k.id === this.state.rekapKelasId)) {
          this.state.rekapKelasId = kelasList[0].id;
        }
        if (!this.state.rekapSiswaKelasId || !kelasList.some(k => k.id === this.state.rekapSiswaKelasId)) {
          this.state.rekapSiswaKelasId = kelasList[0].id;
        }
      }
      if (mapelList.length > 0 && !this.state.currentMapel) {
        this.state.currentMapel = mapelList[0];
      }

      await this.updateTodayCounts();
      this.initServiceWorker();
    } catch (e) {
      console.warn('App init non-blocking fallback:', e);
    } finally {
      this.render();
    }
  }

  // Inisialisasi PWA Service Worker & Install Prompt
  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.endsWith('.localhost')
      );

      if (isLocalhost) {
        // Otomatis bersihkan & unregister Service Worker di localhost
        window.addEventListener('load', async () => {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
              await reg.unregister();
              console.log('[DEV] Unregistered localhost Service Worker:', reg.scope);
            }
            if ('caches' in window) {
              const cacheKeys = await caches.keys();
              for (const key of cacheKeys) {
                if (key.startsWith('sia-jurnal-static')) {
                  await caches.delete(key);
                  console.log('[DEV] Cleared local cache storage:', key);
                }
              }
            }
          } catch (e) {
            console.warn('[DEV] Error purging localhost Service Worker:', e);
          }
        });
        return; // Jangan daftarkan Service Worker di localhost
      }

      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Deteksi update versi baru service worker
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Ada update baru yang sudah terinstall
                  this.showToast('Versi baru aplikasi tersedia! Memperbarui...', 'info');
                  setTimeout(() => {
                    window.location.reload();
                  }, 1200);
                }
              };
            }
          };
        } catch (err) {
          console.warn('[PWA] Service Worker registration failed:', err);
        }
      });

      // Tangkap event install prompt browser
      window.addEventListener('beforeinstallprompt', (e) => {
        window.deferredPWAInstallPrompt = e;
        console.log('[PWA] beforeinstallprompt event captured');
      });

      window.addEventListener('appinstalled', () => {
        window.deferredPWAInstallPrompt = null;
        this.showToast('Aplikasi SIA-Jurnal berhasil di-install ke perangkat!', 'success');
      });
    }
  }

  async updateTodayCounts() {
    const today = this.state.currentTanggal || new Date().toISOString().split('T')[0];
    const [kegiatanList, pendingPRCount] = await Promise.all([
      db.getKegiatanSiswaByTanggal(today),
      db.getPendingPRCount(this.state.selectedAcademicYear)
    ]);
    this.state.todayKegiatanCount = kegiatanList.length;
    this.state.todayTugasCount = 0; // Bersihkan notifikasi generic agar tidak membingungkan guru sebelum KBM dimulai
    this.state.pendingPRCount = pendingPRCount;
    this.state.isSupabaseConnected = db.isSupabaseConnected;
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    else if (type === 'error') iconName = 'alert-circle';
    else if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
      <span class="flex-1 leading-snug">${message}</span>
    `;

    this.toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  navigateTab(tab, extraData = null) {
    this.state.activeTab = tab;
    if (extraData && extraData.prId) {
      this.state.targetInspectionPRId = extraData.prId;
    } else {
      this.state.targetInspectionPRId = null;
    }
    this.render();
    // Update today counts in the background without freezing navigation
    this.updateTodayCounts().catch(e => console.warn('Background count update:', e));
  }

  openModal(modalType, extraData = null) {
    if (modalType === 'siswa') {
      renderSiswaModal(
        this.modalRoot,
        () => (this.modalRoot.innerHTML = ''),
        async () => {
          await this.updateTodayCounts();
          this.render();
        },
        (msg, type) => this.showToast(msg, type),
        this.state.selectedAcademicYear
      );
    } else if (modalType === 'edit-mapel') {
      const mapelNameToEdit = extraData || this.state.currentMapel;
      renderQuickEditMapelModal(
        this.modalRoot,
        mapelNameToEdit,
        () => (this.modalRoot.innerHTML = ''),
        async (newMapelName) => {
          this.state.isSupabaseConnected = db.isSupabaseConnected;
          if (newMapelName && typeof newMapelName === 'string') {
            this.state.currentMapel = newMapelName;
          } else if (newMapelName === '') {
            const list = await db.getMapelList();
            this.state.currentMapel = list[0] || '';
          }
          await this.init();
        },
        (msg, type) => this.showToast(msg, type)
      );
    } else if (modalType === 'kenaikan-kelas') {
      renderKenaikanKelasModal(
        this.modalRoot,
        () => (this.modalRoot.innerHTML = ''),
        async (switchedYear) => {
          this.state.isSupabaseConnected = db.isSupabaseConnected;
          this.state.academicYears = await db.getDistinctAcademicYears();
          if (switchedYear && switchedYear !== this.state.selectedAcademicYear) {
            await this.setAcademicYear(switchedYear);
          } else {
            await this.init();
          }
        },
        (msg, type) => this.showToast(msg, type),
        this.state.selectedAcademicYear
      );
    } else if (modalType === 'settings' || modalType === 'mapel' || modalType === 'jurusan') {
      const initialTab = modalType === 'jurusan' ? 'jurusan' : (modalType === 'mapel' ? 'mapel' : 'database');
      renderSettingsModal(
        this.modalRoot,
        () => (this.modalRoot.innerHTML = ''),
        async (newMapelName) => {
          this.state.isSupabaseConnected = db.isSupabaseConnected;
          if (newMapelName && typeof newMapelName === 'string') {
            this.state.currentMapel = newMapelName;
          }
          await this.init();
        },
        (msg, type) => this.showToast(msg, type),
        initialTab
      );
    }
  }

  syncUrlParams() {
    if (this.state.selectedAcademicYear) {
      const url = new URL(window.location);
      url.searchParams.set('year', this.state.selectedAcademicYear);
      window.history.replaceState({}, '', url);
    }
  }

  async setAcademicYear(newYear, pushHistory = true) {
    if (!newYear) return;
    this.state.selectedAcademicYear = newYear;
    if (pushHistory) {
      const url = new URL(window.location);
      url.searchParams.set('year', newYear);
      window.history.pushState({}, '', url);
    }
    this.state.academicYears = await db.getDistinctAcademicYears();
    const kelasList = await db.getClassesByYear(newYear, true);
    
    // Jangan paksa pilih kelas pertama; pertahankan jika kelas masih ada di tahun baru, selain itu kosongkan (default tidak memilih kelas)
    if (!this.state.currentKelasId || !kelasList.some(k => k.id === this.state.currentKelasId)) {
      this.state.currentKelasId = '';
    }
    if (!this.state.rekapKelasId || !kelasList.some(k => k.id === this.state.rekapKelasId)) {
      this.state.rekapKelasId = '';
    }
    if (!this.state.rekapSiswaKelasId || !kelasList.some(k => k.id === this.state.rekapSiswaKelasId)) {
      this.state.rekapSiswaKelasId = '';
    }

    this.state.currentAttendanceMap = null;
    await this.updateTodayCounts();
    this.render();
  }

  toggleSidebar() {
    if (window.innerWidth < 768) {
      this.state.isMobileSidebarOpen = !this.state.isMobileSidebarOpen;
    } else {
      this.state.isSidebarCollapsed = !this.state.isSidebarCollapsed;
      localStorage.setItem('absen_sidebar_collapsed', this.state.isSidebarCollapsed);
    }
    this.renderLayout();
  }

  toggleSidebarCollapse() {
    this.state.isSidebarCollapsed = !this.state.isSidebarCollapsed;
    localStorage.setItem('absen_sidebar_collapsed', this.state.isSidebarCollapsed);
    this.renderLayout();
  }

  closeMobileSidebar() {
    this.state.isMobileSidebarOpen = false;
    this.renderLayout();
  }

  toggleTheme() {
    const isDark = !this.state.isDarkMode;
    this.state.isDarkMode = isDark;
    localStorage.setItem('absen_dark_mode', isDark ? 'true' : 'false');
    document.documentElement.classList.toggle('dark', isDark);
    this.showToast(isDark ? 'Mode Gelap diaktifkan 🌙' : 'Mode Terang diaktifkan ☀️', 'info');
    this.renderLayout();
  }

  async handleLogout() {
    await db.logout();
    this.state.currentUser = null;
    this.showToast('Anda telah keluar dari aplikasi.', 'info');
    this.render();
  }

  renderLayout() {
    if (!this.state.currentUser) return;

    this.sidebarRoot?.classList.remove('hidden');
    this.topbarRoot?.classList.remove('hidden');

    renderSidebar(
      this.sidebarRoot,
      this.state,
      (tab) => this.navigateTab(tab),
      (modalType) => this.openModal(modalType),
      () => this.toggleSidebarCollapse(),
      () => this.closeMobileSidebar(),
      () => this.handleLogout()
    );

    renderTopbar(
      this.topbarRoot,
      this.state,
      () => this.toggleSidebar(),
      (modalType) => this.openModal(modalType),
      () => this.toggleTheme(),
      (newYear) => this.setAcademicYear(newYear)
    );
  }

  async render() {
    // 1. Jika belum login, tampilkan halaman Login/Auth
    if (!this.state.currentUser) {
      if (this.sidebarRoot) {
        this.sidebarRoot.innerHTML = '';
        this.sidebarRoot.classList.add('hidden');
      }
      if (this.topbarRoot) {
        this.topbarRoot.innerHTML = '';
        this.topbarRoot.classList.add('hidden');
      }
      const backdrop = document.getElementById('sidebar-backdrop');
      if (backdrop) backdrop.classList.add('hidden');

      renderAuthView(
        this.mainRoot,
        async (user) => {
          this.state.currentUser = user;
          await this.init();
        },
        (msg, type) => this.showToast(msg, type),
        (modalType) => this.openModal(modalType)
      );
      return;
    }

    // 2. Render Left Sidebar & Minimalist Topbar
    this.renderLayout();

    // 3. Render Main View sesuai activeTab
    this.mainRoot.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    `;

    try {
      switch (this.state.activeTab) {
        case 'absen':
          await renderAbsenView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type),
            (sessionInfo) => {
              this.setState({
                activeTab: 'jurnal',
                currentKelasId: sessionInfo.kelasId,
                currentMapel: sessionInfo.mapel,
                currentTanggal: sessionInfo.tanggal
              });
            },
            (modalType) => this.openModal(modalType)
          );
          break;

        case 'jurnal':
          await renderJurnalView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type),
            () => this.navigateTab('absen'),
            (modalType) => this.openModal(modalType)
          );
          break;

        case 'tugas':
          await renderTugasView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'pemeriksaan-tugas':
          await renderPemeriksaanTugasView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'kelompok':
          await renderKelompokView(
            this.mainRoot,
            this.state,
            (tab, extra) => this.navigateTab(tab, extra),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'tugas-kelompok':
          await renderTugasKelompokView(
            this.mainRoot,
            this.state,
            (tab, extra) => this.navigateTab(tab, extra),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'pr-buat':
          await renderPRBuatView(
            this.mainRoot,
            this.state,
            (tab, extra) => this.navigateTab(tab, extra),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'pr-periksa':
          await renderPRPemeriksaanView(
            this.mainRoot,
            this.state,
            (tab, extra) => this.navigateTab(tab, extra),
            (msg, type) => this.showToast(msg, type),
            this.state.targetInspectionPRId
          );
          this.state.targetInspectionPRId = null;
          break;

        case 'kegiatan':
          await renderKegiatanView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'riwayat':
          await renderRiwayatView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type),
            (sesi) => {
              // Edit absensi sesi
              this.setState({
                activeTab: 'absen',
                currentKelasId: sesi.kelas_id,
                currentMapel: sesi.mapel,
                currentTanggal: sesi.tanggal,
                currentAttendanceMap: null
              });
            },
            (sesi) => {
              // Buka jurnal sesi
              this.setState({
                activeTab: 'jurnal',
                currentKelasId: sesi.kelas_id,
                currentMapel: sesi.mapel,
                currentTanggal: sesi.tanggal
              });
            }
          );
          break;

        case 'rekap':
          await renderRekapView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'rekap-siswa':
          await renderRekapSiswaView(
            this.mainRoot,
            this.state,
            (stateUpdate) => this.setState(stateUpdate),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'ledger':
          await renderLedgerNilaiView(
            this.mainRoot,
            this.state,
            (tab, extra) => this.navigateTab(tab, extra),
            (msg, type) => this.showToast(msg, type)
          );
          break;

        case 'jadwal':
          await renderJadwalMengajarView(
            this.mainRoot,
            this.state,
            (tab, extra) => this.navigateTab(tab, extra),
            (msg, type) => this.showToast(msg, type),
            (modalName) => this.openModal(modalName)
          );
          break;

        default:
          this.navigateTab('absen');
      }
    } catch (err) {
      console.error('Render View Error:', err);
      this.mainRoot.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-lg mx-auto text-center border border-rose-200 shadow-sm space-y-4 my-8">
          <div class="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>
          <div>
            <h3 class="font-bold text-slate-800 text-base">Terjadi Kendala Memuat Halaman</h3>
            <p class="text-xs text-slate-500 mt-1 leading-relaxed">${err.message || 'Gagal memproses data halaman.'}</p>
          </div>
          <button id="btn-retry-render" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition">
            Muat Ulang Halaman
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      this.mainRoot.querySelector('#btn-retry-render')?.addEventListener('click', () => this.render());
    }
  }
}

// Inisialisasi App secara andal
function bootstrap() {
  const app = new App();
  app.init();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

export { App };
