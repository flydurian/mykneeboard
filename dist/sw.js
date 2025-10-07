// Service Worker for My KneeBoard
// Handles offline caching and background sync

const CACHE_NAME = 'mykneeboard-v3';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline use
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets...');
        // 기본 파일들을 캐시하되, 실패해도 계속 진행
        return cache.addAll(STATIC_CACHE_URLS)
          .catch((error) => {
            console.warn('Some static assets failed to cache:', error);
            // 일부 파일 캐시 실패해도 설치 계속 진행
            return Promise.resolve();
          })
          .then(async () => {
            // index.html에서 참조하는 /assets/* 자원들을 선캐시 (오프라인 재시작 대비)
            try {
              const resp = await fetch('/index.html', { cache: 'no-cache' });
              if (resp && resp.ok) {
                const html = await resp.text();
                const assetUrls = new Set();
                // 스크립트/스타일/이미지에서 /assets/ 경로 추출
                const assetRegex = /(?:src|href)=["'](\/assets\/[^"']+)["']/g;
                let match;
                while ((match = assetRegex.exec(html)) !== null) {
                  assetUrls.add(match[1]);
                }
                // 아이콘 등 정적 리소스도 추가 추출
                const iconRegex = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/g;
                while ((match = iconRegex.exec(html)) !== null) {
                  const url = match[1];
                  if (url.startsWith('/')) assetUrls.add(url);
                }
                await Promise.all(
                  Array.from(assetUrls).map(async (url) => {
                    try {
                      const r = await fetch(url, { cache: 'no-cache' });
                      if (r && r.ok) {
                        await cache.put(url, r.clone());
                      }
                    } catch {}
                  })
                );
              }
            } catch (e) {
              // 네트워크 불가 시 무시
            }
          });
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated successfully');
        // clients.claim() 제거 - Service Worker는 이 기능 없이도 정상 작동
        // 다음 페이지 로드부터는 자동으로 새로운 Service Worker가 제어됨
        return Promise.resolve();
      })
      .catch((error) => {
        console.error('Service Worker activation failed:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 오프라인 셸과 캐시 관리 개선 (안정성 향상)
  const offlineShell = () => new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>오프라인</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e5e7eb}div{max-width:520px;padding:24px;text-align:center;background:#111827;border-radius:16px;border:1px solid #1f2937}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;margin:0 0 12px;opacity:.9}</style></head><body><div><h1>오프라인 모드</h1><p>필수 파일을 찾을 수 없습니다. 온라인으로 연결되면 자동으로 최신 앱을 로드합니다.</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

  // 1) 네비게이션은 캐시 우선 (백그라운드 업데이트 제거)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html', { ignoreSearch: true }).then((cached) => {
        // 캐시가 있으면 즉시 반환, 없으면 네트워크 시도 → 마지막으로 초경량 셸
        if (cached) return cached;
        return fetch(request).catch(() => offlineShell());
      })
    );
    return;
  }

  // 2) 비-GET은 패스
  if (request.method !== 'GET') return;

  // 3) 확장/비-http 요청은 패스
  if (!url.protocol.startsWith('http')) return;

  // 4) API는 네트워크 우선(오프라인 시 자연 실패)
  if (url.pathname.startsWith('/api/')) return;

  // 5) 정적 자산은 캐시 우선, 쿼리 무시
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => caches.match(request, { ignoreSearch: true }));
      })
    );
    return;
  }

  // 6) 그 외 요청: 캐시 후 네트워크 (유연)
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).catch(() => caches.match(request));
    })
  );
});

// Helper function to check if URL is a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  const urlPath = new URL(url).pathname;
  return staticExtensions.some(ext => urlPath.endsWith(ext)) || 
         urlPath.includes('/assets/') || 
         urlPath.includes('/static/');
}

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      if (data && data.urls) {
        caches.open(CACHE_NAME)
          .then((cache) => {
            return cache.addAll(data.urls);
          })
          .then(() => {
            console.log('URLs cached successfully:', data.urls);
          })
          .catch((error) => {
            console.error('Failed to cache URLs:', error);
          });
      }
      break;
      
    case 'CLEAR_CACHE':
      if (data && data.cacheName) {
        caches.delete(data.cacheName)
          .then(() => {
            console.log('Cache cleared:', data.cacheName);
          });
      } else {
        caches.keys()
          .then((cacheNames) => {
            return Promise.all(
              cacheNames.map((cacheName) => caches.delete(cacheName))
            );
          })
          .then(() => {
            console.log('All caches cleared');
          });
      }
      break;
      
    case 'GET_CACHE_SIZE':
      caches.keys()
        .then((cacheNames) => {
          let totalSize = 0;
          const cacheSizes = {};
          
          return Promise.all(
            cacheNames.map((cacheName) => {
              return caches.open(cacheName)
                .then((cache) => {
                  return cache.keys()
                    .then((keys) => {
                      cacheSizes[cacheName] = keys.length;
                      totalSize += keys.length;
                    });
                });
            })
          ).then(() => {
            event.ports[0].postMessage({
              type: 'CACHE_SIZE_RESPONSE',
              data: { cacheSizes, totalSize }
            });
          });
        });
      break;
  }
});

// Background sync (if supported)
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks here
      Promise.resolve()
    );
  }
});

// Push notification (if supported)
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : '새로운 알림이 있습니다.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'mykneeboard-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: '열기'
      },
      {
        action: 'close',
        title: '닫기'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('My KneeBoard', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Service Worker script loaded');
