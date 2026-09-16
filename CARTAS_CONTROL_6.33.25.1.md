# Cartas de Control 6.33.25.1 — Recuperación doble Balanza

- Separa definitivamente Pesaje Balanza EI-227 de Condiciones Ambientales Balanza EI-285 / PF-09.
- Conserva el chartId y todos los registros BALANZA_MULTIPUNTO de Pesaje.
- Recupera Condiciones Ambientales desde definición archivada, registros BALANZA_AMBIENTE_EI285 o identidad técnica protegida.
- No fusiona ambas cartas aunque compartan métodos.
- Operación idempotente: recargar no crea nuevas definiciones.
