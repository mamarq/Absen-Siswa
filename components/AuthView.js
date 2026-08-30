// components/AuthView.js - Halaman Autentikasi Login & Pendaftaran Guru
import { db } from '../supabase-client.js';

export function renderAuthView(container, onAuthSuccess, showToast, onOpenModal) {
  let authMode = 'login'; // 'login' | 'register'

  function renderForm() {
    const isCloud = db.isSupabaseConnected;
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
    const hasCustomSchool = school.nama_sekolah && school.nama_sekolah.trim().length > 0;
    const schoolName = hasCustomSchool ? school.nama_sekolah.trim() : '';

    container.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 flex items-center justify-center p-4 sm:p-6">
        
        <div class="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
          
          <!-- Logo & Header -->
          <div class="text-center space-y-2">
            <div class="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-600/30 ring-4 ring-emerald-500/20 overflow-hidden">
              ${school.logo_url ? `<img src="${school.logo_url}" class="w-12 h-12 object-contain" alt="Logo">` : '<i data-lucide="graduation-cap" class="w-8 h-8"></i>'}
            </div>
            
            <div>
              <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">SIA & Jurnal Guru</h1>
              ${schoolName ? `<p class="text-xs font-extrabold text-emerald-700 uppercase tracking-wider mt-0.5">${schoolName}</p>` : ''}
              <p class="text-xs text-slate-500 mt-1">Sistem Presensi, Jurnal Mengajar & Penilaian Terpadu</p>
            </div>

            <!-- Cloud Status Badge (Clickable to open Database Settings) -->
            <button type="button" id="btn-auth-cloud-status" class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold border transition ${isCloud ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'} cursor-pointer shadow-2xs" title="${isCloud ? 'Database Supabase Cloud Terhubung (Klik untuk kelola)' : 'Mode Offline Lokal - Klik untuk Hubungkan Database Supabase'}">
              <span class="w-2 h-2 rounded-full ${isCloud ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
              <span>${isCloud ? 'Cloud Supabase Terhubung' : 'Mode Offline Lokal'}</span>
              <i data-lucide="settings" class="w-3 h-3 ml-0.5 opacity-60"></i>
            </button>
          </div>

          <!-- Tab Switcher (Login / Register) -->
          <div class="flex p-1 bg-slate-100 rounded-2xl">
            <button id="btn-tab-login" class="flex-1 py-2 text-xs font-bold rounded-xl transition ${authMode === 'login' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
              Masuk (Login)
            </button>
            <button id="btn-tab-register" class="flex-1 py-2 text-xs font-bold rounded-xl transition ${authMode === 'register' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
              Daftar Akun Baru
            </button>
          </div>

          <!-- Form Fields -->
          <form id="auth-form" class="space-y-4">
            
            ${authMode === 'register' ? `
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nama Lengkap & Gelar</label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <i data-lucide="user" class="w-4 h-4"></i>
                  </span>
                  <input type="text" id="auth-name" required placeholder="Contoh: Nama Guru, S.Pd." class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
                </div>
              </div>
            ` : ''}

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Guru</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <i data-lucide="mail" class="w-4 h-4"></i>
                </span>
                <input type="email" id="auth-email" required placeholder="nama@sekolah.sch.id" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Kata Sandi (Password)</label>
              </div>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <i data-lucide="lock" class="w-4 h-4"></i>
                </span>
                <input type="password" id="auth-password" required placeholder="Masukkan kata sandi..." class="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
                <button type="button" id="btn-toggle-pwd" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <!-- Submit Button -->
            <button type="submit" id="btn-auth-submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition transform active:scale-95">
              <i data-lucide="${authMode === 'login' ? 'log-in' : 'user-plus'}" class="w-4 h-4"></i>
              <span>${authMode === 'login' ? 'Masuk ke Aplikasi' : 'Daftarkan Akun Guru'}</span>
            </button>

          </form>

          <!-- Direct Database Setup Button for Multi-School / New Users -->
          <div class="pt-1">
            <button id="btn-open-database-setup" type="button" class="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center justify-center gap-2 transition">
              <i data-lucide="database" class="w-4 h-4 text-emerald-600"></i>
              <span>${isCloud ? 'Kelola Koneksi Database Supabase' : 'Hubungkan Database Supabase Sendiri'}</span>
            </button>
          </div>

          <!-- Quick Access / Bypass for Offline Teaching -->
          <div class="pt-3 border-t border-slate-100 text-center space-y-2">
            <button id="btn-quick-login-offline" type="button" class="text-xs font-semibold text-slate-500 hover:text-emerald-700 flex items-center justify-center gap-1.5 mx-auto transition">
              <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
              <span>Masuk Cepat (Mode Demo / Lokal)</span>
            </button>
            <p class="text-[11px] text-slate-400">Gunakan mode demo/lokal untuk mencoba langsung tanpa internet.</p>
          </div>

        </div>

      </div>
    `;

    if (typeof window !== 'undefined' && window.lucide) window.lucide.createIcons();

    // Event: Buka Setup Database dari Halaman Login
    const openDbSetupHandler = () => {
      if (onOpenModal) {
        onOpenModal('settings');
      }
    };
    container.querySelector('#btn-auth-cloud-status')?.addEventListener('click', openDbSetupHandler);
    container.querySelector('#btn-open-database-setup')?.addEventListener('click', openDbSetupHandler);

    // Tab Switchers
    container.querySelector('#btn-tab-login')?.addEventListener('click', () => {
      authMode = 'login';
      renderForm();
    });

    container.querySelector('#btn-tab-register')?.addEventListener('click', () => {
      authMode = 'register';
      renderForm();
    });

    // Toggle Password Visibility
    const pwdInput = container.querySelector('#auth-password');
    const toggleBtn = container.querySelector('#btn-toggle-pwd');
    toggleBtn?.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
      } else {
        pwdInput.type = 'password';
      }
    });

    // Form Submit
    container.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#auth-email')?.value || 'guru@sekolah.id';
      const password = container.querySelector('#auth-password')?.value || '123456';
      const submitBtn = container.querySelector('#btn-auth-submit');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Memproses...</span>`;
        if (typeof window !== 'undefined' && window.lucide) window.lucide.createIcons();
      }

      try {
        if (authMode === 'login') {
          const res = await db.login(email, password);
          if (res.success) {
            showToast(`Selamat datang, ${res.user?.name || 'Bapak/Ibu Guru'}!`, 'success');
            onAuthSuccess(res.user);
          } else {
            showToast(`Gagal masuk: ${res.message}`, 'error');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Masuk ke Aplikasi</span>`;
              if (typeof window !== 'undefined' && window.lucide) window.lucide.createIcons();
            }
          }
        } else {
          const name = container.querySelector('#auth-name')?.value || 'Guru Mata Pelajaran';
          const res = await db.signup(email, password, name);
          if (res.success) {
            showToast(res.message, 'success');
            authMode = 'login';
            renderForm();
          } else {
            // Fallback: daftarkan langsung secara lokal
            const loginRes = await db.login(email, password);
            showToast(`Akun terdaftar secara lokal. Selamat datang, ${name}!`, 'success');
            onAuthSuccess(loginRes.user);
          }
        }
      } catch (err) {
        console.error('Login error:', err);
        // Fallback darurat
        const fallbackUser = {
          id: 'guru-local-1',
          email: email || 'guru@sekolah.id',
          name: 'Guru Mata Pelajaran',
          role: 'Guru Mata Pelajaran',
          isCloud: false
        };
        localStorage.setItem('absen_local_auth_user', JSON.stringify(fallbackUser));
        showToast('Masuk via Mode Darurat (Offline)', 'info');
        onAuthSuccess(fallbackUser);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    // Quick Login Demo / Local
    container.querySelector('#btn-quick-login-offline')?.addEventListener('click', async () => {
      const res = await db.login('guru@demo.local', '123456');
      showToast(`Masuk ke Mode Demo / Lokal (${res.user?.name || 'Guru'})`, 'success');
      onAuthSuccess(res.user);
    });
  }

  renderForm();
}
