## V1.0.5.6.8 · Inicio manual + sincronización visible

Cambio puntual sobre V1.0.5.6.6:

- Firebase Auth usa persistencia en memoria: cada apertura/recarga solicita nuevamente correo y contraseña.
- Cerrar sesión siempre vuelve a la pantalla de acceso.
- El ERP no se abre inmediatamente después de autenticar: primero muestra **SINCRONIZANDO…** en rojo.
- Durante ese estado se valida `users/{UID}`, se descarga Firestore, se procesa Outbox y se activa Live Sync.
- Solo después de completar el proceso se oculta el acceso y se abre el ERP según el rol.
- Se conserva horario secuencial inteligente, peso final/consumo y sincronización de eliminaciones multi-PC.
