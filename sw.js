// sw.js - Service Worker for SIA-Jurnal (Static Assets Caching & Offline Fallback)
const CACHE_NAME = 'sia-jurnal-static-v1.6.0';

// Daftar seluruh asset statis lokal yang di-precache
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './supabase-client.js',
  './manifest.json',
  './offline.html',
  './data/initialData.js',
  './data/appInfo.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon.svg',
  './components/AcademicYearCombobox.js',
  './components/TingkatCombobox.js',
  './components/JurusanCombobox.js',
  './components/KelompokCombobox.js',
  './components/SiswaCombobox.js',
  './components/AbsenView.js',
  './components/AuthView.js',
  './components/ClassCombobox.js',
  './components/DatePicker.js',
  './components/JurnalView.js',
  './components/KegiatanView.js',
  './components/KenaikanKelasModal.js',
  './components/LaporanSiswaModal.js',
  './components/MapelCombobox.js',
  './components/Navbar.js',
  './components/PRBuatView.js',
  './components/PRPemeriksaanView.js',
  './components/PemeriksaanTugasView.js',
  './components/RekapSiswaView.js',
  './components/RekapView.js',
  './components/RiwayatView.js',
  './components/SettingsModal.js',
  './components/ShareRekapKelasModal.js',
  './components/Sidebar.js',
  './components/SiswaModal.js',
  './components/Topbar.js',
  './components/TugasView.js'
];

// External CDN scripts & fonts yang aman di-cache
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// ============================================================================
// 1. INSTALL EVENT - Pre-cache Static Assets
// ============================================================================
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Aktifkan service worker baru segera
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pre-cache asset lokal
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        console.warn('[SW] Some local assets failed to pre-cache:', err);
      }
      
      // Pre-cache CDN assets (opsional / non-blocking)
      CDN_ASSETS.forEach(url => {
        fetch(url, { mode: 'no-cors' })
          .then(res => cache.put(url, res))
          .catch(() => {/* Ignore offline CDN pre-cache error */});
      });
    })
  );
});

// ============================================================================
// 2. ACTIVATE EVENT - Clean Old Caches & Claim Clients
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('sia-jurnal-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Purging old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================================
// 3. FETCH EVENT - Strict Policy: Fresh Data from Supabase, Fast Cached Static Assets
// ============================================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // A. ATURAN 1: JANGAN PERNAH CACHE SUPABASE DATA API (SELALU FRESH DARI SERVER)
  // Request data ke supabase.co atau endpoint auth/rest SELALU Network-Only
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/storage/v1/')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // B. ATURAN 2: NAVIGASI HALAMAN (HTML DOCUMENT)
  // Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          // Jika offline, coba ambil index.html dari cache, atau fallback ke offline.html
          const cachedIndex = await caches.match('./index.html');
          if (cachedIndex) return cachedIndex;
          const cachedOffline = await caches.match('./offline.html');
          if (cachedOffline) return cachedOffline;
          return new Response('Aplikasi sedang offline.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // C. ATURAN 3: ASET STATIS LOKAL & CDN (JS, CSS, FONTS, IMAGES)
  // Stale-While-Revalidate: Ambil dari cache dulu untuk kecepatan, lalu perbarui di latar belakang
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network error - fallback ke cache yang sudah ada
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listener untuk pesan manual (misal force update dari aplikasi)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
