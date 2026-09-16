# V1.0.5.6.33.19.2 — Control diario global por equipo

- Las cartas transversales DAILY_EQUIPMENT se consideran completadas por fecha + carta/equipo, no por analista.
- Balanza EI-227: un registro de cualquier analista completa la carta para todos los analistas vinculados ese día.
- La tarjeta muestra COMPLETADA y el responsable que ejecutó el control.
- Al abrir una Balanza ya completada, el formulario queda en modo consulta y no permite un segundo registro.
- El ID de nuevos controles de Balanza es determinista por carta + fecha para reforzar deduplicación entre equipos/PC.
- Se preservan registros históricos y no se modifican reglas Firebase.
