// components/LaporanSiswaModal.js - Modal Preview & Cetak Laporan Catatan & Tugas Per Siswa
import { db } from '../supabase-client.js';

/**
 * Render Modal Preview & Cetak Laporan Catatan & Tugas untuk Siswa Tertentu
 */
export async function renderLaporanSiswaModal(modalContainer, {
  siswa,
  kelas,
  rekapData,
  academicYear,
  onClose,
  showToast
}) {
  if (!siswa) return;

  const currentYear = academicYear || await db.getActiveAcademicYear();
  const schoolSettings = db.getSchoolSettings ? db.getSchoolSettings() : {};
  const profilGuru = db.getProfilGuru ? db.getProfilGuru() : {};
  const allChecklist = await db.getAllChecklist(currentYear);
  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // 1. Kumpulkan data Tugas dari rekapData.akademik.riwayat (Sumber yang sama dengan tab Nilai)
  const tugasList = (rekapData?.akademik?.riwayat || []).map(t => {
    const isLengkap = t.isTuntas === true;
    let statusText = 'Lengkap / Tuntas';
    let statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';

    if (t.nilai === null || t.nilai === undefined || t.nilai === '') {
      statusText = 'Belum Dinilai / Belum Mengumpulkan';
      statusBadge = 'bg-rose-100 text-rose-800 border-rose-300';
    } else if (!t.isTuntas) {
      statusText = `Remedi (${t.nilai} < KKM ${t.kkm})`;
      statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
    } else {
      statusText = `Tuntas (Nilai: ${t.nilai} / KKM ${t.kkm})`;
    }

    return {
      id: 'tgs-' + t.id,
      tanggal: t.tanggal || '-',
      mapel: t.mapel || 'Mata Pelajaran',
      judul: t.judul_tugas || 'Tugas Pembelajaran',
      jenis: 'Tugas',
      jenisBadge: 'bg-amber-50 text-amber-800 border-amber-200',
      isLengkap,
      statusText,
      statusBadge,
      nilai: t.nilai,
      kkm: t.kkm
    };
  });

  // 2. Kumpulkan data Ceklis untuk siswa ini (Sumber yang sama dengan tab Catatan & Ceklis)
  const kelasChecklist = allChecklist.filter(c => c.kelas_id === siswa.kelas_id);
  const checklistList = kelasChecklist.map(c => {
    const isNoCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
    const item = (c.daftar_ceklis || []).find(d => d.siswa_id === siswa.id);
    const isChecked = isNoCatatan ? true : (item ? (item.is_checked === true || item.is_checked === 'true') : false);
    
    let statusText = isChecked ? 'Lengkap / Tuntas' : 'Belum Tercentang';
    if (isNoCatatan) {
      statusText = 'Bebas Catatan (Tidak Ada Tagihan)';
    } else if (!isChecked && item?.catatan) {
      statusText += ` (${item.catatan})`;
    }
    const statusBadge = isNoCatatan
      ? 'bg-teal-100 text-teal-800 border-teal-300'
      : (isChecked 
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
        : 'bg-rose-100 text-rose-800 border-rose-300');

    return {
      id: 'chk-' + c.id,
      tanggal: c.tanggal || '-',
      mapel: c.mapel || 'Mata Pelajaran',
      judul: c.judul_catatan || 'Ceklis Catatan',
      jenis: isNoCatatan ? 'Bebas Catatan' : 'Ceklis',
      jenisBadge: isNoCatatan ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-teal-50 text-teal-800 border-teal-200',
      isLengkap: isChecked,
      statusText,
      statusBadge,
      nilai: null,
      kkm: null
    };
  });

  // 3. Gabungkan seluruh pertemuan dan urutkan berdasarkan tanggal ascending
  const allPertemuan = [...tugasList, ...checklistList].sort((a, b) => {
    return new Date(a.tanggal) - new Date(b.tanggal);
  });

  const totalPertemuan = allPertemuan.length;
  const totalBelumLengkap = allPertemuan.filter(p => !p.isLengkap).length;
  const totalLengkap = totalPertemuan - totalBelumLengkap;

  // Filter state internal modal: 'belum' (default) vs 'semua'
  let currentFilter = 'belum';

  const renderModalContent = () => {
    const displayedList = currentFilter === 'belum' 
      ? allPertemuan.filter(p => !p.isLengkap) 
      : allPertemuan;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          <!-- Modal Header (Non-Print Area) -->
          <div class="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-teal-900 to-emerald-900 text-white flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30">
                <i data-lucide="file-text" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 class="font-bold text-base sm:text-lg">Laporan Catatan & Tagihan Tugas Siswa</h3>
                <p class="text-xs text-emerald-200/80">
                  ${siswa.nama_lengkap} • Kelas ${kelas?.nama_kelas || 'Kelas'} (T.A ${currentYear})
                </p>
              </div>
            </div>

            <button id="btn-close-laporan-modal" class="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Filter & Action Bar (Non-Print Area) -->
          <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
            <!-- Filter Toggle -->
            <div class="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
              <button id="filter-btn-belum" class="px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${currentFilter === 'belum' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Hanya Belum Lengkap (${totalBelumLengkap})</span>
              </button>
              <button id="filter-btn-semua" class="px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${currentFilter === 'semua' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Tampilkan Semua (${totalPertemuan})</span>
              </button>
            </div>

            <!-- Print / Export Action Buttons -->
            <div class="flex items-center gap-2">
              <button id="btn-print-laporan" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition transform active:scale-95">
                <i data-lucide="printer" class="w-4 h-4"></i>
                <span>Cetak / Cetak PDF</span>
              </button>
              <button id="btn-close-laporan-secondary" class="bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-200 transition">
                Tutup
              </button>
            </div>
          </div>

          <!-- Printable Preview Scroll Area -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-100/60 custom-scrollbar">
            
            <!-- Document Sheet Container (White A4 Style Container) -->
            <div id="printable-laporan-sheet" class="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-800 space-y-5 max-w-3xl mx-auto">
              
              <!-- Report KOP & Header -->
              <div class="border-b-2 border-slate-800 pb-4 text-center">
                <div>
                  <h3 class="text-xs font-extrabold tracking-wider uppercase text-slate-700 leading-tight">
                    ${schoolSettings.instansi_induk || 'PEMERINTAH PROVINSI SULAWESI SELATAN'}<br>
                    ${schoolSettings.dinas ? schoolSettings.dinas + ' • ' : ''}${schoolSettings.nama_sekolah || 'SMKN 1 BANTAENG'}
                  </h3>
                  <h1 class="text-base sm:text-lg font-black text-slate-900 mt-1">LAPORAN KETUNTASAN CATATAN & TUGAS SISWA</h1>
                  <p class="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
                    ${schoolSettings.alamat || ''} ${schoolSettings.telepon ? '• Telp: ' + schoolSettings.telepon : ''} ${schoolSettings.website ? '• Web: ' + schoolSettings.website : ''}
                  </p>
                </div>
                <div class="h-0.5 bg-slate-800 mt-2"></div>
                <div class="h-px bg-slate-800 mt-0.5"></div>
              </div>

              <!-- Student Profile Metadata Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">Nama Lengkap</span>
                  <strong class="text-slate-900 text-xs sm:text-sm font-black">${siswa.nama_lengkap}</strong>
                </div>
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">Kelas / Rombel</span>
                  <strong class="text-slate-800 font-bold">${kelas?.nama_kelas || '-'}</strong>
                </div>
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">NISN / No. Absen</span>
                  <span class="font-mono text-slate-700 font-bold">${siswa.nisn || '-'} (No. ${siswa.nomor_absen || '-'})</span>
                </div>
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">Tahun Ajaran</span>
                  <span class="text-slate-700 font-bold">${currentYear}</span>
                </div>
              </div>

              <!-- Filter Indicator Banner in Report -->
              <div class="flex items-center justify-between text-xs py-1 px-2 bg-slate-100 rounded-lg text-slate-600 font-medium">
                <span>Filter Laporan: <strong>${currentFilter === 'belum' ? 'Hanya Pertemuan Belum Lengkap' : 'Semua Riwayat Pertemuan'}</strong></span>
                <span class="text-[11px] text-slate-500">Dicetak pada: ${printDateStr}</span>
              </div>

              <!-- Meetings Table -->
              <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th class="py-2.5 px-3 w-10 text-center">No</th>
                      <th class="py-2.5 px-3 w-28">Tanggal</th>
                      <th class="py-2.5 px-3 w-32">Mata Pelajaran</th>
                      <th class="py-2.5 px-3">Topik / Judul Pertemuan</th>
                      <th class="py-2.5 px-3 w-20 text-center">Jenis</th>
                      <th class="py-2.5 px-3 w-40 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${displayedList.length === 0 ? `
                      <tr>
                        <td colspan="6" class="py-8 text-center text-slate-400">
                          <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500 mx-auto mb-2"></i>
                          <p class="font-bold text-slate-700 text-sm">
                            ${currentFilter === 'belum' ? 'Hebat! Tidak ada catatan atau tugas yang belum lengkap.' : 'Belum ada data pertemuan untuk siswa ini.'}
                          </p>
                          <p class="text-[11px] text-slate-500 mt-0.5">Seluruh kewajiban pembelajaran telah tuntas.</p>
                        </td>
                      </tr>
                    ` : displayedList.map((item, idx) => `
                      <tr class="hover:bg-slate-50/80 transition ${!item.isLengkap ? 'bg-rose-50/30' : ''}">
                        <td class="py-2.5 px-3 text-center font-bold text-slate-500">${idx + 1}</td>
                        <td class="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">${item.tanggal}</td>
                        <td class="py-2.5 px-3 font-bold text-slate-900">${item.mapel}</td>
                        <td class="py-2.5 px-3 text-slate-800">
                          <div class="font-bold">${item.judul}</div>
                        </td>
                        <td class="py-2.5 px-3 text-center">
                          <span class="px-2 py-0.5 rounded text-[10px] font-black border ${item.jenisBadge}">
                            ${item.jenis}
                          </span>
                        </td>
                        <td class="py-2.5 px-3">
                          <span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${item.statusBadge}">
                            ${item.statusText}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Summary Banner & Footer -->
              <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span class="text-slate-500">Ringkasan Ketuntasan:</span>
                  <span class="font-black text-slate-900 ml-1">
                    ${totalBelumLengkap > 0 ? `${totalBelumLengkap} dari ${totalPertemuan} pertemuan belum lengkap.` : `100% Tuntas (${totalPertemuan} pertemuan lengkap).`}
                  </span>
                </div>
                <div class="text-[11px] text-slate-500 font-semibold">
                  Tuntas: <strong class="text-emerald-700 font-bold">${totalLengkap}</strong> • Belum Lengkap: <strong class="text-rose-700 font-bold">${totalBelumLengkap}</strong>
                </div>
              </div>

              <!-- Signatures Box for Formal Printout -->
              <div class="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-slate-800">
                <div>
                  <p class="text-slate-500 mb-12">Mengetahui,<br>Orang Tua / Wali Siswa</p>
                  <p class="font-bold border-b border-slate-400 pb-1 inline-block min-w-[140px]">( ............................................ )</p>
                </div>
                <div>
                  <p class="text-slate-500 mb-12">${profilGuru.kota || 'Bantaeng'}, ${printDateStr}<br>Guru Mata Pelajaran</p>
                  <p class="font-bold border-b border-slate-400 pb-1 inline-block min-w-[140px]">${profilGuru.nama_guru || 'Ammar, S.Pd.'}</p>
                  <p class="text-[10px] text-slate-400 mt-0.5">${profilGuru.nip_guru ? 'NIP. ' + profilGuru.nip_guru : 'NIP. -'}</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Bind Events
    modalContainer.querySelector('#btn-close-laporan-modal')?.addEventListener('click', onClose);
    modalContainer.querySelector('#btn-close-laporan-secondary')?.addEventListener('click', onClose);

    // Filter Buttons
    modalContainer.querySelector('#filter-btn-belum')?.addEventListener('click', () => {
      currentFilter = 'belum';
      renderModalContent();
    });

    modalContainer.querySelector('#filter-btn-semua')?.addEventListener('click', () => {
      currentFilter = 'semua';
      renderModalContent();
    });

    // Print Action
    modalContainer.querySelector('#btn-print-laporan')?.addEventListener('click', () => {
      const sheet = modalContainer.querySelector('#printable-laporan-sheet');
      if (!sheet) return;

      const printWindow = window.open('', '_blank', 'width=900,height=800');
      if (!printWindow) {
        showToast('Gagal membuka jendela cetak. Pastikan pop-up diizinkan di browser.', 'error');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>Laporan Catatan & Tugas - ${siswa.nama_lengkap}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4 portrait; margin: 12mm; }
            }
          </style>
        </head>
        <body class="bg-white p-4">
          <div class="max-w-3xl mx-auto">
            ${sheet.outerHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    });
  };

  renderModalContent();
}
