// components/SettingsModal.js - Modal Pengaturan: Master Mapel, Data Sekolah, Profil Guru & NIP, Supabase Cloud, Backup, & Tentang Aplikasi
import { db } from '../supabase-client.js';
import { APP_INFO } from '../data/appInfo.js';
import { renderKelompokComboboxHTML, initKelompokCombobox } from './KelompokCombobox.js';

export async function renderSettingsModal(modalContainer, onClose, onConfigSaved, showToast, initialTab = 'mapel') {
  const currentConfig = db.getConfig();
  const isConnected = db.isSupabaseConnected;
  let activeTab = initialTab || 'mapel'; // 'mapel' | 'sekolah' | 'profil' | 'database' | 'backup' | 'about'
  
  // State form edit mapel & jam
  let editingMapel = null; // null for add, object for edit
  let editingJam = null; // null for add, object for edit

  async function renderModalContent() {
    if (db.isSupabaseConnected) {
      await db.syncSchoolAndProfileFromSupabase();
    }
    const [mapelList, jamMasterList] = await Promise.all([
      db.getMataPelajaran(),
      db.getJamPelajaranMaster()
    ]);
    const schoolSettings = db.getSchoolSettings ? db.getSchoolSettings() : {};
    const profilGuru = db.getProfilGuru ? db.getProfilGuru() : {};

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div class="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
          
          <!-- Header Modal -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <i data-lucide="settings" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 class="font-bold text-slate-800 text-base sm:text-lg">Pengaturan Sistem & Master Data</h3>
                <p class="text-xs text-slate-500">Kelola master mapel, data sekolah & kop, profil guru & NIP, database cloud, & tema</p>
              </div>
            </div>

            <button id="btn-close-settings-modal" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Navigation Tabs (7 Tabs Responsive Grid) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex-shrink-0 text-xs font-bold">
            <button id="tab-btn-mapel" class="py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 ${activeTab === 'mapel' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="book-marked" class="w-3.5 h-3.5 flex-shrink-0"></i>
              <span class="truncate">Master Mapel</span>
              <span class="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full hidden md:inline">${mapelList.length}</span>
            </button>

            <button id="tab-btn-jam" class="py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 ${activeTab === 'jam' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="clock" class="w-3.5 h-3.5 flex-shrink-0"></i>
              <span class="truncate">Master Jam</span>
              <span class="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full hidden md:inline">${jamMasterList.length}</span>
            </button>

            <button id="tab-btn-sekolah" class="py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 ${activeTab === 'sekolah' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="school" class="w-3.5 h-3.5 flex-shrink-0"></i>
              <span class="truncate">Data Sekolah</span>
            </button>

            <button id="tab-btn-profil" class="py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 ${activeTab === 'profil' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="user-check" class="w-3.5 h-3.5 flex-shrink-0"></i>
              <span class="truncate">Profil Guru</span>
            </button>

            <button id="tab-btn-database" class="py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 ${activeTab === 'database' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="database" class="w-3.5 h-3.5 flex-shrink-0"></i>
              <span class="truncate">Database</span>
              <span class="w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}"></span>
            </button>

            <button id="tab-btn-backup" class="py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 ${activeTab === 'backup' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="hard-drive" class="w-3.5 h-3.5 flex-shrink-0"></i>
              <span class="truncate">Cadangan</span>
            </button>

            <button id="tab-btn-about" class="py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 ${activeTab === 'about' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="info" class="w-3.5 h-3.5 flex-shrink-0"></i>
              <span class="truncate">Tentang</span>
            </button>
          </div>

          <!-- Scrollable Content Body -->
          <div class="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">

            <!-- ============================================================= -->
            <!-- TAB 1: MASTER MATA PELAJARAN (CRUD) -->
            <!-- ============================================================= -->
            <div class="${activeTab === 'mapel' ? '' : 'hidden'} space-y-4">
              
              <!-- Form Tambah / Edit Mapel -->
              <div id="form-mapel-container" class="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <i data-lucide="${editingMapel ? 'edit-3' : 'plus-circle'}" class="w-4 h-4 text-emerald-700"></i>
                    <h4 class="font-bold text-slate-800 text-xs sm:text-sm">
                      ${editingMapel ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
                    </h4>
                  </div>
                  ${editingMapel ? `
                    <button id="btn-cancel-edit-mapel" class="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline">
                      Batal Edit
                    </button>
                  ` : ''}
                </div>

                <form id="form-mapel-submit" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div class="sm:col-span-6">
                    <label class="block font-semibold text-slate-700 mb-1">Nama Mata Pelajaran <span class="text-rose-500">*</span></label>
                    <input type="text" id="input-mapel-nama" required value="${editingMapel ? editingMapel.nama_mapel : ''}" placeholder="Contoh: Matematika / Jaringan Komputer" class="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-bold">
                  </div>

                  <div class="sm:col-span-3">
                    <label class="block font-semibold text-slate-700 mb-1">Kode Singkatan</label>
                    <input type="text" id="input-mapel-kode" value="${editingMapel ? (editingMapel.kode || '') : ''}" placeholder="MTK, INF" class="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono uppercase">
                  </div>

                  <div class="sm:col-span-3">
                    <label class="block font-semibold text-slate-700 mb-1">Kelompok</label>
                    ${renderKelompokComboboxHTML({
                      id: 'select-mapel-kategori',
                      selectedValue: editingMapel ? (editingMapel.kategori || 'Umum') : 'Umum'
                    })}
                  </div>

                  <div class="sm:col-span-12 flex justify-end gap-2 pt-1">
                    <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 transform active:scale-95">
                      <i data-lucide="${editingMapel ? 'check' : 'plus'}" class="w-4 h-4"></i>
                      <span>${editingMapel ? 'Perbarui Mapel' : 'Tambah ke Daftar'}</span>
                    </button>
                  </div>
                </form>
              </div>

              <!-- Daftar Master Mapel -->
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div class="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span class="font-bold text-slate-700 text-xs">Daftar Mata Pelajaran (${mapelList.length} Mapel)</span>
                  <span class="text-[11px] text-slate-400">Digunakan pada Absen, Jurnal, & Penilaian Tugas</span>
                </div>

                <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  ${mapelList.length === 0 ? `
                    <div class="p-6 text-center text-slate-400">
                      Belum ada mata pelajaran. Silakan tambahkan di atas.
                    </div>
                  ` : mapelList.map((m, idx) => `
                    <div class="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                      <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          ${idx + 1}
                        </span>
                        <div>
                          <div class="font-bold text-slate-800">${m.nama_mapel}</div>
                          <div class="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>Kode: <strong class="text-slate-600 font-mono">${m.kode || '-'}</strong></span>
                            <span>•</span>
                            <span class="px-1.5 py-0.2 rounded ${m.kategori === 'Kejuruan' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'} font-semibold">${m.kategori || 'Umum'}</span>
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5">
                        <button class="btn-edit-mapel p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" data-id="${m.id}" data-nama="${m.nama_mapel}" data-kode="${m.kode || ''}" data-kategori="${m.kategori || 'Umum'}" title="Edit Mapel">
                          <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button class="btn-delete-mapel p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" data-id="${m.id}" data-nama="${m.nama_mapel}" title="Hapus Mapel">
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

            </div>

            <!-- ============================================================= -->
            <!-- TAB: MASTER JAM PELAJARAN (PER-SATUAN JP) (CRUD) -->
            <!-- ============================================================= -->
            <div class="${activeTab === 'jam' ? '' : 'hidden'} space-y-4">
              
              <!-- Form Tambah / Edit Slot Jam -->
              <div id="form-jam-container" class="bg-gradient-to-br from-teal-50 to-emerald-50/50 dark:from-slate-800/80 dark:to-slate-800/60 p-4 rounded-2xl border border-teal-200/80 dark:border-slate-700 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <i data-lucide="${editingJam ? 'edit-3' : 'plus-circle'}" class="w-4 h-4 text-teal-700 dark:text-teal-400"></i>
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                      ${editingJam ? 'Edit Slot Jam Pelajaran' : 'Tambah Slot Jam Pelajaran Baru'}
                    </h4>
                  </div>
                  ${editingJam ? `
                    <button id="btn-cancel-edit-jam" class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline">
                      Batal Edit
                    </button>
                  ` : ''}
                </div>

                <form id="form-jam-submit" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div class="sm:col-span-2">
                    <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">No. Urut <span class="text-rose-500">*</span></label>
                    <input type="number" id="input-jam-urut" min="1" max="20" required value="${editingJam ? editingJam.nomor_urut : (jamMasterList.length + 1)}" class="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-bold text-center text-slate-800 dark:text-slate-100">
                  </div>

                  <div class="sm:col-span-3">
                    <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Label Jam <span class="text-rose-500">*</span></label>
                    <input type="text" id="input-jam-label" required value="${editingJam ? editingJam.label : `Jam ke-${jamMasterList.length + 1}`}" placeholder="Jam ke-1" class="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-bold text-slate-800 dark:text-slate-100">
                  </div>

                  <div class="sm:col-span-2">
                    <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Jam Mulai <span class="text-rose-500">*</span></label>
                    <input type="time" id="input-jam-mulai" required value="${editingJam ? (editingJam.jam_mulai || '').substring(0, 5) : '07:30'}" class="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-bold text-slate-800 dark:text-slate-100">
                  </div>

                  <div class="sm:col-span-2">
                    <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Jam Selesai <span class="text-rose-500">*</span></label>
                    <input type="time" id="input-jam-selesai" required value="${editingJam ? (editingJam.jam_selesai || '').substring(0, 5) : '08:15'}" class="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-bold text-slate-800 dark:text-slate-100">
                  </div>

                  <div class="sm:col-span-3">
                    <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Keterangan (Opsional)</label>
                    <input type="text" id="input-jam-ket" value="${editingJam ? (editingJam.keterangan || '') : ''}" placeholder="Sesi Pagi / Istirahat" class="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs text-slate-800 dark:text-slate-100">
                  </div>

                  <!-- Toggle Slot Istirahat -->
                  <div class="sm:col-span-12 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-teal-200 dark:border-slate-700">
                    <label for="input-jam-istirahat" class="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2">
                      <input type="checkbox" id="input-jam-istirahat" class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300" ${editingJam && editingJam.tipe_slot === 'istirahat' ? 'checked' : ''}>
                      <span class="flex items-center gap-1.5">
                        <i data-lucide="coffee" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"></i>
                        <span>Tandai sebagai Slot Jam Istirahat (Bukan Jam KBM Mengajar)</span>
                      </span>
                    </label>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">Slot ini tidak dihitung sebagai beban JP mengajar</span>
                  </div>

                  <div class="sm:col-span-12 flex justify-end gap-2 pt-1">
                    <button type="submit" class="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 transform active:scale-95">
                      <i data-lucide="${editingJam ? 'check' : 'plus'}" class="w-4 h-4"></i>
                      <span>${editingJam ? 'Perbarui Slot Jam' : 'Tambah ke Master Jam'}</span>
                    </button>
                  </div>
                </form>
              </div>

              <!-- Daftar Master Jam Pelajaran -->
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs space-y-0">
                <div class="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-700 dark:text-slate-200 text-xs">Daftar Slot Jam Pelajaran (${jamMasterList.length} Slot)</span>
                  </div>
                  <button id="btn-reset-default-jam" type="button" class="text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 flex items-center gap-1">
                    <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
                    <span>Reset ke Default Standar (13 JP)</span>
                  </button>
                </div>

                <div class="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                  ${jamMasterList.length === 0 ? `
                    <div class="p-6 text-center text-slate-400 dark:text-slate-500">
                      Belum ada master jam pelajaran. Silakan tambahkan atau reset ke default.
                    </div>
                  ` : jamMasterList.map((j) => {
                    const mulaiTrim = (j.jam_mulai || '').substring(0, 5);
                    const selesaiTrim = (j.jam_selesai || '').substring(0, 5);
                    const isIstirahat = j.tipe_slot === 'istirahat';
                    return `
                      <div class="p-3 flex items-center justify-between ${isIstirahat ? 'bg-amber-50/40 dark:bg-amber-950/30 hover:bg-amber-50/70 dark:hover:bg-amber-950/50 border-l-4 border-amber-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} transition">
                        <div class="flex items-center gap-3">
                          <span class="w-7 h-7 rounded-lg ${isIstirahat ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300' : 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300'} font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                            ${j.nomor_urut}
                          </span>
                          <div>
                            <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                              <span>${j.label}</span>
                              <span class="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-semibold">
                                ${mulaiTrim} - ${selesaiTrim}
                              </span>
                              ${isIstirahat ? `
                                <span class="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <i data-lucide="coffee" class="w-3 h-3"></i> Istirahat (Bukan JP)
                                </span>
                              ` : `
                                <span class="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                                  1 JP
                                </span>
                              `}
                            </div>
                            <div class="text-[10px] text-slate-400 dark:text-slate-500">
                              ${j.keterangan || (isIstirahat ? 'Waktu Istirahat / Jeda Belajar' : 'Sesi Jam Pelajaran KBM')}
                            </div>
                          </div>
                        </div>

                        <div class="flex items-center gap-1">
                          <button class="btn-edit-jam p-1.5 text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded-lg transition" data-id="${j.id}" title="Edit Slot Jam">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                          </button>
                          <button class="btn-delete-jam p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition" data-id="${j.id}" data-label="${j.label}" title="Hapus Slot Jam">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

            </div>

            <!-- ============================================================= -->
            <!-- TAB 2: DATA SEKOLAH & KOP SURAT LAPORAN (NEW DEDICATED TAB) -->
            <!-- ============================================================= -->
            <div class="${activeTab === 'sekolah' ? '' : 'hidden'} space-y-4">
              
              <div class="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-slate-50 p-4 rounded-2xl border border-emerald-200/80 space-y-2">
                <div class="flex items-center gap-2">
                  <i data-lucide="school" class="w-5 h-5 text-emerald-700"></i>
                  <h4 class="font-bold text-slate-800 text-sm">Identitas Sekolah & Kop Surat Resmi</h4>
                </div>
                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Data ini menjadi <strong>Single Source of Truth</strong> untuk kop surat seluruh laporan resmi: <strong>Laporan Rekap Kelas (PDF)</strong>, <strong>Rapor Portofolio Siswa</strong>, <strong>Laporan Kehadiran</strong>, <strong>Jurnal Mengajar</strong>, dan <strong>Daftar Nilai Tugas</strong>.
                </p>
              </div>

              <form id="form-school-settings" class="space-y-4">
                
                <!-- Identitas Utama Sekolah -->
                <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
                  <h5 class="font-bold text-slate-800 text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <i data-lucide="building-2" class="w-3.5 h-3.5"></i>
                    <span>Identitas Resmi Sekolah & Kop Surat Laporan</span>
                  </h5>

                  <!-- Hidden Input untuk logo_url agar data lama tetap aman -->
                  <input type="hidden" id="input-school-logo-url" value="${schoolSettings.logo_url || ''}">

                  <!-- Text Fields Data Sekolah -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Pemerintah / Instansi Induk <span class="text-rose-500">*</span>
                      </label>
                      <input type="text" id="input-school-instansi" required value="${schoolSettings.instansi_induk || 'Pemerintah Provinsi Sulawesi Selatan'}" placeholder="Contoh: Pemerintah Provinsi Sulawesi Selatan" class="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Dinas / Kementerian <span class="text-rose-500">*</span>
                      </label>
                      <input type="text" id="input-school-dinas" required value="${schoolSettings.dinas || 'Dinas Pendidikan'}" placeholder="Contoh: Dinas Pendidikan" class="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="sm:col-span-2">
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Resmi Sekolah <span class="text-rose-500">*</span>
                      </label>
                      <input type="text" id="input-school-nama" required value="${schoolSettings.nama_sekolah || 'SMKN 1 Bantaeng'}" placeholder="Contoh: SMKN 1 Bantaeng" class="w-full text-xs font-black p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="sm:col-span-2">
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Alamat Lengkap Sekolah <span class="text-rose-500">*</span>
                      </label>
                      <input type="text" id="input-school-alamat" required value="${schoolSettings.alamat || 'Jl. Pahlawan No. 12, Bantaeng'}" placeholder="Contoh: Jl. Pahlawan No. 12, Bantaeng" class="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Telepon Sekolah
                      </label>
                      <input type="text" id="input-school-telepon" value="${schoolSettings.telepon || '(0413) 21088'}" placeholder="Contoh: (0413) 21088" class="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Website Resmi
                      </label>
                      <input type="text" id="input-school-website" value="${schoolSettings.website || 'smkn1bantaeng.sch.id'}" placeholder="Contoh: smkn1bantaeng.sch.id" class="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Email Resmi (Opsional)
                      </label>
                      <input type="email" id="input-school-email" value="${schoolSettings.email || ''}" placeholder="Contoh: info@smkn1bantaeng.sch.id" class="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        NPSN (Opsional)
                      </label>
                      <input type="text" id="input-school-npsn" value="${schoolSettings.npsn || ''}" placeholder="Contoh: 40301234" class="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>
                  </div>
                </div>

                <!-- Preview Kop Surat Resmi -->
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Preview Kop Surat Header PDF:</span>
                  <div class="bg-white p-4 rounded-xl border border-slate-200 relative text-slate-800">
                    <div class="border-b-2 border-slate-800 pb-3 text-center">
                      <h5 class="text-xs font-black tracking-wider uppercase text-slate-900 leading-tight">
                        ${schoolSettings.instansi_induk || '[Nama Pemerintah/Instansi Induk]'}<br>
                        ${schoolSettings.dinas ? schoolSettings.dinas + ' • ' : ''}${schoolSettings.nama_sekolah || '[Nama Sekolah Belum Diatur]'}
                      </h5>
                      <p class="text-[10px] text-slate-500 mt-0.5">
                        ${schoolSettings.alamat || ''} ${schoolSettings.telepon ? '• Telp: ' + schoolSettings.telepon : ''} ${schoolSettings.website ? '• Web: ' + schoolSettings.website : ''}
                      </p>
                      <div class="h-0.5 bg-slate-800 mt-2"></div>
                      <div class="h-px bg-slate-800 mt-0.5"></div>
                    </div>
                  </div>
                </div>

                <div class="flex justify-end pt-1">
                  <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition transform active:scale-95">
                    <i data-lucide="save" class="w-4 h-4"></i>
                    <span>Simpan Data Sekolah</span>
                  </button>
                </div>

              </form>

            </div>

            <!-- ============================================================= -->
            <!-- TAB 3: PROFIL GURU & TANDA TANGAN LAPORAN -->
            <!-- ============================================================= -->
            <div class="${activeTab === 'profil' ? '' : 'hidden'} space-y-4">
              
              <div class="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-slate-50 p-4 rounded-2xl border border-emerald-200/80 space-y-2">
                <div class="flex items-center gap-2">
                  <i data-lucide="user-check" class="w-5 h-5 text-emerald-700"></i>
                  <h4 class="font-bold text-slate-800 text-sm">Identitas Guru & Pejabat Penandatangan Laporan</h4>
                </div>
                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Data ini akan otomatis dicantumkan pada kolom tanda tangan lembar <strong>Laporan Rekap Kelas (PDF)</strong>, <strong>Cetak Jurnal Mengajar</strong>, <strong>Cetak Rekap Presensi</strong>, <strong>Cetak Lembar Nilai Tugas</strong>, dan <strong>Cetak Rapor Portofolio Siswa</strong>.
                </p>
              </div>

              <form id="form-profil-guru" class="space-y-4">
                <!-- Data Guru -->
                <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h5 class="font-bold text-slate-800 text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <i data-lucide="user" class="w-3.5 h-3.5"></i>
                    <span>A. Data Guru Pengampu</span>
                  </h5>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lengkap Guru & Gelar <span class="text-rose-500">*</span>
                      </label>
                      <input type="text" id="input-profil-nama-guru" required value="${profilGuru.nama_guru || 'Ammar, S.Pd.'}" placeholder="Contoh: Muammar Qadafie, S.Pd." class="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        NIP / NUPTK Guru
                      </label>
                      <input type="text" id="input-profil-nip-guru" value="${profilGuru.nip_guru || ''}" placeholder="Contoh: 19900101 202012 1 001 (atau -)" class="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>
                  </div>
                </div>

                <!-- Pejabat Penandatangan Laporan -->
                <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h5 class="font-bold text-slate-800 text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
                    <span>B. Pejabat Penandatangan Laporan (Kepala Sekolah)</span>
                  </h5>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Kepala Sekolah / Wakasek <span class="text-rose-500">*</span>
                      </label>
                      <input type="text" id="input-profil-nama-kepsek" required value="${profilGuru.nama_kepsek || 'Drs. H. Syamsuddin, M.Pd.'}" placeholder="Contoh: Drs. H. Syamsuddin, M.Pd." class="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        NIP Kepala Sekolah
                      </label>
                      <input type="text" id="input-profil-nip-kepsek" value="${profilGuru.nip_kepsek || ''}" placeholder="Contoh: 19680512 199403 1 004 (atau -)" class="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="sm:col-span-2">
                      <label class="block text-xs font-semibold text-slate-700 mb-1">
                        Kabupaten / Kota Tempat Penandatanganan
                      </label>
                      <input type="text" id="input-profil-kota" value="${profilGuru.kota || 'Bantaeng'}" placeholder="Contoh: Bantaeng" class="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>
                  </div>
                </div>

                <!-- Preview Format Tanda Tangan -->
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Preview Kolom Tanda Tangan Cetak:</span>
                  <div class="bg-white p-3.5 rounded-xl border border-slate-200/80 flex justify-between text-[11px]">
                    <div class="text-center w-1/2">
                      <p class="text-slate-500">Mengetahui,<br>Kepala Sekolah</p>
                      <div class="h-10"></div>
                      <p class="font-bold text-slate-800 underline">${profilGuru.nama_kepsek || 'Drs. H. Syamsuddin, M.Pd.'}</p>
                      <p class="text-slate-500 text-[10px]">${profilGuru.nip_kepsek ? 'NIP. ' + profilGuru.nip_kepsek : 'NIP. -'}</p>
                    </div>
                    <div class="text-center w-1/2">
                      <p class="text-slate-500">${profilGuru.kota || 'Bantaeng'}, [Tanggal Cetak]<br>Guru Mata Pelajaran</p>
                      <div class="h-10"></div>
                      <p class="font-bold text-slate-800 underline">${profilGuru.nama_guru || 'Ammar, S.Pd.'}</p>
                      <p class="text-slate-500 text-[10px]">${profilGuru.nip_guru ? 'NIP. ' + profilGuru.nip_guru : 'NIP. -'}</p>
                    </div>
                  </div>
                </div>

                <div class="flex justify-end pt-1">
                  <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition transform active:scale-95">
                    <i data-lucide="save" class="w-4 h-4"></i>
                    <span>Simpan Profil & NIP Guru</span>
                  </button>
                </div>
              </form>

            </div>

            <!-- ============================================================= -->
            <!-- TAB 4: SUPABASE CLOUD CONFIG & SETUP DATABASE -->
            <!-- ============================================================= -->
            <div class="${activeTab === 'database' ? '' : 'hidden'} space-y-4">
              
              <!-- Status Koneksi -->
              <div class="p-4 rounded-2xl border ${isConnected ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-amber-50/70 border-amber-200 text-amber-900'} space-y-1">
                <div class="flex items-center gap-2 font-bold text-xs sm:text-sm">
                  <span class="w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                  <span>Status: ${isConnected ? 'Terhubung ke Supabase Cloud (Online)' : 'Mode Penyimpanan Lokal (Offline)'}</span>
                </div>
                <p class="text-[11px] opacity-90 leading-relaxed">
                  ${isConnected ? 'Data absensi, jurnal, ceklis, dan nilai tersinkronisasi otomatis ke cloud database Supabase.' : 'Data tersimpan di penyimpanan browser lokal komputer Anda.'}
                </p>
              </div>

              <!-- Form Kredensial Supabase -->
              <form id="form-supabase-config" class="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <div class="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <i data-lucide="key" class="w-4 h-4 text-emerald-600"></i>
                  <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Kredensial API Supabase</h4>
                </div>

                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Project URL</label>
                  <input type="url" id="input-supabase-url" value="${currentConfig.url || ''}" placeholder="https://xyzcompany.supabase.co" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono">
                </div>

                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Anon / Public API Key</label>
                  <input type="password" id="input-supabase-key" value="${currentConfig.key || ''}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono">
                </div>

                <div class="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" id="btn-disconnect-supabase" class="text-rose-600 hover:text-rose-700 font-bold px-3 py-2 rounded-xl text-xs hover:bg-rose-50 transition">
                    Putuskan Koneksi Cloud
                  </button>

                  <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5">
                    <i data-lucide="save" class="w-4 h-4"></i>
                    <span>Simpan & Hubungkan</span>
                  </button>
                </div>
              </form>

              <!-- Panel Diagnosa & Setup Skema Database -->
              <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div class="flex items-center gap-2">
                    <div class="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <i data-lucide="database" class="w-4 h-4"></i>
                    </div>
                    <div>
                      <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Status & Setup Database Proyek Baru</h4>
                      <p class="text-[11px] text-slate-500">Periksa ketersediaan ke-11 tabel atau pasang skema pada project Supabase baru</p>
                    </div>
                  </div>
                  
                  <button type="button" id="btn-check-schema" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                    <i data-lucide="activity" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>Periksa Struktur Database</span>
                  </button>
                </div>

                <!-- Kontainer Hasil Pemeriksaan Skema -->
                <div id="schema-check-container" class="hidden space-y-3">
                  <div id="schema-check-summary" class="p-3 rounded-xl text-xs font-semibold"></div>
                  <div id="schema-check-table-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 text-xs"></div>
                </div>

                <!-- Panduan & Aksi Instalasi / Setup Database -->
                <div class="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div class="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <i data-lucide="sparkles" class="w-4 h-4 text-amber-500"></i>
                    <span>Setup Database Baru (Turnkey Setup)</span>
                  </div>

                  <p class="text-[11px] text-slate-600 leading-relaxed">
                    Jika menghubungkan proyek Supabase baru yang masih kosong, salin atau unduh skrip <strong>schema.sql</strong> master di bawah, lalu jalankan di menu <strong>SQL Editor</strong> pada Supabase Dashboard Anda.
                  </p>

                  <div class="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" id="btn-copy-schema-sql" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs">
                      <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                      <span>Salin SQL Master (schema.sql)</span>
                    </button>

                    <button type="button" id="btn-download-schema-sql" class="bg-white hover:bg-slate-100 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs border border-slate-200 flex items-center gap-1.5 transition">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                      <span>Unduh File schema.sql</span>
                    </button>

                    <button type="button" id="btn-seed-database" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs">
                      <i data-lucide="package-plus" class="w-3.5 h-3.5"></i>
                      <span>Inisialisasi Data Awal (Seed)</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>

            <!-- ============================================================= -->
            <!-- TAB 5: BACKUP, RESTORE, & TEMA -->
            <!-- ============================================================= -->
            <div class="${activeTab === 'backup' ? '' : 'hidden'} space-y-4">
              
              <!-- Tampilan & Tema Aplikasi -->
              <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <i data-lucide="moon" class="w-4 h-4 text-indigo-600"></i>
                    <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Tema & Tampilan Aplikasi</h4>
                  </div>
                  <button id="btn-settings-toggle-theme" type="button" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition">
                    <i data-lucide="${typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'sun' : 'moon'}" class="w-3.5 h-3.5 ${typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'text-amber-500' : 'text-slate-600'}"></i>
                    <span>${typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}</span>
                  </button>
                </div>
                <p class="text-[11px] text-slate-500">
                  Pilih mode gelap untuk kenyamanan mata saat menginput nilai dan jurnal mengajar di malam hari.
                </p>
              </div>

              <!-- Backup & Restore -->
              <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <div class="flex items-center gap-2">
                  <i data-lucide="hard-drive" class="w-4 h-4 text-blue-600"></i>
                  <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Cadangan Data (Backup & Restore)</h4>
                </div>

                <p class="text-[11px] text-slate-600">
                  Unduh seluruh data master mapel, data sekolah, kelas, siswa, profil guru, absensi, jurnal, dan nilai ke dalam file JSON cadangan.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button id="btn-export-backup" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold p-2.5 rounded-xl flex items-center justify-center gap-1.5 transition">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    <span>Unduh Cadangan JSON</span>
                  </button>

                  <label class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold p-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer text-center">
                    <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                    <span>Pulihkan dari File JSON</span>
                    <input type="file" id="input-restore-file" accept=".json" class="hidden">
                  </label>
                </div>
              </div>

              <!-- Bersihkan Data Percobaan Dummy -->
              <div class="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4 text-amber-600"></i>
                    <h4 class="font-bold text-amber-900 text-xs">Bersihkan Semua Data Percobaan (Dummy)</h4>
                  </div>
                  <button id="btn-clear-dummy" type="button" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow transition">
                    Bersihkan Data Dummy
                  </button>
                </div>
                <p class="text-[11px] text-amber-700">
                  Menghapus seluruh riwayat absensi, jurnal, ceklis, nilai tugas, dan catatan kegiatan percobaan agar aplikasi bersih dan siap digunakan untuk tahun ajaran baru (Data Master Kelas & Siswa tetap aman).
                </p>
              </div>

              <!-- Reset Demo Data -->
              <div class="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="font-bold text-rose-800 text-xs">Reset ke Data Master Default</h4>
                  <button id="btn-reset-demo" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow transition">
                    Reset Data Master
                  </button>
                </div>
                <p class="text-[11px] text-rose-600">
                  Mengembalikan data master mapel, identitas sekolah, kelas TJKT/DKV/MPLB/AKL, dan siswa standar ke kondisi awal.
                </p>
              </div>

            </div>

            <!-- ============================================================= -->
            <!-- TAB 6: TENTANG APLIKASI & KREDIT PENGEMBANG -->
            <!-- ============================================================= -->
            <div class="${activeTab === 'about' ? '' : 'hidden'} space-y-4">
              
              <!-- Hero Card: Identitas Aplikasi -->
              <div class="bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-md border border-emerald-700/50 space-y-4">
                <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  <div class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner flex-shrink-0">
                    <i data-lucide="graduation-cap" class="w-9 h-9"></i>
                  </div>
                  <div class="space-y-1">
                    <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h4 class="text-base sm:text-lg font-black tracking-tight">${APP_INFO.name}</h4>
                      <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full font-mono">
                        ${APP_INFO.version}
                      </span>
                    </div>
                    <p class="text-xs text-emerald-100/90 leading-relaxed max-w-xl">
                      ${APP_INFO.description}
                    </p>
                  </div>
                </div>

                <!-- Ringkasan Fitur Utama -->
                <div class="pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span class="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 font-semibold">Presensi Siswa</span>
                  <span class="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 font-semibold">Jurnal Mengajar</span>
                  <span class="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 font-semibold">Penilaian Tugas & KKM</span>
                  <span class="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 font-semibold">Ceklis Catatan & PR</span>
                  <span class="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 font-semibold">Rekapitulasi Portofolio</span>
                  <span class="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 font-semibold">Kenaikan Kelas</span>
                  <span class="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 font-semibold">PWA Installable</span>
                </div>
              </div>

              <!-- Detail Pengembang & Kontak Resmi -->
              <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div class="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <i data-lucide="user-check" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Kredit & Pengembang Aplikasi</h4>
                    <p class="text-[11px] text-slate-500">Informasi hak cipta dan kontak pengembang resmi</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <!-- Card Nama Pembuat -->
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div class="text-[10px] uppercase font-bold text-slate-400">Dibuat Oleh</div>
                    <div class="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <span>${APP_INFO.author.name}</span>
                      <span class="text-[10px] font-normal text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">Author</span>
                    </div>
                    <div class="text-[11px] text-slate-500">${APP_INFO.author.role}</div>
                  </div>

                  <!-- Card Asal Kota -->
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div class="text-[10px] uppercase font-bold text-slate-400">Asal</div>
                    <div class="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-500 flex-shrink-0"></i>
                      <span>${APP_INFO.author.location}</span>
                    </div>
                    <div class="text-[11px] text-slate-500">Indonesia</div>
                  </div>

                  <!-- Card Tahun & Hak Cipta -->
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div class="text-[10px] uppercase font-bold text-slate-400">Hak Cipta & Rilis</div>
                    <div class="text-sm font-black text-slate-800">${APP_INFO.copyright}</div>
                    <div class="text-[11px] text-slate-500">Tahun Rilis: ${APP_INFO.releaseDate} • All rights reserved</div>
                  </div>
                </div>

                <!-- Tombol Kontak WhatsApp Khusus -->
                <div class="p-4 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div class="flex items-center gap-3 text-center sm:text-left">
                    <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
                      <i data-lucide="message-circle" class="w-5 h-5"></i>
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 text-xs">Konsultasi & Dukungan Teknis</div>
                      <div class="text-[11px] text-slate-600">WhatsApp: <strong class="font-mono text-emerald-800">${APP_INFO.author.whatsappDisplay || APP_INFO.author.whatsapp}</strong></div>
                    </div>
                  </div>

                  <a href="${APP_INFO.author.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 flex-shrink-0">
                    <i data-lucide="send" class="w-3.5 h-3.5"></i>
                    <span>Hubungi via WhatsApp</span>
                  </a>
                </div>

              </div>

            </div>

          </div>

          <!-- Footer Modal -->
          <div class="pt-3 border-t border-slate-100 flex justify-end flex-shrink-0">
            <button id="btn-close-settings-footer" class="bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-700 transition">
              Tutup Pengaturan
            </button>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // =========================================================================
    // EVENT BINDINGS
    // =========================================================================

    // Close Modal
    modalContainer.querySelector('#btn-close-settings-modal')?.addEventListener('click', onClose);
    modalContainer.querySelector('#btn-close-settings-footer')?.addEventListener('click', onClose);

    // Tab Switches
    modalContainer.querySelector('#tab-btn-mapel')?.addEventListener('click', () => {
      activeTab = 'mapel';
      renderModalContent();
    });

    modalContainer.querySelector('#tab-btn-jam')?.addEventListener('click', () => {
      activeTab = 'jam';
      renderModalContent();
    });

    modalContainer.querySelector('#tab-btn-sekolah')?.addEventListener('click', () => {
      activeTab = 'sekolah';
      renderModalContent();
    });

    modalContainer.querySelector('#tab-btn-profil')?.addEventListener('click', () => {
      activeTab = 'profil';
      renderModalContent();
    });

    modalContainer.querySelector('#tab-btn-database')?.addEventListener('click', () => {
      activeTab = 'database';
      renderModalContent();
    });

    modalContainer.querySelector('#tab-btn-backup')?.addEventListener('click', () => {
      activeTab = 'backup';
      renderModalContent();
    });

    modalContainer.querySelector('#tab-btn-about')?.addEventListener('click', () => {
      activeTab = 'about';
      renderModalContent();
    });

    // Inisialisasi Kelompok Combobox (Umum / Kejuruan)
    initKelompokCombobox(modalContainer, {
      id: 'select-mapel-kategori'
    });

    // Form Submit Mapel (Tambah / Edit)
    modalContainer.querySelector('#form-mapel-submit')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = modalContainer.querySelector('#input-mapel-nama').value.trim();
      const kode = modalContainer.querySelector('#input-mapel-kode').value.trim();
      const kategori = modalContainer.querySelector('#select-mapel-kategori').value;

      if (!nama) {
        showToast('Nama mata pelajaran wajib diisi!', 'error');
        return;
      }

      if (editingMapel) {
        await db.updateMataPelajaran(editingMapel.id, { nama_mapel: nama, kode, kategori });
        showToast(`Mata pelajaran "${nama}" berhasil diperbarui!`, 'success');
        editingMapel = null;
      } else {
        await db.addMataPelajaran({ nama_mapel: nama, kode, kategori });
        showToast(`Mata pelajaran "${nama}" berhasil ditambahkan!`, 'success');
      }

      await onConfigSaved(nama);
      renderModalContent();
    });

    // Cancel Edit Mapel
    modalContainer.querySelector('#btn-cancel-edit-mapel')?.addEventListener('click', () => {
      editingMapel = null;
      renderModalContent();
    });

    // Edit Mapel Click
    modalContainer.querySelectorAll('.btn-edit-mapel').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const nama_mapel = btn.getAttribute('data-nama');
        const kode = btn.getAttribute('data-kode');
        const kategori = btn.getAttribute('data-kategori');
        editingMapel = { id, nama_mapel, kode, kategori };
        renderModalContent();
      });
    });

    // Delete Mapel Click
    modalContainer.querySelectorAll('.btn-delete-mapel').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nama = btn.getAttribute('data-nama');
        if (id && confirm(`Apakah Anda yakin ingin menghapus mata pelajaran "${nama}"?`)) {
          await db.deleteMataPelajaran(id);
          showToast(`Mata pelajaran "${nama}" telah dihapus`, 'info');
          await onConfigSaved();
          renderModalContent();
        }
      });
    });

    // =========================================================================
    // EVENT HANDLERS: MASTER JAM PELAJARAN (JP)
    // =========================================================================

    // Form Submit Jam Master (Tambah / Edit)
    modalContainer.querySelector('#form-jam-submit')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nomor_urut = Number(modalContainer.querySelector('#input-jam-urut').value) || 1;
      const label = modalContainer.querySelector('#input-jam-label').value.trim();
      const jam_mulai = modalContainer.querySelector('#input-jam-mulai').value;
      const jam_selesai = modalContainer.querySelector('#input-jam-selesai').value;
      const keterangan = modalContainer.querySelector('#input-jam-ket').value.trim();

      if (!label || !jam_mulai || !jam_selesai) {
        showToast('Label, jam mulai, dan jam selesai wajib diisi!', 'error');
        return;
      }

      if (jam_selesai <= jam_mulai) {
        showToast('Jam selesai harus lebih akhir dari jam mulai!', 'error');
        return;
      }

      const isIstirahat = modalContainer.querySelector('#input-jam-istirahat')?.checked || false;

      const payload = {
        id: editingJam ? editingJam.id : undefined,
        nomor_urut,
        label,
        jam_mulai,
        jam_selesai,
        tipe_slot: isIstirahat ? 'istirahat' : 'mengajar',
        keterangan
      };

      const res = await db.saveJamPelajaranMaster(payload);
      if (res.success) {
        showToast(editingJam ? `Slot "${label}" berhasil diperbarui!` : `Slot "${label}" berhasil ditambahkan!`, 'success');
        editingJam = null;
        renderModalContent();
      } else {
        showToast(res.error || 'Gagal menyimpan slot jam', 'error');
      }
    });

    // Cancel Edit Jam
    modalContainer.querySelector('#btn-cancel-edit-jam')?.addEventListener('click', () => {
      editingJam = null;
      renderModalContent();
    });

    // Edit Jam Click
    modalContainer.querySelectorAll('.btn-edit-jam').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = jamMasterList.find(j => j.id === id);
        if (item) {
          editingJam = { ...item };
          renderModalContent();
        }
      });
    });

    // Delete Jam Click
    modalContainer.querySelectorAll('.btn-delete-jam').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const label = btn.getAttribute('data-label');
        if (id && confirm(`Apakah Anda yakin ingin menghapus slot "${label}"?`)) {
          await db.deleteJamPelajaranMaster(id);
          showToast(`Slot "${label}" telah dihapus`, 'info');
          renderModalContent();
        }
      });
    });

    // Reset Jam Master ke Default
    modalContainer.querySelector('#btn-reset-default-jam')?.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin mereset seluruh daftar jam pelajaran ke 13 JP standar?')) {
        await db.resetJamPelajaranMasterToDefault();
        showToast('Master jam pelajaran berhasil direset ke default 13 JP!', 'success');
        renderModalContent();
      }
    });

    // Logo Upload Handling (Base64 file reader)
    modalContainer.querySelector('#input-school-logo-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran logo maksimal 2MB!', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const base64Data = loadEvt.target.result;
        const hiddenInp = modalContainer.querySelector('#input-school-logo-url');
        if (hiddenInp) hiddenInp.value = base64Data;

        // Update preview langsung
        const prevContainer = modalContainer.querySelector('#preview-school-logo');
        if (prevContainer) {
          prevContainer.src = base64Data;
        } else {
          renderModalContent();
        }
        showToast('Logo sekolah berhasil dipilih! Klik "Simpan Data Sekolah" untuk menerapkan.', 'info');
      };
      reader.readAsDataURL(file);
    });

    // Remove Logo
    modalContainer.querySelector('#btn-remove-school-logo')?.addEventListener('click', () => {
      const hiddenInp = modalContainer.querySelector('#input-school-logo-url');
      if (hiddenInp) hiddenInp.value = '';
      showToast('Logo dihapus. Klik "Simpan Data Sekolah" untuk menyimpan.', 'info');
      renderModalContent();
    });

    // Form Submit Data Sekolah
    modalContainer.querySelector('#form-school-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const instansi_induk = modalContainer.querySelector('#input-school-instansi').value.trim();
      const dinas = modalContainer.querySelector('#input-school-dinas').value.trim();
      const nama_sekolah = modalContainer.querySelector('#input-school-nama').value.trim();
      const alamat = modalContainer.querySelector('#input-school-alamat').value.trim();
      const telepon = modalContainer.querySelector('#input-school-telepon').value.trim();
      const email = modalContainer.querySelector('#input-school-email').value.trim();
      const website = modalContainer.querySelector('#input-school-website').value.trim();
      const npsn = modalContainer.querySelector('#input-school-npsn').value.trim();
      const logo_url = modalContainer.querySelector('#input-school-logo-url').value.trim();

      if (!nama_sekolah) {
        showToast('Nama sekolah wajib diisi!', 'error');
        return;
      }

      const res = await db.saveSchoolSettings({
        instansi_induk,
        dinas,
        nama_sekolah,
        alamat,
        telepon,
        email,
        website,
        npsn,
        logo_url
      });

      if (res.success) {
        showToast('Data sekolah & kop surat berhasil disimpan!', 'success');
        await onConfigSaved();
        renderModalContent();
      } else {
        showToast(res.message || 'Gagal menyimpan data sekolah', 'error');
      }
    });

    // Save Profil Guru & NIP
    modalContainer.querySelector('#form-profil-guru')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama_guru = modalContainer.querySelector('#input-profil-nama-guru').value.trim();
      const nip_guru = modalContainer.querySelector('#input-profil-nip-guru').value.trim();
      const nama_kepsek = modalContainer.querySelector('#input-profil-nama-kepsek').value.trim();
      const nip_kepsek = modalContainer.querySelector('#input-profil-nip-kepsek').value.trim();
      const kota = modalContainer.querySelector('#input-profil-kota').value.trim();

      if (!nama_guru) {
        showToast('Nama guru wajib diisi!', 'error');
        return;
      }

      const res = await db.saveProfilGuru({
        nama_guru,
        nip_guru,
        nama_kepsek,
        nip_kepsek,
        kota
      });

      if (res.success) {
        showToast('Profil guru & NIP berhasil disimpan!', 'success');
        await onConfigSaved();
        renderModalContent();
      } else {
        showToast(res.message || 'Gagal menyimpan profil guru', 'error');
      }
    });

    // Save Supabase Config
    modalContainer.querySelector('#form-supabase-config')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = modalContainer.querySelector('#input-supabase-url').value.trim();
      const key = modalContainer.querySelector('#input-supabase-key').value.trim();

      if (!url || !key) {
        showToast('Project URL dan API Key wajib diisi!', 'error');
        return;
      }

      showToast('Menghubungkan ke Supabase Cloud...', 'info');
      const res = await db.saveConfig({ url, key });

      if (res.success) {
        showToast('Berhasil terhubung ke Supabase Cloud!', 'success');
        await onConfigSaved();
        renderModalContent();
      } else {
        showToast(res.message, 'error');
      }
    });

    // Disconnect Supabase
    modalContainer.querySelector('#btn-disconnect-supabase')?.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin memutuskan koneksi Supabase Cloud dan beralih ke penyimpanan lokal offline?')) {
        await db.saveConfig({ url: '', key: '' });
        showToast('Koneksi Supabase diputuskan. Beralih ke penyimpanan lokal.', 'info');
        await onConfigSaved();
        renderModalContent();
      }
    });

    // Check Database Schema & Tables
    modalContainer.querySelector('#btn-check-schema')?.addEventListener('click', async () => {
      const containerEl = modalContainer.querySelector('#schema-check-container');
      const summaryEl = modalContainer.querySelector('#schema-check-summary');
      const listEl = modalContainer.querySelector('#schema-check-table-list');
      const checkBtn = modalContainer.querySelector('#btn-check-schema');

      if (!containerEl || !summaryEl || !listEl) return;

      containerEl.classList.remove('hidden');
      summaryEl.className = 'p-3 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 flex items-center gap-2';
      summaryEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-emerald-600"></i><span>Memeriksa ke-17 tabel di database Supabase Cloud...</span>`;
      if (window.lucide) window.lucide.createIcons();

      if (checkBtn) checkBtn.disabled = true;

      const report = await db.checkDatabaseSchema();

      if (checkBtn) checkBtn.disabled = false;

      if (!report.isConnected) {
        summaryEl.className = 'p-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200';
        summaryEl.innerHTML = `<div class="flex items-center gap-2 font-bold"><i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i><span>Supabase Belum Terhubung</span></div><p class="text-[11px] font-normal mt-1">Masukkan Project URL dan API Key Supabase lalu klik Simpan & Hubungkan terlebih dahulu.</p>`;
        listEl.innerHTML = '';
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      if (report.isFullyInstalled) {
        summaryEl.className = 'p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200';
        summaryEl.innerHTML = `<div class="flex items-center gap-2 font-bold"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i><span>Struktur Database 100% Lengkap & Siap Pakai</span></div><p class="text-[11px] font-normal mt-0.5">Semua ${report.totalTables} tabel (${report.existingCount}/${report.totalTables}) dan Stored Procedure Kenaikan Kelas terpasang aktif di Supabase.</p>`;
      } else {
        summaryEl.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-900 border border-rose-200';
        summaryEl.innerHTML = `<div class="flex items-center gap-2 font-bold"><i data-lucide="alert-circle" class="w-4 h-4 text-rose-600"></i><span>Ditemukan ${report.missingCount} Tabel / Prosedur Belum Dibuat</span></div><p class="text-[11px] font-normal mt-0.5">Jalankan skrip <strong>schema.sql</strong> master di SQL Editor Supabase untuk melengkapi tabel yang belum ada.</p>`;
      }

      listEl.innerHTML = report.tables.map(t => `
        <div class="p-2.5 rounded-xl border ${t.exists ? 'bg-emerald-50/40 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200' : 'bg-rose-50/40 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200'} flex items-start gap-2">
          <div class="mt-0.5">${t.exists ? '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0"></i>' : '<i data-lucide="x-circle" class="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0"></i>'}</div>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-xs flex items-center justify-between">
              <span>${t.label}</span>
              <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-md ${t.exists ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'}">${t.name}</span>
            </div>
            <p class="text-[10px] opacity-75 mt-0.5 leading-tight">${t.desc}</p>
            ${!t.exists ? `<p class="text-[9px] text-rose-600 dark:text-rose-400 font-mono mt-0.5 truncate">Status: Belum ada di database</p>` : ''}
          </div>
        </div>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    });

    // Copy Master schema.sql to Clipboard
    modalContainer.querySelector('#btn-copy-schema-sql')?.addEventListener('click', async () => {
      try {
        const resp = await fetch('schema.sql');
        if (!resp.ok) throw new Error('Gagal memuat schema.sql');
        const sqlText = await resp.text();
        await navigator.clipboard.writeText(sqlText);
        showToast('Skrip master schema.sql berhasil disalin ke clipboard! Siap ditempel di Supabase SQL Editor.', 'success');
      } catch (err) {
        showToast(`Gagal menyalin SQL: ${err.message}`, 'error');
      }
    });

    // Download Master schema.sql File
    modalContainer.querySelector('#btn-download-schema-sql')?.addEventListener('click', async () => {
      try {
        const resp = await fetch('schema.sql');
        const sqlText = resp.ok ? await resp.text() : '-- schema.sql master';
        const blob = new Blob([sqlText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'schema.sql';
        a.click();
        URL.revokeObjectURL(url);
        showToast('File master schema.sql berhasil diunduh!', 'success');
      } catch (err) {
        showToast(`Gagal mengunduh file: ${err.message}`, 'error');
      }
    });

    // Seed Initial Database Data
    modalContainer.querySelector('#btn-seed-database')?.addEventListener('click', async () => {
      if (!confirm('Inisialisasi data awal akan mengisi daftar master mapel standar dan template data sekolah jika masih kosong di Supabase. Lanjutkan?')) {
        return;
      }

      showToast('Menginisialisasi data awal ke Supabase...', 'info');
      const res = await db.seedInitialDatabase();
      if (res.success) {
        showToast(res.message, 'success');
        await onConfigSaved();
        renderModalContent();
      } else {
        showToast(res.message, 'error');
      }
    });

    // Toggle Theme
    modalContainer.querySelector('#btn-settings-toggle-theme')?.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      showToast(`Mode ${isDark ? 'Gelap' : 'Terang'} diaktifkan`, 'info');
      renderModalContent();
    });

    // Export Backup JSON
    modalContainer.querySelector('#btn-export-backup')?.addEventListener('click', () => {
      const jsonStr = db.exportBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `SIA-Jurnal-Backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Cadangan JSON berhasil diunduh!', 'success');
    });

    // Restore Backup JSON
    modalContainer.querySelector('#input-restore-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const content = evt.target.result;
        const res = db.importBackupJSON(content);
        if (res.success) {
          showToast(res.message, 'success');
          await onConfigSaved();
          renderModalContent();
        } else {
          showToast(res.message, 'error');
        }
      };
      reader.readAsText(file);
    });

    // Clear Dummy Data
    modalContainer.querySelector('#btn-clear-dummy')?.addEventListener('click', async () => {
      if (confirm('PERINGATAN: Apakah Anda yakin ingin mengosongkan seluruh riwayat data percobaan (absensi, jurnal, ceklis, nilai tugas)? Data master kelas dan siswa TIDAK akan dihapus.')) {
        db.clearDummyData();
        showToast('Data riwayat percobaan berhasil dibersihkan!', 'success');
        await onConfigSaved();
        renderModalContent();
      }
    });

    // Reset Demo Master Data
    modalContainer.querySelector('#btn-reset-demo')?.addEventListener('click', async () => {
      if (confirm('PERINGATAN: Apakah Anda yakin ingin mereset seluruh data master (mapel, kelas, siswa) ke data standar? Seluruh data yang ada akan diganti.')) {
        db.resetDemoData();
        showToast('Data master berhasil di-reset ke standar', 'info');
        await onConfigSaved();
        renderModalContent();
      }
    });

  }

  await renderModalContent();
}

/**
 * Helper modal untuk membuka pengaturan cepat Mapel
 */
export async function renderQuickEditMapelModal(modalContainer, targetMapelName, onClose, onMapelUpdated, showToast) {
  return renderSettingsModal(modalContainer, onClose, onMapelUpdated, showToast, 'mapel');
}

