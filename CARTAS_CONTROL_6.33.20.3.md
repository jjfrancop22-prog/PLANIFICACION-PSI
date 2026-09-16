# V1.0.5.6.33.20.3 — Control diario compartido

- Los controles diarios ejecutables se consideran únicos por fecha + carta/equipo, no por analista.
- Si un analista completa Conductividad, pH, DBO5, Incubadora, Nevera, Balanza, condiciones ambientales, Metales u otro control diario ejecutable, los demás analistas vinculados lo ven como COMPLETADA.
- Los guardados diarios dejan de aceptar un segundo registro del mismo chartId y fecha aunque cambie el analista.
- Se conserva el responsable original para trazabilidad.
- No se modifican reglas de Firebase ni registros históricos.
