# 6.33.17.1 · Corrección de detección EI-344

- Corrige la identificación de equipos escritos como `EI-344`, `EI 344` o `EI344`.
- La carta EI-344 deja de quedar como HABILITADA y abre su formato técnico inteligente.
- Prioriza EI-344 antes de la detección genérica de Nevera EI-269 para impedir que se abra el formulario equivocado.
- También reconoce equipmentKey, controlKey, configuración metrológica y notas.
- No modifica definiciones Firebase ni registros históricos al abrir como ANALISTA.
