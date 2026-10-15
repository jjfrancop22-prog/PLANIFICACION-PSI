# ERP Planificación V28.21.30 — PRUEBA

Base: V28.21.29. Se conserva el cierre multi-PC.

- Cada 15 s se actualiza el indicador; si existen conflictos, la verificación exclusiva de Firestore se limita a una vez cada 90 s y a cuatro documentos por ciclo.
- Solo se archiva una operación conflictiva si Firebase confirma REALIZADO, existe metadato de cierre y todos los campos sustantivos de la operación coinciden.
- El payload original y el error quedan preservados en outbox como evidencia.
- No modifica planning de Firebase, inventario ni consumos. Las diferencias permanecen CONFLICTO.

**Prueba requerida:** instalar en el equipo de Joe sin limpiar datos locales; esperar dos minutos; verificar si el indicador se estabiliza. Si sigue CONFLICTO, exportar evidencia y revisar las diferencias reales. No se ha probado contra Firebase de producción.
