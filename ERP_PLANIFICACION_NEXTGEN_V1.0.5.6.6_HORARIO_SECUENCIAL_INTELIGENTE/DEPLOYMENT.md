# Despliegue controlado

## Estrategia
- `main`: versión estable publicada.
- `develop`: integración Firebase / mejoras en prueba.
- Etiquetas: `v1.0.0-baseline`, `v1.0.1`, etc.

## Flujo
1. Probar localmente.
2. Commit en `develop`.
3. Validar Firebase/roles/sincronización.
4. Merge a `main`.
5. Netlify despliega automáticamente `main`.
6. Validar PWA y actualización en dos computadoras.

## Regla crítica
No cambiar `DB_NAME='ERP_PLANIFICACION_NEXTGEN_CLEAN'` ni borrar IndexedDB durante actualizaciones.
