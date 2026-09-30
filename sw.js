// КрасноBus service worker.
// При каждом изменении этого файла увеличивайте VERSION — старый кэш удалится.
const VERSION = 'kb-v1';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const CDN_HOSTS = ['unpkg.com', 'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;               // отправка формы и пр. — мимо кэша
    const url = new URL(req.url);

    // Страницы: сначала сеть (чтобы обновления приходили сразу), без сети — из кэша
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req).then(res => {
                const copy = res.clone();
                caches.open(VERSION).then(c => c.put(req, copy));
                return res;
            }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
        );
        return;
    }

    // Свои файлы и библиотеки с CDN: отдаём из кэша, в фоне обновляем
    if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
        e.respondWith(
            caches.open(VERSION).then(async cache => {
                const cached = await cache.match(req);
                const network = fetch(req).then(res => {
                    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
                    return res;
                }).catch(() => cached);
                return cached || network;
            })
        );
    }
    // Всё остальное (таблица Google, погода) идёт напрямую:
    // расписание и так кэшируется самим сайтом.
});
