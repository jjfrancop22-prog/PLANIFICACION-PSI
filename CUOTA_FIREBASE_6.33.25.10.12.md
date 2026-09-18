# V1.0.5.6.33.25.10.12 · CUOTA FIREBASE / ANTI-LOOP

- Mantiene anti-duplicidad transaccional 10.10 y reconciliación multi-PC 10.11.
- Detecta `resource-exhausted`, `quota exceeded` y HTTP 429.
- Aplica backoff exponencial 30 s → 1 min → 2 → 4 → 8 → máximo 15 min.
- Durante cuota agotada no hace lectura de verificación adicional ni recorre el resto del Outbox.
- El heartbeat deja de intentar sincronizar cada 15 s; revisa cada 60 s y solo agenda flush si realmente existen pendientes.
- Una finalización rechazada por cuota NO marca REALIZADO ni descuenta inventario.
- La UI identifica `CUOTA FIREBASE` y conserva los datos locales.
