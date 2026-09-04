# ERP Planificación NextGen V1.0.4.4 — Inventario y Consumo de Reactivos

## Ubicación del Excel
**Dashboard Gestión → Inventario y Consumo**.

El mismo archivo Excel contiene dos hojas:

1. **CONSUMOS**
   - Fecha
   - Analista
   - Sección
   - Parámetro / actividad
   - Reactivo / material
   - Sólido / líquido / contable
   - Densidad
   - Tara
   - Peso inicial
   - Peso final
   - Consumo en g
   - Consumo en mL (líquidos)
   - Cantidad contable
   - Inventario neto final

2. **INVENTARIO ACTUAL**
   - Último peso bruto vigente
   - Tara del envase
   - Contenido neto actual en g
   - Contenido neto actual en mL para líquidos
   - Último uso, analista y actividad

## Tara
Para reactivos controlados por peso se configura la **tara del envase vacío**.

- Contenido neto actual (g) = peso bruto vigente - tara.
- Para líquidos: contenido neto actual (mL) = contenido neto actual (g) / densidad.

El analista sigue registrando únicamente el **peso final**; ese peso pasa a ser el inicial del siguiente uso.

No se cambió DB_VERSION, nombre de IndexedDB, Firestore, usuarios, roles ni sincronización.
