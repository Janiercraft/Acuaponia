
## Ejecución actual (sin BAT)

La aplicación no necesita `INICIAR_AQUAPONIA.bat`. Puedes abrir `index.html` directamente para una prueba local con conexión a internet, o publicar la carpeta tal cual en Vercel, Netlify, GitHub Pages, Apache/Nginx u otro hosting estático. `index.html` carga Three.js y luego el bundle 3D en orden, por lo que la escena se crea automáticamente.

En producción se recomienda HTTPS normal; no hay servidor backend obligatorio para la maqueta 3D.

# Simulador de Sistema Acuapónico

Maqueta 3D interactiva (Three.js + WebGL) del sistema acuapónico: peces →
filtro mecánico → biofiltro → (plantas / fotobiorreactor en paralelo) →
bomba/depósito → peces. La lógica de simulación es JavaScript puro sin
frameworks ni backend; la escena 3D usa Three.js cargado por CDN (ver
"Requisito de conexión a internet" más abajo).

## Cómo ejecutarlo

**IMPORTANTE: no lo abras con doble clic.** El proyecto usa módulos ES
(`import`/`export`) entre archivos locales dentro de `modules/three/`, y
la mayoría de navegadores (Chrome, Edge incluidos) **bloquean por CORS la
carga de módulos ES cuando la página se abre como `file://`** — el HTML y
el CSS se ven bien porque son recursos normales, pero toda la escena 3D
se queda sin cargar, en silencio salvo por un error en la consola. Si
alguna vez ves el panel principal completamente vacío/negro, la primera
sospecha debería ser ésta.

Sírvelo con cualquier servidor HTTP local, por ejemplo:

```bash
# con Python (viene instalado en la mayoría de sistemas)
python -m http.server 5500
# o con Node
npx serve .
```

y abre `http://localhost:5500` (o el puerto que corresponda) en el
navegador. Chrome o Edge recomendados por su soporte WebGL más
consistente.

Si aun así el panel donde debería aparecer la maqueta 3D queda vacío,
abre la consola del navegador (F12): todo el arranque de la escena
imprime mensajes con el prefijo `[AQUA 3D]` en cada paso (escena creada,
cámara creada, renderer creado, cada componente inicializado...), y si
algo específico falla, el error queda registrado ahí con el nombre del
módulo — y además se muestra un mensaje explicando el problema
directamente sobre el panel 3D, en vez de dejarlo en blanco sin
explicación.

**Requiere conexión a internet**: Three.js y sus complementos
(`OrbitControls`, `CSS2DRenderer`) se cargan desde un CDN (jsDelivr)
mediante un *import map* en `index.html` — el proyecto no trae esas
~700 KB de librería vendorizadas localmente. Sin internet, el panel 3D
muestra el mensaje de error correspondiente (el resto de la interfaz —
controles, paneles, monitoreo — sigue funcionando con normalidad, ya que
no depende de Three.js). Si necesitas que funcione 100% sin conexión,
descarga `three.module.js` y la carpeta `examples/jsm/` de la versión
indicada en el import map de `index.html` y ajusta esas rutas para que
apunten a tus copias locales en vez de a jsDelivr.

## Cómo interactuar con la escena 3D

* **Rotar**: clic izquierdo + arrastrar.
* **Zoom**: rueda del mouse (o pellizcar en móvil).
* **Paneo**: clic derecho + arrastrar (o dos dedos en móvil).
* **⟳ Centrar vista**: si te pierdes rotando o haciendo zoom, este botón
  en la barra de controles recalcula el encuadre de toda la maqueta a
  partir de su tamaño real (bounding box), no de posiciones fijas.

```
aquaponic-simulator/
├── index.html          ← abrir este archivo
├── style.css
├── app.js               ← estado central y bucle de simulación
├── modules/
│   ├── three/            ← escena 3D completa: scene/cámara/render (core.js),
│   │                        luces+suelo (environment.js), materiales
│   │                        compartidos (materials.js), posiciones de cada
│   │                        componente (layout.js), tuberías-tubo 3D
│   │                        (pipes.js), partículas sobre curvas
│   │                        (particles.js), etiquetas CSS2D (labels.js),
│   │                        y un módulo por componente (fishTank.js,
│   │                        fish.js, mechanicalFilter.js, biofilter.js,
│   │                        growBeds.js, sump.js, photobioreactor.js,
│   │                        co2System.js) — ver "Arquitectura 3D" abajo.
│   ├── monitoring.js      ← tarjetas de parámetros y minigráficas (HTML, no 3D)
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

**Vista lateral (rediseño):** el diagrama se reorganizó por completo como
una vista de perfil, en una sola fila de izquierda a derecha: tanque de
peces (alto, estilo IBC) → filtro mecánico → biofiltro → fotobiorreactor
(rama que se desprende y vuelve a unirse) → mesa de cultivo elevada sobre
soportes tipo bloque → bomba. La tubería de **suministro** corre por una
altura fija arriba; la de **retorno** corre por un canal claramente
inferior — dos alturas separadas a propósito para que el sentido del
flujo sea imposible de malinterpretar, pensado para personas sin
experiencia técnica previa. Los barriles de filtro/biofiltro son azules,
como en las referencias fotográficas del sistema real.

**Fotobiorreactor (rediseño):** dejó de ser un tanque genérico y ahora es
una estructura propia — marco blanco redondeado con barra superior,
bandeja/panel central con pantalla e indicadores, y un cilindro oscuro
translúcido vertical al lado derecho (el reactor real: ahí viven la luz
LED, el difusor de CO₂, las burbujas y las microalgas), inspirada en un
dispositivo de cultivo tipo torre.

## Próximos pasos sugeridos

- Seguir `esp32/README_ESP32.md` para poner en marcha el broker MQTT y el
  ESP32 con temperatura + pH reales.
- Añadir un sensor de oxígeno disuelto real si consigues uno accesible, o
  seguir usando el registro manual para amoníaco/nitrito/nitrato.
- Añadir persistencia (localStorage o backend) para conservar el
  historial entre sesiones.
- Sustituir los peces/plantas ilustrados por sprites más detallados si
  se desea mayor fidelidad visual.

## Diseño responsive

La interfaz fue adaptada para escritorio, portátil, tablet y móvil. Los controles y paneles cambian de distribución según el ancho disponible, los formularios se apilan en pantallas pequeñas y el diagrama principal conserva un tamaño mínimo legible con desplazamiento horizontal contenido dentro del área de simulación, evitando overflow horizontal de toda la página.

## Corrección de carga 3D para `file://`

Esta versión incluye una corrección específica para el error CORS que aparecía al abrir `index.html` con doble clic.

- `index.html` ya no carga `modules/three/index.js` como ES Module local.
- `modules/three/loader.js` carga Three.js como script clásico desde varios CDN alternativos.
- `modules/three/three-classic-bundle.js` contiene la escena 3D como script clásico local, sin `import`/`export` entre archivos.
- Por lo tanto, `file:///.../index.html` puede abrir la escena sin que el navegador bloquee `modules/three/index.js` por origen `null`.

Se mantiene también la opción recomendada de servir el proyecto por HTTP. En Windows, puedes ejecutar `INICIAR_AQUAPONIA.bat` si tienes Python instalado.


## Despliegue en producción
Este proyecto es un sitio estático y no depende del archivo BAT. Para producción súbelo completo a Vercel, Netlify, GitHub Pages o cualquier servidor HTTPS conservando la estructura de carpetas. `index.html` es el punto de entrada. El BAT es sólo una comodidad local y puede ignorarse o eliminarse.

La escena 3D usa Three.js clásico cargado por CDN y después `modules/three/three-classic-bundle.js`. En producción HTTPS no existe el bloqueo CORS de módulos locales que ocurre con `file://`.


## Ajustes de cámara y luz PBR
- La cámara se reencuadra automáticamente al cargar, al volver a la pestaña Simulación y al pulsar Iniciar.
- El fotobiorreactor incluye una luminaria LED de cultivo externa sobre el reactor y una barra interna. El botón “Luz PBR” enciende/apaga ambas y la luz real asociada.
