# V1.0.5.6.2 — Fix de arranque completo

Correcciones puntuales sobre V1.0.5.6.1:

- `refreshPlanner()` vuelve a existir como función global antes del arranque.
- Las llamadas de inicialización quedan protegidas.
- Se conserva `monthStartISO()`.
- Se conserva la eliminación definitiva/tombstone.
- Se conserva la limpieza de eliminados después de abrir IndexedDB.
- No se cambia DB_VERSION, IndexedDB, Firebase, usuarios ni roles.
