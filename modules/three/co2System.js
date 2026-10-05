/* =========================================================================
   modules/three/co2System.js
   Bomba/compresor de CO₂ como carcasa 3D (BoxGeometry con patas y un
   detalle circular de ventilación) fuera del fotobiorreactor, conectada
   al difusor interno mediante una manguera curva y delgada — un tubo
   real (TubeGeometry), pero de radio muy inferior al de las tuberías de
   agua para que no se confundan visualmente.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT, computePorts } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Co2System = (function () {

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const L = LAYOUT.co2Pump;
    const detailScale = Math.max(0.75, Math.min(2.8, L.size.h / 0.60));

    const group = new THREE.Group();
    group.position.set(L.center.x, 0, L.center.z);

    const bodyGeo = new THREE.BoxGeometry(L.size.w, L.size.h, L.size.d);
    const body = new THREE.Mesh(bodyGeo, Aqua.Materials.plastic(0x203633, 0.6));
    body.position.y = L.size.h / 2 + 0.06;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // patas cortas
    const legGeo = new THREE.CylinderGeometry(0.025 * detailScale, 0.025 * detailScale, 0.12 * detailScale, 8);
    const legMat = Aqua.Materials.metal(0x4d5c58, 0.4);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * (L.size.w / 2 - 0.06 * detailScale), 0.06 * detailScale, sz * (L.size.d / 2 - 0.06 * detailScale));
      leg.castShadow = true;
      group.add(leg);
    });

    // detalle de ventilación: aro + aspas simples
    const ventRing = new THREE.Mesh(new THREE.TorusGeometry(0.09 * detailScale, 0.012 * detailScale, 8, 20), Aqua.Materials.metal(0x74c2bc, 0.3));
    ventRing.position.set(0, L.size.h / 2 + 0.06, L.size.d / 2 + 0.01 * detailScale);
    group.add(ventRing);
    const crossGeo = new THREE.BoxGeometry(0.16 * detailScale, 0.016 * detailScale, 0.016 * detailScale);
    const cross1 = new THREE.Mesh(crossGeo, Aqua.Materials.metal(0x74c2bc, 0.3));
    cross1.position.copy(ventRing.position);
    group.add(cross1);
    const cross2 = cross1.clone();
    cross2.rotation.z = Math.PI / 2;
    group.add(cross2);

    // boquilla de salida (donde arranca la manguera)
    const nozzleGeo = new THREE.CylinderGeometry(0.02 * detailScale, 0.02 * detailScale, 0.06 * detailScale, 8);
    const nozzle = new THREE.Mesh(nozzleGeo, Aqua.Materials.metal(0x4d5c58, 0.4));
    nozzle.position.set(0, L.size.h + 0.09 * detailScale, 0);
    group.add(nozzle);

    scene.add(group);
    Aqua.Three.registerSelectable(group, { id: 'co2Pump', name: 'Bomba CO2' });

    // manguera: bomba -> sube -> entra por arriba del reactor -> baja
    // hasta el difusor. Curva independiente de las tuberías de agua.
    const P = computePorts();
    const pumpTop = { x: L.center.x, y: L.size.h + 0.12 * detailScale, z: L.center.z };
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(pumpTop.x, pumpTop.y, pumpTop.z),
      new THREE.Vector3(pumpTop.x, P.pbrIn.y + 0.15, pumpTop.z),
      new THREE.Vector3(P.diffuser.x, P.pbrIn.y + 0.1, P.diffuser.z),
      new THREE.Vector3(P.diffuser.x, P.diffuser.y + 0.05, P.diffuser.z),
    ]);
    const hoseGeo = new THREE.TubeGeometry(curve, 40, 0.014 * Math.min(1.8, detailScale), 8, false);
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x647975, roughness: 0.7 });
    const hose = new THREE.Mesh(hoseGeo, hoseMat);
    hose.castShadow = true;
    scene.add(hose);
  }

  return { init };
})();
