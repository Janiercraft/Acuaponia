/* =========================================================================
   modules/three/sump.js
   Depósito/bomba como tanque 3D (BoxGeometry) con un rotor real
   (CylinderGeometry + aspas) que gira sobre su propio eje. En Three.js
   girar un mesh es simplemente mesh.rotation.y += ángulo cada fotograma
   — no existe el conflicto CSS-transform-vs-SVG-transform que obligaba a
   la versión 2D a hacerlo con cuidado especial; aquí es la forma normal
   y segura de animar rotación.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Sump = (function () {

  const L = LAYOUT.sump;
  let rotorGroup = null;
  let indicatorMat = null;
  let spinning = false;

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const group = new THREE.Group();
    group.position.set(L.center.x, L.size.h / 2, L.center.z);

    const bodyGeo = new THREE.BoxGeometry(L.size.w, L.size.h, L.size.d);
    const body = new THREE.Mesh(bodyGeo, Aqua.Materials.plastic(0xf0be22, 0.55));
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const lidGeo = new THREE.BoxGeometry(L.size.w * 0.75, 0.08, L.size.d * 0.75);
    const lid = new THREE.Mesh(lidGeo, Aqua.Materials.plastic(0xe9edea, 0.6));
    lid.position.y = L.size.h / 2 + 0.04;
    group.add(lid);

    // rotor: cubo/eje + 4 aspas, dentro de una pequeña carcasa visible
    // desde afuera (representa la bomba real conectada a la tubería).
    rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, L.size.h * 0.1, L.size.d / 2 + 0.02);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), Aqua.Materials.metal(0x3e8fe0, 0.3));
    hub.rotation.x = Math.PI / 2;
    rotorGroup.add(hub);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfefff, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.05), bladeMat);
      blade.position.y = 0.09;
      blade.rotation.z = (i / 4) * Math.PI * 2;
      rotorGroup.add(blade);
    }
    group.add(rotorGroup);

    const indicatorGeo = new THREE.SphereGeometry(0.05, 12, 12);
    indicatorMat = Aqua.Materials.emissive(0x59c27c, 0.6);
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.set(L.size.w / 2 - 0.1, L.size.h / 2 - 0.1, L.size.d / 2 + 0.02);
    group.add(indicator);

    scene.add(group);
  }

  function setSpinning(active) { spinning = !!active; }

  /** dt ya escalado por velocidad de simulación (igual que Fish.update),
   *  para que el rotor acelere/frene junto con el resto del sistema —
   *  a diferencia del pulso de las bacterias del biofiltro, que es sólo
   *  decorativo y corre a ritmo real fijo. */
  function update(dt) {
    if (spinning && rotorGroup) rotorGroup.rotation.z += dt * 6.5;
  }

  function setIndicator(on) {
    if (!indicatorMat) return;
    indicatorMat.emissive.set(on ? 0x59c27c : 0xe15b4b);
    indicatorMat.emissiveIntensity = on ? 0.7 : 0.4;
  }

  return { init, setSpinning, update, setIndicator };
})();
