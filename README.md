# ERP Planificación V28.21.50 — base V48, flujo de analistas con Spark

Se partió del ZIP V28.21.48 aportado por el usuario. La numeración V50 distingue esta entrega. Se conserva la conciliación de V48 y se corrige el flujo diario sin depender de una sesión JEFE. El ZIP original permanece intacto; su huella está en BASE_ORIGINAL.json.

## Resultado para los analistas

1. INICIAR: confirma EN PROCESO y la hora de inicio contra Firebase. Un doble clic o reintento conserva el inicio original.
2. REGISTRAR MUESTRAS: conserva total y parámetros junto con la operación de envío en una transacción local.
3. GUARDAR REACTIVOS: guarda una solicitud durable; la propia sesión del analista confirma sus consumos automáticamente. Cada fila se aplica con su constancia única y los saldos compartidos de ese lote en una transacción. Si se interrumpe una solicitud de varias filas, continúa por las no aplicadas; no repite las ya confirmadas. Cerrar la tarjeta no significa consumir de nuevo.
4. FINALIZAR: guarda la hora solicitada y mantiene el cierre pendiente hasta confirmar el inventario. Después guarda REALIZADO y los dos avisos en la misma transacción. Mientras confirma, no permite cambiar las muestras o los consumos incluidos en ese cierre.

No requiere cambiar Spark a Blaze, activar Cloud Functions, instalar n8n ni mantener una sesión JEFE abierta. Requiere conexión, autenticación y cuota de Firestore disponible para confirmar. No procesa operaciones con la aplicación cerrada en todos los equipos: las conserva y continúa cuando el analista vuelve a abrirla.

## Instalación: aplicación Y reglas

Actualizar solo Netlify no basta: las reglas de V48 impedían al analista confirmar el inventario compartido. Las reglas nuevas conceden un permiso acotado a descuentos documentados de sus propias actividades, sin autorizar edición administrativa de catálogo.

1. Exportar un respaldo actual en ambas computadoras. Conservar los datos del navegador, perfil y dirección del ERP.
2. Coordinar la actualización sin registros en curso. Publicar todos los archivos de este paquete en el mismo repositorio/sitio GitHub-Netlify.
3. Publicar el archivo **firestore.rules** completo de esta entrega en Firebase Console → proyecto **inventario-psi** → Firestore Database → Reglas → Publicar. No usar las reglas de V49.

Alternativa mediante Terminal, desde la carpeta que contiene firebase.json:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project inventario-psi
```

4. Cerrar las pestañas antiguas del ERP y volver a abrirlo en cada computadora. Confirmar V28.21.50 tanto en el pie como en el indicador de versión. No borrar datos ni IndexedDB para actualizar.
5. Hacer una prueba controlada: iniciar una actividad, registrar muestras, guardar un consumo, comprobar el saldo en otra computadora y finalizar una sola vez. Deben aparecer REALIZADO y los avisos. Comprobar de nuevo no debe cambiar el saldo.
6. Si queda pendiente, conservar los datos y revisar el mensaje en la tarjeta. Un error de permisos exige comprobar que se publicaron estas reglas y que el usuario está vinculado al analista correcto. Si hay saldos realmente distintos, saldo insuficiente o un peso inicial ya modificado, exige revisión; no se inventa un saldo para mostrar verde.

**No importar el ZIP como respaldo.** Es una actualización de archivos de aplicación. Los respaldos JSON son datos y se conservan aparte.

## Los 17 conflictos existentes

Si ya quedaron 17 después de la conciliación, esos siguen siendo los pendientes actuales. Esta actualización no restaura los 43 ni vuelve a descontar los 26 conciliados. Tampoco borra o elige automáticamente versiones de los otros registros. No repetir la recuperación de María Elena si ya fue confirmada.

Se conserva «Revisar consumo original y conciliar cierre · JEFE» de V48 para el caso documentado que aún no se haya recuperado. Esa herramienta necesita los originales locales en la computadora de María Elena; el flujo de nuevas operaciones funciona con la cuenta del analista.

## Protección aplicada

- Los analistas solo pueden modificar sus actividades. Catálogos: solo pueden descontar la fila del reactivo correspondiente a una solicitud pendiente propia, con aritmética validada, sin cambiar nombre, lote, modo, precio, asignaciones ni aumentar stock.
- En WEIGHT, el peso inicial debe coincidir con el compartido vigente y el final con la medición guardada. No se recalculan mediciones antiguas.
- Resultado por fila, saldo de las fichas compartidas y constancia se confirman juntos. Las constancias son inmutables en la colección stockReceipts y se referencian desde la solicitud de planning. Las confirmaciones recibidas se copian al registro de auditoría local, incluido en el respaldo tradicional de ese equipo. El respaldo tradicional no es una exportación completa de todas las constancias de otros equipos del servidor.
- Una respuesta perdida se recupera leyendo el estado confirmado. Las colisiones transitorias tienen reintentos acotados; cuota agotada o conexión caída activan espera.
- Abrir una ficha no escribe planificación ni borra consumos. Un reactivo adicional conserva lo ya confirmado y añade únicamente su nuevo registro.
- Los cierres confirmados no se reabren por una copia antigua. Los avisos determinísticos existentes no se vuelven a crear ni sobrescribir.
- No se hace una descarga completa adicional de Firebase cada 30 segundos. El verificador consulta primero la cola local y solo procesa solicitudes pendientes propias; JEFE puede revisar pendientes, pero no es una dependencia del trabajo normal.

Límites de esta entrega: hasta 16 filas de solicitud y 5 envases por reactivo para estas transacciones acotadas. El respaldo aportado tiene como máximo 10 reactivos por ficha y 2 envases. Una configuración que los supere se conserva pendiente con aviso para reorganizarla; no se salta la validación. Si un lote no tiene el mismo saldo en sus distintas fichas, la operación se detiene para conciliación. Las modificaciones administrativas de identidad/asignación de un lote con movimientos confirmados requieren revisión y no pueden eliminar su evidencia usando una copia antigua.

La aplicación depende de las cuotas normales de Spark; no garantiza confirmación inmediata sin conexión ni ausencia absoluta de incidentes. Los datos pendientes son visibles y conservan su evidencia.

## Pruebas realizadas

- 23 comprobaciones de regresión local.
- 24 comprobaciones de prevención con almacenamiento y servidor optimista simulados: concurrencia, doble clic, respuesta perdida, cola de consumo y cierre, stock insuficiente y protección de datos.
- 20 comprobaciones de recuperación sintética. Reproducción adicional con los dos respaldos reales: se mantiene la evidencia original TNT874, saldo 99 − 4 = 95 y 26 revisiones compatibles; no se modifica producción.
- 27 comprobaciones con **Firestore Emulator**: dos usuarios ANALISTA independientes, sin sesión JEFE para consumir, permisos acotados, aritmética, pesos, tres fichas compartidas, 10 reactivos, constancias y avisos. Incluye las funciones reales de iniciar, formulario de muestras, guardar consumo, sincronizar, confirmar y finalizar, con almacenes locales separados y una respuesta perdida después del commit.

No se ha instalado en producción ni realizado una prueba visual en navegador. La prueba operativa final en sus equipos sigue pendiente. Se incluyen scripts y resultados, sin los respaldos originales ni credenciales.

```bash
node --check app.js
node --check service-worker.js
node pruebas/regression.cjs
node pruebas/prevencion.cjs
node pruebas/recuperacion.cjs
```

Para repetir las pruebas de integración, instalar las dependencias fuera del directorio público del sitio y utilizar exclusivamente el proyecto demo:

```bash
npm install --prefix ../erp-test-deps firebase-tools@13.35.1 @firebase/rules-unit-testing@6.0.0 firebase@13.0.0
NODE_PATH=../erp-test-deps/node_modules ../erp-test-deps/node_modules/.bin/firebase emulators:exec --only firestore --project demo-erp-validation 'node pruebas/firebase-reglas.cjs'
```

La versión fijada del emulador se probó con Java 17 y Node 24. Estas dependencias son para pruebas, no forman parte de la aplicación publicada. El helper de integración no sustituye una prueba visual en navegador.
