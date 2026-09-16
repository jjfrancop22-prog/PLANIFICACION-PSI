# V1.0.5.6.33.24.2 — Persistencia robusta de Cartas

- Protege una definición local mientras su CREATE/UPDATE está pendiente: un snapshot remoto anterior ya no puede sobrescribirla.
- Coalesce Outbox por entidad + ID: varias ediciones de la misma carta mantienen una sola operación abierta.
- Conserva la última edición y evita el contador transitorio PENDIENTE 1/2/3 por cambios repetidos del mismo documento.
- No elimina, fusiona ni deduplica cartas por compartir métodos.
- No cambia colecciones ni reglas de Firebase.
