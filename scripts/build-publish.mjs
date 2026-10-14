// scripts/build-publish.mjs
// Menyalin HANYA file runtime aplikasi ke dist/ untuk dipublikasikan Netlify.
// File SQL, backup, dokumentasi, script pengujian, dan file internal tidak ikut.
// Run: node scripts/build-publish.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

// Allowlist file & folder runtime
const RUNTIME_FILES = [
  'index.html',
  'offline.html',
  'app.js',
  'supabase-client.js',
  'styles.css',
  'sw.js',
  'manifest.json',
  '_headers',
  '_redirects'
];
const RUNTIME_DIRS = ['components', 'constants', 'data', 'icons'];
const ALLOWED_EXT = new Set(['.html', '.js', '.css', '.json', '.png', '.svg', '']);

const errors = [];

function copyFile(rel) {
  const src = path.join(rootDir, rel);
  if (!fs.existsSync(src)) {
    errors.push(`File runtime tidak ditemukan: ${rel}`);
    return;
  }
  const dest = path.join(distDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const toRel = (full) => path.relative(distDir, full).split(path.sep).join('/');

// 1. Bersihkan & salin
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
RUNTIME_FILES.forEach(copyFile);
for (const dir of RUNTIME_DIRS) {
  listFiles(path.join(rootDir, dir)).forEach((full) => {
    copyFile(path.relative(rootDir, full));
  });
}

const distFiles = listFiles(distDir).map(toRel);
const distSet = new Set(distFiles);

// 2. Hanya ekstensi runtime yang boleh ada di dist/
for (const rel of distFiles) {
  if (!ALLOWED_EXT.has(path.extname(rel))) {
    errors.push(`Ekstensi tidak diizinkan di dist/: ${rel}`);
  }
}

// 3. Semua import ES module lokal harus ada di dist/
const importPattern = /(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*['"](\.{1,2}\/[^'"]+)['"]/g;
for (const rel of distFiles.filter((f) => f.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(distDir, rel), 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), match[1] || match[2]));
    if (!distSet.has(target)) errors.push(`Import tidak ditemukan: ${rel} -> ${target}`);
  }
}

// 4. Semua aset precache service worker harus ada di dist/
const swSource = fs.readFileSync(path.join(distDir, 'sw.js'), 'utf8');
const staticBlock = swSource.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
if (!staticBlock) {
  errors.push('Daftar STATIC_ASSETS di sw.js tidak terbaca');
} else {
  for (const [, asset] of staticBlock[1].matchAll(/'\.\/([^']*)'/g)) {
    if (asset && !distSet.has(asset)) errors.push(`Aset precache SW tidak ada: ${asset}`);
  }
}

// 5. Referensi lokal di HTML & manifest harus ada di dist/
for (const rel of ['index.html', 'offline.html', 'manifest.json']) {
  const source = fs.readFileSync(path.join(distDir, rel), 'utf8');
  for (const [, ref] of source.matchAll(/(?:src|href)="([^"]+)"|"src":\s*"([^"]+)"/g)) {
    if (!ref || /^(https?:|data:|#)/.test(ref)) continue;
    const clean = ref.replace(/^\.\//, '').split('?')[0];
    if (!distSet.has(clean)) errors.push(`Referensi tidak ditemukan: ${rel} -> ${ref}`);
  }
}

// 6. Tidak boleh ada NISN (10 digit) yang tertanam, kecuali contoh fiktif 000000000x
for (const rel of distFiles.filter((f) => /\.(js|json|html)$/.test(f))) {
  const source = fs.readFileSync(path.join(distDir, rel), 'utf8');
  if (/['"](?!000000000\d['"])\d{10}['"]/.test(source)) {
    errors.push(`Kemungkinan NISN tertanam di: ${rel}`);
  }
}

if (errors.length > 0) {
  console.error(`BUILD GAGAL (${errors.length} masalah):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log(`Build selesai: ${distFiles.length} file runtime disalin ke dist/`);
