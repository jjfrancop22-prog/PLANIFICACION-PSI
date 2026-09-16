# 6.33.7 · DBO5 IA + Firebase

Primera carta técnica completa sobre el motor multi-PC validado.

- Recepción de Muestras → DBO5.
- EI-270 + PF-09.
- Criterios 17–23 °C y 20–80 %HR.
- Corrección automática por rangos; fuera de tabla se bloquea sin inventar factor.
- Historial Firestore mediante controlChartRecords + Outbox.
- Fase de establecimiento hasta 10 registros.
- Media, s, ±1s/±2s/±3s y vigilancia 1_2s, 1_3s, 2_2s, R_4s, 7x y 7T.
- Diagnóstico IA asistivo, separado del cumplimiento ambiental.
