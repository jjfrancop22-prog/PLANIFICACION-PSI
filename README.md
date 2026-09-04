# ERP Planificación NextGen V1.0.5.1 — Menú de requisitos técnicos

En Mi Jornada, cada actividad que requiere datos técnicos muestra un bloque visible:

**Requisitos para finalizar**
- Curva de calibración.
- Reactivos / materiales.

El analista puede entrar en **Registrar datos técnicos** antes del cierre, guardar la curva/reactivos y luego finalizar la actividad. Al pulsar Finalizar, el ERP vuelve a validar todo y cierra en conjunto.

Para actividades ya REALIZADAS, aparece **Ver / Editar datos técnicos** aunque la planificación sea antigua, porque la tarjeta consulta también el catálogo actual.

Se oculta el bloque redundante “Últimas 5 actividades realizadas”; el acceso queda directamente en cada actividad realizada.

La edición post-cierre mantiene estado y horarios originales y deja trazabilidad.

No se cambió DB_VERSION, IndexedDB, Firestore, usuarios ni roles.
