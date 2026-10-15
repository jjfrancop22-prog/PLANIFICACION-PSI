# ERP Planificación V28.21.31 — prueba de ahorro de lecturas

Esta versión conserva las 17 entradas del ZIP original. Cambios limitados a las verificaciones de conflictos redundantes: no consultar Firestore cuando la pestaña está oculta; durante inactividad con pestaña visible, comprobar cada 15 min; con actividad, cada 90 s. Se conserva la escucha en tiempo real de las ocho colecciones y la sincronización de cierres y reactivos.

**Limitación:** esta optimización no garantiza una reducción significativa de las 6.700 lecturas, que podrían proceder de los snapshots iniciales o de otros clientes. No ha sido validada contra Firebase de producción.

Prueba: comparar lecturas de Firebase en ventanas equivalentes antes/después, con igual número de sesiones, y verificar cierres con dos equipos. No borrar IndexedDB ni restablecer la base.

V28.21.34: apertura de actividades mediante transacción Firestore confirmada antes de notificar; bloqueo de regresión PROGRAMADO. Prueba controlada, no verificada contra Firebase de producción.

V28.21.35: catálogo por peso con formulario de envases equivalente a la ficha: lote individual, tara, peso bruto, cálculo neto y volumen líquido según densidad. No probado contra Firebase en vivo.

V28.21.42: panel de errores locales visible, sin depender de tooltip; sin eliminación automática de conflictos ni modificaciones a consumos.
