# V1.0.5.6.33 — Motor universal de Cartas de Control

Primera fase: infraestructura antes de métodos.

- `controlChartDefs`: definiciones centralizadas por actividad/área + método.
- `controlChartRecords`: almacén preparado para registros posteriores.
- Ambas entidades usan el mismo Firestore, Outbox y listeners en tiempo real del ERP.
- Solo JEFE configura definiciones. Usuarios activos pueden leerlas.
- Regla funcional guardada: `ACTIVIDAD_ASIGNADA`.
- IndexedDB es caché/offline; Firestore es la capa compartida multi-PC.

## IMPORTANTE
Publicar `firestore.rules` en Firebase antes de probar las nuevas colecciones. Netlify no publica reglas de Firestore.
