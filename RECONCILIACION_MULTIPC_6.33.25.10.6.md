# 6.33.25.10.6 · Reconciliación multi-PC

- No cambia colecciones, reglas ni datos de Firebase.
- Los listeners Firestore actualizan inmediatamente el módulo visible.
- Al recuperar foco/volver de minimizado: Outbox → nube → interfaz.
- Heartbeat visual cada 15 s mientras la pestaña está visible.
- Estado SINCRONIZADO confirma Firestore + interfaz cuando no existen pendientes.
- Conserva carga histórica universal 10.5.
