# 6.33.25.10.26 — Cartas estables

- El recálculo pH/Westgard es idempotente: solo escribe si cambia estado o reglas.
- Abrir una carta ya no reescribe toda la serie ni genera una ráfaga de Outbox.
- Los snapshots de Firestore hidratan IndexedDB pero no desmontan/reconstruyen la vista Cartas de Control.
- La vista se actualiza por selección de carta, mes o botón Actualizar, evitando carreras donde el selector mostraba pH y el panel mostraba temperatura/humedad de otra carta.
- Se conserva edición controlada pH con contraseña CALIDAD y trazabilidad.
- Se conserva deduplicación exacta; solo escribe cuando realmente existe un duplicado.
