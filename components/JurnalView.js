import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
// components/JurnalView.js - Modul Jurnal Mengajar Guru Mapel Terintegrasi Sesi
import { db } from '../supabase-client.js';

export async function renderJurnalView(container, state, onStateChange, showToast, onNavigateToAbsen, onOpenModal) {
  // Ambil daftar kelas yang diajar oleh guru aktif (Strict Per-User)
  const currentYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const kelasList = await db.getKelasSaya(currentYear);

  // Handle Empty State jika guru belum memiliki jadwal mengajar di tahun ajaran ini
  if (kelasList.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-slate-300 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <i data-lucide="calendar-off" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 text-base sm:text-lg">Belum Ada Jadwal Mengajar</h3>
          <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Anda belum memiliki penugasan jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> untuk mengisi Jurnal Mengajar.
          </p>
        </div>
        <div class="pt-2">
          <button id="btn-jurnal-empty-add-jadwal" class="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-teal-600/20 transition inline-flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>+ Buka Jadwal Mengajar</span>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    container.querySelector('#btn-jurnal-empty-add-jadwal')?.addEventListener('click', () => onNavigateToAbsen && onNavigateToAbsen('jadwal'));
    return;
  }

  // Tentukan kelas aktif (default kelas pertama guru jika belum dipilih / tidak valid)
  const currentKelasId = (kelasList.some(k => k.id === state.currentKelasId) ? state.currentKelasId : (kelasList[0]?.id || ''));

  // Ambil daftar mapel yang diajar guru pada kelas terpilih (Strict Per-User & Per-Kelas)
  const mapelList = await db.getMapelSaya(currentYear, currentKelasId);

  // Handle Empty State jika pada kelas terpilih tidak ditemukan mapel guru
  if (mapelList.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 max-w-lg mx-auto text-center border border-dashed border-slate-300 space-y-4 my-8 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <i data-lucide="book-x" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-slate-800 text-base sm:text-lg">Mata Pelajaran Tidak Ditemukan</h3>
          <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Tidak ditemukan mata pelajaran yang Anda ajar pada kelas terpilih di tahun ajaran <strong>${currentYear}</strong>.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Tentukan mapel aktif (default mapel pertama guru di kelas tersebut, tanpa fallback hardcoded)
  const currentMapel = (mapelList.some(m => m.nama_mapel === state.currentMapel) ? state.currentMapel : (mapelList[0]?.nama_mapel || ''));
  const currentTanggal = state.currentTanggal || new Date().toISOString().split('T')[0];

  const selectedKelasObj = kelasList.find(k => k.id === currentKelasId);
  const [existingSesi, allSiswa] = await Promise.all([
    db.findSesi(currentKelasId, currentMapel, currentTanggal),
    db.getSiswaByKelas(currentKelasId)
  ]);

  // Hitung status kehadiran sesi jika ada
  let attendanceSummary = { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0, listIzinSakit: [] };
  if (existingSesi && existingSesi.absensi && existingSesi.absensi.length > 0) {
    existingSesi.absensi.forEach(a => {
      attendanceSummary.total++;
      if (a.status === 'Hadir') attendanceSummary.hadir++;
      else if (a.status === 'Sakit') {
        attendanceSummary.sakit++;
        const s = allSiswa.find(x => x.id === a.siswa_id);
        if (s) attendanceSummary.listIzinSakit.push(`${s.nama_lengkap} (Sakit)`);
      } else if (a.status === 'Izin') {
        attendanceSummary.izin++;
        const s = allSiswa.find(x => x.id === a.siswa_id);
        if (s) attendanceSummary.listIzinSakit.push(`${s.nama_lengkap} (Izin)`);
      } else if (a.status === 'Alfa') {
        attendanceSummary.alfa++;
        const s = allSiswa.find(x => x.id === a.siswa_id);
        if (s) attendanceSummary.listIzinSakit.push(`${s.nama_lengkap} (Alfa)`);
      }
    });
  }

  const existingJurnal = existingSesi?.jurnal_mengajar || null;

  container.innerHTML = `
    <div class="space-y-4 pb-20 max-w-4xl mx-auto">
      
      <!-- Card Konfigurasi Sesi -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <i data-lucide="book-open" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="font-bold text-slate-800 text-base sm:text-lg">Jurnal Mengajar Guru</h2>
              <p class="text-xs text-slate-500">Terhubung langsung dengan sesi absensi mengajar</p>
            </div>
          </div>

          <button id="btn-back-to-absen" class="text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 transition">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>Buka Form Absen</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Pilih Kelas (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Kelas</label>
            ${renderClassComboboxHTML({
              id: 'jurnal-select-kelas',
              kelasList,
              selectedId: currentKelasId
            })}
          </div>

          <!-- Pilih Mapel (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Mata Pelajaran</label>
            ${renderMapelComboboxHTML({
              id: 'jurnal-select-mapel',
              mapelList,
              selectedValue: currentMapel,
              size: 'md',
              allowManage: true
            })}
          </div>

          <!-- Pilih Tanggal -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal</label>
            ${renderDatePickerHTML({
              id: 'jurnal-input-tanggal',
              value: currentTanggal,
              includeDayName: true
            })}
          </div>
        </div>
      </div>

      <!-- Ringkasan Kehadiran Sesi Otomatis -->
      <div class="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span class="text-xs font-medium text-teal-300 uppercase tracking-wider">Rekap Kehadiran Sesi Terkoneksi</span>
          <p class="text-sm font-semibold mt-0.5 text-slate-100">
            ${selectedKelasObj?.nama_kelas || 'Kelas'} • ${currentMapel} (${currentTanggal})
          </p>
          ${attendanceSummary.listIzinSakit.length > 0 ? `
            <p class="text-xs text-amber-300 mt-1 font-medium">
              Ketidakhadiran: ${attendanceSummary.listIzinSakit.join(', ')}
            </p>
          ` : `
            <p class="text-xs text-emerald-300 mt-1">Semua siswa tercatat hadir.</p>
          `}
        </div>

        <div class="flex items-center gap-2 text-xs font-bold">
          <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
            Hadir: ${attendanceSummary.hadir} / ${attendanceSummary.total}
          </span>
          ${attendanceSummary.sakit > 0 ? `<span class="bg-amber-500/20 text-amber-300 px-2.5 py-1.5 rounded-xl">S: ${attendanceSummary.sakit}</span>` : ''}
          ${attendanceSummary.izin > 0 ? `<span class="bg-sky-500/20 text-sky-300 px-2.5 py-1.5 rounded-xl">I: ${attendanceSummary.izin}</span>` : ''}
          ${attendanceSummary.alfa > 0 ? `<span class="bg-rose-500/20 text-rose-300 px-2.5 py-1.5 rounded-xl">A: ${attendanceSummary.alfa}</span>` : ''}
        </div>
      </div>

      <!-- Form Pengisian Jurnal Mengajar -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
        
        <!-- Materi Pokok -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Materi Pokok / Capaian Pembelajaran <span class="text-rose-500">*</span>
          </label>
          <input type="text" id="jurnal-materi" value="${existingJurnal?.materi_pokok || ''}" placeholder="Contoh: Konfigurasi VLAN & Trunking pada Switch Cisco" class="w-full text-sm font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
        </div>

        <!-- Uraian Kegiatan Pembelajaran -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Uraian Kegiatan Pembelajaran / Praktik
          </label>
          <textarea id="jurnal-kegiatan" rows="4" placeholder="Deskripsikan tahapan pembelajaran (Pendahuluan, Penjelasan Konsep, Praktik Mandiri/Kelompok di Lab, Evaluasi)..." class="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition leading-relaxed">${existingJurnal?.kegiatan_pembelajaran || ''}</textarea>
        </div>

        <!-- Kendala / Refleksi Guru -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Kendala / Catatan Refleksi Guru Mapel
          </label>
          <textarea id="jurnal-kendala" rows="3" placeholder="Catatan kendala teknis, respon siswa, tindak lanjut remedial, atau apresiasi kelas..." class="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition leading-relaxed">${existingJurnal?.kendala_refleksi || ''}</textarea>
        </div>

        <!-- Tombol Aksi -->
        <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs text-slate-400" id="jurnal-status-text">
            ${existingJurnal ? `Terakhir disimpan: ${new Date(existingJurnal.updated_at || Date.now()).toLocaleTimeString('id-ID')}` : 'Jurnal belum disimpan'}
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-clear-jurnal-form" type="button" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition" title="Kosongkan seluruh isian jurnal">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-slate-500"></i>
              <span>Kosongkan Form</span>
            </button>

            <button id="btn-print-jurnal" type="button" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition">
              <i data-lucide="printer" class="w-4 h-4"></i>
              <span>Cetak Lembar Jurnal</span>
            </button>

            <button id="btn-save-jurnal" type="button" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition transform active:scale-95">
              <i data-lucide="save" class="w-4 h-4"></i>
              <span>Simpan Jurnal Mengajar</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  `;

  // Bind Events Filter Sesi
  const selKelas = container.querySelector('#jurnal-select-kelas');
  const selMapel = container.querySelector('#jurnal-select-mapel');
  const inpTanggal = container.querySelector('#jurnal-input-tanggal');

  initDatePicker(container, {
    id: 'jurnal-input-tanggal',
    value: currentTanggal,
    onChange: (newDate) => {
      onStateChange({
        currentKelasId: selKelas?.value || currentKelasId,
        currentMapel: selMapel?.value || currentMapel,
        currentTanggal: newDate
      });
    }
  });

  initClassCombobox(container, {
    id: 'jurnal-select-kelas',
    kelasList,
    selectedId: currentKelasId,
    onSelect: async (newKId) => {
      const newMapelList = await db.getMapelSaya(currentYear, newKId);
      const newMapel = newMapelList.some(m => m.nama_mapel === currentMapel)
        ? currentMapel
        : (newMapelList[0]?.nama_mapel || '');

      onStateChange({
        currentKelasId: newKId,
        currentMapel: newMapel,
        currentTanggal: inpTanggal?.value || currentTanggal
      });
    }
  });

  initMapelCombobox(container, {
    id: 'jurnal-select-mapel',
    mapelList,
    selectedValue: currentMapel,
    size: 'md',
    allowManage: true,
    onSelect: (newMapel) => {
      onStateChange({
        currentKelasId: selKelas?.value || currentKelasId,
        currentMapel: newMapel,
        currentTanggal: inpTanggal?.value || currentTanggal
      });
    },
    onManage: () => {
      if (onOpenModal) onOpenModal('mapel');
    }
  });

  inpTanggal?.addEventListener('change', () => {
    onStateChange({
      currentKelasId: selKelas?.value || currentKelasId,
      currentMapel: selMapel?.value || currentMapel,
      currentTanggal: inpTanggal.value
    });
  });

  container.querySelector('#jurnal-btn-manage-mapel')?.addEventListener('click', () => {
    if (onOpenModal) onOpenModal('mapel');
  });

  const triggerEditJurnalMapel = () => {
    if (onOpenModal) onOpenModal('edit-mapel', selMapel?.value || currentMapel);
  };
  container.querySelector('#jurnal-btn-edit-mapel')?.addEventListener('click', triggerEditJurnalMapel);
  container.querySelector('#jurnal-btn-icon-edit-mapel')?.addEventListener('click', triggerEditJurnalMapel);

  container.querySelector('#btn-back-to-absen')?.addEventListener('click', () => {
    onNavigateToAbsen();
  });

  // Tombol Kosongkan Form Manual
  container.querySelector('#btn-clear-jurnal-form')?.addEventListener('click', () => {
    const inputMateri = container.querySelector('#jurnal-materi');
    const inputKegiatan = container.querySelector('#jurnal-kegiatan');
    const inputKendala = container.querySelector('#jurnal-kendala');
    if (inputMateri) inputMateri.value = '';
    if (inputKegiatan) inputKegiatan.value = '';
    if (inputKendala) inputKendala.value = '';
    showToast('Form jurnal telah dikosongkan', 'info');
  });

  // Save Jurnal & Otomatis Bersihkan Form
  container.querySelector('#btn-save-jurnal')?.addEventListener('click', async () => {
    const inputMateri = container.querySelector('#jurnal-materi');
    const inputKegiatan = container.querySelector('#jurnal-kegiatan');
    const inputKendala = container.querySelector('#jurnal-kendala');

    const materi = inputMateri?.value.trim() || '';
    const kegiatan = inputKegiatan?.value.trim() || '';
    const kendala = inputKendala?.value.trim() || '';

    if (!materi) {
      showToast('Harap isi materi pokok pembelajaran!', 'error');
      return;
    }

    const sesiData = {
      id: existingSesi?.id || null,
      kelas_id: currentKelasId,
      mapel: currentMapel,
      tanggal: currentTanggal,
    };

    const jurnalData = {
      materi_pokok: materi,
      kegiatan_pembelajaran: kegiatan,
      kendala_refleksi: kendala
    };

    // Ambil absensi list yang sudah ada di sesi jika ada
    const absensiList = existingSesi?.absensi || [];

    const saveBtn = container.querySelector('#btn-save-jurnal');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Menyimpan...</span>`;
    if (window.lucide) window.lucide.createIcons();

    const res = await db.saveSesi({ sesiData, absensiList, jurnalData });
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Jurnal Mengajar</span>`;
    if (window.lucide) window.lucide.createIcons();

    if (res.success) {
      // 1. Bersihkan seluruh field input form secara otomatis
      if (inputMateri) inputMateri.value = '';
      if (inputKegiatan) inputKegiatan.value = '';
      if (inputKendala) inputKendala.value = '';

      // 2. Update teks status
      const statusText = container.querySelector('#jurnal-status-text');
      if (statusText) statusText.innerHTML = `✓ Tersimpan pukul ${new Date().toLocaleTimeString('id-ID')} & form siap untuk sesi berikutnya`;

      showToast('Jurnal mengajar berhasil disimpan! Form otomatis dibersihkan ✨', 'success');
    } else {
      showToast('Gagal menyimpan jurnal: ' + res.message, 'error');
    }
  });

  // Cetak Lembar Jurnal
  container.querySelector('#btn-print-jurnal')?.addEventListener('click', () => {
    const materi = container.querySelector('#jurnal-materi').value.trim() || '-';
    const kegiatan = container.querySelector('#jurnal-kegiatan').value.trim() || '-';
    const kendala = container.querySelector('#jurnal-kendala').value.trim() || '-';
    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Jurnal Mengajar - ${selectedKelasObj?.nama_kelas} (${currentTanggal})</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 16px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 13px; font-weight: bold; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .meta-table td { padding: 6px 10px; border: 1px solid #ddd; }
            .meta-table .label { font-weight: bold; background: #f8fafc; width: 22%; }
            .section-title { font-weight: bold; font-size: 13px; margin: 15px 0 5px; text-transform: uppercase; color: #047857; }
            .content-box { border: 1px solid #cbd5e1; padding: 12px; min-height: 70px; border-radius: 6px; white-space: pre-wrap; line-height: 1.5; }
            .footer-sign { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; }
            .sign-col { text-align: center; width: 40%; }
            .sign-space { height: 70px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${school.logo_url ? `<img src="${school.logo_url}" style="position: absolute; left: 0; top: 0; width: 55px; height: 55px; object-fit: contain;">` : ''}
            <div style="${school.logo_url ? 'padding: 0 60px;' : ''}">
              <h2>${school.instansi_induk || 'PEMERINTAH PROVINSI SULAWESI SELATAN'}</h2>
              <h3>${school.dinas ? school.dinas + ' • ' : ''}${school.nama_sekolah || 'SMKN 1 BANTAENG'}</h3>
              <p class="address">${school.alamat || ''} ${school.telepon ? '• Telp: ' + school.telepon : ''} ${school.website ? '• Web: ' + school.website : ''}</p>
              <p class="title">Jurnal Pembelajaran & Catatan Mengajar Guru Mata Pelajaran</p>
            </div>
          </div>

          <table class="meta-table">
            <tr>
              <td class="label">Nama Guru</td>
              <td>${profil.nama_guru || 'Guru Mapel'}</td>
              <td class="label">Mata Pelajaran</td>
              <td>${currentMapel}</td>
            </tr>
            <tr>
              <td class="label">Kelas / Jurusan</td>
              <td>${selectedKelasObj?.nama_kelas || 'Kelas'} (${selectedKelasObj?.jurusan || 'Kejuruan'})</td>
              <td class="label">Hari, Tanggal</td>
              <td>${currentTanggal}</td>
            </tr>
            <tr>
              <td class="label">Kehadiran Siswa</td>
              <td colspan="3">Hadir: ${attendanceSummary.hadir} | Sakit: ${attendanceSummary.sakit} | Izin: ${attendanceSummary.izin} | Alfa: ${attendanceSummary.alfa} (${attendanceSummary.total} Siswa)</td>
            </tr>
          </table>

          <div class="section-title">A. MATERI POKOK / CAPAIAN PEMBELAJARAN</div>
          <div class="content-box">${materi}</div>

          <div class="section-title">B. URAIAN KEGIATAN PEMBELAJARAN</div>
          <div class="content-box">${kegiatan}</div>

          <div class="section-title">C. KENDALA / REFLEKSI GURU MAPEL</div>
          <div class="content-box">${kendala}</div>

          <div class="footer-sign">
            <div class="sign-col">
              <p>Mengetahui,<br>Kepala Sekolah / Wakasek</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_kepsek || 'Kepala Sekolah'}</strong></u><br>${profil.nip_kepsek ? 'NIP. ' + profil.nip_kepsek : 'NIP. -'}</p>
            </div>
            <div class="sign-col">
              <p>${profil.kota || 'Bantaeng'}, ${currentTanggal}<br>Guru Mata Pelajaran</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_guru || 'Guru Mapel'}</strong></u><br>${profil.nip_guru ? 'NIP. ' + profil.nip_guru : 'NIP. -'}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  });

  if (window.lucide) window.lucide.createIcons();
}
