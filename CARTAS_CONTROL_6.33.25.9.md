# V1.0.5.6.33.25.9 · Carta de control DQO EI-360

- Habilita la carta existente **Carta de control DQO (CC-0008)** como control térmico ejecutable.
- Equipo: **EI-360**.
- Parámetro/proceso: **DQO**.
- Objetivo: **150 °C**.
- Criterio técnico: **150 ± 2 °C (148–152 °C)**.
- Cálculo automático: error = lectura − 150 °C; cumplimiento por |error| ≤ 2 °C.
- Conserva fase de establecimiento de 10 registros, media/desviación, ±1s/±2s/±3s y reglas estadísticas existentes del motor.
- Historial, diagnóstico inteligente, Gestión de Cartas y trazabilidad Firebase usan exclusivamente los registros de la carta DQO.
- No modifica Fósforo total EI-154 ni Nitrógeno total.
- Sin cambios en reglas Firestore ni colecciones.
