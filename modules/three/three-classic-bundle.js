/* Aqua 3D - bundle clásico generado para funcionar también al abrir index.html con doble clic (file://).
   No usa import/export locales, evitando el bloqueo CORS de módulos ES desde file://. */
(function(){
'use strict';
if(!window.THREE){ console.error('[AQUA 3D] THREE no está disponible.'); return; }
window.Aqua=window.Aqua||{};

/* ---- Controles orbitales ligeros, compatibles con apertura file:// ---- */
class AquaOrbitControls {
  constructor(camera, domElement) {
    this.object = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();
    this.enableDamping = true;
    this.dampingFactor = 0.05;
    this.minDistance = 3;
    this.maxDistance = 40;
    this.maxPolarAngle = Math.PI * 0.495;
    this._drag = null;
    this._last = {x:0,y:0};
    this._touchDist = 0;
    this._bind();
  }
  _bind() {
    const el=this.domElement;
    el.style.touchAction='none';
    el.addEventListener('contextmenu', e=>e.preventDefault());
    el.addEventListener('pointerdown', e=>{
      el.setPointerCapture?.(e.pointerId);
      this._drag = (e.button===2 || e.shiftKey) ? 'pan' : 'rotate';
      this._last={x:e.clientX,y:e.clientY};
    });
    el.addEventListener('pointermove', e=>{
      if(!this._drag) return;
      const dx=e.clientX-this._last.x, dy=e.clientY-this._last.y;
      this._last={x:e.clientX,y:e.clientY};
      if(this._drag==='rotate') this._rotate(dx,dy); else this._pan(dx,dy);
    });
    const end=()=>{this._drag=null;};
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', e=>{e.preventDefault(); this._zoom(e.deltaY>0?1.12:0.89);},{passive:false});
    el.addEventListener('touchstart', e=>{
      if(e.touches.length===2){
        this._touchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      }
    },{passive:true});
    el.addEventListener('touchmove', e=>{
      if(e.touches.length===2){
        const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        if(this._touchDist>0) this._zoom(this._touchDist/d);
        this._touchDist=d;
      }
    },{passive:true});
  }
  _rotate(dx,dy){
    const off=this.object.position.clone().sub(this.target);
    let r=off.length(); if(!r) r=1;
    let theta=Math.atan2(off.x,off.z);
    let phi=Math.acos(Math.max(-1,Math.min(1,off.y/r)));
    theta -= dx*0.006;
    phi -= dy*0.006;
    phi=Math.max(0.08,Math.min(this.maxPolarAngle,phi));
    off.set(r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.cos(theta));
    this.object.position.copy(this.target).add(off); this.update();
  }
  _zoom(f){
    const off=this.object.position.clone().sub(this.target);
    let r=Math.max(this.minDistance,Math.min(this.maxDistance,off.length()*f));
    off.setLength(r); this.object.position.copy(this.target).add(off); this.update();
  }
  _pan(dx,dy){
    const distance=this.object.position.distanceTo(this.target);
    const scale=distance*0.0018;
    const right=new THREE.Vector3().setFromMatrixColumn(this.object.matrix,0).multiplyScalar(-dx*scale);
    const up=new THREE.Vector3(0,1,0).multiplyScalar(dy*scale);
    this.object.position.add(right).add(up); this.target.add(right).add(up); this.update();
  }
  update(){ this.object.lookAt(this.target); this.object.updateMatrixWorld(); }
}


/* ===== layout.js ===== */
/* =========================================================================
   modules/three/layout.js
   Posiciones y tamaños de cada componente en la escena 3D, en un solo
   lugar. Todos los demás módulos (tanques, tuberías, partículas, labels)
   importan estas constantes en vez de repetir números sueltos — así la
   distribución espacial (sección 18 del brief: nada en el mismo plano Z)
   queda centralizada y es fácil de ajustar sin tocar media docena de
   archivos.

   Unidades: metros aproximados. Y = arriba. El suelo está en y = 0.
   ========================================================================= */

const FLOOR_SIZE = { width: 16, depth: 11 };

const LAYOUT = {
  fishTank: {
    center: { x: -5.6, y: 0, z: 1.7 },
    size: { w: 2.3, h: 2.0, d: 2.3 },
  },
  mechanicalFilter: {
    center: { x: -2.7, y: 0, z: 2.1 },
    radius: 0.55,
    height: 1.8,
  },
  biofilter: {
    center: { x: -0.8, y: 0, z: 1.7 },
    radius: 0.55,
    height: 1.8,
  },
  growBed: {
    // tres canales horizontales, uno detrás de otro en Z (además de en X),
    // elevados sobre patas — así se distinguen claramente al rotar la cámara.
    xStart: 1.5,
    xEnd: 5.7,
    zRows: [-0.2, -0.9, -1.6],
    tubeRadius: 0.22,
    tubeY: 1.55,
    holesPerRow: 6,
  },
  photobioreactor: {
    center: { x: 6.0, y: 0, z: -1.1 },
    radius: 0.5,
    height: 2.0,
    baseHeight: 0.18,
  },
  co2Pump: {
    center: { x: 7.15, y: 0, z: -1.1 },
    size: { w: 0.55, h: 0.6, d: 0.5 },
  },
  sump: {
    center: { x: 6.0, y: 0, z: 2.2 },
    size: { w: 1.5, h: 1.5, d: 1.5 },
  },
};

// Puntos de conexión ("puertos") usados por pipes.js para trazar las
// curvas — calculados a partir del layout de arriba en vez de escritos a
// mano, para que si algún tamaño cambia, las tuberías seco-recalculen solas.
function computePorts() {
  const ft = LAYOUT.fishTank;
  const mf = LAYOUT.mechanicalFilter;
  const bf = LAYOUT.biofilter;
  const gb = LAYOUT.growBed;
  const pbr = LAYOUT.photobioreactor;
  const sump = LAYOUT.sump;

  return {
    fishOutlet: { x: ft.center.x + ft.size.w / 2, y: ft.center.y + ft.size.h * 0.35, z: ft.center.z },
    fishInlet: { x: ft.center.x, y: ft.center.y + ft.size.h * 0.75, z: ft.center.z - ft.size.d / 2 },

    filterIn: { x: mf.center.x - mf.radius, y: mf.center.y + mf.height * 0.55, z: mf.center.z },
    filterOut: { x: mf.center.x + mf.radius, y: mf.center.y + mf.height * 0.55, z: mf.center.z },

    bioIn: { x: bf.center.x - bf.radius, y: bf.center.y + bf.height * 0.55, z: bf.center.z },
    bioOut: { x: bf.center.x + bf.radius, y: bf.center.y + bf.height * 0.55, z: bf.center.z },

    // bifurcación: justo después del biofiltro, antes de subir al cultivo
    bifurcation: { x: bf.center.x + bf.radius + 0.6, y: bf.height * 0.55, z: bf.center.z },

    growBedIn: { x: gb.xStart, y: gb.tubeY, z: gb.zRows[1] },
    growBedOut: { x: gb.xEnd, y: gb.tubeY, z: gb.zRows[1] },

    pbrIn: { x: pbr.center.x, y: pbr.baseHeight + pbr.height * 0.82, z: pbr.center.z - pbr.radius },
    pbrOut: { x: pbr.center.x, y: pbr.baseHeight + 0.12, z: pbr.center.z - pbr.radius },

    // convergencia: donde ambas ramas (cultivo y PBR) vuelven a unirse
    converge: { x: sump.center.x - sump.size.w / 2 - 0.6, y: sump.center.y + sump.size.h * 0.55, z: sump.center.z },

    sumpIn: { x: sump.center.x - sump.size.w / 2, y: sump.center.y + sump.size.h * 0.55, z: sump.center.z },
    sumpOut: { x: sump.center.x, y: sump.center.y + sump.size.h + 0.05, z: sump.center.z },

    co2PumpTop: { x: LAYOUT.co2Pump.center.x, y: LAYOUT.co2Pump.size.h, z: LAYOUT.co2Pump.center.z },
    diffuser: { x: pbr.center.x, y: pbr.baseHeight + 0.1, z: pbr.center.z },
  };
}

/* ===== materials.js ===== */
/* =========================================================================
   modules/three/materials.js
   Fábricas de materiales reutilizados por varios componentes, para no
   redefinir "vidrio", "metal" o "agua" en cada archivo por separado.
   Cada función devuelve una instancia NUEVA (los materiales no deberían
   compartirse entre mallas si alguna va a animar su propio color/opacidad
   de forma independiente, como el agua del fotobiorreactor tiñéndose con
   la biomasa mientras el agua del tanque de peces se queda fija).
   ========================================================================= */


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
    });
  },
  plastic(color = 0xe9edea, roughness = 0.65) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
  },
  metal(color = 0x8a9a95, roughness = 0.4) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.75 });
  },
  pipe(color = 0x4d5c58) {
    return new THREE.MeshStandardMaterial({
      color, roughness: 0.4, metalness: 0.08, transparent: true, opacity: 0.42,
      depthWrite: false, side: THREE.DoubleSide
    });
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

/* ===== core.js ===== */
/* =========================================================================
   modules/three/core.js
   El corazón de la escena WebGL: crea explícitamente THREE.Scene,
   THREE.PerspectiveCamera, THREE.WebGLRenderer, OrbitControls y
   CSS2DRenderer dentro de #three-container, arranca el bucle de
   render/animación, y expone un pequeño registro de "callbacks de
   actualización" para que cada módulo enganche su propia lógica de
   fotograma a fotograma.

   ROBUSTEZ DE ARRANQUE (ver diagnóstico entregado al usuario):
   - Todo el tamaño de #three-container se mide con ResizeObserver, nunca
     con una sola lectura síncrona de clientWidth/clientHeight que podría
     devolver 0 si el layout con aspect-ratio todavía no se resolvió en
     ese instante exacto.
   - Todos los componentes "físicos" del sistema (tanques, tuberías,
     etc.) se agregan a `systemRoot` — un THREE.Group aparte de las luces
     y el suelo — para poder calcular un THREE.Box3 real con
     `.setFromObject(systemRoot)` y encuadrar la cámara automáticamente
     (frameAll()), en vez de usar sólo números fijos a mano.
   ========================================================================= */


window.Aqua = window.Aqua || {};

Aqua.Three = (function () {

  const log = (...args) => console.log('[AQUA 3D]', ...args);
  const logErr = (...args) => console.error('[AQUA 3D]', ...args);

  let scene, camera, renderer, labelRenderer, controls, container, systemRoot;
  const updateCallbacks = [];
  let clock = new THREE.Clock();
  let started = false;
  let resizeObserver = null;

  function registerUpdate(fn) {
    updateCallbacks.push(fn);
  }

  function showFatalError(message) {
    if (!container) return;
    const box = document.createElement('div');
    box.className = 'three-fatal-error';
    box.innerHTML = `<strong>No fue posible cargar la escena 3D.</strong><br>${message}<br>Revisa la consola (F12) para más información.`;
    container.appendChild(box);
  }

  function init(containerSelector) {
    container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;

    if (!container) {
      logErr('No se encontró el contenedor', containerSelector);
      return null;
    }

    // Bundle clásico: file:// es compatible; no usamos imports ES locales.

    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x101c1a);
      // IMPORTANTE: no usamos niebla. La versión anterior podía encuadrar la cámara
      // a una distancia cercana o superior al 'far' de la niebla y toda la maqueta
      // terminaba mezclándose con el color de fondo, dando la impresión de un canvas vacío.
      scene.fog = null;
      log('Escena creada');

      // Todo lo "físico" del sistema (tanques, tuberías, peces...) vive
      // aquí — separado de luces/suelo — para poder calcular un
      // bounding box real y encuadrar la cámara automáticamente.
      systemRoot = new THREE.Group();
      systemRoot.name = 'systemRoot';
      scene.add(systemRoot);

      const { w: initW, h: initH } = getContainerSize();
      camera = new THREE.PerspectiveCamera(45, initW / initH, 0.1, 100);
      camera.position.set(11, 8, 13);
      camera.lookAt(0, 1, 0);
      log('Cámara creada', { aspect: (initW / initH).toFixed(2) });

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setClearColor(0x101c1a, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(initW, initH);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.style.position = 'relative';
      renderer.domElement.style.zIndex = '1';
      container.appendChild(renderer.domElement);
      log('Renderer creado y canvas insertado en el contenedor', { width: initW, height: initH });

      labelRenderer = null;
      container.style.position = 'relative';

      controls = new AquaOrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 4;
      controls.maxDistance = 100;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.target.set(0.5, 1, 0.2);
      controls.update();
      log('OrbitControls listos (clic izq. rotar, rueda zoom, clic der. desplazar)');

      // ResizeObserver: mide el tamaño REAL del contenedor cuando el
      // navegador termine de resolver el layout (aspect-ratio, fuentes,
      // etc.), en vez de confiar en una sola lectura síncrona que podría
      // devolver 0 en este instante. También cubre cualquier cambio de
      // tamaño posterior (rotar el celular, redimensionar la ventana).
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cw = Math.round(entry.contentRect.width);
          const ch = Math.round(entry.contentRect.height);
          if (cw > 0 && ch > 0) applySize(cw, ch);
        }
      });
      resizeObserver.observe(container);
      // respaldo por si ResizeObserver no dispara en algún navegador viejo
      window.addEventListener('resize', () => {
        const { w, h } = getContainerSize();
        if (w > 0 && h > 0) applySize(w, h);
      });

      if (!started) {
        started = true;
        renderer.setAnimationLoop(animate);
        log('Bucle de animación iniciado (renderer.setAnimationLoop)');
      }

      return { scene, camera, renderer, controls };
    } catch (error) {
      logErr('Fallo creando la escena/renderer/controles', error);
      showFatalError('Error al iniciar WebGL: ' + (error && error.message ? error.message : error));
      return null;
    }
  }

  function getContainerSize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    // valor de respaldo razonable para el primerísimo frame, por si el
    // layout todavía no está resuelto — ResizeObserver lo corrige apenas
    // el navegador termine de calcular el tamaño real.
    return { w: w > 0 ? w : 800, h: h > 0 ? h : 450 };
  }

  function applySize(w, h) {
    if (!camera || !renderer) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (labelRenderer) labelRenderer.setSize(w, h);
  }

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (controls) controls.update();
    for (let i = 0; i < updateCallbacks.length; i++) {
      try { updateCallbacks[i](dt); } catch (error) { logErr('Error en un update() registrado', error); }
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
    if (labelRenderer) labelRenderer.render(scene, camera);
  }

  /**
   * Calcula el THREE.Box3 real de `systemRoot` (todo lo físico del
   * sistema, sin luces ni suelo) y mueve la cámara para que quede
   * completo dentro de campo de visión — nada de posiciones fijas a
   * mano. La usa tanto el arranque inicial como el botón "Centrar vista".
   */
  function frameAll(paddingFactor = 1.18) {
    if (!systemRoot || !camera || !controls) return;

    // Encuadramos SÓLO mallas físicas. No usamos setFromObject() sobre grupos
    // completos porque el fotobiorreactor contiene un THREE.Points de microalgas
    // cuyas partículas todavía no visibles se guardan temporalmente en Y=-50.
    // Eso agrandaba el bounding box, desplazaba su centro y hacía que al arrancar
    // la cámara mirase a un punto vacío hasta que el usuario la movía con el mouse.
    const box = new THREE.Box3();
    systemRoot.updateMatrixWorld(true);
    systemRoot.traverse((obj) => {
      if (!obj || !obj.visible || !obj.isMesh || !obj.geometry) return;
      const meshBox = new THREE.Box3().setFromObject(obj);
      if (!meshBox.isEmpty()) box.union(meshBox);
    });

    if (box.isEmpty()) {
      // Respaldo con las dimensiones conocidas del layout.
      box.min.set(-7.4, -0.2, -3.1);
      box.max.set(8.0, 4.1, 3.8);
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.1));
    const distV = (size.y * 0.5) / Math.tan(vFov / 2);
    const distH = (size.x * 0.5) / Math.tan(hFov / 2);
    const distD = size.z * 0.9;
    let distance = Math.max(distV, distH, distD, maxDim * 0.75) * paddingFactor;
    distance = Math.max(11, Math.min(distance, 36));

    // Vista isométrica clara: ligeramente desde arriba y desde el frente.
    const dir = new THREE.Vector3(0.72, 0.52, 0.86).normalize();
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.near = 0.05;
    camera.far = 500; // margen amplio; evita recortes accidentales al orbitar
    camera.updateProjectionMatrix();

    controls.minDistance = 3;
    controls.maxDistance = 100;
    // Apuntamos un poco por encima del centro geométrico. En una cámara en
    // perspectiva esto desplaza visualmente la maqueta hacia el centro/bajo del
    // viewport, evitando que quede pegada al borde superior.
    const visualCenter = center.clone();
    visualCenter.y += Math.max(0.35, size.y * 0.10);
    controls.target.copy(visualCenter);
    camera.lookAt(visualCenter);
    controls.update();

    log('frameAll(): cámara encuadrada ' + JSON.stringify({
      center: center.toArray().map((n) => Number(n.toFixed(2))),
      size: size.toArray().map((n) => Number(n.toFixed(2))),
      distance: Number(distance.toFixed(2)),
      camera: camera.position.toArray().map((n) => Number(n.toFixed(2)))
    }));
  }

  return {
    init,
    registerUpdate,
    frameAll,
    getScene: () => scene,
    getSystemRoot: () => systemRoot,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getControls: () => controls,
    getLabelRenderer: () => labelRenderer,
  };
})();

/* ===== environment.js ===== */
/* =========================================================================
   modules/three/environment.js
   Luces y suelo de la escena. Sin esto la geometría se vería plana y sin
   volumen perceptible — es justamente lo que distingue una maqueta 3D real
   de un dibujo con la cámara movida.
   ========================================================================= */


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

    // Plataforma clara bajo la instalación. Además de mejorar la lectura visual,
    // sirve como referencia inmediata de que WebGL está renderizando correctamente.
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.12, 10.2),
      new THREE.MeshStandardMaterial({ color: 0x243633, roughness: 0.92, metalness: 0.02 })
    );
    pad.position.set(0.5, -0.07, 0.2);
    pad.receiveShadow = true;
    scene.add(pad);
  }

  return { init };
})();

/* ===== pipes.js ===== */
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

    // --- tubería principal: peces -> filtro -> biofiltro -> bifurcación ---
    makeCurve('fishToFilter', [P.fishOutlet, P.filterIn], 0.055, mainPipe);
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
    makeCurve('plantsToConverge', [
      P.growBedOut,
      { x: P.converge.x, y: P.growBedOut.y, z: P.growBedOut.z },
      P.converge,
    ], 0.05, waterPipe);

    // --- rama del fotobiorreactor: bifurcación -> baja -> atraviesa el PBR -> convergencia ---
    makeCurve('bifurcationToPBR', [
      P.bifurcation,
      { x: LAYOUT.photobioreactor.center.x - 1.2, y: 0.5, z: P.bifurcation.z },
      { x: LAYOUT.photobioreactor.center.x, y: 0.5, z: LAYOUT.photobioreactor.center.z - LAYOUT.photobioreactor.radius - 0.3 },
      P.pbrIn,
    ], 0.045, waterPipe);
    makeCurve('throughPBR', [P.pbrIn, P.pbrOut], 0.035, waterPipe);
    makeCurve('pbrToConverge', [
      P.pbrOut,
      { x: LAYOUT.photobioreactor.center.x, y: 0.35, z: P.converge.z },
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

/* ===== fishTank.js ===== */
/* =========================================================================
   modules/three/fishTank.js
   Tanque de peces como THREE.Mesh real (BoxGeometry con ancho, alto Y
   profundidad de verdad — no un <rect> SVG). Las paredes son
   semitransparentes para poder ver el interior desde cualquier ángulo;
   el agua es un segundo Mesh más pequeño, dentro del tanque, con su
   propio material físico transparente/azulado.
   ========================================================================= */


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

/* ===== fish.js ===== */
/* =========================================================================
   modules/three/fish.js
   Peces construidos proceduralmente (cuerpo elipsoidal + cola cónica +
   par de aletas) que nadan dentro del volumen 3D del tanque — cambian de
   X, Y y Z, no sólo izquierda/derecha como en la versión plana anterior.
   Cada pez recibe un punto destino aleatorio dentro del tanque y nada
   hacia él con un giro suave (mirando hacia donde se mueve); al llegar,
   elige un nuevo destino. dt en 0 (simulación pausada) los congela.
   ========================================================================= */


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

/* ===== mechanicalFilter.js ===== */
/* =========================================================================
   modules/three/mechanicalFilter.js
   Filtro mecánico como cámara cilíndrica real, con un cilindro interior
   más pequeño (el "sedimento" retenido) que sube igual que antes lo hacía
   filterLoadRect en el SVG, pero ahora es volumen de verdad.
   ========================================================================= */


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

/* ===== biofilter.js ===== */
/* =========================================================================
   modules/three/biofilter.js
   Biofiltro como cilindro con medio filtrante (esferas pequeñas via
   InstancedMesh, ligero) y "bacterias" como puntos emissive que laten
   suavemente — equivalente 3D del bacteria-group del SVG.
   ========================================================================= */


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

      if (mediaInst) {
        mediaParticles.forEach((p, i) => {
          const a = p.angle + time * p.speed;
          const rr = p.r * (0.96 + 0.04 * Math.sin(time * 0.7 + p.phase));
          const y = THREE.MathUtils.clamp(p.y + Math.sin(time * 1.2 + p.phase) * 0.045, -L.height * 0.42, L.height * 0.38);
          animDummy.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
          animDummy.rotation.set(time * 0.25 + p.phase, a * 0.4, time * 0.18);
          animDummy.updateMatrix();
          mediaInst.setMatrixAt(i, animDummy.matrix);
        });
        mediaInst.instanceMatrix.needsUpdate = true;
      }

      if (bactInst) {
        bacteriaParticles.forEach((p, i) => {
          const a = p.angle + time * p.speed;
          const rr = p.r * (0.88 + 0.12 * Math.sin(time * 0.9 + p.phase));
          const y = THREE.MathUtils.clamp(p.y + Math.sin(time * 1.8 + p.phase) * 0.10, -L.height * 0.36, L.height * 0.42);
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

/* ===== growBeds.js ===== */
/* =========================================================================
   modules/three/growBeds.js
   Mesa de cultivo elevada: tres canales cilíndricos horizontales sobre
   patas reales (CylinderGeometry acostado, no un <rect> SVG), con
   plantas (tallo + hojas) que crecen desde cada orificio. Expone la
   misma API que antes (Aqua.Plants), así que app.js no necesitó cambiar
   sus llamadas — sólo cambió qué hay detrás de ellas.
   ========================================================================= */


window.Aqua = window.Aqua || {};

Aqua.Plants = (function () {

  const gb = LAYOUT.growBed;
  let plants = []; // { group, growth }

  function buildLeg(x, z) {
    const legGeo = new THREE.BoxGeometry(0.12, gb.tubeY, 0.12);
    const leg = new THREE.Mesh(legGeo, Aqua.Materials.plastic(0x2b3230, 0.85));
    leg.position.set(x, gb.tubeY / 2, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    return leg;
  }

  function buildPlant() {
    const group = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2c, roughness: 0.7 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9b4a, roughness: 0.6 });

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 6), stemMat);
    stem.position.y = 0.11;
    group.add(stem);

    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leafMat);
      leaf.scale.set(1.3, 0.4, 0.9);
      const ang = (i / 3) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 0.06, 0.16 + i * 0.03, Math.sin(ang) * 0.06);
      leaf.rotation.y = ang;
      group.add(leaf);
    }

    group.scale.setScalar(0.001); // arranca prácticamente invisible
    group.castShadow = true;
    return group;
  }

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    plants = [];

    gb.zRows.forEach((z) => {
      // canal (tubo horizontal, acostado sobre el eje X)
      const length = gb.xEnd - gb.xStart;
      const tubeGeo = new THREE.CylinderGeometry(gb.tubeRadius, gb.tubeRadius, length, 20);
      tubeGeo.rotateZ(Math.PI / 2);
      const tube = new THREE.Mesh(tubeGeo, Aqua.Materials.plastic(0xe4d6a0, 0.55));
      tube.position.set((gb.xStart + gb.xEnd) / 2, gb.tubeY, z);
      tube.castShadow = true;
      tube.receiveShadow = true;
      scene.add(tube);

      // patas de soporte en ambos extremos del canal
      scene.add(buildLeg(gb.xStart + 0.15, z));
      scene.add(buildLeg(gb.xEnd - 0.15, z));

      // plantas distribuidas a lo largo del canal, saliendo por arriba
      for (let i = 0; i < gb.holesPerRow; i++) {
        const t = (i + 0.5) / gb.holesPerRow;
        const x = THREE.MathUtils.lerp(gb.xStart + 0.2, gb.xEnd - 0.2, t);
        const plant = buildPlant();
        plant.position.set(x, gb.tubeY + gb.tubeRadius, z);
        scene.add(plant);
        plants.push({ group: plant, growth: 0 });
      }
    });
  }

  /** Igual firma que antes: dt real, multiplicador de velocidad, y
   *  disponibilidad de nutrientes (0..1) ya calculada en app.js. */
  function growthTick(dt, speed, nutrientAvailability) {
    if (dt <= 0) return;
    const rate = 0.05 * Math.max(0, nutrientAvailability) * speed * dt;
    plants.forEach((p) => {
      p.growth = Math.min(1, p.growth + rate);
      const s = 0.05 + p.growth * 0.95;
      p.group.scale.setScalar(s);
    });
  }

  /** Evento puntual: una raíz absorbe nutrientes — una planta al azar da
   *  un salto de crecimiento, igual que en la versión 2D. */
  function absorbTick() {
    if (!plants.length) return;
    const p = plants[Math.floor(Math.random() * plants.length)];
    p.growth = Math.min(1, p.growth + 0.05);
    p.group.scale.setScalar(0.05 + p.growth * 0.95);
  }

  function reset() {
    plants.forEach((p) => {
      p.growth = 0;
      p.group.scale.setScalar(0.001);
    });
  }

  function getGrowthPercent() {
    if (!plants.length) return 0;
    const avg = plants.reduce((sum, p) => sum + p.growth, 0) / plants.length;
    return Math.round(Math.min(1, Math.max(0, avg)) * 100);
  }

  return { init, growthTick, absorbTick, reset, getGrowthPercent };
})();

/* ===== sump.js ===== */
/* =========================================================================
   modules/three/sump.js
   Depósito/bomba como tanque 3D (BoxGeometry) con un rotor real
   (CylinderGeometry + aspas) que gira sobre su propio eje. En Three.js
   girar un mesh es simplemente mesh.rotation.y += ángulo cada fotograma
   — no existe el conflicto CSS-transform-vs-SVG-transform que obligaba a
   la versión 2D a hacerlo con cuidado especial; aquí es la forma normal
   y segura de animar rotación.
   ========================================================================= */


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

/* ===== photobioreactor.js ===== */
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

/* ===== co2System.js ===== */
/* =========================================================================
   modules/three/co2System.js
   Bomba/compresor de CO₂ como carcasa 3D (BoxGeometry con patas y un
   detalle circular de ventilación) fuera del fotobiorreactor, conectada
   al difusor interno mediante una manguera curva y delgada — un tubo
   real (TubeGeometry), pero de radio muy inferior al de las tuberías de
   agua para que no se confundan visualmente.
   ========================================================================= */


window.Aqua = window.Aqua || {};

Aqua.Co2System = (function () {

  function init() {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const L = LAYOUT.co2Pump;

    const group = new THREE.Group();
    group.position.set(L.center.x, 0, L.center.z);

    const bodyGeo = new THREE.BoxGeometry(L.size.w, L.size.h, L.size.d);
    const body = new THREE.Mesh(bodyGeo, Aqua.Materials.plastic(0x203633, 0.6));
    body.position.y = L.size.h / 2 + 0.06;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // patas cortas
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8);
    const legMat = Aqua.Materials.metal(0x4d5c58, 0.4);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * (L.size.w / 2 - 0.06), 0.06, sz * (L.size.d / 2 - 0.06));
      leg.castShadow = true;
      group.add(leg);
    });

    // detalle de ventilación: aro + aspas simples
    const ventRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 20), Aqua.Materials.metal(0x74c2bc, 0.3));
    ventRing.position.set(0, L.size.h / 2 + 0.06, L.size.d / 2 + 0.01);
    group.add(ventRing);
    const crossGeo = new THREE.BoxGeometry(0.16, 0.016, 0.016);
    const cross1 = new THREE.Mesh(crossGeo, Aqua.Materials.metal(0x74c2bc, 0.3));
    cross1.position.copy(ventRing.position);
    group.add(cross1);
    const cross2 = cross1.clone();
    cross2.rotation.z = Math.PI / 2;
    group.add(cross2);

    // boquilla de salida (donde arranca la manguera)
    const nozzleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8);
    const nozzle = new THREE.Mesh(nozzleGeo, Aqua.Materials.metal(0x4d5c58, 0.4));
    nozzle.position.set(0, L.size.h + 0.09, 0);
    group.add(nozzle);

    scene.add(group);

    // manguera: bomba -> sube -> entra por arriba del reactor -> baja
    // hasta el difusor. Curva independiente de las tuberías de agua.
    const P = computePorts();
    const pumpTop = { x: L.center.x, y: L.size.h + 0.12, z: L.center.z };
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(pumpTop.x, pumpTop.y, pumpTop.z),
      new THREE.Vector3(pumpTop.x, P.pbrIn.y + 0.15, pumpTop.z),
      new THREE.Vector3(P.diffuser.x, P.pbrIn.y + 0.1, P.diffuser.z),
      new THREE.Vector3(P.diffuser.x, P.diffuser.y + 0.05, P.diffuser.z),
    ]);
    const hoseGeo = new THREE.TubeGeometry(curve, 40, 0.014, 8, false);
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x647975, roughness: 0.7 });
    const hose = new THREE.Mesh(hoseGeo, hoseMat);
    hose.castShadow = true;
    scene.add(hose);
  }

  return { init };
})();

/* ===== particles.js ===== */
/* =========================================================================
   modules/three/particles.js
   Partículas de residuos/nutrientes recorriendo curvas 3D reales con
   curve.getPointAt(t) — el reemplazo conceptual exacto del antiguo
   getPointAtLength() de SVG. Misma arquitectura de "tramos" (legs) que ya
   tenía modules/nutrients.js: cada partícula es una lista de tramos con
   su propia curva, duración y color; la bifurcación plantas/PBR se decide
   al nacer, igual que antes. Expone la misma API pública (Aqua.Nutrients)
   así que app.js no tuvo que cambiar cómo la usa.
   ========================================================================= */


window.Aqua = window.Aqua || {};

Aqua.Nutrients = (function () {

  let scene = null;
  let particles = [];
  let wasteTimer = 999;
  let nutrientTimer = 999;
  let waterTimer = 999;
  let wasFlowing = false;
  let idCounter = 0;
  let pbrFraction = 0.4;
  let pbrEnabled = true;

  const COLORS = {
    waste: 0x6b4a2a,
    ammonia: 0xe8935a,
    nitrite: 0xe0c23a,
    nitrate: 0x7fc65a,
    pbr: 0x5fcf93,
    clean: 0x74c2bc,
    water: 0x4ed9ff,
  };

  const LEG_DURATIONS = {
    toFilter: 1.1, toBio: 1.0, throughBio: 0.9,
    toPlants: 0.9, throughPlants: 1.4, toConverge: 0.8, toSump: 0.6,
    toBifurcationPBR: 0.25, intoPBR: 0.6, throughPBR: 1.1, outOfPBR: 0.6, pbrToConverge: 0.8,
    returning: 3.0,
  };

  let callbacks = {
    onWasteCaught: function () {},
    onNutrientAbsorbed: function () {},
    onCycleComplete: function () {},
    onPBRTransit: function () {},
  };

  function makeSphere(color, radius) {
    const geo = new THREE.SphereGeometry(radius, 12, 12);
    // MeshBasicMaterial no depende de la iluminación y se mantiene brillante
    // dentro de las tuberías semitransparentes.
    const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.98 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 20;
    scene.add(mesh);
    return mesh;
  }

  function init() {
    scene = Aqua.Three.getScene();
  }

  function setCallbacks(cb) { callbacks = Object.assign(callbacks, cb); }
  function setBranchRatio(plantsFraction) { pbrFraction = Math.min(1, Math.max(0, 1 - plantsFraction)); }
  function setPBREnabled(enabled) { pbrEnabled = !!enabled; }

  function spawnWaste() {
    particles.push({
      id: 'p' + (idCounter++),
      kind: 'waste',
      mesh: makeSphere(COLORS.waste, 0.075),
      legIndex: 0,
      legElapsed: 0,
      legs: [{ curve: 'fishToFilter', dur: LEG_DURATIONS.toFilter, color: COLORS.waste }],
      done: false,
    });
  }

  function spawnNutrient() {
    const toPBR = pbrEnabled && Math.random() < pbrFraction;
    const willBeAbsorbed = Math.random() < 0.5;
    const absorbAt = 0.25 + Math.random() * 0.55;

    const legs = [
      { curve: 'filterToBio', dur: LEG_DURATIONS.toBio, color: COLORS.ammonia },
      { curve: 'throughBio', dur: LEG_DURATIONS.throughBio, color: COLORS.nitrite },
    ];

    if (toPBR) {
      legs.push(
        { curve: 'bioToBifurcation', dur: LEG_DURATIONS.toBifurcationPBR, color: COLORS.nitrate },
        { curve: 'bifurcationToPBR', dur: LEG_DURATIONS.intoPBR, color: COLORS.nitrate },
        { curve: 'throughPBR', dur: LEG_DURATIONS.throughPBR, color: COLORS.pbr, pbrTransit: true },
        { curve: 'pbrToConverge', dur: LEG_DURATIONS.outOfPBR, color: COLORS.clean },
        { curve: 'convergeToSump', dur: LEG_DURATIONS.toSump, color: COLORS.clean },
        { curve: 'pumpToReturn', dur: LEG_DURATIONS.returning, color: COLORS.clean }
      );
    } else {
      legs.push(
        { curve: 'bioToBifurcation', dur: LEG_DURATIONS.toBifurcationPBR, color: COLORS.nitrate },
        { curve: 'bifurcationToPlants', dur: LEG_DURATIONS.toPlants, color: COLORS.nitrate },
        { curve: 'throughPlants', dur: LEG_DURATIONS.throughPlants, color: COLORS.nitrate, absorbable: true },
        { curve: 'plantsToConverge', dur: LEG_DURATIONS.toConverge, color: COLORS.clean },
        { curve: 'convergeToSump', dur: LEG_DURATIONS.toSump, color: COLORS.clean },
        { curve: 'pumpToReturn', dur: LEG_DURATIONS.returning, color: COLORS.clean }
      );
    }

    particles.push({
      id: 'p' + (idCounter++),
      kind: 'nutrient',
      branch: toPBR ? 'pbr' : 'plants',
      mesh: makeSphere(COLORS.ammonia, 0.070),
      legIndex: 0,
      legElapsed: 0,
      willBeAbsorbed,
      absorbAt,
      legs,
      done: false,
    });
  }

  function spawnWater() {
    const toPBR = pbrEnabled && Math.random() < pbrFraction;
    const legs = [
      { curve: 'fishToFilter', dur: 0.85, color: COLORS.water },
      { curve: 'filterToBio', dur: 0.75, color: COLORS.water },
      { curve: 'throughBio', dur: 0.65, color: COLORS.water },
      { curve: 'bioToBifurcation', dur: 0.35, color: COLORS.water }
    ];
    if (toPBR) {
      legs.push(
        { curve: 'bifurcationToPBR', dur: 0.6, color: COLORS.water },
        { curve: 'throughPBR', dur: 0.75, color: COLORS.water },
        { curve: 'pbrToConverge', dur: 0.55, color: COLORS.water }
      );
    } else {
      legs.push(
        { curve: 'bifurcationToPlants', dur: 0.65, color: COLORS.water },
        { curve: 'throughPlants', dur: 0.9, color: COLORS.water },
        { curve: 'plantsToConverge', dur: 0.55, color: COLORS.water }
      );
    }
    legs.push(
      { curve: 'convergeToSump', dur: 0.45, color: COLORS.water },
      { curve: 'pumpToReturn', dur: 1.65, color: COLORS.water }
    );
    const mesh = makeSphere(COLORS.water, 0.060);
    // posición inicial inmediata: no queda un frame en (0,0,0)
    mesh.position.copy(Aqua.WaterFlow.pointAt(legs[0].curve, 0));
    particles.push({
      id: 'p' + (idCounter++), kind: 'water', mesh, legIndex: 0, legElapsed: 0,
      legs, done: false
    });
  }

  function removeParticle(p) {
    if (p.mesh) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    p.done = true;
  }

  function update(dt, speed, flowing, emissionModifiers) {
    emissionModifiers = emissionModifiers || {};
    const wasteInterval = 0.95 / Math.max(0.3, (emissionModifiers.wasteRate || 1));
    const nutrientInterval = 0.80;
    const waterInterval = 0.20;

    // Al pulsar Iniciar generamos trazadores INMEDIATAMENTE. Así el usuario
    // ve el flujo sin tener que esperar varios segundos.
    if (flowing && !wasFlowing) {
      for (let i = 0; i < 8; i++) spawnWater();
      spawnWaste();
      spawnNutrient();
      wasteTimer = nutrientTimer = waterTimer = 0;
    }
    wasFlowing = flowing;

    if (flowing) {
      wasteTimer += dt * speed;
      nutrientTimer += dt * speed;
      waterTimer += dt * speed;
      if (wasteTimer >= wasteInterval) { wasteTimer = 0; spawnWaste(); }
      if (nutrientTimer >= nutrientInterval) { nutrientTimer = 0; spawnNutrient(); }
      if (waterTimer >= waterInterval && particles.length < 90) { waterTimer = 0; spawnWater(); }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.done) { particles.splice(i, 1); continue; }
      if (!flowing) continue; // congeladas en su posición actual

      const leg = p.legs[p.legIndex];
      p.legElapsed += dt * speed;
      const legProgress = Math.min(1, p.legElapsed / leg.dur);

      const pos = Aqua.WaterFlow.pointAt(leg.curve, legProgress);
      p.mesh.position.copy(pos);
      if (p.mesh.material.color.getHex() !== leg.color) {
        p.mesh.material.color.setHex(leg.color);
        if (p.mesh.material.emissive) p.mesh.material.emissive.setHex(leg.color);
      }

      if (p.kind === 'nutrient' && leg.absorbable && p.willBeAbsorbed && legProgress >= p.absorbAt) {
        callbacks.onNutrientAbsorbed();
        removeParticle(p);
        continue;
      }

      if (legProgress >= 1) {
        if (leg.pbrTransit) callbacks.onPBRTransit();
        p.legIndex += 1;
        if (p.legIndex >= p.legs.length) {
          if (p.kind === 'waste') callbacks.onWasteCaught();
          if (p.kind === 'nutrient') callbacks.onCycleComplete();
          removeParticle(p);
        } else {
          p.legElapsed = 0;
        }
      }
    }
  }

  function reset() {
    particles.forEach((p) => removeParticle(p));
    particles = [];
    wasteTimer = 999;
    nutrientTimer = 999;
    waterTimer = 999;
    wasFlowing = false;
  }

  function particleCount() { return particles.length; }

  return { init, setCallbacks, setBranchRatio, setPBREnabled, update, reset, spawnWaste, spawnNutrient, spawnWater, particleCount };
})();

/* ===== labels.js ===== */
window.Aqua = window.Aqua || {};
Aqua.Labels = (function () {
  function makeTexture(text, sub) {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=128;
    const c=canvas.getContext('2d');
    c.fillStyle='rgba(8,20,18,.88)'; c.strokeStyle='rgba(100,190,180,.65)'; c.lineWidth=4;
    c.beginPath(); c.roundRect?.(4,4,504,120,18); if(c.roundRect){c.fill();c.stroke();} else {c.fillRect(4,4,504,120);c.strokeRect(4,4,504,120);}
    c.fillStyle='#e8f4f1'; c.font='700 28px Arial'; c.textAlign='center'; c.fillText(text,256,52);
    if(sub){c.fillStyle='#93b7b0'; c.font='20px Arial'; c.fillText(sub,256,88);}
    const tex=new THREE.CanvasTexture(canvas); tex.needsUpdate=true; return tex;
  }
  function add(text,x,y,z,sub){
    const root=Aqua.Three.getSystemRoot();
    const mat=new THREE.SpriteMaterial({map:makeTexture(text,sub),transparent:true,depthTest:false,depthWrite:false});
    const s=new THREE.Sprite(mat); s.position.set(x,y,z); s.scale.set(2.65,.66,1); s.renderOrder=1000; root.add(s); return s;
  }
  function init(){
    const ft=LAYOUT.fishTank,mf=LAYOUT.mechanicalFilter,bf=LAYOUT.biofilter,gb=LAYOUT.growBed,pbr=LAYOUT.photobioreactor,co2=LAYOUT.co2Pump,sump=LAYOUT.sump;
    add('TANQUE DE PECES',ft.center.x,ft.size.h+.35,ft.center.z,'peces · desechos');
    add('FILTRO MECÁNICO',mf.center.x,mf.height+.35,mf.center.z,'retiene sólidos');
    add('BIOFILTRO',bf.center.x,bf.height+.35,bf.center.z,'NH₃ → NO₂⁻ → NO₃⁻');
    add('ÁREA DE CRECIMIENTO',(gb.xStart+gb.xEnd)/2,gb.tubeY+.55,gb.zRows[0]+.2,'hortalizas');
    add('FOTOBIORREACTOR',pbr.center.x,pbr.baseHeight+pbr.height+.4,pbr.center.z,'microalgas');
    add('BOMBA CO₂',co2.center.x,co2.size.h+.3,co2.center.z);
    add('BOMBA / DEPÓSITO',sump.center.x,sump.size.h+.35,sump.center.z,'circulación');
  }
  return {init,add};
})();

window.__AQUA_THREE_READY__=true; console.log('[AQUA 3D] Bundle clásico listo'); window.dispatchEvent(new CustomEvent('aqua-three-ready'));
})();
