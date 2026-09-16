# V1.0.5.6.33.25.10.7 · ACK REALTIME

- Corrige el estado visual que podía quedar en “Confirmando cambios en Firestore…” después de una escritura ya confirmada.
- Elimina la segunda lectura `getDoc` del camino exitoso de Outbox; `setDoc`/`deleteDoc` resueltos son el ACK del backend.
- Mantiene la verificación por lectura únicamente como recuperación cuando el cliente recibe un error transitorio.
- Agrega estado terminal determinista: Firebase conectado + Outbox 0 = SINCRONIZADO.
- Agrega watchdog visual local cada 2,5 s sin escrituras adicionales ni cambios en reglas/colecciones.
- Conserva listener Firestore en tiempo real y la reconciliación multi-PC como mecanismo de recuperación.
- No modifica cartas, histórico, inventario, planificación ni reglas de Firestore.
