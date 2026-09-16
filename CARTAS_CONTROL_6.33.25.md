# Cartas de Control 6.33.25 — Recuperación de cartas críticas

- Recuperación no destructiva e idempotente de Pesaje EI-227 y Estufa EI-314.
- Pesaje conserva el `chartId` de registros `BALANZA_MULTIPUNTO` cuando la definición falta.
- Estufa conserva definición archivada o `chartId` de `ESTUFA_EI314`; si no existe huella histórica, restaura una única definición técnica EI-314.
- No elimina registros, no fusiona cartas diferentes y no modifica reglas de Firestore.
- Mantiene sincronización ACK realtime de 6.33.24.4.
