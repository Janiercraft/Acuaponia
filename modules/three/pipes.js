/* =========================================================================
   modules/three/pipes.js
   Toda la red hidráulica como tubos 3D reales: cada tramo es una
   THREE.CatmullRomCurve3 convertida en THREE.TubeGeometry (cilindro con
   curvatura y profundidad de verdad, no un <path> SVG). Expone las
   curvas por nombre para que modules/three/particles.js las recorra con
   curve.getPointAt(t) — el reemplazo conceptual directo del antiguo
   getPointAtLength() de SVG que ya usaba nutrients.js.

   La topología hidráulica NO cambia respecto al proyecto anterior:
   peces → filtro → biofiltro → (bifurcación) → cultivo / fotobiorreactor →
   (convergencia) → bomba → peces. Sólo cambia que ahora es geometría real.
   ========================================================================= */

import * as THREE from 'three';
import { LAYOUT, computePorts } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Pipes = (function () {

  const curves = {};   // nombre -> THREE.CatmullRomCurve3
  const meshes = {};   // nombre -> THREE.Mesh (para poder cambiar su color si hace falta)
  let flowing = false;
  let speed = 1;

  function v(p) { return new THREE.Vector3(p.x, p.y, p.z); }

  function makeCurve(name, points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points.map(v), false, 'catmullrom', 0.15);
    curves[name] = curve;

    const geo = new THREE.TubeGeometry(curve, Math.max(16, points.length * 12), radius, 10, false);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    Aqua.Three.getSystemRoot().add(mesh);
    meshes[name] = mesh;
    return curve;
  }

  function init() {
    const P = computePorts();
    const waterPipe = Aqua.Materials.pipe(0x54645f);
    const mainPipe = Aqua.Materials.pipe(0x6f8480);
    const returnPipe = Aqua.Materials.pipe(0x4a7f7a);

    // --- tubería principal: el agua sale por la parte más baja del embudo
    //     del tanque y luego se dirige al filtro mecánico.
    makeCurve('fishToFilter', [
      P.fishOutlet,
      { x: P.fishOutlet.x + 0.55, y: P.fishOutlet.y + 0.08, z: P.fishOutlet.z },
      { x: P.filterIn.x - 0.35, y: 0.52, z: P.fishOutlet.z },
      P.filterIn,
    ], 0.055, mainPipe);
    makeCurve('filterToBio', [P.filterOut, P.bioIn], 0.055, mainPipe);
    makeCurve('throughBio', [P.bioIn, P.bioOut], 0.05, mainPipe);
    makeCurve('bioToBifurcation', [P.bioOut, P.bifurcation], 0.055, mainPipe);

    // --- rama de plantas: bifurcación -> mesa de cultivo (por arriba) -> convergencia ---
    makeCurve('bifurcationToPlants', [
      P.bifurcation,
      { x: P.bifurcation.x + 0.4, y: P.growBedIn.y, z: P.bifurcation.z },
      P.growBedIn,
    ], 0.05, waterPipe);
    makeCurve('throughPlants', [P.growBedIn, P.growBedOut], 0.05, waterPipe);
    // Retorno de plantas: rodea automáticamente el PBR en vez de atravesarlo.
    // Se calcula desde las dimensiones actuales del reactor, por lo que sigue
    // funcionando cuando el usuario cambia ancho/profundidad o añade plantas.
    const pbr = LAYOUT.photobioreactor;
    const pbrLeft = pbr.center.x - pbr.width / 2;
    const pbrRight = pbr.center.x + pbr.width / 2;
    const bypassClearance = Math.max(0.42, LAYOUT.growBed.tubeRadius * 2.2);
    const bypassZ = pbr.center.z - pbr.depth / 2 - bypassClearance;
    const approachX = Math.max(P.growBedOut.x + 0.22, pbrLeft - 0.42);
    const exitX = pbrRight + 0.48;
    makeCurve('plantsToConverge', [
      P.growBedOut,
      { x: approachX, y: P.growBedOut.y, z: P.growBedOut.z },
      { x: approachX, y: P.growBedOut.y, z: bypassZ },
      { x: exitX, y: P.growBedOut.y, z: bypassZ },
      { x: exitX, y: P.converge.y + 0.18, z: P.converge.z },
      P.converge,
    ], 0.05, waterPipe);

    // --- rama del fotobiorreactor: se aproxima por el lateral/frente del PBR
    //     y sale rodeándolo, evitando que las tuberías externas lo atraviesen visualmente. ---
    const pbrFrontZ = LAYOUT.photobioreactor.center.z - (LAYOUT.photobioreactor.depth || LAYOUT.photobioreactor.radius * 2) / 2;
    const pbrLeftX = LAYOUT.photobioreactor.center.x - (LAYOUT.photobioreactor.width || LAYOUT.photobioreactor.radius * 2) / 2;
    const pbrRightX = LAYOUT.photobioreactor.center.x + (LAYOUT.photobioreactor.width || LAYOUT.photobioreactor.radius * 2) / 2;
    const pbrBypass = 0.28;
    const approachFrontZ = pbrFrontZ - 0.26;
    const leftBypassX = pbrLeftX - pbrBypass;
    const rightBypassX = pbrRightX + pbrBypass;
    makeCurve('bifurcationToPBR', [
      P.bifurcation,
      { x: leftBypassX - 0.55, y: 0.54, z: P.bifurcation.z },
      { x: leftBypassX, y: 0.54, z: approachFrontZ },
      { x: P.pbrIn.x, y: P.pbrIn.y - 0.18, z: approachFrontZ },
      P.pbrIn,
    ], 0.045, waterPipe);
    makeCurve('throughPBR', [P.pbrIn, P.pbrOut], 0.035, waterPipe);
    makeCurve('pbrToConverge', [
      P.pbrOut,
      { x: P.pbrOut.x, y: Math.max(0.34, P.pbrOut.y), z: approachFrontZ },
      { x: rightBypassX, y: 0.36, z: approachFrontZ },
      { x: rightBypassX + 0.2, y: P.converge.y + 0.14, z: P.converge.z },
      P.converge,
    ], 0.045, waterPipe);

    // --- convergencia -> depósito/bomba ---
    makeCurve('convergeToSump', [P.converge, P.sumpIn], 0.06, mainPipe);

    // --- tubería de retorno: SALE de la bomba y vuelve al tanque por el
    //     frente de la maqueta (Z positivo) para dejar más despejada la parte
    //     posterior donde están otros componentes. Recorre el borde frontal y
    //     entra al tanque desde su cara frontal superior para que se vea clara.
    const sideZ = 3.25;
    const returnY = 1.15;
    const fishFrontOuter = {
      x: LAYOUT.fishTank.center.x,
      y: returnY,
      z: LAYOUT.fishTank.center.z + LAYOUT.fishTank.size.d / 2 + 0.18,
    };
    const fishReturnInner = {
      x: LAYOUT.fishTank.center.x,
      y: Math.min(P.fishInlet.y + 0.02, LAYOUT.fishTank.size.h - 0.18),
      z: LAYOUT.fishTank.center.z + LAYOUT.fishTank.size.d / 2 - 0.18,
    };
    makeCurve('pumpToReturn', [
      P.sumpOut,
      { x: LAYOUT.sump.center.x + 0.55, y: returnY, z: LAYOUT.sump.center.z },
      { x: LAYOUT.sump.center.x + 0.55, y: returnY, z: sideZ },
      { x: 0.2, y: returnY, z: sideZ },
      { x: LAYOUT.fishTank.center.x - 0.35, y: returnY, z: sideZ },
      { x: fishFrontOuter.x, y: returnY, z: sideZ },
      fishFrontOuter,
      { x: fishFrontOuter.x, y: fishReturnInner.y + 0.02, z: fishFrontOuter.z },
      fishReturnInner,
    ], 0.06, returnPipe);

    // Nodos de unión: pequeñas esferas en la bifurcación y la convergencia,
    // el equivalente 3D de los círculos "pipe-node" del SVG anterior.
    const nodeMat = Aqua.Materials.metal(0x8a9a95, 0.3);
    [P.bifurcation, P.converge].forEach((p) => {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), nodeMat);
      node.position.copy(v(p));
      node.castShadow = true;
      Aqua.Three.getSystemRoot().add(node);
    });
  }

  function setFlowing(active) { flowing = !!active; }
  function isFlowing() { return flowing; }
  function setSpeed(mult) { speed = Math.max(0.1, Number(mult) || 1); }

  /** Curva por nombre + su longitud aproximada — usado por particles.js. */
  function getCurve(name) { return curves[name] || null; }

  function pointAt(name, t) {
    const c = curves[name];
    if (!c) return new THREE.Vector3();
    return c.getPointAt(Math.min(1, Math.max(0, t)));
  }

  /** Ya no anima un dash-offset (eso era un truco específico de SVG): en
   *  3D el flujo lo comunican las partículas reales (particles.js), que
   *  tienen su propio update() llamado aparte desde app.js. Se conserva
   *  esta función, sin operación, únicamente para que la firma de
   *  Aqua.WaterFlow.update(dt, mult) que ya usaba app.js siga existiendo. */
  function update() {}

  const api = { init, setFlowing, isFlowing, setSpeed, update, getCurve, pointAt };
  Aqua.WaterFlow = api; // nombre esperado por app.js (antes lo usaba para el SVG)
  return api;
})();
