# 10.28.0 · Planificador multi-PC sin bloqueo externo

- Retira la dependencia de la colección `planningLocks`, que podía fallar por reglas de Firestore y bloquear planificaciones válidas.
- Mantiene máximo diario de 8 h (o `dailyHours` del analista).
- Mantiene bloqueo de cruces y duplicados.
- Valida contra Firestore antes de guardar y vuelve a validar después del commit.
- En concurrencia entre dos PCs, usa prioridad determinística y revierte el candidato que pierde.
- Reduce lecturas consultando primero por fecha, con fallback compatible.
- Mensajes de error distinguen permisos, red y conflicto real.
