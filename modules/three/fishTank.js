/* =========================================================================
   modules/three/fishTank.js
   Tanque de peces como THREE.Mesh real (BoxGeometry con ancho, alto Y
   profundidad de verdad — no un <rect> SVG). Las paredes son
   semitransparentes para poder ver el interior desde cualquier ángulo;
   el agua es un segundo Mesh más pequeño, dentro del tanque, con su
   propio material físico transparente/azulado.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.FishTank = (function () {

  let waterMesh = null;
  let frameGroup = null;
  const size = LAYOUT.fishTank.size;
  const center = LAYOUT.fishTank.center;

  const NORMAL_WATER_H = size.h * 0.82;
  const LOW_WATER_H = size.h * 0.42;

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const group = new THREE.Group();
    group.position.set(center.x, size.h / 2, center.z);

    // paredes del tanque: vidrio/plástico translúcido, se ven los laterales
    // y la parte trasera al rotar la cámara (prueba de que es 3D real).
    const wallGeo = new THREE.BoxGeometry(size.w, size.h, size.d);
    const wallMat = Aqua.Materials.glass(0xd7ded9, 0.22);
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    // estructura metálica tipo jaula IBC (referencia real del proyecto):
    // unas pocas barras finas en las aristas verticales, suficiente para
    // leerse como "jaula" sin modelar cada varilla.
    const edgeMat = Aqua.Materials.metal(0x8a9a95, 0.35);
    const postGeo = new THREE.BoxGeometry(0.05, size.h, 0.05);
    [
      [-size.w / 2, -size.d / 2], [size.w / 2, -size.d / 2],
      [-size.w / 2, size.d / 2], [size.w / 2, size.d / 2],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(postGeo, edgeMat);
      post.position.set(x, 0, z);
      post.castShadow = true;
      group.add(post);
    });

    // agua: volumen independiente dentro del tanque, con su propio alto
    // (baja visiblemente con la falla "nivel de agua bajo").
    const waterGeo = new THREE.BoxGeometry(size.w * 0.92, 1, size.d * 0.92);
    waterMesh = new THREE.Mesh(waterGeo, Aqua.Materials.water(0x3f9a95));
    waterMesh.scale.y = NORMAL_WATER_H;
    waterMesh.position.y = -size.h / 2 + (NORMAL_WATER_H * 1) / 2;
    group.add(waterMesh);

    // base/pallet, para que el tanque se apoye visiblemente en el suelo.
    const palletGeo = new THREE.BoxGeometry(size.w * 1.05, 0.12, size.d * 1.05);
    const pallet = new THREE.Mesh(palletGeo, Aqua.Materials.plastic(0x38403e, 0.9));
    pallet.position.y = -size.h / 2 - 0.06;
    pallet.receiveShadow = true;
    pallet.castShadow = true;
    group.add(pallet);

    scene.add(group);
    frameGroup = group;
  }

  /** true = nivel de agua bajo (falla), false = nivel normal. */
  function setWaterLevel(low) {
    if (!waterMesh) return;
    const targetH = low ? LOW_WATER_H : NORMAL_WATER_H;
    waterMesh.scale.y = targetH;
    waterMesh.position.y = -size.h / 2 + targetH / 2;
  }

  function setAtRisk(active) {
    if (!waterMesh) return;
    waterMesh.material.color.set(active ? 0x8a5a4a : 0x3f9a95);
  }

  /** Límites del volumen de agua, en coordenadas del mundo — usados por
   *  fish.js para que los peces naden dentro del tanque real. */
  function getSwimBounds() {
    return {
      minX: center.x - size.w * 0.4,
      maxX: center.x + size.w * 0.4,
      minY: 0.25,
      maxY: NORMAL_WATER_H * 0.85,
      minZ: center.z - size.d * 0.4,
      maxZ: center.z + size.d * 0.4,
    };
  }

  return { init, setWaterLevel, setAtRisk, getSwimBounds };
})();
