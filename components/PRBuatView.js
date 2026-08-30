// components/PRBuatView.js - Form Pembuatan Penugasan Pekerjaan Rumah (PR)
import { db } from '../supabase-client.js';
import { renderClassComboboxHTML, initClassCombobox } from './ClassCombobox.js';
import { renderMapelComboboxHTML, initMapelCombobox } from './MapelCombobox.js';
import { renderDatePickerHTML, initDatePicker } from './DatePicker.js';

export async function renderPRBuatView(container, state, onNavigate, showToast) {
  const currentAcademicYear = state.selectedAcademicYear || await db.getActiveAcademicYear();
  const classList = await db.getClassesByYear(currentAcademicYear, true);
  const mapelList = await db.getMataPelajaran();

  if (classList.length === 0) {
    container.innerHTML = `
      <div class="p-6 max-w-4xl mx-auto space-y-4 animate-in fade-in duration-150">
        <div class="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>
          <h3 class="text-base font-bold text-amber-900">Belum Ada Kelas di Tahun Ajaran ${currentAcademicYear}</h3>
          <p class="text-xs text-amber-700 max-w-md mx-auto">
            Silakan tambahkan data kelas terlebih dahulu di menu <strong>Data Master Kelas & Siswa</strong> sebelum membuat penugasan PR.
          </p>
          <button id="btn-goto-master-kelas" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs">
            Buka Data Master Kelas
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    container.querySelector('#btn-goto-master-kelas')?.addEventListener('click', () => onNavigate('siswa'));
    return;
  }

  let selectedClassId = state.selectedClass || classList[0]?.id;
  let selectedMapelId = mapelList[0]?.id || null;
  let selectedTanggal = state.selectedDate || new Date().toISOString().split('T')[0];

  // Helper untuk mendapatkan jumlah siswa aktif di kelas terpilih
  async function getStudentCount(kId) {
    const students = await db.getSiswaByKelas(kId, true);
    return students.length;
  }

  let studentCount = await getStudentCount(selectedClassId);
  const selectedClassObj = classList.find(k => k.id === selectedClassId) || classList[0];

  container.innerHTML = `
    <div class="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0">
            <i data-lucide="home" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Buat Pekerjaan Rumah (PR)</h2>
              <span class="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold text-[10px] uppercase tracking-wider">
                Tahap 1
              </span>
            </div>
            <p class="text-xs text-slate-500">
              Catat penugasan PR hari ini. Status PR akan <strong>"Menunggu Diperiksa"</strong> sampai guru menginput nilai di pekan berikutnya.
            </p>
          </div>
        </div>

        <button id="btn-view-pr-list" class="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs">
          <i data-lucide="list-checks" class="w-4 h-4"></i>
          <span>Daftar Pemeriksaan PR</span>
        </button>
      </div>

      <!-- Main Form Card -->
      <div class="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xl space-y-6">
        
        <form id="form-buat-pr" class="space-y-5">
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <!-- Pilihan Kelas -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">
                Kelas / Rombel <span class="text-rose-500">*</span>
              </label>
              ${renderClassComboboxHTML({
                id: 'pr-input-kelas',
                kelasList: classList,
                selectedId: selectedClassId,
                placeholder: 'Pilih Kelas...'
              })}
              <div id="pr-student-count-badge" class="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium pt-0.5">
                <i data-lucide="users" class="w-3.5 h-3.5 text-purple-600"></i>
                <span><strong id="pr-student-count-text" class="text-slate-800 font-bold">${studentCount}</strong> siswa aktif di kelas ini</span>
              </div>
            </div>

            <!-- Pilihan Mata Pelajaran -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">
                Mata Pelajaran <span class="text-rose-500">*</span>
              </label>
              ${renderMapelComboboxHTML({
                id: 'pr-input-mapel',
                mapelList: mapelList,
                selectedValue: mapelList[0]?.nama_mapel || '',
                placeholder: 'Pilih Mata Pelajaran...'
              })}
              <p class="text-[10px] text-slate-400">Pilih mata pelajaran penugasan PR</p>
            </div>
          </div>

          <!-- Pilihan Tanggal Diberikan -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700">
              Tanggal Diberikan <span class="text-rose-500">*</span>
            </label>
            <div class="max-w-xs">
              ${renderDatePickerHTML({
                id: 'pr-input-tanggal',
                value: selectedTanggal,
                placeholder: 'Pilih tanggal pemberian...'
              })}
            </div>
            <p class="text-[10px] text-slate-400">Default: Hari ini saat PR diumumkan ke murid</p>
          </div>

          <!-- Topik / Soal PR -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700">
              Topik / Materi / Instruksi Soal PR <span class="text-rose-500">*</span>
            </label>
            <textarea 
              id="pr-input-topik" 
              required 
              rows="3" 
              placeholder="Contoh: Latihan Soal Bab 3 Halaman 45 Nomor 1-10 (Buku Paket Informatika)" 
              class="w-full p-3.5 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition resize-none leading-relaxed"
            ></textarea>
          </div>

          <!-- Highlight Info Box -->
          <div class="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl flex items-start gap-3">
            <div class="p-2 bg-purple-600 text-white rounded-xl flex-shrink-0 mt-0.5">
              <i data-lucide="info" class="w-4 h-4"></i>
            </div>
            <div class="text-xs space-y-1">
              <h4 class="font-bold text-purple-900">Siklus 2 Tahap Pekerjaan Rumah</h4>
              <p class="text-[11px] text-purple-700 leading-relaxed">
                Saat tombol <strong>"Simpan & Jadwalkan PR"</strong> ditekan, sistem akan otomatis menyiapkan lembar penilaian kosong untuk seluruh siswa di kelas ini. PR akan berstatus <strong>"Menunggu Diperiksa"</strong> hingga guru memeriksa dan menginput nilai siswa.
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button 
              type="button" 
              id="btn-cancel-pr" 
              class="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Batal
            </button>
            <button 
              type="submit" 
              id="btn-submit-pr" 
              class="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-100 transition flex items-center justify-center gap-2"
            >
              <i data-lucide="send" class="w-4 h-4"></i>
              <span>Simpan & Jadwalkan PR</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // ===========================================================================
  // INITIALIZE COMBOBOXES & DATEPICKER
  // ===========================================================================

  initClassCombobox(container, {
    id: 'pr-input-kelas',
    kelasList: classList,
    selectedId: selectedClassId,
    onSelect: async (classId) => {
      selectedClassId = classId;
      studentCount = await getStudentCount(classId);
      const countEl = container.querySelector('#pr-student-count-text');
      if (countEl) countEl.textContent = studentCount;
    }
  });

  initMapelCombobox(container, {
    id: 'pr-input-mapel',
    mapelList: mapelList,
    selectedValue: mapelList[0]?.nama_mapel || '',
    onSelect: (mapelName) => {
      const found = mapelList.find(m => m.nama_mapel === mapelName);
      selectedMapelId = found?.id || null;
    }
  });

  initDatePicker(container, {
    id: 'pr-input-tanggal',
    value: selectedTanggal,
    onSelect: (dateStr) => {
      selectedTanggal = dateStr;
    }
  });

  // ===========================================================================
  // EVENT LISTENERS
  // ===========================================================================

  container.querySelector('#btn-view-pr-list')?.addEventListener('click', () => onNavigate('pr-periksa'));
  container.querySelector('#btn-cancel-pr')?.addEventListener('click', () => onNavigate('pr-periksa'));

  container.querySelector('#form-buat-pr')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const topik = container.querySelector('#pr-input-topik').value.trim();

    if (!selectedClassId) {
      showToast('Pilih kelas terlebih dahulu!', 'error');
      return;
    }
    if (!topik) {
      showToast('Topik atau materi PR wajib diisi!', 'error');
      return;
    }

    const btnSubmit = container.querySelector('#btn-submit-pr');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `
      <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
      <span>Menyimpan...</span>
    `;
    if (window.lucide) window.lucide.createIcons();

    try {
      const res = await db.createPR({
        kelas_id: selectedClassId,
        mapel_id: selectedMapelId,
        topik: topik,
        tanggal_diberikan: selectedTanggal,
        academic_year: currentAcademicYear
      });

      if (res.success) {
        showToast('Pekerjaan Rumah (PR) berhasil dibuat!', 'success');
        onNavigate('pr-periksa', { prId: res.id });
      } else {
        showToast('Gagal membuat PR: ' + (res.error || 'Terjadi kesalahan'), 'error');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
          <i data-lucide="send" class="w-4 h-4"></i>
          <span>Simpan & Jadwalkan PR</span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `
        <i data-lucide="send" class="w-4 h-4"></i>
        <span>Simpan & Jadwalkan PR</span>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  });
}
