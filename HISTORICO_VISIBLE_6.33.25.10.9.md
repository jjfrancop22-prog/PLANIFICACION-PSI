# V1.0.5.6.33.25.10.9 · HISTÓRICO VISIBLE

- Corrige registros históricos que se guardaban correctamente pero no aparecían en la carta mensual por diferencia de `controlType`.
- Compatibilidad retroactiva: los históricos ya guardados se muestran sin volver a ingresarlos.
- Corregido para Nevera EI-269 / Nevera de Agares EI-69, Congelador EI-350, ambiente Microbiología EI-347, condiciones de Balanza EI-285 y Metales EI-313.
- Los nuevos históricos se guardan con el mismo tipo técnico que los controles normales.
- DBO5, pH y Conductividad conservan su funcionamiento actual.
- No elimina ni duplica registros y no modifica Firestore salvo las nuevas cargas que el usuario realice.
