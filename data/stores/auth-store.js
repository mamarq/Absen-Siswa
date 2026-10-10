// data/stores/auth-store.js
// Domain Store: Autentikasi, Profil Guru & Pengaturan Sekolah (profiles, profil_guru, school_settings)

import { STORAGE_KEYS } from './shared-store-utils.js';

export class AuthStore {
  /**
   * @param {Object} ctx - Facade context (instance DataStore)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  // ==========================================================================
  // DATA SEKOLAH & PROFIL GURU (CLOUD SYNC & MULTI-DEVICE SUPPORT)
  // ==========================================================================

  /**
   * Menyelaraskan Data Sekolah dan Profil Guru dari Supabase Cloud ke LocalStorage
   * Dipanggil saat inisialisasi aplikasi atau saat berpindah perangkat
   */
  async syncSchoolAndProfileFromSupabase() {
    if (!this.ctx.isSupabaseConnected || !this.ctx.supabase) return;
    try {
      const currentUser = await this.getCurrentUser();
      const currentUserId = currentUser?.id || null;

      const promises = [this.ctx.supabase.from('school_settings').select('*').limit(1)];
      if (currentUserId) {
        promises.push(this.ctx.supabase.from('profil_guru').select('*').eq('user_id', currentUserId).maybeSingle());
      }

      const [schoolRes, profilRes] = await Promise.all(promises);

      if (schoolRes && schoolRes.data && schoolRes.data.length > 0) {
        const s = schoolRes.data[0];
        const localSchool = {
          id: s.id,
          instansi_induk: s.instansi_induk || '',
          dinas: s.dinas || '',
          nama_sekolah: s.nama_sekolah || '',
          alamat: s.alamat || '',
          telepon: s.telepon || '',
          email: s.email || '',
          website: s.website || '',
          npsn: s.npsn || '',
          logo_url: s.logo_url || '',
          updatedAt: s.updated_at || new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(localSchool));
      }

      if (profilRes && profilRes.data && currentUserId) {
        const p = Array.isArray(profilRes.data) ? profilRes.data[0] : profilRes.data;
        if (p) {
          const localProfil = {
            id: p.id,
            user_id: p.user_id,
            nama_guru: p.nama_guru || '',
            nip_guru: p.nip_guru || '',
            nama_sekolah: p.nama_sekolah || '',
            nama_kepsek: p.nama_kepsek || '',
            nip_kepsek: p.nip_kepsek || '',
            kota: p.kota || '',
            updatedAt: p.updated_at || new Date().toISOString()
          };
          localStorage.setItem(`${STORAGE_KEYS.PROFIL_GURU}_${currentUserId}`, JSON.stringify(localProfil));
          this.ctx._setCache(`profil_guru_${currentUserId}`, localProfil);
        }
      }

      this.ctx._invalidateCache(['school_settings', ...(currentUserId ? [`profil_guru_${currentUserId}`] : [])]);
    } catch (e) {
      console.warn('Sync school settings & profile warning:', e);
    }
  }

  getSchoolSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHOOL_SETTINGS) || '{}');
      return {
        instansi_induk: s.instansi_induk !== undefined ? s.instansi_induk : 'Pemerintah Provinsi Sulawesi Selatan',
        dinas: s.dinas !== undefined ? s.dinas : 'Dinas Pendidikan',
        nama_sekolah: s.nama_sekolah !== undefined ? s.nama_sekolah : 'SMKN 1 Bantaeng',
        alamat: s.alamat !== undefined ? s.alamat : 'Jl. Pahlawan No. 12, Bantaeng',
        telepon: s.telepon !== undefined ? s.telepon : '(0413) 21088',
        email: s.email || '',
        website: s.website !== undefined ? s.website : 'smkn1bantaeng.sch.id',
        npsn: s.npsn || '',
        logo_url: s.logo_url || ''
      };
    } catch {
      return {
        instansi_induk: 'Pemerintah Provinsi Sulawesi Selatan',
        dinas: 'Dinas Pendidikan',
        nama_sekolah: 'SMKN 1 Bantaeng',
        alamat: 'Jl. Pahlawan No. 12, Bantaeng',
        telepon: '(0413) 21088',
        email: '',
        website: 'smkn1bantaeng.sch.id',
        npsn: '',
        logo_url: ''
      };
    }
  }

  async saveSchoolSettings(settings) {
    this.ctx._invalidateCache(['school_settings', 'profil_guru']);
    try {
      const current = this.getSchoolSettings();
      const updated = {
        ...current,
        ...settings,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(updated));

      // Sync nama_sekolah ke profil guru jika nama sekolah berubah
      const profil = this.getProfilGuru();
      if (updated.nama_sekolah && profil.nama_sekolah !== updated.nama_sekolah) {
        await this.saveProfilGuru({ ...profil, nama_sekolah: updated.nama_sekolah });
      }

      // Sync ke Supabase table school_settings jika terhubung
      if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
        try {
          const { data: existing } = await this.ctx.supabase.from('school_settings').select('id').limit(1);
          const payload = {
            instansi_induk: updated.instansi_induk,
            dinas: updated.dinas,
            nama_sekolah: updated.nama_sekolah,
            alamat: updated.alamat,
            telepon: updated.telepon,
            email: updated.email,
            website: updated.website,
            npsn: updated.npsn,
            logo_url: updated.logo_url,
            updated_at: new Date().toISOString()
          };

          if (existing && existing.length > 0) {
            await this.ctx.supabase.from('school_settings').update(payload).eq('id', existing[0].id);
          } else {
            await this.ctx.supabase.from('school_settings').insert([{
              ...payload,
              created_at: new Date().toISOString()
            }]);
          }
        } catch (errSup) {
          console.warn('Supabase saveSchoolSettings sync warning:', errSup);
        }
      }

      this.ctx._invalidateCache(['school_settings', 'profil_guru']);
      return { success: true, message: 'Data sekolah berhasil disimpan!' };
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan data sekolah: ' + e.message };
    }
  }

  getProfilGuru() {
    const school = this.getSchoolSettings();
    let currentUserId = null;
    let userName = 'Ammar, S.Pd.';
    try {
      const localUser = localStorage.getItem('absen_local_auth_user');
      if (localUser) {
        const u = JSON.parse(localUser);
        currentUserId = u?.id || null;
        if (u?.name) userName = u.name;
      }
    } catch {}

    const defaultProfile = {
      user_id: currentUserId,
      nama_guru: userName,
      nip_guru: '',
      nama_sekolah: school?.nama_sekolah || 'SMKN 1 Bantaeng',
      nama_kepsek: school?.nama_kepsek || 'Drs. H. Syamsuddin, M.Pd.',
      nip_kepsek: school?.nip_kepsek || '',
      kota: school?.kota || 'Bantaeng'
    };

    if (!currentUserId) {
      return defaultProfile;
    }

    const cacheKey = `profil_guru_${currentUserId}`;
    const cached = this.ctx._getCache(cacheKey);
    if (cached) return cached;

    try {
      const p = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.PROFIL_GURU}_${currentUserId}`) || 'null');
      if (p && (p.nama_guru || p.user_id === currentUserId)) {
        const res = {
          id: p.id,
          user_id: currentUserId,
          nama_guru: p.nama_guru || defaultProfile.nama_guru,
          nip_guru: p.nip_guru || '',
          nama_sekolah: p.nama_sekolah || defaultProfile.nama_sekolah,
          nama_kepsek: p.nama_kepsek || defaultProfile.nama_kepsek,
          nip_kepsek: p.nip_kepsek || defaultProfile.nip_kepsek,
          kota: p.kota || defaultProfile.kota
        };
        return this.ctx._setCache(cacheKey, res);
      }
    } catch {}

    return this.ctx._setCache(cacheKey, defaultProfile);
  }

  async saveProfilGuru(profil) {
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser?.id || null;
    if (!currentUserId) {
      return { success: false, message: 'Autentikasi gagal: Sesi login tidak ditemukan' };
    }

    this.ctx._invalidateCache([`profil_guru_${currentUserId}`]);
    const school = this.getSchoolSettings();
    try {
      const current = this.getProfilGuru();
      const updated = {
        ...current,
        ...profil,
        user_id: currentUserId,
        updatedAt: new Date().toISOString()
      };

      let savedRow = null;
      let supabaseError = null;

      // Sync ke Supabase table profil_guru jika terhubung
      if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
        try {
          const { data: existing } = await this.ctx.supabase
            .from('profil_guru')
            .select('id')
            .eq('user_id', currentUserId)
            .maybeSingle();

          const existingRow = Array.isArray(existing) ? existing[0] : existing;

          const payload = {
            user_id: currentUserId,
            nama_guru: updated.nama_guru || currentUser.name || '',
            nip_guru: updated.nip_guru || '',
            nama_sekolah: updated.nama_sekolah || school?.nama_sekolah || '',
            nama_kepsek: updated.nama_kepsek || school?.nama_kepsek || '',
            nip_kepsek: updated.nip_kepsek || school?.nip_kepsek || '',
            kota: updated.kota || school?.kota || 'Bantaeng',
            updated_at: new Date().toISOString()
          };

          if (existingRow && existingRow.id) {
            const { data: updateRes, error: updateErr } = await this.ctx.supabase
              .from('profil_guru')
              .update(payload)
              .eq('id', existingRow.id)
              .eq('user_id', currentUserId)
              .select()
              .single();
            if (updateErr) throw updateErr;
            savedRow = updateRes;
          } else {
            const { data: insertRes, error: insertErr } = await this.ctx.supabase
              .from('profil_guru')
              .insert([{
                ...payload,
                created_at: new Date().toISOString()
              }])
              .select()
              .single();
            if (insertErr) throw insertErr;
            savedRow = insertRes;
          }
        } catch (errSup) {
          console.warn('Supabase saveProfilGuru sync warning:', errSup);
          supabaseError = errSup;
        }
      }

      const finalProfile = savedRow ? { ...updated, ...savedRow } : updated;
      localStorage.setItem(`${STORAGE_KEYS.PROFIL_GURU}_${currentUserId}`, JSON.stringify(finalProfile));
      this.ctx._setCache(`profil_guru_${currentUserId}`, finalProfile);

      if (supabaseError) {
        return { success: true, warning: 'Profil tersimpan di lokal (Supabase sync tertunda): ' + supabaseError.message };
      }
      return { success: true, message: 'Profil guru & tanda tangan berhasil disimpan!' };
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan profil: ' + e.message };
    }
  }

  // ==========================================================================
  // AUTENTIKASI & USER MANAGEMENT (AUTHORITATIVE ROLE INTEGRATION)
  // ==========================================================================
  async _getAuthProfile(userId) {
    if (!this.ctx.isSupabaseConnected || !this.ctx.supabase || !userId) {
      return { role: 'guru', full_name: null };
    }
    try {
      const { data, error } = await this.ctx.supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const validRole = data.role === 'admin' ? 'admin' : 'guru';
        return {
          id: data.id,
          email: data.email,
          full_name: data.full_name || null,
          role: validRole
        };
      }
    } catch (e) {
      console.warn('Fail-closed profile read error:', e);
    }
    return { role: 'guru', full_name: null };
  }

  async getCurrentUser() {
    // 1. Cek sesi Supabase jika terhubung (prioritas otoritatif)
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const userPromise = this.ctx.supabase.auth.getUser();
        const res = await Promise.race([userPromise, timeoutPromise]);
        if (res && res.data && res.data.user) {
          const authUser = res.data.user;
          const profile = await this._getAuthProfile(authUser.id);
          const authoritativeRole = profile.role === 'admin' ? 'admin' : 'guru';

          const user = {
            id: authUser.id,
            email: authUser.email,
            name: profile.full_name || authUser.user_metadata?.full_name || 'Muammar Qadafie',
            role: authoritativeRole,
            isCloud: true
          };
          localStorage.setItem('absen_local_auth_user', JSON.stringify(user));
          return user;
        }
      } catch (e) {
        console.warn('Check Supabase auth user:', e);
      }
    }

    // 2. Cek sesi lokal jika offline / Supabase tidak terhubung
    const localUser = localStorage.getItem('absen_local_auth_user');
    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        if (!this.ctx.isSupabaseConnected && parsed.role === 'admin') {
          parsed.role = 'guru'; // Fail-closed: tidak boleh offline admin
        }
        return parsed;
      } catch {
        // ignore
      }
    }

    return null;
  }

  async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPwd = (password || '').trim();

    if (!cleanPwd || cleanPwd.length < 3) {
      return { success: false, message: 'Kata sandi minimal 3 karakter.' };
    }

    // 1. Coba login via Supabase jika terhubung
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const authPromise = this.ctx.supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPwd
        });
        const res = await Promise.race([authPromise, timeoutPromise]);
        if (res && res.data && res.data.user && !res.error) {
          const authUser = res.data.user;
          const profile = await this._getAuthProfile(authUser.id);
          const authoritativeRole = profile.role === 'admin' ? 'admin' : 'guru';

          const user = {
            id: authUser.id,
            email: authUser.email,
            name: profile.full_name || authUser.user_metadata?.full_name || 'Muammar Qadafie',
            role: authoritativeRole,
            isCloud: true
          };
          localStorage.setItem('absen_local_auth_user', JSON.stringify(user));
          return { success: true, user, isCloud: true };
        }
      } catch (err) {
        console.warn('Supabase cloud login timeout / network warning, fallback to local login:', err);
      }
    }

    // 2. Hybrid Fallback: Login Berhasil Secara Otomatis (Offline/Lokal)
    const profil = this.getProfilGuru();
    const user = {
      id: 'guru-local-1',
      email: cleanEmail || 'guru@smkn1bantaeng.sch.id',
      name: profil.nama_guru || 'Muammar Qadafie',
      role: 'guru',
      isCloud: false
    };
    localStorage.setItem('absen_local_auth_user', JSON.stringify(user));
    return { success: true, user, isCloud: false };
  }

  async signup(email, password, fullName) {
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      const { data, error } = await this.ctx.supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'guru'
          }
        }
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return {
        success: true,
        message: 'Pendaftaran akun berhasil! Silakan periksa email Anda jika konfirmasi email aktif, atau langsung masuk.',
        user: data.user
      };
    }
    return { success: false, message: 'Koneksi Supabase belum aktif.' };
  }

  async logout() {
    if (this.ctx.isSupabaseConnected && this.ctx.supabase) {
      try {
        await this.ctx.supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
    localStorage.removeItem('absen_local_auth_user');
    this.ctx._cache.clear();
    if (typeof this.ctx.invalidateJadwalMengajarCache === 'function') {
      this.ctx.invalidateJadwalMengajarCache();
    }
    return { success: true };
  }

  // Sinkronisasi data lokal ke Supabase Cloud
  async syncLocalToCloud() {
    if (!this.ctx.isSupabaseConnected || !this.ctx.supabase) {
      return { success: false, message: 'Koneksi ke Supabase belum terhubung.' };
    }

    try {
      const allKelas = JSON.parse(localStorage.getItem(STORAGE_KEYS.KELAS) || '[]');
      const allSiswa = JSON.parse(localStorage.getItem(STORAGE_KEYS.SISWA) || '[]');

      // 1. Upload Kelas
      if (allKelas.length > 0) {
        const { error: errKelas } = await this.ctx.supabase.from('kelas').upsert(allKelas.map(k => ({
          id: k.id,
          nama_kelas: k.nama_kelas,
          tingkat: k.tingkat || 'X',
          jurusan: k.jurusan || null,
          jurusan_id: k.jurusan_id || null,
          academic_year: k.academic_year || '2026/2027',
          is_active: k.is_active !== undefined ? k.is_active : true
        })));
        if (errKelas) console.warn('Sync Kelas Warning:', errKelas.message);
      }

      // 2. Upload Siswa
      if (allSiswa.length > 0) {
        const { error: errSiswa } = await this.ctx.supabase.from('siswa').upsert(allSiswa.map(s => ({
          id: s.id,
          kelas_id: s.kelas_id,
          nama_lengkap: s.nama_lengkap,
          nisn: s.nisn || null,
          jenis_kelamin: s.jenis_kelamin || 'L',
          nomor_absen: s.nomor_absen || null
        })));
        if (errSiswa) console.warn('Sync Siswa Warning:', errSiswa.message);
      }

      return {
        success: true,
        message: `Sinkronisasi berhasil! ${allKelas.length} Kelas dan ${allSiswa.length} Siswa berhasil diunggah ke Cloud Supabase.`
      };
    } catch (err) {
      return { success: false, message: 'Gagal sinkronisasi data: ' + err.message };
    }
  }
}
