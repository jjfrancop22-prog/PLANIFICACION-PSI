# V1.0.5.6.33.25.10.15 · Autorreparación de planificación multi-PC

- Corrige el caso en que una PC muestra una agenda parcial o vacía aunque Firestore sí contiene las actividades.
- `planning` se reconstruye con lectura explícita desde servidor (`getDocsFromServer`) al iniciar/reanudar y al entrar al Planificador, con limitación temporal para no aumentar lecturas innecesariamente.
- Un snapshot `fromCache` de Firestore ya no puede eliminar actividades locales por ausencia. La poda de huérfanos solo ocurre con snapshot confirmado por servidor.
- Listener usa `includeMetadataChanges` para distinguir caché de servidor.
- Mantiene Outbox y protege cambios locales pendientes de la sesión actual.
- El usuario ya no debe borrar historial/IndexedDB de Chrome para recuperar la planificación.
