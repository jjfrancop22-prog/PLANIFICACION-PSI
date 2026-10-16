# ERP Planificación V28.21.48 — recuperar consumo original y cierre

## Hallazgo en los respaldos del 15 de octubre de 2026

Archivos analizados: «JISPSON RESPALDO.json» (JEFE) y «RESPALDO_ERP_PLANIFICACION_V1.0.5.6.33.25.10.28.21.47_2026-10-15.json» (María Elena). Los originales se mantienen intactos y no se incluyen en el sitio.

Actividad: PLA-20261015-0384, Recepción de muestras e ingreso de OT (Alta demanda), María Elena, 15/10/2026.

| Evidencia | Respaldo del JEFE | Respaldo de María Elena |
|---|---|---|
| Estado | EN PROCESO | REALIZADO local |
| Inicio | 08:23 | 08:23 |
| Cierre | Ausente | 16:10:53 |
| Muestras | 5 | 5 |
| Parámetros | DQO 4; DBO5 2; Tensoactivos 4 | Coinciden |
| Kit DQO, lote AG2A1229 | 264 − 4 = 260 | Coincide |
| TNT874, lote 26015 | Ausente del resultado de consumo; catálogo 99 | El conflicto original conserva 99 − 4 = 95; la copia posterior lo marca no utilizado con saldo 95 |

El consumo original de TNT874 está en la operación OUT-1792095479476-W56C1, registrado a las 15:17:59 del 15/10/2026. No es necesario inventar ni volver a ingresar las cuatro unidades: se recupera esa evidencia original.

Los 43 conflictos de María Elena son operaciones, no 43 actividades distintas. De ellos, 26 corresponden a esta actividad. Además existen 99 operaciones de catálogo BLOQUEADO_PERMISOS: la cuenta ANALISTA no tiene autorización para modificar el catálogo compartido.

## Uso de la conciliación

1. Publicar todos los archivos de V28.21.48 en el mismo sitio GitHub/Netlify.
2. En la computadora de María Elena, conservar el mismo navegador, perfil y dirección. No borrar datos ni IndexedDB.
3. Ingresar con la cuenta del JEFE. Entrar a Mi Jornada, seleccionar María Elena y el 15/10/2026.
4. En Recepción aparecerá «Consumo original retenido en conflictos» y el botón «Revisar consumo original y conciliar cierre · JEFE».
5. El botón consulta Firebase y prepara una confirmación con nombre, lote, cantidad original, saldo, muestras y hora de cierre. Revisar que corresponda a TNT874 lote 26015, 4 unidades, 99 → 95, cinco muestras y cierre original 16:10.
6. Confirmar una vez. Esperar el mensaje «CONCILIACIÓN CONFIRMADA».
7. En la computadora del JEFE, verificar REALIZADO, aviso de cierre y consumo, y saldo 95 del lote en las tres fichas compartidas. Las 4 unidades del kit DQO se conservan como estaban, sin otro descuento.

La conciliación requiere JEFE y evidencia original local. Por eso debe ejecutarse en la computadora y navegador de María Elena que conservan los conflictos. La computadora del JEFE no dispone de esa cola local.

## Comportamiento y controles

- Compara identidad, inicio, muestras, parámetros y curvas contra el servidor. Las cantidades de reactivos ya confirmadas deben coincidir exactamente.
- Solo recupera reactivos adicionales ausentes del resultado de Firebase, con consumo positivo y saldos aritméticamente consistentes en una operación original de Outbox.
- Si hay varias evidencias originales con valores contradictorios, no elige una automáticamente.
- Revalida dentro de una transacción el planning y las fichas del lote. Solo acepta el saldo original 99 o el saldo final 95. Un saldo diferente o un ajuste posterior bloquean el cambio completo.
- Publica en la misma transacción el planning recuperado, las tres fichas de lote, la auditoría y dos avisos determinísticos. La hora de finalización sigue siendo la original; la fecha administrativa de conciliación se conserva aparte.
- Conserva la fecha original del consumo; no lo convierte en un movimiento nuevo fechado en el momento de la conciliación.
- Guarda en auditoría el resultado previo remoto, la copia local posterior y la operación original elegida. No elimina las revisiones: archiva únicamente las compatibles con la conciliación confirmada, conservando payload y error original.
- En la reproducción de estos respaldos, 26 revisiones son archivables y 17 conflictos corresponden a otros registros y permanecen protegidos. El número real puede variar si los datos cambian antes de aplicar.
- Si el consumo o saldo ya fue conciliado por esta acción, repetir el botón no vuelve a descontar.
- No reactiva los 99 intentos administrativos bloqueados ni cambia las reglas de permisos de Firebase.

Esta herramienta recupera el caso documentado. No aplica una limpieza masiva de otros conflictos ni establece cuál versión de otros registros es correcta.

## Validación realizada

23 comprobaciones previas de regresión y 20 comprobaciones específicas de recuperación en Node.js con Firestore y almacenamiento simulados. Las pruebas de recuperación también se ejecutaron con los valores de ambos respaldos reales: selección de la operación original, estado, saldos, tres fichas, cierre, auditoría, avisos, archivo de revisiones y repetición sin descuento adicional. Se comprobó que la condición y el HTML del botón funcionan con los datos de María Elena.

No se ejecutó en un navegador ni se conectó a Firebase de producción. El estado de producción solo cambia cuando el JEFE revisa y confirma desde el ERP.

```bash
node --check app.js
node pruebas/regression.cjs
node pruebas/recuperacion.cjs
python3 -m http.server 8080
```

Las pruebas usan datos sintéticos en memoria y no realizan conexiones de red. Abrir la aplicación real en localhost utiliza su configuración Firebase habitual.
