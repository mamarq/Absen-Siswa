// components/JadwalMengajarView.js - Modul Penugasan & Jadwal Mengajar Guru
import { db } from '../supabase-client.js';
import { renderHariComboboxHTML, initHariCombobox, HARI_OPTIONS } from './HariCombobox.js';
import { renderJadwalModal } from './JadwalModal.js';

export async function renderJadwalMengajarView(container, state, onNavigate, showToast, onOpenModal) {
  let activeSubTab = 'penugasan'; // 'penugasan' | 'jadwal'
  const currentAcademicYear = await db.getActiveAcademicYear();
  const [activePeriod, kelasList, mapelList, jamMasterList, academicYears] = await Promise.all([
    db.getActiveSemester(),
    db.getClassesByYear(currentAcademicYear, false),
    db.getMataPelajaran(),
    db.getJamPelajaranMaster(),
    db.getDistinctAcademicYears()
  ]);

  // UI Default: Gunakan semester dari activePeriod jika tersedia, atau fallback UI sementara 'Ganjil'
  let selectedSemester = state.selectedSemester || (activePeriod?.semester || 'Ganjil'); // 'Ganjil' | 'Genap'
  let filterHari = 'semua'; // 'semua' | 'Senin' | 'Selasa' | ...

  // Selected mapel for Penugasan tab (default: first mapel)
  let selectedMapelId = mapelList.length > 0 ? mapelList[0].id : '';

  async function loadJadwal() {
    return await db.getJadwalMengajarList({
      academic_year: currentAcademicYear,
      hari: filterHari === 'semua' ? undefined : filterHari,
      only_active: true
    });
  }

  async function loadAssignments() {
    return await db.getGuruMengajarCached(currentAcademicYear, selectedSemester);
  }

  async function render() {
    // Cek status periode semester aktif untuk Mode Arsip
    const periodeSemesterObj = await db.getPeriodeSemester(currentAcademicYear, selectedSemester);
    const isArchived = Boolean(periodeSemesterObj && periodeSemesterObj.status === 'ditutup');

    const [jadwalList, allAssignments] = await Promise.all([
      loadJadwal(),
      loadAssignments()
    ]);

    const totalJP = jadwalList.reduce((acc, curr) => acc + (Number(curr.jumlah_jp) || 1), 0);
    const totalSesi = jadwalList.length;

    // Filter assignments for selected mapel
    const selectedMapelObj = mapelList.find(m => m.id === selectedMapelId) || mapelList[0] || { id: '', nama_mapel: 'Mata Pelajaran' };
    const currentMapelName = selectedMapelObj.nama_mapel;

    const mapelAssignments = allAssignments.filter(g =>
      (g.mapel_id === selectedMapelObj.id || g.mapel === currentMapelName)
    );

    const activeAssignedKelasIds = new Set(
      mapelAssignments.filter(g => g.is_active !== false).map(g => g.kelas_id)
    );

    const inactiveAssignmentsMap = new Map();
    mapelAssignments.filter(g => g.is_active === false).forEach(g => {
      inactiveAssignmentsMap.set(g.kelas_id, g);
    });

    const activeAssignmentsMap = new Map();
    mapelAssignments.filter(g => g.is_active !== false).forEach(g => {
      activeAssignmentsMap.set(g.kelas_id, g);
    });

    const totalActiveAssignmentsCount = allAssignments.filter(g => g.is_active !== false).length;

    // Group jadwal by day
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
    Object.keys(groupedByDay).forEach(day => {
      groupedByDay[day].sort((a, b) => (a.jam_mulai || '').localeCompare(b.jam_mulai || ''));
    });

    // Group master classes by level
    const groupedKelas = db.getGroupedKelasMap(kelasList);
    const groupOrder = ['Tingkat X', 'Tingkat XI', 'Tingkat XII', 'Lainnya'];

    container.innerHTML = `
      <div class="space-y-6 pb-24 max-w-7xl mx-auto">

        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-5 sm:p-7 rounded-3xl shadow-sm border border-emerald-700/50 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div class="flex items-center gap-4">
            <div class="p-3.5 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30 flex-shrink-0">
              <i data-lucide="${activeSubTab === 'penugasan' ? 'clipboard-check' : 'calendar-clock'}" class="w-8 h-8"></i>
            </div>
            <div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <h2 class="font-black text-xl sm:text-2xl tracking-tight">Penugasan & Jadwal Mengajar</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase">
                  Tahun Ajaran ${currentAcademicYear} • Semester ${selectedSemester}
                </span>
              </div>
              <p class="text-xs text-emerald-100/80 mt-1 max-w-xl">
                Atur kelas dan mata pelajaran yang Anda ajar secara mandiri per semester. Pengisian jadwal hari dan jam bersifat opsional untuk kemudahan otomatisasi KBM.
              </p>
            </div>
          </div>

          <!-- Top Navigation Tabs (Pill Switcher) -->
          <div class="flex items-center bg-slate-950/50 p-1.5 rounded-2xl border border-emerald-500/30 backdrop-blur-md self-start md:self-auto">
            <button
              id="subtab-btn-penugasan"
              class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'penugasan' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40' : 'text-slate-300 hover:text-white hover:bg-white/10'}"
            >
              <i data-lucide="check-square" class="w-4 h-4"></i>
              <span>1. Penugasan Mengajar</span>
              ${totalActiveAssignmentsCount > 0 ? `<span class="px-1.5 py-0.2 text-[10px] rounded-full ${activeSubTab === 'penugasan' ? 'bg-white text-emerald-800' : 'bg-emerald-500/30 text-emerald-300'} font-black">${totalActiveAssignmentsCount}</span>` : ''}
            </button>

            <button
              id="subtab-btn-jadwal"
              class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'jadwal' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40' : 'text-slate-300 hover:text-white hover:bg-white/10'}"
            >
              <i data-lucide="calendar-clock" class="w-4 h-4"></i>
              <span>2. Jadwal Mingguan <small class="font-normal opacity-75">(Opsional)</small></span>
              ${totalSesi > 0 ? `<span class="px-1.5 py-0.2 text-[10px] rounded-full ${activeSubTab === 'jadwal' ? 'bg-white text-emerald-800' : 'bg-emerald-500/30 text-emerald-300'} font-black">${totalSesi}</span>` : ''}
            </button>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- TAB 1: PENUGASAN MENGAJAR (ASSIGNMENT MATRIX) -->
        <!-- ========================================================================= -->
        ${activeSubTab === 'penugasan' ? `
          <div class="space-y-6 animate-fade-in">

            <!-- Controls Card: Tahun Ajaran, Semester & Mata Pelajaran -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">

              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

                <!-- 1. Pilihan Tahun Ajaran -->
                <div class="space-y-1.5">
                  <label for="penugasan-select-year" class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <i data-lucide="calendar" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                    <span>Tahun Ajaran:</span>
                  </label>
                  <select
                    id="penugasan-select-year"
                    class="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition cursor-pointer"
                  >
                    ${academicYears.map(y => `
                      <option value="${y}" ${y === currentAcademicYear ? 'selected' : ''}>Tahun Ajaran ${y}</option>
                    `).join('')}
                  </select>
                </div>

                <!-- 2. Pilihan Semester -->
                <div class="space-y-1.5">
                  <label for="penugasan-select-semester" class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <i data-lucide="clock" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                    <span>Semester:</span>
                  </label>
                  <select
                    id="penugasan-select-semester"
                    class="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition cursor-pointer"
                  >
                    <option value="Ganjil" ${selectedSemester === 'Ganjil' ? 'selected' : ''}>Semester Ganjil</option>
                    <option value="Genap" ${selectedSemester === 'Genap' ? 'selected' : ''}>Semester Genap</option>
                  </select>
                </div>

                <!-- 3. Pilihan Mata Pelajaran -->
                <div class="space-y-1.5 sm:col-span-2 md:col-span-1">
                  <label for="penugasan-select-mapel" class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <i data-lucide="book-open" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                    <span>Mata Pelajaran yang Diampu:</span>
                  </label>
                  <select
                    id="penugasan-select-mapel"
                    class="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition cursor-pointer"
                  >
                    ${mapelList.map(m => `
                      <option value="${m.id}" ${m.id === selectedMapelId ? 'selected' : ''}>${m.nama_mapel} ${m.kode ? `(${m.kode})` : ''} — [${m.kategori || 'UMUM'}]</option>
                    `).join('')}
                  </select>
                </div>

              </div>

              <!-- Context Help Banner -->
              <div class="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-3">
                <i data-lucide="info" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5"></i>
                <div class="text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5">
                  <p class="font-bold">Panduan Penugasan:</p>
                  <p class="text-[11px] leading-relaxed opacity-90">
                    Centang seluruh kelas yang Anda ajar untuk mata pelajaran <strong>"${currentMapelName}"</strong> pada Tahun Ajaran ${currentAcademicYear} (<strong>Semester ${selectedSemester}</strong>). Klik tombol <strong>Simpan Penugasan</strong> untuk membuka akses Absensi, Jurnal, Tugas, dan Rekap Nilai secara instan.
                  </p>
                </div>
              </div>

            </div>

            ${isArchived ? `
              <!-- Mode Arsip Notice Banner Penugasan -->
              <div class="p-4 rounded-3xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-3.5 shadow-xs">
                <div class="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
                  <i data-lucide="archive" class="w-5 h-5"></i>
                </div>
                <div class="text-xs space-y-1">
                  <h4 class="font-black text-amber-900 dark:text-amber-200 text-sm">Mode Arsip Aktif (Read-Only)</h4>
                  <p class="text-amber-900/80 dark:text-amber-300/80 leading-relaxed font-medium">
                    Semester ${selectedSemester} Tahun Ajaran ${currentAcademicYear} telah ditutup. Penugasan mengajar hanya dapat dilihat (read-only) dan tidak dapat diubah atau ditambah.
                  </p>
                </div>
              </div>
            ` : ''}

            <!-- Empty State jika Belum Ada Assignment Sama Sekali di Semester Ini -->
            ${totalActiveAssignmentsCount === 0 ? `
              <div class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs">
                <i data-lucide="sparkles" class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0"></i>
                <div>
                  <p class="font-extrabold">Belum ada penugasan mengajar untuk Semester ${selectedSemester}.</p>
                  <p class="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                    Silakan pilih mata pelajaran di atas dan centang kelas yang Anda ajar untuk Semester ${selectedSemester} di bawah ini, kemudian klik tombol Simpan Penugasan.
                  </p>
                </div>
              </div>
            ` : ''}

            <!-- Class Selection Matrix Form -->
            <form id="form-penugasan-matrix" class="space-y-5">

              ${kelasList.length === 0 ? `
                <div class="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <i data-lucide="school" class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600"></i>
                  <h4 class="font-bold text-sm text-slate-700 dark:text-slate-300">Belum Ada Data Kelas</h4>
                  <p class="text-xs text-slate-400">Tidak ada data kelas yang terdaftar untuk Tahun Ajaran ${currentAcademicYear}.</p>
                </div>
              ` : groupOrder.map(grpName => {
                const items = groupedKelas[grpName] || [];
                if (items.length === 0) return '';

                const allCheckedInGroup = items.every(k => activeAssignedKelasIds.has(k.id));
                const someCheckedInGroup = items.some(k => activeAssignedKelasIds.has(k.id));

                return `
                  <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">

                    <!-- Group Header with Select All Button -->
                    <div class="px-5 py-3.5 bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-tight">${grpName}</h3>
                        <span class="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                          ${items.length} Rombel
                        </span>
                      </div>

                      <button
                        type="button"
                        class="btn-toggle-group-select text-[11px] font-bold ${isArchived ? 'opacity-40 cursor-not-allowed text-slate-400' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline cursor-pointer'} flex items-center gap-1"
                        data-group="${grpName}"
                        ${isArchived ? 'disabled' : ''}
                      >
                        <i data-lucide="${allCheckedInGroup ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5"></i>
                        <span>${allCheckedInGroup ? 'Batal Pilih Semua' : 'Pilih Semua ' + grpName}</span>
                      </button>
                    </div>

                    <!-- Classes Checkbox Grid -->
                    <div class="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      ${items.map(k => {
                        const isChecked = activeAssignedKelasIds.has(k.id);

                        return `
                          <label
                            class="class-assignment-card relative flex items-start gap-3 p-3.5 rounded-2xl border ${isArchived ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} transition select-none ${
                              isChecked
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs ring-1 ring-emerald-400/40'
                                : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            }"
                            data-kelas-id="${k.id}"
                            data-group="${grpName}"
                          >
                            <input
                              type="checkbox"
                              name="assigned_classes"
                              value="${k.id}"
                              class="checkbox-class-item mt-0.5 w-4 h-4 text-emerald-600 rounded-md border-slate-300 dark:border-slate-600 focus:ring-emerald-500 ${isArchived ? 'cursor-not-allowed' : 'cursor-pointer'}"
                              ${isChecked ? 'checked' : ''}
                              ${isArchived ? 'disabled' : ''}
                            />

                            <div class="min-w-0 flex-1 space-y-1">
                              <div class="flex items-center justify-between gap-1">
                                <span class="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate">${k.nama_kelas}</span>
                                ${isChecked ? `
                                  <span class="px-1.5 py-0.2 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider flex-shrink-0">
                                    Diampu
                                  </span>
                                ` : ''}
                              </div>
                              ${k.jurusan ? `
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">${k.jurusan}</p>
                              ` : ''}
                            </div>
                          </label>
                        `;
                      }).join('')}
                    </div>

                  </div>
                `;
              }).join('')}

              <!-- Sticky / Fixed Save Bar -->
              <div class="sticky bottom-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3 text-xs">
                  <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black">
                    <span id="label-selected-count">${activeAssignedKelasIds.size}</span>
                  </div>
                  <div>
                    <span class="font-bold text-slate-800 dark:text-slate-100">Kelas Terpilih untuk "${currentMapelName}"</span>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400">
                      ${isArchived ? 'Semester ditutup. Penugasan tidak dapat diubah (Mode Arsip).' : 'Perubahan akan langsung membuka akses fitur KBM.'}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="submit"
                    id="btn-save-penugasan"
                    class="w-full sm:w-auto px-6 py-2.5 ${isArchived ? 'opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-none' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-lg shadow-emerald-950/20 cursor-pointer'} font-black text-xs rounded-xl transition flex items-center justify-center gap-2"
                    ${isArchived ? 'disabled title="Semester telah ditutup (Mode Arsip)"' : ''}
                  >
                    <i data-lucide="${isArchived ? 'lock' : 'save'}" class="w-4 h-4"></i>
                    <span>${isArchived ? 'Terkunci (Mode Arsip)' : 'Simpan Penugasan'}</span>
                  </button>
                </div>
              </div>

            </form>

          </div>
        ` : ''}

        <!-- ========================================================================= -->
        <!-- TAB 2: JADWAL MENGAJAR MINGGUAN (OPSIONAL) -->
        <!-- ========================================================================= -->
        ${activeSubTab === 'jadwal' ? `
          <div class="space-y-6 animate-fade-in">

            <!-- Notice Banner: Jadwal adalah Fitur Opsional -->
            <div class="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-3xl flex items-start gap-3.5 text-xs text-teal-900 dark:text-teal-200">
              <div class="p-2 bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-xl flex-shrink-0">
                <i data-lucide="calendar-heart" class="w-5 h-5"></i>
              </div>
              <div class="space-y-0.5">
                <h4 class="font-extrabold text-sm">Fitur Jadwal Mingguan Bersifat Opsional</h4>
                <p class="text-[11px] leading-relaxed text-teal-800/90 dark:text-teal-300/90">
                  Anda tidak wajib menyusun jadwal harian ini jika hanya ingin mengisi presensi atau jurnal secara manual. Jadwal ini berfungsi memberikan kemudahan rekomendasi jam KBM otomatis di halaman Absen.
                </p>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Filter Hari:</span>
                <div class="w-56">
                  ${renderHariComboboxHTML({
                    id: 'jadwal-filter-hari',
                    selectedValue: filterHari,
                    allowAll: true,
                    allLabel: 'Semua Hari (Senin - Sabtu)',
                    size: 'sm'
                  })}
                </div>
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-reset-jadwal"
                  class="px-3.5 py-2.5 ${totalSesi === 0 ? 'opacity-40 cursor-not-allowed bg-rose-500/10 text-rose-300 border-rose-400/20' : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 border-rose-400/30 active:scale-95'} font-bold text-xs rounded-xl border transition flex items-center gap-1.5"
                  ${totalSesi === 0 ? 'disabled' : ''}
                >
                  <i data-lucide="trash-2" class="w-4 h-4 text-rose-500"></i>
                  <span>Reset Jadwal</span>
                </button>

                <button
                  id="btn-print-jadwal"
                  class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-2"
                >
                  <i data-lucide="printer" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
                  <span>Cetak Lembar Jadwal</span>
                </button>

                <button
                  id="btn-add-jadwal"
                  class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2"
                >
                  <i data-lucide="plus" class="w-4 h-4"></i>
                  <span>Tambah Slot Jadwal</span>
                </button>
              </div>
            </div>

            <!-- Stats Bar -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
                    <i data-lucide="clock" class="w-5 h-5"></i>
                  </div>
                  <div>
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Beban Terjadwal</span>
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
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Pertemuan Rutin</span>
                    <span class="text-base font-black text-slate-800 dark:text-slate-100">${totalSesi} Slot KBM</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">Aktif</span>
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

                            <div class="space-y-0.5">
                              <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                                <i data-lucide="graduation-cap" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0"></i>
                                <span class="truncate">${slot.nama_kelas || 'Kelas'}</span>
                              </h4>
                              <p class="text-xs font-bold text-teal-800 dark:text-teal-300 pl-5 truncate">${slot.mapel || 'Mata Pelajaran'}</p>
                            </div>

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
        ` : ''}

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // =========================================================================
    // EVENT LISTENERS: SUB-TAB SWITCHER
    // =========================================================================
    container.querySelector('#subtab-btn-penugasan')?.addEventListener('click', () => {
      if (activeSubTab !== 'penugasan') {
        activeSubTab = 'penugasan';
        render();
      }
    });

    container.querySelector('#subtab-btn-jadwal')?.addEventListener('click', () => {
      if (activeSubTab !== 'jadwal') {
        activeSubTab = 'jadwal';
        render();
      }
    });

    // =========================================================================
    // EVENT LISTENERS: TAB 1 (PENUGASAN)
    // =========================================================================
    if (activeSubTab === 'penugasan') {

      // Select Academic Year Trigger
      container.querySelector('#penugasan-select-year')?.addEventListener('change', async (e) => {
        currentAcademicYear = e.target.value;
        if (state.selectedAcademicYear) state.selectedAcademicYear = currentAcademicYear;
        db.invalidateGuruMengajarCache();
        await render();
      });

      // Select Semester Trigger
      container.querySelector('#penugasan-select-semester')?.addEventListener('change', async (e) => {
        selectedSemester = e.target.value;
        if (state.selectedSemester) state.selectedSemester = selectedSemester;
        await render();
      });

      // Select Subject Trigger
      container.querySelector('#penugasan-select-mapel')?.addEventListener('change', (e) => {
        selectedMapelId = e.target.value;
        render();
      });

      // Update counter & card visual reactive on checkbox change
      const checkboxes = container.querySelectorAll('.checkbox-class-item');
      const counterEl = container.querySelector('#label-selected-count');

      const updateSelectedCount = () => {
        const checkedCount = container.querySelectorAll('.checkbox-class-item:checked').length;
        if (counterEl) counterEl.textContent = checkedCount;
      };

      checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          const card = cb.closest('.class-assignment-card');
          if (cb.checked) {
            card?.classList.add('bg-emerald-50/70', 'dark:bg-emerald-950/40', 'border-emerald-400', 'dark:border-emerald-600', 'shadow-xs', 'ring-1', 'ring-emerald-400/40');
            card?.classList.remove('bg-slate-50/50', 'dark:bg-slate-800/40', 'border-slate-200', 'dark:border-slate-700');
          } else {
            card?.classList.remove('bg-emerald-50/70', 'dark:bg-emerald-950/40', 'border-emerald-400', 'dark:border-emerald-600', 'shadow-xs', 'ring-1', 'ring-emerald-400/40');
            card?.classList.add('bg-slate-50/50', 'dark:bg-slate-800/40', 'border-slate-200', 'dark:border-slate-700');
          }
          updateSelectedCount();
        });
      });

      // Group Toggle (Pilih Semua di Tingkat Ini)
      container.querySelectorAll('.btn-toggle-group-select').forEach(btn => {
        btn.addEventListener('click', () => {
          const grpName = btn.getAttribute('data-group');
          const groupCards = container.querySelectorAll(`.class-assignment-card[data-group="${grpName}"]`);
          const groupCheckboxes = Array.from(groupCards).map(c => c.querySelector('.checkbox-class-item')).filter(Boolean);

          const allChecked = groupCheckboxes.every(cb => cb.checked);
          const newTargetState = !allChecked;

          groupCheckboxes.forEach(cb => {
            cb.checked = newTargetState;
            cb.dispatchEvent(new Event('change'));
          });
        });
      });

      // Save Penugasan Form Handler with Deactivation Confirmation
      const formPenugasan = container.querySelector('#form-penugasan-matrix');
      formPenugasan?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentlyCheckedIds = Array.from(container.querySelectorAll('.checkbox-class-item:checked')).map(cb => cb.value);
        const selectedKelasIdSet = new Set(currentlyCheckedIds);

        // Diff Detection
        const toAddIds = currentlyCheckedIds.filter(id => !activeAssignedKelasIds.has(id));
        const toDeactivateIds = Array.from(activeAssignedKelasIds).filter(id => !selectedKelasIdSet.has(id));

        if (toAddIds.length === 0 && toDeactivateIds.length === 0) {
          showToast('Tidak ada perubahan penugasan.', 'info');
          return;
        }

        // If some classes are unchecked, show confirmation modal
        if (toDeactivateIds.length > 0) {
          const deactivatedClassNames = toDeactivateIds.map(id => {
            const kObj = kelasList.find(k => k.id === id);
            return kObj?.nama_kelas || 'Kelas';
          }).join(', ');

          openDeactivateConfirmModal({
            classNames: deactivatedClassNames,
            mapelName: currentMapelName,
            onConfirm: async () => {
              await executeSavePenugasan(toAddIds, toDeactivateIds);
            }
          });
        } else {
          await executeSavePenugasan(toAddIds, []);
        }
      });

      async function executeSavePenugasan(toAddIds, toDeactivateIds) {
        const btnSave = container.querySelector('#btn-save-penugasan');
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Menyimpan...</span>`;
          if (window.lucide) window.lucide.createIcons();
        }

        try {
          // 1. Process Additions
          for (const kelasId of toAddIds) {
            if (inactiveAssignmentsMap.has(kelasId)) {
              // Reactivate existing inactive record
              const existingRecord = inactiveAssignmentsMap.get(kelasId);
              await db.updateGuruMengajar(existingRecord.id, { is_active: true });
            } else {
              // Add new record (explicit semester)
              await db.addGuruMengajar({
                academic_year: currentAcademicYear,
                semester: selectedSemester,
                kelas_id: kelasId,
                mapel_id: selectedMapelObj.id || null,
                mapel: currentMapelName,
                is_active: true
              });
            }
          }

          // 2. Process Deactivations (Soft-update is_active = false)
          for (const kelasId of toDeactivateIds) {
            if (activeAssignmentsMap.has(kelasId)) {
              const existingRecord = activeAssignmentsMap.get(kelasId);
              await db.updateGuruMengajar(existingRecord.id, { is_active: false });
            }
          }

          db.invalidateGuruMengajarCache();
          showToast(`Penugasan mengajar Semester ${selectedSemester} berhasil disimpan!`, 'success');
          await render();
        } catch (err) {
          console.error('Gagal menyimpan penugasan:', err);
          showToast('Gagal menyimpan penugasan: ' + (err.message || 'Terjadi kesalahan'), 'error');
          if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Penugasan</span>`;
            if (window.lucide) window.lucide.createIcons();
          }
        }
      }

      function openDeactivateConfirmModal({ classNames, mapelName, onConfirm }) {
        const modalId = 'modal-deactivate-assignment-confirm';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in';
        modalEl.innerHTML = `
          <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 text-slate-800 dark:text-slate-100 transform animate-scale-up">

            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-200 dark:border-amber-900">
                <i data-lucide="alert-triangle" class="w-6 h-6"></i>
              </div>
              <div class="space-y-1">
                <h3 class="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                  Konfirmasi Penonaktifan Penugasan
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Penugasan untuk <strong>${classNames}</strong> pada mata pelajaran <strong>${mapelName}</strong> akan dinonaktifkan.
                </p>
              </div>
            </div>

            <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p class="font-bold flex items-center gap-1 text-slate-800 dark:text-slate-200">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-500"></i>
                <span>Riwayat Data Tetap Aman</span>
              </p>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Data absensi, jurnal mengajar, tugas, dan nilai rapor yang sudah pernah tersimpan sebelumnya <strong>tidak akan terhapus</strong> dan tetap dapat diakses di menu Riwayat/Rekap.
              </p>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                id="btn-cancel-deactivate"
                class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-deactivate"
                class="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-amber-600/30 cursor-pointer"
              >
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Nonaktifkan & Simpan</span>
              </button>
            </div>

          </div>
        `;

        document.body.appendChild(modalEl);
        if (window.lucide) window.lucide.createIcons();

        const closeModal = () => modalEl.remove();

        modalEl.querySelector('#btn-cancel-deactivate')?.addEventListener('click', closeModal);
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) closeModal();
        });

        modalEl.querySelector('#btn-confirm-deactivate')?.addEventListener('click', async () => {
          closeModal();
          await onConfirm();
        });
      }

    }

    // =========================================================================
    // EVENT LISTENERS: TAB 2 (JADWAL MINGGUAN)
    // =========================================================================
    if (activeSubTab === 'jadwal') {

      // Filter Hari Listener
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
            try {
              await db.deleteJadwalMengajar(id);
              showToast('Slot jadwal berhasil dihapus', 'success');
              render();
            } catch (err) {
              showToast(err.message || 'Gagal menghapus jadwal', 'error');
            }
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

      // Reset Jadwal Trigger
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

            <div class="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-1.5 text-xs text-rose-800 dark:text-rose-300">
              <div class="flex items-center gap-1.5 font-bold">
                <i data-lucide="shield-alert" class="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0"></i>
                <span>Peringatan Destruktif</span>
              </div>
              <p class="text-[11px] leading-relaxed text-rose-700/90 dark:text-rose-300/90">
                Jadwal yang dihapus tidak dapat dipulihkan dan harus diinput ulang dari nol. Riwayat absensi, jurnal, dan nilai yang sudah pernah tersimpan sebelumnya tetap aman 100%.
              </p>
            </div>

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

        setTimeout(() => inputConfirm?.focus(), 50);

        const closeModal = () => modalEl.remove();

        btnCancel?.addEventListener('click', closeModal);
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) closeModal();
        });

        const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleKeyDown);
          }
        };
        document.addEventListener('keydown', handleKeyDown);

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

        inputConfirm?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !btnExecute.disabled) {
            btnExecute.click();
          }
        });

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
            showToast(err.message || 'Terjadi kesalahan saat mereset jadwal', 'error');
            closeModal();
          }
        });
      }

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
