// scripts/diagnose_imports.mjs
// Automated ES Module Import & Syntax Integrity Checker for SIA-Jurnal
// Run: node scripts/diagnose_imports.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock browser environment for Node evaluation
const store = {};
globalThis.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
globalThis.window = {
  location: { search: '' },
  addEventListener: () => {}
};
globalThis.document = {
  documentElement: { classList: { toggle: () => {}, contains: () => false, add: () => {}, remove: () => {} } },
  getElementById: () => ({ classList: { add: () => {}, remove: () => {} }, innerHTML: '' }),
  createElement: () => ({ classList: { add: () => {} }, style: {}, appendChild: () => {} }),
  readyState: 'complete'
};
globalThis.self = {
  skipWaiting: () => {},
  addEventListener: () => {},
  clients: { claim: () => Promise.resolve() }
};
globalThis.caches = {
  open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() }),
  match: () => Promise.resolve(null),
  keys: () => Promise.resolve([]),
  delete: () => Promise.resolve(true)
};
try {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { register: () => Promise.resolve({ scope: '/' }), controller: null },
    configurable: true
  });
} catch (_) {}

console.log('🔍 [diagnose_imports] Scanning project JS modules for syntax & export/import integrity...\n');

// Find all JS files in root, components/, data/
function getJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'scratch' && item.name !== '.git' && item.name !== 'scripts') {
        results = results.concat(getJsFiles(fullPath));
      }
    } else if (item.isFile() && item.name.endsWith('.js') && item.name !== 'sw.js') {
      results.push(fullPath);
    }
  }
  return results;
}

const allJsFiles = getJsFiles(rootDir);
let errorCount = 0;
let successCount = 0;

for (const file of allJsFiles) {
  const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
  try {
    const fileUrl = new URL(`../${relPath}`, import.meta.url).href;
    await import(fileUrl);
    console.log(`  ✅ [OK] ${relPath}`);
    successCount++;
  } catch (err) {
    console.error(`  ❌ [FAILED] ${relPath}:`);
    console.error(`     -> ${err.message}\n`);
    errorCount++;
  }
}

console.log('\n======================================================');
console.log(`📊 Hasil Diagnosa Modul: ${successCount} Berhasil, ${errorCount} Gagal`);
console.log('======================================================');

if (errorCount > 0) {
  console.error(`\n❌ TERDETEKSI ${errorCount} ERROR PADA MODULE IMPORT / EXPORT! Harap perbaiki sebelum deploy.`);
  process.exit(1);
} else {
  console.log('\n✨ SEMUA ES MODULE BERSIH DAN VALID TANPA ERROR IMPORT / EXPORT! 🚀');
  process.exit(0);
}
