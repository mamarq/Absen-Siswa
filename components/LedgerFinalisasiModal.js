// components/LedgerFinalisasiModal.js - Modal Finalisasi Rapor & Riwayat Snapshot Rapor
import { db } from '../supabase-client.js';

export function openLedgerFinalisasiModal({
  kelasId,
  kelasNama,
  mapelId,
  mapelNama,
  academicYear,
  semester,
  calculatedData,
  onFinalized = () => {},
  showToast = () => {}
}) {
  let modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  }

  let activeTab = 'form'; // 'form' | 'history'

  async function render() {
    const historyList = await db.getLedgerFinalisasiList({
      kelas_id: kelasId,
      mapel: mapelNama,
      academic_year: academicYear
    });

    const hasMissing = calculatedData?.students?.some(s => s.has_missing_component);
    const defaultPeriodeNama = `Rapor Penilaian Akhir Semester ${semester || 'Ganjil'} ${academicYear}`;

    modalRoot.innerHTML = `
      <div id="modal-ledger-finalisasi" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full my-8 overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">

          <!-- Header -->
          <div class="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
                <i data-lucide="lock" class="w-5 h-5 text-indigo-300"></i>
              </div>
              <div>
                <h3 class="font-extrabold text-base sm:text-lg">Finalisasi & Kunci Rapor Semester</h3>
                <p class="text-xs text-indigo-200/90 font-medium">
                  ${kelasNama || 'Kelas'} • ${mapelNama || 'Mata Pelajaran'} • Semester ${semester}
                </p>
              </div>
            </div>
            <button id="btn-close-ledger-fin" class="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Subtab Headers -->
          <div class="flex items-center border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/80 dark:bg-slate-800/60 gap-2 flex-shrink-0">
            <button id="tab-btn-fin-form" class="px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 ${activeTab === 'form' ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 rounded-t-xl shadow-xs' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              <span>Finalisasi Rapor Saat Ini</span>
            </button>
            <button id="tab-btn-fin-history" class="px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 rounded-t-xl shadow-xs' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
              <i data-lucide="archive" class="w-4 h-4"></i>
              <span>Riwayat Snapshot Tersimpan (${historyList.length})</span>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs">

            ${activeTab === 'form' ? `

              <!-- Info Box -->
              <div class="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 space-y-2">
                <div class="flex items-center gap-2 font-bold text-sm text-indigo-900 dark:text-indigo-200">
                  <i data-lucide="info" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
                  <span>Apa itu Finalisasi Rapor?</span>
                </div>
                <p class="text-xs text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed">
                  Finalisasi akan <strong>membekukan (snapshot)</strong> seluruh nilai siswa, bobot formula, dan deskripsi capaian pada saat ini ke dalam arsip permanen. Data yang sudah difinalisasi tidak akan berubah meskipun di kemudian hari data absensi atau tugas diubah.
                </p>
              </div>

              ${hasMissing ? `
                <div class="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-3">
                  <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"></i>
                  <div class="text-xs space-y-1">
                    <span class="font-black block">Perhatian: Ada Komponen Nilai yang Belum Lengkap!</span>
                    <p class="text-amber-800 dark:text-amber-300">
                      Beberapa komponen penilaian aktif belum memiliki data (misal SAS/STS belum diisi). Jika difinalisasi sekarang, nilai akhir siswa akan dihitung secara proporsional dari komponen yang sudah ada saja.
                    </p>
                  </div>
                </div>
              ` : ''}

              <!-- Form Finalisasi -->
              <div class="space-y-4 pt-1">
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Judul / Nama Periode Rapor <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-fin-periode"
                    value="${defaultPeriodeNama}"
                    class="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-100"
                    placeholder="Contoh: Rapor Akhir Semester Ganjil 2026/2027"
                  >
                </div>

                <!-- Preview Statistics Summary -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div class="text-center">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Siswa</span>
                    <span class="text-base font-black text-slate-800 dark:text-slate-100">${calculatedData?.students?.length || 0}</span>
                  </div>
                  <div class="text-center">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Rata-Rata</span>
                    <span class="text-base font-black text-indigo-700 dark:text-indigo-400">${calculatedData?.summary?.avg_kelas || 0}</span>
                  </div>
                  <div class="text-center">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Tuntas</span>
                    <span class="text-base font-black text-emerald-700 dark:text-emerald-400">${calculatedData?.summary?.tuntas_count || 0} (${calculatedData?.summary?.tuntas_percent || 0}%)</span>
                  </div>
                  <div class="text-center">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Remedial</span>
                    <span class="text-base font-black text-rose-700 dark:text-rose-400">${calculatedData?.summary?.remedi_count || 0}</span>
                  </div>
                </div>

              </div>

            ` : `

              <!-- Riwayat Snapshot List -->
              <div class="space-y-3">
                ${historyList.length === 0 ? `
                  <div class="p-8 text-center text-slate-400 dark:text-slate-500 text-xs space-y-2">
                    <i data-lucide="archive" class="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600"></i>
                    <p class="font-bold">Belum ada riwayat snapshot rapor yang difinalisasi untuk kelas ini.</p>
                  </div>
                ` : historyList.map((item, idx) => {
                  const tglStr = new Date(item.finalized_at).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                  const countSiswa = (item.ledger_data || []).length;
                  return `
                    <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-600 transition">
                      <div class="space-y-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-extrabold text-[10px] border border-indigo-200 dark:border-indigo-800">
                            Semester ${item.semester}
                          </span>
                          <h5 class="font-extrabold text-slate-900 dark:text-white text-xs truncate">${item.periode_nama}</h5>
                        </div>
                        <p class="text-[10px] text-slate-400 dark:text-slate-500">
                          Difinalisasi: ${tglStr} • <strong>${countSiswa} Siswa</strong>
                        </p>
                      </div>

                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          class="btn-delete-snapshot p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition"
                          data-id="${item.id}"
                          title="Hapus Snapshot"
                        >
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

            `}

          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 gap-3">
            <button
              type="button"
              id="btn-cancel-ledger-fin"
              class="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition"
            >
              Tutup
            </button>

            ${activeTab === 'form' ? `
              <button
                type="button"
                id="btn-do-finalisasi"
                class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition flex items-center gap-2 active:scale-95"
              >
                <i data-lucide="lock" class="w-4 h-4"></i>
                <span>Kunci & Finalisasi Sekarang</span>
              </button>
            ` : ''}
          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Event handlers
    const modalEl = document.querySelector('#modal-ledger-finalisasi');

    function closeModal() {
      modalRoot.innerHTML = '';
    }

    modalEl.querySelector('#btn-close-ledger-fin')?.addEventListener('click', closeModal);
    modalEl.querySelector('#btn-cancel-ledger-fin')?.addEventListener('click', closeModal);

    modalEl.querySelector('#tab-btn-fin-form')?.addEventListener('click', () => {
      activeTab = 'form';
      render();
    });

    modalEl.querySelector('#tab-btn-fin-history')?.addEventListener('click', () => {
      activeTab = 'history';
      render();
    });

    // Finalize button handler
    modalEl.querySelector('#btn-do-finalisasi')?.addEventListener('click', async () => {
      const periode = modalEl.querySelector('#input-fin-periode')?.value?.trim() || defaultPeriodeNama;
      const btn = modalEl.querySelector('#btn-do-finalisasi');

      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Memproses...</span>`;
      if (window.lucide) window.lucide.createIcons();

      try {
        const saveRes = await db.saveLedgerFinalisasi({
          kelas_id: kelasId,
          mapel_id: mapelId,
          mapel: mapelNama,
          academic_year: academicYear,
          semester: semester || 'Ganjil',
          periode_nama: periode,
          config_snapshot: calculatedData.config,
          ledger_data: calculatedData.students
        });

        if (saveRes.success) {
          showToast('Rapor semester berhasil difinalisasi & dikunci permanen!', 'success');
          closeModal();
          onFinalized();
        } else {
          showToast('Gagal memfinalisasi rapor: ' + (saveRes.message || 'Terjadi kesalahan.'), 'error');
          btn.disabled = false;
          btn.innerHTML = `<i data-lucide="lock" class="w-4 h-4"></i><span>Kunci & Finalisasi Sekarang</span>`;
        }
      } catch (err) {
        showToast(err.message || 'Operasi ditolak', 'error');
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="lock" class="w-4 h-4"></i><span>Kunci & Finalisasi Sekarang</span>`;
      }
    });

    // Delete snapshot handler
    modalEl.querySelectorAll('.btn-delete-snapshot').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (!confirm('Apakah Anda yakin ingin menghapus arsip snapshot rapor ini?')) return;

        try {
          const res = await db.deleteLedgerFinalisasi(id);
          if (res.success) {
            showToast('Snapshot rapor berhasil dihapus', 'info');
            render();
          } else {
            showToast(res.message || 'Gagal menghapus snapshot', 'error');
          }
        } catch (err) {
          showToast(err.message || 'Operasi ditolak', 'error');
        }
      });
    });
  }

  render();
}
