/* =========================================================================
   modules/three/photobioreactor.js
   El componente más importante del pedido: reactor cilíndrico transparente
   con barra LED física (material emissive + PointLight, conectados al
   mismo booleano `light` que ya existía), difusor de CO₂ en el fondo,
   burbujas que nacen ahí y suben en volumen real, y microalgas dispersas
   en X/Y/Z (no sobre una superficie plana) que se van revelando
   progresivamente con la biomasa — mismo modelo de crecimiento logístico
   que ya vive en app.js, sólo que aquí se traduce a cuántos puntos del
   campo de algas están visibles.

   Mantiene la misma API pública que la versión SVG (init, growthTick,
   render, stageName) para que app.js no necesitara cambiar esas llamadas.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Photobioreactor = (function () {

  const L = LAYOUT.photobioreactor;
  const ALGAE_COUNT = 160;
  const BUBBLE_COUNT = 16;

  let ledCoreMat = null;
  let ledLight = null;
  let growLightMats = [];
  let growSpot = null;
  let waterMat = null;
  let biomassGaugeMesh = null;
  let algaePoints = null;
  let algaeGeo = null;
  let algaeInstances = []; // { base: Vector3, threshold, phase }
  let bubbles = []; // { mesh, t, speed, baseX, baseZ }
  let time = 0;
  let active = true;
  let lit = true;

  const innerR = L.radius * 0.82;
  const waterTop = L.baseHeight + L.height * 0.9;
  const waterBottom = L.baseHeight + 0.08;

  function buildReactorBody(group) {
    const bodyGeo = new THREE.CylinderGeometry(L.radius, L.radius * 1.05, L.height, 28, 1, true);
    const body = new THREE.Mesh(bodyGeo, Aqua.Materials.glass(0xbfe6e6, 0.22));
    body.position.y = L.baseHeight + L.height / 2;
    body.castShadow = false;
    body.receiveShadow = true;
    group.add(body);

    // agua/medio líquido interior — su color se tiñe de verde con la biomasa
    const waterGeo = new THREE.CylinderGeometry(innerR, innerR, L.height * 0.86, 24);
    waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x3f9a95, transparent: true, opacity: 0.5, roughness: 0.2, transmission: 0.3,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = L.baseHeight + L.height * 0.48;
    group.add(water);

    // base y aro superior (estructura que sostiene el cilindro)
    const baseGeo = new THREE.CylinderGeometry(L.radius * 1.25, L.radius * 1.25, L.baseHeight, 24);
    const base = new THREE.Mesh(baseGeo, Aqua.Materials.plastic(0xe9edea, 0.6));
    base.position.y = L.baseHeight / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const ringGeo = new THREE.TorusGeometry(L.radius * 1.02, 0.025, 8, 24);
    const ring = new THREE.Mesh(ringGeo, Aqua.Materials.metal(0x8a9a95, 0.3));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = L.baseHeight + L.height;
    group.add(ring);
  }

  function buildLed(group) {
    const ledX = -innerR * 0.65;
    const ledZ = -innerR * 0.4;
    const housingGeo = new THREE.CylinderGeometry(0.04, 0.04, L.height * 0.78, 10);
    const housing = new THREE.Mesh(housingGeo, new THREE.MeshStandardMaterial({ color: 0x263236, roughness: 0.6, metalness: 0.3 }));
    housing.position.set(ledX, L.baseHeight + L.height * 0.48, ledZ);
    group.add(housing);

    const coreGeo = new THREE.CylinderGeometry(0.018, 0.018, L.height * 0.72, 10);
    ledCoreMat = new THREE.MeshStandardMaterial({
      color: 0x222222, emissive: 0xfff2c2, emissiveIntensity: 1.1, roughness: 0.3,
    });
    const core = new THREE.Mesh(coreGeo, ledCoreMat);
    core.position.copy(housing.position);
    group.add(core);

    // PointLight real: además del material emissive, ilumina el agua/las
    // algas de alrededor — se apaga/enciende junto con emissiveIntensity.
    ledLight = new THREE.PointLight(0xfff2c2, 1.2, L.radius * 3.2, 2);
    ledLight.position.copy(housing.position);
    group.add(ledLight);
  }


  // Luminaria de cultivo externa, claramente visible sobre el reactor.
  // Representa una luz LED fotosintética y está conectada al mismo control
  // “Luz PBR” que la barra interna.
  function buildGrowLight(group) {
    growLightMats = [];
    const y = L.baseHeight + L.height + 0.46;

    // poste y brazo de soporte
    const standMat = new THREE.MeshStandardMaterial({ color: 0x4a5558, roughness: 0.55, metalness: 0.55 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L.height + 0.72, 10), standMat);
    pole.position.set(L.radius * 1.75, (L.height + 0.72) / 2, 0);
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(L.radius * 1.8, 0.035, 0.035), standMat);
    arm.position.set(L.radius * 0.88, y + 0.08, 0);
    group.add(arm);

    // carcasa de la lámpara
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(L.radius * 1.75, 0.09, L.radius * 1.15),
      new THREE.MeshStandardMaterial({ color: 0x20272a, roughness: 0.45, metalness: 0.45 })
    );
    housing.position.set(0, y, 0);
    group.add(housing);

    // cuatro barras LED rojo/azul (magenta) en la cara inferior
    for (let i = -1.5; i <= 1.5; i += 1) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x552044, emissive: 0xff4fc3, emissiveIntensity: 1.7, roughness: 0.25
      });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(L.radius * 1.45, 0.018, 0.035), mat);
      strip.position.set(0, y - 0.055, i * L.radius * 0.20);
      group.add(strip);
      growLightMats.push(mat);
    }

    // Luz real dirigida hacia el cultivo de microalgas dentro del PBR.
    growSpot = new THREE.SpotLight(0xff73d1, 2.8, L.height * 3.2, Math.PI / 5, 0.5, 1.4);
    growSpot.position.set(0, y - 0.02, 0);
    growSpot.target.position.set(0, L.baseHeight + L.height * 0.48, 0);
    group.add(growSpot);
    group.add(growSpot.target);
  }

  function buildDiffuserAndBubbles(group) {
    const diffGeo = new THREE.CylinderGeometry(0.03, 0.03, innerR * 1.3, 10);
    const diffuser = new THREE.Mesh(diffGeo, new THREE.MeshStandardMaterial({ color: 0x2c3a3d, roughness: 0.6 }));
    diffuser.rotation.z = Math.PI / 2;
    diffuser.position.set(0, waterBottom + 0.02, 0);
    group.add(diffuser);

    const bubbleGeo = new THREE.SphereGeometry(1, 8, 8);
    const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xcdeef1, transparent: true, opacity: 0.75, roughness: 0.1 });
    bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const mesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      const baseX = (Math.random() - 0.5) * innerR * 1.1;
      const baseZ = (Math.random() - 0.5) * innerR * 1.1;
      const scale = 0.012 + Math.random() * 0.014;
      mesh.scale.setScalar(scale);
      mesh.position.set(baseX, waterBottom, baseZ);
      group.add(mesh);
      bubbles.push({ mesh, t: Math.random(), speed: 0.35 + Math.random() * 0.25, baseX, baseZ });
    }
  }

  function buildAlgae(group) {
    algaeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(ALGAE_COUNT * 3);
    algaeInstances = [];

    for (let i = 0; i < ALGAE_COUNT; i++) {
      const r = innerR * 0.92 * Math.sqrt(Math.random());
      const ang = Math.random() * Math.PI * 2;
      const base = new THREE.Vector3(
        Math.cos(ang) * r,
        THREE.MathUtils.lerp(waterBottom + 0.05, waterTop - 0.05, Math.random()),
        Math.sin(ang) * r
      );
      algaeInstances.push({ base, threshold: (i / ALGAE_COUNT) * 0.92 + Math.random() * 0.06, phase: Math.random() * Math.PI * 2 });
      // Las algas que todavía no deben verse ya no se envían a Y=-50.
      // Se mantienen sus coordenadas válidas y se controla cuántos puntos se
      // dibujan mediante drawRange; así nunca aparecen partículas perdidas
      // debajo del sistema ni afectan visualmente la escena.
      positions[i * 3] = base.x;
      positions[i * 3 + 1] = base.y;
      positions[i * 3 + 2] = base.z;
    }
    algaeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    algaeGeo.setDrawRange(0, 0); // biomasa inicial: ninguna microalga visible

    const algaeMat = new THREE.PointsMaterial({
      color: 0x5fcf93, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.85,
    });
    algaePoints = new THREE.Points(algaeGeo, algaeMat);
    group.add(algaePoints);
  }

  function buildBiomassGauge(group) {
    const gaugeGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 10);
    biomassGaugeMesh = new THREE.Mesh(gaugeGeo, new THREE.MeshStandardMaterial({ color: 0x5fcf93, emissive: 0x2f6b2c, emissiveIntensity: 0.3 }));
    biomassGaugeMesh.position.set(innerR * 0.7, waterBottom, innerR * 0.55);
    biomassGaugeMesh.scale.y = 0.0001;
    group.add(biomassGaugeMesh);
  }

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const group = new THREE.Group();
    group.position.set(L.center.x, 0, L.center.z);

    buildReactorBody(group);
    buildLed(group);
    buildGrowLight(group);
    buildDiffuserAndBubbles(group);
    buildAlgae(group);
    buildBiomassGauge(group);

    scene.add(group);

    Aqua.Three.registerUpdate((dt) => update(dt));
  }

  function update(dt) {
    time += dt;

    // burbujas: suben desde el difusor, con leve variación X/Z, y se
    // reinician al llegar arriba — nunca aparecen "de la nada".
    const bubbleActivity = active ? 1 : 0.08;
    bubbles.forEach((b) => {
      b.t += dt * b.speed * bubbleActivity;
      if (b.t > 1) {
        b.t = 0;
        b.baseX = (Math.random() - 0.5) * innerR * 1.1;
        b.baseZ = (Math.random() - 0.5) * innerR * 1.1;
      }
      const y = THREE.MathUtils.lerp(waterBottom, waterTop, b.t);
      const wob = Math.sin(time * 3 + b.baseX * 10) * 0.02;
      b.mesh.position.set(b.baseX + wob, y, b.baseZ + wob * 0.6);
    });
  }

  /** Fotograma a fotograma: revela/mueve el campo de algas según la
   *  biomasa actual, igual de espíritu que la versión SVG anterior. */
  function growthTick(dt, biomass, flowIntensity) {
    if (dt > 0) time += 0; // el reloj ya avanza en update(); esto sólo documenta la firma
    const flow = active ? Math.min(1, Math.max(0, flowIntensity)) : 0.05;
    const positions = algaeGeo.attributes.position;

    // Compactamos únicamente las microalgas que ya corresponden a la biomasa
    // actual al inicio del buffer. Las demás ni siquiera se renderizan. Esto
    // sustituye por completo el viejo truco de esconderlas en Y=-50.
    let visibleCount = 0;
    algaeInstances.forEach((inst) => {
      const reveal = Math.min(1, Math.max(0, (biomass - inst.threshold) / 0.16));
      if (reveal <= 0) return;

      const dx = flow * 0.05 * Math.sin(time * 0.6 + inst.phase);
      const dz = flow * 0.05 * Math.cos(time * 0.5 + inst.phase);
      const dy = flow * 0.03 * Math.sin(time * 0.4 + inst.phase * 1.3);
      positions.setXYZ(visibleCount, inst.base.x + dx, inst.base.y + dy, inst.base.z + dz);
      visibleCount++;
    });
    algaeGeo.setDrawRange(0, visibleCount);
    positions.needsUpdate = true;

    if (biomassGaugeMesh) {
      const h = Math.max(0.0001, Math.min(1, biomass)) * (L.height * 0.7);
      biomassGaugeMesh.scale.y = h;
      biomassGaugeMesh.position.y = waterBottom + h / 2;
    }

    if (waterMat) {
      const tint = Math.min(1, biomass);
      waterMat.color.setRGB(
        THREE.MathUtils.lerp(0.24, 0.2, tint),
        THREE.MathUtils.lerp(0.60, 0.75, tint),
        THREE.MathUtils.lerp(0.58, 0.35, tint)
      );
      waterMat.opacity = 0.4 + tint * 0.35;
    }
  }

  const STAGES = [
    { max: 0.18, name: 'iniciando' },
    { max: 0.40, name: 'crecimiento temprano' },
    { max: 0.65, name: 'crecimiento activo' },
    { max: 0.85, name: 'alta actividad' },
    { max: 1.01, name: 'biomasa elevada' },
  ];
  function stageName(biomass) {
    const s = STAGES.find((st) => biomass <= st.max);
    return (s || STAGES[STAGES.length - 1]).name;
  }

  /** `data`: { light, active, biomass, lowActivity } — misma forma que antes. */
  function render(data) {
    active = !!data.active;
    lit = !!data.light && active;

    if (ledCoreMat) {
      ledCoreMat.emissiveIntensity = lit ? 1.3 : 0.08;
      ledCoreMat.color.set(lit ? 0x333333 : 0x1a1a1a);
    }
    if (ledLight) {
      ledLight.intensity = lit ? 1.3 : 0.05;
    }
    growLightMats.forEach((mat) => {
      mat.emissiveIntensity = lit ? 1.7 : 0.03;
      mat.color.set(lit ? 0x552044 : 0x151515);
    });
    if (growSpot) growSpot.intensity = lit ? 2.8 : 0;
  }

  return { init, growthTick, update, render, stageName };
})();
