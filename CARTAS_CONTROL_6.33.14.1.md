# V1.0.5.6.33.14.1 — Deduplicación transversal

- Una carta transversal se identifica por Equipo / clave de control.
- Guardar nuevamente actualiza la definición existente; no crea otra.
- ID determinista para nuevas cartas transversales evita carreras entre equipos.
- Duplicados existentes se fusionan conservando áreas y métodos y se retiran de Firebase por JEFE.
- No cambia registros históricos ni las cartas específicas existentes.
