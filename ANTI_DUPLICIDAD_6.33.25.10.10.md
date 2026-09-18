# V1.0.5.6.33.25.10.10 — Anti-duplicidad transaccional

## Diagnóstico confirmado
El cierre técnico podía ejecutarse dos veces sobre el mismo `planId` si dos envíos se solapaban (doble clic, reintento o dos clientes). El aviso de ciclo de vida ya era determinístico, pero el aviso técnico usaba `uid(COM)` y el descuento se recalculaba contra el stock vivo, permitiendo secuencias como 41→35 y 35→29 para el mismo cierre.

## Correcciones
- Mutex local de guardado/finalización.
- Claim transaccional en Firestore antes de finalizar una actividad con datos técnicos.
- `completionCommittedAt` / `completionCommittedBy` persistentes.
- ID determinístico `AUTO-TECNICA-FINAL-{planId}` para el aviso técnico final.
- Detección de actividad idéntica al guardar planificación.
- Cambio de caché PWA para forzar actualización de versión.

## Regla de seguridad
Si Firebase está configurado pero no hay conexión autenticada, una actividad con consumo no se finaliza ni descuenta inventario. Se evita priorizar disponibilidad offline sobre integridad del stock.
