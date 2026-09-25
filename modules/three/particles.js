/* =========================================================================
   modules/three/particles.js
   Partículas de residuos/nutrientes recorriendo curvas 3D reales con
   curve.getPointAt(t) — el reemplazo conceptual exacto del antiguo
   getPointAtLength() de SVG. Misma arquitectura de "tramos" (legs) que ya
   tenía modules/nutrients.js: cada partícula es una lista de tramos con
   su propia curva, duración y color; la bifurcación plantas/PBR se decide
   al nacer, igual que antes. Expone la misma API pública (Aqua.Nutrients)
   así que app.js no tuvo que cambiar cómo la usa.
   ========================================================================= */

import * as THREE from 'three';

window.Aqua = window.Aqua || {};

Aqua.Nutrients = (function () {

  let scene = null;
  let particles = [];
  let wasteTimer = 0;
  let nutrientTimer = 0;
  let idCounter = 0;
  let pbrFraction = 0.4;
  let pbrEnabled = true;

  const COLORS = {
    waste: 0x6b4a2a,
    ammonia: 0xe8935a,
    nitrite: 0xe0c23a,
    nitrate: 0x7fc65a,
    pbr: 0x5fcf93,
    clean: 0x74c2bc,
  };

  const LEG_DURATIONS = {
    toFilter: 1.1, toBio: 1.0, throughBio: 0.9,
    toPlants: 0.9, throughPlants: 1.4, toConverge: 0.8, toSump: 0.6,
    toBifurcationPBR: 0.25, intoPBR: 0.6, throughPBR: 1.1, outOfPBR: 0.6, pbrToConverge: 0.8,
    returning: 3.0,
  };

  let callbacks = {
    onWasteCaught: function () {},
    onNutrientAbsorbed: function () {},
    onCycleComplete: function () {},
    onPBRTransit: function () {},
  };

  function makeSphere(color, radius) {
    const geo = new THREE.SphereGeometry(radius, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return mesh;
  }

  function init() {
    scene = Aqua.Three.getScene();
  }

  function setCallbacks(cb) { callbacks = Object.assign(callbacks, cb); }
  function setBranchRatio(plantsFraction) { pbrFraction = Math.min(1, Math.max(0, 1 - plantsFraction)); }
  function setPBREnabled(enabled) { pbrEnabled = !!enabled; }

  function spawnWaste() {
    particles.push({
      id: 'p' + (idCounter++),
      kind: 'waste',
      mesh: makeSphere(COLORS.waste, 0.045),
      legIndex: 0,
      legElapsed: 0,
      legs: [{ curve: 'fishToFilter', dur: LEG_DURATIONS.toFilter, color: COLORS.waste }],
      done: false,
    });
  }

  function spawnNutrient() {
    const toPBR = pbrEnabled && Math.random() < pbrFraction;
    const willBeAbsorbed = Math.random() < 0.5;
    const absorbAt = 0.25 + Math.random() * 0.55;

    const legs = [
      { curve: 'filterToBio', dur: LEG_DURATIONS.toBio, color: COLORS.ammonia },
      { curve: 'throughBio', dur: LEG_DURATIONS.throughBio, color: COLORS.nitrite },
    ];

    if (toPBR) {
      legs.push(
        { curve: 'bioToBifurcation', dur: LEG_DURATIONS.toBifurcationPBR, color: COLORS.nitrate },
        { curve: 'bifurcationToPBR', dur: LEG_DURATIONS.intoPBR, color: COLORS.nitrate },
        { curve: 'throughPBR', dur: LEG_DURATIONS.throughPBR, color: COLORS.pbr, pbrTransit: true },
        { curve: 'pbrToConverge', dur: LEG_DURATIONS.outOfPBR, color: COLORS.clean },
        { curve: 'convergeToSump', dur: LEG_DURATIONS.toSump, color: COLORS.clean },
        { curve: 'pumpToReturn', dur: LEG_DURATIONS.returning, color: COLORS.clean }
      );
    } else {
      legs.push(
        { curve: 'bioToBifurcation', dur: LEG_DURATIONS.toBifurcationPBR, color: COLORS.nitrate },
        { curve: 'bifurcationToPlants', dur: LEG_DURATIONS.toPlants, color: COLORS.nitrate },
        { curve: 'throughPlants', dur: LEG_DURATIONS.throughPlants, color: COLORS.nitrate, absorbable: true },
        { curve: 'plantsToConverge', dur: LEG_DURATIONS.toConverge, color: COLORS.clean },
        { curve: 'convergeToSump', dur: LEG_DURATIONS.toSump, color: COLORS.clean },
        { curve: 'pumpToReturn', dur: LEG_DURATIONS.returning, color: COLORS.clean }
      );
    }

    particles.push({
      id: 'p' + (idCounter++),
      kind: 'nutrient',
      branch: toPBR ? 'pbr' : 'plants',
      mesh: makeSphere(COLORS.ammonia, 0.035),
      legIndex: 0,
      legElapsed: 0,
      willBeAbsorbed,
      absorbAt,
      legs,
      done: false,
    });
  }

  function removeParticle(p) {
    if (p.mesh) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    p.done = true;
  }

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
      if (!flowing) continue; // congeladas en su posición actual

      const leg = p.legs[p.legIndex];
      p.legElapsed += dt * speed;
      const legProgress = Math.min(1, p.legElapsed / leg.dur);

      const pos = Aqua.WaterFlow.pointAt(leg.curve, legProgress);
      p.mesh.position.copy(pos);
      if (p.mesh.material.color.getHex() !== leg.color) {
        p.mesh.material.color.setHex(leg.color);
        p.mesh.material.emissive.setHex(leg.color);
      }

      if (p.kind === 'nutrient' && leg.absorbable && p.willBeAbsorbed && legProgress >= p.absorbAt) {
        callbacks.onNutrientAbsorbed();
        removeParticle(p);
        continue;
      }

      if (legProgress >= 1) {
        if (leg.pbrTransit) callbacks.onPBRTransit();
        p.legIndex += 1;
        if (p.legIndex >= p.legs.length) {
          if (p.kind === 'waste') callbacks.onWasteCaught();
          if (p.kind === 'nutrient') callbacks.onCycleComplete();
          removeParticle(p);
        } else {
          p.legElapsed = 0;
        }
      }
    }
  }

  function reset() {
    particles.forEach((p) => removeParticle(p));
    particles = [];
    wasteTimer = 0;
    nutrientTimer = 0;
  }

  function particleCount() { return particles.length; }

  return { init, setCallbacks, setBranchRatio, setPBREnabled, update, reset, spawnWaste, spawnNutrient, particleCount };
})();
