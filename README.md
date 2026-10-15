# ERP Planificación V28.21.46 — cierre y confirmación

## Corrección

La versión 45 podía guardar los consumos y, al finalizar, sustituir el resultado con marca de inventario por los valores del formulario. Esto podía reprocesar el consumo y producir diferencias con los resultados que ya estaban en Firebase. La nueva versión conserva el resultado guardado y no vuelve a descontarlo al cerrar. También evita que una respuesta atrasada de sincronización confirme una revisión posterior aún no enviada.

- Guardar y cerrar conserva el mismo consumo, los saldos y las marcas originales.
- El doble clic en confirmar procesa una sola solicitud.
- Una operación idéntica a un conflicto protegido no crea otra operación pendiente automáticamente.
- Los avisos determinísticos se ponen en cola después de la confirmación del cierre en Firebase, antes del reconocimiento local del envío. Una respuesta equivalente del servidor también permite recuperarlos.
- Mi Jornada distingue «Cierre local pendiente» y ofrece «Reintentar confirmación (sin consumo)».
- El reintento consulta el servidor, compara identidad, muestras, parámetros, reactivos y curvas. Solo solicita el cierre si los datos técnicos coinciden. No ejecuta movimientos de inventario.

## Aplicación y caso de María Elena

1. Conservar un respaldo exportado de cada navegador antes de actualizar. Mantener los datos locales y los conflictos; no borrar IndexedDB ni restablecer el navegador.
2. Publicar el contenido completo del ZIP en el mismo sitio del ERP, manteniendo la dirección habitual. No se necesita cambiar la configuración ni las reglas de Firebase para este cambio.
3. Actualizar la aplicación y comprobar V28.21.46 en ambas computadoras.
4. En la misma computadora, navegador y dirección donde María Elena cerró a las 16:10, abrir Mi Jornada y usar «Reintentar confirmación (sin consumo)» si figura pendiente.
5. Si coincide la evidencia, se confirma el cierre y se ponen los avisos en cola para el JEFE. Si informa «Diferencia técnica», conservar ambos registros: este paquete no fuerza ni corrige los saldos históricos de manera automática. La revisión de los conflictos permite exportar su evidencia.
6. Verificar en la computadora del JEFE que la actividad deja de aparecer EN PROCESO y aparece el aviso de cierre.

Los 43 conflictos actuales son registros locales que este ZIP no puede inspeccionar por sí solo. La conciliación existente únicamente archiva los que estén reflejados en Firebase; las diferencias reales se conservan. No se ha accedido ni modificado su Firebase de producción.

## Validación local

21 comprobaciones de regresión aprobadas con Node.js, un adaptador de transacciones locales en memoria y un servidor Firestore simulado. Incluyen saldo 99 − 4 = 95, pesos, doble clic, respuestas tardías, cierre y avisos, rechazo de diferencias técnicas y recuperación sin inventario. Comprobación sintáctica de JavaScript y uniformidad de versión. Estas pruebas no sustituyen la comprobación real con dos computadoras; no se ejecutaron en un navegador ni contra Firebase de producción.

Desde la carpeta descomprimida:

```bash
node --check app.js
node pruebas/regression.cjs
python3 -m http.server 8080
```

La prueba de regresión usa datos en memoria y no conecta a Firebase. Para abrir el ERP local, visitar http://localhost:8080; la aplicación real utiliza su configuración habitual.
