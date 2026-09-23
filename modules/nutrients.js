/* =========================================================================
   modules/nutrients.js
   Sistema de partículas que representa visualmente:
     - los residuos sólidos de los peces (café) que quedan retenidos en el
       filtro mecánico,
     - los nutrientes disueltos que atraviesan el biofiltro cambiando de
       color (amoníaco -> nitrito -> nitrato) y que luego son parcialmente
       absorbidos por las raíces de las plantas.
   ========================================================================= */

window.Aqua = window.Aqua || {};

Aqua.Nutrients = (function () {

  const SVG_NS = 'http://www.w3.org/2000/svg';

  let layer = null;
  let checkpoints = null;
  let particles = [];
  let wasteTimer = 0;
  let nutrientTimer = 0;
  let idCounter = 0;

  // Fracción del caudal (0..1) que se dirige al fotobiorreactor en vez de
  // a las plantas, y si esa rama está habilitada. Los controla app.js a
  // través de setBranchRatio()/setPBREnabled() cuando el usuario mueve el
  // slider de caudal o pausa el PBR.
  let pbrFraction = 0.4;
  let pbrEnabled = true;

  // Duraciones base (segundos a velocidad 1x) de cada tramo del recorrido.
  const LEG_DURATIONS = {
    toFilter: 1.1, toBio: 1.0, throughBio: 0.9,
    toTube: 0.9, throughTube: 1.4, toPump: 1.1, returning: 2.2,
    toBifurcation: 0.25, intoPBR: 0.5, throughPBR: 1.3, outOfPBR: 0.5, fromCollector: 0.4,
  };

  let callbacks = {
    onWasteCaught: function () {},
    onNutrientAbsorbed: function () {},
    onCycleComplete: function () {},
    onPBRTransit: function () {},
  };

  function init(svgSelector, layerSelector) {
    const svgRoot = typeof svgSelector === 'string' ? document.querySelector(svgSelector) : svgSelector;
    layer = svgRoot.querySelector(layerSelector || '#particlesLayer');

    checkpoints = {
      start: 0,
      filterIn: Aqua.WaterFlow.progressAtX('pipeMain', 340),
      filterOut: Aqua.WaterFlow.progressAtX('pipeMain', 490),
      bioIn: Aqua.WaterFlow.progressAtX('pipeMain', 570),
      bioOut: Aqua.WaterFlow.progressAtX('pipeMain', 720),
      bifurcation: Aqua.WaterFlow.progressAtX('pipeMain', 760),
      tubeIn: Aqua.WaterFlow.progressAtX('pipeMain', 820),
      tubeOut: Aqua.WaterFlow.progressAtX('pipeMain', 1160),
      collector: Aqua.WaterFlow.progressAtX('pipeMain', 1200),
      pumpIn: Aqua.WaterFlow.progressAtX('pipeMain', 1250),
      end: 1,
      // puntos de entrada/salida del fotobiorreactor, medidos sobre su
      // propia tubería (pipePBR), no sobre pipeMain
      pbrIn: Aqua.WaterFlow.progressAtX('pipePBR', 820),
      pbrOut: Aqua.WaterFlow.progressAtX('pipePBR', 1160),
    };
  }

  function setCallbacks(cb) {
    callbacks = Object.assign(callbacks, cb);
  }

  /** plantsFraction: 0..1, fracción del caudal que va a las plantas. */
  function setBranchRatio(plantsFraction) {
    pbrFraction = Math.min(1, Math.max(0, 1 - plantsFraction));
  }

  function setPBREnabled(enabled) {
    pbrEnabled = !!enabled;
  }

  function makeCircle(type) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', type === 'waste' ? 4 : 3.2);
    c.classList.add('particle', type);
    layer.appendChild(c);
    return c;
  }

  function spawnWaste() {
    const p = {
      id: 'p' + (idCounter++),
      kind: 'waste',
      el: makeCircle('waste'),
      legIndex: 0,
      legElapsed: 0,
      legs: [
        { pathId: 'pipeMain', from: checkpoints.start, to: checkpoints.filterIn, dur: LEG_DURATIONS.toFilter, cls: 'waste' },
      ],
      done: false,
    };
    particles.push(p);
  }

  function spawnNutrient() {
    const toPBR = pbrEnabled && Math.random() < pbrFraction;
    const willBeAbsorbed = Math.random() < 0.5;
    const absorbAt = 0.25 + Math.random() * 0.55; // punto dentro del tramo de las plantas

    // Tramo común a ambas ramas: del filtro al biofiltro (amoníaco -> nitrito).
    const legs = [
      { pathId: 'pipeMain', from: checkpoints.filterOut, to: checkpoints.bioIn, dur: LEG_DURATIONS.toBio, cls: 'ammonia' },
      { pathId: 'pipeMain', from: checkpoints.bioIn, to: checkpoints.bioOut, dur: LEG_DURATIONS.throughBio, cls: 'nitrite' },
    ];

    if (toPBR) {
      // Rama del fotobiorreactor: se separa en la bifurcación, atraviesa
      // el PBR (donde cambia de apariencia representando la actividad
      // biológica con luz) y vuelve a unirse en el punto de convergencia.
      legs.push(
        { pathId: 'pipeMain', from: checkpoints.bioOut, to: checkpoints.bifurcation, dur: LEG_DURATIONS.toBifurcation, cls: 'nitrate' },
        { pathId: 'pipePBR', from: 0, to: checkpoints.pbrIn, dur: LEG_DURATIONS.intoPBR, cls: 'nitrate' },
        { pathId: 'pipePBR', from: checkpoints.pbrIn, to: checkpoints.pbrOut, dur: LEG_DURATIONS.throughPBR, cls: 'pbr', pbrTransit: true },
        { pathId: 'pipePBR', from: checkpoints.pbrOut, to: 1, dur: LEG_DURATIONS.outOfPBR, cls: 'clean' },
        { pathId: 'pipeMain', from: checkpoints.collector, to: checkpoints.pumpIn, dur: LEG_DURATIONS.fromCollector, cls: 'clean' },
        { pathId: 'pipeReturn', from: 0, to: 1, dur: LEG_DURATIONS.returning, cls: 'clean' }
      );
    } else {
      // Rama de las plantas (comportamiento original, sin cambios).
      legs.push(
        { pathId: 'pipeMain', from: checkpoints.bioOut, to: checkpoints.tubeIn, dur: LEG_DURATIONS.toTube, cls: 'nitrate' },
        { pathId: 'pipeMain', from: checkpoints.tubeIn, to: checkpoints.tubeOut, dur: LEG_DURATIONS.throughTube, cls: 'nitrate', absorbable: true },
        { pathId: 'pipeMain', from: checkpoints.tubeOut, to: checkpoints.pumpIn, dur: LEG_DURATIONS.toPump, cls: 'clean' },
        { pathId: 'pipeReturn', from: 0, to: 1, dur: LEG_DURATIONS.returning, cls: 'clean' }
      );
    }

    const p = {
      id: 'p' + (idCounter++),
      kind: 'nutrient',
      branch: toPBR ? 'pbr' : 'plants',
      el: makeCircle('nutrient'),
      legIndex: 0,
      legElapsed: 0,
      willBeAbsorbed,
      absorbAt,
      legs,
      done: false,
    };
    particles.push(p);
  }

  function removeParticle(p) {
    if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el);
    p.done = true;
  }

  /**
   * Avanza la simulación de partículas. `dt` en segundos reales,
   * `speed` es el multiplicador de velocidad del usuario, `flowing`
   * indica si hay circulación de agua (bomba encendida y sin fallas
   * que la detengan). Cuando no hay flujo, las partículas existentes
   * quedan congeladas en su posición (no se generan nuevas).
   */
  function update(dt, speed, flowing, emissionModifiers) {
    emissionModifiers = emissionModifiers || {};
    const wasteInterval = 1.3 / Math.max(0.3, (emissionModifiers.wasteRate || 1));
    const nutrientInterval = 1.6;

    if (flowing) {
      wasteTimer += dt * speed;
      nutrientTimer += dt * speed;
      if (wasteTimer >= wasteInterval) { wasteTimer = 0; spawnWaste(); }
      if (nutrientTimer >= nutrientInterval) { nutrientTimer = 0; spawnNutrient(); }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.done) { particles.splice(i, 1); continue; }
      if (!flowing) continue; // congelado en su posición actual

      const leg = p.legs[p.legIndex];
      p.legElapsed += dt * speed;

      // Actualiza la clase de color si cambió de tramo
      if (p.el.dataset.cls !== leg.cls) {
        p.el.setAttribute('class', 'particle ' + leg.cls);
        p.el.dataset.cls = leg.cls;
      }

      let legProgress = Math.min(1, p.legElapsed / leg.dur);
      const overallProgress = leg.from + (leg.to - leg.from) * legProgress;
      const pt = Aqua.WaterFlow.pointAt(leg.pathId, overallProgress);
      p.el.setAttribute('cx', pt.x);
      p.el.setAttribute('cy', pt.y);

      // Absorción de nutrientes por las raíces a mitad del tramo de plantas
      if (p.kind === 'nutrient' && leg.absorbable && p.willBeAbsorbed && legProgress >= p.absorbAt) {
        p.el.classList.add('absorbing');
        callbacks.onNutrientAbsorbed();
        setTimeout(() => removeParticle(p), 480);
        p.done = true; // se removerá en el siguiente barrido tras el fade
        continue;
      }

      if (legProgress >= 1) {
        if (leg.pbrTransit) callbacks.onPBRTransit();
        p.legIndex += 1;
        p.legElapsed = 0;
        if (p.legIndex >= p.legs.length) {
          if (p.kind === 'waste') callbacks.onWasteCaught();
          if (p.kind === 'nutrient') callbacks.onCycleComplete();
          removeParticle(p);
        }
      }
    }
  }

  function reset() {
    particles.forEach((p) => { if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    particles = [];
    wasteTimer = 0;
    nutrientTimer = 0;
  }

  function particleCount() {
    return particles.length;
  }

  return { init, setCallbacks, setBranchRatio, setPBREnabled, update, reset, spawnWaste, spawnNutrient, particleCount };
})();
