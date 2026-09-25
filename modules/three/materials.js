/* =========================================================================
   modules/three/materials.js
   Fábricas de materiales reutilizados por varios componentes, para no
   redefinir "vidrio", "metal" o "agua" en cada archivo por separado.
   Cada función devuelve una instancia NUEVA (los materiales no deberían
   compartirse entre mallas si alguna va a animar su propio color/opacidad
   de forma independiente, como el agua del fotobiorreactor tiñéndose con
   la biomasa mientras el agua del tanque de peces se queda fija).
   ========================================================================= */

import * as THREE from 'three';

window.Aqua = window.Aqua || {};

Aqua.Materials = {
  glass(color = 0xbfe6e6, opacity = 0.28) {
    return new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.55,
      thickness: 0.4,
      clearcoat: 0.4,
      side: THREE.DoubleSide,
    });
  },
  water(color = 0x3f9a95) {
    return new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.75,
      roughness: 0.15,
      metalness: 0,
      transmission: 0.35,
      thickness: 0.6,
    });
  },
  plastic(color = 0xe9edea, roughness = 0.65) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
  },
  metal(color = 0x8a9a95, roughness = 0.4) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.75 });
  },
  pipe(color = 0x4d5c58) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.08, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
  },
  co2Hose(color = 0x647975) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
  },
  emissive(color = 0xffe6a0, intensity = 0.2) {
    return new THREE.MeshStandardMaterial({
      color: 0x333333,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
      metalness: 0.1,
    });
  },
  bacteria(color = 0x59c27c) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.5 });
  },
};
