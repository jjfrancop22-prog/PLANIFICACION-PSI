# V1.0.5.6.33.20.2 — Persistencia de Cartas de Control

- Corrige la deduplicación transversal que usaba solo `equipmentKey`.
- Un mismo equipo puede tener varias cartas funcionalmente distintas, por ejemplo EI-227 Pesaje y EI-227 Condiciones Ambientales.
- `renderControlChartEngine()` ya no elimina ni fusiona definiciones.
- Solo se reutiliza una definición al guardar cuando coinciden equipo + propósito/nombre de la carta.
- No borra registros históricos ni requiere cambios en reglas de Firebase.
