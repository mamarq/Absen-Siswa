// components/JadwalMengajarView.js - Modul Jadwal Mengajar Rutin Mingguan Guru
import { db } from '../supabase-client.js';
import { renderHariComboboxHTML, initHariCombobox, HARI_OPTIONS } from './HariCombobox.js';
import { renderJadwalModal } from './JadwalModal.js';

export async function renderJadwalMengajarView(container, state, onNavigate, showToast, onOpenModal) {
  const currentAcademicYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  let filterHari = 'semua'; // 'semua' | 'Senin' | 'Selasa' | ...

  const [kelasList, mapelList, jamMasterList] = await Promise.all([
    db.getClassesByYear(currentAcademicYear, false),
    db.getMataPelajaran(),
    db.getJamPelajaranMaster()
  ]);

  async function loadJadwal() {
    return await db.getJadwalMengajarList({
      academic_year: currentAcademicYear,
      hari: filterHari === 'semua' ? undefined : filterHari
    });
  }

  async function render() {
    const jadwalList = await loadJadwal();
    const totalJP = jadwalList.reduce((acc, curr) => acc + (Number(curr.jumlah_jp) || 1), 0);
    const totalSesi = jadwalList.length;

    // Group jadwal by day (Senin s.d. Sabtu)
    const groupedByDay = {};
    HARI_OPTIONS.forEach(h => {
      groupedByDay[h.value] = [];
    });

    jadwalList.forEach(j => {
      if (groupedByDay[j.hari]) {
        groupedByDay[j.hari].push(j);
      } else {
        groupedByDay[j.hari] = [j];
      }
    });

    // Sort items in each day by jam_mulai
    Object.keys(groupedByDay).forEach(day => {
      groupedByDay[day].sort((a, b) => (a.jam_mulai || '').localeCompare(b.jam_mulai || ''));
    });

    container.innerHTML = `
      <div class="space-y-6 pb-24 max-w-7xl mx-auto">
        
        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-5 sm:p-7 rounded-3xl shadow-sm border border-emerald-700/50 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div class="flex items-center gap-4">
            <div class="p-3.5 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30 flex-shrink-0">
              <i data-lucide="calendar-clock" class="w-8 h-8"></i>
            </div>
            <div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <h2 class="font-black text-xl sm:text-2xl tracking-tight">Jadwal Mengajar Guru</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase">
                  Tahun Ajaran ${currentAcademicYear}
                </span>
              </div>
              <p class="text-xs text-emerald-100/80 mt-1 max-w-xl">
                Jadwal rutin KBM mingguan per kelas dan mata pelajaran. Terintegrasi dengan saran absensi harian dan lembar cetak administrasi mengajar.
              </p>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex items-center gap-2.5 flex-wrap flex-shrink-0">
            <button
              id="btn-reset-jadwal"
              class="px-3.5 py-2.5 ${totalSesi === 0 ? 'opacity-40 cursor-not-allowed bg-rose-500/10 text-rose-300 border-rose-400/20' : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white border-rose-400/30 active:scale-95'} font-bold text-xs rounded-xl border transition flex items-center gap-1.5 backdrop-blur-xs"
              ${totalSesi === 0 ? 'disabled' : ''}
              title="${totalSesi === 0 ? 'Belum ada jadwal yang tersimpan' : 'Kosongkan Seluruh Jadwal Mengajar'}"
            >
              <i data-lucide="trash-2" class="w-4 h-4 text-rose-300"></i>
              <span>Reset Jadwal</span>
            </button>

            <button
              id="btn-print-jadwal"
              class="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-2 backdrop-blur-xs"
            >
              <i data-lucide="printer" class="w-4 h-4 text-emerald-300"></i>
              <span>Cetak Lembar Jadwal</span>
            </button>

            <button
              id="btn-add-jadwal"
              class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950/20 transition flex items-center gap-2"
            >
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Tambah Jadwal</span>
            </button>
          </div>
        </div>

        <!-- Filter & Statistics Bar -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div class="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
                <i data-lucide="clock" class="w-5 h-5"></i>
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Beban Ajar</span>
                <span class="text-base font-black text-slate-800 dark:text-slate-100">${totalJP} Jam Pelajaran (JP)</span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold text-[10px]">/ Minggu</span>
          </div>

          <div class="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold">
                <i data-lucide="layers" class="w-5 h-5"></i>
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Pertemuan</span>
                <span class="text-base font-black text-slate-800 dark:text-slate-100">${totalSesi} Slot Mengajar</span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">Aktif</span>
          </div>

          <!-- Filter Hari -->
          <div class="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 pl-2 flex-shrink-0">Tampilkan:</span>
            <div class="flex-1">
              ${renderHariComboboxHTML({
                id: 'jadwal-filter-hari',
                selectedValue: filterHari,
                allowAll: true,
                allLabel: 'Semua Hari (Senin - Sabtu)',
                size: 'sm'
              })}
            </div>
          </div>

        </div>

        <!-- Weekly Grid Layout (Senin s.d. Sabtu) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${HARI_OPTIONS.filter(h => filterHari === 'semua' || filterHari.toLowerCase() === h.value.toLowerCase()).map(h => {
            const slots = groupedByDay[h.value] || [];
            const dayJP = slots.reduce((acc, curr) => acc + (Number(curr.jumlah_jp) || 1), 0);

            return `
              <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
                
                <!-- Day Header -->
                <div class="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full ${h.color}"></span>
                    <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm">${h.label}</h3>
                  </div>
                  <span class="px-2 py-0.5 rounded-full ${slots.length > 0 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'} text-[10px] font-black">
                    ${slots.length} Sesi (${dayJP} JP)
                  </span>
                </div>

                <!-- Schedule Cards -->
                <div class="p-3 space-y-2.5 flex-1 ${slots.length === 0 ? 'flex items-center justify-center min-h-[140px]' : ''}">
                  ${slots.length === 0 ? `
                    <div class="text-center py-6 text-slate-400 dark:text-slate-500 text-xs space-y-1">
                      <i data-lucide="coffee" class="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600"></i>
                      <p class="font-medium">Tidak ada jadwal mengajar di hari ini.</p>
                    </div>
                  ` : slots.map(slot => {
                    const mulaiTrim = (slot.jam_mulai || '').substring(0, 5);
                    const selesaiTrim = (slot.jam_selesai || '').substring(0, 5);

                    return `
                      <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500 hover:shadow-md transition group/slot relative space-y-2">
                        
                        <div class="flex items-start justify-between gap-2">
                          <div>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black">
                              <i data-lucide="clock" class="w-3 h-3 text-emerald-600 dark:text-emerald-400"></i>
                              <span>${slot.jam_ke_label || 'Jam KBM'} (${mulaiTrim} - ${selesaiTrim})</span>
                            </span>
                          </div>

                          <!-- Action Buttons (Edit / Delete) -->
                          <div class="flex items-center gap-1 opacity-80 group-hover/slot:opacity-100 transition">
                            <button
                              class="btn-edit-jadwal p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition"
                              data-id="${slot.id}"
                              title="Edit Jadwal"
                            >
                              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                            </button>
                            <button
                              class="btn-delete-jadwal p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition"
                              data-id="${slot.id}"
                              title="Hapus Jadwal"
                            >
                              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                          </div>
                        </div>

                        <!-- Class & Subject Info -->
                        <div class="space-y-0.5">
                          <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                            <i data-lucide="graduation-cap" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0"></i>
                            <span class="truncate">${slot.nama_kelas || 'Kelas'}</span>
                          </h4>
                          <p class="text-xs font-bold text-teal-800 dark:text-teal-300 pl-5 truncate">${slot.mapel || 'Mata Pelajaran'}</p>
                        </div>

                        <!-- Footer: JP & Ruangan -->
                        <div class="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          <span class="flex items-center gap-1">
                            <i data-lucide="hourglass" class="w-3 h-3 text-slate-400 dark:text-slate-500"></i>
                            <span>${slot.jumlah_jp || 1} Jam Pelajaran</span>
                          </span>
                          ${slot.ruangan ? `
                            <span class="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700">
                              <i data-lucide="map-pin" class="w-3 h-3 text-amber-500 dark:text-amber-400"></i>
                              <span class="truncate max-w-[120px]">${slot.ruangan}</span>
                            </span>
                          ` : ''}
                        </div>

                      </div>
                    `;
                  }).join('')}
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Attach Filter Listener
    initHariCombobox(container, {
      id: 'jadwal-filter-hari',
      selectedValue: filterHari,
      onSelect: (hVal) => {
        filterHari = hVal;
        render();
      }
    });

    // Add Jadwal Trigger
    container.querySelector('#btn-add-jadwal')?.addEventListener('click', () => {
      renderJadwalModal({
        kelasList,
        mapelList,
        jamMasterList,
        academicYear: currentAcademicYear,
        onSave: () => render(),
        showToast
      });
    });

    // Edit Jadwal Trigger
    container.querySelectorAll('.btn-edit-jadwal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = jadwalList.find(j => j.id === id);
        if (item) {
          renderJadwalModal({
            kelasList,
            mapelList,
            jamMasterList,
            initialData: item,
            academicYear: currentAcademicYear,
            onSave: () => render(),
            showToast
          });
        }
      });
    });

    // Delete Jadwal Trigger
    container.querySelectorAll('.btn-delete-jadwal').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Apakah Anda yakin ingin menghapus slot jadwal mengajar ini?')) {
          await db.deleteJadwalMengajar(id);
          showToast('Slot jadwal berhasil dihapus', 'success');
          render();
        }
      });
    });

    // Print Jadwal Trigger
    container.querySelector('#btn-print-jadwal')?.addEventListener('click', async () => {
      const [schoolSettings, profilGuru] = await Promise.all([
        db.getSchoolSettings(),
        db.getProfilGuru()
      ]);

      printJadwalMengajar({
        jadwalList,
        groupedByDay,
        academicYear: currentAcademicYear,
        schoolSettings,
        profilGuru,
        totalJP
      });
    });

    // Reset Jadwal Trigger (With Type-to-Confirm "RESET" Security)
    container.querySelector('#btn-reset-jadwal')?.addEventListener('click', () => {
      if (totalSesi === 0) return;
      openResetConfirmModal();
    });

    function openResetConfirmModal() {
      const modalId = 'modal-reset-jadwal-confirm';
      const existingModal = document.getElementById(modalId);
      if (existingModal) existingModal.remove();

      const modalEl = document.createElement('div');
      modalEl.id = modalId;
      modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in';
      modalEl.innerHTML = `
        <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 text-slate-800 dark:text-slate-100 transform animate-scale-up">
          
          <!-- Header with Warning Icon -->
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-200 dark:border-rose-900">
              <i data-lucide="alert-triangle" class="w-6 h-6"></i>
            </div>
            <div class="space-y-1">
              <h3 class="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                Reset Semua Jadwal Mengajar?
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Tindakan ini akan <strong>menghapus permanen seluruh (${totalSesi}) slot jadwal mengajar</strong> yang tersimpan saat ini.
              </p>
            </div>
          </div>

          <!-- Alert Context Box -->
          <div class="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-1.5 text-xs text-rose-800 dark:text-rose-300">
            <div class="flex items-center gap-1.5 font-bold">
              <i data-lucide="shield-alert" class="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0"></i>
              <span>Peringatan Destruktif</span>
            </div>
            <p class="text-[11px] leading-relaxed text-rose-700/90 dark:text-rose-300/90">
              Jadwal yang dihapus tidak dapat dipulihkan dan harus diinput ulang dari nol. Riwayat absensi, jurnal, dan nilai yang sudah pernah tersimpan sebelumnya tetap aman 100%.
            </p>
          </div>

          <!-- Type-to-Confirm Input -->
          <div class="space-y-2">
            <label for="input-confirm-reset-text" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Ketik kata <strong class="text-rose-600 dark:text-rose-400 select-all font-mono tracking-wider">RESET</strong> untuk mengonfirmasi:
            </label>
            <input
              type="text"
              id="input-confirm-reset-text"
              placeholder="Ketik RESET di sini..."
              autocomplete="off"
              class="w-full h-11 px-3.5 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none text-slate-900 dark:text-white uppercase tracking-wider transition"
            />
            <p id="reset-validation-hint" class="text-[11px] text-slate-400 font-medium">
              Tombol konfirmasi di bawah akan aktif otomatis setelah teks cocok.
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              id="btn-cancel-reset-modal"
              class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="button"
              id="btn-execute-reset-jadwal"
              disabled
              class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed text-xs font-black transition flex items-center gap-2 shadow-xs"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
              <span id="btn-execute-reset-label">Ya, Kosongkan Jadwal</span>
            </button>
          </div>

        </div>
      `;

      document.body.appendChild(modalEl);
      if (window.lucide) window.lucide.createIcons();

      const inputConfirm = modalEl.querySelector('#input-confirm-reset-text');
      const btnExecute = modalEl.querySelector('#btn-execute-reset-jadwal');
      const btnCancel = modalEl.querySelector('#btn-cancel-reset-modal');
      const hint = modalEl.querySelector('#reset-validation-hint');

      // Focus input
      setTimeout(() => inputConfirm?.focus(), 50);

      const closeModal = () => modalEl.remove();

      btnCancel?.addEventListener('click', closeModal);
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
      });

      // Escape key handler
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', handleKeyDown);
        }
      };
      document.addEventListener('keydown', handleKeyDown);

      // Reactive type-to-confirm validation
      inputConfirm?.addEventListener('input', (e) => {
        const val = (e.target.value || '').trim().toUpperCase();
        if (val === 'RESET') {
          btnExecute.disabled = false;
          btnExecute.className = 'px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-rose-600/30 cursor-pointer';
          hint.textContent = '✓ Kata kunci cocok. Anda dapat melanjutkan reset sekarang.';
          hint.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-bold';
        } else {
          btnExecute.disabled = true;
          btnExecute.className = 'px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed text-xs font-black transition flex items-center gap-2 shadow-xs';
          hint.textContent = 'Tombol konfirmasi di bawah akan aktif otomatis setelah teks cocok.';
          hint.className = 'text-[11px] text-slate-400 font-medium';
        }
      });

      // Enter key shortcut
      inputConfirm?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !btnExecute.disabled) {
          btnExecute.click();
        }
      });

      // Execution handler
      btnExecute?.addEventListener('click', async () => {
        const val = (inputConfirm.value || '').trim().toUpperCase();
        if (val !== 'RESET') return;

        btnExecute.disabled = true;
        btnExecute.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Mengosongkan...</span>`;
        if (window.lucide) window.lucide.createIcons();

        try {
          const res = await db.resetJadwalMengajar();
          if (res.success) {
            closeModal();
            showToast('Seluruh jadwal mengajar berhasil dikosongkan.', 'success');
            await render();
          } else {
            showToast('Gagal mereset jadwal: ' + (res.error || 'Terjadi kesalahan'), 'error');
            btnExecute.disabled = false;
            btnExecute.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i><span>Ya, Kosongkan Jadwal</span>`;
            if (window.lucide) window.lucide.createIcons();
          }
        } catch (err) {
          console.error(err);
          showToast('Terjadi kesalahan saat mereset jadwal', 'error');
          closeModal();
        }
      });
    }
  }

  await render();
}

/**
 * Print Engine untuk Lembar Jadwal Mengajar Guru Resmi
 */
function printJadwalMengajar({ jadwalList, groupedByDay, academicYear, schoolSettings, profilGuru, totalJP }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser. Izinkan pop-up untuk mencetak.');
    return;
  }

  const printHTML = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Jadwal Mengajar Guru - ${academicYear}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; margin: 0; line-height: 1.3; }
        .kop-table { width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #000; margin-bottom: 12px; }
        .kop-logo { width: 65px; height: 65px; object-fit: contain; }
        .kop-text { text-align: center; }
        .kop-instansi { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 0; }
        .kop-dinas { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 0; }
        .kop-sekolah { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 2px 0; }
        .kop-alamat { font-size: 9pt; margin: 0; }
        .title { text-align: center; font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 12px 0 4px 0; }
        .subtitle { text-align: center; font-size: 10pt; margin-bottom: 14px; }
        table.jadwal { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
        table.jadwal th, table.jadwal td { border: 1px solid #000; padding: 6px 8px; }
        table.jadwal th { background-color: #f0f0f0; text-align: center; font-weight: bold; text-transform: uppercase; }
        .text-center { text-align: center; }
        .text-bold { font-weight: bold; }
        .signature-table { width: 100%; margin-top: 25px; border-collapse: collapse; font-size: 10pt; page-break-inside: avoid; }
        .signature-table td { width: 50%; vertical-align: top; text-align: center; border: none; }
      </style>
    </head>
    <body>
      <table class="kop-table">
        <tr>
          ${schoolSettings?.logo_url ? `<td style="width: 75px; text-align: center; vertical-align: middle;"><img src="${schoolSettings.logo_url}" class="kop-logo" /></td>` : ''}
          <td class="kop-text">
            <p class="kop-instansi">${schoolSettings?.instansi_induk || 'Pemerintah Provinsi'}</p>
            <p class="kop-dinas">${schoolSettings?.dinas || 'Dinas Pendidikan'}</p>
            <h2 class="kop-sekolah">${schoolSettings?.nama_sekolah || 'Nama Sekolah'}</h2>
            <p class="kop-alamat">${schoolSettings?.alamat || ''} ${schoolSettings?.telepon ? 'Telp: ' + schoolSettings.telepon : ''}</p>
          </td>
        </tr>
      </table>

      <div class="title">JADWAL MENGAJAR GURU</div>
      <div class="subtitle">Tahun Ajaran: ${academicYear} • Guru: <strong>${profilGuru?.nama_guru || 'Guru Mata Pelajaran'}</strong></div>

      <table class="jadwal">
        <thead>
          <tr>
            <th style="width: 40px;">No</th>
            <th style="width: 80px;">Hari</th>
            <th style="width: 130px;">Jam Pelajaran</th>
            <th style="width: 90px;">Kelas</th>
            <th>Mata Pelajaran</th>
            <th style="width: 50px;">JP</th>
            <th style="width: 100px;">Ruangan</th>
          </tr>
        </thead>
        <tbody>
          ${jadwalList.length === 0 ? `
            <tr><td colspan="7" class="text-center" style="padding: 20px;">Belum ada jadwal mengajar tersimpan.</td></tr>
          ` : jadwalList.map((j, idx) => `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td class="text-center text-bold">${j.hari}</td>
              <td class="text-center">${j.jam_ke_label || 'Jam KBM'}<br><small>(${(j.jam_mulai || '').substring(0,5)} - ${(j.jam_selesai || '').substring(0,5)})</small></td>
              <td class="text-center text-bold">${j.nama_kelas || '-'}</td>
              <td>${j.mapel || '-'}</td>
              <td class="text-center text-bold">${j.jumlah_jp || 1}</td>
              <td class="text-center">${j.ruangan || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f9f9f9;">
            <td colspan="5" class="text-bold" style="text-align: right; padding-right: 12px;">TOTAL BEBAN MENGAJAR PER MINGGU:</td>
            <td class="text-center text-bold">${totalJP}</td>
            <td>JP</td>
          </tr>
        </tfoot>
      </table>

      <table class="signature-table">
        <tr>
          <td>
            Mengetahui,<br>Kepala Sekolah<br><br><br><br><br>
            <strong><u>${profilGuru?.nama_kepsek || 'Nama Kepala Sekolah'}</u></strong><br>
            NIP. ${profilGuru?.nip_kepsek || '....................................'}
          </td>
          <td>
            ${profilGuru?.kota || 'Kota'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>
            Guru Mata Pelajaran<br><br><br><br><br>
            <strong><u>${profilGuru?.nama_guru || 'Nama Guru Mata Pelajaran'}</u></strong><br>
            NIP. ${profilGuru?.nip_guru || '....................................'}
          </td>
        </tr>
      </table>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(printHTML);
  printWindow.document.close();
}
