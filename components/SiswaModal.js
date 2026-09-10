// components/SiswaModal.js - Modal Kelola Kelas, Siswa & Import dari Excel (.xlsx / .csv)
import { db } from '../supabase-client.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderTingkatComboboxHTML, initTingkatCombobox } from './TingkatCombobox.js';
import { renderJurusanComboboxHTML, initJurusanCombobox } from './JurusanCombobox.js';
import { renderAcademicYearComboboxHTML, initAcademicYearCombobox } from './AcademicYearCombobox.js';
import { renderKenaikanKelasModal } from './KenaikanKelasModal.js';

export async function renderSiswaModal(modalContainer, onClose, onDataUpdated, showToast, activeNavYear) {
  const defaultAcademicYear = activeNavYear || await db.getActiveAcademicYear();
  let selectedImportAcademicYear = defaultAcademicYear;
  let availableAcademicYears = await db.getDistinctAcademicYears();
  if (!availableAcademicYears.includes(selectedImportAcademicYear)) {
    availableAcademicYears.unshift(selectedImportAcademicYear);
  }

  let kelasList = await db.getClassesByYear(selectedImportAcademicYear);
  let activeKelasId = kelasList[0]?.id || '';
  let activeMainTab = 'kelas'; // 'kelas' | 'siswa-list' | 'siswa-add' | 'siswa-import'

  // State untuk parsed data Excel import
  let rawFileBuffer = null;
  let parsedExcelData = []; // [{ nisn, nama_lengkap, jenis_kelamin, kelas_nama, jurusan_id, jurusan_nama, kelas_id, is_new_class, status: 'valid'|'warning'|'error', message: '' }]
  let isParsingFile = false;

  // Helper pemetaan jurusan dengan data Master Jurusan
  function matchJurusanMaster(rawJurusan, masterList = []) {
    const trimmed = (rawJurusan || '').trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    return masterList.find(j => 
      (j.kode && j.kode.trim().toLowerCase() === lower) || 
      (j.nama && j.nama.trim().toLowerCase() === lower)
    ) || null;
  }

  function deduceTingkat(namaKelas) {
    const upper = (namaKelas || '').toUpperCase();
    if (upper.startsWith('XII') || upper.includes(' 12') || upper.includes('XII')) return 'XII';
    if (upper.startsWith('XI') || upper.includes(' 11') || upper.includes('XI')) return 'XI';
    return 'X';
  }

  async function loadModalContent() {
    const currentUser = await db.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    if (!isAdmin && (activeMainTab === 'siswa-add' || activeMainTab === 'siswa-import')) {
      activeMainTab = 'kelas';
    }

    const [fetchedKelasList, fetchedJurusanList] = await Promise.all([
      db.getClassesByYear(selectedImportAcademicYear),
      db.getJurusanList()
    ]);
    kelasList = fetchedKelasList;
    const availableJurusanList = fetchedJurusanList || [];
    if (!kelasList.find(k => k.id === activeKelasId) && kelasList.length > 0) {
      activeKelasId = kelasList[0].id;
    }

    const siswaList = activeKelasId ? await db.getSiswaByKelas(activeKelasId) : [];
    const activeKelasObj = kelasList.find(k => k.id === activeKelasId);

    // Ambil seluruh siswa untuk validasi duplikat NISN
    let allExistingSiswa = [];
    try {
      for (const k of kelasList) {
        const sList = await db.getSiswaByKelas(k.id);
        allExistingSiswa = allExistingSiswa.concat(sList);
      }
    } catch {
      allExistingSiswa = JSON.parse(localStorage.getItem('absen_db_siswa') || '[]');
    }

    const siswaCountPerKelas = {};
    allExistingSiswa.forEach(s => {
      siswaCountPerKelas[s.kelas_id] = (siswaCountPerKelas[s.kelas_id] || 0) + 1;
    });

    // Hitung ringkasan validasi excel
    const validCount = parsedExcelData.filter(d => d.status === 'valid').length;
    const warningCount = parsedExcelData.filter(d => d.status === 'warning').length;
    const errorCount = parsedExcelData.filter(d => d.status === 'error').length;
    const newClassCount = new Set(parsedExcelData.filter(d => d.is_new_class).map(d => d.kelas_nama)).size;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <i data-lucide="school" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 class="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">Data Master Kelas & Siswa</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Kelola kelas, jurusan, daftar siswa, & impor massal via Excel</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              ${isAdmin ? `
              <button id="btn-open-kenaikan-from-siswa" class="text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition" title="Buka Kenaikan Kelas">
                <i data-lucide="trending-up" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"></i>
                <span class="hidden sm:inline">Kenaikan Kelas</span>
              </button>
              ` : ''}
              <button id="btn-close-siswa-modal" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <i data-lucide="x" class="w-5 h-5"></i>
              </button>
            </div>
          </div>

          <!-- Main Nav Tabs (Kelas vs Siswa) -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 flex-shrink-0">
            <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 text-xs font-bold">
              <button id="tab-nav-kelas" class="px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${activeMainTab === 'kelas' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}">
                <i data-lucide="layout-grid" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                <span>Kelola Kelas (${kelasList.length})</span>
              </button>

              <button id="tab-nav-siswa-list" class="px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${activeMainTab === 'siswa-list' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}">
                <i data-lucide="users" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                <span>Daftar Siswa (${siswaList.length})</span>
              </button>

              ${isAdmin ? `
              <button id="tab-nav-siswa-add" class="px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${activeMainTab === 'siswa-add' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}">
                <i data-lucide="user-plus" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                <span>+ Tambah Siswa</span>
              </button>

              <button id="tab-nav-siswa-import" class="px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${activeMainTab === 'siswa-import' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs font-black ring-1 ring-emerald-500/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}">
                <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                <span>Impor Excel / CSV</span>
              </button>
              ` : ''}
            </div>

            ${activeMainTab !== 'kelas' && activeMainTab !== 'siswa-import' ? `
              <div class="flex items-center gap-1.5 min-w-[200px] sm:min-w-[240px]">
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">Filter Kelas:</span>
                <div class="flex-1">
                  ${renderClassComboboxHTML({
                    id: 'modal-select-kelas',
                    kelasList,
                    selectedId: activeKelasId,
                    size: 'sm'
                  })}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Tab Content Area -->
          <div class="flex-1 overflow-y-auto pr-1 text-xs">
            
            <!-- ============================================================= -->
            <!-- PANEL 1: KELOLA KELAS (TAMBAH & DAFTAR KELAS) -->
            <!-- ============================================================= -->
            <div id="panel-kelas" class="${activeMainTab === 'kelas' ? '' : 'hidden'} space-y-4">
              ${isAdmin ? `
              <!-- Form Tambah Kelas Baru -->
              <div class="bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-slate-800/80 dark:to-slate-800/60 p-4 rounded-2xl border border-emerald-200/80 dark:border-slate-700 space-y-3">
                <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                  <span>Tambah Kelas Baru</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-start">
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Kelas <span class="text-rose-500">*</span></label>
                    <input type="text" id="input-kelas-nama" placeholder="Contoh: X TJKT 1" class="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold">
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Tingkat Kelas <span class="text-rose-500">*</span></label>
                    ${renderTingkatComboboxHTML({
                      id: 'input-kelas-tingkat',
                      selectedValue: 'X',
                      size: 'sm'
                    })}
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Program Keahlian / Jurusan <span class="text-rose-500">*</span></label>
                    ${renderJurusanComboboxHTML({
                      id: 'input-kelas-jurusan',
                      selectedId: availableJurusanList[0]?.id || '',
                      jurusanList: availableJurusanList,
                      isAdmin,
                      size: 'sm'
                    })}
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Tahun Ajaran</label>
                    <input type="text" id="input-kelas-tahun" value="${selectedImportAcademicYear || '2026/2027'}" placeholder="2026/2027" class="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold">
                  </div>
                </div>

                <div class="flex justify-end pt-1">
                  <button id="btn-submit-add-kelas" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 transform active:scale-95">
                    <i data-lucide="check" class="w-4 h-4"></i>
                    <span>Simpan Kelas Baru</span>
                  </button>
                </div>
              </div>
              ` : `
              <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-2">
                <i data-lucide="lock" class="w-4 h-4 text-slate-400 flex-shrink-0"></i>
                <span>Data kelas dan siswa dikelola secara terpusat oleh Administrator sekolah.</span>
              </div>
              `}

              <!-- Daftar Seluruh Kelas -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Daftar Kelas Terdaftar (${kelasList.length})</h4>
                
                ${kelasList.length === 0 ? `
                  <div class="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">Belum ada kelas yang terdaftar. Tambahkan kelas di atas.</div>
                ` : kelasList.map(k => {
                  const count = siswaCountPerKelas[k.id] || 0;
                  const jurusanDisplay = k.jurusan_master?.nama || k.jurusan || 'Tanpa Jurusan';
                  return `
                    <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 transition shadow-2xs">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                          ${k.tingkat || 'X'}
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-800 dark:text-slate-100 text-sm">${k.nama_kelas}</span>
                            <span class="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">${count} Siswa</span>
                            <span class="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">TA: ${k.academic_year || '2026/2027'}</span>
                            <span class="text-[10px] font-bold ${k.is_active !== false ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'} px-2 py-0.5 rounded-full">${k.is_active !== false ? 'Aktif' : 'Non-Aktif'}</span>
                          </div>
                          <p class="text-[11px] text-slate-500 dark:text-slate-400">${jurusanDisplay}</p>
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5">
                        <button class="btn-select-kelas-to-manage text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 transition flex items-center gap-1" data-kelas-id="${k.id}">
                          <span>${isAdmin ? 'Kelola Siswa' : 'Lihat Siswa'}</span>
                          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </button>
                        ${isAdmin ? `
                        <button class="btn-delete-kelas p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition" data-id="${k.id}" data-nama="${k.nama_kelas}" title="Hapus Kelas">
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- ============================================================= -->
            <!-- PANEL 2: DAFTAR SISWA DALAM KELAS -->
            <!-- ============================================================= -->
            <div id="panel-siswa-list" class="${activeMainTab === 'siswa-list' ? '' : 'hidden'} space-y-3">
              <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    Kelas: ${activeKelasObj?.nama_kelas || 'Kelas'}
                  </h4>
                  <p class="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Jurusan: <strong>${activeKelasObj?.jurusan_master?.nama || activeKelasObj?.jurusan || 'Tanpa Jurusan'}</strong> | Total Siswa: ${siswaList.length} orang</p>
                </div>
                ${isAdmin ? `
                <button id="btn-go-to-add-siswa" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-xs transition">
                  <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                  <span>+ Tambah Siswa</span>
                </button>
                ` : ''}
              </div>

              ${siswaList.length === 0 ? `
                <div class="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <i data-lucide="users" class="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600"></i>
                  <p class="font-semibold text-slate-600 dark:text-slate-300">Belum ada siswa di kelas ini.</p>
                  <p class="text-[11px]">${isAdmin ? 'Gunakan menu "Impor Excel" untuk memasukkan data siswa secara cepat.' : 'Hubungi Administrator untuk memasukkan data siswa.'}</p>
                </div>
              ` : `
                <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table class="w-full text-xs text-left">
                    <thead class="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th class="py-2.5 px-3 text-center w-12">No</th>
                        <th class="py-2.5 px-3">Nama Lengkap Siswa</th>
                        <th class="py-2.5 px-3 text-center w-28">NISN</th>
                        <th class="py-2.5 px-3 text-center w-20">L/P</th>
                        ${isAdmin ? `<th class="py-2.5 px-3 text-center w-20">Aksi</th>` : ''}
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      ${siswaList.map((s, idx) => `
                        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                          <td class="py-2.5 px-3 text-center font-bold text-slate-500 dark:text-slate-400">${s.nomor_absen || (idx + 1)}</td>
                          <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">${s.nama_lengkap}</td>
                          <td class="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">${s.nisn || '-'}</td>
                          <td class="py-2.5 px-3 text-center">
                            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${s.jenis_kelamin === 'P' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'}">
                              ${s.jenis_kelamin || 'L'}
                            </span>
                          </td>
                          ${isAdmin ? `
                          <td class="py-2.5 px-3 text-center">
                            <button class="btn-delete-single-siswa p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition" data-id="${s.id}" data-nama="${s.nama_lengkap}" title="Hapus Siswa">
                              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                          </td>
                          ` : ''}
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>

            <!-- ============================================================= -->
            <!-- PANEL 3: TAMBAH SATU SISWA -->
            <!-- ============================================================= -->
            <div id="panel-siswa-add" class="${activeMainTab === 'siswa-add' ? '' : 'hidden'} space-y-3.5">
              <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                Menambahkan siswa baru ke: <strong class="font-bold">${activeKelasObj?.nama_kelas || 'Kelas'}</strong>${activeKelasObj?.jurusan ? ` (${activeKelasObj.jurusan})` : ''}
              </div>

              <div class="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap Siswa <span class="text-rose-500">*</span></label>
                  <input type="text" id="input-add-nama" placeholder="Contoh: Muh. Farhan Ramadhan" class="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold">
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nomor Absen</label>
                    <input type="number" id="input-add-absen" value="${siswaList.length + 1}" class="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold">
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Jenis Kelamin</label>
                    <div class="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button type="button" id="btn-jk-l" class="btn-toggle-jk py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-xs ring-1 ring-blue-400/40" data-jk="L">
                        <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>Laki-laki (L)</span>
                      </button>
                      <button type="button" id="btn-jk-p" class="btn-toggle-jk py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" data-jk="P">
                        <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                        <span>Perempuan (P)</span>
                      </button>
                    </div>
                    <input type="hidden" id="input-add-jk" value="L">
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">NISN (Opsional)</label>
                  <input type="text" id="input-add-nisn" placeholder="Contoh: 0081234567" class="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono">
                </div>

                <button id="btn-submit-add-siswa" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5">
                  <i data-lucide="plus" class="w-4 h-4"></i>
                  <span>Simpan Siswa ke Kelas ${activeKelasObj?.nama_kelas || ''}</span>
                </button>
              </div>
            </div>

            <!-- ============================================================= -->
            <!-- PANEL 4: IMPOR SISWA DARI EXCEL (.XLSX / .CSV) DENGAN PREVIEW -->
            <!-- ============================================================= -->
            <div id="panel-siswa-import" class="${activeMainTab === 'siswa-import' ? '' : 'hidden'} space-y-3.5">
              
              <!-- 1. Inline Target Tahun Ajaran (Ringkas & Compact) -->
              <div class="bg-slate-50 border border-slate-200/90 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
                <div class="flex items-center gap-2">
                  <div class="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <i data-lucide="calendar" class="w-4 h-4"></i>
                  </div>
                  <div class="flex items-center gap-1.5 text-xs">
                    <span class="font-bold text-slate-700">Target Tahun Ajaran:</span>
                    <span class="bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-lg text-xs shadow-2xs tracking-wide">
                      ${selectedImportAcademicYear}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2 min-w-[200px] sm:min-w-[240px]">
                  <label class="text-[11px] font-semibold text-slate-500 flex-shrink-0">Ganti Target:</label>
                  <div class="flex-1">
                    ${renderAcademicYearComboboxHTML({
                      id: 'import-select-academic-year',
                      years: availableAcademicYears,
                      selectedYear: selectedImportAcademicYear,
                      allowCustom: true,
                      size: 'sm'
                    })}
                  </div>
                </div>
              </div>

              <!-- 2. Card Instruksi Format Kolom (Fokus & Terstruktur) -->
              <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div>
                    <h4 class="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i>
                      <span>Format Kolom Excel / CSV</span>
                    </h4>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      Pastikan baris pertama file Excel memuat kolom-kolom berikut:
                    </p>
                  </div>

                  <!-- Tombol Download Template Excel -->
                  <button id="btn-download-excel-template" type="button" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition transform active:scale-95 flex-shrink-0 self-start sm:self-auto">
                    <i data-lucide="download" class="w-4 h-4 text-emerald-600"></i>
                    <span>Download Template (.xlsx)</span>
                  </button>
                </div>

                <!-- Badges Kolom: Wajib (Solid Hijau) vs Opsional (Outline) -->
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-1 bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-2xs">
                    <i data-lucide="check" class="w-3 h-3"></i>
                    Nama Siswa <span class="bg-emerald-800 text-[9px] px-1 py-0.2 rounded font-black uppercase">Wajib</span>
                  </span>

                  <span class="inline-flex items-center gap-1 bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-2xs">
                    <i data-lucide="check" class="w-3 h-3"></i>
                    Kelas <span class="bg-emerald-800 text-[9px] px-1 py-0.2 rounded font-black uppercase">Wajib</span>
                  </span>

                  <span class="inline-flex items-center gap-1 bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-2xs">
                    <i data-lucide="check" class="w-3 h-3"></i>
                    Jenis Kelamin (L/P) <span class="bg-emerald-800 text-[9px] px-1 py-0.2 rounded font-black uppercase">Wajib</span>
                  </span>

                  <span class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-2.5 py-1 rounded-lg text-[11px]">
                    NISN <span class="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-bold uppercase">Opsional</span>
                  </span>

                  <span class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-2.5 py-1 rounded-lg text-[11px]">
                    Jurusan <span class="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-bold uppercase">Opsional</span>
                  </span>
                </div>
              </div>

              <!-- 3. Area Drag & Drop Upload (Besar, Jelas, & Kontras) -->
              <div id="dropzone-excel" class="border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-gradient-to-b from-emerald-50/30 to-emerald-50/70 hover:bg-emerald-50 rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 group">
                <input type="file" id="input-excel-file" accept=".xlsx, .xls, .csv" class="hidden">
                
                <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition transform">
                  <i data-lucide="upload-cloud" class="w-8 h-8"></i>
                </div>

                <div class="space-y-1 max-w-md">
                  <p class="font-black text-slate-800 text-xs sm:text-sm">
                    ${isParsingFile ? 'Sedang membaca & memvalidasi file...' : 'Tarik file Excel / CSV ke sini, atau klik untuk memilih file'}
                  </p>
                  <p class="text-[11px] text-slate-500">
                    Mendukung format: <span class="font-bold text-emerald-700">.xlsx, .xls, .csv</span> • Kelas & Jurusan baru akan otomatis dibuat
                  </p>
                </div>

                <button type="button" id="btn-browse-file" class="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition transform active:scale-95 inline-flex items-center gap-2">
                  <i data-lucide="folder-open" class="w-4 h-4"></i>
                  <span>Pilih File dari Komputer</span>
                </button>
              </div>

              <!-- Preview & Validasi Data Table (Jika ada file diunggah) -->
              ${parsedExcelData.length > 0 ? `
                <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-in fade-in duration-200">
                  
                  <!-- Ringkasan Validasi Badges -->
                  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-2">
                      <h4 class="font-bold text-slate-800 text-xs sm:text-sm">
                        Preview Data (${parsedExcelData.length} Siswa Terdeteksi)
                      </h4>
                    </div>

                    <div class="flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span class="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-600"></i>
                        <span>${validCount} Siap</span>
                      </span>

                      ${newClassCount > 0 ? `
                        <span class="px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <i data-lucide="sparkles" class="w-3 h-3 text-indigo-600"></i>
                          <span>${newClassCount} Kelas Baru Dibuat</span>
                        </span>
                      ` : ''}

                      ${warningCount > 0 ? `
                        <span class="px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <i data-lucide="alert-triangle" class="w-3 h-3 text-amber-600"></i>
                          <span>${warningCount} Peringatan (NISN Duplikat)</span>
                        </span>
                      ` : ''}

                      ${errorCount > 0 ? `
                        <span class="px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <i data-lucide="alert-circle" class="w-3 h-3 text-rose-600"></i>
                          <span>${errorCount} Error (Nama Kosong)</span>
                        </span>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Tabel Preview -->
                  <div class="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                    <table class="w-full text-xs text-left">
                      <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th class="py-2 px-2.5 text-center w-10">No</th>
                          <th class="py-2 px-2.5 w-24">NISN</th>
                          <th class="py-2 px-2.5">Nama Siswa</th>
                          <th class="py-2 px-2.5 text-center w-12">L/P</th>
                          <th class="py-2 px-2.5 w-24">Kelas</th>
                          <th class="py-2 px-2.5 w-40">Jurusan</th>
                          <th class="py-2 px-2.5 text-center w-36">Status Validasi</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 bg-white">
                        ${parsedExcelData.map((row, idx) => `
                          <tr class="hover:bg-slate-50/80 transition ${row.status === 'error' ? 'bg-rose-50/40' : row.status === 'warning' ? 'bg-amber-50/30' : ''}">
                            <td class="py-2 px-2.5 text-center font-bold text-slate-500">${idx + 1}</td>
                            <td class="py-2 px-2.5 font-mono text-slate-700">${row.nisn || '-'}</td>
                            <td class="py-2 px-2.5 font-bold ${row.status === 'error' ? 'text-rose-700' : 'text-slate-900'}">
                              ${row.nama_lengkap || '<span class="text-rose-500 italic">[Nama Kosong]</span>'}
                            </td>
                            <td class="py-2 px-2.5 text-center font-bold">${row.jenis_kelamin || 'L'}</td>
                            <td class="py-2 px-2.5 font-bold text-emerald-800">
                              ${row.kelas_nama}
                              ${row.is_new_class ? '<span class="ml-1 text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded font-bold">Baru</span>' : ''}
                            </td>
                            <td class="py-2 px-2.5 text-slate-600 truncate max-w-[160px]" title="${row.jurusan_nama}">
                              ${row.jurusan_nama}
                            </td>
                            <td class="py-2 px-2.5 text-center">
                              ${row.status === 'valid' ? `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${row.is_new_class ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                                  ${row.is_new_class ? '✨ Kelas Baru + Siap' : '✓ Siap Simpan'}
                                </span>
                              ` : row.status === 'warning' ? `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300" title="${row.message}">
                                  ⚠️ ${row.message}
                                </span>
                              ` : `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300" title="${row.message}">
                                  ✕ ${row.message}
                                </span>
                              `}
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>

                  <!-- Tombol Eksekusi Simpan -->
                  <div class="pt-2 flex items-center justify-between gap-3">
                    <button type="button" id="btn-cancel-excel-preview" class="text-slate-500 hover:text-slate-800 font-semibold text-xs">
                      Batalkan & Unggah Ulang
                    </button>

                    <button type="button" id="btn-execute-import" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition transform active:scale-95">
                      <i data-lucide="check" class="w-4 h-4"></i>
                      <span>Proses & Simpan ${(validCount + warningCount)} Siswa ke T.A ${selectedImportAcademicYear}</span>
                    </button>
                  </div>

                </div>
              ` : ''}

            </div>

          </div>

          <!-- Footer -->
          <div class="pt-3 border-t border-slate-100 flex justify-end flex-shrink-0">
            <button id="btn-close-siswa-footer" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition transform active:scale-95">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Selesai & Tutup</span>
            </button>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // =========================================================================
    // EVENT BINDINGS
    // =========================================================================

    // Tab Navigation switching
    modalContainer.querySelector('#tab-nav-kelas')?.addEventListener('click', () => {
      activeMainTab = 'kelas';
      loadModalContent();
    });
    modalContainer.querySelector('#tab-nav-siswa-list')?.addEventListener('click', () => {
      activeMainTab = 'siswa-list';
      loadModalContent();
    });
    modalContainer.querySelector('#tab-nav-siswa-add')?.addEventListener('click', () => {
      activeMainTab = 'siswa-add';
      loadModalContent();
    });
    modalContainer.querySelector('#tab-nav-siswa-import')?.addEventListener('click', () => {
      activeMainTab = 'siswa-import';
      loadModalContent();
    });

    // Inisialisasi ClassCombobox di Modal Kelas & Siswa
    initClassCombobox(modalContainer, {
      id: 'modal-select-kelas',
      kelasList,
      selectedId: activeKelasId,
      size: 'sm',
      onSelect: (newKId) => {
        activeKelasId = newKId;
        loadModalContent();
      }
    });

    // Inisialisasi Tingkat Combobox di Form Tambah Kelas
    initTingkatCombobox(modalContainer, {
      id: 'input-kelas-tingkat'
    });

    // Inisialisasi Jurusan Combobox di Form Tambah Kelas
    initJurusanCombobox(modalContainer, {
      id: 'input-kelas-jurusan',
      jurusanList: availableJurusanList,
      selectedId: availableJurusanList[0]?.id || '',
      isAdmin
    });

    // Inisialisasi Target Academic Year Combobox di Panel Import
    initAcademicYearCombobox(modalContainer, {
      id: 'import-select-academic-year',
      onSelect: (newYear, isCustom) => {
        if (isCustom || newYear === '__custom__' || newYear === '__NEW_YEAR__') {
          const customPrompt = prompt('Masukkan format tahun ajaran baru (contoh: 2027/2028):');
          if (customPrompt && customPrompt.trim()) {
            selectedImportAcademicYear = customPrompt.trim();
            if (!availableAcademicYears.includes(selectedImportAcademicYear)) {
              availableAcademicYears.push(selectedImportAcademicYear);
            }
          }
        } else {
          selectedImportAcademicYear = newYear;
        }
        loadModalContent();
      }
    });

    // Segmented Buttons Jenis Kelamin
    modalContainer.querySelectorAll('.btn-toggle-jk').forEach(btn => {
      btn.addEventListener('click', () => {
        const jk = btn.getAttribute('data-jk');
        const hiddenJk = modalContainer.querySelector('#input-add-jk');
        if (hiddenJk) hiddenJk.value = jk;

        modalContainer.querySelectorAll('.btn-toggle-jk').forEach(b => {
          b.className = 'btn-toggle-jk py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900';
        });

        if (jk === 'L') {
          btn.className = 'btn-toggle-jk py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white text-blue-800 shadow-xs ring-1 ring-blue-400/40';
        } else {
          btn.className = 'btn-toggle-jk py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white text-rose-800 shadow-xs ring-1 ring-rose-400/40';
        }
      });
    });

    modalContainer.querySelector('#btn-go-to-add-siswa')?.addEventListener('click', () => {
      activeMainTab = 'siswa-add';
      loadModalContent();
    });

    // Close buttons & Kenaikan Kelas modal
    modalContainer.querySelector('#btn-close-siswa-modal')?.addEventListener('click', onClose);
    modalContainer.querySelector('#btn-close-siswa-footer')?.addEventListener('click', onClose);
    modalContainer.querySelector('#btn-open-kenaikan-from-siswa')?.addEventListener('click', () => {
      renderKenaikanKelasModal(modalContainer, onClose, onDataUpdated, showToast, activeNavYear);
    });

    // ACTION 1: TAMBAH KELAS BARU
    modalContainer.querySelector('#btn-submit-add-kelas')?.addEventListener('click', async () => {
      const nama = modalContainer.querySelector('#input-kelas-nama').value.trim();
      const tingkat = modalContainer.querySelector('#input-kelas-tingkat').value;
      const jurusanId = modalContainer.querySelector('#input-kelas-jurusan').value || null;
      const tahun = modalContainer.querySelector('#input-kelas-tahun')?.value.trim() || selectedImportAcademicYear || '2026/2027';

      if (!nama) {
        showToast('Nama kelas tidak boleh kosong!', 'error');
        return;
      }

      const created = await db.addKelas({
        nama_kelas: nama,
        tingkat,
        jurusan_id: jurusanId,
        academic_year: tahun
      });

      showToast(`Kelas ${nama} berhasil ditambahkan!`, 'success');
      activeKelasId = created.id;
      onDataUpdated();
      loadModalContent();
    });

    // ACTION 2: HAPUS KELAS
    modalContainer.querySelectorAll('.btn-delete-kelas').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nama = btn.getAttribute('data-nama');
        if (id && confirm(`Apakah Anda yakin ingin menghapus kelas "${nama}" beserta seluruh siswa di dalamnya?`)) {
          await db.deleteKelas(id);
          showToast(`Kelas ${nama} telah dihapus`, 'info');
          onDataUpdated();
          loadModalContent();
        }
      });
    });

    // ACTION 3: PINDAH KE KELOLA SISWA KELAS TERTENTU
    modalContainer.querySelectorAll('.btn-select-kelas-to-manage').forEach(btn => {
      btn.addEventListener('click', () => {
        activeKelasId = btn.getAttribute('data-kelas-id');
        activeMainTab = 'siswa-list';
        loadModalContent();
      });
    });

    // ACTION 4: TAMBAH SATU SISWA
    modalContainer.querySelector('#btn-submit-add-siswa')?.addEventListener('click', async () => {
      const nama = modalContainer.querySelector('#input-add-nama').value.trim();
      const absen = parseInt(modalContainer.querySelector('#input-add-absen').value) || 1;
      const jk = modalContainer.querySelector('#input-add-jk').value;
      const nisn = modalContainer.querySelector('#input-add-nisn')?.value.trim() || '';

      if (!nama) {
        showToast('Nama siswa tidak boleh kosong!', 'error');
        return;
      }

      await db.addSiswa({
        kelas_id: activeKelasId,
        nama_lengkap: nama,
        nomor_absen: absen,
        jenis_kelamin: jk,
        nisn: nisn
      });

      showToast(`Siswa "${nama}" berhasil ditambahkan!`, 'success');
      onDataUpdated();
      activeMainTab = 'siswa-list';
      loadModalContent();
    });

    // ACTION 5: HAPUS SATU SISWA
    modalContainer.querySelectorAll('.btn-delete-single-siswa').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nama = btn.getAttribute('data-nama');
        if (id && confirm(`Apakah Anda yakin ingin menghapus data siswa "${nama}"?`)) {
          await db.deleteSiswa(id);
          showToast(`Siswa "${nama}" telah dihapus`, 'info');
          onDataUpdated();
          loadModalContent();
        }
      });
    });

    // =========================================================================
    // EXCEL IMPORT & TEMPLATE DOWNLOAD LOGIC (DENGAN MASTER JURUSAN)
    // =========================================================================

    // 1. Download Template Excel (.xlsx) Lengkap dengan Kelas & Jurusan
    modalContainer.querySelector('#btn-download-excel-template')?.addEventListener('click', () => {
      if (!window.XLSX) {
        showToast('Library SheetJS belum siap, silakan coba beberapa saat lagi.', 'error');
        return;
      }

      const templateData = [
        ['NISN (Opsional)', 'Nama Siswa (Wajib)', 'Jenis Kelamin (L/P)', 'Kelas (Wajib)', 'Jurusan (Opsional)'],
        ['0081234501', 'Ahmad Dani Pratama', 'L', 'X A 1', ''],
        ['', 'Bunga Citra Lestari', 'P', 'X A 1', ''],
        ['0081234503', 'Fajar Ramadhan', 'L', 'X B 1', ''],
        ['', 'Nurul Aulia Rahman', 'P', 'X B 1', '']
      ];

      const ws = window.XLSX.utils.aoa_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 18 }, // NISN (Opsional)
        { wch: 30 }, // Nama Siswa
        { wch: 18 }, // Jenis Kelamin
        { wch: 16 }, // Kelas
        { wch: 42 }  // Jurusan
      ];
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
      window.XLSX.writeFile(wb, 'Template_Import_Siswa.xlsx');
      showToast('Template Excel berhasil diunduh!', 'success');
    });

    // 2. File Upload Handler (via Button & Drag-Drop)
    const fileInput = modalContainer.querySelector('#input-excel-file');
    const dropzone = modalContainer.querySelector('#dropzone-excel');

    modalContainer.querySelector('#btn-browse-file')?.addEventListener('click', () => {
      fileInput?.click();
    });

    dropzone?.addEventListener('click', (e) => {
      if (e.target.id !== 'btn-browse-file') fileInput?.click();
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-emerald-500', 'bg-emerald-50/60');
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-emerald-500', 'bg-emerald-50/60');
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-emerald-500', 'bg-emerald-50/60');
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processExcelFile(files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        processExcelFile(file);
      }
    });

    // Function to parse Excel & validate rows with Master Jurusan support
    function processExcelFile(file) {
      if (!window.XLSX) {
        showToast('Library Excel belum siap.', 'error');
        return;
      }

      isParsingFile = true;
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (!jsonRows || jsonRows.length <= 1) {
            showToast('File Excel kosong atau tidak memiliki baris data.', 'error');
            isParsingFile = false;
            loadModalContent();
            return;
          }

          // Identifikasi header kolom
          const headers = jsonRows[0].map(h => String(h || '').trim().toLowerCase());
          let idxNisn = headers.findIndex(h => h.includes('nisn'));
          let idxNama = headers.findIndex(h => h.includes('nama') || h.includes('siswa') || h.includes('lengkap'));
          let idxJk = headers.findIndex(h => h.includes('kelamin') || h.includes('jk') || h.includes('gender') || h === 'l/p');
          let idxKelas = headers.findIndex(h => h.includes('kelas') || h.includes('tingkat') || h.includes('rombel'));
          let idxJurusan = headers.findIndex(h => h.includes('jurusan') || h.includes('program') || h.includes('keahlian') || h.includes('kompetensi'));

          // Fallback index jika header persis
          if (idxNama === -1 && jsonRows[0].length >= 2) idxNama = 1;
          if (idxNisn === -1 && jsonRows[0].length >= 1) idxNisn = 0;
          if (idxJk === -1 && jsonRows[0].length >= 3) idxJk = 2;
          if (idxKelas === -1 && jsonRows[0].length >= 4) idxKelas = 3;
          if (idxJurusan === -1 && jsonRows[0].length >= 5) idxJurusan = 4;

          const rowsToProcess = jsonRows.slice(1);
          const seenNisnInFile = new Set();
          const existingNisnMap = new Set(allExistingSiswa.map(s => String(s.nisn || '').trim()).filter(Boolean));

          parsedExcelData = rowsToProcess.map((row) => {
            const rawNama = idxNama !== -1 ? String(row[idxNama] || '').trim() : '';
            let rawNisn = idxNisn !== -1 ? String(row[idxNisn] || '').trim() : '';
            if (rawNisn === '-' || rawNisn === '0' || rawNisn.toLowerCase() === 'null' || rawNisn.toLowerCase() === 'kosong') {
              rawNisn = '';
            }

            const rawJk = idxJk !== -1 ? String(row[idxJk] || '').trim().toUpperCase() : 'L';
            const rawKelas = idxKelas !== -1 ? String(row[idxKelas] || '').trim() : (activeKelasObj?.nama_kelas || 'X 1');
            const rawJurusan = idxJurusan !== -1 ? String(row[idxJurusan] || '').trim() : '';

            // Format JK
            let jk = 'L';
            if (rawJk.startsWith('P') || rawJk.includes('PEREMPUAN') || rawJk.includes('WANITA')) {
              jk = 'P';
            }

            // Cari kecocokan di Master Jurusan jika diisi
            let matchedJurusan = null;
            if (rawJurusan) {
              matchedJurusan = matchJurusanMaster(rawJurusan, availableJurusanList);
            }

            let targetKelasObj = kelasList.find(k => k.nama_kelas.toLowerCase() === rawKelas.toLowerCase());
            let targetKelasId = targetKelasObj ? targetKelasObj.id : null;
            let targetKelasNama = targetKelasObj ? targetKelasObj.nama_kelas : rawKelas;
            let isNewClass = !targetKelasObj;

            let finalJurusanId = matchedJurusan?.id || (targetKelasObj ? (targetKelasObj.jurusan_id || null) : null);
            let finalJurusanNama = matchedJurusan?.nama || (targetKelasObj ? (targetKelasObj.jurusan_master?.nama || targetKelasObj.jurusan || '') : '');

            // Validasi (Nama WAJIB, NISN OPSIONAL, Jurusan harus terdaftar jika diisi)
            let status = 'valid';
            let message = '';

            if (!rawNama) {
              status = 'error';
              message = 'Nama siswa kosong';
            } else if (rawJurusan && !matchedJurusan) {
              status = 'error';
              message = `Jurusan '${rawJurusan}' belum terdaftar di Master Jurusan.`;
            } else if (rawNisn && rawNisn.length > 0) {
              // Validasi duplikat hanya jika NISN terisi
              if (seenNisnInFile.has(rawNisn)) {
                status = 'warning';
                message = 'NISN ganda dalam file ini';
              } else if (existingNisnMap.has(rawNisn)) {
                status = 'warning';
                message = 'NISN sudah ada di database';
              }
              seenNisnInFile.add(rawNisn);
            }

            return {
              nisn: rawNisn,
              nama_lengkap: rawNama,
              jenis_kelamin: jk,
              kelas_nama: targetKelasNama,
              jurusan_id: finalJurusanId,
              jurusan_nama: finalJurusanNama,
              kelas_id: targetKelasId,
              is_new_class: isNewClass,
              status,
              message
            };
          }).filter(r => r.nama_lengkap || r.nisn); // filter out completely blank lines

          isParsingFile = false;
          showToast(`Berhasil membaca ${parsedExcelData.length} data siswa dari Excel.`, 'success');
          loadModalContent();
        } catch (err) {
          isParsingFile = false;
          showToast('Gagal memproses file Excel: ' + err.message, 'error');
          loadModalContent();
        }
      };

      reader.readAsArrayBuffer(file);
    }

    // Cancel Preview
    modalContainer.querySelector('#btn-cancel-excel-preview')?.addEventListener('click', () => {
      parsedExcelData = [];
      loadModalContent();
    });

    // ACTION 6: PROSES & SIMPAN HASIL IMPORT EXCEL (DENGAN AUTO-CREATE KELAS + JURUSAN)
    modalContainer.querySelector('#btn-execute-import')?.addEventListener('click', async () => {
      const validRows = parsedExcelData.filter(r => r.status !== 'error' && r.nama_lengkap);

      if (validRows.length === 0) {
        showToast('Tidak ada data siswa yang valid untuk disimpan!', 'error');
        return;
      }

      const submitBtn = modalContainer.querySelector('#btn-execute-import');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Membuat Kelas & Menyimpan Siswa...</span>`;
      if (window.lucide) window.lucide.createIcons();

      // Kelompokkan per nama kelas (untuk menangani kelas yang sudah ada maupun kelas baru)
      const groupedByClassName = {};
      validRows.forEach(r => {
        if (!groupedByClassName[r.kelas_nama]) {
          groupedByClassName[r.kelas_nama] = {
            kelas_id: r.kelas_id,
            kelas_nama: r.kelas_nama,
            jurusan_id: r.jurusan_id,
            jurusan_nama: r.jurusan_nama,
            rows: []
          };
        }
        groupedByClassName[r.kelas_nama].rows.push(r);
      });

      let totalSaved = 0;
      let lastActiveKelasId = activeKelasId;

      for (const className of Object.keys(groupedByClassName)) {
        const group = groupedByClassName[className];
        let targetKelasId = group.kelas_id;

        // Jika kelas belum ada, buat kelas baru secara otomatis dengan jurusan yang sesuai!
        if (!targetKelasId) {
          const newClassCreated = await db.addKelas({
            nama_kelas: group.kelas_nama,
            tingkat: deduceTingkat(group.kelas_nama),
            jurusan_id: group.jurusan_id || null,
            academic_year: selectedImportAcademicYear
          });
          targetKelasId = newClassCreated.id;
        }

        lastActiveKelasId = targetKelasId;
        const currentSiswaInClass = await db.getSiswaByKelas(targetKelasId);
        let maxAbsen = currentSiswaInClass.reduce((max, s) => Math.max(max, s.nomor_absen || 0), 0);

        for (const row of group.rows) {
          maxAbsen++;
          await db.addSiswa({
            kelas_id: targetKelasId,
            nama_lengkap: row.nama_lengkap,
            nomor_absen: maxAbsen,
            jenis_kelamin: row.jenis_kelamin,
            nisn: row.nisn || ''
          });
          totalSaved++;
        }
      }

      showToast(`Sukses! ${totalSaved} siswa beserta kelas & jurusan berhasil disimpan ke database.`, 'success');
      parsedExcelData = [];
      activeKelasId = lastActiveKelasId;
      activeMainTab = 'siswa-list';
      onDataUpdated();
      loadModalContent();
    });
  }

  loadModalContent();
}
