/*
  =========================================================================
  aquaponic_sensor_node.ino
  Nodo de sensores para el Simulador de Sistema Acuapónico — ESP32 + MQTT.

  Publica periódicamente un JSON con la MISMA forma que usa el simulador
  web (ver Aqua.state.sensors en app.js), para que modules/mqttBridge.js
  lo pueda consumir directamente sin ningún cambio en el código web:

    { "temperature": 24.8, "ph": 6.78, "pump1": true, "aerator": true }

  -------------------------------------------------------------------------
  SENSORES INCLUIDOS EN ESTE EJEMPLO (con lectura real):
    - DS18B20 .......... temperatura del agua (sumergible, ~2-3 USD, muy
                          confiable, es el sensor recomendado para empezar).
    - Sensor de pH análogo (tipo "PH-4502C" / sonda de electrodo) ...... pH.

  SENSORES *NO* INCLUIDOS (amoníaco, nitrito, nitrato, oxígeno disuelto):
    No existen sensores electroquímicos baratos y confiables para uso
    hobbysta para estos 4 parámetros (los sensores de calidad de
    laboratorio cuestan varios cientos de dólares cada uno). Dos caminos
    razonables mientras tanto:
      a) Usa el panel "Registro manual de pruebas de agua" del simulador
         web y anota ahí los resultados de un kit de prueba por colorimetría
         (ej. API Freshwater Master Test Kit) una o dos veces por semana.
      b) Si más adelante consigues sensores reales para alguno de estos
         (por ejemplo un sensor óptico de oxígeno disuelto), agrégalo
         siguiendo el mismo patrón que el sensor de pH de abajo.

  LIBRERÍAS NECESARIAS (Arduino IDE → Herramientas → Administrar bibliotecas):
    - PubSubClient        (Nick O'Leary)      — cliente MQTT
    - ArduinoJson  v6+     (Benoit Blanchon)   — construir el JSON
    - OneWire                                  — bus para el DS18B20
    - DallasTemperature                        — driver del DS18B20
    (WiFi y WiFiClientSecure ya vienen incluidos en el core de ESP32, no
    hace falta instalarlos aparte)

  BROKER: configurado por defecto para HiveMQ Cloud (plan Serverless,
  gratis, con TLS y usuario/contraseña — ver esp32/README_ESP32.md para
  crear la cuenta paso a paso). Si prefieres un Mosquitto local sin TLS,
  las notas junto a MQTT_PORT más abajo indican qué cambiar.

  PLACA: cualquier ESP32 genérico (ESP32-WROOM-32, DevKitC, etc.)
  =========================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ------------------------- CONFIGURA ESTOS VALORES -------------------------
const char* WIFI_SSID      = "TU_RED_WIFI";
const char* WIFI_PASSWORD  = "TU_CONTRASENA_WIFI";

// Por defecto configurado para HiveMQ Cloud (plan Serverless, gratis, privado):
// 1. Crea una cuenta en https://www.hivemq.com/mqtt-cloud-broker/ (plan Serverless)
// 2. Crea un cluster y un usuario/contraseña para dispositivos (Access Management)
// 3. Copia el "Cluster URL" que te da HiveMQ (termina en .hivemq.cloud)
const char* MQTT_BROKER    = "TU-CLUSTER.hivemq.cloud"; // host del cluster (sin "https://")
const int   MQTT_PORT      = 8883;                       // 8883 = MQTT con TLS (HiveMQ Cloud exige TLS)
const char* MQTT_USERNAME  = "TU_USUARIO_MQTT";           // creado en Access Management
const char* MQTT_PASSWORD  = "TU_CONTRASENA_MQTT";
const char* MQTT_TOPIC     = "acuaponico/sensores";       // debe coincidir con TOPIC en modules/mqttBridge.js
const char* MQTT_CLIENT_ID = "esp32-acuaponico-01";

// ¿Vas a usar Mosquitto local en vez de HiveMQ Cloud? Cambia MQTT_PORT a 1883,
// deja usuario/contraseña en "" si tu Mosquitto no pide autenticación, y en
// connectMQTT() más abajo usa `espClient` (WiFiClient) en vez de `espClientSecure`.
// -----------------------------------------------------------------------------

#define ONE_WIRE_PIN   4     // pin de datos del DS18B20
#define PH_SENSOR_PIN  34    // pin ADC del sensor de pH (usa un pin "input-only" del ESP32)

const unsigned long PUBLISH_INTERVAL_MS = 5000; // publica cada 5 segundos

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature tempSensor(&oneWire);

WiFiClientSecure espClientSecure; // conexión TLS (HiveMQ Cloud, puerto 8883)
PubSubClient mqttClient(espClientSecure);

unsigned long lastPublish = 0;

void connectWiFi() {
  Serial.print("Conectando a WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.print(" conectado, IP: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Conectando al broker MQTT...");
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println(" conectado.");
    } else {
      Serial.print(" fallo (rc=");
      Serial.print(mqttClient.state());
      Serial.println("), reintentando en 3 s");
      delay(3000);
    }
  }
}

/**
 * Lectura aproximada de pH a partir del voltaje del sensor analógico.
 * IMPORTANTE: calibra la pendiente y el offset con soluciones buffer
 * de pH 4.0 y pH 7.0 antes de confiar en este valor — los sensores de
 * pH baratos varían bastante de una unidad a otra.
 */
float readPH() {
  int raw = analogRead(PH_SENSOR_PIN);       // 0-4095 en el ADC del ESP32
  float voltage = raw * (3.3 / 4095.0);
  float ph = 7.0 + ((2.5 - voltage) / 0.18); // <-- fórmula de ejemplo, CALIBRAR
  return ph;
}

void setup() {
  Serial.begin(115200);
  tempSensor.begin();
  connectWiFi();

  // NOTA DE SEGURIDAD: setInsecure() omite la verificación del certificado
  // del broker — es la forma más rápida de arrancar, pero un atacante en tu
  // red podría hacerse pasar por el broker. Para un despliegue serio, usa
  // espClientSecure.setCACert(...) con el certificado raíz de tu broker
  // (HiveMQ Cloud usa Let's Encrypt / ISRG Root X1).
  espClientSecure.setInsecure();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = millis();

    tempSensor.requestTemperatures();
    float temperature = tempSensor.getTempCByIndex(0);
    float ph = readPH();

    StaticJsonDocument<256> doc;
    doc["temperature"] = temperature;
    doc["ph"] = ph;
    doc["pump1"] = true;   // reemplaza por la lectura real de tu relé/sensor de flujo si la tienes
    doc["aerator"] = true; // idem

    // Amoníaco / nitrito / nitrato / oxígeno: sin sensor en este ejemplo.
    // Simplemente NO los incluyas en el JSON — el simulador conserva el
    // último valor que tenga (simulado o registrado manualmente) para
    // cualquier clave que no envíes.
    // doc["ammonia"] = ...;
    // doc["nitrite"] = ...;
    // doc["nitrate"] = ...;
    // doc["oxygen"]  = ...;

    char payload[256];
    serializeJson(doc, payload);

    mqttClient.publish(MQTT_TOPIC, payload);

    Serial.print("Publicado en ");
    Serial.print(MQTT_TOPIC);
    Serial.print(": ");
    Serial.println(payload);
  }
}
