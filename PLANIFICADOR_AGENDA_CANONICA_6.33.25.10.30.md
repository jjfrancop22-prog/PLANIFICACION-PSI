# V1.0.5.6.33.25.10.30.0 — Agenda canónica Firebase

Corrección del caso intermitente donde la PC que creaba una planificación la mostraba inicialmente y segundos después regresaba visualmente a una carga anterior, mientras las otras PCs sí conservaban la nueva actividad.

## Cambio
En la vista Planificador, carga del día, agenda, línea de tiempo y cálculos de disponibilidad consultan una fotografía canónica de `planning` en Firestore para la fecha seleccionada. Esa fotografía hidrata IndexedDB y evita que una copia local atrasada vuelva a dominar la interfaz.

Se mantiene intacto el formulario activo durante reconciliaciones, así como la protección multi-PC, límite diario, cruces, duplicados, Cartas de Control y Westgard.
