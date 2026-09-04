# V1.0.5.6 — Eliminación definitiva de planificación

Corrección de persistencia:

- Al eliminar una actividad de planificación se crea primero una marca local de eliminación (tombstone).
- Luego se elimina de IndexedDB, se envía DELETE a Firestore y se fuerza el Outbox.
- Si una actualización/realtime intenta devolver el mismo registro desde la nube, la marca de eliminación impide que reaparezca.
- Los comentarios asociados también se eliminan.
- Las vistas Planificador, Mi Jornada, Seguimiento Diario y Dashboard excluyen registros eliminados.
- La carga diaria se calcula solo con actividades vigentes y se deduplica por ID.
- Se mantiene auditoría `ELIMINAR_PLANIFICACION_DEFINITIVA`.

No se cambia DB_VERSION, nombre de IndexedDB, usuarios, roles ni estructura principal de Firestore.
