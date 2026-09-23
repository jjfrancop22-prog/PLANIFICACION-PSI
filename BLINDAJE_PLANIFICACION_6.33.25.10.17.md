# V1.0.5.6.33.25.10.17 — Blindaje de planificación en sesión activa

Corrige el caso confirmado donde la persona planificaba, los registros sí llegaban a Firebase y otras PCs, pero su propia PC pasaba a mostrar una agenda parcial hasta limpiar almacenamiento local.

- `planning` ignora snapshots `fromCache` del listener realtime.
- Ningún snapshot parcial/cacheado puede borrar u ocultar actividades confirmadas.
- Solo un snapshot confirmado por servidor puede reconciliar ausencias/eliminaciones.
- Se conserva Outbox para cambios locales pendientes.
- Al volver a foco/online se revalida desde servidor.
- Mientras el Planificador permanece visible se hace una verificación silenciosa de integridad cada 3 minutos.
- Service Worker, caché PWA, recursos y versión visible quedan en 10.17.
