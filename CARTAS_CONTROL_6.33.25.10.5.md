# 6.33.25.10.5 · Carga histórica universal

- Carga manual mensual para enero-agosto 2026 desde Gestión de Cartas de Control.
- Formulario dinámico según tipo de carta: pH, conductividad, balanza, ambiental y temperatura/equipos.
- Responsable seleccionable por fecha, observación y guardado por lote mensual.
- Registros marcados `HISTORICO_MANUAL`; no generan notificaciones ni obligaciones diarias.
- Protección de duplicado por carta + fecha.
- Sincronización en `controlChartRecords`; no requiere nuevas reglas Firestore.
