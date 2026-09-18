# V1.0.5.6.33.25.10.13 · CIERRE LOCAL IDEMPOTENTE

- El cierre de actividad vuelve a ser operativo e inmediato: no exige `runTransaction()` antes de finalizar.
- Si Firebase está sin conexión o con cuota temporalmente limitada, el cierre se confirma localmente y queda en Outbox para sincronización posterior.
- Cada cierre usa `completionOperationId = FINAL-{planId}`.
- Planning y avisos automáticos usan IDs determinísticos, por lo que una reconexión/reintento actualiza el mismo registro en vez de crear otro.
- Se mantienen el bloqueo local de doble clic, la coalescencia de Outbox, la reconciliación multi-PC y el backoff anti-loop de Firebase.
- La PWA usa una caché 10.13 nueva para evitar mezclar código anterior.
