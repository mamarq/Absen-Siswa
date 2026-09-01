// components/TugasKelompokView.js - Form Terpadu Penilaian Tugas Berbasis Kelompok
import { db } from '../supabase-client.js';
import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
import { initQuickFillNilai } from './QuickFillNilai.js';

export async function renderTugasKelompokView(container, state, onNavigate, showToast) {
  const currentAcademicYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const [kelasList, mapelList] = await Promise.all([
    db.getClassesByYear(currentAcademicYear, true),
    db.getMataPelajaran()
  ]);

  let selectedKelasId = state.currentKelasId;
  if (!selectedKelasId || !kelasList.some(k => k.id === selectedKelasId)) {
    selectedKelasId = kelasList[0]?.id || '';
  }

  let selectedMapel = state.currentMapel || (mapelList[0]?.nama_mapel || 'Matematika');
  const selectedMapelObj = mapelList.find(m => m.nama_mapel === selectedMapel) || mapelList[0];
  const selectedMapelId = selectedMapelObj?.id || null;
  const today = state.currentTanggal || new Date().toISOString().split('T')[0];

  let activeEditingTugasId = null;

  async function loadData() {
    const [kelompokList, allSiswa, unassignedSiswa, riwayatTugas] = await Promise.all([
      db.getKelompokList({ kelas_id: selectedKelasId, mapel_id: selectedMapelId, mapel: selectedMapel, academic_year: currentAcademicYear }),
      selectedKelasId ? db.getSiswaByKelas(selectedKelasId, true) : Promise.resolve([]),
      selectedKelasId ? db.getSiswaBelumBerkelompok(selectedKelasId, selectedMapelId, currentAcademicYear) : Promise.resolve([]),
      db.getTugasKelompokList({ kelas_id: selectedKelasId, mapel: selectedMapel, academic_year: currentAcademicYear })
    ]);
    return { kelompokList, allSiswa, unassignedSiswa, riwayatTugas };
  }

  async function render() {
    const { kelompokList, allSiswa, unassignedSiswa, riwayatTugas } = await loadData();
    const selectedKelasObj = kelasList.find(k => k.id === selectedKelasId);
    const activeTugasObj = activeEditingTugasId ? riwayatTugas.find(t => t.id === activeEditingTugasId) : null;

    // Nilai & Catatan Map
    const nilaiMap = {};
    if (activeTugasObj && activeTugasObj.daftar_nilai) {
      activeTugasObj.daftar_nilai.forEach(d => {
        nilaiMap[d.siswa_id] = { nilai: d.nilai !== null && d.nilai !== undefined ? d.nilai : '', catatan: d.catatan || '' };
      });
    }

    const defaultKKM = activeTugasObj?.kkm || 75;
    const defaultJudul = activeTugasObj?.judul_tugas || 'Tugas Kelompok 1: Presentasi Proyek';
    const defaultTanggal = activeTugasObj?.tanggal || today;

    container.innerHTML = `
      <div class="space-y-6 pb-24 max-w-6xl mx-auto">
        
        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white p-4 sm:p-6 rounded-3xl shadow-sm border border-emerald-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="p-3 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30">
              <i data-lucide="award" class="w-7 h-7"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-extrabold text-lg sm:text-2xl tracking-tight">Penilaian Tugas Kelompok</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase">
                  ${currentAcademicYear}
                </span>
              </div>
              <p class="text-xs text-emerald-200/80 mt-0.5">
                Form terpadu penilaian kerja kelompok / presentasi dengan nilai individual per siswa dan floating quick-fill.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button 
              id="btn-goto-data-kelompok" 
              class="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 active:scale-95"
            >
              <i data-lucide="users" class="w-4 h-4 text-emerald-300"></i>
              <span>Atur Susunan Kelompok</span>
            </button>
          </div>
        </div>

        <!-- Form Card Penilaian Tugas Kelompok -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-6">
          
          <!-- Top Configuration Bar -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 items-end">
            
            <!-- Kelas -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Kelas</label>
              ${renderClassComboboxHTML({
                id: 'tugas-kel-select-kelas',
                kelasList,
                selectedId: selectedKelasId,
                size: 'sm'
              })}
            </div>

            <!-- Mapel -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Mata Pelajaran</label>
              ${renderMapelComboboxHTML({
                id: 'tugas-kel-select-mapel',
                mapelList,
                selectedValue: selectedMapel,
                size: 'sm'
              })}
            </div>

            <!-- Tanggal Penilaian -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Tanggal Penilaian</label>
              ${renderDatePickerHTML({
                id: 'tugas-kel-input-tanggal',
                value: defaultTanggal,
                placeholder: 'Pilih tanggal...'
              })}
            </div>

            <!-- KKM -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">KKM / Standar Kelulusan</label>
              <input 
                type="number" 
                id="tugas-kel-input-kkm" 
                value="${defaultKKM}" 
                min="0" 
                max="100" 
                class="w-full h-9 text-xs font-black px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
            </div>

          </div>

          <!-- Judul / Topik Tugas Kelompok -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700">
              Judul / Topik Tugas Kelompok <span class="text-rose-500">*</span>
            </label>
            <input 
              type="text" 
              id="tugas-kel-input-judul" 
              value="${defaultJudul}" 
              placeholder="Contoh: Tugas Kelompok: Presentasi Perancangan Database & Jaringan Bab 4" 
              class="w-full px-4 py-2.5 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            >
          </div>

          <!-- Quick Actions & Stats Ribbon -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-100">
            
            <!-- Global Quick Fill -->
            <div class="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <span class="text-slate-500 text-[11px] mr-1">Isi Nilai Semua Siswa:</span>
              <button class="btn-global-quick-val px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg border border-slate-200 transition text-[11px] shadow-xs" data-val="75">75</button>
              <button class="btn-global-quick-val px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg border border-slate-200 transition text-[11px] shadow-xs" data-val="80">80</button>
              <button class="btn-global-quick-val px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg border border-slate-200 transition text-[11px] shadow-xs" data-val="85">85</button>
              <button class="btn-global-quick-val px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg border border-slate-200 transition text-[11px] shadow-xs" data-val="90">90</button>
              <button class="btn-global-quick-val px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg border border-slate-200 transition text-[11px] shadow-xs" data-val="100">100</button>
              <button id="btn-clear-all-nilai-kelompok" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition text-[11px]">Kosongkan</button>
            </div>

            <!-- Live Stats Badges -->
            <div class="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span class="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700">
                Rata-rata: <strong id="stat-kel-avg" class="text-emerald-700">-</strong>
              </span>
              <span class="px-2.5 py-1 bg-emerald-100/70 border border-emerald-200 text-emerald-800 rounded-lg">
                Tuntas: <strong id="stat-kel-tuntas">0</strong>
              </span>
              <span class="px-2.5 py-1 bg-amber-100/70 border border-amber-200 text-amber-800 rounded-lg">
                Remedial: <strong id="stat-kel-remed">0</strong>
              </span>
              <span class="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                Belum: <strong id="stat-kel-belum">0</strong>
              </span>
            </div>

          </div>

          <!-- Group Cards List for Grading -->
          <div class="space-y-4" id="group-grading-container">
            ${kelompokList.length === 0 ? `
              <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                <i data-lucide="users" class="w-10 h-10 text-slate-400 mx-auto"></i>
                <h4 class="font-bold text-slate-700 text-sm">Belum Ada Data Kelompok</h4>
                <p class="text-xs text-slate-400 max-w-sm mx-auto">
                  Silakan buat kelompok terlebih dahulu di menu <strong>Data Kelompok</strong> agar penilaian dapat dikelompokkan dengan rapi.
                </p>
                <div class="pt-2">
                  <button id="btn-empty-goto-data-kelompok" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>+ Buat Kelompok Sekarang</span>
                  </button>
                </div>
              </div>
            ` : kelompokList.map(k => {
              const anggota = k.anggota || [];

              return `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden group-card" data-kelompok-id="${k.id}">
                  
                  <!-- Group Card Header -->
                  <div class="p-3.5 bg-slate-50/90 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                        <i data-lucide="users-2" class="w-4 h-4"></i>
                      </div>
                      <div class="min-w-0">
                        <h4 class="font-extrabold text-slate-800 text-sm truncate">${k.nama_kelompok}</h4>
                        <span class="text-[10px] text-slate-400 font-bold">${anggota.length} Anggota Siswa</span>
                      </div>
                    </div>

                    <!-- Quick Fill Single Group Action Toolbar -->
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Set Nilai Grup:</span>
                      <button type="button" class="btn-group-fill-val px-2 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-black border border-slate-200 transition shadow-xs" data-kelompok-id="${k.id}" data-val="75">75</button>
                      <button type="button" class="btn-group-fill-val px-2 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-black border border-slate-200 transition shadow-xs" data-kelompok-id="${k.id}" data-val="80">80</button>
                      <button type="button" class="btn-group-fill-val px-2 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-black border border-slate-200 transition shadow-xs" data-kelompok-id="${k.id}" data-val="85">85</button>
                      <button type="button" class="btn-group-fill-val px-2 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-black border border-slate-200 transition shadow-xs" data-kelompok-id="${k.id}" data-val="90">90</button>
                      <button type="button" class="btn-group-fill-val px-2 py-1 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-black border border-slate-200 transition shadow-xs" data-kelompok-id="${k.id}" data-val="100">100</button>
                    </div>
                  </div>

                  <!-- Group Members Table -->
                  <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                      <thead>
                        <tr class="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/40 border-b border-slate-100">
                          <th class="py-2 px-3 text-center w-12">No</th>
                          <th class="py-2 px-3">Nama Siswa</th>
                          <th class="py-2 px-3 text-center w-28">Nilai Siswa</th>
                          <th class="py-2 px-3 text-center w-28">Status</th>
                          <th class="py-2 px-3">Catatan Khusus Siswa</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        ${anggota.length === 0 ? `
                          <tr>
                            <td colspan="5" class="py-4 text-center text-xs text-slate-400 italic">
                              Belum ada anggota di kelompok ini.
                            </td>
                          </tr>
                        ` : anggota.map((s, sIdx) => {
                          const val = nilaiMap[s.id]?.nilai ?? '';
                          const cat = nilaiMap[s.id]?.catatan ?? '';
                          const numVal = parseInt(val);
                          const isFilled = !isNaN(numVal) && val !== '';
                          const isTuntas = isFilled && numVal >= defaultKKM;

                          return `
                            <tr class="hover:bg-slate-50/70 transition student-row" data-siswa-id="${s.id}" data-kelompok-id="${k.id}" data-kelompok-nama="${k.nama_kelompok}">
                              <td class="py-2.5 px-3 text-center font-bold text-slate-500 text-xs">${s.nomor_absen || (sIdx + 1)}</td>
                              <td class="py-2.5 px-3">
                                <div class="font-extrabold text-slate-800 text-xs sm:text-sm">${s.nama_lengkap}</div>
                                <div class="text-[10px] text-slate-400">NISN: ${s.nisn || '-'} • (${s.jenis_kelamin || 'L'})</div>
                              </td>

                              <!-- Input Nilai with QuickFill support -->
                              <td class="py-2 px-3 text-center">
                                <input 
                                  type="number" 
                                  min="0" 
                                  max="100" 
                                  value="${val}" 
                                  placeholder="0" 
                                  data-siswa-id="${s.id}"
                                  data-kelompok-id="${k.id}"
                                  data-kelompok-nama="${k.nama_kelompok}"
                                  class="input-nilai-kelompok-item w-20 text-center font-black text-xs sm:text-sm p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition ${isFilled ? (isTuntas ? 'text-emerald-700 bg-emerald-50/40 border-emerald-300' : 'text-rose-600 bg-rose-50/40 border-rose-300') : 'text-slate-400'}"
                                >
                              </td>

                              <!-- Status Tuntas / Remedial -->
                              <td class="py-2.5 px-3 text-center status-kel-cell">
                                ${!isFilled ? `
                                  <span class="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Belum</span>
                                ` : isTuntas ? `
                                  <span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">Tuntas</span>
                                ` : `
                                  <span class="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">Remedial</span>
                                `}
                              </td>

                              <!-- Catatan Siswa -->
                              <td class="py-2 px-3">
                                <input 
                                  type="text" 
                                  value="${cat}" 
                                  placeholder="Catatan keaktifan/kontribusi..." 
                                  data-siswa-id="${s.id}"
                                  class="input-catatan-kelompok-item w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                                >
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>

                </div>
              `;
            }).join('')}
          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="text-xs text-slate-500">
              Nilai per siswa akan tercatat resmi ke histori penilaian dan rekapitulasi semester.
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                type="button" 
                id="btn-print-tugas-kelompok" 
                class="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center gap-1.5"
              >
                <i data-lucide="printer" class="w-4 h-4"></i>
                <span>Cetak Lembar Nilai</span>
              </button>

              <button 
                type="button" 
                id="btn-save-tugas-kelompok" 
                class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/30 transition flex items-center gap-2"
              >
                <i data-lucide="save" class="w-4 h-4"></i>
                <span>${activeEditingTugasId ? 'Perbarui Nilai Tugas' : 'Simpan Nilai Tugas Kelompok'}</span>
              </button>
            </div>
          </div>

        </div>

        <!-- Riwayat Penilaian Tugas Kelompok Tersimpan -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="history" class="w-4 h-4 text-emerald-600"></i>
              <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Riwayat Tugas Kelompok Tersimpan</h3>
            </div>
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-200">
              ${riwayatTugas.length} Sesi
            </span>
          </div>

          <div class="space-y-2.5">
            ${riwayatTugas.length === 0 ? `
              <div class="py-8 text-center text-slate-400 text-xs italic">
                Belum ada riwayat penilaian tugas kelompok yang tersimpan untuk kelas dan mapel ini.
              </div>
            ` : riwayatTugas.map(t => {
              const tglStr = new Date(t.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              const listN = (t.daftar_nilai || []).map(d => parseInt(d.nilai)).filter(n => !isNaN(n));
              const avg = listN.length > 0 ? Math.round(listN.reduce((a, b) => a + b, 0) / listN.length) : '-';
              const isSelected = t.id === activeEditingTugasId;

              return `
                <div class="p-3.5 rounded-2xl border ${isSelected ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'} transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="min-w-0 space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-extrabold text-slate-800 text-xs sm:text-sm">${t.judul_tugas}</span>
                      <span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">Kelompok</span>
                    </div>
                    <div class="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>📅 ${tglStr}</span>
                      <span>•</span>
                      <span>KKM: <strong>${t.kkm || 75}</strong></span>
                      <span>•</span>
                      <span>Rata-rata: <strong class="text-emerald-700">${avg}</strong></span>
                      <span>•</span>
                      <span>(${listN.length}/${allSiswa.length} Siswa Dinilai)</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button 
                      class="btn-edit-riwayat-tugas px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1"
                      data-tugas-id="${t.id}"
                    >
                      <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                      <span>${isSelected ? 'Sedang Diedit' : 'Buka / Edit'}</span>
                    </button>

                    <button 
                      class="btn-delete-riwayat-tugas p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      data-tugas-id="${t.id}"
                      data-tugas-judul="${t.judul_tugas}"
                      title="Hapus Nilai Tugas Ini"
                    >
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Inisialisasi Combobox Kelas & Mapel
    initClassCombobox(container, {
      id: 'tugas-kel-select-kelas',
      kelasList,
      selectedId: selectedKelasId,
      size: 'sm',
      onSelect: (newKId) => {
        selectedKelasId = newKId;
        activeEditingTugasId = null;
        render();
      }
    });

    initMapelCombobox(container, {
      id: 'tugas-kel-select-mapel',
      mapelList,
      selectedValue: selectedMapel,
      size: 'sm',
      onSelect: (newMapel) => {
        selectedMapel = newMapel;
        activeEditingTugasId = null;
        render();
      }
    });

    // Inisialisasi DatePicker
    initDatePicker(container, {
      id: 'tugas-kel-input-tanggal',
      value: defaultTanggal,
      onChange: (newDate) => {
        const inp = container.querySelector('#tugas-kel-input-tanggal');
        if (inp) inp.value = newDate;
      }
    });

    // Navigation to Master Kelompok
    container.querySelector('#btn-goto-data-kelompok')?.addEventListener('click', () => onNavigate('kelompok'));
    container.querySelector('#btn-empty-goto-data-kelompok')?.addEventListener('click', () => onNavigate('kelompok'));

    // Live Stats Calculation Function
    function updateLiveStats() {
      const kkmVal = parseInt(container.querySelector('#tugas-kel-input-kkm')?.value) || 75;
      let sum = 0, count = 0, tuntas = 0, remed = 0, belum = 0;

      container.querySelectorAll('.input-nilai-kelompok-item').forEach(inp => {
        const val = parseInt(inp.value);
        const row = inp.closest('.student-row');
        const statusCell = row?.querySelector('.status-kel-cell');

        if (!isNaN(val) && inp.value !== '') {
          sum += val;
          count++;
          if (val >= kkmVal) {
            tuntas++;
            inp.className = 'input-nilai-kelompok-item w-20 text-center font-black text-xs sm:text-sm p-2 bg-emerald-50/40 border border-emerald-300 text-emerald-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition';
            if (statusCell) statusCell.innerHTML = `<span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">Tuntas</span>`;
          } else {
            remed++;
            inp.className = 'input-nilai-kelompok-item w-20 text-center font-black text-xs sm:text-sm p-2 bg-amber-50/40 border border-amber-300 text-amber-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition';
            if (statusCell) statusCell.innerHTML = `<span class="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">Remedial</span>`;
          }
        } else {
          belum++;
          inp.className = 'input-nilai-kelompok-item w-20 text-center font-black text-xs sm:text-sm p-2 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition';
          if (statusCell) statusCell.innerHTML = `<span class="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Belum</span>`;
        }
      });

      const elAvg = container.querySelector('#stat-kel-avg');
      const elTuntas = container.querySelector('#stat-kel-tuntas');
      const elRemed = container.querySelector('#stat-kel-remed');
      const elBelum = container.querySelector('#stat-kel-belum');

      if (elAvg) elAvg.textContent = count > 0 ? Math.round(sum / count) : '-';
      if (elTuntas) elTuntas.textContent = tuntas;
      if (elRemed) elRemed.textContent = remed;
      if (elBelum) elBelum.textContent = belum;
    }

    // Floating Quick-Fill Integration
    initQuickFillNilai({
      container,
      inputSelector: '.input-nilai-kelompok-item',
      onSelect: () => {
        updateLiveStats();
      }
    });

    container.querySelectorAll('.input-nilai-kelompok-item').forEach(inp => {
      inp.addEventListener('input', updateLiveStats);
    });
    container.querySelector('#tugas-kel-input-kkm')?.addEventListener('input', updateLiveStats);
    updateLiveStats();

    // Quick Action: Set Nilai Satu Kelompok
    container.querySelectorAll('.btn-group-fill-val').forEach(btn => {
      btn.addEventListener('click', () => {
        const kId = btn.getAttribute('data-kelompok-id');
        const val = btn.getAttribute('data-val');
        const card = container.querySelector(`.group-card[data-kelompok-id="${kId}"]`);
        if (card) {
          card.querySelectorAll('.input-nilai-kelompok-item').forEach(inp => {
            inp.value = val;
          });
          updateLiveStats();
          showToast(`Nilai anggota kelompok diisi: ${val}`, 'info');
        }
      });
    });

    // Global Quick Actions
    container.querySelectorAll('.btn-global-quick-val').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        container.querySelectorAll('.input-nilai-kelompok-item').forEach(inp => {
          inp.value = val;
        });
        updateLiveStats();
        showToast(`Seluruh nilai siswa diisi: ${val}`, 'info');
      });
    });

    container.querySelector('#btn-clear-all-nilai-kelompok')?.addEventListener('click', () => {
      container.querySelectorAll('.input-nilai-kelompok-item').forEach(inp => {
        inp.value = '';
      });
      updateLiveStats();
    });

    // Save Assignment Grades
    container.querySelector('#btn-save-tugas-kelompok')?.addEventListener('click', async () => {
      const judul = container.querySelector('#tugas-kel-input-judul')?.value?.trim();
      const tanggalVal = container.querySelector('#tugas-kel-input-tanggal')?.value || defaultTanggal;
      const kkmVal = parseInt(container.querySelector('#tugas-kel-input-kkm')?.value) || 75;

      if (!judul) {
        showToast('Judul / topik tugas kelompok harus diisi!', 'error');
        return;
      }

      const daftarNilai = [];
      container.querySelectorAll('.student-row').forEach(row => {
        const sId = row.getAttribute('data-siswa-id');
        const kId = row.getAttribute('data-kelompok-id');
        const kNama = row.getAttribute('data-kelompok-nama');
        const inpNilai = row.querySelector('.input-nilai-kelompok-item');
        const inpCatatan = row.querySelector('.input-catatan-kelompok-item');

        const val = inpNilai ? inpNilai.value.trim() : '';
        const cat = inpCatatan ? inpCatatan.value.trim() : '';

        daftarNilai.push({
          siswa_id: sId,
          nilai: val !== '' && !isNaN(parseInt(val)) ? parseInt(val) : '',
          catatan: cat,
          kelompok_id: kId,
          nama_kelompok: kNama
        });
      });

      const payload = {
        id: activeEditingTugasId || undefined,
        kelas_id: selectedKelasId,
        mapel: selectedMapel,
        tanggal: tanggalVal,
        judul_tugas: judul,
        kkm: kkmVal,
        daftar_nilai: daftarNilai,
        is_kelompok: true,
        tipe_tugas: 'kelompok',
        academic_year: currentAcademicYear
      };

      const res = await db.saveTugasKelompok(payload);
      if (res.success) {
        showToast('Nilai tugas kelompok berhasil disimpan!', 'success');
        activeEditingTugasId = res.id || null;
        render();
      } else {
        showToast('Gagal menyimpan nilai: ' + (res.message || 'Terjadi kesalahan'), 'error');
      }
    });

    // Edit Riwayat Tugas
    container.querySelectorAll('.btn-edit-riwayat-tugas').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = btn.getAttribute('data-tugas-id');
        activeEditingTugasId = tId;
        render();
      });
    });

    // Delete Riwayat Tugas
    container.querySelectorAll('.btn-delete-riwayat-tugas').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tId = btn.getAttribute('data-tugas-id');
        const judul = btn.getAttribute('data-tugas-judul');
        if (confirm(`Hapus nilai tugas kelompok "${judul}"?`)) {
          await db.deleteTugasKelompok(tId);
          if (activeEditingTugasId === tId) activeEditingTugasId = null;
          showToast('Nilai tugas kelompok berhasil dihapus', 'info');
          render();
        }
      });
    });

    // Print Sheet Action
    container.querySelector('#btn-print-tugas-kelompok')?.addEventListener('click', () => {
      window.print();
    });
  }

  await render();
}
