/* =========================================================================
   modules/three/growBeds.js
   Canales de cultivo hidropónico y plantas. Se agrupan bajo un mismo root
   para poder enfocarlos individualmente con un clic.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Plants = (function () {

  const gb = LAYOUT.growBed;
  let plants = [];

  function buildLeg(x, z) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, gb.tubeY - 0.22, 0.08),
      Aqua.Materials.metal(0x7f8f8b, 0.45)
    );
    leg.position.set(x, (gb.tubeY - 0.22) / 2, z);
    leg.castShadow = true;
    return leg;
  }

  function buildPlant() {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x4e7f3a, roughness: 0.75 })
    );
    stem.position.y = 0.11;
    group.add(stem);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x66a848, roughness: 0.65, side: THREE.DoubleSide });
    const leafGeo = new THREE.SphereGeometry(0.08, 10, 8, 0, Math.PI, 0, Math.PI / 1.8);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 0.18 + (i % 2) * 0.03;
      leaf.rotation.x = Math.PI / 2.2;
      leaf.rotation.z = (i / 5) * Math.PI * 2;
      leaf.rotation.y = (i / 5) * Math.PI * 2;
      group.add(leaf);
    }

    group.scale.setScalar(0.15);
    return group;
  }

  function init() {
    const scene = Aqua.Three.getSystemRoot();
    const root = new THREE.Group();
    scene.add(root);
    Aqua.Three.registerSelectable(root, { id: 'growBeds', name: 'Área de crecimiento' });

    plants = [];
    gb.zRows.forEach((z) => {
      const length = gb.xEnd - gb.xStart;
      const tubeGeo = new THREE.CylinderGeometry(gb.tubeRadius, gb.tubeRadius, length, 20);
      tubeGeo.rotateZ(Math.PI / 2);
      const tube = new THREE.Mesh(tubeGeo, Aqua.Materials.plastic(0xe4d6a0, 0.55));
      tube.position.set((gb.xStart + gb.xEnd) / 2, gb.tubeY, z);
      tube.castShadow = true;
      tube.receiveShadow = true;
      root.add(tube);

      root.add(buildLeg(gb.xStart + 0.15, z));
      root.add(buildLeg(gb.xEnd - 0.15, z));

      for (let i = 0; i < gb.holesPerRow; i++) {
        const t = (i + 0.5) / gb.holesPerRow;
        const x = THREE.MathUtils.lerp(gb.xStart + 0.2, gb.xEnd - 0.2, t);
        const plant = buildPlant();
        plant.position.set(x, gb.tubeY + gb.tubeRadius, z);
        root.add(plant);
        plants.push({ group: plant, growth: 0 });
      }
    });
  }

  function growthTick(dt, speed, nutrientAvailability) {
    if (dt <= 0) return;
    const growthRate = 0.0019 * Math.max(0, nutrientAvailability) * Math.max(0.25, speed);
    plants.forEach((p, idx) => {
      p.growth = Math.min(1, p.growth + dt * growthRate * (0.92 + (idx % 6) * 0.035));
      const s = 0.15 + p.growth * 0.95;
      p.group.scale.setScalar(s);
      p.group.rotation.y += dt * 0.12 * (0.5 + (idx % 5) * 0.08);
    });
  }

  /** Evento puntual: una planta absorbe una partícula de nutrientes.
   *  Esta función es llamada por app.js desde onNutrientAbsorbed(). */
  function absorbTick() {
    if (!plants.length) return;
    const p = plants[Math.floor(Math.random() * plants.length)];
    p.growth = Math.min(1, p.growth + 0.05);
    const s = 0.15 + p.growth * 0.95;
    p.group.scale.setScalar(s);
  }

  function reset() {
    plants.forEach((p) => {
      p.growth = 0;
      p.group.scale.setScalar(0.15);
    });
  }

  function getGrowthPercent() {
    if (!plants.length) return 0;
    const avg = plants.reduce((acc, p) => acc + p.growth, 0) / plants.length;
    return Math.round(avg * 100);
  }

  return { init, growthTick, absorbTick, reset, getGrowthPercent };
})();
