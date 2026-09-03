// A3.2: Service Worker deshabilitado durante desarrollo local para evitar servir versiones antiguas.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister()));
