# V1.0.5.6.33.25.10 — Persistencia protegida de Cartas de Control

- Recuperación idempotente de las 6 cartas técnicas aprobadas de Microbiología (CC-0018 a CC-0023) cuando una instalación nueva no las encuentra en Firestore/local.
- No sobrescribe cartas existentes ni reactiva una carta que el JEFE haya dejado INACTIVA.
- No elimina, fusiona ni modifica registros históricos.
- Guardar/editar una carta intenta confirmación inmediata en Firestore y diferencia claramente entre CONFIRMADA y PENDIENTE.
- Conserva Outbox/reintentos y sincronización en tiempo real.
