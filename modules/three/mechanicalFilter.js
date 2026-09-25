/* =========================================================================
   modules/three/mechanicalFilter.js
   Filtro mecánico como cámara cilíndrica real, con un cilindro interior
   más pequeño (el "sedimento" retenido) que sube igual que antes lo hacía
   filterLoadRect en el SVG, pero ahora es volumen de verdad.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.MechanicalFilter = (function () {

  const L = LAYOUT.mechanicalFilter;
  let loadMesh = null;

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const group = new THREE.Group();
    group.position.set(L.center.x, L.height / 2, L.center.z);

    const bodyGeo = new THREE.CylinderGeometry(L.radius, L.radius, L.height, 24);
    const body = new THREE.Mesh(bodyGeo, Aqua.Materials.plastic(0xc7d0cc, 0.6));
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // sedimento retenido: cilindro interior semitransparente que crece
    // desde el fondo (setLoad(0..1) controla su altura).
    const loadGeo = new THREE.CylinderGeometry(L.radius * 0.82, L.radius * 0.82, 1, 20);
    loadMesh = new THREE.Mesh(loadGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2a, transparent: true, opacity: 0.85 }));
    loadMesh.scale.y = 0.0001;
    loadMesh.position.y = -L.height / 2;
    group.add(loadMesh);

    // conexiones (dos muñones cortos donde llegan/salen las tuberías)
    const portMat = Aqua.Materials.metal(0x8a9a95, 0.3);
    const portGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.18, 12);
    const inPort = new THREE.Mesh(portGeo, portMat);
    inPort.rotation.z = Math.PI / 2;
    inPort.position.set(-L.radius - 0.05, L.height * 0.05, 0);
    group.add(inPort);
    const outPort = new THREE.Mesh(portGeo, portMat);
    outPort.rotation.z = Math.PI / 2;
    outPort.position.set(L.radius + 0.05, L.height * 0.05, 0);
    group.add(outPort);

    scene.add(group);
  }

  function setLoad(fraction) {
    if (!loadMesh) return;
    const h = Math.max(0.0001, Math.min(1, fraction)) * (L.height * 0.85);
    loadMesh.scale.y = h;
    loadMesh.position.y = -L.height / 2 + h / 2;
  }

  function setClogged(active) {
    if (!loadMesh) return;
    loadMesh.material.color.set(active ? 0x8a3a2a : 0x6b4a2a);
  }

  return { init, setLoad, setClogged };
})();
