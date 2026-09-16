# V1.0.5.6.33.4 — Cartas Firebase estable + versión PWA

- Conserva intactas las colecciones originales del ERP.
- Cartas usan `controlChartDefs` y `controlChartRecords`.
- Reglas incluidas para lectura/escritura por rol.
- Corrige `version.json`, `VERSION.json`, APP_VERSION, pie visible, query de app.js y Service Worker.
- Caché PWA nuevo `erp-planificacion-v1.0.5.6.33.4`.
- Los pendientes existentes del Outbox se reintentan; no se borran.

IMPORTANTE: publicar `firestore.rules` en Firebase antes de validar multi-PC. Netlify no despliega reglas Firestore.
