# V1.0.5.6.1 — Fix monthStartISO

Corrección puntual de arranque de V1.0.5.6:

- Se restaura `monthStartISO()` como función global disponible antes de la inicialización.
- La limpieza de planificaciones eliminadas se ejecuta únicamente después de abrir IndexedDB.
- Se conserva la eliminación definitiva/tombstone de V1.0.5.6.
- No se cambia DB_VERSION, IndexedDB, Firebase, usuarios, roles ni datos.
