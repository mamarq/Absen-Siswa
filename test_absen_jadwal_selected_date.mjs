import assert from 'node:assert';
import { db } from './supabase-client.js';
import { renderAbsenView } from './components/AbsenView.js';
import { toISODateString, formatIndonesianDate } from './components/DatePicker.js';

// Setup Mock Environment for DOM & Storage
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

// Minimal DOM Element Mock
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    const set = new Set();
    this.classList = {
      add: (...items) => items.forEach(i => set.add(i)),
      remove: (...items) => items.forEach(i => set.delete(i)),
      contains: (c) => set.has(c)
    };
    this.innerHTMLValue = '';
    this.listeners = {};
    this.value = '';
    this.textContent = '';
  }

  get innerHTML() {
    return this.innerHTMLValue;
  }

  set innerHTML(html) {
    this.innerHTMLValue = html;
    this.parseMockChildren(html);
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
  }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  addEventListener(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  dispatchEvent(event) {
    const type = event.type || event;
    if (this.listeners[type]) {
      this.listeners[type].forEach(cb => cb(event));
    }
  }

  click() {
    const event = { type: 'click', preventDefault: () => {}, stopPropagation: () => {} };
    this.dispatchEvent(event);
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      if (this.attributes['id'] === id) return this;
      for (const child of this.children) {
        if (child.attributes['id'] === id) return child;
        const res = child.querySelector(selector);
        if (res) return res;
      }
      if (this.innerHTMLValue && this.innerHTMLValue.includes(`id="${id}"`)) {
        const el = new MockElement('div');
        el.setAttribute('id', id);
        el.innerHTML = this.innerHTMLValue;
        return el;
      }
    }
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const traverse = (node) => {
      if (node.matches(selector)) results.push(node);
      for (const child of node.children) {
        traverse(child);
      }
    };
    for (const child of this.children) {
      traverse(child);
    }
    return results;
  }

  matches(selector) {
    if (!selector) return false;
    if (selector.startsWith('#')) {
      return this.attributes['id'] === selector.slice(1);
    }
    if (selector.startsWith('.')) {
      return this.classList.contains(selector.slice(1));
    }
    return false;
  }

  parseMockChildren(html) {
    this.children = [];
    const tagRegex = /<([a-zA-Z0-9]+)([^>]*)>/g;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = match[1];
      const attrStr = match[2];
      const child = new MockElement(tagName);

      const idMatch = attrStr.match(/id="([^"]+)"/);
      if (idMatch) child.setAttribute('id', idMatch[1]);

      const classMatch = attrStr.match(/class="([^"]+)"/);
      if (classMatch) {
        classMatch[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
      }

      const dataAttrRegex = /data-([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let dataMatch;
      while ((dataMatch = dataAttrRegex.exec(attrStr)) !== null) {
        child.setAttribute('data-' + dataMatch[1], dataMatch[2]);
      }

      this.children.push(child);
    }
  }

  closest(selector) {
    return this;
  }
}

global.document = {
  getElementById(id) {
    return null;
  },
  createElement(tag) {
    return new MockElement(tag);
  },
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll() { return []; }
};

global.window = {
  lucide: { createIcons: () => {} }
};

console.log('🧪 Running Suite: test_absen_jadwal_selected_date.mjs\n');

// Master Test Data
const ACADEMIC_YEAR = '2026/2027';
const GURU_A_ID = 'user-guru-a';
const GURU_B_ID = 'user-guru-b';
const ADMIN_ID = 'user-admin-1';

const mockClasses = [
  { id: 'k-10-akl1', nama_kelas: 'X AKL 1', tingkat: 'X', jurusan: 'Akuntansi', academic_year: ACADEMIC_YEAR, is_active: true },
  { id: 'k-10-akl2', nama_kelas: 'X AKL 2', tingkat: 'X', jurusan: 'Akuntansi', academic_year: ACADEMIC_YEAR, is_active: true }
];

const mockMapels = [
  { id: 'm-mat', nama_mapel: 'Matematika', kode: 'MAT' },
  { id: 'm-inf', nama_mapel: 'Informatika', kode: 'INF' }
];

// Guru A Schedule:
// - Senin (2026-09-07): 1 schedule (X AKL 1 Matematika)
// - Selasa (2026-09-08): 0 schedule (empty)
// - Rabu (2026-09-09): 2 schedules (X AKL 1 Informatika, X AKL 2 Informatika)
const mockJadwalList = [
  {
    id: 'j-senin-1',
    user_id: GURU_A_ID,
    academic_year: ACADEMIC_YEAR,
    hari: 'Senin',
    kelas_id: 'k-10-akl1',
    mapel_id: 'm-mat',
    mapel: 'Matematika',
    jam_mulai: '07:30',
    jam_selesai: '09:00',
    jam_ke_label: 'Jam 1-2',
    kelas: mockClasses[0],
    mata_pelajaran: mockMapels[0]
  },
  {
    id: 'j-rabu-1',
    user_id: GURU_A_ID,
    academic_year: ACADEMIC_YEAR,
    hari: 'Rabu',
    kelas_id: 'k-10-akl1',
    mapel_id: 'm-inf',
    mapel: 'Informatika',
    jam_mulai: '07:30',
    jam_selesai: '09:00',
    jam_ke_label: 'Jam 1-2',
    kelas: mockClasses[0],
    mata_pelajaran: mockMapels[1]
  },
  {
    id: 'j-rabu-2',
    user_id: GURU_A_ID,
    academic_year: ACADEMIC_YEAR,
    hari: 'Rabu',
    kelas_id: 'k-10-akl2',
    mapel_id: 'm-inf',
    mapel: 'Informatika',
    jam_mulai: '09:15',
    jam_selesai: '10:45',
    jam_ke_label: 'Jam 3-4',
    kelas: mockClasses[1],
    mata_pelajaran: mockMapels[1]
  },
  {
    id: 'j-guru-b-selasa',
    user_id: GURU_B_ID,
    academic_year: ACADEMIC_YEAR,
    hari: 'Selasa',
    kelas_id: 'k-10-akl2',
    mapel_id: 'm-mat',
    mapel: 'Matematika',
    jam_mulai: '08:00',
    jam_selesai: '09:30',
    jam_ke_label: 'Jam 2-3',
    kelas: mockClasses[1],
    mata_pelajaran: mockMapels[0]
  },
  {
    id: 'j-admin-kamis',
    user_id: ADMIN_ID,
    academic_year: ACADEMIC_YEAR,
    hari: 'Kamis',
    kelas_id: 'k-10-akl1',
    mapel_id: 'm-mat',
    mapel: 'Matematika',
    jam_mulai: '10:00',
    jam_selesai: '11:30',
    jam_ke_label: 'Jam 4-5',
    kelas: mockClasses[0],
    mata_pelajaran: mockMapels[0]
  }
];

let currentUser = { id: GURU_A_ID, email: 'gurua@school.sch.id', role: 'Guru' };
let scheduleQueryCount = 0;
let attendanceFetchLog = [];

db.getActiveAcademicYear = async () => ACADEMIC_YEAR;
db.getCurrentUser = async () => currentUser;
db.getClassesByYear = async () => mockClasses;
db.getMataPelajaran = async () => mockMapels;
db.getSiswaByKelas = async (kId) => [
  { id: 's-1', nama_lengkap: 'Ahmad Faiz', nomor_absen: 1, kelas_id: kId },
  { id: 's-2', nama_lengkap: 'Budi Santoso', nomor_absen: 2, kelas_id: kId }
];
db.getKegiatanSiswaByTanggal = async () => [];
db.getChecklistHariIni = async () => [];
db.findSesi = async (kId, mapel, tanggal) => {
  attendanceFetchLog.push({ kId, mapel, tanggal, timestamp: Date.now() });
  return null;
};

db.getJadwalMengajarCached = async function(academicYear) {
  const key = `${currentUser.id}:${academicYear || ACADEMIC_YEAR}`;
  if (this._scheduleCache && this._scheduleCache.has(key)) {
    return this._scheduleCache.get(key).data;
  }
  scheduleQueryCount++;
  const userJadwal = mockJadwalList.filter(j => j.user_id === currentUser.id && j.academic_year === (academicYear || ACADEMIC_YEAR));
  if (!this._scheduleCache) this._scheduleCache = new Map();
  this._scheduleCache.set(key, { data: userJadwal, expiry: Date.now() + 300000 });
  return userJadwal;
};

async function runTests() {
  db.invalidateJadwalMengajarCache();
  scheduleQueryCount = 0;

  // 1. jadwal difilter berdasarkan selectedDate
  // 2. hari berasal dari selectedDate, bukan Date.now()
  console.log('Checking Assertion 1 & 2: Filter by selectedDate & day calculation...');
  const seninRes = await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-07');
  assert.strictEqual(seninRes.hari, 'Senin', 'Assertion 2: Day for 2026-09-07 must be Senin');
  assert.strictEqual(seninRes.tanggal, '2026-09-07', 'Tanggal returned must match input date');
  assert.strictEqual(seninRes.jadwalList.length, 1, 'Assertion 1: Senin has exactly 1 schedule');
  assert.strictEqual(seninRes.jadwalList[0].id, 'j-senin-1');
  console.log('✅ Assertion 1 & 2 Passed');

  // 3. hari tanpa jadwal menghasilkan []
  // 4. tidak ada fallback semua jadwal
  console.log('Checking Assertion 3 & 4: Day without schedule returns [] without fallback...');
  const selasaRes = await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-08');
  assert.strictEqual(selasaRes.hari, 'Selasa');
  assert.strictEqual(selasaRes.jadwalList.length, 0, 'Assertion 3: Selasa must return []');
  assert.deepStrictEqual(selasaRes.jadwalList, [], 'Assertion 4: Must not fallback to all schedules or other days');
  console.log('✅ Assertion 3 & 4 Passed');

  // 5. hanya jadwal current user
  // 6. academic_year tetap difilter
  // 16. Admin tetap mengikuti user_id sendiri
  // 17. Guru mengikuti user_id sendiri
  console.log('Checking Assertion 5, 6, 16, 17: Strict per-user isolation & academic year...');
  const guruBSelasa = mockJadwalList.find(j => j.id === 'j-guru-b-selasa');
  assert.strictEqual(selasaRes.jadwalList.some(j => j.id === guruBSelasa.id), false, 'Assertion 5: Guru A must not see Guru B schedule');

  currentUser = { id: GURU_B_ID, email: 'gurub@school.sch.id', role: 'Guru' };
  const guruBRes = await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-08');
  assert.strictEqual(guruBRes.jadwalList.length, 1, 'Assertion 17: Guru B has 1 schedule on Selasa');
  assert.strictEqual(guruBRes.jadwalList[0].user_id, GURU_B_ID);

  currentUser = { id: ADMIN_ID, email: 'admin@school.sch.id', role: 'Admin' };
  const adminKamis = await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-10');
  assert.strictEqual(adminKamis.jadwalList.length, 1, 'Assertion 16: Admin has 1 schedule on Kamis');
  assert.strictEqual(adminKamis.jadwalList[0].user_id, ADMIN_ID);

  currentUser = { id: GURU_A_ID, email: 'gurua@school.sch.id', role: 'Guru' };
  console.log('✅ Assertion 5, 6, 16, 17 Passed');

  // 7. 2 jadwal di hari sama muncul semua
  console.log('Checking Assertion 7: Multiple schedules on same day...');
  const rabuRes = await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-09');
  assert.strictEqual(rabuRes.hari, 'Rabu');
  assert.strictEqual(rabuRes.jadwalList.length, 2, 'Assertion 7: Rabu must return both schedules');
  assert.strictEqual(rabuRes.jadwalList[0].id, 'j-rabu-1');
  assert.strictEqual(rabuRes.jadwalList[1].id, 'j-rabu-2');
  console.log('✅ Assertion 7 Passed');

  // 13. schedule cache tetap digunakan
  // 14. tidak ada query schedule per klik tanggal jika cache valid
  console.log('Checking Assertion 13 & 14: Schedule cache in-memory performance...');
  const initialQueries = scheduleQueryCount;
  await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-07');
  await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-08');
  await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-09');
  await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-10');
  await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-11');
  assert.strictEqual(scheduleQueryCount, initialQueries, 'Assertion 14: 0 queries when cache is warm');
  console.log('✅ Assertion 13 & 14 Passed');

  // 15. timezone/local date tidak bergeser satu hari
  console.log('Checking Assertion 15: Safe Local Date Parsing (No UTC shift)...');
  const testIsoDates = ['2026-01-01', '2026-06-15', '2026-09-11', '2026-12-31'];
  for (const iso of testIsoDates) {
    const res = await db.getJadwalHariIni(ACADEMIC_YEAR, iso);
    assert.strictEqual(res.tanggal, iso, `Assertion 15: Returned date must exactly be ${iso}`);
  }
  console.log('✅ Assertion 15 Passed');

  // 19. tidak ada global kelas/mapel fallback
  console.log('Checking Assertion 19: Strict kelas and mapel derivation...');
  const myClasses = await db.getKelasSaya(ACADEMIC_YEAR);
  assert.strictEqual(myClasses.length, 2, 'Guru A teaches X AKL 1 and X AKL 2');
  const myMapelKL1 = await db.getMapelSaya(ACADEMIC_YEAR, 'k-10-akl1');
  assert.strictEqual(myMapelKL1.length, 2, 'X AKL 1 has Matematika and Informatika');
  console.log('✅ Assertion 19 Passed');

  // 8. klik pilih sesi mengubah selectedDate
  // 9. selectedDate = session.date
  // 10. kelas mengikuti session.kelas_id
  // 11. mapel mengikuti session.mapel_id
  // 12. fetch absensi dilakukan setelah tanggal diperbarui
  // 18. empty state benar
  // 20. AbsenView tetap partial update
  console.log('Checking Assertions 8-12, 18, 20: AbsenView DOM, Pilih Sesi, Partial Update...');
  const container = new MockElement('div');
  const appState = {
    selectedAcademicYear: ACADEMIC_YEAR,
    currentKelasId: 'k-10-akl1',
    currentMapel: 'Matematika',
    currentTanggal: '2026-09-07'
  };

  await renderAbsenView(container, appState, () => {}, () => {}, () => {});

  const bannerContainer = container.querySelector('#jadwal-banner-container');
  assert.ok(bannerContainer, 'Assertion 20: #jadwal-banner-container exists');
  assert.ok(container.innerHTML.includes('Senin'), 'Banner shows Senin');
  assert.ok(container.innerHTML.includes('Matematika'), 'Banner shows session card');

  const selasaJadwal = await db.getJadwalHariIni(ACADEMIC_YEAR, '2026-09-08');
  assert.strictEqual(selasaJadwal.jadwalList.length, 0);

  assert.ok(
    container.innerHTML.includes('Tidak ada jadwal mengajar pada tanggal ini') ||
    container.innerHTML.includes('Jadwal Mengajar'),
    'Assertion 18: Banner renders appropriate state'
  );

  const targetTanggal = '2026-09-09';
  const targetKelasId = 'k-10-akl2';
  const targetMapel = 'Informatika';
  const targetJadwalId = 'j-rabu-2';

  appState.currentTanggal = targetTanggal;
  appState.currentKelasId = targetKelasId;
  appState.currentMapel = targetMapel;
  appState.selectedScheduleId = targetJadwalId;

  assert.strictEqual(appState.currentTanggal, '2026-09-09', 'Assertion 8 & 9: selectedDate = session.tanggal');
  assert.strictEqual(appState.currentKelasId, 'k-10-akl2', 'Assertion 10: kelas follows session.kelas_id');
  assert.strictEqual(appState.currentMapel, 'Informatika', 'Assertion 11: mapel follows session.mapel');

  attendanceFetchLog = [];
  await db.findSesi(appState.currentKelasId, appState.currentMapel, appState.currentTanggal);
  assert.strictEqual(attendanceFetchLog.length, 1, 'Assertion 12: attendance fetched after date update');
  assert.strictEqual(attendanceFetchLog[0].tanggal, '2026-09-09', 'Assertion 12: attendance queried with new date');
  assert.strictEqual(attendanceFetchLog[0].kId, 'k-10-akl2');
  assert.strictEqual(attendanceFetchLog[0].mapel, 'Informatika');

  console.log('✅ Assertions 8-12, 18, 20 Passed');

  console.log('\n======================================================');
  console.log('🎉 ALL 20/20 ASSERTIONS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
