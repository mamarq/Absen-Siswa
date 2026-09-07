// components/RiwayatView.js - Modul Riwayat Sesi Mengajar (F7)
import { db } from '../supabase-client.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';

export async function renderRiwayatView(container, state, onStateChange, showToast, onEditSesi, onOpenJurnalSesi) {
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
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> sehingga belum ada Riwayat Sesi yang dapat ditampilkan.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Validasi filter kelas: tetap '' jika Semua Kelas, atau pastikan ID kelas valid dalam kelasList
  const filterKelas = (kelasList.some(k => k.id === state.riwayatFilterKelas) ? state.riwayatFilterKelas : '');

  // Ambil mapel milik user (jika kelas kosong -> seluruh mapel guru, jika kelas terpilih -> mapel guru pada kelas tersebut)
  const mapelList = await db.getMapelSaya(currentYear, filterKelas || null);

  // Validasi filter mapel: tetap '' jika Semua Mapel, atau pastikan nama mapel valid dalam mapelList
  const filterMapel = (mapelList.some(m => m.nama_mapel === state.riwayatFilterMapel) ? state.riwayatFilterMapel : '');

  // Ambil data sesi mengajar milik user aktif pada tahun ajaran
  const allSesi = await db.getAllSesi(currentYear);

  const filteredList = allSesi.filter(sesi => {
    const matchK = !filterKelas || sesi.kelas_id === filterKelas;
    const matchM = !filterMapel || sesi.mapel === filterMapel;
    return matchK && matchM;
  });

  container.innerHTML = `
    <div class="space-y-4 pb-20 max-w-4xl mx-auto">
      
      <!-- Header & Filter Bar -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <i data-lucide="history" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="font-bold text-slate-800 text-base sm:text-lg">Riwayat Sesi Mengajar</h2>
              <p class="text-xs text-slate-500">Daftar sesi absensi & jurnal yang telah tersimpan</p>
            </div>
          </div>

          <span class="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            Total: <strong>${filteredList.length}</strong> Sesi
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Filter Kelas</label>
            ${renderClassComboboxHTML({
              id: 'filter-riwayat-kelas',
              kelasList,
              selectedId: filterKelas,
              allowAll: true,
              allLabel: 'Semua Kelas',
              size: 'sm'
            })}
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Filter Mata Pelajaran</label>
            ${renderMapelComboboxHTML({
              id: 'filter-riwayat-mapel',
              mapelList,
              selectedValue: filterMapel,
              allowAll: true,
              allLabel: 'Semua Mata Pelajaran',
              size: 'sm',
              allowManage: false
            })}
          </div>
        </div>
      </div>

      <!-- List Sesi Mengajar: TAMPILAN TABEL/LIST RINGKAS -->
      <div class="space-y-3">
        ${filteredList.length === 0 ? `
          <div class="bg-white rounded-2xl p-10 text-center text-slate-400 border border-dashed border-slate-200">
            <i data-lucide="folder-x" class="w-12 h-12 mx-auto text-slate-300 mb-2"></i>
            <p class="text-sm font-medium">Belum ada riwayat sesi mengajar tersimpan.</p>
            <p class="text-xs text-slate-400 mt-1">Buka tab "Absen Siswa" untuk memulai dan menyimpan sesi pertama Anda.</p>
          </div>
        ` : `
          <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100">
            
            <!-- Table Header -->
            <div class="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100/90 text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b-2 border-slate-200">
              <div class="col-span-3">Tanggal & Kelas</div>
              <div class="col-span-4">Mata Pelajaran & Materi Jurnal</div>
              <div class="col-span-3 text-left">Kehadiran Siswa</div>
              <div class="col-span-2 text-right">Aksi</div>
            </div>

            <!-- Rows -->
            ${filteredList.map(sesi => {
              let h = 0, s = 0, i = 0, a = 0;
              if (sesi.absensi) {
                sesi.absensi.forEach(x => {
                  if (x.status === 'Hadir') h++;
                  else if (x.status === 'Sakit') s++;
                  else if (x.status === 'Izin') i++;
                  else if (x.status === 'Alfa') a++;
                });
              }
              const totalSiswa = (sesi.absensi || []).length;
              const materi = sesi.jurnal_mengajar?.materi_pokok;
              const hasAlfa = a > 0;
              const rowBorderClass = hasAlfa ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-emerald-500';

              return `
                <div class="session-item-row group ${rowBorderClass} transition hover:bg-slate-50/70 p-3 sm:px-4 sm:py-3 flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center gap-2.5">
                  
                  <!-- 1. Tanggal & Kelas -->
                  <div class="md:col-span-3 flex items-center justify-between md:flex-col md:items-start gap-1">
                    <div class="flex items-center gap-1.5">
                      <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                      <span class="text-xs font-bold text-slate-800">${sesi.tanggal}</span>
                    </div>
                    <span class="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                      ${sesi.kelas?.nama_kelas || 'Kelas'}
                    </span>
                  </div>

                  <!-- 2. Mata Pelajaran & Materi -->
                  <div class="md:col-span-4 min-w-0">
                    <div class="text-xs text-slate-500 font-semibold mb-0.5 truncate">
                      ${sesi.mapel}
                    </div>
                    <h4 class="font-bold text-slate-800 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition" title="${materi || 'Jurnal belum diisi'}">
                      ${materi || '<span class="italic text-slate-400 font-normal">Jurnal belum diisi</span>'}
                    </h4>
                  </div>

                  <!-- 3. Stat Kehadiran -->
                  <div class="md:col-span-3 flex items-center gap-1 flex-wrap">
                    <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">H: ${h}</span>
                    ${s > 0 ? `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">S: ${s}</span>` : ''}
                    ${i > 0 ? `<span class="bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">I: ${i}</span>` : ''}
                    ${a > 0 ? `<span class="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md text-[11px] font-bold">A: ${a}</span>` : ''}
                    <span class="text-slate-400 text-[10px]">(${totalSiswa} siswa)</span>
                  </div>

                  <!-- 4. Kolom Aksi -->
                  <div class="md:col-span-2 flex items-center justify-end gap-1 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <button class="btn-open-jurnal-sesi p-1.5 text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition" data-sesi='${JSON.stringify(sesi).replace(/'/g, "&apos;")}' title="Lihat Jurnal">
                      <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="btn-edit-sesi p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition" data-sesi='${JSON.stringify(sesi).replace(/'/g, "&apos;")}' title="Buka / Edit Absensi">
                      <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="btn-delete-sesi p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition" data-sesi-id="${sesi.id}" title="Hapus Sesi">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

    </div>
  `;

  // Bind Events Filter
  initClassCombobox(container, {
    id: 'filter-riwayat-kelas',
    kelasList,
    selectedId: filterKelas,
    allowAll: true,
    allLabel: 'Semua Kelas',
    onSelect: async (newKId) => {
      // Refresh mapel guru berdasarkan kelas baru (atau seluruh mapel guru jika Semua Kelas)
      const newMapelList = await db.getMapelSaya(currentYear, newKId || null);
      const stillValid = newMapelList.some(m => m.nama_mapel === filterMapel);
      onStateChange({
        riwayatFilterKelas: newKId,
        riwayatFilterMapel: stillValid ? filterMapel : ''
      });
    }
  });

  initMapelCombobox(container, {
    id: 'filter-riwayat-mapel',
    mapelList,
    selectedValue: filterMapel,
    allowAll: true,
    allLabel: 'Semua Mata Pelajaran',
    size: 'sm',
    allowManage: false,
    onSelect: (newMapel) => {
      onStateChange({ riwayatFilterMapel: newMapel });
    }
  });

  const filKelas = container.querySelector('#filter-riwayat-kelas');

  // Event: Edit Absensi Sesi
  container.querySelectorAll('.btn-edit-sesi').forEach(btn => {
    btn.addEventListener('click', () => {
      const raw = btn.getAttribute('data-sesi');
      if (raw) {
        const sesi = JSON.parse(raw);
        onEditSesi(sesi);
      }
    });
  });

  // Event: Buka Jurnal Sesi
  container.querySelectorAll('.btn-open-jurnal-sesi').forEach(btn => {
    btn.addEventListener('click', () => {
      const raw = btn.getAttribute('data-sesi');
      if (raw) {
        const sesi = JSON.parse(raw);
        onOpenJurnalSesi(sesi);
      }
    });
  });

  // Event: Hapus Sesi
  container.querySelectorAll('.btn-delete-sesi').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-sesi-id');
      if (id && confirm('Apakah Anda yakin ingin menghapus sesi mengajar ini beserta data absensinya?')) {
        await db.deleteSesi(id);
        showToast('Sesi mengajar berhasil dihapus', 'info');
        renderRiwayatView(container, state, onStateChange, showToast, onEditSesi, onOpenJurnalSesi);
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}
