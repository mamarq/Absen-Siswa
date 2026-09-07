// components/LedgerConfigModal.js - Modal Pengaturan Komponen Bobot, KKM & Predikat Nilai Akhir
import { db } from '../supabase-client.js';

export function openLedgerConfigModal({
  kelasId,
  mapelId,
  mapelNama,
  academicYear,
  currentConfig,
  onSaved = () => {},
  showToast = () => {}
}) {
  let modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  }

  const compConfig = JSON.parse(JSON.stringify(currentConfig?.components_config || {
    kehadiran:      { active: true, weight: 15 },
    tugas_mandiri:  { active: true, weight: 20 },
    tugas_kelompok: { active: true, weight: 20 },
    pr:             { active: true, weight: 15 },
    ceklis:         { active: true, weight: 10 },
    sumatif_sts:    { active: true, weight: 10 },
    sumatif_sas:    { active: true, weight: 10 },
    sikap:          { active: false, weight: 0, bonus_per_item: 3, penalty_per_item: 3 }
  }));

  const predRanges = JSON.parse(JSON.stringify(currentConfig?.predikat_ranges || {
    A: 90, B: 80, C: 75, D: 0
  }));

  const currentKKM = currentConfig?.kkm || 75;

  const COMPONENT_LABELS = [
    { key: 'kehadiran', label: 'Kehadiran / Presensi', desc: 'Persentase kehadiran (Sakit/Izin dihitung 50%)', icon: 'calendar-check-2', color: 'emerald' },
    { key: 'tugas_mandiri', label: 'Tugas Mandiri / Harian', desc: 'Rata-rata nilai tugas individu reguler', icon: 'file-text', color: 'blue' },
    { key: 'tugas_kelompok', label: 'Tugas Kelompok', desc: 'Rata-rata nilai tugas kelompok kolaboratif', icon: 'users', color: 'teal' },
    { key: 'pr', label: 'Pekerjaan Rumah (PR)', desc: 'Rata-rata nilai evaluasi PR', icon: 'home', color: 'indigo' },
    { key: 'ceklis', label: 'Ceklis Catatan', desc: 'Persentase kelengkapan buku catatan siswa', icon: 'check-square', color: 'cyan' },
    { key: 'sumatif_sts', label: 'Sumatif Tengah Semester (STS)', desc: 'Nilai ujian/asesmen tengah semester', icon: 'award', color: 'amber' },
    { key: 'sumatif_sas', label: 'Sumatif Akhir Semester (SAS)', desc: 'Nilai ujian/asesmen akhir semester', icon: 'graduation-cap', color: 'rose' },
    { key: 'sikap', label: 'Sikap & Karakter', desc: 'Skor baseline 80 (+3 prestasi, -3 pelanggaran)', icon: 'heart', color: 'purple' }
  ];

  modalRoot.innerHTML = `
    <div id="modal-ledger-cfg" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full my-8 overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
        
        <!-- Header -->
        <div class="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-white/10 rounded-2xl border border-white/20">
              <i data-lucide="sliders" class="w-5 h-5 text-emerald-300"></i>
            </div>
            <div>
              <h3 class="font-extrabold text-base sm:text-lg">Atur Formula & Bobot Nilai Akhir</h3>
              <p class="text-xs text-emerald-200/90 font-medium">
                ${mapelNama || 'Mata Pelajaran'} • ${academicYear}
              </p>
            </div>
          </div>
          <button id="btn-close-ledger-cfg" class="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-xs">

          <!-- Section 1: Checklist & Bobot Komponen -->
          <div class="space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm">1. Pilih Komponen & Tentukan Bobot (%)</h4>
                <p class="text-[11px] text-slate-400 dark:text-slate-500">Centang komponen yang dihitung dan tentukan persentase bobotnya.</p>
              </div>
              <button type="button" id="btn-preset-default" class="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline">
                Gunakan Preset Standar
              </button>
            </div>

            <!-- Total Weight Live Indicator -->
            <div id="box-total-weight" class="p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition">
              <div class="flex items-center gap-2">
                <span id="icon-weight-status" class="w-3 h-3 rounded-full"></span>
                <span class="font-bold text-slate-700 dark:text-slate-200">Total Bobot Komponen Aktif:</span>
              </div>
              <div class="flex items-center gap-2">
                <span id="label-total-weight" class="text-base font-black">0%</span>
                <span id="badge-weight-status" class="px-2 py-0.5 rounded-md text-[10px] font-extrabold"></span>
              </div>
            </div>

            <!-- Components List Grid -->
            <div class="space-y-2 pt-1">
              ${COMPONENT_LABELS.map(comp => {
                const cfg = compConfig[comp.key] || { active: false, weight: 0 };
                return `
                  <div class="p-3 rounded-2xl border ${cfg.active ? 'bg-slate-50/90 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700' : 'bg-slate-50/40 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/60 opacity-60'} flex items-center justify-between gap-3 transition hover:border-emerald-300 dark:hover:border-emerald-700 group">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <input 
                        type="checkbox" 
                        id="chk-comp-${comp.key}" 
                        class="chk-comp-item w-4 h-4 text-emerald-600 rounded-md border-slate-300 dark:border-slate-600 focus:ring-emerald-500 cursor-pointer"
                        data-key="${comp.key}"
                        ${cfg.active ? 'checked' : ''}
                      >
                      <label for="chk-comp-${comp.key}" class="min-w-0 cursor-pointer select-none">
                        <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>${comp.label}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${comp.desc}</div>
                      </label>
                    </div>

                    <!-- Weight Input -->
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500">Bobot:</span>
                      <div class="relative">
                        <input 
                          type="number" 
                          id="input-weight-${comp.key}"
                          class="input-weight-item w-16 h-8 text-center font-black text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none ${!cfg.active ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600' : 'text-slate-800 dark:text-slate-100'}"
                          min="0"
                          max="100"
                          value="${cfg.weight || 0}"
                          data-key="${comp.key}"
                          ${!cfg.active ? 'disabled' : ''}
                        >
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-500 pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 2: KKM & Skala Rentang Predikat -->
          <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm">2. KKM & Skala Predikat (A, B, C, D)</h4>
              <p class="text-[11px] text-slate-400 dark:text-slate-500">Atur batas minimal nilai untuk tiap predikat kelulusan raport.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- KKM -->
              <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  KKM / Kriteria Ketuntasan Minimal
                </label>
                <div class="flex items-center gap-2">
                  <input 
                    type="number" 
                    id="input-ledger-kkm" 
                    value="${currentKKM}" 
                    min="0" 
                    max="100" 
                    class="w-full h-9 px-3 text-sm font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                  >
                  <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Poin</span>
                </div>
              </div>

              <!-- Predikat A, B, C, D Ranges -->
              <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Batas Minimal Nilai Tiap Predikat
                </label>
                
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">Predikat A (≥)</span>
                    <input 
                      type="number" 
                      id="input-pred-a" 
                      value="${predRanges.A ?? 90}" 
                      min="0" 
                      max="100" 
                      class="w-full h-8 text-center font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                    >
                  </div>
                  <div>
                    <span class="text-[10px] font-bold text-sky-700 dark:text-sky-400 block mb-0.5">Predikat B (≥)</span>
                    <input 
                      type="number" 
                      id="input-pred-b" 
                      value="${predRanges.B ?? 80}" 
                      min="0" 
                      max="100" 
                      class="w-full h-8 text-center font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                    >
                  </div>
                  <div>
                    <span class="text-[10px] font-bold text-amber-700 dark:text-amber-400 block mb-0.5">Predikat C (≥)</span>
                    <input 
                      type="number" 
                      id="input-pred-c" 
                      value="${predRanges.C ?? 75}" 
                      min="0" 
                      max="100" 
                      class="w-full h-8 text-center font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                    >
                  </div>
                </div>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Nilai di bawah Predikat C otomatis berpredikat <strong>D (Perlu Bimbingan)</strong>.</p>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 gap-3">
          <button 
            type="button" 
            id="btn-cancel-ledger-cfg" 
            class="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition"
          >
            Batal
          </button>

          <button 
            type="button" 
            id="btn-save-ledger-cfg" 
            class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Simpan Konfigurasi</span>
          </button>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.querySelector('#modal-ledger-cfg');
  const boxWeight = modalEl.querySelector('#box-total-weight');
  const labelTotalWeight = modalEl.querySelector('#label-total-weight');
  const badgeWeightStatus = modalEl.querySelector('#badge-weight-status');
  const iconWeightStatus = modalEl.querySelector('#icon-weight-status');
  const btnSave = modalEl.querySelector('#btn-save-ledger-cfg');

  function calculateTotalWeight() {
    let sum = 0;
    modalEl.querySelectorAll('.chk-comp-item').forEach(chk => {
      const key = chk.getAttribute('data-key');
      const input = modalEl.querySelector(`#input-weight-${key}`);
      if (chk.checked && input) {
        const val = parseInt(input.value) || 0;
        sum += val;
      }
    });

    labelTotalWeight.textContent = `${sum}%`;

    if (sum === 100) {
      boxWeight.className = 'p-3.5 rounded-2xl border bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 flex items-center justify-between gap-3 transition';
      labelTotalWeight.className = 'text-base font-black text-emerald-800 dark:text-emerald-300';
      badgeWeightStatus.className = 'px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700';
      badgeWeightStatus.textContent = 'PAS 100% (Valid)';
      iconWeightStatus.className = 'w-3 h-3 rounded-full bg-emerald-500 shadow-sm';
      btnSave.disabled = false;
    } else if (sum < 100) {
      boxWeight.className = 'p-3.5 rounded-2xl border bg-amber-50/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-center justify-between gap-3 transition';
      labelTotalWeight.className = 'text-base font-black text-amber-800 dark:text-amber-300';
      badgeWeightStatus.className = 'px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700';
      badgeWeightStatus.textContent = `Kurang ${100 - sum}% (Harus 100%)`;
      iconWeightStatus.className = 'w-3 h-3 rounded-full bg-amber-500 shadow-sm';
      btnSave.disabled = true;
    } else {
      boxWeight.className = 'p-3.5 rounded-2xl border bg-rose-50/80 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200 flex items-center justify-between gap-3 transition';
      labelTotalWeight.className = 'text-base font-black text-rose-800 dark:text-rose-300';
      badgeWeightStatus.className = 'px-2.5 py-0.5 rounded-md text-[10px] font-black bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700';
      badgeWeightStatus.textContent = `Lebih ${sum - 100}% (Harus 100%)`;
      iconWeightStatus.className = 'w-3 h-3 rounded-full bg-rose-500 shadow-sm';
      btnSave.disabled = true;
    }
  }

  // Checkbox toggle handler
  modalEl.querySelectorAll('.chk-comp-item').forEach(chk => {
    chk.addEventListener('change', () => {
      const key = chk.getAttribute('data-key');
      const input = modalEl.querySelector(`#input-weight-${key}`);
      const parentRow = chk.closest('.group');

      if (chk.checked) {
        input.disabled = false;
        input.classList.remove('bg-slate-100', 'dark:bg-slate-800/50', 'text-slate-400', 'dark:text-slate-600');
        input.classList.add('text-slate-800', 'dark:text-slate-100');
        parentRow.classList.remove('opacity-60', 'bg-slate-50/40', 'dark:bg-slate-800/30');
        parentRow.classList.add('bg-slate-50/90', 'dark:bg-slate-800/80', 'border-slate-200', 'dark:border-slate-700');
        if (parseInt(input.value) === 0) input.value = 10;
      } else {
        input.disabled = true;
        input.classList.add('bg-slate-100', 'dark:bg-slate-800/50', 'text-slate-400', 'dark:text-slate-600');
        input.classList.remove('text-slate-800', 'dark:text-slate-100');
        parentRow.classList.add('opacity-60', 'bg-slate-50/40', 'dark:bg-slate-800/30');
        parentRow.classList.remove('bg-slate-50/90', 'dark:bg-slate-800/80', 'border-slate-200', 'dark:border-slate-700');
      }
      calculateTotalWeight();
    });
  });

  // Weight input handler
  modalEl.querySelectorAll('.input-weight-item').forEach(input => {
    input.addEventListener('input', calculateTotalWeight);
  });

  // Preset default handler
  modalEl.querySelector('#btn-preset-default')?.addEventListener('click', () => {
    const defaultWeights = {
      kehadiran: { active: true, weight: 15 },
      tugas_mandiri: { active: true, weight: 20 },
      tugas_kelompok: { active: true, weight: 20 },
      pr: { active: true, weight: 15 },
      ceklis: { active: true, weight: 10 },
      sumatif_sts: { active: true, weight: 10 },
      sumatif_sas: { active: true, weight: 10 },
      sikap: { active: false, weight: 0 }
    };

    Object.entries(defaultWeights).forEach(([k, def]) => {
      const chk = modalEl.querySelector(`#chk-comp-${k}`);
      const inp = modalEl.querySelector(`#input-weight-${k}`);
      if (chk && inp) {
        chk.checked = def.active;
        inp.value = def.weight;
        inp.disabled = !def.active;
      }
    });
    calculateTotalWeight();
    showToast('Preset bobot standar diterapkan', 'info');
  });

  function closeModal() {
    modalRoot.innerHTML = '';
  }

  modalEl.querySelector('#btn-close-ledger-cfg')?.addEventListener('click', closeModal);
  modalEl.querySelector('#btn-cancel-ledger-cfg')?.addEventListener('click', closeModal);

  // Save Config Button Handler
  btnSave.addEventListener('click', async () => {
    const newCompConfig = {};
    modalEl.querySelectorAll('.chk-comp-item').forEach(chk => {
      const key = chk.getAttribute('data-key');
      const input = modalEl.querySelector(`#input-weight-${key}`);
      newCompConfig[key] = {
        active: chk.checked,
        weight: chk.checked ? (parseInt(input?.value) || 0) : 0,
        bonus_per_item: 3,
        penalty_per_item: 3
      };
    });

    const newKKM = parseInt(modalEl.querySelector('#input-ledger-kkm')?.value) || 75;
    const newPredA = parseInt(modalEl.querySelector('#input-pred-a')?.value) || 90;
    const newPredB = parseInt(modalEl.querySelector('#input-pred-b')?.value) || 80;
    const newPredC = parseInt(modalEl.querySelector('#input-pred-c')?.value) || 75;

    btnSave.disabled = true;
    btnSave.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Menyimpan...</span>`;
    if (window.lucide) window.lucide.createIcons();

    const saveRes = await db.saveLedgerConfig({
      kelas_id: kelasId,
      mapel_id: mapelId,
      mapel: mapelNama,
      academic_year: academicYear,
      kkm: newKKM,
      predikat_ranges: { A: newPredA, B: newPredB, C: newPredC, D: 0 },
      components_config: newCompConfig
    });

    if (saveRes.success) {
      showToast('Formula bobot & KKM berhasil disimpan!', 'success');
      closeModal();
      onSaved();
    } else {
      showToast(saveRes.message || 'Gagal menyimpan konfigurasi', 'error');
      btnSave.disabled = false;
      btnSave.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan Konfigurasi</span>`;
    }
  });

  calculateTotalWeight();
}
