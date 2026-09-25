/* =========================================================================
   app.js
   Orquestador principal del Simulador de Sistema Acuapónico.
   - Mantiene el estado central (sensores, actuadores, fallas, historial).
   - Corre el bucle de simulación (requestAnimationFrame).
   - Calcula la evolución simplificada de los parámetros del agua.
   - Conecta los controles de la interfaz con el resto de los módulos.

   Estructura de datos de sensores (ver sección 17 del brief original):
   pensada para ser reemplazada más adelante por lecturas reales llegando
   por MQTT desde un ESP32 — ver la función `applyExternalReading()` al
   final de este archivo, que ya deja el punto de conexión preparado.
   ========================================================================= */

window.Aqua = window.Aqua || {};

(function () {

  const HISTORY_LENGTH = 30;

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  /* ---------------------------------------------------------------------
     ESTADO CENTRAL
     --------------------------------------------------------------------- */
  function freshState() {
    const sensors = { temperature: 24.5, ph: 6.8, ammonia: 0.10, nitrite: 0.05, nitrate: 30, oxygen: 7.2 };
    const history = {};
    Object.keys(sensors).forEach((k) => { history[k] = Array(6).fill(sensors[k]); });

    return {
      running: false,
      speed: 1,
      sensors,
      actuators: { pump1: true, aerator: true },
      faults: { pumpOff: false, filterClogged: false, lowWater: false, highPh: false, highAmmonia: false, lowOxygen: false },
      filterLoad: 0,
      photobioreactor: { active: true, light: true, biomass: 0.05, activity: 0.3, growthRatePerMin: 0, _flowIntensity: 0.4 },
      flowSplit: 60, // % del caudal hacia las plantas; el resto (100-flowSplit) va al fotobiorreactor
      history,
      alertLog: [],
      _prevAlertSet: new Set(),
      _sensorTickAcc: 0,
    };
  }

  const state = freshState();
  Aqua.state = state; // punto de acceso público / futura integración MQTT

  /* ---------------------------------------------------------------------
     LÓGICA DE SIMULACIÓN (sensores)
     --------------------------------------------------------------------- */
  function isFlowing() {
    return state.actuators.pump1 && !state.faults.pumpOff && !state.faults.lowWater;
  }

  /**
   * Modelo simplificado "de reversión a la media": cada parámetro tiene un
   * valor objetivo (target) que depende del estado actual del sistema
   * (flujo, fallas activas) y se acerca a él gradualmente, con un poco de
   * ruido para que se sienta vivo. Esto mantiene los valores dentro de
   * rangos creíbles en operación normal y los desplaza de forma clara y
   * visible cuando se simula una falla, sin riesgo de que se disparen a
   * infinito o caigan a cero de forma abrupta.
   */
  function runSensorTick(dtSim) {
    const s = state.sensors;
    const f = state.faults;
    const a = state.actuators;
    const flowing = isFlowing();
    const noise = () => (Math.random() - 0.5);

    // --- amoníaco: sube si no hay flujo/filtración, o si se fuerza la falla ---
    let ammoniaTarget = 0.10;
    if (!flowing) ammoniaTarget += 0.55;
    if (f.filterClogged) ammoniaTarget += 0.30;
    if (f.highAmmonia) ammoniaTarget = Math.max(ammoniaTarget, 0.95);
    s.ammonia = clamp(s.ammonia + (ammoniaTarget - s.ammonia) * 0.14 * dtSim + noise() * 0.004, 0, 3);

    // --- nitrito: sube cuando el biofiltro está sobrecargado ---
    let nitriteTarget = 0.05;
    if (f.highAmmonia) nitriteTarget += 0.35;
    if (!flowing) nitriteTarget += 0.15;
    s.nitrite = clamp(s.nitrite + (nitriteTarget - s.nitrite) * 0.10 * dtSim + noise() * 0.003, 0, 3);

    // --- nitrato: nutriente principal para las plantas, se mantiene cerca
    //     de la línea base cuando el sistema circula con normalidad ---
    let nitrateTarget = flowing ? 30 : 22;
    if (f.highAmmonia) nitrateTarget -= 6; // el biofiltro no está convirtiendo bien
    s.nitrate = clamp(s.nitrate + (nitrateTarget - s.nitrate) * 0.05 * dtSim + noise() * 0.05, 0, 90);

    // --- pH ---
    const phTarget = f.highPh ? 8.6 : 6.8;
    s.ph = clamp(s.ph + (phTarget - s.ph) * 0.08 * dtSim + noise() * 0.01, 4, 9.3);

    // --- oxígeno disuelto ---
    let targetO2 = (a.aerator && !f.lowOxygen) ? 7.2 : (f.lowOxygen ? 2.4 : 5.0);
    if (!flowing) targetO2 -= 1.0;
    s.oxygen = clamp(s.oxygen + (targetO2 - s.oxygen) * 0.15 * dtSim + noise() * 0.02, 0, 12);

    // --- temperatura ambiente, variación mínima ---
    s.temperature = clamp(s.temperature + (24.5 - s.temperature) * 0.05 * dtSim + noise() * 0.03, 15, 34);

    // carga del filtro mecánico (acumulación de sólidos)
    if (f.filterClogged) {
      state.filterLoad = clamp(state.filterLoad + 0.035 * dtSim, 0, 1);
    } else {
      state.filterLoad = clamp(state.filterLoad - 0.012 * dtSim, 0, 1);
    }

    // --- fotobiorreactor: crecimiento progresivo de biomasa de algas ---
    // Curva logística (dB/dt = r·B·(1-B/K)): arranca lento, acelera, y se
    // aplana sola al acercarse al máximo — sin necesidad de forzar un
    // techo aparte. La tasa "r" es la que responde a luz/flujo/nutrientes
    // (sección 8 del brief), reutilizando exactamente las mismas señales
    // que ya existían (pbr.light, el caudal del slider, el nitrato del
    // panel de sensores) en vez de crear variables nuevas paralelas.
    const pbr = state.photobioreactor;
    const pbrFlowPct = 100 - state.flowSplit;
    const pbrHasFlow = flowing && pbr.active && pbrFlowPct >= 3;

    const lightFactor = pbr.active && pbr.light ? 1 : 0.12;
    const flowFactor = !pbr.active ? 0.05 : (!pbrHasFlow ? 0.08 : (pbrFlowPct < 15 ? 0.45 : 1));
    const nutrientFactor = clamp(s.nitrate / 30, 0.35, 1.3);
    const BASE_GROWTH_RATE = 0.05; // por segundo simulado, en condiciones óptimas
    const MAX_ALGAE_BIOMASS = 1;

    const r = BASE_GROWTH_RATE * lightFactor * flowFactor * nutrientFactor;
    const deltaB = r * pbr.biomass * (1 - pbr.biomass / MAX_ALGAE_BIOMASS) * dtSim;
    pbr.biomass = clamp(pbr.biomass + deltaB, 0.02, MAX_ALGAE_BIOMASS);
    pbr.growthRatePerMin = dtSim > 0 ? (deltaB / dtSim) * 60 * 100 : 0; // %/min, para el panel
    pbr._flowIntensity = flowFactor; // reutilizado por el vaivén visual de las algas (ver loop())

    // actividad biológica: sigue el mismo modelo de reversión a la media
    // que el resto de los sensores, ahora alimentado por la nueva biomasa.
    const activityTarget = (pbrHasFlow ? 0.5 : 0) + (pbr.active && pbr.light ? 0.4 : 0) * pbr.biomass;
    pbr.activity = clamp(pbr.activity + (activityTarget - pbr.activity) * 0.12 * dtSim + noise() * 0.02, 0, 1);

    pushHistory();
    updateAlerts();
    renderAll();
  }

  function pushHistory() {
    Object.keys(state.sensors).forEach((k) => {
      const arr = state.history[k];
      arr.push(state.sensors[k]);
      if (arr.length > HISTORY_LENGTH) arr.shift();
    });
  }

  function computeAlerts() {
    const s = state.sensors, f = state.faults, a = state.actuators;
    const flowing = isFlowing();
    const texts = [];
    const keys = new Set();

    if (f.pumpOff || !a.pump1) texts.push('BOMBA DETENIDA');
    if (f.filterClogged) texts.push('FILTRO OBSTRUIDO');
    if (f.lowWater) texts.push('NIVEL DE AGUA BAJO');
    if (s.ph < 6 || s.ph > 8.2) { texts.push('pH FUERA DE RANGO'); keys.add('ph'); }
    if (s.ammonia > 0.5) { texts.push('AMONÍACO ELEVADO'); keys.add('ammonia'); }
    if (s.oxygen < 4) { texts.push('OXÍGENO BAJO'); keys.add('oxygen'); }

    // --- fotobiorreactor ---
    const pbr = state.photobioreactor;
    const pbrFlowPct = 100 - state.flowSplit;
    if (pbr.active) {
      const pbrHasFlow = flowing && pbrFlowPct >= 3;
      if (!pbrHasFlow) texts.push('FOTOBIORREACTOR SIN FLUJO');
      else if (pbrFlowPct < 15) texts.push('CAUDAL PBR DEMASIADO BAJO');
      if (!pbr.light) texts.push('ILUMINACIÓN PBR APAGADA');
      if (pbr.activity < 0.25) texts.push('ACTIVIDAD BIOLÓGICA BAJA');
    }

    return { texts, keys };
  }

  function updateAlerts() {
    const { texts, keys } = computeAlerts();
    const currentSet = new Set(texts);

    // registra en el log sólo las alertas que se acaban de activar
    currentSet.forEach((t) => {
      if (!state._prevAlertSet.has(t)) {
        state.alertLog.push({ text: t, time: new Date().toLocaleTimeString('es-CO') });
        if (state.alertLog.length > 40) state.alertLog.shift();
      }
    });
    state._prevAlertSet = currentSet;

    Aqua.Monitoring.renderAlertBanners('#alertsStrip', texts);
    Aqua.Monitoring.pushAlertLog('#alertLog', state.alertLog);
    state._alertKeys = keys;
  }

  /* ---------------------------------------------------------------------
     RENDER — refleja el estado en el DOM / SVG
     --------------------------------------------------------------------- */
  function renderAll() {
    const s = state.sensors, f = state.faults;
    const flowing = isFlowing();
    const bioOverloaded = f.highAmmonia || s.ammonia > 0.5;

    // lectura rápida sobre el lienzo
    document.getElementById('qsTemp').textContent = s.temperature.toFixed(1) + ' °C';
    document.getElementById('qsPh').textContent = s.ph.toFixed(2);
    document.getElementById('qsO2').textContent = s.oxygen.toFixed(1) + ' mg/L';
    document.getElementById('qsNitrate').textContent = Math.round(s.nitrate) + ' ppm';
    document.getElementById('qsBiomass').textContent = Math.round(state.photobioreactor.biomass * 100) + '%';
    const plantGrowthPct = (window.__AQUA_3D_INITIALIZED__ && Aqua.Plants && Aqua.Plants.getGrowthPercent)
      ? Aqua.Plants.getGrowthPercent()
      : 0;
    document.getElementById('qsPlantGrowth').textContent = plantGrowthPct + '%';

    // panel de monitoreo
    Aqua.Monitoring.updateParams(s, state.history, state._alertKeys || new Set());
    Aqua.Monitoring.updateStatusList('#statusList', [
      { label: 'Bomba principal', ok: state.actuators.pump1 && !f.pumpOff },
      { label: 'Aireador', ok: state.actuators.aerator && !f.lowOxygen },
      { label: 'Filtro mecánico', ok: !f.filterClogged },
      { label: 'Biofiltro', ok: !bioOverloaded },
      { label: 'Nivel de agua', ok: !f.lowWater },
      { label: 'Fotobiorreactor', ok: !state.photobioreactor.active || state.photobioreactor.activity >= 0.25 },
    ]);

    // fotobiorreactor: panel de monitoreo dedicado (siempre disponible,
    // no depende de que la escena 3D haya cargado)
    const pbr = state.photobioreactor;
    const pbrFlowPct = 100 - state.flowSplit;
    Aqua.Monitoring.updatePBRPanel('#pbrStatusList', {
      active: pbr.active,
      light: pbr.light,
      flowPct: pbrFlowPct,
      biomass: pbr.biomass,
      activity: pbr.activity,
      growthRatePerMin: pbr.growthRatePerMin,
      stageName: Aqua.Photobioreactor && Aqua.Photobioreactor.stageName ? Aqua.Photobioreactor.stageName(pbr.biomass) : '—',
    });
    document.getElementById('flowSplitLabel').textContent = `Plantas ${state.flowSplit}% · PBR ${pbrFlowPct}%`;

    // Todo lo de abajo sí depende de que la escena 3D haya iniciado
    // correctamente. Si falló (ver core.js/safeInit), esto no debe
    // tumbar el resto de la simulación (sensores, alertas, monitoreo) —
    // sólo se pierde la actualización visual del modelo 3D.
    if (window.__AQUA_3D_INITIALIZED__) try {
      Aqua.Photobioreactor.render({
        light: pbr.light,
        active: pbr.active,
        biomass: pbr.biomass,
        lowActivity: pbr.activity < 0.25,
      });

      // tuberías
      Aqua.WaterFlow.setFlowing(flowing && state.running);

      // tanque de peces: nivel de agua y riesgo
      Aqua.FishTank.setWaterLevel(f.lowWater);
      Aqua.Fish.setTankAtRisk(f.lowWater);
      Aqua.Fish.setSluggish(s.oxygen < 4);

      // filtro mecánico
      Aqua.MechanicalFilter.setLoad(state.filterLoad);
      Aqua.MechanicalFilter.setClogged(f.filterClogged);

      // biofiltro
      Aqua.Biofilter.setOverloaded(bioOverloaded);

      // bomba (el giro del rotor se actualiza cada fotograma en loop(), no aquí)
      Aqua.Sump.setSpinning(flowing && state.running);
      Aqua.Sump.setIndicator(state.actuators.pump1 && !f.pumpOff);
    } catch (error) {
      if (!renderAll._loggedError) {
        renderAll._loggedError = true;
        console.error('[AQUA 3D] renderAll(): error actualizando el modelo 3D (la simulación numérica sigue funcionando; este aviso sólo se muestra una vez para no saturar la consola)', error);
      }
    }
  }

  /* ---------------------------------------------------------------------
     BUCLE PRINCIPAL
     --------------------------------------------------------------------- */
  let lastTs = null;

  function loop(ts) {
    if (lastTs === null) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    dt = Math.min(dt, 0.12); // evita saltos grandes si la pestaña estuvo inactiva
    lastTs = ts;

    const activeDt = state.running ? dt : 0;
    const flowing = isFlowing() && state.running;

    // disponibilidad de nutrientes para el crecimiento de plantas (0..1)
    const nutrientAvailability = clamp(state.sensors.nitrate / 35, 0, 1.4);

    // Igual que en renderAll(): si el modelo 3D falló al iniciar, esto no
    // debe detener el bucle ni la simulación numérica — sólo se pierde
    // la actualización visual (peces, partículas, burbujas, rotor...).
    if (window.__AQUA_3D_INITIALIZED__) try {
      Aqua.WaterFlow.update(activeDt, state.speed);
      Aqua.Nutrients.update(activeDt, state.speed, flowing, { wasteRate: state.faults.filterClogged ? 1.4 : 1 });
      Aqua.Plants.growthTick(activeDt, state.speed, flowing ? nutrientAvailability : 0);
      const plantPctEl = document.getElementById('qsPlantGrowth');
      if (plantPctEl && Aqua.Plants.getGrowthPercent) plantPctEl.textContent = Aqua.Plants.getGrowthPercent() + '%';
      const biomassPctEl = document.getElementById('qsBiomass');
      if (biomassPctEl) biomassPctEl.textContent = Math.round(state.photobioreactor.biomass * 100) + '%';
      Aqua.Fish.update(activeDt * state.speed);
      Aqua.Photobioreactor.growthTick(activeDt * state.speed, state.photobioreactor.biomass, state.photobioreactor._flowIntensity);
      Aqua.Sump.update(activeDt * state.speed);
    } catch (error) {
      if (!loop._loggedError) {
        loop._loggedError = true;
        console.error('[AQUA 3D] loop(): error actualizando el modelo 3D (la simulación numérica sigue funcionando; este aviso sólo se muestra una vez para no saturar la consola)', error);
      }
    }

    if (state.running) {
      state._sensorTickAcc += dt * state.speed;
      const SIM_STEP = 1; // 1 "segundo simulado" por paso
      while (state._sensorTickAcc >= SIM_STEP) {
        state._sensorTickAcc -= SIM_STEP;
        runSensorTick(SIM_STEP);
      }
    }

    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------------
     CONTROLES DE INTERFAZ
     --------------------------------------------------------------------- */
  function recenterThreeSoon() {
    // El tamaño final del canvas puede estabilizarse uno o dos frames después de
    // cargar fuentes/CSS o de mostrar la vista. Reencuadramos varias veces de forma
    // barata para garantizar que el modelo aparezca centrado sin tocar el mouse.
    const doFrame = () => safe3D(() => {
      if (Aqua.Three && Aqua.Three.frameAll) Aqua.Three.frameAll();
    });
    requestAnimationFrame(() => requestAnimationFrame(doFrame));
    setTimeout(doFrame, 120);
    setTimeout(doFrame, 450);
  }

  function setRunning(running) {
    state.running = running;
    document.getElementById('playIcon').textContent = running ? '⏸' : '▶';
    document.getElementById('playLabel').textContent = running ? 'Pausar' : 'Iniciar';
    if (running) recenterThreeSoon();
    renderAll();
  }

  function bindControls() {
    document.getElementById('btnPlayPause').addEventListener('click', () => setRunning(!state.running));

    document.getElementById('btnReset').addEventListener('click', () => {
      const fresh = freshState();
      Object.assign(state, fresh);
      Aqua.state = state;
      state.history = fresh.history;
      safe3D(() => { Aqua.Nutrients.reset(); Aqua.Plants.reset(); });
      applySpeed(1);
      document.querySelectorAll('.fault-chip').forEach((btn) => btn.classList.remove('active'));
      document.getElementById('btnPump').classList.add('on');
      document.getElementById('btnPump').classList.remove('off');
      document.getElementById('pumpState').textContent = 'ON';

      document.getElementById('btnPbrLight').classList.add('on');
      document.getElementById('btnPbrLight').classList.remove('off');
      document.getElementById('pbrLightState').textContent = 'ON';
      document.getElementById('btnPbrActive').classList.add('on');
      document.getElementById('btnPbrActive').classList.remove('off');
      document.getElementById('pbrActiveState').textContent = 'ACTIVO';
      document.getElementById('flowSplitRange').value = 60;
      safe3D(() => { Aqua.Nutrients.setBranchRatio(0.6); Aqua.Nutrients.setPBREnabled(true); });

      setRunning(false);
      updateAlerts();
      renderAll();
    });

    // "Centrar vista": recalcula el encuadre de la cámara 3D a partir del
    // bounding box real del sistema. Se conecta aquí (parte del núcleo
    // siempre disponible), no en el arranque de Three.js, para que el
    // botón exista y no rompa nada aunque el usuario lo pulse antes de
    // que la escena termine de cargar (o si nunca llegó a cargar).
    document.getElementById('btnFrameAll').addEventListener('click', () => {
      safe3D(() => Aqua.Three.frameAll());
    });

    const speedRange = document.getElementById('speedRange');

    function applySpeed(v) {
      state.speed = v;
      speedRange.value = v;
      document.getElementById('speedValue').textContent = v.toFixed(1) + '×';
      Aqua.WaterFlow.setSpeed(v);
      document.querySelectorAll('.speed-preset-btn').forEach((btn) => {
        btn.classList.toggle('active', parseFloat(btn.dataset.speed) === v);
      });
    }

    speedRange.addEventListener('input', () => applySpeed(parseFloat(speedRange.value)));

    document.querySelectorAll('.speed-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => applySpeed(parseFloat(btn.dataset.speed)));
    });

    document.getElementById('btnPump').addEventListener('click', () => {
      state.actuators.pump1 = !state.actuators.pump1;
      const btn = document.getElementById('btnPump');
      btn.classList.toggle('on', state.actuators.pump1);
      btn.classList.toggle('off', !state.actuators.pump1);
      document.getElementById('pumpState').textContent = state.actuators.pump1 ? 'ON' : 'OFF';
      renderAll();
    });

    document.getElementById('btnPbrLight').addEventListener('click', () => {
      state.photobioreactor.light = !state.photobioreactor.light;
      const btn = document.getElementById('btnPbrLight');
      btn.classList.toggle('on', state.photobioreactor.light);
      btn.classList.toggle('off', !state.photobioreactor.light);
      document.getElementById('pbrLightState').textContent = state.photobioreactor.light ? 'ON' : 'OFF';
      updateAlerts();
      renderAll();
    });

    document.getElementById('btnPbrActive').addEventListener('click', () => {
      state.photobioreactor.active = !state.photobioreactor.active;
      safe3D(() => Aqua.Nutrients.setPBREnabled(state.photobioreactor.active));
      const btn = document.getElementById('btnPbrActive');
      btn.classList.toggle('on', state.photobioreactor.active);
      btn.classList.toggle('off', !state.photobioreactor.active);
      document.getElementById('pbrActiveState').textContent = state.photobioreactor.active ? 'ACTIVO' : 'PAUSADO';
      updateAlerts();
      renderAll();
    });

    const flowSplitRange = document.getElementById('flowSplitRange');
    flowSplitRange.addEventListener('input', () => {
      state.flowSplit = parseInt(flowSplitRange.value, 10);
      safe3D(() => Aqua.Nutrients.setBranchRatio(state.flowSplit / 100));
      updateAlerts();
      renderAll();
    });

    const faultPanel = document.getElementById('faultPanel');
    const btnFaultPanel = document.getElementById('btnFaultPanel');
    btnFaultPanel.addEventListener('click', () => {
      const willShow = faultPanel.classList.contains('hidden');
      faultPanel.classList.toggle('hidden', !willShow);
      btnFaultPanel.setAttribute('aria-expanded', String(willShow));
    });

    document.querySelectorAll('.fault-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.fault;
        state.faults[key] = !state.faults[key];
        chip.classList.toggle('active', state.faults[key]);

        // empuje inicial para que el efecto se note de inmediato
        if (state.faults[key]) {
          if (key === 'highPh') state.sensors.ph = Math.max(state.sensors.ph, 8.4);
          if (key === 'highAmmonia') state.sensors.ammonia = Math.max(state.sensors.ammonia, 0.7);
          if (key === 'lowOxygen') state.sensors.oxygen = Math.min(state.sensors.oxygen, 3.0);
        }
        updateAlerts();
        renderAll();
      });
    });

    document.querySelectorAll('.tab-btn').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        const view = tab.dataset.view;
        document.getElementById('view-simulation').classList.toggle('active', view === 'simulation');
        document.getElementById('view-monitoring').classList.toggle('active', view === 'monitoring');
        if (view === 'simulation') recenterThreeSoon();
      });
    });

    // Registro manual de pruebas de agua (kit de prueba, mientras no haya
    // sensores electrónicos conectados). Usa el mismo punto de entrada que
    // usará luego el puente MQTT: Aqua.applyExternalReading().
    const manualForm = document.getElementById('manualEntryForm');
    manualForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const reading = {};
      const fields = [
        ['manualAmmonia', 'ammonia'],
        ['manualNitrite', 'nitrite'],
        ['manualNitrate', 'nitrate'],
        ['manualPh', 'ph'],
      ];
      fields.forEach(([inputId, key]) => {
        const input = document.getElementById(inputId);
        if (input.value !== '') {
          reading[key] = parseFloat(input.value);
          input.value = '';
        }
      });
      if (Object.keys(reading).length === 0) return;

      Aqua.applyExternalReading(reading);

      const confirmEl = document.getElementById('manualEntryConfirm');
      confirmEl.textContent = '✓ Registrado a las ' + new Date().toLocaleTimeString('es-CO');
      setTimeout(() => { confirmEl.textContent = ''; }, 12000);
    });
  }

  /* ---------------------------------------------------------------------
     PUNTO DE CONEXIÓN FUTURA: ESP32 + MQTT
     Cuando exista un cliente MQTT (p. ej. vía WebSockets desde el broker),
     basta con llamar a esta función con las lecturas reales para que
     reemplacen los valores simulados y disparen el mismo pipeline de
     alertas y render que ya existe.
     --------------------------------------------------------------------- */
  Aqua.applyExternalReading = function (reading) {
    Object.assign(state.sensors, reading);
    if (typeof reading.pump1 === 'boolean') state.actuators.pump1 = reading.pump1;
    if (typeof reading.aerator === 'boolean') state.actuators.aerator = reading.aerator;
    pushHistory();
    updateAlerts();
    renderAll();
  };

  /* ---------------------------------------------------------------------
     ARRANQUE
     --------------------------------------------------------------------- */

  /**
   * Ejecuta fn() capturando cualquier error para que un fallo en un solo
   * módulo (por ejemplo Co2System) no impida que los demás se construyan
   * — en vez de que una excepción a mitad de esta función deje todo lo
   * que viene después sin inicializar.
   */
  function safeInit(name, fn) {
    try {
      fn();
      console.log(`[AQUA 3D] ✓ ${name}`);
    } catch (error) {
      console.error(`[AQUA 3D] ✗ ${name}`, error);
    }
  }

  /** Igual que safeInit pero sin nombre/log — para las pocas llamadas a
   *  módulos 3D que quedan sueltas dentro de manejadores de controles
   *  (luz PBR, caudal, reiniciar), que deben seguir funcionando con
   *  normalidad aunque la escena 3D todavía no haya cargado o haya
   *  fallado del todo. */
  function safe3D(fn) {
    try { fn(); } catch (error) { console.error('[AQUA 3D]', error); }
  }

  /**
   * NÚCLEO DE LA APP: sensores, alertas, controles, panel de monitoreo.
   * Arranca en cuanto el DOM está listo, SIN esperar a que la escena 3D
   * termine de cargar — nada de esto depende de Three.js (renderAll() y
   * loop() ya protegen sus propias llamadas al modelo 3D con try/catch),
   * así que no hay motivo para retrasar la interactividad de la interfaz
   * mientras la escena 3D todavía se está cargando desde el CDN.
   */
  function startCore() {
    Aqua.Monitoring.buildParamGrid('#paramGrid');
    bindControls();
    updateAlerts();
    renderAll();
    requestAnimationFrame(loop);
  }

  /**
   * ESCENA 3D: separada del núcleo a propósito (ver comentario de
   * startCore). modules/three/index.js es type="module" (se difiere como
   * defer); este script (app.js) es clásico. En teoría ambos deberían
   * estar listos antes de que dispare DOMContentLoaded, pero en vez de
   * asumirlo esperamos EXPLÍCITAMENTE a las dos señales — el evento
   * 'aqua-three-ready' que dispara index.js al terminar de ejecutar todos
   * sus imports, y el propio DOMContentLoaded — y sólo arrancamos la
   * escena cuando ambas ya ocurrieron, sin importar cuál llegue primero
   * en cada navegador.
   */
  let domReady = false;
  let threeModulesReady = !!window.__AQUA_THREE_READY__ || !!(window.Aqua && window.Aqua.Three);
  function tryStartThreeD() {
    if (!domReady || !threeModulesReady) return;
    startThreeD();
  }
  document.addEventListener('DOMContentLoaded', () => { domReady = true; threeModulesReady = threeModulesReady || !!window.__AQUA_THREE_READY__ || !!(window.Aqua && window.Aqua.Three); startCore(); tryStartThreeD(); });
  window.addEventListener('aqua-three-ready', () => { threeModulesReady = true; tryStartThreeD(); });
  // Respaldo: si por lo que sea el evento nunca llega (por ejemplo el CDN
  // de Three.js falló y modules/three/index.js nunca terminó de
  // ejecutarse), no dejamos la escena 3D esperando para siempre —
  // arrancamos igual a los 4s; Aqua.Three simplemente no existirá y
  // safeInit() lo reportará con claridad en la consola en vez de un
  // fallo silencioso. El núcleo de la app (startCore) YA está funcionando
  // desde el primer instante, independientemente de este respaldo.
  setTimeout(() => {
    if (!threeModulesReady) {
      console.error('[AQUA 3D] Los módulos de modules/three/ no avisaron estar listos tras 4s (¿falló el CDN de Three.js o se abrió el proyecto con file://?). Mostrando el aviso de error en el panel 3D.');
      threeModulesReady = true;
      tryStartThreeD();
    }
  }, 12000);

  function startThreeD() {
    if (!window.Aqua || !Aqua.Three) {
      console.error('[AQUA 3D] Aqua.Three no existe — la escena 3D no puede iniciar. Revisa la consola por errores de red/CORS al cargar modules/three/index.js (¿se abrió con file:// en vez de un servidor HTTP, o falló el CDN de Three.js?).');
      // Aqua.Three ni siquiera se creó, así que su propio showFatalError()
      // tampoco existe — mostramos el aviso directamente aquí para que
      // el panel nunca se quede en blanco sin explicación.
      const container = document.querySelector('#three-container');
      if (container && !container.querySelector('.three-fatal-error')) {
        const box = document.createElement('div');
        box.className = 'three-fatal-error';
        box.innerHTML = '<strong>No fue posible cargar la escena 3D.</strong><br>' +
          'No se pudo cargar Three.js (revisa tu conexión a internet, o que el proyecto se esté sirviendo desde un servidor HTTP y no abierto con doble clic).<br>' +
          'Revisa la consola (F12) para más información.';
        container.appendChild(box);
      }
      return;
    }

    safeInit('Three (escena/cámara/renderer)', () => Aqua.Three.init('#three-container'));
    safeInit('Environment', () => Aqua.Environment.init());

    safeInit('WaterFlow (tuberías)', () => {
      Aqua.WaterFlow.init();
      Aqua.WaterFlow.setSpeed(state.speed);
    });
    safeInit('Nutrients', () => {
      Aqua.Nutrients.init();
      Aqua.Nutrients.setBranchRatio(state.flowSplit / 100);
      Aqua.Nutrients.setPBREnabled(state.photobioreactor.active);
      Aqua.Nutrients.setCallbacks({
        onWasteCaught: () => { state.filterLoad = clamp(state.filterLoad + 0.015, 0, 1); },
        onNutrientAbsorbed: () => Aqua.Plants.absorbTick(),
        onCycleComplete: () => {},
        onPBRTransit: () => { state.photobioreactor.biomass = clamp(state.photobioreactor.biomass + 0.008, 0, 1); },
      });
    });

    safeInit('FishTank', () => Aqua.FishTank.init());
    safeInit('Fish', () => Aqua.Fish.init()); // depende de FishTank.init() ya hecho (usa sus límites de nado)
    safeInit('MechanicalFilter', () => Aqua.MechanicalFilter.init());
    safeInit('Biofilter', () => Aqua.Biofilter.init());
    safeInit('Plants (mesa de cultivo)', () => Aqua.Plants.init());
    safeInit('Sump', () => Aqua.Sump.init());
    safeInit('Photobioreactor', () => Aqua.Photobioreactor.init());
    safeInit('Co2System', () => Aqua.Co2System.init());
    safeInit('Labels', () => Aqua.Labels.init());

    safeInit('Encuadre de cámara (frameAll)', () => Aqua.Three.frameAll());

    // Render inmediato además del animation loop. Así la primera imagen aparece
    // incluso en navegadores que retrasan setAnimationLoop cuando la pestaña acaba de abrir.
    safeInit('Primer render WebGL', () => {
      const renderer = Aqua.Three.getRenderer();
      const scene = Aqua.Three.getScene();
      const camera = Aqua.Three.getCamera();
      renderer.render(scene, camera);
    });

    if (Aqua.Three && Aqua.Three.getScene) {
      const root = Aqua.Three.getSystemRoot && Aqua.Three.getSystemRoot();
      const renderer = Aqua.Three.getRenderer && Aqua.Three.getRenderer();
      console.log('[AQUA 3D] Diagnóstico:', {
        sceneChildren: Aqua.Three.getScene().children.length,
        rootChildren: root ? root.children.length : 0,
        triangles: renderer && renderer.info ? renderer.info.render.triangles : null,
        calls: renderer && renderer.info ? renderer.info.render.calls : null
      });
    }
    window.__AQUA_3D_INITIALIZED__ = !!(Aqua.Three && Aqua.Three.getRenderer && Aqua.Three.getRenderer());
    if (window.__AQUA_3D_INITIALIZED__) {
      const errBox = document.querySelector('#three-container .three-fatal-error');
      if (errBox) errBox.remove();
      console.log('[AQUA 3D] ✓ Escena inicializada correctamente');
      recenterThreeSoon();
    }

    // El estado del sistema ya pudo haber cambiado mientras la escena 3D
    // terminaba de cargar (el usuario alcanzó a tocar algún control) —
    // se lo pasamos de una vez al modelo recién creado.
    renderAll();
  }

})();
