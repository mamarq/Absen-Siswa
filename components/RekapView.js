import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
// components/RekapView.js - Modul Rekapitulasi & Statistik Kehadiran Siswa (F8)
import { db } from '../supabase-client.js';

export async function renderRekapView(container, state, onStateChange, showToast) {
  const currentYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const kelasList = await db.getKelasSaya(currentYear);

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
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> sehingga belum ada Rekap Presensi yang dapat ditampilkan.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Penentuan kelas aktif (Prioritas: state.rekapKelasId -> state.currentKelasId -> kelas pertama guru)
  const currentKelasId = (state.rekapKelasId && kelasList.some(k => k.id === state.rekapKelasId))
    ? state.rekapKelasId
    : (state.currentKelasId && kelasList.some(k => k.id === state.currentKelasId)
        ? state.currentKelasId
        : (kelasList[0]?.id || ''));

  // Ambil daftar mapel guru pada kelas terpilih
  const mapelList = await db.getMapelSaya(currentYear, currentKelasId);

  // Validasi mapel aktif (Pertahankan jika valid pada kelas aktif, jika tidak reset ke '')
  const currentMapel = (mapelList.some(m => m.nama_mapel === state.rekapMapel) ? state.rekapMapel : '');
  const startDate = state.rekapStartDate || '';
  const endDate = state.rekapEndDate || '';

  const selectedKelasObj = kelasList.find(k => k.id === currentKelasId);

  // Ambil data rekap kehadiran
  const rekapData = currentKelasId 
    ? await db.getRekapKehadiran(currentKelasId, currentMapel, startDate, endDate, currentYear)
    : { daftarSesi: [], siswaRekap: [], totalSesi: 0 };
  const { daftarSesi, siswaRekap, totalSesi } = rekapData;

  // Hitung rata-rata kelas
  let totalPersentase = 0;
  let totalAlfa = 0;
  siswaRekap.forEach(s => {
    totalPersentase += s.persentase;
    totalAlfa += s.alfa;
  });
  const avgKehadiran = siswaRekap.length > 0 ? Math.round(totalPersentase / siswaRekap.length) : 100;

  container.innerHTML = `
    <div class="space-y-5 pb-20 max-w-6xl mx-auto">
      
      <!-- Filter Card -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="font-bold text-slate-800 text-base sm:text-lg">Rekapitulasi Presensi</h2>
              <p class="text-xs text-slate-500">Analisis kehadiran siswa per kelas & persentase keaktifan</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-export-csv" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5 transition">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Ekspor CSV</span>
            </button>

            <button id="btn-print-rekap" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition transform active:scale-95">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas</label>
            ${renderClassComboboxHTML({
              id: 'rekap-select-kelas',
              kelasList,
              selectedId: currentKelasId,
              size: 'sm'
            })}
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
            ${renderMapelComboboxHTML({
              id: 'rekap-select-mapel',
              mapelList,
              selectedValue: currentMapel,
              allowAll: true,
              allLabel: 'Semua Mapel',
              size: 'sm',
              allowManage: false
            })}
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal Mulai</label>
            ${renderDatePickerHTML({
              id: 'rekap-start-date',
              value: startDate,
              size: 'sm'
            })}
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal Sampai</label>
            ${renderDatePickerHTML({
              id: 'rekap-end-date',
              value: endDate,
              size: 'sm'
            })}
          </div>
        </div>
      </div>

      <!-- Ringkasan Statistik Kelas -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Total Sesi Pertemuan</span>
          <p class="text-2xl font-black text-slate-800 mt-1">${totalSesi}</p>
          <span class="text-[11px] text-slate-400">Tercatat di sistem</span>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Rata-rata Kehadiran</span>
          <p class="text-2xl font-black ${avgKehadiran >= 85 ? 'text-emerald-600' : 'text-amber-600'} mt-1">${avgKehadiran}%</p>
          <span class="text-[11px] text-slate-400">Tingkat partisipasi</span>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Jumlah Siswa</span>
          <p class="text-2xl font-black text-slate-800 mt-1">${siswaRekap.length}</p>
          <span class="text-[11px] text-slate-400">Kelas ${selectedKelasObj?.nama_kelas || ''}</span>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <span class="text-xs font-semibold text-slate-500">Total Ketidakhadiran Alfa</span>
          <p class="text-2xl font-black ${totalAlfa > 0 ? 'text-rose-600' : 'text-emerald-600'} mt-1">${totalAlfa}</p>
          <span class="text-[11px] text-slate-400">Tanpa keterangan</span>
        </div>
      </div>

      <!-- Tabel Matriks Rekapitulasi -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-bold text-slate-800 text-sm">Daftar Rekap Siswa: ${selectedKelasObj?.nama_kelas || 'Kelas'}</h3>
          <span class="text-xs text-slate-400">Status: <strong class="text-emerald-600">H</strong>adir, <strong class="text-amber-600">S</strong>akit, <strong class="text-sky-600">I</strong>zin, <strong class="text-rose-600">A</strong>lfa</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left" id="table-rekap-data">
            <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th class="py-3 px-3 w-12 text-center">No</th>
                <th class="py-3 px-3 min-w-[180px]">Nama Lengkap</th>
                <th class="py-3 px-2 w-10 text-center text-emerald-700 bg-emerald-50/50">H</th>
                <th class="py-3 px-2 w-10 text-center text-amber-700 bg-amber-50/50">S</th>
                <th class="py-3 px-2 w-10 text-center text-sky-700 bg-sky-50/50">I</th>
                <th class="py-3 px-2 w-10 text-center text-rose-700 bg-rose-50/50">A</th>
                <th class="py-3 px-3 w-20 text-center">Persentase</th>

                <!-- Kolom per Sesi -->
                ${daftarSesi.map(sesi => `
                  <th class="py-3 px-2 min-w-[70px] text-center border-l border-slate-200 font-normal">
                    <div class="font-bold text-slate-700">${sesi.tanggal.slice(5)}</div>
                    <div class="text-[10px] text-slate-400 truncate">${sesi.mapel.slice(0, 8)}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${siswaRekap.length === 0 ? `
                <tr>
                  <td colspan="${7 + daftarSesi.length}" class="py-8 text-center text-slate-400">
                    Tidak ada data siswa atau data sesi untuk filter ini.
                  </td>
                </tr>
              ` : siswaRekap.map((item, idx) => {
                let badgePersenColor = 'bg-emerald-100 text-emerald-800';
                if (item.persentase < 75) badgePersenColor = 'bg-rose-100 text-rose-800';
                else if (item.persentase < 85) badgePersenColor = 'bg-amber-100 text-amber-800';

                return `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="py-2.5 px-3 text-center font-bold text-slate-500">${item.siswa.nomor_absen || (idx + 1)}</td>
                    <td class="py-2.5 px-3 font-semibold text-slate-800">${item.siswa.nama_lengkap}</td>
                    <td class="py-2.5 px-2 text-center font-bold text-emerald-700 bg-emerald-50/30">${item.hadir}</td>
                    <td class="py-2.5 px-2 text-center font-bold text-amber-600 bg-amber-50/30">${item.sakit}</td>
                    <td class="py-2.5 px-2 text-center font-bold text-sky-600 bg-sky-50/30">${item.izin}</td>
                    <td class="py-2.5 px-2 text-center font-bold text-rose-600 bg-rose-50/30">${item.alfa}</td>
                    <td class="py-2.5 px-3 text-center">
                      <span class="font-bold text-xs px-2 py-0.5 rounded-full ${badgePersenColor}">
                        ${item.persentase}%
                      </span>
                    </td>

                    <!-- Detail per Sesi -->
                    ${daftarSesi.map(sesi => {
                      const st = item.perSesi[sesi.id] || '-';
                      let cellColor = 'text-slate-300';
                      if (st === 'Hadir') cellColor = 'text-emerald-600 font-bold';
                      else if (st === 'Sakit') cellColor = 'text-amber-600 font-bold bg-amber-50';
                      else if (st === 'Izin') cellColor = 'text-sky-600 font-bold bg-sky-50';
                      else if (st === 'Alfa') cellColor = 'text-rose-600 font-black bg-rose-100';

                      return `
                        <td class="py-2.5 px-2 text-center border-l border-slate-100 ${cellColor}">
                          ${st === 'Hadir' ? 'H' : st === 'Sakit' ? 'S' : st === 'Izin' ? 'I' : st === 'Alfa' ? 'A' : '-'}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Bind Events & DatePickers
  const inpStart = container.querySelector('#rekap-start-date');
  const inpEnd = container.querySelector('#rekap-end-date');

  initDatePicker(container, {
    id: 'rekap-start-date',
    value: startDate,
    size: 'sm',
    onChange: (newDate) => {
      onStateChange({
        rekapKelasId: currentKelasId,
        rekapMapel: currentMapel,
        rekapStartDate: newDate,
        rekapEndDate: inpEnd?.value || endDate
      });
    }
  });

  initDatePicker(container, {
    id: 'rekap-end-date',
    value: endDate,
    size: 'sm',
    onChange: (newDate) => {
      onStateChange({
        rekapKelasId: currentKelasId,
        rekapMapel: currentMapel,
        rekapStartDate: inpStart?.value || startDate,
        rekapEndDate: newDate
      });
    }
  });

  initClassCombobox(container, {
    id: 'rekap-select-kelas',
    kelasList,
    selectedId: currentKelasId,
    size: 'sm',
    onSelect: async (newKId) => {
      // Refresh mapel guru pada kelas baru
      const newMapelList = await db.getMapelSaya(currentYear, newKId);
      const stillValid = newMapelList.some(m => m.nama_mapel === currentMapel);
      onStateChange({
        rekapKelasId: newKId,
        rekapMapel: stillValid ? currentMapel : '',
        rekapStartDate: inpStart?.value || startDate,
        rekapEndDate: inpEnd?.value || endDate
      });
    }
  });

  initMapelCombobox(container, {
    id: 'rekap-select-mapel',
    mapelList,
    selectedValue: currentMapel,
    allowAll: true,
    allLabel: 'Semua Mapel',
    size: 'sm',
    allowManage: false,
    onSelect: (newMapel) => {
      onStateChange({
        rekapKelasId: currentKelasId,
        rekapMapel: newMapel,
        rekapStartDate: inpStart?.value || startDate,
        rekapEndDate: inpEnd?.value || endDate
      });
    }
  });

  // Ekspor CSV
  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    if (siswaRekap.length === 0) {
      showToast('Tidak ada data rekap untuk diekspor', 'error');
      return;
    }

    let csv = `No,Nama Siswa,NISN,Jenis Kelamin,Hadir,Sakit,Izin,Alfa,Persentase Kehadiran\n`;
    siswaRekap.forEach((item, idx) => {
      csv += `"${item.siswa.nomor_absen || (idx + 1)}","${item.siswa.nama_lengkap}","${item.siswa.nisn || '-'}","${item.siswa.jenis_kelamin || '-'}","${item.hadir}","${item.sakit}","${item.izin}","${item.alfa}","${item.persentase}%"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Presensi_${selectedKelasObj?.nama_kelas || 'Kelas'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV berhasil diunduh!', 'success');
  });

  // Cetak Laporan Rekap
  container.querySelector('#btn-print-rekap')?.addEventListener('click', () => {
    const profil = db.getProfilGuru ? db.getProfilGuru() : {};
    const school = db.getSchoolSettings ? db.getSchoolSettings() : {};
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Rekap Presensi - ${selectedKelasObj?.nama_kelas || 'Kelas'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; position: relative; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #444; }
            .header h3 { margin: 3px 0 0; font-size: 16px; font-weight: bold; }
            .header p.address { margin: 3px 0 0; font-size: 10px; color: #666; }
            .header p.title { margin: 6px 0 0; font-size: 12px; font-weight: bold; }
            .meta { margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #444; padding: 5px 6px; }
            th { background: #f0f0f0; text-align: center; }
            .text-center { text-align: center; }
            .footer-sign { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; }
            .sign-col { text-align: center; width: 35%; }
            .sign-space { height: 60px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${school.logo_url ? `<img src="${school.logo_url}" style="position: absolute; left: 0; top: 0; width: 55px; height: 55px; object-fit: contain;">` : ''}
            <div style="${school.logo_url ? 'padding: 0 60px;' : ''}">
              <h2>${school.instansi_induk || 'PEMERINTAH PROVINSI SULAWESI SELATAN'}</h2>
              <h3>${school.dinas ? school.dinas + ' • ' : ''}${school.nama_sekolah || 'SMKN 1 BANTAENG'}</h3>
              <p class="address">${school.alamat || ''} ${school.telepon ? '• Telp: ' + school.telepon : ''} ${school.website ? '• Web: ' + school.website : ''}</p>
              <p class="title">Rekapitulasi Kehadiran Siswa • Mata Pelajaran: ${currentMapel || 'Semua Mapel'}</p>
            </div>
          </div>

          <div class="meta">
            <div>
              <strong>Kelas:</strong> ${selectedKelasObj?.nama_kelas || 'Kelas'} (${selectedKelasObj?.jurusan || 'TJKT'})<br>
              <strong>Guru Mapel:</strong> ${profil.nama_guru || 'Guru Mapel'}
            </div>
            <div style="text-align: right;">
              <strong>Total Sesi:</strong> ${totalSesi} Pertemuan<br>
              <strong>Rata-rata Kehadiran:</strong> ${avgKehadiran}%
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th>Nama Siswa</th>
                <th style="width: 30px;">L/P</th>
                <th style="width: 30px;">H</th>
                <th style="width: 30px;">S</th>
                <th style="width: 30px;">I</th>
                <th style="width: 30px;">A</th>
                <th style="width: 50px;">Persen</th>
              </tr>
            </thead>
            <tbody>
              ${siswaRekap.map((s, i) => `
                <tr>
                  <td class="text-center">${s.siswa.nomor_absen || (i + 1)}</td>
                  <td>${s.siswa.nama_lengkap}</td>
                  <td class="text-center">${s.siswa.jenis_kelamin || '-'}</td>
                  <td class="text-center">${s.hadir}</td>
                  <td class="text-center">${s.sakit}</td>
                  <td class="text-center">${s.izin}</td>
                  <td class="text-center">${s.alfa}</td>
                  <td class="text-center"><strong>${s.persentase}%</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-sign">
            <div class="sign-col">
              <p>Mengetahui,<br>Kepala Sekolah</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_kepsek || 'Kepala Sekolah'}</strong></u><br>${profil.nip_kepsek ? 'NIP. ' + profil.nip_kepsek : 'NIP. -'}</p>
            </div>
            <div class="sign-col">
              <p>${profil.kota || 'Bantaeng'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>Guru Mata Pelajaran</p>
              <div class="sign-space"></div>
              <p><u><strong>${profil.nama_guru || 'Guru Mapel'}</strong></u><br>${profil.nip_guru ? 'NIP. ' + profil.nip_guru : 'NIP. -'}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  });

  if (window.lucide) window.lucide.createIcons();
}
