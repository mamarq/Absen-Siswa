// components/JadwalModal.js - Modal Tambah & Edit Slot Jadwal Mengajar Guru
import { db } from '../supabase-client.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
import { renderHariComboboxHTML, initHariCombobox } from './HariCombobox.js';
import { renderJamPelajaranComboboxHTML, initJamPelajaranCombobox } from './JamPelajaranCombobox.js';

export function renderJadwalModal({
  kelasList = [],
  mapelList = [],
  jamMasterList = [],
  initialData = null,
  academicYear = '',
  onSave = () => {},
  showToast = () => {}
} = {}) {
  // Remove existing modal if any
  const existing = document.getElementById('modal-jadwal-wrapper');
  if (existing) existing.remove();

  const isEdit = Boolean(initialData && initialData.id);
  const defaultHari = initialData?.hari || 'Senin';
  let selectedHari = defaultHari;

  let selectedKelasId = initialData?.kelas_id || kelasList[0]?.id || '';
  let selectedMapel = initialData?.mapel || mapelList[0]?.nama_mapel || 'Informatika';
  let selectedMapelId = initialData?.mapel_id || mapelList.find(m => m.nama_mapel === selectedMapel)?.id || null;

  // Initial Jam Selection
  let selectedJamMulaiObj = jamMasterList.find(j => j.id === initialData?.jam_mulai_id) || jamMasterList[0] || { id: 'jp-1', nomor_urut: 1, label: 'Jam ke-1', jam_mulai: '07:30', jam_selesai: '08:15' };
  let selectedJamSelesaiObj = jamMasterList.find(j => j.id === initialData?.jam_selesai_id) || (jamMasterList[1] || selectedJamMulaiObj);

  const modalEl = document.createElement('div');
  modalEl.id = 'modal-jadwal-wrapper';
  modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150';

  let currentRuangan = initialData?.ruangan || '';
  let currentEffectiveFrom = initialData?.effective_from || (new Date().toISOString().slice(0, 10));

  function calculateSummary(mulaiObj, selesaiObj) {
    const urutMulai = mulaiObj?.nomor_urut || 1;
    const urutSelesai = selesaiObj?.nomor_urut || urutMulai;
    const isValid = urutSelesai >= urutMulai;

    // Ambil seluruh slot dalam rentang nomor urut [urutMulai, urutSelesai]
    const slotsInRange = (jamMasterList || []).filter(j =>
      Number(j.nomor_urut) >= urutMulai && Number(j.nomor_urut) <= urutSelesai
    );
    const teachingSlots = slotsInRange.filter(j => j.tipe_slot !== 'istirahat');
    const istirahatSlots = slotsInRange.filter(j => j.tipe_slot === 'istirahat');

    const jumlahJP = isValid ? teachingSlots.length : 0;
    const hasIstirahat = istirahatSlots.length > 0;

    const label = urutMulai === urutSelesai
      ? mulaiObj?.label || `Jam ke-${urutMulai}`
      : `Jam ke-${urutMulai} s.d. ${urutSelesai}`;
    const timeStr = `${(mulaiObj?.jam_mulai || '').substring(0, 5)} - ${(selesaiObj?.jam_selesai || '').substring(0, 5)}`;
    return {
      urutMulai,
      urutSelesai,
      isValid,
      jumlahJP,
      hasIstirahat,
      istirahatCount: istirahatSlots.length,
      label,
      timeStr
    };
  }

  function renderContent() {
    // Preserve input values before re-rendering if inputs exist in DOM
    const existingRuangan = modalEl.querySelector('#input-jadwal-ruangan')?.value;
    if (existingRuangan !== undefined) currentRuangan = existingRuangan;
    const existingEff = modalEl.querySelector('#input-jadwal-effective-from')?.value;
    if (existingEff !== undefined) currentEffectiveFrom = existingEff;

    const summary = calculateSummary(selectedJamMulaiObj, selectedJamSelesaiObj);

    modalEl.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">

        <!-- Header (Fixed / Flex-shrink-0) -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 sm:px-6 sm:py-4.5 flex-shrink-0 bg-white dark:bg-slate-900">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl ${isEdit ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'} flex items-center justify-center font-bold flex-shrink-0">
              <i data-lucide="${isEdit ? 'edit-3' : 'plus-circle'}" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg leading-snug">
                ${isEdit ? 'Edit Slot Jadwal Mengajar' : 'Tambah Slot Jadwal Mengajar'}
              </h3>
              <p class="text-[11px] text-slate-400 dark:text-slate-500">Tahun Ajaran: <strong>${academicYear}</strong></p>
            </div>
          </div>
          <button type="button" id="btn-close-modal-jadwal" class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Tutup">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Form with Scrollable Body & Sticky Bottom Footer -->
        <form id="form-jadwal" class="flex flex-col flex-1 min-h-0 overflow-hidden m-0 p-0">

          <!-- Scrollable Body Container -->
          <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4 custom-scrollbar">

            <!-- Pilihan Hari -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Hari <span class="text-rose-500">*</span></label>
              ${renderHariComboboxHTML({
                id: 'jadwal-form-hari',
                selectedValue: selectedHari,
                size: 'md'
              })}
            </div>

            <!-- Pilihan Kelas & Mapel (2 Kolom) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kelas / Rombel <span class="text-rose-500">*</span></label>
                ${renderClassComboboxHTML({
                  id: 'jadwal-form-kelas',
                  kelasList,
                  selectedId: selectedKelasId,
                  size: 'md'
                })}
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mata Pelajaran <span class="text-rose-500">*</span></label>
                ${renderMapelComboboxHTML({
                  id: 'jadwal-form-mapel',
                  mapelList,
                  selectedValue: selectedMapel,
                  size: 'md'
                })}
              </div>
            </div>

            <!-- Pilihan Jam Mulai & Jam Selesai (2 Kolom) -->
            <div class="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <i data-lucide="clock" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                  <span>Rentang Jam Pelajaran (JP)</span>
                </span>
                <span id="jadwal-jp-badge" class="px-2 py-0.5 rounded-full ${summary.isValid ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'} text-[10px] font-black">
                  ${summary.isValid ? `${summary.jumlahJP} JP (${summary.timeStr})` : 'Rentang Tidak Valid'}
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Jam Mulai</label>
                  ${renderJamPelajaranComboboxHTML({
                    id: 'jadwal-form-jam-mulai',
                    jamList: jamMasterList,
                    selectedId: selectedJamMulaiObj?.id,
                    size: 'sm'
                  })}
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Jam Selesai</label>
                  ${renderJamPelajaranComboboxHTML({
                    id: 'jadwal-form-jam-selesai',
                    jamList: jamMasterList,
                    selectedId: selectedJamSelesaiObj?.id,
                    size: 'sm'
                  })}
                </div>
              </div>

              ${summary.isValid && summary.hasIstirahat ? `
                <div class="text-[10px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                  <i data-lucide="info" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0"></i>
                  <span>Rentang melewati <strong>${summary.istirahatCount} slot istirahat</strong>. Total dihitung bersih: <strong>${summary.jumlahJP} JP</strong>.</span>
                </div>
              ` : ''}

              <div id="jadwal-error-jam" class="${summary.isValid ? 'hidden' : 'block'} text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-1">
                <i data-lucide="alert-circle" class="w-3.5 h-3.5 flex-shrink-0"></i>
                <span>Jam Selesai tidak boleh lebih awal dari Jam Mulai!</span>
              </div>
            </div>

            <!-- Ruangan / Lokasi (Opsional) -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ruangan / Lab (Opsional)</label>
              <div class="relative">
                <i data-lucide="map-pin" class="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none"></i>
                <input
                  type="text"
                  id="input-jadwal-ruangan"
                  value="${currentRuangan}"
                  placeholder="Contoh: Lab Komputer 1, Ruang Teori 3"
                  class="w-full pl-9 pr-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <!-- Tanggal Mulai Berlaku -->
            <div class="pb-2">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tanggal Mulai Berlaku <span class="text-rose-500">*</span>
              </label>
              <input
                type="date"
                id="input-jadwal-effective-from"
                value="${currentEffectiveFrom}"
                class="w-full px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                required
              />
              ${isEdit ? `
                <div class="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <i data-lucide="info" class="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"></i>
                  <span>Perubahan akan berlaku mulai tanggal ini. Jadwal sebelumnya tetap tersimpan untuk riwayat.</span>
                </div>
              ` : `
                <p class="text-[10px] text-slate-400 mt-1">Jadwal ini akan aktif untuk tanggal pada atau setelah tanggal mulai berlaku.</p>
              `}
            </div>

          </div>

          <!-- Footer / Action Bar (Fixed at Bottom / Flex-shrink-0) -->
          <div class="flex items-center justify-end gap-2.5 px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-xs flex-shrink-0 rounded-b-3xl">
            <button
              type="button"
              id="btn-cancel-modal-jadwal"
              class="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              id="btn-submit-jadwal"
              class="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 ${summary.isValid ? '' : 'opacity-50 cursor-not-allowed'}"
              ${summary.isValid ? '' : 'disabled'}
            >
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>${isEdit ? 'Simpan Perubahan' : 'Tambah ke Jadwal'}</span>
            </button>
          </div>

        </form>

      </div>
    `;

    document.body.appendChild(modalEl);
    if (window.lucide) window.lucide.createIcons();

    // Attach Event Listeners
    initHariCombobox(modalEl, {
      id: 'jadwal-form-hari',
      selectedValue: selectedHari,
      onSelect: (h) => {
        selectedHari = h;
        renderContent();
      }
    });

    initClassCombobox(modalEl, {
      id: 'jadwal-form-kelas',
      kelasList,
      selectedId: selectedKelasId,
      onSelect: (kId) => {
        selectedKelasId = kId;
      }
    });

    initMapelCombobox(modalEl, {
      id: 'jadwal-form-mapel',
      mapelList,
      selectedValue: selectedMapel,
      onSelect: (mNama) => {
        selectedMapel = mNama;
        const mObj = mapelList.find(m => m.nama_mapel === mNama);
        selectedMapelId = mObj?.id || null;
      }
    });

    initJamPelajaranCombobox(modalEl, {
      id: 'jadwal-form-jam-mulai',
      jamList: jamMasterList,
      selectedId: selectedJamMulaiObj?.id,
      onSelect: (jObj) => {
        selectedJamMulaiObj = jObj;
        renderContent();
      }
    });

    initJamPelajaranCombobox(modalEl, {
      id: 'jadwal-form-jam-selesai',
      jamList: jamMasterList,
      selectedId: selectedJamSelesaiObj?.id,
      onSelect: (jObj) => {
        selectedJamSelesaiObj = jObj;
        renderContent();
      }
    });

    // Close Modal Listeners
    modalEl.querySelector('#btn-close-modal-jadwal')?.addEventListener('click', closeModal);
    modalEl.querySelector('#btn-cancel-modal-jadwal')?.addEventListener('click', closeModal);

    // Form Submit
    modalEl.querySelector('#form-jadwal')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentSum = calculateSummary(selectedJamMulaiObj, selectedJamSelesaiObj);
      if (!currentSum.isValid) {
        showToast('Jam Selesai tidak boleh lebih awal dari Jam Mulai!', 'error');
        return;
      }

      if (!selectedKelasId) {
        showToast('Pilih kelas terlebih dahulu!', 'warning');
        return;
      }

      const ruangan = modalEl.querySelector('#input-jadwal-ruangan')?.value.trim() || '';
      const effectiveFrom = modalEl.querySelector('#input-jadwal-effective-from')?.value || null;

      const payload = {
        id: initialData?.id || undefined,
        hari: selectedHari,
        kelas_id: selectedKelasId,
        mapel_id: selectedMapelId,
        mapel: selectedMapel,
        jam_mulai_id: selectedJamMulaiObj?.id,
        jam_selesai_id: selectedJamSelesaiObj?.id,
        nomor_urut_mulai: currentSum.urutMulai,
        nomor_urut_selesai: currentSum.urutSelesai,
        jam_ke_label: currentSum.label,
        jam_mulai: selectedJamMulaiObj?.jam_mulai || '07:30',
        jam_selesai: selectedJamSelesaiObj?.jam_selesai || '08:15',
        jumlah_jp: currentSum.jumlahJP,
        ruangan,
        academic_year: academicYear,
        effective_from: effectiveFrom
      };

      try {
        const res = await db.saveJadwalMengajar(payload);
        if (res.success) {
          showToast(isEdit ? 'Jadwal mengajar berhasil diperbarui!' : 'Jadwal mengajar berhasil ditambahkan!', 'success');
          closeModal();
          onSave();
        } else {
          showToast(res.error || 'Gagal menyimpan jadwal', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Operasi ditolak', 'error');
      }
    });
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  function handleBackdropClick(e) {
    if (e.target === modalEl) {
      closeModal();
    }
  }

  document.addEventListener('keydown', handleKeyDown);
  modalEl.addEventListener('click', handleBackdropClick);

  function closeModal() {
    document.removeEventListener('keydown', handleKeyDown);
    modalEl.remove();
  }

  renderContent();
}
