# V1.0.5.6.33.3 — Cartas Firebase acoplado

- Corrige el ERROR de escucha causado por colecciones nuevas no autorizadas en reglas Firestore ya desplegadas.
- No cambia el motor Firebase estable del ERP.
- Definiciones de cartas usan físicamente `catalog` con marcador `_erpEntity=controlChartDefs`.
- Registros futuros usan físicamente `planComments` con marcador `_erpEntity=controlChartRecords`.
- Los listeners filtran esos documentos para que no aparezcan como catálogo ni comunicaciones.
- IndexedDB conserva stores separados `controlChartDefs` y `controlChartRecords`.
- Outbox existente se reutiliza y los pendientes 6.33.2 se reintentan contra la ruta compatible.
- Estado de Cartas ahora muestra FIRESTORE SINCRONIZADO / PENDIENTE / ERROR de forma real.
