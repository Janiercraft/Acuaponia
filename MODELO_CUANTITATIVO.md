# Modelo cuantitativo del simulador acuapónico

Esta versión agrega parámetros editables y un balance de masa simplificado para que la maqueta responda a cambios de población, alimentación, volumen y distribución de caudal.

## Parámetros editables

- Estanque: ancho, alto y largo.
- Peces: cantidad, peso promedio, alimento por pez y proteína del alimento.
- Cultivo: número de plantas, filas, largo mínimo, diámetro/ancho de tubo y altura.
- Fotobiorreactor: ancho, alto y profundidad/largo.
- Hidráulica: caudal total de recirculación y porcentaje de reparto Plantas/PBR.

Los parámetros estructurales se almacenan en `localStorage` (`aquaModelConfig`). Al pulsar **Aplicar y reconstruir maqueta**, la página se recarga y toda la geometría 3D se recalcula.

## Fórmulas principales

- Alimento total (g/día) = número de peces × alimento por pez (g/día).
- Residuos sólidos (g/día) ≈ alimento × 0,28.
- Nitrógeno en alimento (g N/día) = alimento × fracción de proteína × 0,16.
- TAN-N generado (g N/día) ≈ nitrógeno en alimento × 0,35.
- Eficiencia de nitrificación = 0,88 × factor de caudal × factor de oxígeno × factor de fallas × factor de bomba.
- NO3 producido (g/día) ≈ TAN-N × eficiencia × 62/14.
- NO3 a plantas = NO3 producido × fracción de caudal a plantas.
- NO3 a PBR = NO3 producido × fracción de caudal a PBR.
- NO3 por planta = NO3 a plantas / número de plantas.

La productividad de plantas y PBR es una estimación escalada por nutrientes disponibles, caudal, luz y volumen. No representa una predicción certificada de producción.

## Adaptación geométrica

Con **Alargar automáticamente los tubos** activado:

1. Se calcula el número de plantas por fila.
2. Se determina un largo mínimo para conservar separación entre plantas.
3. Si ese largo supera el ingresado por el usuario, los tubos se alargan.
4. El fotobiorreactor, la bomba de CO2 y el depósito se desplazan hacia la derecha.
5. Las tuberías se recalculan a partir del nuevo layout.

## Importante

El modelo es educativo y sirve para comparar escenarios. Antes de usarlo para decisiones reales de cultivo debe calibrarse con datos medidos del sistema: especie/talla de pez, composición real del alimento, tasa de alimentación, eficiencia de remoción de sólidos, biofiltro, temperatura, oxígeno, especie vegetal, área foliar, iluminación del PBR y productividad experimental de microalgas.


## Ajustes geométricos adicionales
- El campo de peso promedio por pez acepta incrementos de 0,01 kg.
- La bomba de aire/CO₂ escala proporcionalmente con el volumen geométrico del fotobiorreactor.
- La tubería de retorno del área de plantas calcula un desvío alrededor del volumen del PBR para evitar atravesarlo al cambiar dimensiones.
