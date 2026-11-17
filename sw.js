/* ============================================
   安全e课堂 · Service Worker (PWA)
   - 预缓存核心资源
   - 网络优先策略（保证内容最新），失败回退缓存
   - 跳过 Supabase API 请求（不缓存）
   ============================================ */

const CACHE_NAME = 'security-e-class-v4';

const CRITICAL_ASSETS = [
  './',
  './index.html',
  './teacher.html',
  './css/style.css',
  './css/auth.css',
  './js/supabase.js',
  './js/data.js',
  './js/app.js',
  './js/supabase-config.js',
  './js/supabase-auth.js',
  './js/study-tracker.js',
  './manifest.json',
  './img/icons/icon-192.png',
  './img/icons/icon-512.png'
];

// 单个资源最多等 8 秒，避免某个资源卡住导致整个 install 永远不完成（SW 无法激活）
const addWithTimeout = (cache, url, ms = 8000) =>
  Promise.race([
    cache.add(url).catch(err => console.warn('缓存失败:', url, err)),
    new Promise(resolve => setTimeout(resolve, ms))
  ]);

// Install: 预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 单个资源失败不影响整体
      return Promise.allSettled(
        CRITICAL_ASSETS.map(url => addWithTimeout(cache, url))
      );
    })
  );
  self.skipWaiting();
});

// Activate: 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: 网络优先，失败回退缓存
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 跳过 Supabase API 请求（绝不缓存）
  if (req.url.includes('supabase.co')) return;
  // 跳过非 GET 请求
  if (req.method !== 'GET') return;

  // 导航请求（HTML）：网络优先，失败回退离线页
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：缓存优先，回退网络
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // 后台更新缓存
        fetch(req).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (res.ok && (req.destination === 'script' || req.destination === 'style' || req.destination === 'image')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});

// 接收消息：允许页面强制更新
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
