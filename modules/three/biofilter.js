/* =========================================================================
   modules/three/biofilter.js
   Biofiltro como cilindro con medio filtrante (esferas pequeñas via
   InstancedMesh, ligero) y "bacterias" como puntos emissive que laten
   suavemente — equivalente 3D del bacteria-group del SVG.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Biofilter = (function () {

  const L = LAYOUT.biofilter;
  let bacteriaMat = null;
  let time = 0;
  let stressed = false;
  let mediaInst = null;
  let bactInst = null;
  const mediaParticles = [];
  const bacteriaParticles = [];
  const animDummy = new THREE.Object3D();

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const group = new THREE.Group();
    group.position.set(L.center.x, L.height / 2, L.center.z);

    const bodyGeo = new THREE.CylinderGeometry(L.radius, L.radius, L.height, 24);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({
      color: 0x2a3f3a, transparent: true, opacity: 0.55, roughness: 0.3, transmission: 0.2,
    }));
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // medio filtrante: bio-bolas pequeñas repartidas en el volumen, con
    // InstancedMesh para no crear docenas de mallas independientes.
    const mediaGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const mediaMat = Aqua.Materials.plastic(0x9fb2ac, 0.7);
    const MEDIA_COUNT = 70;
    mediaInst = new THREE.InstancedMesh(mediaGeo, mediaMat, MEDIA_COUNT);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < MEDIA_COUNT; i++) {
      const r = L.radius * 0.75 * Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      const y = THREE.MathUtils.lerp(-L.height * 0.4, L.height * 0.35, Math.random());
      dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      dummy.updateMatrix();
      mediaInst.setMatrixAt(i, dummy.matrix);
      mediaParticles.push({ r, angle, y, phase: Math.random() * Math.PI * 2, speed: 0.18 + Math.random() * 0.22 });
    }
    mediaInst.instanceMatrix.needsUpdate = true;
    group.add(mediaInst);

    // bacterias: pequeños puntos emissive, algunos más arriba en el volumen
    bacteriaMat = Aqua.Materials.bacteria(0x59c27c);
    const bactGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const BACT_COUNT = 24;
    bactInst = new THREE.InstancedMesh(bactGeo, bacteriaMat, BACT_COUNT);
    for (let i = 0; i < BACT_COUNT; i++) {
      const r = L.radius * 0.6 * Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      const y = THREE.MathUtils.lerp(-L.height * 0.3, L.height * 0.4, Math.random());
      dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      dummy.updateMatrix();
      bactInst.setMatrixAt(i, dummy.matrix);
      bacteriaParticles.push({ r, angle, y, phase: Math.random() * Math.PI * 2, speed: 0.45 + Math.random() * 0.45 });
    }
    bactInst.instanceMatrix.needsUpdate = true;
    group.add(bactInst);

    scene.add(group);
    Aqua.Three.registerUpdate((dt) => {
      time += dt;
      if (bacteriaMat) {
        bacteriaMat.emissiveIntensity = stressed
          ? 0.5 + Math.sin(time * 6) * 0.2
          : 0.25 + Math.sin(time * 2) * 0.15;
        bacteriaMat.emissive.set(stressed ? 0xe15b4b : 0x59c27c);
      }

      // Bio-bolas: movimiento suave tipo lecho fluidizado. Se mantienen
      // siempre dentro del radio y altura del cilindro.
      if (mediaInst) {
        mediaParticles.forEach((p, i) => {
          const a = p.angle + time * p.speed;
          const rr = p.r * (0.96 + 0.04 * Math.sin(time * 0.7 + p.phase));
          const y = THREE.MathUtils.clamp(
            p.y + Math.sin(time * 1.2 + p.phase) * 0.045,
            -L.height * 0.42,
            L.height * 0.38
          );
          animDummy.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
          animDummy.rotation.set(time * 0.25 + p.phase, a * 0.4, time * 0.18);
          animDummy.updateMatrix();
          mediaInst.setMatrixAt(i, animDummy.matrix);
        });
        mediaInst.instanceMatrix.needsUpdate = true;
      }

      // Bacterias: orbitan y ascienden/descienden ligeramente dentro del
      // biofiltro para dar sensación de actividad biológica continua.
      if (bactInst) {
        bacteriaParticles.forEach((p, i) => {
          const a = p.angle + time * p.speed;
          const rr = p.r * (0.88 + 0.12 * Math.sin(time * 0.9 + p.phase));
          const y = THREE.MathUtils.clamp(
            p.y + Math.sin(time * 1.8 + p.phase) * 0.10,
            -L.height * 0.36,
            L.height * 0.42
          );
          const pulse = 0.82 + 0.22 * Math.sin(time * 3 + p.phase);
          animDummy.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
          animDummy.rotation.set(0, a, 0);
          animDummy.scale.setScalar(pulse);
          animDummy.updateMatrix();
          bactInst.setMatrixAt(i, animDummy.matrix);
          animDummy.scale.setScalar(1);
        });
        bactInst.instanceMatrix.needsUpdate = true;
      }
    });
  }

  function setOverloaded(active) { stressed = !!active; }

  return { init, setOverloaded };
})();
