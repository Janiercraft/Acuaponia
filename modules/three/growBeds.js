/* =========================================================================
   modules/three/growBeds.js
   Mesa de cultivo elevada: tres canales cilíndricos horizontales sobre
   patas reales (CylinderGeometry acostado, no un <rect> SVG), con
   plantas (tallo + hojas) que crecen desde cada orificio. Expone la
   misma API que antes (Aqua.Plants), así que app.js no necesitó cambiar
   sus llamadas — sólo cambió qué hay detrás de ellas.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Plants = (function () {

  const gb = LAYOUT.growBed;
  let plants = []; // { group, growth }

  function buildLeg(x, z) {
    const legGeo = new THREE.BoxGeometry(0.12, gb.tubeY, 0.12);
    const leg = new THREE.Mesh(legGeo, Aqua.Materials.plastic(0x2b3230, 0.85));
    leg.position.set(x, gb.tubeY / 2, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    return leg;
  }

  function buildPlant() {
    const group = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2c, roughness: 0.7 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9b4a, roughness: 0.6 });

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 6), stemMat);
    stem.position.y = 0.11;
    group.add(stem);

    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leafMat);
      leaf.scale.set(1.3, 0.4, 0.9);
      const ang = (i / 3) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 0.06, 0.16 + i * 0.03, Math.sin(ang) * 0.06);
      leaf.rotation.y = ang;
      group.add(leaf);
    }

    group.scale.setScalar(0.001); // arranca prácticamente invisible
    group.castShadow = true;
    return group;
  }

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    plants = [];

    gb.zRows.forEach((z) => {
      // canal (tubo horizontal, acostado sobre el eje X)
      const length = gb.xEnd - gb.xStart;
      const tubeGeo = new THREE.CylinderGeometry(gb.tubeRadius, gb.tubeRadius, length, 20);
      tubeGeo.rotateZ(Math.PI / 2);
      const tube = new THREE.Mesh(tubeGeo, Aqua.Materials.plastic(0xe4d6a0, 0.55));
      tube.position.set((gb.xStart + gb.xEnd) / 2, gb.tubeY, z);
      tube.castShadow = true;
      tube.receiveShadow = true;
      scene.add(tube);

      // patas de soporte en ambos extremos del canal
      scene.add(buildLeg(gb.xStart + 0.15, z));
      scene.add(buildLeg(gb.xEnd - 0.15, z));

      // plantas distribuidas a lo largo del canal, saliendo por arriba
      for (let i = 0; i < gb.holesPerRow; i++) {
        const t = (i + 0.5) / gb.holesPerRow;
        const x = THREE.MathUtils.lerp(gb.xStart + 0.2, gb.xEnd - 0.2, t);
        const plant = buildPlant();
        plant.position.set(x, gb.tubeY + gb.tubeRadius, z);
        scene.add(plant);
        plants.push({ group: plant, growth: 0 });
      }
    });
  }

  /** Igual firma que antes: dt real, multiplicador de velocidad, y
   *  disponibilidad de nutrientes (0..1) ya calculada en app.js. */
  function growthTick(dt, speed, nutrientAvailability) {
    if (dt <= 0) return;
    const rate = 0.05 * Math.max(0, nutrientAvailability) * speed * dt;
    plants.forEach((p) => {
      p.growth = Math.min(1, p.growth + rate);
      const s = 0.05 + p.growth * 0.95;
      p.group.scale.setScalar(s);
    });
  }

  /** Evento puntual: una raíz absorbe nutrientes — una planta al azar da
   *  un salto de crecimiento, igual que en la versión 2D. */
  function absorbTick() {
    if (!plants.length) return;
    const p = plants[Math.floor(Math.random() * plants.length)];
    p.growth = Math.min(1, p.growth + 0.05);
    p.group.scale.setScalar(0.05 + p.growth * 0.95);
  }

  function reset() {
    plants.forEach((p) => {
      p.growth = 0;
      p.group.scale.setScalar(0.001);
    });
  }

  function getGrowthPercent() {
    if (!plants.length) return 0;
    const avg = plants.reduce((sum, p) => sum + p.growth, 0) / plants.length;
    return Math.round(Math.min(1, Math.max(0, avg)) * 100);
  }

  return { init, growthTick, absorbTick, reset, getGrowthPercent };
})();
