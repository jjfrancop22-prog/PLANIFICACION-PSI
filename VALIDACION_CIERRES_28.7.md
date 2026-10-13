# Validación de cierre JEFE — V28.7

- La operación no modifica IndexedDB antes de la confirmación de la transacción Firestore.
- Si Firebase rechaza la operación, el estado permanece intacto.
- Se comprueba la revisión remota, y que no esté REALIZADO/CANCELADO.
- No se ejecutan movimientos de inventario.
- Si no consta actualFinishedAt, NO se inventa una hora real: completionCommittedAt es la fecha de regularización administrativa.
- No se ejecutaron pruebas integradas contra Firebase: utilizar proyecto aislado antes de producción.
- No desplegar reglas sin revisarlas.
