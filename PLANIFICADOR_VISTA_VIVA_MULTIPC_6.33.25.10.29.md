# 10.29.0 · Vista viva multi-PC

- Corrige el caso intermitente donde una planificación remota sí llegaba a IndexedDB/Firebase pero no se reflejaba en la PC que tenía abierto el formulario del Planificador.
- La causa era `plannerHasActiveDraft()`: protegía correctamente el borrador, pero bloqueaba también el repintado de Carga del día, Agenda y Vista ejecutiva.
- Desde 10.29 el formulario activo se conserva sin tocar, mientras los paneles de solo lectura se actualizan en tiempo real con la planificación reconciliada.
- No cambia la guardia multi-PC 10.28, límites de 8 h, cruces, duplicados, cartas de control ni estructura Firebase.
