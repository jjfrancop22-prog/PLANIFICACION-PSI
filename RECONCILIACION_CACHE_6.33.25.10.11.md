# V1.0.5.6.33.25.10.11 · Reconciliación caché multi-PC

- Firestore queda como estado canónico al abrir una nueva sesión.
- Outbox de sesiones anteriores que contradiga Firestore se pone en CONFLICTO_LOCAL y no puede resucitar planificación antigua.
- La evidencia conflictiva se conserva en Outbox para trazabilidad.
- Los cambios creados en la sesión actual siguen protegidos mientras se confirman.
- Service Worker activa la versión nueva automáticamente y elimina cachés ERP anteriores.
- Netlify fuerza no-store para app.js, styles.css y version.json.
- Conserva la protección 10.10 contra doble consumo y doble finalización.
