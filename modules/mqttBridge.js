/* =========================================================================
   modules/mqttBridge.js  (OPCIONAL — no se carga por defecto)

   Puente entre un broker MQTT real (alimentado por tu ESP32) y el
   simulador. Traduce cada mensaje MQTT recibido en una llamada a
   Aqua.applyExternalReading(), que ya está conectada a todo el
   pipeline de alertas, sparklines y estado visual.

   CÓMO ACTIVARLO:
   1. Agrega estas dos líneas en index.html, justo ANTES de app.js:

        <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
        <script src="modules/mqttBridge.js"></script>

   2. Reemplaza BROKER_URL, TOPIC, USERNAME y PASSWORD más abajo con los de
      tu broker. Si usas HiveMQ Cloud (plan Serverless, gratis — ver
      esp32/README_ESP32.md), la URL tiene esta forma:

        wss://TU-CLUSTER.hivemq.cloud:8884/mqtt

      El broker debe soportar MQTT sobre WebSockets (puerto típico
      8083/8084 sin TLS, 8081/8884 con TLS — depende del broker),
      porque un navegador no puede hablar MQTT sobre TCP crudo.

   3. Tu ESP32 debe publicar en ese mismo TOPIC un JSON como:
        { "temperature": 24.8, "ph": 6.78, "ammonia": 0.12,
          "nitrite": 0.04, "nitrate": 29, "oxygen": 7.1,
          "pump1": true, "aerator": true }
      (puedes enviar sólo un subconjunto de esas claves; las que no
      envíes conservan su valor simulado actual).
   ========================================================================= */

(function () {
  // ---------- CONFIGURA ESTOS VALORES ----------
  const BROKER_URL = 'wss://TU-CLUSTER.hivemq.cloud:8884/mqtt'; // o tu broker local, ej: 'ws://192.168.1.50:9001'
  const TOPIC = 'acuaponico/sensores';
  const USERNAME = 'TU_USUARIO_MQTT'; // deja '' si tu broker no pide autenticación (ej. Mosquitto local sin auth)
  const PASSWORD = 'TU_CONTRASENA_MQTT';
  // ---------------------------------------------------

  if (typeof mqtt === 'undefined') {
    console.warn('[mqttBridge] La librería MQTT.js no está cargada — el puente MQTT sigue inactivo y el simulador continúa con valores simulados.');
    return;
  }
  if (!window.Aqua || !window.Aqua.applyExternalReading) {
    console.warn('[mqttBridge] Aqua.applyExternalReading no está disponible todavía. Verifica que este script se cargue DESPUÉS de app.js.');
    return;
  }

  const client = mqtt.connect(BROKER_URL, USERNAME ? { username: USERNAME, password: PASSWORD } : {});

  client.on('connect', () => {
    console.log('[mqttBridge] conectado al broker, suscribiendo a "' + TOPIC + '"');
    client.subscribe(TOPIC);
  });

  client.on('reconnect', () => console.log('[mqttBridge] reintentando conexión...'));
  client.on('error', (err) => console.error('[mqttBridge] error de conexión MQTT:', err));

  client.on('message', (topic, payload) => {
    try {
      const reading = JSON.parse(payload.toString());
      window.Aqua.applyExternalReading(reading);
    } catch (err) {
      console.error('[mqttBridge] no se pudo interpretar el mensaje recibido como JSON:', err);
    }
  });
})();
