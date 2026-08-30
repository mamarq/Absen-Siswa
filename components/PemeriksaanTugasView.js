import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
import { renderShareRekapKelasModal } from './ShareRekapKelasModal.js';
// components/PemeriksaanTugasView.js - Modul Pusat Pemeriksaan & Riwayat Catatan Ceklis & Penilaian Tugas
import { db } from '../supabase-client.js';

export async function renderPemeriksaanTugasView(container, state, onStateChange, showToast) {
  const currentYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const kelasList = await db.getClassesByYear(currentYear, true);
  const mapelList = await db.getMataPelajaran();

  // Load all saved checklist, grade sessions, and all students list
  const [allChecklist, allNilaiTugas, allSiswa] = await Promise.all([
    db.getAllChecklist(),
    db.getAllNilaiTugas(),
    db.getAllSiswa()
  ]);

  // Create student lookup map
  const siswaMap = {};
  (allSiswa || []).forEach(s => {
    siswaMap[s.id] = s;
  });

  // Current Filters & Pagination from state
  const filterType = state.pemeriksaanType || 'semua'; // 'semua' | 'ceklis' | 'nilai' | 'bebas'
  const filterStatus = state.pemeriksaanStatus || 'semua'; // 'semua' | 'belum' | 'tuntas'
  const filterKelasId = state.pemeriksaanKelasId || '';
  const filterMapel = state.pemeriksaanMapel || '';
  const filterStartDate = state.pemeriksaanStartDate || '';
  const filterEndDate = state.pemeriksaanEndDate || '';
  const filterSearch = (state.pemeriksaanSearch || '').toLowerCase();

  // Pagination state (internal / default 15 per page)
  let currentPage = state.pemeriksaanPage || 1;
  const itemsPerPage = 15;

  // Gabungkan seluruh sesi menjadi unified list
  const unifiedSessions = [];

  allChecklist.forEach(c => {
    const list = c.daftar_ceklis || [];
    const isNoCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
    const totalCount = list.length;
    let tuntasCount = 0;
    let belumCount = 0;
    const siswaBelumTuntas = [];

    if (isNoCatatan) {
      tuntasCount = totalCount;
      belumCount = 0;
    } else {
      tuntasCount = list.filter(d => d.is_checked === true || d.is_checked === 'true').length;
      belumCount = totalCount - tuntasCount;

      list.forEach(d => {
        const isChecked = d.is_checked === true || d.is_checked === 'true';
        if (!isChecked) {
          const sObj = siswaMap[d.siswa_id] || {};
          siswaBelumTuntas.push({
            siswa_id: d.siswa_id,
            nama_lengkap: sObj.nama_lengkap || d.nama_lengkap || d.nama || 'Siswa',
            nomor_absen: sObj.nomor_absen || d.nomor_absen || '',
            alasan: d.catatan ? `Catatan: ${d.catatan}` : 'Belum Tercentang / Belum Tuntas'
          });
        }
      });
    }

    const isFullTuntas = totalCount > 0 && belumCount === 0;

    unifiedSessions.push({
      id: c.id,
      type: 'ceklis',
      typeLabel: isNoCatatan ? 'Bebas Catatan' : 'Ceklis',
      typeBadgeColor: isNoCatatan ? 'bg-teal-50 text-teal-800 border-teal-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300',
      icon: isNoCatatan ? 'book-check' : 'check-square',
      isNoTugas: false,
      isNoCatatan,
      bebas_catatan: isNoCatatan,
      kelas_id: c.kelas_id,
      kelas_nama: c.kelas?.nama_kelas || c.kelas_nama || 'Kelas',
      mapel: c.mapel,
      tanggal: c.tanggal,
      judul: c.judul_catatan || 'Ceklis Catatan Siswa',
      kkm: null,
      totalCount,
      tuntasCount,
      belumCount,
      isFullTuntas,
      avgScore: null,
      siswaBelumTuntas,
      rawData: c
    });
  });

  allNilaiTugas.forEach(nt => {
    const list = nt.daftar_nilai || [];
    const isNoTugas = nt.is_no_tugas === true || nt.is_no_tugas === 'true';
    const kkm = parseInt(nt.kkm) || 75;
    let sum = 0, ratedCount = 0, tuntasCount = 0, unratedCount = 0;
    const siswaBelumTuntas = [];

    if (isNoTugas) {
      tuntasCount = list.length || 1;
      unratedCount = 0;
    } else {
      list.forEach(d => {
        const sObj = siswaMap[d.siswa_id] || {};
        const namaLengkap = sObj.nama_lengkap || d.nama_lengkap || d.nama || 'Siswa';
        const nomorAbsen = sObj.nomor_absen || d.nomor_absen || '';
        const nStr = String(d.nilai !== undefined && d.nilai !== null ? d.nilai : '').trim();

        if (nStr === '') {
          unratedCount++;
          siswaBelumTuntas.push({
            siswa_id: d.siswa_id,
            nama_lengkap: namaLengkap,
            nomor_absen: nomorAbsen,
            nilai: null,
            alasan: 'Belum Dinilai / Belum Mengumpulkan'
          });
        } else {
          const n = parseInt(nStr, 10);
          if (!isNaN(n)) {
            sum += n;
            ratedCount++;
            if (n >= kkm) {
              tuntasCount++;
            } else {
              siswaBelumTuntas.push({
                siswa_id: d.siswa_id,
                nama_lengkap: namaLengkap,
                nomor_absen: nomorAbsen,
                nilai: n,
                alasan: `Nilai: ${n} (< KKM ${kkm})`
              });
            }
          } else {
            unratedCount++;
            siswaBelumTuntas.push({
              siswa_id: d.siswa_id,
              nama_lengkap: namaLengkap,
              nomor_absen: nomorAbsen,
              nilai: null,
              alasan: 'Belum Dinilai / Belum Mengumpulkan'
            });
          }
        }
      });
    }

    const totalCount = list.length;
    const avg = ratedCount > 0 ? Math.round(sum / ratedCount) : '-';
    const belumCount = isNoTugas ? 0 : unratedCount + (totalCount - tuntasCount - unratedCount);
    const isFullTuntas = isNoTugas || (totalCount > 0 && belumCount === 0);

    unifiedSessions.push({
      id: nt.id,
      type: isNoTugas ? 'bebas' : 'nilai',
      typeLabel: isNoTugas ? 'Bebas Tugas' : 'Penilaian',
      typeBadgeColor: isNoTugas ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-amber-50 text-amber-800 border-amber-300',
      icon: isNoTugas ? 'coffee' : 'award',
      isNoTugas,
      kelas_id: nt.kelas_id,
      kelas_nama: nt.kelas?.nama_kelas || nt.kelas_nama || 'Kelas',
      mapel: nt.mapel,
      tanggal: nt.tanggal,
      judul: nt.judul_tugas || (isNoTugas ? 'Materi Pembelajaran (Bebas Tugas)' : 'Penilaian Nilai Tugas'),
      kkm,
      totalCount,
      tuntasCount,
      belumCount,
      isFullTuntas,
      avgScore: isNoTugas ? 'Bebas Tugas' : avg,
      siswaBelumTuntas,
      rawData: nt
    });
  });

  // Filter unified list
  const filteredSessions = unifiedSessions.filter(s => {
    // 1. Tipe
    if (filterType === 'ceklis' && (s.type !== 'ceklis' || s.isNoCatatan)) return false;
    if (filterType === 'nilai' && (s.type !== 'nilai' || s.isNoTugas)) return false;
    if (filterType === 'bebas' && !s.isNoTugas && !s.isNoCatatan) return false;

    // 2. Kelas
    if (filterKelasId && s.kelas_id !== filterKelasId && s.kelas_nama !== filterKelasId) return false;

    // 3. Mapel
    if (filterMapel && s.mapel !== filterMapel) return false;

    // 4. Tanggal
    if (filterStartDate && s.tanggal < filterStartDate) return false;
    if (filterEndDate && s.tanggal > filterEndDate) return false;

    // 5. Status
    if (filterStatus === 'belum' && s.belumCount === 0) return false;
    if (filterStatus === 'tuntas' && s.belumCount > 0) return false;

    // 6. Search
    if (filterSearch) {
      const matchJudul = s.judul.toLowerCase().includes(filterSearch);
      const matchKelas = s.kelas_nama.toLowerCase().includes(filterSearch);
      const matchMapel = s.mapel.toLowerCase().includes(filterSearch);
      if (!matchJudul && !matchKelas && !matchMapel) return false;
    }

    return true;
  }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  // Pagination calculation
  const totalItems = filteredSessions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + itemsPerPage);

  // Global summary statistics
  const totalCeklisCount = allChecklist.filter(c => !(c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true')).length;
  const totalNilaiCount = allNilaiTugas.filter(nt => !(nt.is_no_tugas === true || nt.is_no_tugas === 'true')).length;
  const totalBebasCount = allNilaiTugas.filter(nt => nt.is_no_tugas === true || nt.is_no_tugas === 'true').length + allChecklist.filter(c => c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true').length;
  const sessionsWithPending = unifiedSessions.filter(s => s.belumCount > 0).length;

  container.innerHTML = `
    <div class="space-y-5 pb-24 max-w-6xl mx-auto">
      
      <!-- Top Header Banner -->
      <div class="bg-gradient-to-r from-slate-900 via-teal-900 to-emerald-900 text-white p-5 rounded-2xl shadow-sm border border-teal-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="p-3 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-400/30">
            <i data-lucide="file-check-2" class="w-7 h-7"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg sm:text-xl">Pemeriksaan Catatan & Tugas</h2>
            <p class="text-xs text-teal-200/80">Pusat evaluasi ketuntasan catatan, tagihan tugas, dan riwayat pertemuan</p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button id="btn-share-rekap-kelas" class="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition transform active:scale-95" title="Bagikan Ringkasan Tagihan & Ketuntasan Kelas untuk WhatsApp / Gambar PNG">
            <i data-lucide="share-2" class="w-4 h-4 text-teal-200"></i>
            <span>Bagikan Rekap Kelas</span>
          </button>
          <button id="btn-goto-create-ceklis" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition transform active:scale-95">
            <i data-lucide="plus-circle" class="w-4 h-4"></i>
            <span>+ Buat Ceklis / Tugas Baru</span>
          </button>
        </div>
      </div>

      <!-- Quick Stats Counters -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Total Seluruh Sesi</span>
          <p class="text-2xl font-black text-slate-800 mt-1">${unifiedSessions.length}</p>
          <span class="text-[11px] text-slate-400">Tercatat di sistem</span>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Catatan Ceklis</span>
          <p class="text-2xl font-black text-emerald-600 mt-1">${totalCeklisCount}</p>
          <span class="text-[11px] text-slate-400">Sesi kelengkapan</span>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Penilaian Tugas</span>
          <p class="text-2xl font-black text-amber-600 mt-1">${totalNilaiCount}</p>
          <span class="text-[11px] text-slate-400">Sesi bernilai (${totalBebasCount} bebas tugas)</span>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Perlu Tindak Lanjut</span>
          <p class="text-2xl font-black ${sessionsWithPending > 0 ? 'text-rose-600' : 'text-emerald-600'} mt-1">${sessionsWithPending}</p>
          <span class="text-[11px] text-slate-400">Ada siswa belum tuntas</span>
        </div>
      </div>

      <!-- Filter Panel -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="filter" class="w-4 h-4 text-emerald-600"></i>
            <h3 class="font-bold text-slate-800 text-sm">Filter & Pencarian Riwayat</h3>
          </div>

          <button id="btn-reset-pemeriksaan-filters" class="text-xs text-slate-500 hover:text-rose-600 font-semibold hover:underline flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Reset Filter</span>
          </button>
        </div>

        <!-- Filter Row 1: Tipe & Status Tabs -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
          <!-- Tipe Switcher -->
          <div class="inline-flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold flex-wrap">
            <button class="btn-pemeriksaan-type px-3 py-1.5 rounded-lg transition ${filterType === 'semua' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}" data-type="semua">
              Semua (${unifiedSessions.length})
            </button>
            <button class="btn-pemeriksaan-type px-3 py-1.5 rounded-lg transition ${filterType === 'ceklis' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}" data-type="ceklis">
              📋 Ceklis (${totalCeklisCount})
            </button>
            <button class="btn-pemeriksaan-type px-3 py-1.5 rounded-lg transition ${filterType === 'nilai' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}" data-type="nilai">
              🎯 Nilai (${totalNilaiCount})
            </button>
            <button class="btn-pemeriksaan-type px-3 py-1.5 rounded-lg transition ${filterType === 'bebas' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:bg-blue-50'}" data-type="bebas">
              ☕ Bebas Tugas & Catatan (${totalBebasCount})
            </button>
          </div>

          <!-- Status Switcher -->
          <div class="inline-flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
            <button class="btn-pemeriksaan-status px-3 py-1.5 rounded-lg transition ${filterStatus === 'semua' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}" data-status="semua">
              Semua Status
            </button>
            <button class="btn-pemeriksaan-status px-3 py-1.5 rounded-lg transition ${filterStatus === 'belum' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'}" data-status="belum">
              ⚠️ Belum Tuntas (${sessionsWithPending})
            </button>
            <button class="btn-pemeriksaan-status px-3 py-1.5 rounded-lg transition ${filterStatus === 'tuntas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'}" data-status="tuntas">
              ✓ 100% Tuntas
            </button>
          </div>
        </div>

        <!-- Filter Row 2: Selectors & Search -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <!-- Filter Kelas (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas</label>
            ${renderClassComboboxHTML({
              id: 'pemeriksaan-select-kelas',
              kelasList,
              selectedId: filterKelasId,
              allowAll: true,
              allLabel: 'Semua Kelas',
              size: 'sm'
            })}
          </div>

          <!-- Filter Mapel (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
            ${renderMapelComboboxHTML({
              id: 'pemeriksaan-select-mapel',
              mapelList,
              selectedValue: filterMapel,
              allowAll: true,
              allLabel: 'Semua Mapel',
              size: 'sm',
              allowManage: false
            })}
          </div>

          <!-- Tanggal Mulai (Shadcn DatePicker) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal Sesi</label>
            ${renderDatePickerHTML({
              id: 'pemeriksaan-start-date',
              value: filterStartDate,
              size: 'sm'
            })}
          </div>

          <!-- Pencarian Teks -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Cari Topik / Judul</label>
            <div class="relative">
              <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3"></i>
              <input type="text" id="pemeriksaan-search" value="${state.pemeriksaanSearch || ''}" placeholder="Cari nama agenda / tugas..." class="w-full h-9 text-xs font-medium pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
            </div>
          </div>
        </div>
      </div>

      <!-- Hasil Daftar Riwayat: LIST / TABEL RINGKAS (DESKTOP) & COMPACT CARDS (MOBILE) -->
      <div class="space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h3 class="font-bold text-slate-800 text-sm sm:text-base">
              Daftar Sesi (${filteredSessions.length} Ditemukan)
            </h3>
            <p class="text-xs text-slate-400">
              ${totalItems > 0 ? `Menampilkan ${startIndex + 1} - ${Math.min(startIndex + itemsPerPage, totalItems)} dari ${totalItems} sesi` : 'Tidak ada data'}
            </p>
          </div>

          ${totalPages > 1 ? `
            <div class="flex items-center gap-1.5 self-end sm:self-auto text-xs">
              <button id="btn-page-prev" class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1" ${currentPage === 1 ? 'disabled' : ''}>
                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">Sebelumnya</span>
              </button>

              <span class="px-2.5 py-1 text-slate-700 font-bold bg-slate-100 rounded-lg">
                ${currentPage} / ${totalPages}
              </span>

              <button id="btn-page-next" class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1" ${currentPage === totalPages ? 'disabled' : ''}>
                <span class="hidden sm:inline">Berikutnya</span>
                <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          ` : ''}
        </div>

        ${filteredSessions.length === 0 ? `
          <div class="bg-white rounded-2xl p-12 text-center border border-slate-200/80 space-y-3">
            <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <i data-lucide="folder-open" class="w-6 h-6"></i>
            </div>
            <h4 class="font-bold text-slate-700 text-sm">Tidak ada sesi yang cocok</h4>
            <p class="text-xs text-slate-400 max-w-sm mx-auto">
              Cobalah untuk mengubah kriteria filter kelas, mata pelajaran, atau kata kunci pencarian Anda.
            </p>
          </div>
        ` : `
          <!-- TAMPILAN TABEL MODERN RINGKAS DENGAN EXPANDABLE DETAIL ACCORDION -->
          <div class="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden divide-y divide-slate-100">
            
            <!-- 4. Table Header yang Ditegaskan (Background abu-abu sangat muda & border tegas) -->
            <div class="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-100/90 text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b-2 border-slate-200">
              <div class="col-span-2">Tanggal & Kelas</div>
              <div class="col-span-4">Mata Pelajaran & Topik</div>
              <div class="col-span-2 text-center">Jenis Sesi</div>
              <div class="col-span-2 text-left">Ketuntasan</div>
              <div class="col-span-2 text-right">Aksi</div>
            </div>

            <!-- List of Sessions Items -->
            ${paginatedSessions.map((sesi) => {
              const pct = sesi.totalCount > 0 ? Math.round((sesi.tuntasCount / sesi.totalCount) * 100) : 100;
              const isPending = sesi.belumCount > 0;
              const rowBorderClass = isPending ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500';

              // 3. Format konsisten Mata Pelajaran
              let mapelSubtext = sesi.mapel;
              if (sesi.type === 'nilai') {
                mapelSubtext = sesi.isNoTugas ? `${sesi.mapel} • Bebas Tugas` : `${sesi.mapel} • KKM ${sesi.kkm || 75}`;
              } else if (sesi.type === 'ceklis') {
                mapelSubtext = sesi.isNoCatatan ? `${sesi.mapel} • Bebas Catatan` : `${sesi.mapel} • Ceklis Catatan`;
              }

              const isBebasSession = sesi.isNoTugas || sesi.isNoCatatan;

              return `
                <div class="session-item-row group ${rowBorderClass} transition hover:bg-slate-50/70" data-session-id="${sesi.id}">
                  
                  <!-- Main Clickable Row -->
                  <div class="p-3.5 sm:px-4 sm:py-3.5 cursor-pointer flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center gap-2.5 btn-toggle-detail" data-id="${sesi.id}">
                    
                    <!-- 1. Tanggal & Kelas -->
                    <div class="md:col-span-2 flex items-center justify-between md:flex-col md:items-start gap-1">
                      <div class="flex items-center gap-1.5">
                        <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                        <span class="text-xs font-bold text-slate-800">${sesi.tanggal}</span>
                      </div>
                      <span class="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                        ${sesi.kelas_nama}
                      </span>
                    </div>

                    <!-- 2. Mata Pelajaran & Topik Judul -->
                    <div class="md:col-span-4 min-w-0">
                      <div class="text-xs text-slate-500 font-semibold mb-0.5 truncate">
                        ${mapelSubtext}
                      </div>
                      <h4 class="font-bold text-slate-800 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition" title="${sesi.judul}">
                        ${sesi.judul}
                      </h4>
                    </div>

                    <!-- 3. Badge Jenis Sesi (5. Ukuran Konsisten w-24 sm:w-28) -->
                    <div class="md:col-span-2 flex items-center md:justify-center">
                      <span class="w-24 sm:w-28 text-center justify-center py-1 text-[10px] font-extrabold uppercase px-2 rounded-lg border ${sesi.typeBadgeColor} flex items-center gap-1 shadow-2xs">
                        <i data-lucide="${sesi.icon}" class="w-3 h-3 flex-shrink-0"></i>
                        <span class="truncate">${sesi.typeLabel}</span>
                      </span>
                    </div>

                    <!-- 4. Kolom Ketuntasan (2. Disederhanakan: Progress bar tipis + Persentase sejajar) -->
                    <div class="md:col-span-2 flex items-center gap-2.5">
                      <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="h-1.5 rounded-full transition-all duration-300 ${isBebasSession ? 'bg-teal-500' : (sesi.isFullTuntas ? 'bg-emerald-500' : 'bg-amber-500')}" style="width: ${isBebasSession ? 100 : pct}%"></div>
                      </div>
                      <span class="text-xs font-black w-10 text-right ${isBebasSession ? 'text-teal-700' : (sesi.isFullTuntas ? 'text-emerald-700' : 'text-amber-700')}">
                        ${isBebasSession ? '100%' : `${pct}%`}
                      </span>
                    </div>

                    <!-- 5. Kolom Aksi (1. Dikelompokkan & Beri Jarak Jelas) -->
                    <div class="md:col-span-2 flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      
                      <!-- Action Group: Edit & Hapus (Redup) -->
                      <div class="flex items-center gap-1 bg-slate-100/70 p-0.5 rounded-xl border border-slate-200/60">
                        <button class="btn-open-session p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-white rounded-lg transition" data-id="${sesi.id}" data-type="${sesi.type}" data-kelas="${sesi.kelas_id}" title="Edit / Buka Form">
                          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        </button>

                        <button class="btn-delete-session p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" data-id="${sesi.id}" data-type="${sesi.type === 'ceklis' ? 'ceklis' : 'nilai'}" title="Hapus Sesi">
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>

                      <!-- Separator / Divider -->
                      <div class="h-4 w-px bg-slate-200 hidden md:block"></div>

                      <!-- Expand Button (Terpisah) -->
                      <button class="btn-chevron-expand p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition" data-id="${sesi.id}" title="Lihat Rincian">
                        <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200 icon-chevron"></i>
                      </button>
                    </div>

                  </div>

                  <!-- Accordion Detail Panel (Menampilkan Seluruh Info Sekunder Lengkap) -->
                  <div id="detail-panel-${sesi.id}" class="detail-accordion hidden bg-slate-50/80 border-t border-slate-100 p-4 space-y-3 animate-in fade-in duration-150 text-xs">
                    
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                      <div>
                        <span class="text-slate-500 font-semibold">Topik / Agenda Lengkap:</span>
                        <p class="font-bold text-slate-900 text-sm mt-0.5">${sesi.judul}</p>
                      </div>

                      <div class="flex items-center gap-2">
                        <button class="btn-open-session px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition flex items-center gap-1.5" data-id="${sesi.id}" data-type="${sesi.type}" data-kelas="${sesi.kelas_id}">
                          <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                          <span>Buka di Form ${sesi.type === 'ceklis' ? 'Ceklis' : 'Nilai Tugas'}</span>
                        </button>
                      </div>
                    </div>

                    <!-- Detail Grid Stats (Info Sekunder: Rerata, Jumlah Siswa, KKM, Status) -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div class="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span class="text-[11px] text-slate-400 font-medium">Kelas & Tanggal</span>
                        <p class="font-bold text-slate-800">${sesi.kelas_nama} • ${sesi.tanggal}</p>
                      </div>

                      <div class="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span class="text-[11px] text-slate-400 font-medium">Mata Pelajaran</span>
                        <p class="font-bold text-slate-800">${sesi.mapel}</p>
                      </div>

                      <div class="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span class="text-[11px] text-slate-400 font-medium">Ketuntasan Siswa</span>
                        <p class="font-bold ${sesi.isFullTuntas ? 'text-emerald-700' : 'text-amber-700'}">
                          ${sesi.tuntasCount} dari ${sesi.totalCount} Siswa (${pct}%)
                        </p>
                      </div>

                      <div class="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span class="text-[11px] text-slate-400 font-medium">${sesi.type === 'nilai' ? 'Rata-Rata / KKM' : 'Status Evaluasi'}</span>
                        <p class="font-bold text-slate-800">
                          ${sesi.type === 'nilai' ? (sesi.isNoTugas ? 'Bebas Tugas' : `Rerata: ${sesi.avgScore} (KKM: ${sesi.kkm})`) : 'Catatan Kelengkapan'}
                        </p>
                      </div>
                    </div>

                    <!-- Siswa Belum Tuntas Notice & Daftar Nama -->
                    ${sesi.siswaBelumTuntas && sesi.siswaBelumTuntas.length > 0 ? `
                      <div class="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                        <div class="flex items-center justify-between text-rose-800 font-bold">
                          <div class="flex items-center gap-2">
                            <i data-lucide="alert-circle" class="w-4 h-4 text-rose-600"></i>
                            <span>Daftar Siswa Belum Tuntas (${sesi.siswaBelumTuntas.length} Siswa):</span>
                          </div>
                          <span class="text-[11px] font-semibold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">
                            ⚠️ Perlu Tindak Lanjut
                          </span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-56 overflow-y-auto">
                          ${sesi.siswaBelumTuntas.map(sb => `
                            <div class="bg-white p-2.5 rounded-xl border border-rose-200 text-xs flex items-center justify-between gap-2 shadow-2xs">
                              <div class="min-w-0 flex-1">
                                <p class="font-bold text-slate-800 truncate" title="${sb.nama_lengkap}">
                                  ${sb.nomor_absen ? `<span class="text-slate-400 font-semibold text-[11px]">No. ${sb.nomor_absen} • </span>` : ''}${sb.nama_lengkap}
                                </p>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                  <span class="text-[11px] font-semibold text-rose-600">${sb.alasan}</span>
                                </div>
                              </div>
                              <span class="text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex-shrink-0">
                                ${sb.nilai !== undefined && sb.nilai !== null ? `Nilai: ${sb.nilai}` : 'Belum'}
                              </span>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    ` : `
                      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-emerald-800 font-semibold">
                        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>
                        <span>${sesi.isNoTugas ? 'Pertemuan ini berstatus Bebas Tugas tanpa catatan kendala.' : 'Luar biasa! Semua siswa pada sesi ini telah tuntas 100%.'}</span>
                      </div>
                    `}

                  </div>

                </div>
              `;
            }).join('')}

          </div>

          <!-- Bottom Pagination Controls -->
          ${totalPages > 1 ? `
            <div class="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span class="text-xs font-semibold text-slate-500">
                Halaman <strong>${currentPage}</strong> dari <strong>${totalPages}</strong> (${totalItems} sesi)
              </span>

              <div class="flex items-center gap-2">
                <button id="btn-page-prev-bottom" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1" ${currentPage === 1 ? 'disabled' : ''}>
                  <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                  <span>Sebelumnya</span>
                </button>

                <div class="hidden sm:flex items-center gap-1">
                  ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                    <button class="btn-page-number w-8 h-8 rounded-lg text-xs font-bold transition ${p === currentPage ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}" data-page="${p}">
                      ${p}
                    </button>
                  `).join('')}
                </div>

                <button id="btn-page-next-bottom" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1" ${currentPage === totalPages ? 'disabled' : ''}>
                  <span>Berikutnya</span>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
          ` : ''}

        `}
      </div>

    </div>
  `;

  // Bind Events
  // 0. Tombol Bagikan Rekap Kelas
  container.querySelector('#btn-share-rekap-kelas')?.addEventListener('click', async () => {
    let modalDiv = document.querySelector('#modal-root');
    if (!modalDiv) {
      modalDiv = document.createElement('div');
      modalDiv.id = 'modal-root';
      document.body.appendChild(modalDiv);
    }
    await renderShareRekapKelasModal(modalDiv, {
      filteredSessions: unifiedSessions,
      allSiswa,
      kelasList,
      mapelList,
      currentKelasId: filterKelasId,
      currentMapel: filterMapel,
      filterStartDate,
      filterEndDate,
      academicYear: currentYear,
      onClose: () => (modalDiv.innerHTML = ''),
      showToast
    });
  });

  // 1. Tombol Buat Baru
  container.querySelector('#btn-goto-create-ceklis')?.addEventListener('click', () => {
    onStateChange({
      activeTab: 'tugas',
      tugasSubTab: 'ceklis',
      activeEditingChecklistId: null,
      activeEditingNilaiId: null
    });
  });

  // 2. Type Switcher
  container.querySelectorAll('.btn-pemeriksaan-type').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      onStateChange({ pemeriksaanType: type, pemeriksaanPage: 1 });
    });
  });

  // 3. Status Switcher
  container.querySelectorAll('.btn-pemeriksaan-status').forEach(btn => {
    btn.addEventListener('click', () => {
      const st = btn.getAttribute('data-status');
      onStateChange({ pemeriksaanStatus: st, pemeriksaanPage: 1 });
    });
  });

  // 4. Select Kelas & Mapel & DatePicker
  const selKelas = container.querySelector('#pemeriksaan-select-kelas');
  const selMapel = container.querySelector('#pemeriksaan-select-mapel');
  const inpStart = container.querySelector('#pemeriksaan-start-date');
  const inpSearch = container.querySelector('#pemeriksaan-search');

  initDatePicker(container, {
    id: 'pemeriksaan-start-date',
    value: filterStartDate,
    size: 'sm',
    onChange: (newDate) => {
      onStateChange({
        pemeriksaanKelasId: selKelas?.value || '',
        pemeriksaanMapel: selMapel?.value || '',
        pemeriksaanStartDate: newDate,
        pemeriksaanSearch: inpSearch?.value || '',
        pemeriksaanPage: 1
      });
    }
  });

  initClassCombobox(container, {
    id: 'pemeriksaan-select-kelas',
    kelasList,
    selectedId: filterKelasId,
    allowAll: true,
    allLabel: 'Semua Kelas',
    size: 'sm',
    onSelect: (newKId) => {
      filterKelasId = newKId;
      onStateChange({
        pemeriksaanKelasId: newKId,
        pemeriksaanMapel: selMapel?.value || '',
        pemeriksaanStartDate: inpStart?.value || '',
        pemeriksaanSearch: inpSearch?.value || '',
        pemeriksaanPage: 1
      });
    }
  });

  initMapelCombobox(container, {
    id: 'pemeriksaan-select-mapel',
    mapelList,
    selectedValue: filterMapel,
    allowAll: true,
    allLabel: 'Semua Mapel',
    size: 'sm',
    allowManage: false,
    onSelect: (newMapel) => {
      onStateChange({
        pemeriksaanKelasId: selKelas?.value || '',
        pemeriksaanMapel: newMapel,
        pemeriksaanStartDate: inpStart?.value || '',
        pemeriksaanSearch: inpSearch?.value || '',
        pemeriksaanPage: 1
      });
    }
  });

  function triggerFilters() {
    onStateChange({
      pemeriksaanKelasId: selKelas?.value || '',
      pemeriksaanMapel: selMapel?.value || '',
      pemeriksaanStartDate: inpStart?.value || '',
      pemeriksaanSearch: inpSearch?.value || '',
      pemeriksaanPage: 1
    });
  }
  inpStart?.addEventListener('change', triggerFilters);

  let searchTimeout = null;
  inpSearch?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(triggerFilters, 300);
  });

  // 5. Reset Filters
  container.querySelector('#btn-reset-pemeriksaan-filters')?.addEventListener('click', () => {
    onStateChange({
      pemeriksaanType: 'semua',
      pemeriksaanStatus: 'semua',
      pemeriksaanKelasId: '',
      pemeriksaanMapel: '',
      pemeriksaanStartDate: '',
      pemeriksaanEndDate: '',
      pemeriksaanSearch: '',
      pemeriksaanPage: 1
    });
  });

  // 6. Pagination Event Handlers
  container.querySelector('#btn-page-prev')?.addEventListener('click', () => {
    if (currentPage > 1) {
      onStateChange({ pemeriksaanPage: currentPage - 1 });
    }
  });

  container.querySelector('#btn-page-next')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      onStateChange({ pemeriksaanPage: currentPage + 1 });
    }
  });

  container.querySelector('#btn-page-prev-bottom')?.addEventListener('click', () => {
    if (currentPage > 1) {
      onStateChange({ pemeriksaanPage: currentPage - 1 });
    }
  });

  container.querySelector('#btn-page-next-bottom')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      onStateChange({ pemeriksaanPage: currentPage + 1 });
    }
  });

  container.querySelectorAll('.btn-page-number').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (p && p !== currentPage) {
        onStateChange({ pemeriksaanPage: p });
      }
    });
  });

  // 7. Toggle Accordion Details
  container.querySelectorAll('.btn-toggle-detail').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't toggle if clicking action buttons inside row
      if (e.target.closest('.btn-open-session') || e.target.closest('.btn-delete-session')) {
        return;
      }
      const id = row.getAttribute('data-id');
      const panel = container.querySelector(`#detail-panel-${id}`);
      const chevron = row.querySelector('.icon-chevron');

      if (panel) {
        const isHidden = panel.classList.contains('hidden');
        // Close all other accordions first for clean UX
        container.querySelectorAll('.detail-accordion').forEach(p => p.classList.add('hidden'));
        container.querySelectorAll('.icon-chevron').forEach(c => c.classList.remove('rotate-180'));

        if (isHidden) {
          panel.classList.remove('hidden');
          chevron?.classList.add('rotate-180');
        }
      }
    });
  });

  // 8. Buka & Edit Sesi
  container.querySelectorAll('.btn-open-session').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');
      const kelasId = btn.getAttribute('data-kelas');

      if (type === 'ceklis') {
        onStateChange({
          activeTab: 'tugas',
          tugasSubTab: 'ceklis',
          currentKelasId: kelasId,
          activeEditingChecklistId: id,
          activeEditingNilaiId: null
        });
      } else {
        onStateChange({
          activeTab: 'tugas',
          tugasSubTab: 'nilai',
          currentKelasId: kelasId,
          activeEditingNilaiId: id,
          activeEditingChecklistId: null
        });
      }
    });
  });

  // 9. Hapus Sesi
  container.querySelectorAll('.btn-delete-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');

      if (id && confirm(`Apakah Anda yakin ingin menghapus data ${type === 'ceklis' ? 'catatan ceklis' : 'nilai tugas'} ini?`)) {
        if (type === 'ceklis') {
          await db.deleteChecklist(id);
        } else {
          await db.deleteNilaiTugas(id);
        }
        showToast('Data berhasil dihapus', 'info');
        onStateChange({});
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}
