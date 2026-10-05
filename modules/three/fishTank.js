/* =========================================================================
   modules/three/fishTank.js
   Tanque de peces con fondo cónico tipo embudo y salida inferior centrada.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.FishTank = (function () {

  let waterUpperMesh = null;
  let waterFunnelMesh = null;
  let frameGroup = null;
  const size = LAYOUT.fishTank.size;
  const center = LAYOUT.fishTank.center;

  const FUNNEL_H = Math.min(0.50, size.h * 0.28);
  const BODY_H = size.h - FUNNEL_H;
  const FUNNEL_TOP_R = Math.min(size.w, size.d) * 0.46;
  const FUNNEL_BOTTOM_R = 0.12;
  const NORMAL_WATER_H = size.h * 0.82;
  const LOW_WATER_H = size.h * 0.52;

  function init() {
    const scene = Aqua.Three.getSystemRoot();
    const group = new THREE.Group();
    group.position.set(center.x, size.h / 2, center.z);

    const wallMat = Aqua.Materials.glass(0xd7ded9, 0.22);
    const edgeMat = Aqua.Materials.metal(0x8a9a95, 0.35);

    const upperGeo = new THREE.BoxGeometry(size.w, BODY_H, size.d);
    const upperWalls = new THREE.Mesh(upperGeo, wallMat);
    upperWalls.position.y = FUNNEL_H / 2;
    upperWalls.castShadow = true;
    upperWalls.receiveShadow = true;
    group.add(upperWalls);

    const funnelGeo = new THREE.CylinderGeometry(FUNNEL_TOP_R, FUNNEL_BOTTOM_R, FUNNEL_H, 4, 1, false);
    funnelGeo.rotateY(Math.PI / 4);
    const funnelShell = new THREE.Mesh(funnelGeo, wallMat);
    funnelShell.position.y = -size.h / 2 + FUNNEL_H / 2;
    funnelShell.castShadow = true;
    funnelShell.receiveShadow = true;
    group.add(funnelShell);

    const postGeo = new THREE.BoxGeometry(0.05, BODY_H, 0.05);
    [
      [-size.w / 2, -size.d / 2], [size.w / 2, -size.d / 2],
      [-size.w / 2, size.d / 2], [size.w / 2, size.d / 2],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(postGeo, edgeMat);
      post.position.set(x, FUNNEL_H / 2, z);
      post.castShadow = true;
      group.add(post);
    });

    const bandGeoX = new THREE.BoxGeometry(size.w, 0.04, 0.04);
    const bandGeoZ = new THREE.BoxGeometry(0.04, 0.04, size.d);
    [0.25, 0.7].forEach((t) => {
      const y = -size.h / 2 + FUNNEL_H + BODY_H * t;
      [[0, -size.d / 2], [0, size.d / 2]].forEach(([x, z]) => {
        const band = new THREE.Mesh(bandGeoX, edgeMat);
        band.position.set(x, y, z);
        group.add(band);
      });
      [[-size.w / 2, 0], [size.w / 2, 0]].forEach(([x, z]) => {
        const band = new THREE.Mesh(bandGeoZ, edgeMat);
        band.position.set(x, y, z);
        group.add(band);
      });
    });

    waterFunnelMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(FUNNEL_TOP_R * 0.94, FUNNEL_BOTTOM_R * 1.25, FUNNEL_H, 4, 1, false),
      Aqua.Materials.water(0x3f9a95)
    );
    waterFunnelMesh.geometry.rotateY(Math.PI / 4);
    waterFunnelMesh.position.y = -size.h / 2 + FUNNEL_H / 2;
    group.add(waterFunnelMesh);

    const waterGeo = new THREE.BoxGeometry(size.w * 0.92, 1, size.d * 0.92);
    waterUpperMesh = new THREE.Mesh(waterGeo, Aqua.Materials.water(0x3f9a95));
    group.add(waterUpperMesh);
    applyWaterHeight(NORMAL_WATER_H);

    const outletGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 14);
    const outlet = new THREE.Mesh(outletGeo, Aqua.Materials.metal(0x7b8f8a, 0.35));
    outlet.position.set(0, -size.h / 2 + 0.11, 0);
    outlet.castShadow = true;
    group.add(outlet);

    const palletGeo = new THREE.BoxGeometry(size.w * 1.05, 0.12, size.d * 1.05);
    const pallet = new THREE.Mesh(palletGeo, Aqua.Materials.plastic(0x38403e, 0.9));
    pallet.position.y = -size.h / 2 - 0.06;
    pallet.receiveShadow = true;
    pallet.castShadow = true;
    group.add(pallet);

    scene.add(group);
    Aqua.Three.registerSelectable(group, { id: 'fishTank', name: 'Tanque de peces' });
    frameGroup = group;
  }

  function applyWaterHeight(totalHeight) {
    if (!waterUpperMesh || !waterFunnelMesh) return;
    const safeHeight = Math.max(FUNNEL_H + 0.10, Math.min(totalHeight, size.h * 0.90));
    const upperH = Math.max(0.10, safeHeight - FUNNEL_H);
    waterUpperMesh.scale.y = upperH;
    waterUpperMesh.position.y = -size.h / 2 + FUNNEL_H + upperH / 2;
  }

  function setWaterLevel(low) {
    applyWaterHeight(low ? LOW_WATER_H : NORMAL_WATER_H);
  }

  function setAtRisk(active) {
    if (waterUpperMesh) waterUpperMesh.material.color.set(active ? 0x8a5a4a : 0x3f9a95);
    if (waterFunnelMesh) waterFunnelMesh.material.color.set(active ? 0x8a5a4a : 0x3f9a95);
  }

  function getSwimBounds() {
    return {
      minX: center.x - size.w * 0.4,
      maxX: center.x + size.w * 0.4,
      minY: 0.35,
      maxY: NORMAL_WATER_H * 0.82,
      minZ: center.z - size.d * 0.4,
      maxZ: center.z + size.d * 0.4,
    };
  }

  return { init, setWaterLevel, setAtRisk, getSwimBounds };
})();
