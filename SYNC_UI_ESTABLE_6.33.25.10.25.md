# 6.33.25.10.25 · Sincronización visual estable

- El flush de Outbox ya no fuerza `renderControlChartEngine()` al finalizar cada confirmación.
- Los snapshots con escrituras locales pendientes no provocan repintado remoto.
- Las ráfagas de snapshots Firestore se agrupan con debounce antes de reconciliar la vista.
- El snapshot inicial de cada listener hidrata IndexedDB sin desmontar la pantalla visible.
- Se conserva Westgard, deduplicación, edición CALIDAD y trazabilidad de 10.24.0.
- Versionado y Service Worker unificados en 10.25.0.
