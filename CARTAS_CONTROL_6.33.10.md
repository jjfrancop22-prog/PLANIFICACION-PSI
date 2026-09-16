# Cartas de Control 6.33.10 — Conductividad IA

Se incorpora Conductividad EI-104 con tres niveles independientes: 84 µS/cm, 1413 µS/cm y 12.88 mS/cm.

Criterio técnico establecido: ±5% del valor nominal. Límites: 79.80–88.20 µS/cm; 1342.35–1483.65 µS/cm; 12.236–13.524 mS/cm.

Cada nivel mantiene media, desviación y reglas estadísticas independientes (1_2s, 1_3s, 2_2s, R_4s, 7x, 7T). Resultado global CUMPLE solo cuando los tres niveles cumplen. Registros se guardan en controlChartRecords y sincronizan por Firebase/Outbox existente. Gestión Calidad incorpora tres gráficas y detalle trazable.
