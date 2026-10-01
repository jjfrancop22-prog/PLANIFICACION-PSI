# V1.0.5.6.33.25.10.24.0

Corrección de despliegue/versionado sobre la 10.23.0.

- index.html, app.js, service-worker.js, version.json y VERSION.json usan la misma versión.
- app.js y styles.css usan `?v=6.33.25.10.24.0`.
- service worker se registra con `updateViaCache: none` y `?v=6.33.25.10.24.0`.
- caché PWA nuevo: `erp-planificacion-v1.0.5.6.33.25.10.24.0`; al activar elimina cachés ERP anteriores.
- Se conserva el motor Westgard, recálculo, deduplicación y edición estable de 10.23.0.
