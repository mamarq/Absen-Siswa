// components/KenaikanKelasModal.js - Modal Kenaikan Kelas (Grade Promotion) Massal Multi-Tahun Ajaran
import { db } from '../supabase-client.js';
import { renderAcademicYearComboboxHTML, initAcademicYearCombobox } from './AcademicYearCombobox.js';

export async function renderKenaikanKelasModal(modalContainer, onClose, onDataUpdated, showToast, currentActiveYear) {
  // 0. Cek Role Otoritatif
  const currentUser = await db.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // 1. Inisialisasi State Tahun Ajaran
  let allYears = await db.getDistinctAcademicYears();
  let defaultSourceYear = currentActiveYear || (await db.getActiveAcademicYear()) || '2025/2026';
  
  if (!allYears.includes(defaultSourceYear)) {
    allYears.unshift(defaultSourceYear);
  }

  // Hitung prediksi tahun ajaran berikutnya (misal 2025/2026 -> 2026/2027, 2026/2027 -> 2027/2028)
  function getNextYearSuggestion(srcYear) {
    const parts = srcYear.split('/');
    if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
      const y1 = parseInt(parts[0]) + 1;
      const y2 = parseInt(parts[1]) + 1;
      return `${y1}/${y2}`;
    }
    return '2026/2027';
  }

  let sourceYear = defaultSourceYear;
  let targetYear = getNextYearSuggestion(sourceYear);
  let isCustomTargetYear = false;
  let customTargetYearInput = '';

  let activeStep = 'mapping'; // 'mapping' | 'preview' | 'executing' | 'result'
  let isExecuting = false;
  let executionResult = null;

  // Data State
  let sourceClasses = [];
  let classMappings = {}; 
  // Structure: { [sourceKelasId]: { source_kelas_id, source_kelas_nama, tingkat, jurusan, action: 'promote'|'graduate'|'skip', target_kelas_nama, target_tingkat, target_jurusan, is_custom_name: boolean, student_overrides: { [siswaId]: { action: 'promote'|'graduate'|'retain', target_kelas_id } }, students: [] } }
  let targetYearSafeguard = null;
  let expandedClassId = null;

  // Helper smart guess nama kelas
  function predictTargetClass(className, tingkat, jurusan) {
    const raw = (className || '').trim();
    const upper = raw.toUpperCase();

    // Kelas XII -> Lulus
    if (upper.startsWith('XII') || tingkat === 'XII') {
      return {
        action: 'graduate',
        target_kelas_nama: 'Lulus / Selesai',
        target_tingkat: 'XII',
        target_jurusan: jurusan || 'Umum'
      };
    }

    // Kelas XI -> XII
    if (upper.startsWith('XI') || tingkat === 'XI') {
      const targetName = raw.replace(/^XI\b/i, 'XII');
      return {
        action: 'promote',
        target_kelas_nama: targetName !== raw ? targetName : `XII ${raw}`,
        target_tingkat: 'XII',
        target_jurusan: jurusan || 'Teknik Jaringan Komputer dan Telekomunikasi'
      };
    }

    // Kelas X -> XI
    if (upper.startsWith('X') || tingkat === 'X') {
      const targetName = raw.replace(/^X\b/i, 'XI');
      return {
        action: 'promote',
        target_kelas_nama: targetName !== raw ? targetName : `XI ${raw}`,
        target_tingkat: 'XI',
        target_jurusan: jurusan || 'Teknik Jaringan Komputer dan Telekomunikasi'
      };
    }

    // Default
    return {
      action: 'promote',
      target_kelas_nama: `Lanjutan ${raw}`,
      target_tingkat: 'XI',
      target_jurusan: jurusan || 'Umum'
    };
  }

  // Muat data kelas asal dan siapkan initial mapping
  async function loadSourceData() {
    sourceClasses = await db.getClassesByYear(sourceYear, true);
    targetYearSafeguard = await db.checkKenaikanSafeguard(sourceYear, isCustomTargetYear ? customTargetYearInput : targetYear);

    // Ambil siswa untuk setiap kelas asal
    classMappings = {};
    for (const k of sourceClasses) {
      const students = await db.getSiswaByKelas(k.id, false);
      const prediction = predictTargetClass(k.nama_kelas, k.tingkat, k.jurusan);

      classMappings[k.id] = {
        source_kelas_id: k.id,
        source_kelas_nama: k.nama_kelas,
        tingkat: k.tingkat || 'X',
        jurusan: k.jurusan || 'Teknik Jaringan Komputer dan Telekomunikasi',
        action: prediction.action,
        target_kelas_nama: prediction.target_kelas_nama,
        target_tingkat: prediction.target_tingkat,
        target_jurusan: prediction.target_jurusan,
        is_custom_name: false,
        student_overrides: {},
        students
      };
    }
  }

  // Render Utama Modal
  async function renderModalContent() {
    const effectiveTargetYear = (isCustomTargetYear ? customTargetYearInput : targetYear).trim();

    // Hitung ringkasan statistik
    let totalSourceStudents = 0;
    let totalPromotingStudents = 0;
    let totalGraduatingStudents = 0;
    let totalRetainingStudents = 0;
    let totalClassesToPromote = 0;
    let totalClassesToGraduate = 0;
    const newClassesSet = new Set();

    Object.values(classMappings).forEach(m => {
      const sCount = m.students.length;
      totalSourceStudents += sCount;

      if (m.action === 'skip') return;

      if (m.action === 'graduate') {
        totalClassesToGraduate++;
        m.students.forEach(s => {
          const ovr = m.student_overrides[s.id];
          if (ovr && ovr.action === 'retain') totalRetainingStudents++;
          else totalGraduatingStudents++;
        });
      } else if (m.action === 'promote') {
        totalClassesToPromote++;
        if (m.target_kelas_nama && m.target_kelas_nama !== 'Lulus / Selesai') {
          newClassesSet.add(m.target_kelas_nama);
        }

        m.students.forEach(s => {
          const ovr = m.student_overrides[s.id];
          if (ovr?.action === 'graduate') totalGraduatingStudents++;
          else if (ovr?.action === 'retain') totalRetainingStudents++;
          else totalPromotingStudents++;
        });
      }
    });

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
        <div class="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[94vh] flex flex-col border border-slate-100">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-900/30">
                <i data-lucide="trending-up" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-extrabold text-slate-800 text-base sm:text-lg">Kenaikan Kelas & Pemindahan Rombel</h3>
                  <span class="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <i data-lucide="shield-check" class="w-3 h-3 text-emerald-600"></i>
                    <span>Proteksi Data Historis</span>
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">Pindahkan siswa ke tahun ajaran baru secara massal tanpa mengubah data absensi atau nilai lama</p>
              </div>
            </div>

            <button id="btn-close-kenaikan-modal" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Tutup">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Step Navigation Pills -->
          <div class="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5 flex-shrink-0">
            <div class="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1 text-xs font-bold">
              <button id="step-btn-mapping" class="px-4 py-1.5 rounded-xl transition flex items-center gap-1.5 ${activeStep === 'mapping' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}" ${isExecuting ? 'disabled' : ''}>
                <i data-lucide="git-branch" class="w-4 h-4 text-emerald-600"></i>
                <span>1. Pemetaan Rombel (${sourceClasses.length} Kelas)</span>
              </button>

              <button id="step-btn-preview" class="px-4 py-1.5 rounded-xl transition flex items-center gap-1.5 ${activeStep === 'preview' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}" ${isExecuting ? 'disabled' : ''}>
                <i data-lucide="eye" class="w-4 h-4 text-emerald-600"></i>
                <span>2. Preview & Ringkasan</span>
              </button>
            </div>

            <div class="text-[11px] text-slate-500 font-semibold hidden sm:flex items-center gap-1.5">
              <span>Total Siswa Asal:</span>
              <strong class="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">${totalSourceStudents} Siswa</strong>
            </div>
          </div>

          <!-- Main Scrollable Body Area -->
          <div class="flex-1 overflow-y-auto pr-1 text-xs space-y-4">
            
            ${activeStep === 'executing' ? `
              <!-- EXECUTION LOADING SCREEN -->
              <div class="py-16 text-center space-y-4">
                <div class="w-14 h-14 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div>
                  <h4 class="font-extrabold text-slate-800 text-base">Memproses Kenaikan Kelas Secara Atomik...</h4>
                  <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Membuat kelas baru, memperbarui kelas siswa, dan mengamankan seluruh histori absensi serta penilaian. Harap tunggu sebentar.
                  </p>
                </div>
              </div>
            ` : activeStep === 'result' ? `
              <!-- RESULT REPORT SCREEN -->
              <div class="space-y-4 py-2">
                <div class="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3">
                  <div class="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
                    <i data-lucide="check-circle-2" class="w-8 h-8"></i>
                  </div>
                  <div>
                    <h4 class="font-extrabold text-slate-900 text-lg">Kenaikan Kelas Berhasil Dijalankan! 🎉</h4>
                    <p class="text-xs text-slate-600 mt-1 max-w-lg mx-auto">
                      Seluruh siswa telah berhasil dipindahkan ke tahun ajaran <strong>${executionResult?.target_academic_year || effectiveTargetYear}</strong>. Data absensi dan nilai pada tahun ajaran <strong>${executionResult?.source_academic_year || sourceYear}</strong> tetap aman dan tersimpan utuh.
                    </p>
                  </div>

                  <!-- Quick Stats Metrics -->
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-left">
                    <div class="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                      <span class="text-[10px] font-bold text-slate-400 uppercase">Siswa Naik Kelas</span>
                      <p class="text-lg font-black text-emerald-700 mt-0.5">${executionResult?.promoted_count || 0}</p>
                    </div>

                    <div class="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                      <span class="text-[10px] font-bold text-slate-400 uppercase">Siswa Lulus</span>
                      <p class="text-lg font-black text-purple-700 mt-0.5">${executionResult?.graduated_count || 0}</p>
                    </div>

                    <div class="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                      <span class="text-[10px] font-bold text-slate-400 uppercase">Tinggal Kelas</span>
                      <p class="text-lg font-black text-amber-700 mt-0.5">${executionResult?.retained_count || 0}</p>
                    </div>

                    <div class="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                      <span class="text-[10px] font-bold text-slate-400 uppercase">Kelas Baru Terbuat</span>
                      <p class="text-lg font-black text-sky-700 mt-0.5">${executionResult?.classes_created || 0}</p>
                    </div>
                  </div>
                </div>

                <!-- Detail Rincian Hasil -->
                <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <h5 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Rincian Eksekusi Per Kelas</h5>
                  <div class="divide-y divide-slate-100">
                    ${(executionResult?.details || []).map(d => {
                      const srcObj = sourceClasses.find(k => k.id === d.source_kelas_id);
                      return `
                        <div class="py-2.5 flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-800">${srcObj?.nama_kelas || 'Kelas'}</span>
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-400"></i>
                            <span class="font-bold ${d.action === 'graduate' ? 'text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200' : 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200'}">${d.target_kelas_nama || 'Lulus / Selesai'}</span>
                          </div>

                          <div class="text-right text-[11px] text-slate-600">
                            ${d.action === 'graduate' ? `
                              <span class="font-bold text-purple-700">${d.students_graduated || 0} Siswa Lulus</span>
                            ` : `
                              <span class="font-bold text-emerald-700">${d.promoted || 0} Naik</span>
                              ${d.graduated ? `<span class="text-purple-600">, ${d.graduated} Lulus</span>` : ''}
                              ${d.retained ? `<span class="text-amber-600">, ${d.retained} Tinggal</span>` : ''}
                            `}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Footer Action Buttons on Result -->
                <div class="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                  <button id="btn-result-close" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition">
                    Tutup
                  </button>

                  <button id="btn-result-switch-year" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 transition transform active:scale-95">
                    <i data-lucide="sparkles" class="w-4 h-4"></i>
                    <span>Beralih ke Tahun Ajaran Baru (${effectiveTargetYear})</span>
                  </button>
                </div>
              </div>
            ` : activeStep === 'preview' ? `
              <!-- PREVIEW TAB -->
              <div class="space-y-4">
                <!-- Summary Metrics Bar -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div class="bg-emerald-50/80 border border-emerald-200 p-3 rounded-2xl">
                    <span class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Siswa Naik Kelas</span>
                    <p class="text-xl font-black text-emerald-900 mt-0.5">${totalPromotingStudents}</p>
                    <span class="text-[10px] text-emerald-600 font-medium">ke ${newClassesSet.size} rombel baru</span>
                  </div>

                  <div class="bg-purple-50/80 border border-purple-200 p-3 rounded-2xl">
                    <span class="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Siswa Lulus</span>
                    <p class="text-xl font-black text-purple-900 mt-0.5">${totalGraduatingStudents}</p>
                    <span class="text-[10px] text-purple-600 font-medium">status is_active = false</span>
                  </div>

                  <div class="bg-amber-50/80 border border-amber-200 p-3 rounded-2xl">
                    <span class="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Tinggal Kelas</span>
                    <p class="text-xl font-black text-amber-900 mt-0.5">${totalRetainingStudents}</p>
                    <span class="text-[10px] text-amber-600 font-medium">tetap di kelas asal</span>
                  </div>

                  <div class="bg-sky-50/80 border border-sky-200 p-3 rounded-2xl">
                    <span class="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Total Rombel Baru</span>
                    <p class="text-xl font-black text-sky-900 mt-0.5">${newClassesSet.size}</p>
                    <span class="text-[10px] text-sky-600 font-medium">di TA ${effectiveTargetYear}</span>
                  </div>
                </div>

                <!-- Mapping Table -->
                <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h5 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Tabel Rencana Pemetaan Rombel</h5>
                    <span class="text-[11px] text-slate-500 font-semibold">${sourceYear} ➔ ${effectiveTargetYear}</span>
                  </div>

                  <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr class="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold">
                          <th class="py-2.5 px-3">Kelas Asal (${sourceYear})</th>
                          <th class="py-2.5 px-3 text-center">Jml Siswa</th>
                          <th class="py-2.5 px-3">Aksi / Status</th>
                          <th class="py-2.5 px-3">Kelas Tujuan (${effectiveTargetYear})</th>
                          <th class="py-2.5 px-3">Rincian Siswa</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        ${Object.values(classMappings).map(m => {
                          const sCount = m.students.length;
                          const overridesCount = Object.keys(m.student_overrides).length;
                          let statusPill = '';
                          if (m.action === 'graduate') {
                            statusPill = `<span class="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-lg">🎓 Lulus Seluruhnya</span>`;
                          } else if (m.action === 'skip') {
                            statusPill = `<span class="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-lg">⏸️ Dilewati</span>`;
                          } else {
                            statusPill = `<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-lg">⬆️ Naik Kelas</span>`;
                          }

                          return `
                            <tr class="hover:bg-slate-50/80 transition">
                              <td class="py-2.5 px-3 font-bold text-slate-900">
                                <div>${m.source_kelas_nama}</div>
                                <span class="text-[10px] text-slate-400 font-normal">${m.jurusan}</span>
                              </td>
                              <td class="py-2.5 px-3 text-center font-bold text-slate-700">${sCount}</td>
                              <td class="py-2.5 px-3">${statusPill}</td>
                              <td class="py-2.5 px-3 font-bold ${m.action === 'graduate' ? 'text-purple-700' : 'text-emerald-700'}">
                                ${m.action === 'graduate' ? 'Lulus / Selesai' : (m.action === 'skip' ? '-' : m.target_kelas_nama)}
                              </td>
                              <td class="py-2.5 px-3 text-[11px] text-slate-600">
                                ${overridesCount > 0 ? `
                                  <span class="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">${overridesCount} Siswa dengan override khusus</span>
                                ` : `
                                  <span class="text-slate-400">Seluruh siswa mengikuti kelas</span>
                                `}
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Historical Data Reassurance Banner -->
                <div class="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
                  <div class="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600 flex-shrink-0"></i>
                    <span>Jaminan 100% Perlindungan Data Historis</span>
                  </div>
                  <p class="text-[11px] text-slate-600 leading-relaxed">
                    Proses ini <strong>TIDAK AKAN</strong> mengubah atau menghapus data absensi, jurnal mengajar, catatan to-do, maupun nilai tugas di tahun ajaran <strong>${sourceYear}</strong>. Semua rekaman masa lalu tetap dapat dilihat kapan saja lewat pergantian menu Tahun Ajaran di navigasi atas.
                  </p>
                </div>

                <!-- Confirmation Checkbox -->
                <div class="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <input type="checkbox" id="check-confirm-kenaikan" class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer">
                  <label for="check-confirm-kenaikan" class="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Saya telah memeriksa rencana pemetaan rombel di atas dan mengonfirmasi proses kenaikan kelas ini.
                  </label>
                </div>

                <!-- Action Buttons -->
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button id="btn-preview-back" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition flex items-center justify-center gap-1.5">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    <span>Kembali ke Pemetaan</span>
                  </button>

                  ${isAdmin ? `
                  <button id="btn-submit-execute-kenaikan" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 transition transform active:scale-95" disabled>
                    <i data-lucide="rocket" class="w-4 h-4"></i>
                    <span>Proses Kenaikan Kelas Sekarang</span>
                  </button>
                  ` : `
                  <div class="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl flex items-center gap-2">
                    <i data-lucide="lock" class="w-4 h-4 text-slate-400"></i>
                    <span>Fitur Khusus Administrator</span>
                  </div>
                  `}
                </div>
              </div>
            ` : `
              <!-- MAPPING TAB (STEP 1) -->
              <div class="space-y-4">
                
                <!-- Section 1: Pemilih Tahun Ajaran Asal & Tujuan -->
                <div class="bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div class="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <i data-lucide="calendar" class="w-4 h-4 text-emerald-600"></i>
                    <span>Pilih Tahun Ajaran Asal & Tujuan</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <!-- Dari Tahun Ajaran (Asal) -->
                    <div class="space-y-1">
                      <label class="block text-[11px] font-bold text-slate-700">Dari Tahun Ajaran (Asal):</label>
                      ${renderAcademicYearComboboxHTML({
                        id: 'select-source-year',
                        years: allYears,
                        selectedYear: sourceYear,
                        allowCustom: false,
                        size: 'md',
                        extraBadgeText: (yr) => yr === sourceYear ? `(${sourceClasses.length} Kelas)` : ''
                      })}
                    </div>

                    <!-- Ke Tahun Ajaran (Tujuan) -->
                    <div class="space-y-1">
                      <label class="block text-[11px] font-bold text-slate-700">Ke Tahun Ajaran (Tujuan):</label>
                      <div class="space-y-2">
                        ${renderAcademicYearComboboxHTML({
                          id: 'select-target-year',
                          years: [...new Set([...allYears, getNextYearSuggestion(sourceYear)])],
                          selectedYear: targetYear,
                          isCustomYear: isCustomTargetYear,
                          customYearValue: customTargetYearInput,
                          allowCustom: true,
                          size: 'md'
                        })}

                        ${isCustomTargetYear ? `
                          <input type="text" id="input-custom-target-year" value="${customTargetYearInput}" placeholder="Contoh: 2027/2028" class="w-full text-xs font-bold p-2.5 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        ` : ''}
                      </div>
                    </div>
                  </div>

                  <!-- Safeguard Warning Banner jika target tahun ajaran sudah ada data -->
                  ${targetYearSafeguard && targetYearSafeguard.hasExistingClasses ? `
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-900">
                      <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"></i>
                      <div class="text-[11px] leading-relaxed">
                        <strong>Perhatian:</strong> Tahun Ajaran Tujuan <strong>${effectiveTargetYear}</strong> sudah memiliki <strong>${targetYearSafeguard.existingClassCount} kelas</strong> dengan <strong>${targetYearSafeguard.existingStudentCount} siswa</strong>. Pastikan Anda tidak menduplikasi pemindahan yang sama.
                      </div>
                    </div>
                  ` : ''}
                </div>

                <!-- Section 2: Daftar Kelas Aktif & Pemetaan -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Pemetaan Rombel (${sourceClasses.length} Kelas Aktif)</h4>
                      <p class="text-[11px] text-slate-500">Tentukan kelas tujuan untuk setiap rombongan belajar</p>
                    </div>

                    <button id="btn-auto-guess-all" class="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5" title="Tebak ulang otomatis semua kelas">
                      <i data-lucide="wand-2" class="w-3.5 h-3.5 text-emerald-600"></i>
                      <span>Reset Auto-Guess</span>
                    </button>
                  </div>

                  ${sourceClasses.length === 0 ? `
                    <div class="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200 text-slate-400 space-y-2">
                      <i data-lucide="school" class="w-10 h-10 mx-auto text-slate-300"></i>
                      <p class="text-xs font-semibold">Tidak ada kelas aktif pada tahun ajaran ${sourceYear}.</p>
                    </div>
                  ` : `
                    <div class="space-y-3">
                      ${sourceClasses.map(k => {
                        const m = classMappings[k.id] || {};
                        const sList = m.students || [];
                        const isExpanded = expandedClassId === k.id;
                        const isGrad = m.action === 'graduate';
                        const isSkip = m.action === 'skip';

                        let currentActionVal = 'promote_auto';
                        if (m.action === 'graduate') currentActionVal = 'graduate';
                        else if (m.action === 'skip') currentActionVal = 'skip';
                        else if (m.is_custom_name) currentActionVal = 'promote_custom';

                        let triggerStyle = 'bg-emerald-50/70 dark:bg-emerald-950/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
                        let triggerIcon = 'arrow-up-right';
                        let triggerIconColor = 'text-emerald-700 dark:text-emerald-400';
                        let triggerLabel = `${m.target_kelas_nama || 'Naik Kelas'} (Otomatis)`;

                        if (currentActionVal === 'promote_custom') {
                          triggerStyle = 'bg-sky-50/70 dark:bg-sky-950/60 hover:bg-sky-50 dark:hover:bg-sky-900/60 text-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-800';
                          triggerIcon = 'edit-3';
                          triggerIconColor = 'text-sky-700 dark:text-sky-400';
                          triggerLabel = `${m.target_kelas_nama || 'Nama Kustom'} (Kustom)`;
                        } else if (currentActionVal === 'graduate') {
                          triggerStyle = 'bg-purple-50/70 dark:bg-purple-950/60 hover:bg-purple-50 dark:hover:bg-purple-900/60 text-purple-950 dark:text-purple-200 border-purple-200 dark:border-purple-800';
                          triggerIcon = 'graduation-cap';
                          triggerIconColor = 'text-purple-700 dark:text-purple-400';
                          triggerLabel = 'Lulus / Selesai (Non-Aktif)';
                        } else if (currentActionVal === 'skip') {
                          triggerStyle = 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';
                          triggerIcon = 'skip-forward';
                          triggerIconColor = 'text-slate-600 dark:text-slate-400';
                          triggerLabel = 'Lewati (Jangan Dipindahkan)';
                        }

                        return `
                          <div class="bg-white dark:bg-slate-900 rounded-2xl border ${isGrad ? 'border-purple-200 dark:border-purple-800 bg-purple-50/10 dark:bg-purple-950/20' : (isSkip ? 'border-slate-200 dark:border-slate-800 opacity-75' : 'border-slate-200 dark:border-slate-800')} p-4 space-y-3 shadow-2xs hover:shadow-xs transition">
                            <!-- Class Mapping Row Header -->
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              
                              <!-- Left: Source Class Info -->
                              <div class="flex items-center gap-3 min-w-0">
                                <div class="w-10 h-10 rounded-xl ${isGrad ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'} font-black text-xs flex items-center justify-center border ${isGrad ? 'border-purple-200 dark:border-purple-800' : 'border-emerald-200 dark:border-emerald-800'} flex-shrink-0">
                                  ${k.tingkat || 'X'}
                                </div>
                                <div class="min-w-0">
                                  <div class="flex items-center gap-2">
                                    <span class="font-extrabold text-slate-900 dark:text-slate-100 text-sm">${k.nama_kelas}</span>
                                    <span class="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">${sList.length} Siswa</span>
                                  </div>
                                  <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${k.jurusan || 'Kejuruan'}</p>
                                </div>
                              </div>

                              <!-- Right: Target Action / Selector (Custom Combobox) -->
                              <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <span class="text-xs font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">Menjadi:</span>
                                
                                <div class="relative inline-block text-left custom-class-action-combobox" data-kelas-id="${k.id}">
                                  <!-- Trigger Button (Shadcn/UI Style) -->
                                  <button 
                                    type="button" 
                                    class="btn-toggle-action-dropdown h-9 px-3 font-bold text-xs rounded-xl border flex items-center justify-between gap-2 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition group ${triggerStyle}"
                                    aria-haspopup="listbox"
                                    aria-expanded="false"
                                  >
                                    <div class="flex items-center gap-1.5 min-w-0">
                                      <i data-lucide="${triggerIcon}" class="w-3.5 h-3.5 ${triggerIconColor} flex-shrink-0"></i>
                                      <span class="truncate max-w-[130px] sm:max-w-[190px]">${triggerLabel}</span>
                                    </div>
                                    <i data-lucide="chevrons-up-down" class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex-shrink-0 ml-1"></i>
                                  </button>

                                  <!-- Popover Floating Menu with Clear Grouping -->
                                  <div class="action-dropdown-menu hidden absolute right-0 mt-1.5 w-64 sm:w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                                    
                                    <!-- Group 1: Pindah Kelas -->
                                    <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                      Pindah Kelas
                                    </div>
                                    
                                    <!-- Option 1: Promote Auto -->
                                    <button type="button" class="btn-select-action-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${currentActionVal === 'promote_auto' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}" data-value="promote_auto" data-kelas-id="${k.id}">
                                      <div class="flex items-center gap-2 min-w-0">
                                        <div class="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                                          <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
                                        </div>
                                        <div class="min-w-0">
                                          <div class="truncate text-slate-900 dark:text-slate-100 font-extrabold">${m.target_kelas_nama || 'Naik Kelas'} (Otomatis)</div>
                                          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal block leading-tight">Naik rombel sesuai tingkatan kelas</span>
                                        </div>
                                      </div>
                                      ${currentActionVal === 'promote_auto' ? '<i data-lucide="check" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-1"></i>' : ''}
                                    </button>

                                    <!-- Option 2: Promote Custom -->
                                    <button type="button" class="btn-select-action-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${currentActionVal === 'promote_custom' ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 border border-sky-200/80 dark:border-sky-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}" data-value="promote_custom" data-kelas-id="${k.id}">
                                      <div class="flex items-center gap-2 min-w-0">
                                        <div class="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 flex-shrink-0">
                                          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                        </div>
                                        <div class="min-w-0">
                                          <div class="truncate text-slate-900 dark:text-slate-100 font-extrabold">Nama Kelas Kustom...</div>
                                          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal block leading-tight">Tentukan nama rombel tujuan secara manual</span>
                                        </div>
                                      </div>
                                      ${currentActionVal === 'promote_custom' ? '<i data-lucide="check" class="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0 ml-1"></i>' : ''}
                                    </button>

                                    <div class="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                                    <!-- Group 2: Aksi Khusus -->
                                    <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                      Aksi Khusus
                                    </div>

                                    <!-- Option 3: Graduate -->
                                    <button type="button" class="btn-select-action-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${currentActionVal === 'graduate' ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-950 dark:text-purple-200 border border-purple-200/80 dark:border-purple-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-purple-800 dark:text-purple-300'}" data-value="graduate" data-kelas-id="${k.id}">
                                      <div class="flex items-center gap-2 min-w-0">
                                        <div class="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex-shrink-0">
                                          <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>
                                        </div>
                                        <div class="min-w-0">
                                          <div class="truncate text-purple-900 dark:text-purple-200 font-extrabold">Lulus / Selesai (Non-Aktif)</div>
                                          <span class="text-[10px] text-purple-400 dark:text-purple-500 font-normal block leading-tight">Siswa dinyatakan lulus & dinonaktifkan</span>
                                        </div>
                                      </div>
                                      ${currentActionVal === 'graduate' ? '<i data-lucide="check" class="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 ml-1"></i>' : ''}
                                    </button>

                                    <!-- Option 4: Skip -->
                                    <button type="button" class="btn-select-action-item w-full text-left p-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${currentActionVal === 'skip' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}" data-value="skip" data-kelas-id="${k.id}">
                                      <div class="flex items-center gap-2 min-w-0">
                                        <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex-shrink-0">
                                          <i data-lucide="skip-forward" class="w-3.5 h-3.5"></i>
                                        </div>
                                        <div class="min-w-0">
                                          <div class="truncate text-slate-800 dark:text-slate-200 font-extrabold">Lewati (Jangan Dipindahkan)</div>
                                          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal block leading-tight">Kelas tetap berada di tahun ajaran lama</span>
                                        </div>
                                      </div>
                                      ${currentActionVal === 'skip' ? '<i data-lucide="check" class="w-4 h-4 text-slate-600 dark:text-slate-400 flex-shrink-0 ml-1"></i>' : ''}
                                    </button>

                                  </div>
                                </div>
                              </div>
                            </div>

                            <!-- Custom Class Name Input if selected -->
                            ${m.is_custom_name && m.action === 'promote' ? `
                              <div class="pt-1 flex items-center gap-2">
                                <label class="text-[11px] font-bold text-slate-600">Nama Kelas Tujuan Baru:</label>
                                <input type="text" class="input-custom-class-name text-xs font-bold p-2 bg-white border border-emerald-300 rounded-xl flex-1 focus:ring-2 focus:ring-emerald-500 focus:outline-none" data-kelas-id="${k.id}" value="${m.target_kelas_nama}">
                              </div>
                            ` : ''}

                            <!-- Accordion Toggle Button for Students -->
                            <div class="border-t border-slate-100 pt-2 flex items-center justify-between">
                              <button class="btn-toggle-class-students text-[11px] font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 transition" data-kelas-id="${k.id}">
                                <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
                                <span>${isExpanded ? 'Tutup Rincian Siswa' : `Lihat & Kelola Siswa (${sList.length})`}</span>
                                ${Object.keys(m.student_overrides).length > 0 ? `
                                  <span class="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">${Object.keys(m.student_overrides).length} override</span>
                                ` : ''}
                              </button>

                              <span class="text-[10px] text-slate-400 font-medium">
                                ${m.action === 'graduate' ? 'Semua siswa diluluskan' : (m.action === 'skip' ? 'Kelas tidak dipindah' : `Target: ${m.target_kelas_nama}`)}
                              </span>
                            </div>

                            <!-- Accordion Body: Student List Overrides -->
                            ${isExpanded ? `
                              <div class="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 mt-2">
                                <div class="flex items-center justify-between pb-1 border-b border-slate-200">
                                  <span class="text-[10px] font-bold text-slate-600 uppercase">Daftar Siswa (${sList.length})</span>
                                  <span class="text-[10px] text-slate-400">Atur siswa yang tinggal kelas / lulus individual</span>
                                </div>

                                <div class="max-h-56 overflow-y-auto divide-y divide-slate-200/60 pr-1 text-xs">
                                  ${sList.map(s => {
                                    const ovr = m.student_overrides[s.id];
                                    const stAction = ovr?.action || 'inherit';

                                    return `
                                      <div class="py-1.5 flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2 min-w-0">
                                          <span class="w-6 text-center font-bold text-slate-400 dark:text-slate-500 text-[11px]">${s.nomor_absen || '-'}</span>
                                          <div class="min-w-0">
                                            <p class="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">${s.nama_lengkap}</p>
                                            <span class="text-[10px] text-slate-400 dark:text-slate-500">${s.nisn ? `NISN: ${s.nisn}` : (s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan')}</span>
                                          </div>
                                        </div>

                                        <select class="select-student-override bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer transition shadow-2xs" data-kelas-id="${k.id}" data-siswa-id="${s.id}">
                                          <option value="inherit" class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium" ${stAction === 'inherit' ? 'selected' : ''}>
                                            Mengikuti Kelas (${m.action === 'graduate' ? 'Lulus' : m.target_kelas_nama})
                                          </option>
                                          <option value="retain" class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium" ${stAction === 'retain' ? 'selected' : ''}>
                                            ⚠️ Tinggal Kelas (Tetap)
                                          </option>
                                          <option value="graduate" class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium" ${stAction === 'graduate' ? 'selected' : ''}>
                                            🎓 Lulus / Selesai
                                          </option>
                                        </select>
                                      </div>
                                    `;
                                  }).join('')}
                                </div>
                              </div>
                            ` : ''}

                          </div>
                        `;
                      }).join('')}
                    </div>
                  `}
                </div>

                <!-- Footer Navigation Buttons on Mapping Tab -->
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <button id="btn-cancel-mapping" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition">
                    Batal
                  </button>

                  <button id="btn-go-to-preview" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-900/30 flex items-center justify-center gap-1.5 transition transform active:scale-95">
                    <span>Lanjut ke Preview (${totalPromotingStudents} Siswa Naik)</span>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                  </button>
                </div>

              </div>
            `}

          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // ========================================================================
    // BIND EVENT LISTENERS
    // ========================================================================
    
    // Close Modal
    modalContainer.querySelector('#btn-close-kenaikan-modal')?.addEventListener('click', onClose);
    modalContainer.querySelector('#btn-cancel-mapping')?.addEventListener('click', onClose);
    modalContainer.querySelector('#btn-result-close')?.addEventListener('click', () => {
      onClose();
      if (onDataUpdated) onDataUpdated();
    });

    // Step Switch Buttons
    modalContainer.querySelector('#step-btn-mapping')?.addEventListener('click', () => {
      activeStep = 'mapping';
      renderModalContent();
    });

    modalContainer.querySelector('#step-btn-preview')?.addEventListener('click', () => {
      activeStep = 'preview';
      renderModalContent();
    });

    modalContainer.querySelector('#btn-go-to-preview')?.addEventListener('click', () => {
      activeStep = 'preview';
      renderModalContent();
    });

    modalContainer.querySelector('#btn-preview-back')?.addEventListener('click', () => {
      activeStep = 'mapping';
      renderModalContent();
    });

    // Source Year Change via Combobox
    initAcademicYearCombobox(modalContainer, {
      id: 'select-source-year',
      onSelect: async (val) => {
        sourceYear = val;
        targetYear = getNextYearSuggestion(sourceYear);
        isCustomTargetYear = false;
        await loadSourceData();
        renderModalContent();
      }
    });

    // Target Year Change via Combobox
    initAcademicYearCombobox(modalContainer, {
      id: 'select-target-year',
      onSelect: async (val, isCustom) => {
        if (isCustom || val === '__custom__') {
          isCustomTargetYear = true;
          customTargetYearInput = getNextYearSuggestion(sourceYear);
        } else {
          isCustomTargetYear = false;
          targetYear = val;
        }
        targetYearSafeguard = await db.checkKenaikanSafeguard(sourceYear, isCustomTargetYear ? customTargetYearInput : targetYear);
        renderModalContent();
      }
    });

    // Custom Target Year Input Change
    modalContainer.querySelector('#input-custom-target-year')?.addEventListener('input', async (e) => {
      customTargetYearInput = e.target.value;
      targetYearSafeguard = await db.checkKenaikanSafeguard(sourceYear, customTargetYearInput);
    });

    // Reset Auto Guess Button
    modalContainer.querySelector('#btn-auto-guess-all')?.addEventListener('click', () => {
      Object.keys(classMappings).forEach(kId => {
        const m = classMappings[kId];
        const pred = predictTargetClass(m.source_kelas_nama, m.tingkat, m.jurusan);
        m.action = pred.action;
        m.target_kelas_nama = pred.target_kelas_nama;
        m.target_tingkat = pred.target_tingkat;
        m.is_custom_name = false;
        m.student_overrides = {};
      });
      showToast('Seluruh kelas berhasil direset ke prediksi nama otomatis!', 'info');
      renderModalContent();
    });

    // Custom Class Action Combobox Dropdowns
    modalContainer.querySelectorAll('.btn-toggle-action-dropdown').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = btn.closest('.custom-class-action-combobox');
        const menu = wrapper?.querySelector('.action-dropdown-menu');
        const isHidden = menu?.classList.contains('hidden');

        // Hide all open dropdown menus first
        modalContainer.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.add('hidden'));
        modalContainer.querySelectorAll('.btn-toggle-action-dropdown').forEach(b => b.setAttribute('aria-expanded', 'false'));

        if (isHidden && menu) {
          menu.classList.remove('hidden');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // Select Item from Action Dropdown Menu
    modalContainer.querySelectorAll('.btn-select-action-item').forEach(itemBtn => {
      itemBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kId = itemBtn.getAttribute('data-kelas-id');
        const val = itemBtn.getAttribute('data-value');
        const m = classMappings[kId];
        if (!m) return;

        if (val === 'promote_auto') {
          const pred = predictTargetClass(m.source_kelas_nama, m.tingkat, m.jurusan);
          m.action = 'promote';
          m.target_kelas_nama = pred.target_kelas_nama;
          m.is_custom_name = false;
        } else if (val === 'promote_custom') {
          m.action = 'promote';
          m.is_custom_name = true;
          if (!m.target_kelas_nama || m.target_kelas_nama === 'Lulus / Selesai') {
            m.target_kelas_nama = `XI ${m.source_kelas_nama}`;
          }
        } else if (val === 'graduate') {
          m.action = 'graduate';
          m.target_kelas_nama = 'Lulus / Selesai';
          m.is_custom_name = false;
        } else if (val === 'skip') {
          m.action = 'skip';
          m.is_custom_name = false;
        }

        renderModalContent();
      });
    });

    // Close Dropdown Menu on Outside Click
    modalContainer.addEventListener('click', () => {
      modalContainer.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.add('hidden'));
      modalContainer.querySelectorAll('.btn-toggle-action-dropdown').forEach(b => b.setAttribute('aria-expanded', 'false'));
    });

    // Custom Class Name Input
    modalContainer.querySelectorAll('.input-custom-class-name').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const kId = inp.getAttribute('data-kelas-id');
        if (classMappings[kId]) {
          classMappings[kId].target_kelas_nama = e.target.value;
        }
      });
    });

    // Accordion Toggle for Students
    modalContainer.querySelectorAll('.btn-toggle-class-students').forEach(btn => {
      btn.addEventListener('click', () => {
        const kId = btn.getAttribute('data-kelas-id');
        expandedClassId = expandedClassId === kId ? null : kId;
        renderModalContent();
      });
    });

    // Student Overrides Change
    modalContainer.querySelectorAll('.select-student-override').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const kId = sel.getAttribute('data-kelas-id');
        const sId = sel.getAttribute('data-siswa-id');
        const val = e.target.value;
        const m = classMappings[kId];
        if (!m) return;

        if (val === 'inherit') {
          delete m.student_overrides[sId];
        } else {
          m.student_overrides[sId] = {
            siswa_id: sId,
            action: val // 'retain' | 'graduate'
          };
        }
      });
    });

    // Confirmation Checkbox on Preview
    const chkConfirm = modalContainer.querySelector('#check-confirm-kenaikan');
    const btnExecute = modalContainer.querySelector('#btn-submit-execute-kenaikan');
    if (chkConfirm && btnExecute) {
      chkConfirm.addEventListener('change', (e) => {
        btnExecute.disabled = !e.target.checked;
      });
    }

    // Submit Execute Kenaikan Kelas
    btnExecute?.addEventListener('click', async () => {
      activeStep = 'executing';
      isExecuting = true;
      renderModalContent();

      try {
        const effectiveTarget = (isCustomTargetYear ? customTargetYearInput : targetYear).trim();
        
        // Buat payload mappings
        const payloadMappings = Object.values(classMappings).map(m => {
          const studentOverridesArray = Object.values(m.student_overrides || {});
          return {
            source_kelas_id: m.source_kelas_id,
            target_kelas_nama: m.target_kelas_nama,
            target_tingkat: m.target_tingkat || 'XI',
            target_jurusan: m.target_jurusan || 'Teknik Jaringan Komputer dan Telekomunikasi',
            action: m.action,
            student_overrides: studentOverridesArray
          };
        });

        const res = await db.processKenaikanKelas({
          sourceYear: sourceYear,
          targetYear: effectiveTarget,
          mappings: payloadMappings
        });

        if (res.success) {
          executionResult = res;
          activeStep = 'result';
          isExecuting = false;
          showToast('Kenaikan kelas berhasil diproses!', 'success');
          renderModalContent();
        } else {
          throw new Error(res.message || 'Gagal memproses kenaikan kelas.');
        }
      } catch (err) {
        console.error('Kenaikan Kelas Execution Error:', err);
        showToast('Gagal memproses: ' + err.message, 'error');
        activeStep = 'preview';
        isExecuting = false;
        renderModalContent();
      }
    });

    // Switch Year on Result Screen
    modalContainer.querySelector('#btn-result-switch-year')?.addEventListener('click', async () => {
      const effectiveTarget = (executionResult?.target_academic_year || (isCustomTargetYear ? customTargetYearInput : targetYear)).trim();
      onClose();
      if (onDataUpdated) {
        await onDataUpdated(effectiveTarget);
      }
    });
  }

  // Initial Load
  await loadSourceData();
  await renderModalContent();
}
