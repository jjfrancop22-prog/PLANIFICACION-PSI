# V1.0.5.6.33.25.10.23.0

- Motor Westgard unificado: 10 resultados iniciales establecen media/DE y los límites quedan fijos para evaluaciones posteriores.
- 1_2s = advertencia; 1_3s, 2_2s, 4_1s y 10x = acción/fuera de control; 7T = vigilancia complementaria.
- R_4s no se aplica entre días.
- pH recalcula toda la serie al abrir gestión y después de una corrección, eliminando estados heredados inconsistentes.
- Duplicados pH con mismo chartId + fecha/hora se depuran automáticamente conservando el registro más recientemente actualizado.
- Edición pH conserva trazabilidad y actualiza la vista en sitio, sin recargar toda la gestión ni producir parpadeo/pestañeo innecesario.
