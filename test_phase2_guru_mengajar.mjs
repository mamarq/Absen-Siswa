// test_phase2_guru_mengajar.mjs
import assert from 'node:assert';
import { db, STORAGE_KEYS } from './supabase-client.js';
import { INITIAL_DATA } from './data/initialData.js';

// Setup Mock DOM & LocalStorage Environment
const store = {};
globalThis.localStorage = {
  store,
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

globalThis.window = {
  innerWidth: 1024,
  location: { search: '', href: 'http://localhost:8085/' },
  history: { pushState: () => {} },
  supabase: null,
  lucide: { createIcons: () => {} }
};

globalThis.document = {
  getElementById: (id) => ({
    id,
    innerHTML: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {}
  }),
  createElement: (tag) => ({
    tagName: tag,
    className: '',
    innerHTML: '',
    style: {},
    appendChild: () => {},
    remove: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  })
};

async function runTests() {
  console.log('--- START TEST PHASE 2: GURU_MENGAJAR & DECOUPLED DATASTORE ---');

  // Reset demo / storage
  localStorage.clear();
  db.resetDemoData();

  const userA = { id: 'user-guru-a-uuid', email: 'guruA@sekolah.sch.id' };
  const userB = { id: 'user-guru-b-uuid', email: 'guruB@sekolah.sch.id' };

  // Helper to mock current user
  let activeUser = userA;
  db.getCurrentUser = async () => activeUser;

  const kelasX1 = 'k-tjkt-1';
  const kelasX2 = 'k-tjkt-2';
  const kelasDKV = 'k-dkv-1';

  // TEST 1: guru_mengajar ada + jadwal ada -> kelas/mapel berasal dari guru_mengajar
  console.log('Test 1: guru_mengajar ada + jadwal ada');
  const assignmentUserA = [
    {
      id: 'gm-1',
      user_id: userA.id,
      academic_year: '2026/2027',
      kelas_id: kelasX1,
      mapel_id: 'mp-2',
      mapel: 'Informatika',
      is_active: true
    },
    {
      id: 'gm-2',
      user_id: userA.id,
      academic_year: '2026/2027',
      kelas_id: kelasX2,
      mapel_id: 'mp-2',
      mapel: 'Informatika',
      is_active: true
    }
  ];
  localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify(assignmentUserA));

  // Jadwal diisi kelas yang berbeda (misal kelasDKV) untuk membuktikan getKelasSaya ambil dari guru_mengajar bukan jadwal
  const jadwalUserA = [
    {
      id: 'j-1',
      user_id: userA.id,
      academic_year: '2026/2027',
      hari: 'Senin',
      jam_mulai: '07:30:00',
      jam_selesai: '09:00:00',
      jumlah_jp: 2,
      jam_ke_label: 'Jam 1-2',
      kelas_id: kelasDKV,
      mapel_id: 'mp-1',
      mapel: 'Matematika'
    }
  ];
  localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(jadwalUserA));
  db._invalidateCache();

  const kelasSaya1 = await db.getKelasSaya('2026/2027');
  assert.strictEqual(kelasSaya1.length, 2, 'Harus ada 2 kelas dari penugasan guru_mengajar');
  assert.ok(kelasSaya1.some(k => k.id === kelasX1), 'Kelas X TJKT 1 harus ada');
  assert.ok(kelasSaya1.some(k => k.id === kelasX2), 'Kelas X TJKT 2 harus ada');
  assert.ok(!kelasSaya1.some(k => k.id === kelasDKV), 'Kelas DKV dari jadwal tidak boleh masuk karena guru_mengajar aktif');

  const mapelSaya1 = await db.getMapelSaya('2026/2027', kelasX1);
  assert.strictEqual(mapelSaya1.length, 1, 'Mapel harus ada 1 dari guru_mengajar');
  assert.strictEqual(mapelSaya1[0].nama_mapel, 'Informatika', 'Mapel harus Informatika');
  console.log('✓ PASS: Test 1');

  // TEST 2: guru_mengajar ada + jadwal KOSONG -> kelas/mapel tetap muncul
  console.log('Test 2: guru_mengajar ada + jadwal KOSONG');
  localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify([]));
  db._invalidateCache();

  const kelasSaya2 = await db.getKelasSaya('2026/2027');
  assert.strictEqual(kelasSaya2.length, 2, 'Kelas tetap muncul meskipun jadwal kosong');
  const mapelSaya2 = await db.getMapelSaya('2026/2027', kelasX1);
  assert.strictEqual(mapelSaya2.length, 1, 'Mapel tetap muncul meskipun jadwal kosong');
  console.log('✓ PASS: Test 2');

  // TEST 3: guru_mengajar KOSONG + jadwal ada -> fallback lama bekerja
  console.log('Test 3: guru_mengajar KOSONG + jadwal ada (Fallback)');
  localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(jadwalUserA));
  db._invalidateCache();

  const kelasSaya3 = await db.getKelasSaya('2026/2027');
  assert.strictEqual(kelasSaya3.length, 1, 'Harus fallback ke jadwal (1 kelas)');
  assert.strictEqual(kelasSaya3[0].id, kelasDKV, 'Kelas DKV dari jadwal harus muncul via fallback');

  const mapelSaya3 = await db.getMapelSaya('2026/2027', kelasDKV);
  assert.strictEqual(mapelSaya3.length, 1, 'Mapel fallback harus muncul');
  assert.strictEqual(mapelSaya3[0].nama_mapel, 'Matematika', 'Mapel fallback harus Matematika');
  console.log('✓ PASS: Test 3');

  // TEST 4: guru_mengajar KOSONG + jadwal KOSONG -> []
  console.log('Test 4: guru_mengajar KOSONG + jadwal KOSONG');
  localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify([]));
  db._invalidateCache();

  const kelasSaya4 = await db.getKelasSaya('2026/2027');
  assert.deepStrictEqual(kelasSaya4, [], 'Harus return array kosong');
  const mapelSaya4 = await db.getMapelSaya('2026/2027', kelasX1);
  assert.deepStrictEqual(mapelSaya4, [], 'Harus return array kosong');
  console.log('✓ PASS: Test 4');

  // TEST 5: assignment guru lain tidak terlihat (User Isolation)
  console.log('Test 5: Isolasi User');
  const multiUserAssignments = [
    {
      id: 'gm-user-a',
      user_id: userA.id,
      academic_year: '2026/2027',
      kelas_id: kelasX1,
      mapel_id: 'mp-2',
      mapel: 'Informatika',
      is_active: true
    },
    {
      id: 'gm-user-b',
      user_id: userB.id,
      academic_year: '2026/2027',
      kelas_id: kelasDKV,
      mapel_id: 'mp-5',
      mapel: 'Projek Kreatif dan Kewirausahaan',
      is_active: true
    }
  ];
  localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify(multiUserAssignments));

  // Cek untuk User A
  activeUser = userA;
  db._invalidateCache();
  const kelasA = await db.getKelasSaya('2026/2027');
  assert.strictEqual(kelasA.length, 1);
  assert.strictEqual(kelasA[0].id, kelasX1);

  // Cek untuk User B
  activeUser = userB;
  db._invalidateCache();
  const kelasB = await db.getKelasSaya('2026/2027');
  assert.strictEqual(kelasB.length, 1);
  assert.strictEqual(kelasB[0].id, kelasDKV);
  console.log('✓ PASS: Test 5');

  // TEST 6: assignment is_active = false tidak masuk dropdown aktif
  console.log('Test 6: is_active = false filter');
  activeUser = userA;
  const activeInactiveAssignments = [
    {
      id: 'gm-act',
      user_id: userA.id,
      academic_year: '2026/2027',
      kelas_id: kelasX1,
      mapel_id: 'mp-2',
      mapel: 'Informatika',
      is_active: true
    },
    {
      id: 'gm-inact',
      user_id: userA.id,
      academic_year: '2026/2027',
      kelas_id: kelasX2,
      mapel_id: 'mp-2',
      mapel: 'Informatika',
      is_active: false // Historis / Nonaktif
    }
  ];
  localStorage.setItem(STORAGE_KEYS.GURU_MENGAJAR, JSON.stringify(activeInactiveAssignments));
  db._invalidateCache();

  const kelasAktif = await db.getKelasSaya('2026/2027');
  assert.strictEqual(kelasAktif.length, 1, 'Hanya kelas aktif yang boleh muncul');
  assert.strictEqual(kelasAktif[0].id, kelasX1, 'Kelas aktif harus X TJKT 1');

  const mapelNonaktif = await db.getMapelSaya('2026/2027', kelasX2);
  assert.deepStrictEqual(mapelNonaktif, [], 'Mapel untuk kelas nonaktif harus kosong');
  console.log('✓ PASS: Test 6');

  // TEST 7: getJadwalHariIni tetap membaca jadwal_mengajar
  console.log('Test 7: getJadwalHariIni tetap membaca jadwal_mengajar');
  const testJadwalHariIni = [
    {
      id: 'j-senin-1',
      user_id: userA.id,
      academic_year: '2026/2027',
      hari: 'Senin',
      jam_mulai: '07:30:00',
      jam_selesai: '09:00:00',
      jumlah_jp: 2,
      jam_ke_label: 'Jam 1-2',
      kelas_id: kelasX1,
      mapel: 'Informatika'
    }
  ];
  localStorage.setItem(STORAGE_KEYS.JADWAL_MENGAJAR, JSON.stringify(testJadwalHariIni));
  db._invalidateCache();

  // Test tanggal hari Senin: 2026-10-12 (2026-10-12 adalah Senin)
  const jadwalHariIniResult = await db.getJadwalHariIni('2026/2027', '2026-10-12');
  assert.strictEqual(jadwalHariIniResult.hari, 'Senin');
  assert.strictEqual(jadwalHariIniResult.jadwalList.length, 1);
  assert.strictEqual(jadwalHariIniResult.jadwalList[0].jam_ke_label, 'Jam 1-2');
  console.log('✓ PASS: Test 7');

  // TEST 8 & 9: Komponen AbsenView dan JurnalView tidak rusak saat dipanggil
  console.log('Test 8 & 9: Validasi AbsenView & JurnalView rendering');
  const { renderAbsenView } = await import('./components/AbsenView.js');
  const { renderJurnalView } = await import('./components/JurnalView.js');

  const mockState = {
    currentKelasId: kelasX1,
    currentMapel: 'Informatika',
    selectedAcademicYear: '2026/2027',
    selectedDate: '2026-10-10'
  };

  const container = document.createElement('div');
  await renderAbsenView(container, mockState);
  assert.ok(container.innerHTML.length > 0, 'AbsenView harus ter-render tanpa exception');

  const containerJurnal = document.createElement('div');
  await renderJurnalView(containerJurnal, mockState);
  assert.ok(containerJurnal.innerHTML.length > 0, 'JurnalView harus ter-render tanpa exception');
  console.log('✓ PASS: Test 8 & 9');

  console.log('--- ALL 10 TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
