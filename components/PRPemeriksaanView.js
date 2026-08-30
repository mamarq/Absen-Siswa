// components/PRPemeriksaanView.js - Dashboard Pemeriksaan & Input Nilai Pekerjaan Rumah (PR)
import { db } from '../supabase-client.js';
import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';

export async function renderPRPemeriksaanView(container, state, onNavigate, showToast, targetPRId = null) {
  const currentAcademicYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  let activeTab = 'menunggu'; // 'menunggu' | 'selesai_diperiksa' | 'semua'
  let filterKelasId = ''; // '' = semua kelas
  let filterMapelId = ''; // '' = semua mapel
  let activeInspectionPRId = targetPRId || null;

  const classList = await db.getClassesByYear(currentAcademicYear, false);
  const mapelList = await db.getMataPelajaran();

  // ===========================================================================
  // RENDER MAIN DASHBOARD VIEW
  // ===========================================================================
  async function renderDashboard() {
    const allPR = await db.getPRList({ academic_year: currentAcademicYear });
    
    const countMenunggu = allPR.filter(p => p.status === 'menunggu').length;
    const countSelesai = allPR.filter(p => p.status === 'selesai_diperiksa').length;

    let displayedPR = allPR;
    if (activeTab === 'menunggu') {
      displayedPR = displayedPR.filter(p => p.status === 'menunggu');
    } else if (activeTab === 'selesai_diperiksa') {
      displayedPR = displayedPR.filter(p => p.status === 'selesai_diperiksa');
    }

    if (filterKelasId && filterKelasId !== 'semua') {
      displayedPR = displayedPR.filter(p => p.kelas_id === filterKelasId);
    }
    if (filterMapelId && filterMapelId !== 'semua') {
      displayedPR = displayedPR.filter(p => p.mapel_id === filterMapelId || p.mata_pelajaran?.nama_mapel === filterMapelId);
    }

    container.innerHTML = `
      <div class="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
        
        <!-- Header Page -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-100 flex-shrink-0">
              <i data-lucide="clipboard-check" class="w-6 h-6"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Pemeriksaan Pekerjaan Rumah (PR)</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[10px] uppercase tracking-wider">
                  Tahap 2
                </span>
              </div>
              <p class="text-xs text-slate-500">
                Pilih PR yang akan diperiksa, masukkan nilai siswa, dan tandai siswa yang tidak mengumpulkan.
              </p>
            </div>
          </div>

          <button id="btn-create-new-pr" class="self-start sm:self-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md shadow-purple-100">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>+ Buat PR Baru</span>
          </button>
        </div>

        <!-- Filter & Tab Controls -->
        <div class="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
          
          <!-- Top Row: Status Tabs & Dropdown Filters -->
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 border-b border-slate-100 pb-4">
            
            <!-- Left: Status Tabs -->
            <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold w-full lg:w-auto">
              <button id="tab-pr-menunggu" class="flex-1 sm:flex-none py-2 px-3.5 rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'menunggu' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-500"></i>
                <span>Menunggu Diperiksa</span>
                <span class="px-2 py-0.2 rounded-full text-[10px] ${countMenunggu > 0 ? 'bg-amber-100 text-amber-800 font-black' : 'bg-slate-200 text-slate-600'}">
                  ${countMenunggu}
                </span>
              </button>

              <button id="tab-pr-selesai" class="flex-1 sm:flex-none py-2 px-3.5 rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'selesai_diperiksa' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-500"></i>
                <span>Selesai Diperiksa</span>
                <span class="px-2 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
                  ${countSelesai}
                </span>
              </button>

              <button id="tab-pr-semua" class="flex-1 sm:flex-none py-2 px-3.5 rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'semua' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i data-lucide="layers" class="w-3.5 h-3.5 text-indigo-500"></i>
                <span>Semua</span>
                <span class="px-2 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  ${allPR.length}
                </span>
              </button>
            </div>

            <!-- Right: Dropdown Filters (Shadcn Combobox) -->
            <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
              <!-- Filter Kelas (Shadcn Combobox) -->
              <div class="w-full sm:w-52">
                ${renderClassComboboxHTML({
                  id: 'filter-pr-kelas',
                  kelasList: classList,
                  selectedId: filterKelasId,
                  allowAll: true,
                  allLabel: `Semua Kelas (${classList.length})`,
                  size: 'sm'
                })}
              </div>

              <!-- Filter Mapel (Shadcn Combobox) -->
              <div class="w-full sm:w-56">
                ${renderMapelComboboxHTML({
                  id: 'filter-pr-mapel',
                  mapelList: mapelList,
                  selectedValue: mapelList.find(m => m.id === filterMapelId)?.nama_mapel || filterMapelId,
                  allowAll: true,
                  allLabel: 'Semua Mapel',
                  size: 'sm',
                  allowManage: false
                })}
              </div>
            </div>

          </div>

          <!-- PR Items Grid / List -->
          <div class="space-y-3 pt-1">
            ${displayedPR.length === 0 ? `
              <div class="py-12 text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <i data-lucide="inbox" class="w-6 h-6"></i>
                </div>
                <div class="space-y-1">
                  <h4 class="text-sm font-bold text-slate-700">Belum Ada Data Pekerjaan Rumah</h4>
                  <p class="text-xs text-slate-400 max-w-sm mx-auto">
                    ${activeTab === 'menunggu' 
                      ? 'Tidak ada PR yang sedang menunggu diperiksa. Silakan buat PR baru.' 
                      : 'Belum ada data PR yang cocok dengan filter yang dipilih.'}
                  </p>
                </div>
                <button id="btn-empty-create-pr" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition shadow-xs">
                  Buat Penugasan PR Baru
                </button>
              </div>
            ` : displayedPR.map(pr => {
              const isMenunggu = pr.status === 'menunggu';
              const mapelNama = pr.mata_pelajaran?.nama_mapel || 'Mapel Tidak Diketahui / Dihapus';
              const kelasNama = pr.kelas?.nama_kelas || 'Kelas Tidak Diketahui';
              const nilaiRows = pr.pr_nilai_siswa || [];
              const totalSiswa = nilaiRows.length;
              const mengumpulkanCount = nilaiRows.filter(n => n.mengumpulkan !== false).length;
              const dinilaiCount = nilaiRows.filter(n => n.nilai !== null && !isNaN(n.nilai)).length;
              const tglDiberikanStr = new Date(pr.tanggal_diberikan).toLocaleDateString('id-ID', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              });

              return `
                <div class="bg-white hover:bg-slate-50/60 border ${isMenunggu ? 'border-amber-200/90 shadow-xs bg-amber-50/10' : 'border-slate-200'} rounded-2xl p-4 sm:p-5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  
                  <div class="space-y-2 flex-1 min-w-0">
                    <!-- Badges Row -->
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-[11px] font-black border border-purple-200">
                        ${kelasNama}
                      </span>
                      
                      ${pr.mata_pelajaran ? `
                        <span class="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                          ${mapelNama}
                        </span>
                      ` : `
                        <span class="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-medium italic border border-slate-200">
                          (Mapel Dihapus / Tidak Diketahui)
                        </span>
                      `}

                      <span class="px-2.5 py-0.5 rounded-lg ${isMenunggu ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'} text-[11px] font-black flex items-center gap-1 border">
                        <i data-lucide="${isMenunggu ? 'clock' : 'check-circle'}" class="w-3 h-3"></i>
                        <span>${isMenunggu ? 'Menunggu Diperiksa' : 'Selesai Diperiksa'}</span>
                      </span>
                    </div>

                    <!-- Topik PR -->
                    <h3 class="text-sm sm:text-base font-extrabold text-slate-800 leading-snug group-hover:text-purple-700 transition">
                      ${pr.topik}
                    </h3>

                    <!-- Meta Information -->
                    <div class="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] text-slate-500 font-medium">
                      <span class="flex items-center gap-1">
                        <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                        <span>Diberikan: <strong class="text-slate-700">${tglDiberikanStr}</strong></span>
                      </span>

                      <span>•</span>

                      <span class="flex items-center gap-1">
                        <i data-lucide="users" class="w-3.5 h-3.5 text-slate-400"></i>
                        <span>
                          ${isMenunggu 
                            ? `<strong class="text-slate-700">${totalSiswa}</strong> Siswa Terdaftar` 
                            : `<strong class="text-emerald-700">${mengumpulkanCount}/${totalSiswa}</strong> Mengumpulkan (${dinilaiCount} Dinilai)`}
                        </span>
                      </span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button 
                      class="btn-inspect-pr px-4 py-2.5 ${isMenunggu ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs' : 'bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700'} font-bold text-xs rounded-xl transition flex items-center gap-1.5 active:scale-95" 
                      data-pr-id="${pr.id}"
                    >
                      <i data-lucide="${isMenunggu ? 'pencil' : 'file-edit'}" class="w-4 h-4"></i>
                      <span>${isMenunggu ? 'Periksa & Nilai PR' : 'Lihat / Edit Nilai'}</span>
                    </button>

                    <button 
                      class="btn-delete-pr p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition" 
                      data-pr-id="${pr.id}" 
                      data-pr-topik="${pr.topik}"
                      title="Hapus Penugasan PR"
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

    // Event Bindings
    container.querySelector('#btn-create-new-pr')?.addEventListener('click', () => onNavigate('pr-buat'));
    container.querySelector('#btn-empty-create-pr')?.addEventListener('click', () => onNavigate('pr-buat'));

    container.querySelector('#tab-pr-menunggu')?.addEventListener('click', () => {
      activeTab = 'menunggu';
      renderDashboard();
    });
    container.querySelector('#tab-pr-selesai')?.addEventListener('click', () => {
      activeTab = 'selesai_diperiksa';
      renderDashboard();
    });
    container.querySelector('#tab-pr-semua')?.addEventListener('click', () => {
      activeTab = 'semua';
      renderDashboard();
    });

    // Inisialisasi ClassCombobox Filter
    initClassCombobox(container, {
      id: 'filter-pr-kelas',
      kelasList: classList,
      selectedId: filterKelasId,
      allowAll: true,
      allLabel: `Semua Kelas (${classList.length})`,
      size: 'sm',
      onSelect: (selectedId) => {
        filterKelasId = selectedId || '';
        renderDashboard();
      }
    });

    // Inisialisasi MapelCombobox Filter
    initMapelCombobox(container, {
      id: 'filter-pr-mapel',
      mapelList: mapelList,
      selectedValue: mapelList.find(m => m.id === filterMapelId)?.nama_mapel || filterMapelId,
      allowAll: true,
      allLabel: 'Semua Mapel',
      size: 'sm',
      allowManage: false,
      onSelect: (selectedName) => {
        const found = mapelList.find(m => m.nama_mapel === selectedName);
        filterMapelId = found?.id || '';
        renderDashboard();
      }
    });

    container.querySelectorAll('.btn-inspect-pr').forEach(btn => {
      btn.addEventListener('click', () => {
        const prId = btn.getAttribute('data-pr-id');
        activeInspectionPRId = prId;
        renderInspectionForm(prId);
      });
    });

    container.querySelectorAll('.btn-delete-pr').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prId = btn.getAttribute('data-pr-id');
        const prTopik = btn.getAttribute('data-pr-topik');
        if (confirm(`Apakah Anda yakin ingin menghapus PR "${prTopik}" beserta seluruh riwayat nilainya?`)) {
          await db.deletePR(prId);
          showToast('Penugasan PR berhasil dihapus', 'info');
          renderDashboard();
        }
      });
    });
  }

  // ===========================================================================
  // RENDER INSPECTION & GRADING FORM (INPUT NILAI SISWA)
  // ===========================================================================
  async function renderInspectionForm(prId) {
    const prDetail = await db.getPRDetail(prId);
    if (!prDetail) {
      showToast('Data PR tidak ditemukan!', 'error');
      renderDashboard();
      return;
    }

    const mapelNama = prDetail.mata_pelajaran?.nama_mapel || 'Mapel Tidak Diketahui / Dihapus';
    const kelasNama = prDetail.kelas?.nama_kelas || 'Kelas';
    let tanggalDiperiksa = new Date().toISOString().split('T')[0];

    const studentRows = prDetail.pr_nilai_siswa || [];

    container.innerHTML = `
      <div class="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
        
        <!-- Header & Breadcrumbs -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div class="flex items-center gap-3">
            <button id="btn-back-to-pr-list" class="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-2xs">
              <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base sm:text-lg font-black text-slate-800 tracking-tight">Form Pemeriksaan Nilai PR</h2>
                <span class="px-2.5 py-0.5 rounded-full ${prDetail.status === 'menunggu' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'} font-extrabold text-[10px]">
                  ${prDetail.status === 'menunggu' ? 'Menunggu Diperiksa' : 'Selesai Diperiksa'}
                </span>
              </div>
              <p class="text-xs text-slate-500">
                Input nilai hasil pengerjaan PR dan centang siswa yang tidak mengumpulkan tugas.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-print-pr-rekap" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
              <i data-lucide="printer" class="w-4 h-4"></i>
              <span>Cetak Rekap</span>
            </button>
          </div>
        </div>

        <!-- PR Details Header Card -->
        <div class="bg-gradient-to-br from-purple-800 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-lg bg-white/20 text-white text-xs font-black backdrop-blur-md">
              ${kelasNama}
            </span>
            <span class="px-2.5 py-0.5 rounded-lg bg-emerald-500/30 text-emerald-200 text-xs font-bold border border-emerald-400/30">
              ${mapelNama}
            </span>
            <span class="text-xs text-purple-200 ml-auto">
              Diberikan: <strong>${new Date(prDetail.tanggal_diberikan).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </span>
          </div>

          <div class="space-y-1">
            <div class="text-[10px] uppercase font-bold text-purple-300 tracking-wider">Topik / Soal PR:</div>
            <h3 class="text-base sm:text-lg font-black text-white leading-relaxed">
              ${prDetail.topik}
            </h3>
          </div>

          <!-- Tanggal Pemeriksaan Picker -->
          <div class="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-purple-200 font-semibold">Tanggal Diperiksa:</span>
              <div class="w-44 text-slate-800">
                ${renderDatePickerHTML({
                  id: 'pr-inspect-date',
                  value: tanggalDiperiksa,
                  placeholder: 'Pilih tanggal...'
                })}
              </div>
            </div>

            <div class="flex items-center gap-2 text-xs font-semibold text-purple-200">
              <i data-lucide="users" class="w-4 h-4 text-purple-400"></i>
              <span><strong class="text-white">${studentRows.length}</strong> Siswa Terdaftar</span>
            </div>
          </div>
        </div>

        <!-- Student Grading Table Card -->
        <div class="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xl space-y-4">
          
          <!-- Table Controls Toolbar -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h4 class="text-sm font-extrabold text-slate-800">Daftar Siswa & Input Nilai</h4>
              <p class="text-[11px] text-slate-400">Centang "Tidak Mengumpulkan" jika siswa tidak mengerjakan PR</p>
            </div>

            <!-- Quick Actions Toolbar -->
            <div class="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <button id="btn-quick-fill-80" class="px-2.5 py-1.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 rounded-lg transition text-[11px]">
                Set 80
              </button>
              <button id="btn-quick-fill-85" class="px-2.5 py-1.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 rounded-lg transition text-[11px]">
                Set 85
              </button>
              <button id="btn-quick-fill-90" class="px-2.5 py-1.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 rounded-lg transition text-[11px]">
                Set 90
              </button>
              <button id="btn-quick-fill-100" class="px-2.5 py-1.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 rounded-lg transition text-[11px]">
                Set 100
              </button>
              <button id="btn-quick-mark-all-collect" class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg transition text-[11px]">
                Semua Mengumpulkan
              </button>
            </div>
          </div>

          <!-- Student List Rows -->
          <form id="form-submit-pr-grades" class="space-y-4">
            <div class="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto pr-1">
              ${studentRows.map((row, idx) => {
                const s = row.siswa || {};
                const isMengumpulkan = row.mengumpulkan !== false;
                const nilaiVal = row.nilai !== null && row.nilai !== undefined ? row.nilai : '';

                return `
                  <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 student-grade-row" data-siswa-id="${row.siswa_id}" data-row-id="${row.id || ''}">
                    
                    <!-- Student Info -->
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <span class="w-7 h-7 rounded-xl bg-purple-50 text-purple-800 font-extrabold text-xs flex items-center justify-center flex-shrink-0 border border-purple-100">
                        ${s.nomor_absen || (idx + 1)}
                      </span>

                      <div class="min-w-0">
                        <div class="font-extrabold text-slate-800 text-xs sm:text-sm truncate">
                          ${s.nama_lengkap || 'Nama Siswa'}
                        </div>
                        <div class="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>NISN: ${s.nisn || '-'}</span>
                          <span>•</span>
                          <span class="font-semibold ${s.jenis_kelamin === 'P' ? 'text-rose-500' : 'text-blue-500'}">${s.jenis_kelamin || 'L'}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Grading Inputs -->
                    <div class="flex items-center gap-3 flex-shrink-0">
                      
                      <!-- Toggle Tidak Mengumpulkan -->
                      <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 transition select-none">
                        <input 
                          type="checkbox" 
                          class="input-pr-tidak-mengumpulkan rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5" 
                          ${!isMengumpulkan ? 'checked' : ''}
                        >
                        <span class="text-[11px] ${!isMengumpulkan ? 'text-rose-600 font-bold' : ''}">Tidak Mengumpulkan</span>
                      </label>

                      <!-- Nilai Input -->
                      <div class="w-20">
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="Nilai" 
                          value="${isMengumpulkan ? nilaiVal : ''}" 
                          ${!isMengumpulkan ? 'disabled' : ''}
                          class="input-pr-nilai w-full p-2 text-center text-xs sm:text-sm font-black bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                      </div>

                      <!-- Catatan Input (Optional) -->
                      <div class="w-32 sm:w-44 hidden md:block">
                        <input 
                          type="text" 
                          placeholder="Catatan..." 
                          value="${row.catatan || ''}" 
                          class="input-pr-catatan w-full p-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        >
                      </div>

                    </div>

                  </div>
                `;
              }).join('')}
            </div>

            <!-- Bottom Actions -->
            <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button 
                type="button" 
                id="btn-cancel-inspection" 
                class="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Batal
              </button>
              <button 
                type="submit" 
                id="btn-submit-inspection" 
                class="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-100 transition flex items-center justify-center gap-2"
              >
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                <span>Simpan Hasil Pemeriksaan PR</span>
              </button>
            </div>

          </form>

        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Datepicker Init
    initDatePicker(container, {
      id: 'pr-inspect-date',
      value: tanggalDiperiksa,
      onSelect: (dateStr) => {
        tanggalDiperiksa = dateStr;
      }
    });

    // Navigation & Buttons
    container.querySelector('#btn-back-to-pr-list')?.addEventListener('click', () => renderDashboard());
    container.querySelector('#btn-cancel-inspection')?.addEventListener('click', () => renderDashboard());

    // Toggle "Tidak Mengumpulkan" handler
    container.querySelectorAll('.student-grade-row').forEach(rowEl => {
      const checkbox = rowEl.querySelector('.input-pr-tidak-mengumpulkan');
      const inputNilai = rowEl.querySelector('.input-pr-nilai');

      checkbox?.addEventListener('change', () => {
        if (checkbox.checked) {
          inputNilai.disabled = true;
          inputNilai.value = '';
          inputNilai.classList.add('bg-slate-100', 'text-slate-400');
        } else {
          inputNilai.disabled = false;
          inputNilai.classList.remove('bg-slate-100', 'text-slate-400');
          inputNilai.focus();
        }
      });
    });

    // Quick Action: Fill Value Helper
    function quickFillGrade(val) {
      container.querySelectorAll('.student-grade-row').forEach(rowEl => {
        const checkbox = rowEl.querySelector('.input-pr-tidak-mengumpulkan');
        const inputNilai = rowEl.querySelector('.input-pr-nilai');
        if (!checkbox.checked) {
          inputNilai.value = val;
        }
      });
    }

    container.querySelector('#btn-quick-fill-80')?.addEventListener('click', () => quickFillGrade(80));
    container.querySelector('#btn-quick-fill-85')?.addEventListener('click', () => quickFillGrade(85));
    container.querySelector('#btn-quick-fill-90')?.addEventListener('click', () => quickFillGrade(90));
    container.querySelector('#btn-quick-fill-100')?.addEventListener('click', () => quickFillGrade(100));

    container.querySelector('#btn-quick-mark-all-collect')?.addEventListener('click', () => {
      container.querySelectorAll('.student-grade-row').forEach(rowEl => {
        const checkbox = rowEl.querySelector('.input-pr-tidak-mengumpulkan');
        const inputNilai = rowEl.querySelector('.input-pr-nilai');
        checkbox.checked = false;
        inputNilai.disabled = false;
        inputNilai.classList.remove('bg-slate-100', 'text-slate-400');
      });
    });

    // Print Rekap PR Action
    container.querySelector('#btn-print-pr-rekap')?.addEventListener('click', () => {
      window.print();
    });

    // Submit Grades Form
    container.querySelector('#form-submit-pr-grades')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const items = [];
      container.querySelectorAll('.student-grade-row').forEach(rowEl => {
        const siswaId = rowEl.getAttribute('data-siswa-id');
        const rowId = rowEl.getAttribute('data-row-id');
        const checkbox = rowEl.querySelector('.input-pr-tidak-mengumpulkan');
        const inputNilai = rowEl.querySelector('.input-pr-nilai');
        const inputCatatan = rowEl.querySelector('.input-pr-catatan');

        const tidakMengumpulkan = checkbox?.checked || false;
        const nilaiVal = inputNilai?.value?.trim();

        items.push({
          id: rowId || null,
          siswa_id: siswaId,
          mengumpulkan: !tidakMengumpulkan,
          nilai: tidakMengumpulkan ? null : (nilaiVal !== '' && !isNaN(nilaiVal) ? Number(nilaiVal) : null),
          catatan: inputCatatan?.value?.trim() || null
        });
      });

      const btnSave = container.querySelector('#btn-submit-inspection') || container.querySelector('#btn-save-pr-grades');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `
          <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
          <span>Menyimpan Hasil...</span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }

      try {
        const res = await db.submitPemeriksaanPR(prId, {
          items,
          tanggal_diperiksa: tanggalDiperiksa
        });

        if (res.success) {
          showToast('Hasil pemeriksaan PR berhasil disimpan!', 'success');
          renderDashboard();
        } else {
          showToast('Gagal menyimpan pemeriksaan: ' + (res.error || 'Terjadi kesalahan'), 'error');
          if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>Simpan Hasil Pemeriksaan PR</span>
            `;
            if (window.lucide) window.lucide.createIcons();
          }
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = `
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span>Simpan Hasil Pemeriksaan PR</span>
          `;
          if (window.lucide) window.lucide.createIcons();
        }
      }
    });
  }

  // Initial Entry
  if (activeInspectionPRId) {
    await renderInspectionForm(activeInspectionPRId);
  } else {
    await renderDashboard();
  }
}
