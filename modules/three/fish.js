/* =========================================================================
   modules/three/fish.js
   Peces construidos proceduralmente (cuerpo elipsoidal + cola cónica +
   par de aletas) que nadan dentro del volumen 3D del tanque — cambian de
   X, Y y Z, no sólo izquierda/derecha como en la versión plana anterior.
   Cada pez recibe un punto destino aleatorio dentro del tanque y nada
   hacia él con un giro suave (mirando hacia donde se mueve); al llegar,
   elige un nuevo destino. dt en 0 (simulación pausada) los congela.
   ========================================================================= */

import * as THREE from 'three';

window.Aqua = window.Aqua || {};

Aqua.Fish = (function () {

  const FISH_COUNT = 3;
  let fishList = []; // { group, target, speed, sluggishFactor }
  let bounds = null;

  function buildFishMesh(color) {
    const group = new THREE.Group();

    const bodyGeo = new THREE.SphereGeometry(0.1, 12, 10);
    bodyGeo.scale(1.8, 1, 1); // elipsoide
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    const tailGeo = new THREE.ConeGeometry(0.09, 0.16, 8);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.24;
    tail.castShadow = true;
    group.add(tail);

    const finGeo = new THREE.ConeGeometry(0.045, 0.09, 6);
    const finTop = new THREE.Mesh(finGeo, bodyMat);
    finTop.position.set(0, 0.09, 0);
    group.add(finTop);

    const eyeGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x11140f });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.14, 0.02, 0.06);
    group.add(eye);

    return group;
  }

  function randomTarget() {
    return new THREE.Vector3(
      THREE.MathUtils.lerp(bounds.minX, bounds.maxX, Math.random()),
      THREE.MathUtils.lerp(bounds.minY, bounds.maxY, Math.random()),
      THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, Math.random())
    );
  }

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    bounds = Aqua.FishTank.getSwimBounds();
    fishList = [];

    const colors = [0xe0c27a, 0xd99a5c, 0xe8b25a];
    for (let i = 0; i < FISH_COUNT; i++) {
      const group = buildFishMesh(colors[i % colors.length]);
      const start = randomTarget();
      group.position.copy(start);
      scene.add(group);
      fishList.push({
        group,
        target: randomTarget(),
        speed: 0.35 + Math.random() * 0.25,
        sluggishFactor: 1,
      });
    }
  }

  function setSluggish(active) {
    fishList.forEach((f) => { f.sluggishFactor = active ? 0.3 : 1; });
  }

  function setTankAtRisk(active) {
    Aqua.FishTank.setAtRisk(active);
  }

  /** dt en segundos reales; 0 cuando la simulación está pausada. */
  function update(dt) {
    if (dt <= 0 || !bounds) return;
    fishList.forEach((f) => {
      const step = f.speed * f.sluggishFactor * dt;
      const toTarget = new THREE.Vector3().subVectors(f.target, f.group.position);
      const dist = toTarget.length();
      if (dist < 0.15) {
        f.target = randomTarget();
        return;
      }
      toTarget.normalize();
      f.group.position.addScaledVector(toTarget, Math.min(step, dist));

      // orientar el pez hacia donde nada (yaw + un poco de cabeceo)
      const desiredYaw = Math.atan2(toTarget.z, toTarget.x) * -1;
      f.group.rotation.y = THREE.MathUtils.lerp(f.group.rotation.y, desiredYaw, 0.08);
      f.group.rotation.z = THREE.MathUtils.lerp(f.group.rotation.z, toTarget.y * 0.6, 0.08);
    });
  }

  return { init, update, setSluggish, setTankAtRisk };
})();
