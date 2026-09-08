## V1.0.5.6.21 — Catálogo vivo en actividades abiertas
- Al editar reactivos/materiales en el Catálogo Maestro, las actividades ya PROGRAMADAS o EN PROCESO reciben la configuración nueva sin tener que eliminarlas ni reprogramarlas.
- La actualización también se verifica al abrir “Registrar datos técnicos” o “Finalizar actividad”, por lo que corrige actividades creadas antes de instalar esta versión.
- Si se agrega un nuevo reactivo/lote después de un guardado parcial, se conserva lo ya registrado y el nuevo reactivo aparece pendiente para marcarlo como USADO o NO UTILIZADO.
- Las actividades REALIZADAS no se modifican automáticamente, para preservar trazabilidad histórica.

## V1.0.5.6.19 — Corrección de campana técnica
- Las alertas técnicas se generan como eventos del sistema dirigidos al JEFE.
- Funcionan cuando registra el analista y también cuando el JEFE prueba/corrige desde Mi Jornada.
- La versión visible del ERP ya muestra V1.0.5.6.19 para evitar confusión con la V1.0.5.6.16.
- Los analistas no reciben como nuevas sus propias alertas técnicas automáticas.

## V1.0.5.6.12 · Reactivo + lote como identidad

- Permite registrar el mismo reactivo varias veces cuando el lote es diferente.
- Bloquea únicamente duplicados exactos de nombre de reactivo + lote.
- En la finalización del analista se muestran los lotes por separado para poder consumir el lote que corresponda.
- Mantiene la trazabilidad y el saldo independiente por lote.
- Conserva todas las mejoras de V1.0.5.6.11.


## V1.0.5.6.18 — Alertas técnicas inteligentes
- Cuando un analista guarda una curva, el Jefe recibe una notificación en la campana con puntos, réplicas y R² cuando esté disponible.
- Cuando un analista guarda consumo de reactivos/materiales, el Jefe recibe el resumen del consumo y una advertencia si el registro deja un envase/material agotado o susceptible de baja.
- Al finalizar una actividad con datos técnicos, se genera un aviso de cierre técnico para diferenciar un avance de un registro definitivo.
- Las alertas usan el mismo Centro de Comunicaciones y pueden marcarse como atendidas, sin obligar al Jefe a revisar Seguimiento Diario.


## V1.0.5.6.21 — Alertas técnicas con detalle consistente
- Guardar curva sin finalizar: alerta inmediata CURVA · GUARDADO PARCIAL con puntos, réplicas y estadísticos disponibles.
- Guardar consumos sin finalizar: alerta inmediata INVENTARIO / CONSUMO · GUARDADO PARCIAL con reactivo, lote y consumo.
- Confirmar finalización: genera avisos finales detallados de CURVA e INVENTARIO y un CIERRE TÉCNICO consolidado.
- El cierre técnico ya no muestra solo conteos: incluye el detalle de los consumos y los indicadores principales de la curva.
