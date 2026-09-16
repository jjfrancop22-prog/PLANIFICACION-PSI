# V1.0.5.6.33.21.2 — Consolidación trazable Balanza EI-227

- Conserva una sola definición visible de la carta de pesaje EI-227.
- Selecciona como canónica la definición con mayor cantidad de registros BALANZA_MULTIPUNTO.
- Reasocia a la canónica cualquier registro histórico ligado a recuperaciones duplicadas, conservando `originalChartId`.
- No elimina registros ni definiciones: las duplicadas quedan INACTIVAS, archivadas y ocultas.
- Une áreas y métodos aplicables para no perder alcance.
- Evita que la recuperación vuelva a mostrar duplicados.
