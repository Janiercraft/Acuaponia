# Conectar el ESP32 al simulador (MQTT)

Esta guía conecta tres piezas que ya están construidas:

1. **`aquaponic_sensor_node.ino`** (esta carpeta) — firmware del ESP32 que
   lee sensores y publica un JSON por MQTT. Ya viene configurado para la
   opción recomendada abajo (HiveMQ Cloud, con TLS y usuario/contraseña).
2. **Un broker MQTT** — el intermediario que recibe lo que publica el ESP32
   y lo entrega a quien esté suscrito (el navegador).
3. **`modules/mqttBridge.js`** (ya incluido en el proyecto, inactivo por
   defecto) — se suscribe al broker desde el navegador y llama a
   `Aqua.applyExternalReading()`.

```
ESP32 (sensores) --MQTT/TLS--> Broker --MQTT sobre WebSockets--> navegador (simulador)
```

## 1. Broker MQTT: HiveMQ Cloud (recomendado para empezar)

Como todavía no tienes un Raspberry Pi/servidor dedicado, la ruta más
simple es un broker en la nube gratuito y privado — no un servidor que
tengas que mantener tú:

1. Crea una cuenta gratis en <https://www.hivemq.com/mqtt-cloud-broker/>
   y elige el plan **Serverless** (gratis, hasta 100 conexiones — de sobra
   para un ESP32 + tu navegador).
2. Crea un **cluster**. HiveMQ te da un **Cluster URL** parecido a
   `abcd1234.s1.eu.hivemq.cloud` — cópialo.
3. En la sección **Access Management** del cluster, crea un usuario y
   contraseña para el ESP32 (y el mismo puede usarlo el navegador).
4. Con eso ya tienes los 4 datos que piden `aquaponic_sensor_node.ino` y
   `mqttBridge.js`: host del cluster, usuario, contraseña, y el tema
   (topic) que tú elijas (por defecto `acuaponico/sensores`).

Es privado (nadie más puede leer o publicar en tu cluster) y usa TLS por
defecto — el firmware ya está configurado para eso (puerto 8883 para el
ESP32, `wss://...:8884/mqtt` para el navegador).

**Alternativa — Mosquitto local:** si más adelante consigues una
Raspberry Pi u otro equipo en la misma red del rooftop y prefieres no
depender de internet, puedes instalar [Mosquitto](https://mosquitto.org/)
ahí. En `mosquitto.conf`:

```
listener 1883
listener 9001
protocol websockets
```

El ESP32 se conectaría al puerto 1883 (cambia `MQTT_PORT` a `1883` y usa
`WiFiClient` en vez de `WiFiClientSecure` en el `.ino`); el navegador a
`ws://IP-DEL-BROKER:9001` (sin `wss://`). Por defecto Mosquitto no pide
usuario/contraseña en una red local — puedes dejar `USERNAME`/`MQTT_USERNAME`
vacíos en ese caso.

## 2. Configura y sube el firmware

1. Abre `aquaponic_sensor_node.ino` en el Arduino IDE.
2. Instala las librerías indicadas en el comentario superior del archivo
   (PubSubClient, ArduinoJson, OneWire, DallasTemperature — WiFi y
   WiFiClientSecure ya vienen con el core de ESP32).
3. Reemplaza `WIFI_SSID`, `WIFI_PASSWORD`, `MQTT_BROKER`, `MQTT_USERNAME`
   y `MQTT_PASSWORD` con los datos de tu cluster de HiveMQ Cloud.
4. Conecta el sensor DS18B20 (VCC→3.3V, GND→GND, DATA→GPIO4, con una
   resistencia pull-up de 4.7kΩ entre DATA y 3.3V) y el sensor de pH
   (salida analógica → GPIO34).
5. Sube el sketch y abre el Monitor Serial (115200 baudios) para confirmar
   que se conecta al WiFi, al broker, y que empieza a publicar cada 5 s.

## 3. Activa el puente en el navegador

En `index.html`, agrega estas dos líneas **justo antes** de
`<script src="app.js"></script>`:

```html
<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
<script src="modules/mqttBridge.js"></script>
```

Luego abre `modules/mqttBridge.js` y ajusta `BROKER_URL`, `TOPIC`,
`USERNAME` y `PASSWORD` con los mismos datos del cluster.

Abre `index.html` de nuevo (necesitas conexión a internet la primera vez,
para cargar la librería MQTT.js desde el CDN) y revisa la consola del
navegador: deberías ver `[mqttBridge] conectado al broker...`.

## 4. Amoníaco, nitrito, nitrato y oxígeno disuelto

Ver el mensaje completo con precios reales que te compartí en el chat:
en resumen, temperatura y pH tienen sensores baratos y confiables (por
eso son los que trae el firmware), oxígeno disuelto ya es más caro
(~US$170), y amoníaco/nitrito/nitrato en electrodo confiable cuesta
varios cientos de dólares cada uno — poco práctico para un proyecto
hobbysta. La opción recomendada mientras tanto es el panel **"Registro
manual de pruebas de agua"** del simulador, con los resultados de un kit
de prueba por colorimetría (ej. API Freshwater Master Test Kit).

Si más adelante agregas un sensor real para alguno de estos parámetros,
sigue el mismo patrón que el sensor de pH en el `.ino`: lee el pin,
añade la clave correspondiente al `StaticJsonDocument`.

## Seguridad

El firmware usa `setInsecure()` en la conexión TLS para simplificar el
arranque (no valida el certificado del broker). Es aceptable para
empezar y probar, pero si vas a dejarlo funcionando sin supervisión a
largo plazo, cambia a `setCACert()` con el certificado raíz real del
broker (HiveMQ Cloud usa Let's Encrypt / ISRG Root X1).
