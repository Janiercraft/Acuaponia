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

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

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

    // Si el proyecto se abrió con file:// en vez de un servidor HTTP, los
    // módulos ES entre archivos locales quedan bloqueados por CORS en la
    // mayoría de navegadores — avisamos explícitamente en vez de dejar el
    // panel en blanco sin explicación (sección 7 del diagnóstico pedido).
    if (location.protocol === 'file:') {
      logErr('El proyecto se abrió con file:// — los módulos ES (import) no cargan así en la mayoría de navegadores.');
      showFatalError('Este proyecto usa módulos ES (import) y necesita abrirse desde un servidor HTTP, no con doble clic.<br>Ejemplo: <code>python -m http.server 5500</code> y luego abre <code>http://localhost:5500</code>.');
      return null;
    }

    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d1615);
      scene.fog = new THREE.Fog(0x0d1615, 16, 34);
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

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(initW, initH);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.position = 'relative';
      renderer.domElement.style.zIndex = '1';
      container.appendChild(renderer.domElement);
      log('Renderer creado y canvas insertado en el contenedor', { width: initW, height: initH });

      labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(initW, initH);
      labelRenderer.domElement.style.position = 'absolute';
      labelRenderer.domElement.style.top = '0';
      labelRenderer.domElement.style.left = '0';
      labelRenderer.domElement.style.zIndex = '2';
      labelRenderer.domElement.style.pointerEvents = 'none';
      container.style.position = 'relative';
      container.appendChild(labelRenderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 4;
      controls.maxDistance = 30;
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

    // Sólo las mallas físicas participan en el encuadre. Se excluyen recursivamente
    // Points/Sprites (por ejemplo las microalgas ocultas inicialmente en Y=-50),
    // porque de otro modo el bounding box queda enorme y la cámara arranca mirando
    // fuera del sistema.
    const box = new THREE.Box3();
    systemRoot.updateMatrixWorld(true);
    systemRoot.traverse((obj) => {
      if (!obj || !obj.visible || !obj.isMesh || !obj.geometry) return;
      const meshBox = new THREE.Box3().setFromObject(obj);
      if (!meshBox.isEmpty()) box.union(meshBox);
    });

    if (box.isEmpty()) {
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

    const dir = new THREE.Vector3(0.72, 0.52, 0.86).normalize();
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.near = 0.05;
    camera.far = 500;
    camera.updateProjectionMatrix();

    controls.minDistance = 3;
    controls.maxDistance = 100;
    const visualCenter = center.clone();
    visualCenter.y += Math.max(0.20, size.y * 0.04);
    controls.target.copy(visualCenter);
    camera.lookAt(visualCenter);
    controls.update();

    log('frameAll(): cámara encuadrada', { center: center.toArray().map((n) => n.toFixed(2)), size: size.toArray().map((n) => n.toFixed(2)), distance: distance.toFixed(2) });
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
