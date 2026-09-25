/* =========================================================================
   modules/three/environment.js
   Luces y suelo de la escena. Sin esto la geometría se vería plana y sin
   volumen perceptible — es justamente lo que distingue una maqueta 3D real
   de un dibujo con la cámara movida.
   ========================================================================= */

import * as THREE from 'three';
import { FLOOR_SIZE } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Environment = (function () {

  function init() {
    const scene = Aqua.Three.getScene();
    if (!scene) return;

    // Luz ambiental suave: evita que las caras no iluminadas directamente
    // queden completamente negras.
    scene.add(new THREE.AmbientLight(0x8fb0ad, 0.55));

    // Luz hemisférica: cielo/suelo, ayuda a que los materiales lean bien
    // sus tonos sin necesitar más lámparas.
    const hemi = new THREE.HemisphereLight(0xbfe3e0, 0x1a2422, 0.6);
    scene.add(hemi);

    // Luz direccional principal (equivalente a "el sol" de la maqueta):
    // la que realmente proyecta las sombras y revela el volumen de cada
    // tanque/tubería al rotar la cámara.
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(8, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -0.0015;
    scene.add(sun);

    // Luz de relleno suave desde el lado contrario, para que la cara
    // "trasera" de los tanques no quede totalmente a oscuras al rotar.
    const fill = new THREE.DirectionalLight(0x6fb8c9, 0.35);
    fill.position.set(-8, 5, -8);
    scene.add(fill);

    // Suelo: recibe sombra de todo lo que "está de pie" encima, ayudando
    // a leer la profundidad (sección "SUELO 3D" del brief).
    const floorGeo = new THREE.PlaneGeometry(FLOOR_SIZE.width, FLOOR_SIZE.depth);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x15211f, roughness: 0.95, metalness: 0.05 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0.5, 0, 0.2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Rejilla tenue sobre el suelo: referencia de escala sin distraer.
    const grid = new THREE.GridHelper(Math.max(FLOOR_SIZE.width, FLOOR_SIZE.depth), 20, 0x2b423e, 0x1c2b29);
    grid.position.set(0.5, 0.01, 0.2);
    scene.add(grid);
  }

  return { init };
})();
