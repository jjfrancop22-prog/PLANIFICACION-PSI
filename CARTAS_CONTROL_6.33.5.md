# V1.0.5.6.33.5 — Cartas Firebase / permisos multi-PC

- Conserva intactas las colecciones y reglas operativas existentes del ERP.
- Autoriza `controlChartDefs` para lectura de usuarios activos y escritura de JEFE.
- Autoriza `controlChartRecords` para usuarios activos; borrado reservado a JEFE.
- Los pendientes existentes de Outbox NO se eliminan: se reintentan tras publicar reglas.
- El estado superior diferencia fallas del núcleo ERP de permisos exclusivos de Cartas.
- Versionado PWA, `version.json`, `VERSION.json`, Service Worker e `index.html` alineados en 6.33.5.
- `PUBLICAR_REGLAS_FIREBASE.command` despliega únicamente `firestore.rules` al proyecto `inventario-psi` usando Firebase CLI.

Prueba esperada: publicar reglas → abrir ERP → Sincronizar ahora → pendientes de Cartas bajan a 0 → crear una carta → verificarla desde otra PC.
