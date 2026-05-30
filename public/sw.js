const CACHE_VERSION = 'v1.0.1'; // غير الرقم ده مع كل تحديث
const CACHE_NAME = `lahza-cache-${CACHE_VERSION}`;

// قائمة الملفات اللي تتحدث فوراً
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js'
];

self.addEventListener('install', event => {
  console.log('🔄 Service Worker: تثبيت الإصدار الجديد');
  
  event.waitUntil(
    Promise.all([
      self.skipWaiting(),
      // تخزين الملفات الأساسية
      caches.open(CACHE_NAME).then(cache => {
        console.log('📦 تخزين الملفات الأساسية');
        return cache.addAll(CRITICAL_ASSETS);
      })
    ])
  );
});

self.addEventListener('activate', event => {
  console.log('✅ Service Worker: تفعيل الإصدار الجديد');
  
  event.waitUntil(
    Promise.all([
      // السيطرة على كل الصفحات فوراً
      self.clients.claim(),
      
      // حذف كل الكاش القديم
      caches.keys().then(keys => {
        return Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              console.log('🗑️ حذف الكاش القديم:', key);
              return caches.delete(key);
            }
          })
        );
      })
    ]).then(() => {
      console.log('🎉 الإصدار الجديد نشط بالكامل');
    })
  );
});

self.addEventListener('fetch', event => {
  // تجاهل الطلبات من chrome-extension
  if (!event.request.url.startsWith('http')) return;
  
  // Network First للـ HTML
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Network First لـ CSS و JS
  if (event.request.destination === 'script' || 
      event.request.destination === 'style') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Cache First مع تحديث للصور والخطوط
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);
      
      return cachedResponse || fetchPromise;
    })
  );
});

// استقبال رسائل من الصفحة
self.addEventListener('message', event => {
  if (event.data === 'CHECK_UPDATE') {
    // إرسال رسالة للصفحة بوجود تحديث
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'UPDATE_AVAILABLE', version: CACHE_VERSION });
      });
    });
  }
  
  if (event.data === 'FORCE_UPDATE') {
    self.skipWaiting();
  }
});
