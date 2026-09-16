# V1.0.5.6.33.21.1 — Blindaje de persistencia de Cartas de Control

- `controlChartDefs` deja de aceptar borrado físico desde outbox antiguo.
- Un evento remoto `removed` no borra la definición local; JEFE la restaura a Firestore.
- Recuperación no destructiva de Balanza EI-227 cuando existen registros `BALANZA_MULTIPUNTO` cuyo `chartId` quedó sin definición.
- Estufa EI-314, condiciones ambientales EI-285 y pesaje EI-227 permanecen como definiciones independientes aunque compartan métodos.
- No se modifican ni eliminan registros históricos.
