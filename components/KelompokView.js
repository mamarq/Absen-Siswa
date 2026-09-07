// components/KelompokView.js - Master Data Kelompok Siswa per Kelas & Mata Pelajaran
import { db } from '../supabase-client.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
import { getGroupColorMeta } from './KelompokBelajarCombobox.js';

export async function renderKelompokView(container, state, onNavigate, showToast) {
  const currentAcademicYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const kelasList = await db.getKelasSaya(currentAcademicYear);

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
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentAcademicYear}</strong> sehingga belum ada Kelompok Belajar yang dapat dikelola.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Penentuan kelas aktif (Prioritas: state.currentKelasId jika valid di kelasList, jika tidak gunakan kelas pertama guru)
  let selectedKelasId = (kelasList.some(k => k.id === state.currentKelasId)
    ? state.currentKelasId
    : (kelasList[0]?.id || ''));

  // Ambil daftar mapel guru pada kelas terpilih
  let mapelList = await db.getMapelSaya(currentAcademicYear, selectedKelasId);

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
            Tidak ditemukan mata pelajaran yang Anda ajar pada kelas terpilih di tahun ajaran <strong>${currentAcademicYear}</strong>.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Penentuan mapel aktif tanpa fallback hardcoded 'Matematika'
  let selectedMapel = (mapelList.some(m => m.nama_mapel === state.currentMapel)
    ? state.currentMapel
    : (mapelList[0]?.nama_mapel || ''));
  let selectedMapelObj = mapelList.find(m => m.nama_mapel === selectedMapel) || mapelList[0];
  let selectedMapelId = selectedMapelObj?.id || null;

  async function loadData() {
    const [kelompokList, allSiswa, unassignedSiswa] = await Promise.all([
      db.getKelompokList({ kelas_id: selectedKelasId, mapel_id: selectedMapelId, mapel: selectedMapel, academic_year: currentAcademicYear }),
      selectedKelasId ? db.getSiswaByKelas(selectedKelasId, true) : Promise.resolve([]),
      selectedKelasId ? db.getSiswaBelumBerkelompok(selectedKelasId, selectedMapelId, currentAcademicYear) : Promise.resolve([])
    ]);
    return { kelompokList, allSiswa, unassignedSiswa };
  }

  async function render() {
    const { kelompokList, allSiswa, unassignedSiswa } = await loadData();
    const selectedKelasObj = kelasList.find(k => k.id === selectedKelasId);

    container.innerHTML = `
      <div class="space-y-6 pb-24 max-w-6xl mx-auto">
        
        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white p-4 sm:p-6 rounded-3xl shadow-sm border border-emerald-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="p-3 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30">
              <i data-lucide="users" class="w-7 h-7"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-extrabold text-lg sm:text-2xl tracking-tight">Data Kelompok Belajar</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase">
                  ${currentAcademicYear}
                </span>
              </div>
              <p class="text-xs text-emerald-200/80 mt-0.5">
                Susunan kelompok terikat per Mapel. Siswa boleh berbeda kelompok untuk mata pelajaran lain.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button 
              id="btn-goto-tugas-kelompok" 
              class="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 active:scale-95"
            >
              <i data-lucide="award" class="w-4 h-4 text-amber-300"></i>
              <span>Ke Penilaian Tugas Kelompok</span>
            </button>
          </div>
        </div>

        <!-- Filter Kelas & Mapel Toolbar -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-3">
            
            <!-- Kelas Combobox -->
            <div class="w-48 sm:w-56">
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Kelas</label>
              ${renderClassComboboxHTML({
                id: 'kelompok-select-kelas',
                kelasList,
                selectedId: selectedKelasId,
                size: 'sm'
              })}
            </div>

            <!-- Mapel Combobox -->
            <div class="w-56 sm:w-64">
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Mata Pelajaran</label>
              ${renderMapelComboboxHTML({
                id: 'kelompok-select-mapel',
                mapelList,
                selectedValue: selectedMapel,
                size: 'sm'
              })}
            </div>

          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
            <button 
              id="btn-add-kelompok" 
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span>+ Buat Kelompok Baru</span>
            </button>

            <button 
              id="btn-auto-generate-kelompok" 
              class="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              title="Bagi siswa ke kelompok secara acak / otomatis"
            >
              <i data-lucide="shuffle" class="w-4 h-4 text-purple-600 dark:text-purple-400"></i>
              <span>Bagi Acak</span>
            </button>
          </div>
        </div>

        <!-- Main Content Split Layout: Kelompok Cards & Unassigned Students Panel -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <!-- Sisi Kiri: Daftar Kartu Kelompok (8 Cols) -->
          <div class="lg:col-span-8 space-y-4">
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Daftar Kelompok</h3>
                <span class="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black">
                  ${kelompokList.length} Kelompok
                </span>
              </div>

              <div class="text-xs text-slate-400 dark:text-slate-500 font-semibold">
                ${allSiswa.length - unassignedSiswa.length} dari ${allSiswa.length} Siswa Terdaftar
              </div>
            </div>

            ${kelompokList.length === 0 ? `
              <div class="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
                  <i data-lucide="users" class="w-7 h-7"></i>
                </div>
                <div class="space-y-1">
                  <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Belum Ada Kelompok di ${selectedKelasObj?.nama_kelas || 'Kelas Ini'}</h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Mata Pelajaran <strong>${selectedMapel}</strong> belum memiliki susunan kelompok. Klik tombol di bawah untuk membuat kelompok pertama atau bagi otomatis.
                  </p>
                </div>
                <div class="pt-2 flex justify-center gap-2">
                  <button id="btn-empty-add-kelompok" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>+ Buat Kelompok</span>
                  </button>
                  <button id="btn-empty-auto-generate" class="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5">
                    <i data-lucide="shuffle" class="w-4 h-4 text-purple-600 dark:text-purple-400"></i>
                    <span>Bagi Otomatis</span>
                  </button>
                </div>
              </div>
            ` : `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${kelompokList.map(k => {
                  const anggota = k.anggota || [];

                  return `
                    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 space-y-3 transition hover:shadow-md group flex flex-col justify-between" data-kelompok-id="${k.id}">
                      
                      <!-- Header Card Kelompok -->
                      <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <div class="min-w-0">
                          <h4 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                            ${k.nama_kelompok}
                          </h4>
                          ${k.deskripsi ? `<p class="text-[11px] text-slate-400 dark:text-slate-500 truncate">${k.deskripsi}</p>` : ''}
                        </div>

                        <div class="flex items-center gap-1">
                          <span class="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black border border-emerald-200 dark:border-emerald-800">
                            ${anggota.length} Siswa
                          </span>

                          <button 
                            class="btn-edit-kelompok p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition" 
                            data-kelompok-id="${k.id}" 
                            data-kelompok-nama="${k.nama_kelompok}"
                            data-kelompok-desk="${k.deskripsi || ''}"
                            title="Edit Nama Kelompok"
                          >
                            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                          </button>

                          <button 
                            class="btn-delete-kelompok p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition" 
                            data-kelompok-id="${k.id}" 
                            data-kelompok-nama="${k.nama_kelompok}"
                            title="Hapus Kelompok"
                          >
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      </div>

                      <!-- List Anggota Siswa -->
                      <div class="space-y-1.5 min-h-[90px] max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        ${anggota.length === 0 ? `
                          <div class="py-6 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                            Belum ada anggota siswa di kelompok ini.
                          </div>
                        ` : anggota.map(s => `
                          <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition text-xs group/item">
                            <div class="flex items-center gap-2 min-w-0">
                              <span class="w-5 h-5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-extrabold text-[10px] flex items-center justify-center flex-shrink-0">
                                ${s.nomor_absen || '-'}
                              </span>
                              <div class="truncate">
                                <span class="font-bold text-slate-800 dark:text-slate-100 truncate block">${s.nama_lengkap}</span>
                                <span class="text-[9px] text-slate-400 dark:text-slate-500 block">NISN: ${s.nisn || '-'} • (${s.jenis_kelamin || 'L'})</span>
                              </div>
                            </div>

                            <button 
                              class="btn-remove-anggota p-1 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-900 rounded-md transition flex-shrink-0"
                              data-kelompok-id="${k.id}"
                              data-siswa-id="${s.id}"
                              data-siswa-nama="${s.nama_lengkap}"
                              title="Hapus dari kelompok ini"
                            >
                              <i data-lucide="x" class="w-3.5 h-3.5"></i>
                            </button>
                          </div>
                        `).join('')}
                      </div>

                      <!-- Add Member Trigger Footer -->
                      <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          class="btn-open-add-member w-full py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                          data-kelompok-id="${k.id}"
                          data-kelompok-nama="${k.nama_kelompok}"
                        >
                          <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                          <span>+ Tambah Anggota</span>
                        </button>
                      </div>

                    </div>
                  `;
                }).join('')}
              </div>
            `}

          </div>

          <!-- Sisi Kanan: Panel Siswa Belum Berkelompok (4 Cols) -->
          <div class="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-3 sticky top-4">
            
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div class="flex items-center gap-2">
                <i data-lucide="user-x" class="w-4 h-4 text-amber-500"></i>
                <h4 class="font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">Belum Ada Kelompok</h4>
              </div>
              <span class="px-2 py-0.5 rounded-full ${unassignedSiswa.length > 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'} text-[11px] font-black">
                ${unassignedSiswa.length} Siswa
              </span>
            </div>

            <p class="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Siswa di bawah ini belum tergabung ke kelompok manapun pada mapel <strong>${selectedMapel}</strong>.
            </p>

            <div class="space-y-2 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
              ${unassignedSiswa.length === 0 ? `
                <div class="py-8 text-center text-slate-400 dark:text-slate-500 text-xs space-y-1">
                  <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500 mx-auto"></i>
                  <p class="font-bold text-slate-700 dark:text-slate-200">Semua siswa sudah masuk kelompok!</p>
                </div>
              ` : unassignedSiswa.map(s => `
                <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 hover:bg-slate-100/70 dark:hover:bg-slate-800/90 transition">
                  <div class="min-w-0 flex items-center gap-2">
                    <span class="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-[11px] flex items-center justify-center flex-shrink-0">
                      ${s.nomor_absen || '-'}
                    </span>
                    <div class="truncate">
                      <div class="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">${s.nama_lengkap}</div>
                      <div class="text-[9px] text-slate-400 dark:text-slate-500 truncate">NISN: ${s.nisn || '-'} • (${s.jenis_kelamin || 'L'})</div>
                    </div>
                  </div>

                  <!-- Quick Assign to Group Dropdown (Custom Modern Popover) -->
                  <div class="relative quick-assign-wrapper flex-shrink-0">
                    <button 
                      type="button" 
                      class="btn-trigger-quick-assign px-2.5 py-1 text-[11px] font-extrabold bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-xl shadow-2xs transition flex items-center gap-1 active:scale-95"
                      data-siswa-id="${s.id}"
                      data-siswa-nama="${s.nama_lengkap}"
                    >
                      <i data-lucide="user-plus" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"></i>
                      <span>Pilih Kelompok</span>
                      <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400 dark:text-slate-500"></i>
                    </button>
                    
                    <div class="quick-assign-popover hidden absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <div class="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        Pilih Kelompok Siswa
                      </div>
                      <div class="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
                        ${kelompokList.map((k, kIdx) => {
                          const color = getGroupColorMeta(kIdx);
                          return `
                            <button 
                              type="button" 
                              class="btn-select-assign-group w-full text-left p-1.5 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-200 hover:text-emerald-950 dark:hover:text-emerald-200 flex items-center justify-between gap-2 transition"
                              data-siswa-id="${s.id}"
                              data-siswa-nama="${s.nama_lengkap}"
                              data-kelompok-id="${k.id}"
                              data-kelompok-nama="${k.nama_kelompok}"
                            >
                              <div class="flex items-center gap-1.5 min-w-0">
                                <span class="w-2 h-2 rounded-full ${color.dot}"></span>
                                <span class="truncate">${k.nama_kelompok}</span>
                              </div>
                              <span class="px-1.5 py-0.5 rounded text-[10px] ${color.badge} border">${(k.anggota || []).length}</span>
                            </button>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

          </div>

        </div>

      </div>

      <!-- Modal Add / Edit Kelompok -->
      <div id="modal-kelompok" class="fixed inset-0 z-50 hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full space-y-4 transform transition-all scale-100">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 id="modal-kelompok-title" class="font-extrabold text-slate-800 dark:text-slate-100 text-base">Buat Kelompok Baru</h3>
            <button id="btn-close-modal-kelompok" class="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <form id="form-kelompok" class="space-y-3">
            <input type="hidden" id="input-kelompok-id" value="">

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Kelompok <span class="text-rose-500">*</span></label>
              <input 
                type="text" 
                id="input-kelompok-nama" 
                placeholder="Contoh: Kelompok 1, Tim Alpha, dsb." 
                class="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                required
              >
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi / Catatan (Opsional)</label>
              <input 
                type="text" 
                id="input-kelompok-desk" 
                placeholder="Contoh: Proyek Web, Presentasi Bab 3" 
                class="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
              >
            </div>

            <div class="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" id="btn-cancel-modal-kelompok" class="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                Batal
              </button>
              <button type="submit" class="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition">
                Simpan
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Auto Generate Kelompok -->
      <div id="modal-auto-generate" class="fixed inset-0 z-50 hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="shuffle" class="w-5 h-5 text-purple-600 dark:text-purple-400"></i>
              <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-base">Bagi Kelompok Otomatis</h3>
            </div>
            <button id="btn-close-modal-auto" class="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <form id="form-auto-generate" class="space-y-3.5">
            <div class="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Perhatian:</strong> Pembagian otomatis akan mereset susunan kelompok lama pada kelas dan mapel ini, lalu membagikan seluruh ${allSiswa.length} siswa secara merata dan acak.
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jumlah Kelompok yang Ingin Dibuat</label>
              <input 
                type="number" 
                id="input-auto-count" 
                value="4" 
                min="2" 
                max="${Math.max(2, allSiswa.length)}" 
                class="w-full px-3.5 py-2.5 text-xs font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-800 dark:text-slate-100"
                required
              >
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pola Penamaan</label>
              <input 
                type="text" 
                id="input-auto-format" 
                value="Kelompok {N}" 
                placeholder="Contoh: Kelompok {N}" 
                class="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-800 dark:text-slate-100"
                required
              >
              <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Gunakan <code class="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{N}</code> untuk nomor urut (1, 2, 3...)</span>
            </div>

            <div class="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" id="btn-cancel-modal-auto" class="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                Batal
              </button>
              <button type="submit" class="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5">
                <i data-lucide="shuffle" class="w-4 h-4"></i>
                <span>Bagi Sekarang</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Tambah Anggota ke Kelompok Tertentu -->
      <div id="modal-pick-member" class="fixed inset-0 z-50 hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-lg w-full space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-base" id="modal-pick-member-title">Tambah Anggota</h3>
              <p class="text-[11px] text-slate-400 dark:text-slate-500">Pilih siswa dari daftar kelas ini</p>
            </div>
            <button id="btn-close-modal-pick" class="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <input type="hidden" id="target-add-kelompok-id" value="">

          <div class="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar" id="list-pick-students">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Inisialisasi Combobox Kelas & Mapel
    initClassCombobox(container, {
      id: 'kelompok-select-kelas',
      kelasList,
      selectedId: selectedKelasId,
      size: 'sm',
      onSelect: async (newKId) => {
        selectedKelasId = newKId;
        state.currentKelasId = newKId;

        // Refresh mapelList untuk kelas baru
        mapelList = await db.getMapelSaya(currentAcademicYear, selectedKelasId);
        if (!mapelList.some(m => m.nama_mapel === selectedMapel)) {
          selectedMapel = mapelList[0]?.nama_mapel || '';
          selectedMapelObj = mapelList[0] || null;
          selectedMapelId = selectedMapelObj?.id || null;
        } else {
          selectedMapelObj = mapelList.find(m => m.nama_mapel === selectedMapel) || mapelList[0];
          selectedMapelId = selectedMapelObj?.id || null;
        }
        state.currentMapel = selectedMapel;
        render();
      }
    });

    initMapelCombobox(container, {
      id: 'kelompok-select-mapel',
      mapelList,
      selectedValue: selectedMapel,
      size: 'sm',
      onSelect: (newMapel) => {
        selectedMapel = newMapel;
        state.currentMapel = newMapel;
        selectedMapelObj = mapelList.find(m => m.nama_mapel === newMapel) || mapelList[0];
        selectedMapelId = selectedMapelObj?.id || null;
        render();
      }
    });

    // Navigation to Tugas Kelompok
    container.querySelector('#btn-goto-tugas-kelompok')?.addEventListener('click', () => onNavigate('tugas-kelompok'));

    // Modal Kelompok Event Handlers
    const modalKelompok = container.querySelector('#modal-kelompok');
    const formKelompok = container.querySelector('#form-kelompok');
    const inputKelompokId = container.querySelector('#input-kelompok-id');
    const inputKelompokNama = container.querySelector('#input-kelompok-nama');
    const inputKelompokDesk = container.querySelector('#input-kelompok-desk');
    const modalKelompokTitle = container.querySelector('#modal-kelompok-title');

    function openModalKelompok(id = '', nama = '', desk = '') {
      inputKelompokId.value = id;
      inputKelompokNama.value = nama;
      inputKelompokDesk.value = desk;
      modalKelompokTitle.textContent = id ? 'Edit Nama Kelompok' : 'Buat Kelompok Baru';
      modalKelompok.classList.remove('hidden');
      inputKelompokNama.focus();
    }

    container.querySelector('#btn-add-kelompok')?.addEventListener('click', () => openModalKelompok());
    container.querySelector('#btn-empty-add-kelompok')?.addEventListener('click', () => openModalKelompok());
    container.querySelector('#btn-close-modal-kelompok')?.addEventListener('click', () => modalKelompok.classList.add('hidden'));
    container.querySelector('#btn-cancel-modal-kelompok')?.addEventListener('click', () => modalKelompok.classList.add('hidden'));

    formKelompok?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = inputKelompokNama.value.trim();
      const desk = inputKelompokDesk.value.trim();
      const id = inputKelompokId.value || null;

      if (!nama) return;

      const res = await db.saveKelompok({
        id,
        kelas_id: selectedKelasId,
        mapel_id: selectedMapelId,
        mapel: selectedMapel,
        nama_kelompok: nama,
        deskripsi: desk,
        academic_year: currentAcademicYear
      });

      if (res.success) {
        showToast(id ? 'Kelompok berhasil diperbarui' : 'Kelompok baru berhasil dibuat!', 'success');
        modalKelompok.classList.add('hidden');
        render();
      } else {
        showToast('Gagal menyimpan kelompok: ' + (res.error || 'Terjadi kesalahan'), 'error');
      }
    });

    // Edit Kelompok
    container.querySelectorAll('.btn-edit-kelompok').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-kelompok-id');
        const nama = btn.getAttribute('data-kelompok-nama');
        const desk = btn.getAttribute('data-kelompok-desk');
        openModalKelompok(id, nama, desk);
      });
    });

    // Delete Kelompok
    container.querySelectorAll('.btn-delete-kelompok').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-kelompok-id');
        const nama = btn.getAttribute('data-kelompok-nama');
        if (confirm(`Apakah Anda yakin ingin menghapus kelompok "${nama}"? Seluruh anggota di dalamnya akan menjadi belum berkelompok.`)) {
          await db.deleteKelompok(id);
          showToast(`Kelompok "${nama}" berhasil dihapus`, 'info');
          render();
        }
      });
    });

    // Remove Anggota
    container.querySelectorAll('.btn-remove-anggota').forEach(btn => {
      btn.addEventListener('click', async () => {
        const kId = btn.getAttribute('data-kelompok-id');
        const sId = btn.getAttribute('data-siswa-id');
        const sNama = btn.getAttribute('data-siswa-nama');
        const res = await db.removeAnggotaKelompok(kId, sId);
        if (res.success) {
          showToast(`${sNama} dikeluarkan dari kelompok`, 'info');
          render();
        } else {
          showToast(`Gagal mengeluarkan siswa: ${res.error || 'Terjadi kesalahan'}`, 'error');
        }
      });
    });

    // Helper: Pindahkan / Tambah Siswa dengan Konfirmasi jika sudah ada di kelompok lain
    async function handleAddStudentToGroup(targetKelompokId, targetKelompokNama, siswaId, siswaNama) {
      // Cek apakah siswa sudah ada di kelompok lain pada kelas + mapel ini
      const existingKelompok = kelompokList.find(k => (k.anggota || []).some(a => a.id === siswaId));
      if (existingKelompok) {
        if (existingKelompok.id === targetKelompokId) {
          showToast(`${siswaNama} sudah berada di ${targetKelompokNama}`, 'info');
          return;
        }

        const confirmMove = confirm(`Siswa "${siswaNama}" saat ini sudah terdaftar di "${existingKelompok.nama_kelompok}".\n\nApakah Anda ingin memindahkannya ke "${targetKelompokNama}"?`);
        if (!confirmMove) return;
      }

      const res = await db.addAnggotaKelompok({
        kelompok_id: targetKelompokId,
        siswa_id: siswaId,
        kelas_id: selectedKelasId,
        mapel_id: selectedMapelId,
        academic_year: currentAcademicYear
      });

      if (res.success) {
        showToast(`${siswaNama} berhasil dimasukkan ke ${targetKelompokNama}`, 'success');
        render();
      } else {
        showToast(`Gagal menambahkan siswa: ${res.error || 'Terjadi kesalahan'}`, 'error');
      }
    }

    // Quick Assign from Right Panel (Custom Modern Popover Event Listeners)
    container.querySelectorAll('.btn-trigger-quick-assign').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = btn.closest('.quick-assign-wrapper');
        const popover = wrapper?.querySelector('.quick-assign-popover');
        
        // Tutup popover lain
        container.querySelectorAll('.quick-assign-popover').forEach(p => {
          if (p !== popover) p.classList.add('hidden');
        });

        if (popover) {
          popover.classList.toggle('hidden');
        }
      });
    });

    container.querySelectorAll('.btn-select-assign-group').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetKId = btn.getAttribute('data-kelompok-id');
        const targetKNama = btn.getAttribute('data-kelompok-nama');
        const sId = btn.getAttribute('data-siswa-id');
        const sNama = btn.getAttribute('data-siswa-nama');

        const wrapper = btn.closest('.quick-assign-wrapper');
        wrapper?.querySelector('.quick-assign-popover')?.classList.add('hidden');

        await handleAddStudentToGroup(targetKId, targetKNama, sId, sNama);
      });
    });

    // Close popovers on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.quick-assign-wrapper')) {
        container.querySelectorAll('.quick-assign-popover').forEach(p => p.classList.add('hidden'));
      }
    });

    // Modal Pick Member for Specific Group
    const modalPick = container.querySelector('#modal-pick-member');
    const targetAddKelIdInput = container.querySelector('#target-add-kelompok-id');
    const modalPickTitle = container.querySelector('#modal-pick-member-title');
    const listPickStudents = container.querySelector('#list-pick-students');

    container.querySelectorAll('.btn-open-add-member').forEach(btn => {
      btn.addEventListener('click', () => {
        const kId = btn.getAttribute('data-kelompok-id');
        const kNama = btn.getAttribute('data-kelompok-nama');
        targetAddKelIdInput.value = kId;
        modalPickTitle.textContent = `Tambah Anggota ke ${kNama}`;

        const targetKel = kelompokList.find(k => k.id === kId);
        const currentMemberIds = new Set((targetKel?.anggota || []).map(a => a.id));

        listPickStudents.innerHTML = allSiswa.map(s => {
          const isCurrentMember = currentMemberIds.has(s.id);
          const otherKel = !isCurrentMember ? kelompokList.find(k => (k.anggota || []).some(a => a.id === s.id)) : null;

          return `
            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition">
              <div class="min-w-0 flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-[11px] flex items-center justify-center flex-shrink-0">
                  ${s.nomor_absen || '-'}
                </span>
                <div class="truncate">
                  <div class="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">${s.nama_lengkap}</div>
                  <div class="text-[10px] text-slate-400 dark:text-slate-500">
                    ${isCurrentMember ? '<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓ Sudah di kelompok ini</span>' : (otherKel ? `<span class="text-amber-600 dark:text-amber-400 font-semibold">Tergabung di ${otherKel.nama_kelompok}</span>` : '<span class="text-slate-400 dark:text-slate-500">Belum berkelompok</span>')}
                  </div>
                </div>
              </div>

              ${isCurrentMember ? `
                <span class="text-xs font-bold text-slate-400 dark:text-slate-500 px-3 py-1 bg-slate-200/60 dark:bg-slate-800 rounded-xl">Anggota</span>
              ` : `
                <button 
                  class="btn-confirm-add-student px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
                  data-siswa-id="${s.id}"
                  data-siswa-nama="${s.nama_lengkap}"
                >
                  ${otherKel ? 'Pindahkan' : '+ Masukkan'}
                </button>
              `}
            </div>
          `;
        }).join('');

        listPickStudents.querySelectorAll('.btn-confirm-add-student').forEach(addBtn => {
          addBtn.addEventListener('click', async () => {
            const sId = addBtn.getAttribute('data-siswa-id');
            const sNama = addBtn.getAttribute('data-siswa-nama');
            modalPick.classList.add('hidden');
            await handleAddStudentToGroup(kId, kNama, sId, sNama);
          });
        });

        modalPick.classList.remove('hidden');
      });
    });

    container.querySelector('#btn-close-modal-pick')?.addEventListener('click', () => modalPick.classList.add('hidden'));

    // Modal Auto Generate
    const modalAuto = container.querySelector('#modal-auto-generate');
    const formAuto = container.querySelector('#form-auto-generate');

    container.querySelector('#btn-auto-generate-kelompok')?.addEventListener('click', () => modalAuto.classList.remove('hidden'));
    container.querySelector('#btn-empty-auto-generate')?.addEventListener('click', () => modalAuto.classList.remove('hidden'));
    container.querySelector('#btn-close-modal-auto')?.addEventListener('click', () => modalAuto.classList.add('hidden'));
    container.querySelector('#btn-cancel-modal-auto')?.addEventListener('click', () => modalAuto.classList.add('hidden'));

    formAuto?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const count = parseInt(container.querySelector('#input-auto-count')?.value) || 4;
      const format = container.querySelector('#input-auto-format')?.value || 'Kelompok {N}';

      const res = await db.generateKelompokOtomatis({
        kelas_id: selectedKelasId,
        mapel_id: selectedMapelId,
        mapel: selectedMapel,
        jumlah_kelompok: count,
        format_nama: format,
        academic_year: currentAcademicYear
      });

      if (res.success) {
        showToast(`Berhasil membagikan ${allSiswa.length} siswa ke dalam ${res.count} kelompok!`, 'success');
        modalAuto.classList.add('hidden');
        render();
      } else {
        showToast(res.message || 'Gagal membagikan kelompok', 'error');
      }
    });
  }

  await render();
}
