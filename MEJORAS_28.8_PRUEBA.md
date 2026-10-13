# V28.8 - Seguridad del analista (PRUEBA)

- Se conserva la independencia de guardar consumos frente a finalizar actividad.
- Se añadió confirmación de salida con cambios no guardados al cerrar el formulario técnico mediante Cancelar, X o Escape.
- Después de guardar consumos o lecturas se actualiza la referencia de cambios guardados.
- Se distingue visualmente el registro operativo de muestras del consumo de inventario dentro del formulario de finalización.
- Se mantienen las reglas existentes que impiden regresar una actividad REALIZADO a EN PROCESO mediante escritura ordinaria. Las reglas requieren despliegue independiente y pruebas.

PENDIENTE: extraer la captura de muestras a un control directo de Mi Jornada; esta versión solo cambia su identificación visual, no la ubicación. No se han probado escrituras reales en Firebase ni compatibilidad multipuesto.

Antes de usar en producción: probar con base aislada, validar cola Outbox, inventario, permisos y cierre confirmado.
