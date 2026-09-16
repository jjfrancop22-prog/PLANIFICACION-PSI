# V1.0.5.6.44 — Cartas de Control multi-PC

- DBO5, pH EI-345 y Conductividad EI-104 se sincronizan con Firestore.
- Registros locales existentes se migran una sola vez al iniciar sesión.
- `controlChartEntries` y `controlChartConfig` participan en pull, push y escucha en tiempo real.
- La vista Cartas de Control se refresca al recibir cambios remotos.
- Se conserva IndexedDB como caché/offline y Outbox para reconexión.

## Requisito Firestore
Las reglas incluidas permiten a usuarios ACTIVO leer/crear/actualizar `controlChartEntries`; solo JEFE puede eliminar. `controlChartConfig` puede leerse por usuarios activos y escribirse por JEFE.
Estas reglas deben estar publicadas en Firebase para que las cartas sincronicen.
