# Simulador de Sistema Acuapónico

Maqueta digital animada del sistema acuapónico: peces → filtro mecánico →
biofiltro → (plantas / fotobiorreactor en paralelo) → bomba/depósito →
peces, construida con HTML5, CSS3 y JavaScript puro (sin frameworks ni
backend).

## Cómo ejecutarlo

No requiere instalación ni servidor. Simplemente abre `index.html` con
doble clic o arrastrándolo a tu navegador (Chrome, Edge o Firefox
recomendados).

```
aquaponic-simulator/
├── index.html          ← abrir este archivo
├── style.css
├── app.js               ← estado central y bucle de simulación
├── modules/
│   ├── waterFlow.js      ← animación de tuberías y utilidades de recorrido
│   ├── nutrients.js      ← partículas de residuos y nutrientes (con bifurcación plantas/PBR)
│   ├── fish.js            ← comportamiento visual de los peces
│   ├── plants.js          ← generación y crecimiento de las plantas
│   ├── photobioreactor.js ← estado visual del fotobiorreactor (luz, biomasa)
│   ├── monitoring.js      ← tarjetas de parámetros y minigráficas
│   └── mqttBridge.js      ← puente opcional a un broker MQTT real (inactivo por defecto)
├── esp32/
│   ├── aquaponic_sensor_node.ino  ← firmware de ejemplo (ESP32 + MQTT)
│   └── README_ESP32.md            ← guía de cableado y puesta en marcha
└── assets/               ← (reservado para íconos/imágenes futuras)
```

## Qué incluye esta primera versión

- **Vista Simulación**: diagrama SVG animado con el recorrido completo del
  agua. A la salida del biofiltro el caudal se bifurca en dos ramas —
  **plantas** y **fotobiorreactor (PBR)** — que vuelven a converger antes
  de la bomba; partículas de residuos (café) quedan retenidas en el filtro
  mecánico, y partículas de nutrientes cambian de color al atravesar el
  biofiltro (amoníaco → nitrito → nitrato) y, en la rama del PBR, una vez
  más al pasar por el reactor (actividad biológica con luz) antes de
  volver a unirse con la rama de las plantas.
- **Fotobiorreactor**: reactor translúcido con iluminación (☀️ luz PBR
  on/off), microalgas y burbujas animadas, y un control independiente de
  activo/pausado — se puede pausar sólo esa rama sin detener el resto del
  sistema. Un slider de caudal reparte el flujo entre plantas y PBR
  (ej. "Plantas 60% · PBR 40%") y alimenta tanto la simulación visual de
  partículas como las alertas (sin flujo, luz apagada, actividad
  biológica baja, caudal demasiado bajo).
- **Crecimiento progresivo de algas**: la biomasa arranca casi en cero y
  crece con una curva logística (rápido al principio, se aplana sola cerca
  del máximo — nunca lo supera) cuya velocidad depende de la luz, el
  caudal hacia el PBR y el nitrato disponible. Se ve como un campo de ~26
  colonias/filamentos que van revelándose y meciéndose suavemente con el
  flujo a medida que crece la biomasa, con 5 etapas nombradas
  (iniciando → crecimiento temprano → activo → alta actividad → biomasa
  elevada) y un tinte verde del agua que se intensifica en paralelo. Se
  congela en pausa y vuelve a 5% al reiniciar. Incluye presets de
  velocidad (1×/2×/5×/10×) para acelerar la demostración.
- **Vista Monitoreo**: temperatura, pH, amoníaco, nitrito, nitrato y
  oxígeno, cada uno con minigráfica de tendencia; estado de componentes
  (bomba, aireador, filtro, biofiltro, nivel de agua, fotobiorreactor),
  un panel dedicado del fotobiorreactor (estado, luz, flujo, biomasa,
  actividad) y un registro de alertas con marca de tiempo.
- **Controles**: iniciar/pausar, reiniciar, control de velocidad (0.5×–3×),
  encendido/apagado de la bomba principal.
- **Simulación de fallas**: bomba apagada, filtro obstruido, nivel de agua
  bajo, pH elevado, amoníaco elevado y baja oxigenación — cada una afecta
  visualmente el sistema y dispara alertas.
- Todos los valores de sensores son **simulados**; esto se indica
  explícitamente en la interfaz.

## Preparado para ESP32 + MQTT

El estado de los sensores vive en `Aqua.state.sensors` con exactamente la
forma descrita en el brief original:

```js
{
  temperature: 24.5,
  ph: 6.8,
  ammonia: 0.10,
  nitrite: 0.05,
  nitrate: 30,
  oxygen: 7.2,
}
```

Tres piezas ya están listas para cuando quieras dar el salto a hardware real:

- **`esp32/aquaponic_sensor_node.ino`** — firmware de ejemplo para ESP32
  (temperatura con DS18B20 + pH con sonda analógica) que publica por MQTT.
  Ver `esp32/README_ESP32.md` para el cableado y la puesta en marcha paso
  a paso.
- **`modules/mqttBridge.js`** — puente opcional (inactivo por defecto) que
  suscribe el navegador al broker MQTT y alimenta el simulador con
  lecturas reales.
- **Panel "Registro manual de pruebas de agua"** (vista Monitoreo) — para
  amoníaco, nitrito y nitrato, que no tienen sensores electrónicos baratos
  confiables; se ingresan a mano los resultados de un kit de prueba y el
  panel los usa igual que si vinieran de un sensor.

Cuando quieras conectar lecturas reales sin usar MQTT (por ejemplo desde
otro script), basta con llamar directamente a:

```js
Aqua.applyExternalReading({ temperature: 24.8, ph: 6.75, /* ... */ });
```

Esto reemplaza los valores simulados por lecturas reales y reutiliza todo
el mismo flujo de alertas y renderizado — no es necesario tocar el resto
del código.

## Notas de diseño

La distribución del diagrama (tanque de peces → filtro mecánico →
biofiltro → tubos con plantas → bomba/depósito, con tubería de retorno)
y la paleta de colores están basadas en las fotografías del sistema real:
tanques IBC blancos con jaula metálica, tubos PVC color crema con
perforaciones ovaladas, y depósitos amarillos con tapa blanca y válvula
azul.

## Próximos pasos sugeridos

- Seguir `esp32/README_ESP32.md` para poner en marcha el broker MQTT y el
  ESP32 con temperatura + pH reales.
- Añadir un sensor de oxígeno disuelto real si consigues uno accesible, o
  seguir usando el registro manual para amoníaco/nitrito/nitrato.
- Añadir persistencia (localStorage o backend) para conservar el
  historial entre sesiones.
- Sustituir los peces/plantas ilustrados por sprites más detallados si
  se desea mayor fidelidad visual.
