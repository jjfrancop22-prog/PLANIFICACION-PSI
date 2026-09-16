# 6.33.13 · Destilador EI-328 sin corrección

- Base: 6.33.12 estable.
- El Destilador EI-328 evalúa directamente la resistividad leída.
- Criterio: 15.0–20.0 MΩ·cm.
- No existe factor ni tabla de corrección y el analista nunca actualiza `controlChartDefs` al abrir/guardar.
- Solo se crea `controlChartRecords`, usando la ruta Firebase ya autorizada por las cartas anteriores.
- Se integra como quinto control diario obligatorio, notificaciones, IA local, estadística y Gestión de Calidad.
