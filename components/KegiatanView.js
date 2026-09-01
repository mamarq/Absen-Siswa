import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
// components/KegiatanView.js - Modul Catatan & Agenda Kegiatan Siswa
import { db } from '../supabase-client.js';

export async function renderKegiatanView(container, state, onStateChange, showToast) {
  const currentYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const [kelasList, allKegiatan] = await Promise.all([
    db.getClassesByYear(currentYear, true),
    db.getAllKegiatanSiswa(currentYear)
  ]);
  
  let selectedKelasId = state.currentKelasId;
  if (!selectedKelasId || !kelasList.some(k => k.id === selectedKelasId)) {
    selectedKelasId = kelasList[0]?.id || '';
  }
  const siswaList = selectedKelasId ? await db.getSiswaByKelas(selectedKelasId) : [];

  container.innerHTML = `
    <div class="space-y-6 pb-20 max-w-4xl mx-auto">
      
      <!-- Header Modul -->
      <div class="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-amber-200/60">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/30">
            <i data-lucide="sparkles" class="w-6 h-6"></i>
          </div>
          <div>
            <h2 class="font-bold text-slate-800 text-lg sm:text-xl">Catatan & Kegiatan Siswa</h2>
            <p class="text-xs text-slate-600">Catatan bimbingan, dispensasi lomba, atau agenda khusus yang otomatis muncul sebagai badge di Modul Absen.</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Form Tambah Catatan Baru (1 Kolom) -->
        <div class="lg:col-span-1 bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
          <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
            <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600"></i>
            <h3 class="font-bold text-slate-800 text-sm">Tambah Catatan Siswa</h3>
          </div>

          <!-- Filter Kelas untuk pilih siswa (Shadcn Combobox) -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Kelas Siswa</label>
            ${renderClassComboboxHTML({
              id: 'kegiatan-form-kelas',
              kelasList,
              selectedId: selectedKelasId,
              size: 'sm'
            })}
          </div>

          <!-- Dropdown Siswa -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Pilih Siswa <span class="text-rose-500">*</span></label>
            <select id="kegiatan-form-siswa" class="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              ${siswaList.map(s => `
                <option value="${s.id}">No. ${s.nomor_absen || '-'} - ${s.nama_lengkap}</option>
              `).join('')}
            </select>
          </div>

          <!-- Tanggal Kegiatan -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal Berlaku <span class="text-rose-500">*</span></label>
            ${renderDatePickerHTML({
                  id: 'kegiatan-form-tanggal',
                  value: new Date().toISOString().split('T')[0],
                  size: 'sm'
                })}
          </div>

          <!-- Kategori -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Kategori Catatan</label>
            <select id="kegiatan-form-kategori" class="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <option value="Catatan Positif / Prestasi">🌟 Catatan Positif / Prestasi</option>
              <option value="Catatan Perilaku / Pelanggaran">⚠️ Catatan Perilaku / Pelanggaran</option>
              <option value="Bimbingan / Remedial">📘 Bimbingan / Remedial</option>
              <option value="Dispensasi / Lomba">🏆 Dispensasi / Lomba</option>
              <option value="Izin Khusus / Dinas Luar">📄 Izin Khusus / Dinas Luar</option>
              <option value="Lainnya">📌 Catatan Lainnya</option>
            </select>
          </div>

          <!-- Judul / Agenda -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Judul / Agenda Singkat <span class="text-rose-500">*</span></label>
            <input type="text" id="kegiatan-form-judul" placeholder="Contoh: Latihan LKS IT Network" class="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none">
          </div>

          <!-- Keterangan Tambahan -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Keterangan / Rincian</label>
            <textarea id="kegiatan-form-keterangan" rows="3" placeholder="Rincian dispensasi, surat izin, materi remedial..." class="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"></textarea>
          </div>

          <button id="btn-save-kegiatan" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition transform active:scale-95">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Simpan Catatan Kegiatan</span>
          </button>
        </div>

        <!-- Daftar Log Catatan (2 Kolom) -->
        <div class="lg:col-span-2 space-y-3">
          <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="list-checks" class="w-4 h-4 text-slate-500"></i>
              <h3 class="font-bold text-slate-800 text-sm">Riwayat Catatan Kegiatan Siswa</h3>
            </div>
            <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              ${allKegiatan.length} Catatan
            </span>
          </div>

          <div class="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            ${allKegiatan.length === 0 ? `
              <div class="bg-white rounded-2xl p-8 text-center text-slate-400 border border-dashed border-slate-200">
                <i data-lucide="sparkles" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
                <p class="text-sm font-medium">Belum ada catatan kegiatan siswa.</p>
                <p class="text-xs text-slate-400 mt-1">Tambahkan catatan pada formulir di sebelah kiri.</p>
              </div>
            ` : allKegiatan.map(keg => {
              let badgeColor = 'bg-slate-100 text-slate-800 border-slate-300';
              const kat = (keg.kategori || '').toLowerCase();
              if (kat.includes('positif') || kat.includes('prestasi')) {
                badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
              } else if (kat.includes('pelanggaran') || kat.includes('perilaku')) {
                badgeColor = 'bg-rose-100 text-rose-900 border-rose-300';
              } else if (kat.includes('bimbingan') || kat.includes('remedial')) {
                badgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
              } else if (kat.includes('dispensasi') || kat.includes('lomba')) {
                badgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
              } else if (kat.includes('izin') || kat.includes('dinas')) {
                badgeColor = 'bg-sky-100 text-sky-900 border-sky-300';
              }

              return `
                <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:border-slate-300 transition flex items-start justify-between gap-3">
                  <div class="space-y-1.5 flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">
                        ${keg.kategori}
                      </span>
                      <span class="text-xs font-semibold text-slate-500">
                        <i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-0.5 text-slate-400"></i>
                        ${keg.tanggal}
                      </span>
                    </div>

                    <div>
                      <h4 class="font-bold text-slate-800 text-sm">${keg.judul}</h4>
                      <p class="text-xs text-emerald-700 font-semibold mt-0.5">
                        <i data-lucide="user" class="w-3.5 h-3.5 inline mr-0.5"></i>
                        ${keg.siswa?.nama_lengkap || 'Siswa'}
                      </p>
                    </div>

                    ${keg.keterangan ? `
                      <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        ${keg.keterangan}
                      </p>
                    ` : ''}
                  </div>

                  <button class="btn-delete-kegiatan p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" data-id="${keg.id}" title="Hapus catatan">
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
      const sList = await db.getSiswaByKelas(newKId);
      const formSiswa = container.querySelector('#kegiatan-form-siswa');
      if (formSiswa) {
        formSiswa.innerHTML = sList.length === 0 ? '<option value="">Belum ada siswa di kelas ini</option>' : sList.map(s => `
          <option value="${s.id}">No. ${s.nomor_absen || '-'} - ${s.nama_lengkap}</option>
        `).join('');
      }
    }
  });

  // Event: Ganti Kelas di Form Tambah Catatan
  const formKelas = container.querySelector('#kegiatan-form-kelas');
  formKelas?.addEventListener('change', async () => {
    const kId = formKelas.value;
    const sList = await db.getSiswaByKelas(kId);
    const formSiswa = container.querySelector('#kegiatan-form-siswa');
    if (formSiswa) {
      formSiswa.innerHTML = sList.map(s => `
        <option value="${s.id}">No. ${s.nomor_absen || '-'} - ${s.nama_lengkap}</option>
      `).join('');
    }
  });

  // Event: Simpan Catatan Baru
  container.querySelector('#btn-save-kegiatan')?.addEventListener('click', async () => {
    const siswaId = container.querySelector('#kegiatan-form-siswa').value;
    const tanggal = container.querySelector('#kegiatan-form-tanggal').value;
    const kategori = container.querySelector('#kegiatan-form-kategori').value;
    const judul = container.querySelector('#kegiatan-form-judul').value.trim();
    const keterangan = container.querySelector('#kegiatan-form-keterangan').value.trim();

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
