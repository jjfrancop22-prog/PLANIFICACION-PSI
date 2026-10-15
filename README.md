# ERP Planificación V28.21.31 — prueba de ahorro de lecturas

Esta versión conserva las 17 entradas del ZIP original. Cambios limitados a las verificaciones de conflictos redundantes: no consultar Firestore cuando la pestaña está oculta; durante inactividad con pestaña visible, comprobar cada 15 min; con actividad, cada 90 s. Se conserva la escucha en tiempo real de las ocho colecciones y la sincronización de cierres y reactivos.

**Limitación:** esta optimización no garantiza una reducción significativa de las 6.700 lecturas, que podrían proceder de los snapshots iniciales o de otros clientes. No ha sido validada contra Firebase de producción.

Prueba: comparar lecturas de Firebase en ventanas equivalentes antes/después, con igual número de sesiones, y verificar cierres con dos equipos. No borrar IndexedDB ni restablecer la base.
