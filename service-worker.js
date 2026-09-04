const SW_VERSION='V1.0.5.6';
const CACHE_NAME='erp-planificacion-v1.0.5.6';
const APP_SHELL=[
  './','./index.html','./styles.css','./app.js','./firebase-config.js',
  './manifest.webmanifest','./version.json','./icons/icon-192.png','./icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('erp-planificacion-')&&k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  // Código y navegación: red primero para detectar versiones nuevas.
  if(req.mode==='navigate' || /\.(js|css|json|webmanifest)$/.test(url.pathname)){
    event.respondWith(
      fetch(req)
        .then(r=>{
          const copy=r.clone();
          caches.open(CACHE_NAME).then(c=>c.put(req,copy));
          return r;
        })
        .catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(r=>{
      const copy=r.clone();
      caches.open(CACHE_NAME).then(c=>c.put(req,copy));
      return r;
    }))
  );
});
