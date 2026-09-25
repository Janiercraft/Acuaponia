/* =========================================================================
   modules/photobioreactor.js
   Pinta el estado del fotobiorreactor (PBR) en el SVG: iluminación, si la
   rama está activa/pausada, el indicador de biomasa, y — lo nuevo de esta
   versión — el campo de microalgas que va revelándose progresivamente a
   medida que crece `state.photobioreactor.biomass`.

   Este módulo sigue sin calcular nada de la simulación: app.js mantiene
   el número (biomass, 0..1) y aquí sólo se traduce a lo visual. Se separa
   en dos funciones, igual que fish.js/plants.js:

     - growthTick(dt, biomass, flowIntensity): se llama en CADA fotograma
       desde el bucle principal. Mueve las algas con un vaivén orgánico
       (ver sección 20 del brief: reacciona al flujo) y revela/oculta cada
       instancia según su propio umbral de biomasa. Se congela solo con
       pasar dt=0 (igual que fish.js), así que hereda gratis el
       comportamiento de pausa/reanudación.

     - render(data): se llama una vez por "tick" de sensores (más
       económico) para lo que no necesita fluidez de 60fps: luz on/off,
       atenuado si está pausado, la barra-indicador de biomasa, el tinte
       verde del agua y la etiqueta de etapa de crecimiento.
   ========================================================================= */

window.Aqua = window.Aqua || {};

Aqua.Photobioreactor = (function () {

  const SVG_NS = 'http://www.w3.org/2000/svg';

  let lightGlowEl = null;
  let ledCoreEl = null;
  let ledHaloEl = null;
  let biomassRectEl = null;
  let groupEl = null;
  let statusEl = null;
  let tintEl = null;
  let growthLabelEl = null;

  const BIOMASS_MAX_H = 48; // alto máximo (px en el viewBox) de la barra de biomasa
  const BIOMASS_BOTTOM_Y = 486; // borde inferior interno del reactor

  // Área interior del reactor donde se distribuyen las algas.
  const REACTOR = { x: 832, y: 438, w: 316, h: 44 };

  let algaeInstances = []; // { el, cx0, cy0, threshold, phase, freq, ampX, ampY }
  let time = 0;

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  /**
   * Construye la forma local (centrada en 0,0) de una instancia de alga.
   * "particle": una partícula suelta. "cluster": una colonia de 2 blobs.
   * "filament": un filamento curvo. Todas se envuelven en un <g> propio
   * para poder moverlas con un único transform="translate(...) scale(...)"
   * — el mismo patrón ya usado por fish.js, sin animación CSS de por medio.
   */
  function buildShape(type) {
    const g = document.createElementNS(SVG_NS, 'g');
    if (type === 'cluster') {
      [[-2.2, 0.3, 2.5], [2.1, -1, 2.0]].forEach(([ox, oy, r]) => {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', ox);
        c.setAttribute('cy', oy);
        c.setAttribute('r', r);
        c.classList.add('algae-colony');
        g.appendChild(c);
      });
    } else if (type === 'filament') {
      const len = 7 + Math.random() * 7;
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', `M${(-len / 2).toFixed(1)},3 Q0,${(-4 - Math.random() * 3).toFixed(1)} ${(len / 2).toFixed(1)},2`);
      p.classList.add('algae-filament');
      g.appendChild(p);
    } else {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', 0);
      c.setAttribute('cy', 0);
      c.setAttribute('r', (2.2 + Math.random() * 1.8).toFixed(1));
      c.classList.add('algae-colony');
      g.appendChild(c);
    }
    return g;
  }

  /**
   * Crea el campo de algas UNA sola vez (no en cada fotograma, no en cada
   * tick): un grupo fijo de instancias con su propio umbral de biomasa al
   * que "despiertan". Reiniciar la simulación no reconstruye este campo —
   * basta con que la biomasa vuelva a bajar para que growthTick() las
   * vuelva a ocultar solas, así que no hace falta código de reset aparte.
   */
  function buildAlgaeField(groupEl) {
    groupEl.innerHTML = '';
    algaeInstances = [];

    const specs = [];
    for (let i = 0; i < 12; i++) specs.push('particle');
    for (let i = 0; i < 6; i++) specs.push('cluster');
    for (let i = 0; i < 8; i++) specs.push('filament');
    specs.sort(() => Math.random() - 0.5); // que los tipos no queden agrupados por umbral

    specs.forEach((type, i) => {
      const el = buildShape(type);
      groupEl.appendChild(el);
      algaeInstances.push({
        el,
        cx0: REACTOR.x + Math.random() * REACTOR.w,
        cy0: REACTOR.y + Math.random() * REACTOR.h,
        threshold: 0.02 + (i / specs.length) * 0.86 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
        freq: 0.12 + Math.random() * 0.18,
        ampX: 2 + Math.random() * 3.5,
        ampY: 1.2 + Math.random() * 2.2,
      });
    });
  }

  // Cinco niveles visuales/nombrados (ver sección 4 y 13 del brief).
  const STAGES = [
    { max: 0.18, name: 'iniciando' },
    { max: 0.40, name: 'crecimiento temprano' },
    { max: 0.65, name: 'crecimiento activo' },
    { max: 0.85, name: 'alta actividad' },
    { max: 1.01, name: 'biomasa elevada' },
  ];

  function stageName(biomass) {
    const s = STAGES.find((st) => biomass <= st.max);
    return (s || STAGES[STAGES.length - 1]).name;
  }

  function init(svgSelector) {
    const svgRoot = typeof svgSelector === 'string' ? document.querySelector(svgSelector) : svgSelector;
    lightGlowEl = svgRoot.querySelector('#pbrLightGlow');
    ledCoreEl = svgRoot.querySelector('#pbrLedCore');
    ledHaloEl = svgRoot.querySelector('#pbrLedGlow');
    biomassRectEl = svgRoot.querySelector('#pbrBiomassRect');
    groupEl = svgRoot.querySelector('#pbrUnit');
    statusEl = svgRoot.querySelector('#pbrStatusTxt');
    tintEl = svgRoot.querySelector('#pbrWaterTint');
    growthLabelEl = svgRoot.querySelector('#pbrGrowthLabel');

    buildAlgaeField(svgRoot.querySelector('#pbrAlgaeGroup'));
    time = 0;
  }

  /**
   * Fotograma a fotograma: revela/oculta cada instancia según su umbral y
   * les da un vaivén orgánico. `flowIntensity` (0..1) viene de app.js y
   * hace que el movimiento sea más notorio con buen caudal y casi nulo
   * sin flujo (sección 20 del brief). dt=0 (simulación en pausa) congela
   * tanto el movimiento como la revelación, porque ninguno de los dos
   * cambia si no avanza el tiempo ni cambia la biomasa.
   */
  function growthTick(dt, biomass, flowIntensity) {
    if (dt > 0) time += dt;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flow = reduceMotion ? 0 : clamp01(flowIntensity);

    algaeInstances.forEach((inst) => {
      const reveal = clamp01((biomass - inst.threshold) / 0.16);
      if (reveal <= 0) {
        inst.el.setAttribute('opacity', '0');
        return;
      }
      const dx = flow * inst.ampX * Math.sin(time * inst.freq * Math.PI * 2 + inst.phase);
      const dy = flow * inst.ampY * Math.cos(time * inst.freq * Math.PI * 2 * 0.8 + inst.phase);
      const scale = 0.45 + 0.55 * reveal;
      inst.el.setAttribute('transform', `translate(${(inst.cx0 + dx).toFixed(1)},${(inst.cy0 + dy).toFixed(1)}) scale(${scale.toFixed(2)})`);
      inst.el.setAttribute('opacity', (0.3 + 0.5 * reveal).toFixed(2));
    });
  }

  /**
   * `data`: { light, active, biomass (0..1), lowActivity }
   */
  function render(data) {
    // `lit` gobierna TODA la iluminación del reactor: el resplandor general
    // (pbrLightGlow, ya existente) y ahora también la barra LED física
    // (pbrLedCore/pbrLedGlow) — mismo booleano, mismo lugar, ningún sistema
    // paralelo nuevo.
    const lit = !!data.light && data.active;

    if (lightGlowEl) {
      lightGlowEl.classList.toggle('on', lit);
      lightGlowEl.classList.toggle('off', !lit);
    }
    if (ledCoreEl) {
      ledCoreEl.classList.toggle('on', lit);
      ledCoreEl.classList.toggle('off', !lit);
    }
    if (ledHaloEl) {
      ledHaloEl.classList.toggle('on', lit);
      ledHaloEl.classList.toggle('off', !lit);
    }

    if (groupEl) groupEl.classList.toggle('inactive', !data.active);

    if (biomassRectEl) {
      const h = BIOMASS_MAX_H * clamp01(data.biomass);
      biomassRectEl.setAttribute('height', h.toFixed(1));
      biomassRectEl.setAttribute('y', (BIOMASS_BOTTOM_Y - h).toFixed(1));
    }

    // Tinte del agua: se intensifica con la biomasa pero se mantiene
    // moderado a propósito para no tapar paredes/burbujas/luz (sección 11).
    if (tintEl) tintEl.style.opacity = (0.03 + clamp01(data.biomass) * 0.4).toFixed(2);

    if (growthLabelEl) {
      const pct = Math.round(clamp01(data.biomass) * 100);
      growthLabelEl.textContent = `🟢 biomasa ${pct}% · ${stageName(data.biomass)}`;
    }

    if (statusEl) {
      let text = 'OK';
      let warn = false;
      if (!data.active) {
        text = 'PAUSADO';
      } else if (data.lowActivity) {
        text = 'ACTIVIDAD BAJA';
        warn = true;
      }
      statusEl.textContent = text;
      statusEl.classList.toggle('warn', warn);
    }
  }

  return { init, growthTick, render, stageName };
})();
