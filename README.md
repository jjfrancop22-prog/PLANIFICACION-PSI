# V1.0.5.6.2 — Fix de arranque completo

Correcciones puntuales sobre V1.0.5.6.1:

- `refreshPlanner()` vuelve a existir como función global antes del arranque.
- Las llamadas de inicialización quedan protegidas.
- Se conserva `monthStartISO()`.
- Se conserva la eliminación definitiva/tombstone.
- Se conserva la limpieza de eliminados después de abrir IndexedDB.
- No se cambia DB_VERSION, IndexedDB, Firebase, usuarios ni roles.


## V1.0.5.6.5 · Sincronización de eliminación multi-PC
- Firestore queda como fuente compartida de verdad para `planning`.
- Al iniciar/recibir snapshot se eliminan del IndexedDB las planificaciones locales que ya no existen en Firestore.
- Se protegen CREATE/UPDATE locales pendientes para no borrar trabajo aún no subido.
- Soluciona el caso: PC A elimina, PC B/C estaban cerradas y al abrir conservaban una actividad antigua.
