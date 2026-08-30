// components/ShareRekapKelasModal.js - Modal Bagikan Rekap Ketuntasan Catatan & Tugas Kelas (Laporan PDF Multi-Sesi & WhatsApp)
import { db } from '../supabase-client.js';
import { formatIndonesianDate, toISODateString, renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';

/**
 * Format tanggal ringkas DD/MM/YYYY untuk kolom tabel
 */
function formatDateShort(isoDate) {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Bersihkan string untuk nama file yang aman
 */
function sanitizeFilename(str) {
  return (str || '').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

/**
 * Render Modal Bagikan Rekap Kelas & Laporan PDF Multi-Sesi
 */
export async function renderShareRekapKelasModal(modalContainer, {
  filteredSessions = [],
  allSiswa = [],
  kelasList = [],
  mapelList = [],
  currentKelasId = '',
  currentMapel = '',
  filterStartDate = '',
  filterEndDate = '',
  academicYear = '',
  onClose,
  showToast
}) {
  const currentYear = academicYear || await db.getActiveAcademicYear();
  const schoolSettings = db.getSchoolSettings ? db.getSchoolSettings() : {};
  const profilGuru = db.getProfilGuru ? db.getProfilGuru() : {};
  const guruNama = profilGuru.nama_guru || 'Ammar, S.Pd.';
  const guruNip = profilGuru.nip_guru || '';
  const kepsekNama = profilGuru.nama_kepsek || 'Drs. H. Syamsuddin, M.Pd.';
  const kepsekNip = profilGuru.nip_kepsek || '';
  const kota = profilGuru.kota || 'Bantaeng';

  // Data master seluruh kelas & mapel
  const allMasterKelas = kelasList.length > 0 ? kelasList : await db.getKelas(currentYear);
  const allMasterMapel = mapelList.length > 0 ? mapelList : await db.getMataPelajaran();

  // State Filter di dalam modal
  let selectedKelasId = (currentKelasId && currentKelasId !== 'all' && currentKelasId !== 'semua') ? currentKelasId : '';
  let selectedMapel = (currentMapel && currentMapel !== 'all' && currentMapel !== 'semua') ? currentMapel : '';

  // Default tanggal: 14 hari ke belakang s.d hari ini jika belum ada filter
  const todayIso = toISODateString(new Date());
  const defaultPastDate = new Date();
  defaultPastDate.setDate(defaultPastDate.getDate() - 14);
  const defaultPastIso = toISODateString(defaultPastDate);

  let startDate = filterStartDate || defaultPastIso;
  let endDate = filterEndDate || todayIso;

  // Active subtab di dalam modal: 'pdf' (Laporan PDF & Tabel) vs 'wa' (Ringkasan WhatsApp & PNG)
  let modalActiveTab = 'pdf';

  // Cache seluruh data sesi & siswa untuk perhitungan live di modal
  let rawAllChecklist = await db.getAllChecklist(currentYear);
  let rawAllNilai = await db.getAllNilaiTugas(currentYear);

  async function renderModalContent() {
    const selectedKelasObj = allMasterKelas.find(k => k.id === selectedKelasId || k.nama_kelas === selectedKelasId) || null;
    const targetKelasNama = selectedKelasObj?.nama_kelas || '';
    const targetMapelNama = selectedMapel || '';

    // =========================================================================
    // BAGIAN 1: VALIDASI FILTER WAJIB
    // =========================================================================
    const isFilterComplete = Boolean(
      selectedKelasId && 
      selectedMapel && 
      startDate && 
      endDate && 
      startDate <= endDate
    );

    // Ambil daftar siswa kelas target
    let classStudents = [];
    if (selectedKelasId) {
      classStudents = await db.getSiswaByKelas(selectedKelasId);
      if (classStudents.length === 0 && allSiswa.length > 0) {
        classStudents = allSiswa.filter(s => s.kelas_id === selectedKelasId || s.kelas === selectedKelasId);
      }
    }

    // Urutkan siswa berdasarkan nomor absen & nama
    classStudents.sort((a, b) => {
      const na = a.nomor_absen ? parseInt(a.nomor_absen, 10) : 999;
      const nb = b.nomor_absen ? parseInt(b.nomor_absen, 10) : 999;
      return na - nb || (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '');
    });

    // =========================================================================
    // BAGIAN 2 & 3: PENGUMPULAN DATA MULTI-SESI & PENGELOMPOKAN PER TANGGAL
    // =========================================================================
    let targetSessions = [];
    let sessionGroups = []; // Array per sesi/tanggal
    let totalEntriesBelumSelesai = 0;
    let totalEntriesSelesai = 0;
    let totalEntriesBebas = 0;

    if (isFilterComplete) {
      // 1. Ambil sesi Ceklis yang cocok
      const matchedChecklist = rawAllChecklist.filter(c => {
        const cKId = c.kelas_id || c.kelas?.id || '';
        const cKNama = c.kelas?.nama_kelas || c.kelas_nama || (c.kelas_id && !c.kelas_id.startsWith('k-') ? c.kelas_id : '');
        const matchK = cKId === selectedKelasId || cKNama === targetKelasNama || c.kelas_id === targetKelasNama;
        
        const cMapel = (c.mapel || '').trim().toLowerCase();
        const selMapel = (selectedMapel || '').trim().toLowerCase();
        const matchM = cMapel === selMapel;

        const matchT = c.tanggal >= startDate && c.tanggal <= endDate;
        return matchK && matchM && matchT;
      }).map(c => {
        const isNoCatatan = c.is_no_catatan === true || c.is_no_catatan === 'true' || c.bebas_catatan === true || c.bebas_catatan === 'true';
        return {
          id: c.id,
          type: 'ceklis',
          typeLabel: isNoCatatan ? 'Bebas Catatan' : 'Ceklis Catatan',
          isNoCatatan,
          isNoTugas: false,
          tanggal: c.tanggal,
          judul: c.judul_catatan || 'Ceklis Catatan',
          kkm: null,
          rawData: c
        };
      });

      // 2. Ambil sesi Nilai Tugas yang cocok
      const matchedNilai = rawAllNilai.filter(nt => {
        const ntKId = nt.kelas_id || nt.kelas?.id || '';
        const ntKNama = nt.kelas?.nama_kelas || nt.kelas_nama || (nt.kelas_id && !nt.kelas_id.startsWith('k-') ? nt.kelas_id : '');
        const matchK = ntKId === selectedKelasId || ntKNama === targetKelasNama || nt.kelas_id === targetKelasNama;
        
        const ntMapel = (nt.mapel || '').trim().toLowerCase();
        const selMapel = (selectedMapel || '').trim().toLowerCase();
        const matchM = ntMapel === selMapel;

        const matchT = nt.tanggal >= startDate && nt.tanggal <= endDate;
        return matchK && matchM && matchT;
      }).map(nt => {
        const isNoTugas = nt.is_no_tugas === true || nt.is_no_tugas === 'true';
        return {
          id: nt.id,
          type: 'nilai',
          typeLabel: isNoTugas ? 'Bebas Tugas' : 'Penilaian Tugas',
          isNoCatatan: false,
          isNoTugas,
          tanggal: nt.tanggal,
          judul: nt.judul_tugas || 'Tugas Pembelajaran',
          kkm: parseInt(nt.kkm) || 75,
          rawData: nt
        };
      });

      // 3. Gabungkan seluruh sesi dan urutkan KRONOLOGIS ASCENDING (terlama ke terbaru)
      targetSessions = [...matchedChecklist, ...matchedNilai].sort((a, b) => {
        const dateCompare = new Date(a.tanggal) - new Date(b.tanggal);
        if (dateCompare !== 0) return dateCompare;
        return (a.judul || '').localeCompare(b.judul || '');
      });

      // 4. Proses baris per (siswa, sesi) untuk setiap sesi
      sessionGroups = targetSessions.map((sesi, sessionIndex) => {
        const studentRows = [];

        classStudents.forEach(siswa => {
          let catatanStatus = '-';
          let nilaiStatus = '-';
          let keterangan = '';
          let statusGroup = 2; // 1: Belum Selesai, 2: Selesai, 3: Bebas
          let isBelumSelesai = false;
          let isBebas = false;

          if (sesi.type === 'ceklis') {
            if (sesi.isNoCatatan) {
              catatanStatus = 'Bebas';
              nilaiStatus = '-';
              keterangan = 'Bebas Catatan (Tidak ada tagihan)';
              statusGroup = 3;
              isBebas = true;
            } else {
              const list = sesi.rawData?.daftar_ceklis || [];
              const item = list.find(d => d.siswa_id === siswa.id);
              const isChecked = item ? (item.is_checked === true || item.is_checked === 'true') : false;

              if (isChecked) {
                catatanStatus = 'Selesai';
                nilaiStatus = '-';
                keterangan = item?.catatan ? item.catatan : 'Sudah lengkap';
                statusGroup = 2;
              } else {
                catatanStatus = 'Belum Selesai';
                nilaiStatus = '-';
                keterangan = item?.catatan ? `Belum tercentang (${item.catatan})` : 'Belum tercentang';
                statusGroup = 1;
                isBelumSelesai = true;
              }
            }
          } else if (sesi.type === 'nilai') {
            if (sesi.isNoTugas) {
              catatanStatus = '-';
              nilaiStatus = 'Bebas';
              keterangan = 'Bebas Tugas (Tidak ada tagihan)';
              statusGroup = 3;
              isBebas = true;
            } else {
              const list = sesi.rawData?.daftar_nilai || [];
              const item = list.find(d => d.siswa_id === siswa.id);
              const valStr = String(item?.nilai !== undefined && item?.nilai !== null ? item.nilai : '').trim();
              const kkm = sesi.kkm || 75;

              if (valStr === '') {
                catatanStatus = '-';
                nilaiStatus = 'Belum Dinilai';
                keterangan = 'Belum mengumpulkan tugas';
                statusGroup = 1;
                isBelumSelesai = true;
              } else {
                const numVal = parseInt(valStr, 10);
                if (isNaN(numVal) || numVal < kkm) {
                  catatanStatus = '-';
                  nilaiStatus = String(numVal || valStr);
                  keterangan = item?.catatan ? `Remedi (${item.catatan})` : `Remedi (${valStr} < KKM ${kkm})`;
                  statusGroup = 1;
                  isBelumSelesai = true;
                } else {
                  catatanStatus = '-';
                  nilaiStatus = String(numVal);
                  keterangan = item?.catatan ? item.catatan : `Tuntas (KKM ${kkm})`;
                  statusGroup = 2;
                }
              }
            }
          }

          if (isBelumSelesai) totalEntriesBelumSelesai++;
          else if (isBebas) totalEntriesBebas++;
          else totalEntriesSelesai++;

          studentRows.push({
            siswa_id: siswa.id,
            nama_lengkap: siswa.nama_lengkap,
            nomor_absen: siswa.nomor_absen || '',
            nisn: siswa.nisn || '',
            catatanStatus,
            nilaiStatus,
            keterangan,
            tanggal: sesi.tanggal,
            tanggalFormatted: formatDateShort(sesi.tanggal),
            statusGroup, // 1: Belum Selesai (Top), 2: Selesai (Middle), 3: Bebas (Bottom)
            isBelumSelesai,
            isBebas
          });
        });

        // Pengurutan DALAM setiap tanggal:
        // 1. Siswa "Belum Selesai" paling atas (statusGroup = 1)
        // 2. Siswa "Selesai" di tengah (statusGroup = 2)
        // 3. Siswa "Bebas" paling bawah (statusGroup = 3)
        // Secondary sort: nomor absen, lalu nama
        studentRows.sort((a, b) => {
          if (a.statusGroup !== b.statusGroup) {
            return a.statusGroup - b.statusGroup;
          }
          const na = a.nomor_absen ? parseInt(a.nomor_absen, 10) : 999;
          const nb = b.nomor_absen ? parseInt(b.nomor_absen, 10) : 999;
          return na - nb || a.nama_lengkap.localeCompare(b.nama_lengkap);
        });

        const uncompletedInSession = studentRows.filter(r => r.isBelumSelesai).length;

        return {
          sessionIndex: sessionIndex + 1,
          sesi,
          studentRows,
          uncompletedInSession
        };
      });
    }

    // Tanggal cetak formal
    const printDateStr = formatIndonesianDate(todayIso);
    const pdfFilename = `Rekap_${sanitizeFilename(targetKelasNama || 'Kelas')}_${sanitizeFilename(targetMapelNama || 'Mapel')}_${startDate}_${endDate}.pdf`;

    // 4. Format Pesan WhatsApp
    let waText = `📢 *REKAP KETUNTASAN CATATAN & TUGAS SISWA*\n`;
    waText += `🏫 *Kelas:* ${targetKelasNama || '-'}\n`;
    waText += `📚 *Mata Pelajaran:* ${targetMapelNama || '-'}\n`;
    waText += `📅 *Periode:* ${formatIndonesianDate(startDate)} s.d ${formatIndonesianDate(endDate)}\n`;
    waText += `🗓️ *Tahun Ajaran:* ${currentYear}\n\n`;

    if (!isFilterComplete) {
      waText += `⚠️ Silakan lengkapi filter kelas, mapel, dan rentang tanggal untuk membuat laporan.\n`;
    } else if (targetSessions.length === 0) {
      waText += `ℹ️ Tidak ada sesi pertemuan yang tercatat pada rentang tanggal ini.\n`;
    } else if (totalEntriesBelumSelesai === 0) {
      waText += `🎉 *ALHAMDULILLAH! SELURUH SISWA SUDAH TUNTAS SEMUA!*\n`;
      waText += `Dari total ${targetSessions.length} pertemuan (${classStudents.length} siswa), tidak ada tagihan yang tertunda.\n`;
    } else {
      waText += `Berikut riwayat tagihan *BELUM TUNTAS* per tanggal pertemuan:\n\n`;
      sessionGroups.forEach(group => {
        const pendingRows = group.studentRows.filter(r => r.isBelumSelesai);
        if (pendingRows.length > 0) {
          waText += `📌 *Tanggal ${formatIndonesianDate(group.sesi.tanggal)}* — _${group.sesi.judul}_\n`;
          pendingRows.forEach((r, idx) => {
            waText += `   ${idx + 1}. *${r.nama_lengkap}* : ${r.keterangan}\n`;
          });
          waText += `\n`;
        }
      });
      waText += `──────────────────────────────\n`;
      waText += `📊 *Total Entri Belum Tuntas:* ${totalEntriesBelumSelesai} entri dari ${targetSessions.length} sesi pertemuan.\n`;
      waText += `⚠️ _Mohon siswa yang bersangkutan segera menyelesaikan tagihan tugas/catatan. Terima kasih._`;
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          <!-- Header Modal -->
          <div class="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-teal-900 to-emerald-900 text-white flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-400/30">
                <i data-lucide="file-spreadsheet" class="w-6 h-6"></i>
              </div>
              <div>
                <h3 class="font-bold text-base sm:text-lg">Laporan Rekap Kelas (Multi-Sesi)</h3>
                <p class="text-xs text-teal-200/80">
                  Rekapitulasi riwayat catatan & nilai per siswa dalam rentang tanggal
                </p>
              </div>
            </div>

            <button id="btn-close-share-modal" class="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Section 1: Selector Filter Wajib (Kelas, Mapel, Rentang Tanggal menggunakan Shared Combobox) -->
          <div class="p-4 bg-slate-50 border-b border-slate-200/80 space-y-3 flex-shrink-0">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              
              <!-- 1. Pilih 1 Kelas Spesifik -->
              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  Kelas Target <span class="text-rose-500">*</span>
                </label>
                ${renderClassComboboxHTML({
                  id: 'modal-select-kelas',
                  kelasList: allMasterKelas,
                  selectedId: selectedKelasId,
                  placeholder: 'Pilih Kelas...',
                  allowAll: false,
                  size: 'sm'
                })}
              </div>

              <!-- 2. Pilih 1 Mapel Spesifik -->
              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  Mata Pelajaran <span class="text-rose-500">*</span>
                </label>
                ${renderMapelComboboxHTML({
                  id: 'modal-select-mapel',
                  mapelList: allMasterMapel,
                  selectedValue: selectedMapel,
                  placeholder: 'Pilih Mapel...',
                  allowAll: false,
                  size: 'sm',
                  allowManage: false
                })}
              </div>

              <!-- 3. Dari Tanggal -->
              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  Dari Tanggal <span class="text-rose-500">*</span>
                </label>
                ${renderDatePickerHTML({
                  id: 'modal-input-start-date',
                  value: startDate,
                  size: 'sm'
                })}
              </div>

              <!-- 4. Sampai Tanggal -->
              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  Sampai Tanggal <span class="text-rose-500">*</span>
                </label>
                ${renderDatePickerHTML({
                  id: 'modal-input-end-date',
                  value: endDate,
                  size: 'sm'
                })}
              </div>

            </div>

            <!-- Banner Feedback Status Validasi -->
            ${!isFilterComplete ? `
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900 font-semibold shadow-2xs">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 flex-shrink-0"></i>
                <span>Pilih <strong>1 Kelas spesifik</strong>, <strong>1 Mata Pelajaran</strong>, dan <strong>Rentang Tanggal</strong> terlebih dahulu.</span>
              </div>
            ` : (targetSessions.length === 0 ? `
              <div class="p-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between text-xs text-sky-950 font-semibold shadow-2xs">
                <div class="flex items-center gap-2">
                  <i data-lucide="info" class="w-4 h-4 text-sky-600"></i>
                  <span>Tidak ada sesi pertemuan (Catatan/Tugas) untuk <strong>${targetKelasNama} • ${targetMapelNama}</strong> pada rentang ini.</span>
                </div>
                <span class="text-[11px] text-sky-700 font-bold bg-sky-100 px-2.5 py-0.5 rounded-lg">0 Sesi</span>
              </div>
            ` : `
              <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-950 font-bold shadow-2xs">
                <div class="flex items-center gap-2">
                  <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>
                  <span>✓ <strong>${targetSessions.length} sesi pertemuan</strong> ditemukan dalam rentang ini (${classStudents.length} siswa).</span>
                </div>
                <div class="flex items-center gap-2 font-semibold text-[11px]">
                  <span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-bold">${totalEntriesBelumSelesai} Belum Selesai</span>
                  <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">${totalEntriesSelesai} Selesai</span>
                  ${totalEntriesBebas > 0 ? `<span class="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">${totalEntriesBebas} Bebas</span>` : ''}
                </div>
              </div>
            `)}
          </div>

          <!-- Section 2: Tab Bar Switcher & Actions -->
          <div class="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <div class="inline-flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
              <button id="tab-btn-pdf" class="px-3.5 py-1.5 rounded-lg transition ${modalActiveTab === 'pdf' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                📄 Laporan PDF & Tabel
              </button>
              <button id="tab-btn-wa" class="px-3.5 py-1.5 rounded-lg transition ${modalActiveTab === 'wa' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                💬 Format WhatsApp & PNG
              </button>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 flex-wrap">
              ${modalActiveTab === 'pdf' ? `
                <button id="btn-download-pdf" ${!isFilterComplete || targetSessions.length === 0 ? 'disabled' : ''} class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  <span>Unduh File PDF</span>
                </button>
                <button id="btn-print-pdf-sheet" ${!isFilterComplete || targetSessions.length === 0 ? 'disabled' : ''} class="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
                  <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                  <span>Cetak PDF (A4)</span>
                </button>
              ` : `
                <button id="btn-copy-wa-text" ${!isFilterComplete || targetSessions.length === 0 ? 'disabled' : ''} class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                  <span>Salin Teks WA</span>
                </button>
                <button id="btn-download-png-card" ${!isFilterComplete || targetSessions.length === 0 ? 'disabled' : ''} class="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
                  <i data-lucide="image" class="w-3.5 h-3.5"></i>
                  <span>Unduh Gambar PNG</span>
                </button>
              `}
            </div>
          </div>

          <!-- Section 3: Body Content (Tab 1: PDF Printable View vs Tab 2: WA View) -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 custom-scrollbar">
            
            ${modalActiveTab === 'pdf' ? `
              
              <!-- Printable Sheet Container -->
              <div id="printable-rekap-sheet" class="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-800 space-y-6 max-w-3xl mx-auto">
                
                <!-- Kop & Header Formal -->
                <div class="border-b-2 border-slate-800 pb-3">
                  <div class="text-center">
                    <h1 class="text-xs sm:text-sm font-extrabold tracking-wider text-slate-900 uppercase leading-tight">
                      ${schoolSettings.instansi_induk || 'PEMERINTAH PROVINSI SULAWESI SELATAN'}<br>
                      ${schoolSettings.dinas ? schoolSettings.dinas + ' • ' : ''}${schoolSettings.nama_sekolah || 'SMKN 1 BANTAENG'}
                    </h1>
                    <p class="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                      ${schoolSettings.alamat || ''} ${schoolSettings.telepon ? '• Telp: ' + schoolSettings.telepon : ''} ${schoolSettings.website ? '• Web: ' + schoolSettings.website : ''}
                    </p>
                  </div>
                  <div class="h-0.5 bg-slate-800 mt-2"></div>
                  <div class="h-px bg-slate-800 mt-0.5"></div>
                </div>

                <!-- Judul Laporan & Metadata Header -->
                <div class="space-y-3">
                  <div class="text-center">
                    <h2 class="text-base sm:text-lg font-black text-slate-900 tracking-tight underline">
                      REKAPITULASI CATATAN & PENILAIAN TUGAS SISWA
                    </h2>
                    <p class="text-xs text-slate-600 font-semibold mt-0.5">
                      Tahun Ajaran: ${currentYear}
                    </p>
                  </div>

                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span class="text-slate-500 font-semibold block text-[10px]">Kelas:</span>
                      <strong class="text-slate-900 font-bold">${targetKelasNama || '-'}</strong>
                    </div>
                    <div>
                      <span class="text-slate-500 font-semibold block text-[10px]">Mata Pelajaran:</span>
                      <strong class="text-slate-900 font-bold">${targetMapelNama || '-'}</strong>
                    </div>
                    <div>
                      <span class="text-slate-500 font-semibold block text-[10px]">Rentang Tanggal:</span>
                      <strong class="text-slate-900 font-bold">${formatIndonesianDate(startDate)} s.d ${formatIndonesianDate(endDate)}</strong>
                    </div>
                    <div>
                      <span class="text-slate-500 font-semibold block text-[10px]">Total Sesi:</span>
                      <strong class="text-emerald-700 font-black">${targetSessions.length} Pertemuan</strong>
                    </div>
                  </div>
                </div>

                <!-- Bagian 3: Tabel Per Tanggal (Kronologis dengan Sub-Header) -->
                ${!isFilterComplete ? `
                  <div class="text-center py-12 text-slate-400 text-xs">
                    Lengkapi filter di atas untuk melihat tabel rekap multi-sesi.
                  </div>
                ` : (sessionGroups.length === 0 ? `
                  <div class="text-center py-12 text-slate-400 text-xs">
                    Tidak ada catatan atau tugas yang ditemukan dalam rentang tanggal ini.
                  </div>
                ` : `
                  <div class="space-y-6">
                    ${sessionGroups.map((group) => {
                      const sesi = group.sesi;
                      const badgeTypeColor = sesi.type === 'ceklis'
                        ? (sesi.isNoCatatan ? 'bg-teal-100 text-teal-800 border-teal-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300')
                        : (sesi.isNoTugas ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-amber-100 text-amber-800 border-amber-300');

                      return `
                        <div class="space-y-2 border border-slate-200 rounded-xl overflow-hidden">
                          
                          <!-- Sub-Header Jelas Per Tanggal -->
                          <div class="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                              <span class="bg-slate-800 text-white font-extrabold text-xs px-2.5 py-1 rounded-lg">
                                📅 Tanggal: ${formatIndonesianDate(sesi.tanggal)}
                              </span>
                              <h4 class="font-black text-slate-900 text-xs sm:text-sm">
                                ${sesi.judul}
                              </h4>
                            </div>
                            
                            <div class="flex items-center gap-2">
                              <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badgeTypeColor}">
                                ${sesi.typeLabel} ${sesi.kkm ? `• KKM ${sesi.kkm}` : ''}
                              </span>
                              ${group.uncompletedInSession > 0 ? `
                                <span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-200">
                                  ⚠️ ${group.uncompletedInSession} Belum Selesai
                                </span>
                              ` : `
                                <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                                  ✓ 100% Tuntas
                                </span>
                              `}
                            </div>
                          </div>

                          <!-- Tabel Siswa pada Tanggal Ini -->
                          <div class="overflow-x-auto">
                            <table class="w-full text-xs text-left border-collapse">
                              <thead>
                                <tr class="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                                  <th class="py-2 px-3 w-10 text-center">No</th>
                                  <th class="py-2 px-3">Nama Siswa</th>
                                  <th class="py-2 px-3 w-28 text-center">Catatan</th>
                                  <th class="py-2 px-3 w-28 text-center">Nilai</th>
                                  <th class="py-2 px-3">Keterangan</th>
                                  <th class="py-2 px-3 w-24 text-center">Tanggal</th>
                                </tr>
                              </thead>
                              <tbody class="divide-y divide-slate-100">
                                ${group.studentRows.map((r, idx) => {
                                  // Highlight baris
                                  let rowClass = 'hover:bg-slate-50/50';
                                  if (r.isBelumSelesai) {
                                    rowClass = 'bg-rose-50/70 hover:bg-rose-100/70 text-rose-950 font-medium';
                                  } else if (r.isBebas) {
                                    rowClass = 'bg-slate-50/40 text-slate-500';
                                  }

                                  return `
                                    <tr class="${rowClass}">
                                      <td class="py-2 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
                                      <td class="py-2 px-3 font-semibold text-slate-900">
                                        ${r.nama_lengkap}
                                        ${r.nomor_absen ? `<span class="text-[10px] text-slate-400 font-mono ml-1">#${r.nomor_absen}</span>` : ''}
                                      </td>
                                      <td class="py-2 px-3 text-center">
                                        ${r.catatanStatus === 'Selesai' ? `
                                          <span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">Selesai</span>
                                        ` : (r.catatanStatus === 'Belum Selesai' ? `
                                          <span class="bg-rose-100 text-rose-800 border border-rose-300 font-black px-2 py-0.5 rounded text-[10px]">Belum Selesai</span>
                                        ` : (r.catatanStatus === 'Bebas' ? `
                                          <span class="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2 py-0.5 rounded text-[10px]">Bebas</span>
                                        ` : `
                                          <span class="text-slate-400">-</span>
                                        `))}
                                      </td>
                                      <td class="py-2 px-3 text-center">
                                        ${r.nilaiStatus === 'Bebas' ? `
                                          <span class="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2 py-0.5 rounded text-[10px]">Bebas</span>
                                        ` : (r.nilaiStatus === 'Belum Dinilai' ? `
                                          <span class="bg-rose-100 text-rose-800 border border-rose-300 font-black px-2 py-0.5 rounded text-[10px]">Belum Dinilai</span>
                                        ` : (r.nilaiStatus !== '-' ? `
                                          <span class="font-extrabold ${r.isBelumSelesai ? 'text-rose-700' : 'text-emerald-700'}">${r.nilaiStatus}</span>
                                        ` : `
                                          <span class="text-slate-400">-</span>
                                        `))}
                                      </td>
                                      <td class="py-2 px-3 text-[11px] ${r.isBelumSelesai ? 'font-bold text-rose-800' : 'text-slate-600'}">
                                        ${r.keterangan || '-'}
                                      </td>
                                      <td class="py-2 px-3 text-center font-mono text-[11px] text-slate-500">
                                        ${r.tanggalFormatted}
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
                `)}

                <!-- Bagian 4: Ringkasan Akhir & Tanda Tangan Footer -->
                ${isFilterComplete && sessionGroups.length > 0 ? `
                  <div class="pt-4 border-t border-slate-200 space-y-6">
                    
                    <!-- Box Ringkasan Statistik -->
                    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span class="font-bold text-slate-700">Ringkasan Laporan:</span>
                        <p class="text-slate-600 mt-0.5">
                          Tercatat <strong>${targetSessions.length} sesi pertemuan</strong> dengan total <strong>${totalEntriesBelumSelesai} entri Belum Selesai</strong> yang membutuhkan tindak lanjut (Sesi berstatus Bebas tidak dihitung sebagai masalah).
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-lg font-bold ${totalEntriesBelumSelesai > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                          ${totalEntriesBelumSelesai} Belum Selesai
                        </span>
                      </div>
                    </div>

                    <!-- Tanda Tangan Formal -->
                    <div class="grid grid-cols-2 gap-6 text-xs pt-4">
                      <div class="text-center">
                        <p class="text-slate-500 mb-14">Mengetahui,<br>Kepala Sekolah / Wali Kelas</p>
                        <p class="font-bold text-slate-900 border-b border-slate-400 pb-0.5 inline-block min-w-44">${kepsekNama}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">${kepsekNip ? 'NIP. ' + kepsekNip : 'NIP. -'}</p>
                      </div>

                      <div class="text-center">
                        <p class="text-slate-500 mb-14">${kota}, ${printDateStr}<br>Guru Mata Pelajaran</p>
                        <p class="font-bold text-slate-900 border-b border-slate-400 pb-0.5 inline-block min-w-44">${guruNama}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">${guruNip ? 'NIP. ' + guruNip : 'NIP. -'}</p>
                      </div>
                    </div>

                  </div>
                ` : ''}

              </div>

            ` : `
              
              <!-- Tab 2: WhatsApp & PNG Quick Share View -->
              <div class="space-y-5 max-w-xl mx-auto">
                
                <!-- Visual Card Preview -->
                <div id="share-card-container" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-slate-800 space-y-4">
                  <div class="bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-4 rounded-xl space-y-1">
                    <div class="flex items-center justify-between text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                      <span>SMKN 1 BANTAENG</span>
                      <span>SIA-JURNAL</span>
                    </div>
                    <h2 class="text-sm sm:text-base font-black text-white">REKAP KETUNTASAN CATATAN & TUGAS</h2>
                    <div class="flex items-center gap-2 text-[11px] text-emerald-200/90 font-semibold pt-1">
                      <span>🏫 ${targetKelasNama || '-'}</span>
                      <span>•</span>
                      <span>📚 ${targetMapelNama || '-'}</span>
                    </div>
                  </div>

                  <div class="space-y-2 text-xs">
                    <div class="flex items-center justify-between font-bold text-slate-700 border-b border-slate-100 pb-2">
                      <span>Riwayat Tagihan Belum Selesai:</span>
                      <span class="text-rose-600">${totalEntriesBelumSelesai} Entri</span>
                    </div>

                    ${totalEntriesBelumSelesai === 0 ? `
                      <div class="text-center py-6 text-emerald-700 font-bold bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                        🎉 Luar Biasa! Seluruh siswa telah menuntaskan semua catatan & tugas pada periode ini.
                      </div>
                    ` : `
                      <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                        ${sessionGroups.map(group => {
                          const pendings = group.studentRows.filter(r => r.isBelumSelesai);
                          if (pendings.length === 0) return '';
                          return `
                            <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                              <div class="flex items-center justify-between text-slate-900 font-bold text-[11px]">
                                <span>📅 ${formatIndonesianDate(group.sesi.tanggal)}</span>
                                <span class="text-[10px] text-slate-500 font-normal truncate max-w-44">${group.sesi.judul}</span>
                              </div>
                              <div class="text-[11px] text-rose-700 font-semibold pl-3 border-l-2 border-rose-400 space-y-0.5">
                                ${pendings.map(p => `<div>• <strong>${p.nama_lengkap}</strong>: <span class="text-slate-500 font-normal">${p.keterangan}</span></div>`).join('')}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    `}
                  </div>

                  <div class="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span>📊 Total Pertemuan: ${targetSessions.length} Sesi</span>
                    <span class="${totalEntriesBelumSelesai > 0 ? 'text-rose-700' : 'text-emerald-700'} font-black">
                      ${totalEntriesBelumSelesai === 0 ? '✓ 100% Tuntas' : `⚠️ ${totalEntriesBelumSelesai} Perlu Tindak Lanjut`}
                    </span>
                  </div>
                </div>

                <!-- WhatsApp Plaintext Box -->
                <div class="bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
                  <div class="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span class="flex items-center gap-1.5">
                      <i data-lucide="message-square" class="w-3.5 h-3.5 text-emerald-600"></i>
                      <span>Teks Format WhatsApp (Preview)</span>
                    </span>
                    <button id="btn-copy-wa-inline" class="text-emerald-700 hover:text-emerald-800 text-xs font-bold underline">
                      Salin Teks
                    </button>
                  </div>

                  <textarea id="textarea-wa-content" readonly rows="7" class="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 leading-relaxed custom-scrollbar">${waText}</textarea>
                </div>

              </div>

            `}

          </div>

          <!-- Footer Modal -->
          <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span class="text-[11px] text-slate-400 hidden sm:inline">
              File: ${pdfFilename}
            </span>
            <button id="btn-close-share-footer" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition ml-auto">
              Tutup
            </button>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // =========================================================================
    // EVENT BINDINGS (SHADCN COMBOBOX & DATEPICKER INTEGRATION)
    // =========================================================================
    // 1. Close Modal
    modalContainer.querySelector('#btn-close-share-modal')?.addEventListener('click', onClose);
    modalContainer.querySelector('#btn-close-share-footer')?.addEventListener('click', onClose);

    // 2. Class Combobox
    initClassCombobox(modalContainer, {
      id: 'modal-select-kelas',
      kelasList: allMasterKelas,
      selectedId: selectedKelasId,
      allowAll: false,
      size: 'sm',
      onSelect: (newKId) => {
        selectedKelasId = newKId;
        renderModalContent();
      }
    });

    // 3. Mapel Combobox
    initMapelCombobox(modalContainer, {
      id: 'modal-select-mapel',
      mapelList: allMasterMapel,
      selectedValue: selectedMapel,
      allowAll: false,
      size: 'sm',
      allowManage: false,
      onSelect: (newMapel) => {
        selectedMapel = newMapel;
        renderModalContent();
      }
    });

    // 4. DatePicker Dari Tanggal & Sampai Tanggal
    initDatePicker(modalContainer, {
      id: 'modal-input-start-date',
      value: startDate,
      size: 'sm',
      onChange: (newDate) => {
        startDate = newDate;
        renderModalContent();
      }
    });

    initDatePicker(modalContainer, {
      id: 'modal-input-end-date',
      value: endDate,
      size: 'sm',
      onChange: (newDate) => {
        endDate = newDate;
        renderModalContent();
      }
    });

    // 5. Tab Switchers
    modalContainer.querySelector('#tab-btn-pdf')?.addEventListener('click', () => {
      modalActiveTab = 'pdf';
      renderModalContent();
    });

    modalContainer.querySelector('#tab-btn-wa')?.addEventListener('click', () => {
      modalActiveTab = 'wa';
      renderModalContent();
    });

    // 6. Salin Teks WhatsApp
    const handleCopyWA = () => {
      if (!isFilterComplete) {
        showToast('Pilih Kelas, Mata Pelajaran, dan Rentang Tanggal terlebih dahulu.', 'error');
        return;
      }
      navigator.clipboard.writeText(waText).then(() => {
        showToast('Teks rekap berhasil disalin ke clipboard! Siap dipaste ke grup WhatsApp.', 'success');
      }).catch(() => {
        const ta = modalContainer.querySelector('#textarea-wa-content');
        if (ta) {
          ta.select();
          document.execCommand('copy');
          showToast('Teks rekap berhasil disalin!', 'success');
        }
      });
    };
    modalContainer.querySelector('#btn-copy-wa-text')?.addEventListener('click', handleCopyWA);
    modalContainer.querySelector('#btn-copy-wa-inline')?.addEventListener('click', handleCopyWA);

    // 7. Unduh Gambar PNG (Canvas Render)
    modalContainer.querySelector('#btn-download-png-card')?.addEventListener('click', () => {
      if (!isFilterComplete) {
        showToast('Pilih Kelas, Mata Pelajaran, dan Rentang Tanggal terlebih dahulu.', 'error');
        return;
      }
      const cardEl = modalContainer.querySelector('#share-card-container');
      if (!cardEl) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const scale = 2; // high-DPI
      const width = 600;
      const height = Math.max(500, 260 + (sessionGroups.length * 80));

      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Header Banner
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#064e3b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 100);

      // Header Text
      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('SMKN 1 BANTAENG • SIA-JURNAL', 24, 28);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('REKAP KETUNTASAN CATATAN & TUGAS', 24, 52);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '11px sans-serif';
      ctx.fillText(`Kelas: ${targetKelasNama} | Mapel: ${targetMapelNama} (${startDate} s.d ${endDate})`, 24, 76);

      // Content Box
      let y = 130;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`Riwayat Tagihan Belum Selesai (${totalEntriesBelumSelesai} Entri):`, 24, y);
      y += 20;

      if (totalEntriesBelumSelesai === 0) {
        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('🎉 Seluruh siswa telah menuntaskan semua catatan & tugas!', 24, y + 20);
        y += 60;
      } else {
        sessionGroups.forEach(group => {
          const pendings = group.studentRows.filter(r => r.isBelumSelesai);
          if (pendings.length === 0) return;

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`📅 ${formatIndonesianDate(group.sesi.tanggal)} - ${group.sesi.judul}:`, 24, y);
          y += 16;

          pendings.slice(0, 8).forEach((p, idx) => {
            ctx.fillStyle = '#991b1b';
            ctx.font = '10px sans-serif';
            ctx.fillText(`  ${idx + 1}. ${p.nama_lengkap} (${p.keterangan})`, 24, y);
            y += 15;
          });
          y += 8;
        });
      }

      // Footer
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(20, height - 60, width - 40, 40);
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`Total Pertemuan: ${targetSessions.length} Sesi | Status: ${totalEntriesBelumSelesai === 0 ? '100% Tuntas' : `${totalEntriesBelumSelesai} Perlu Tindak Lanjut`}`, 32, height - 35);

      const link = document.createElement('a');
      link.download = `Rekap_${sanitizeFilename(targetKelasNama)}_${startDate}_${endDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Gambar rekap berhasil diunduh (PNG)!', 'success');
    });

    // 8. Cetak PDF via Browser Print Dialog (A4 Portrait Layout)
    modalContainer.querySelector('#btn-print-pdf-sheet')?.addEventListener('click', () => {
      if (!isFilterComplete) {
        showToast('Pilih Kelas, Mata Pelajaran, dan Rentang Tanggal terlebih dahulu.', 'error');
        return;
      }
      const sheet = modalContainer.querySelector('#printable-rekap-sheet');
      if (!sheet) return;

      const printWindow = window.open('', '_blank', 'width=950,height=800');
      if (!printWindow) {
        showToast('Popup blocker aktif. Izinkan popup untuk mencetak laporan.', 'error');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>${pdfFilename.replace('.pdf', '')}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4 portrait; margin: 12mm 10mm; }
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body class="bg-white p-4 font-sans text-slate-800 antialiased">
          ${sheet.outerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    });

    // 9. Unduh File PDF Langsung menggunakan jsPDF + AutoTable (Client-Side)
    modalContainer.querySelector('#btn-download-pdf')?.addEventListener('click', () => {
      if (!isFilterComplete) {
        showToast('Pilih Kelas, Mata Pelajaran, dan Rentang Tanggal terlebih dahulu.', 'error');
        return;
      }
      if (targetSessions.length === 0) {
        showToast('Tidak ada sesi yang ditemukan dalam rentang tanggal ini.', 'error');
        return;
      }

      if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Library jsPDF sedang dimuat. Gunakan tombol "Cetak PDF (A4)" sebagai alternatif.', 'info');
        modalContainer.querySelector('#btn-print-pdf-sheet')?.click();
        return;
      }

      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        let currentY = 14;

        // Header Dokumen Formal (Teks Bersih & Terpusat Sempurna)
        const textCenterX = pageWidth / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(schoolSettings.instansi_induk || 'PEMERINTAH PROVINSI SULAWESI SELATAN', textCenterX, currentY, { align: 'center' });
        currentY += 5;
        doc.setFontSize(11);
        doc.text(`${schoolSettings.dinas ? schoolSettings.dinas + ' • ' : ''}${schoolSettings.nama_sekolah || 'SMKN 1 BANTAENG'}`, textCenterX, currentY, { align: 'center' });
        currentY += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`${schoolSettings.alamat || ''} • Telp: ${schoolSettings.telepon || '-'} • Web: ${schoolSettings.website || '-'}`, textCenterX, currentY, { align: 'center' });
        currentY += 3;

        // Garis Pembatas Header
        doc.setLineWidth(0.5);
        doc.line(14, currentY, pageWidth - 14, currentY);
        currentY += 1;
        doc.setLineWidth(0.2);
        doc.line(14, currentY, pageWidth - 14, currentY);
        currentY += 6;

        // Judul Laporan
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('REKAPITULASI CATATAN & PENILAIAN TUGAS SISWA', pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Tahun Ajaran: ${currentYear}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        // Metadata Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`Kelas: ${targetKelasNama}`, 18, currentY + 5);
        doc.text(`Mata Pelajaran: ${targetMapelNama}`, 18, currentY + 10);
        doc.text(`Rentang: ${formatDateShort(startDate)} s.d ${formatDateShort(endDate)}`, 110, currentY + 5);
        doc.text(`Total Sesi: ${targetSessions.length} Pertemuan`, 110, currentY + 10);
        currentY += 18;

        // Render Tabel Per Sesi / Tanggal
        sessionGroups.forEach((group) => {
          const sesi = group.sesi;
          const subheaderText = `Tanggal: ${formatIndonesianDate(sesi.tanggal)} | ${sesi.judul} (${sesi.typeLabel}${sesi.kkm ? ` - KKM ${sesi.kkm}` : ''})`;

          // Cek sisa ruang halaman sebelum render tabel
          if (currentY > 240) {
            doc.addPage();
            currentY = 16;
          }

          // Sub-header band
          doc.setFillColor(241, 245, 249);
          doc.rect(14, currentY, pageWidth - 28, 6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(subheaderText, 17, currentY + 4.2);
          currentY += 7;

          const tableRows = group.studentRows.map((r, rIdx) => [
            String(rIdx + 1),
            r.nama_lengkap,
            r.catatanStatus,
            r.nilaiStatus,
            r.keterangan,
            r.tanggalFormatted
          ]);

          doc.autoTable({
            startY: currentY,
            head: [['No', 'Nama Siswa', 'Catatan', 'Nilai', 'Keterangan', 'Tanggal']],
            body: tableRows,
            theme: 'grid',
            margin: { left: 14, right: 14 },
            headStyles: {
              fillColor: [226, 232, 240],
              textColor: [30, 41, 59],
              fontSize: 7.5,
              fontStyle: 'bold',
              halign: 'center'
            },
            styles: {
              fontSize: 7,
              cellPadding: 1.8,
              valign: 'middle'
            },
            columnStyles: {
              0: { halign: 'center', cellWidth: 8 },
              1: { cellWidth: 50 },
              2: { halign: 'center', cellWidth: 22 },
              3: { halign: 'center', cellWidth: 22 },
              4: { cellWidth: 'auto' },
              5: { halign: 'center', cellWidth: 20 }
            },
            didParseCell: function(data) {
              if (data.section === 'body') {
                const rowObj = group.studentRows[data.row.index];
                if (rowObj) {
                  if (rowObj.isBelumSelesai) {
                    data.cell.styles.fillColor = [254, 242, 242]; // Soft Red Highlight
                    data.cell.styles.textColor = [153, 27, 27];
                  } else if (rowObj.isBebas) {
                    data.cell.styles.fillColor = [248, 250, 252]; // Neutral Gray
                    data.cell.styles.textColor = [100, 116, 139];
                  }
                }
              }
            }
          });

          currentY = doc.lastAutoTable.finalY + 8;
        });

        // Summary & Signature Block
        if (currentY > 230) {
          doc.addPage();
          currentY = 18;
        }

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, currentY, pageWidth - 28, 12, 2, 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`Ringkasan: ${targetSessions.length} sesi pertemuan | Total ${totalEntriesBelumSelesai} entri Belum Selesai (Sesi Bebas tidak dihitung).`, 18, currentY + 7);
        currentY += 20;

        // Signatures
        const col1X = 50;
        const col2X = pageWidth - 60;
        doc.setFontSize(8);
        doc.text('Mengetahui,\nKepala Sekolah / Wali Kelas', col1X, currentY, { align: 'center' });
        doc.text(`${kota}, ${printDateStr}\nGuru Mata Pelajaran`, col2X, currentY, { align: 'center' });

        currentY += 22;
        doc.setFont('helvetica', 'bold');
        doc.text(kepsekNama, col1X, currentY, { align: 'center' });
        doc.text(guruNama, col2X, currentY, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(kepsekNip ? `NIP. ${kepsekNip}` : 'NIP. -', col1X, currentY + 4, { align: 'center' });
        doc.text(guruNip ? `NIP. ${guruNip}` : 'NIP. -', col2X, currentY + 4, { align: 'center' });

        // Simpan File PDF
        doc.save(pdfFilename);
        showToast(`File PDF berhasil diunduh: ${pdfFilename}`, 'success');
      } catch (err) {
        console.error('Error generating PDF:', err);
        showToast('Gagal generate PDF langsung. Membuka dialog cetak browser...', 'error');
        modalContainer.querySelector('#btn-print-pdf-sheet')?.click();
      }
    });

  }

  await renderModalContent();
}
