import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderSiswaComboboxHTML, initSiswaCombobox, updateSiswaComboboxList } from './SiswaCombobox.js';
import { renderKategoriKegiatanComboboxHTML, initKategoriKegiatanCombobox } from './KategoriKegiatanCombobox.js';
// components/KegiatanView.js - Modul Catatan & Agenda Kegiatan Siswa
import { db } from '../supabase-client.js';

export async function renderKegiatanView(container, state, onStateChange, showToast) {
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
            Anda belum memiliki jadwal mengajar pada tahun ajaran <strong>${currentYear}</strong> sehingga belum ada Kegiatan Siswa yang dapat dikelola.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const allKegiatan = await db.getAllKegiatanSiswa(currentYear);
  
  // Penentuan kelas aktif (Prioritas: state.currentKelasId jika valid di kelasList, jika tidak gunakan kelas pertama guru)
  let selectedKelasId = (kelasList.some(k => k.id === state.currentKelasId)
    ? state.currentKelasId
    : (kelasList[0]?.id || ''));

  const siswaList = selectedKelasId ? await db.getSiswaByKelas(selectedKelasId) : [];
  let selectedSiswaId = siswaList[0]?.id || '';
  let selectedKategori = 'Catatan Positif / Prestasi';

  container.innerHTML = `
    <div class="space-y-6 pb-20 max-w-4xl mx-auto">
      
      <!-- Header Modul -->
      <div class="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/30">
            <i data-lucide="sparkles" class="w-6 h-6"></i>
          </div>
          <div>
            <h2 class="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Catatan & Kegiatan Siswa</h2>
            <p class="text-xs text-slate-600 dark:text-slate-400">Catatan bimbingan, dispensasi lomba, atau agenda khusus yang otomatis muncul sebagai badge di Modul Absen.</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Form Tambah Catatan Baru (1 Kolom) -->
        <div class="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Tambah Catatan Siswa</h3>
          </div>

          <!-- Filter Kelas untuk pilih siswa (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Kelas Siswa</label>
            ${renderClassComboboxHTML({
              id: 'kegiatan-form-kelas',
              kelasList,
              selectedId: selectedKelasId,
              size: 'sm'
            })}
          </div>

          <!-- Dropdown Siswa (Searchable Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Pilih Siswa <span class="text-rose-500">*</span></label>
            ${renderSiswaComboboxHTML({
              id: 'kegiatan-form-siswa',
              siswaList,
              selectedId: selectedSiswaId,
              placeholder: selectedKelasId ? 'Cari / Pilih Siswa...' : 'Pilih kelas terlebih dahulu...',
              size: 'sm'
            })}
          </div>

          <!-- Tanggal Kegiatan -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tanggal Berlaku <span class="text-rose-500">*</span></label>
            ${renderDatePickerHTML({
              id: 'kegiatan-form-tanggal',
              value: new Date().toISOString().split('T')[0],
              size: 'sm'
            })}
          </div>

          <!-- Kategori Catatan (Custom Badge Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Kategori Catatan</label>
            ${renderKategoriKegiatanComboboxHTML({
              id: 'kegiatan-form-kategori',
              selectedValue: selectedKategori,
              size: 'sm'
            })}
          </div>

          <!-- Judul / Agenda -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Judul / Agenda Singkat <span class="text-rose-500">*</span></label>
            <input type="text" id="kegiatan-form-judul" placeholder="Contoh: Latihan LKS IT Network" class="w-full text-xs font-bold p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500">
          </div>

          <!-- Keterangan Tambahan -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Keterangan / Rincian</label>
            <textarea id="kegiatan-form-keterangan" rows="3" placeholder="Rincian dispensasi, surat izin, materi remedial..." class="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"></textarea>
          </div>

          <button id="btn-save-kegiatan" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition transform active:scale-95">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Simpan Catatan Kegiatan</span>
          </button>
        </div>

        <!-- Daftar Log Catatan (2 Kolom) -->
        <div class="lg:col-span-2 space-y-3">
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="list-checks" class="w-4 h-4 text-slate-500 dark:text-slate-400"></i>
              <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Riwayat Catatan Kegiatan Siswa</h3>
            </div>
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              ${allKegiatan.length} Catatan
            </span>
          </div>

          <div class="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            ${allKegiatan.length === 0 ? `
              <div class="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800">
                <i data-lucide="sparkles" class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2"></i>
                <p class="text-sm font-medium">Belum ada catatan kegiatan siswa.</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Tambahkan catatan pada formulir di sebelah kiri.</p>
              </div>
            ` : allKegiatan.map(keg => {
              let badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700';
              const kat = (keg.kategori || '').toLowerCase();
              if (kat.includes('positif') || kat.includes('prestasi')) {
                badgeColor = 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700';
              } else if (kat.includes('pelanggaran') || kat.includes('perilaku')) {
                badgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700';
              } else if (kat.includes('bimbingan') || kat.includes('remedial')) {
                badgeColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700';
              } else if (kat.includes('dispensasi') || kat.includes('lomba')) {
                badgeColor = 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700';
              } else if (kat.includes('izin') || kat.includes('dinas')) {
                badgeColor = 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-700';
              }

              return `
                <div class="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-start justify-between gap-3">
                  <div class="space-y-1.5 flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">
                        ${keg.kategori}
                      </span>
                      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-0.5 text-slate-400"></i>
                        ${keg.tanggal}
                      </span>
                    </div>

                    <div>
                      <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">${keg.judul}</h4>
                      <p class="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                        <i data-lucide="user" class="w-3.5 h-3.5 inline mr-0.5"></i>
                        ${keg.siswa?.nama_lengkap || 'Siswa'}
                      </p>
                    </div>

                    ${keg.keterangan ? `
                      <p class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed">
                        ${keg.keterangan}
                      </p>
                    ` : ''}
                  </div>

                  <button class="btn-delete-kegiatan p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition" data-id="${keg.id}" title="Hapus catatan">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>

    </div>
  `;

  initDatePicker(container, {
    id: 'kegiatan-form-tanggal',
    value: new Date().toISOString().split('T')[0],
    size: 'sm'
  });

  // Inisialisasi ClassCombobox di Form Catatan Kegiatan
  initClassCombobox(container, {
    id: 'kegiatan-form-kelas',
    kelasList,
    selectedId: selectedKelasId,
    size: 'sm',
    onSelect: async (newKId) => {
      selectedKelasId = newKId;
      state.currentKelasId = newKId;
      const sList = await db.getSiswaByKelas(newKId);
      selectedSiswaId = sList[0]?.id || '';
      updateSiswaComboboxList(container, 'kegiatan-form-siswa', sList, selectedSiswaId);
    }
  });

  // Inisialisasi SiswaCombobox di Form Catatan Kegiatan
  initSiswaCombobox(container, {
    id: 'kegiatan-form-siswa',
    siswaList,
    selectedId: selectedSiswaId,
    size: 'sm',
    placeholder: selectedKelasId ? 'Cari / Pilih Siswa...' : 'Pilih kelas terlebih dahulu...',
    onSelect: (sId) => {
      selectedSiswaId = sId;
    }
  });

  // Inisialisasi KategoriKegiatanCombobox di Form Catatan Kegiatan
  initKategoriKegiatanCombobox(container, {
    id: 'kegiatan-form-kategori',
    selectedValue: selectedKategori,
    onSelect: (val) => {
      selectedKategori = val;
    }
  });

  // Event: Simpan Catatan Baru
  container.querySelector('#btn-save-kegiatan')?.addEventListener('click', async () => {
    const hiddenSiswa = container.querySelector('#kegiatan-form-siswa');
    const siswaId = selectedSiswaId || hiddenSiswa?.value;
    const tanggal = container.querySelector('#kegiatan-form-tanggal')?.value;
    const hiddenKat = container.querySelector('#kegiatan-form-kategori');
    const kategori = selectedKategori || hiddenKat?.value;
    const judul = container.querySelector('#kegiatan-form-judul')?.value?.trim();
    const keterangan = container.querySelector('#kegiatan-form-keterangan')?.value?.trim();

    if (!siswaId || !tanggal || !judul) {
      showToast('Harap lengkapi nama siswa, tanggal, dan judul kegiatan!', 'error');
      return;
    }

    await db.addKegiatanSiswa({
      siswa_id: siswaId,
      tanggal,
      kategori,
      judul,
      keterangan
    });

    showToast('Catatan kegiatan siswa berhasil ditambahkan!', 'success');
    renderKegiatanView(container, state, onStateChange, showToast);
  });

  // Event: Hapus Catatan
  container.querySelectorAll('.btn-delete-kegiatan').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Yakin ingin menghapus catatan kegiatan ini?')) {
        await db.deleteKegiatanSiswa(id);
        showToast('Catatan kegiatan dihapus', 'info');
        renderKegiatanView(container, state, onStateChange, showToast);
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}
