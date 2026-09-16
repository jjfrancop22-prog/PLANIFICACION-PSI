# 6.33.25.2 — ACK OUTBOX CARTAS

- Mantiene las 21 cartas.
- Confirma por contenido funcional cuando Firestore ya contiene el cambio.
- Ignora diferencias exclusivamente temporales (`updatedAt`, `_cloudUpdatedAt`) para el ACK.
- No oculta errores funcionales ni de permisos.
- La recuperación de cartas críticas corre una sola vez por sesión y no se reactiva por cada render.
