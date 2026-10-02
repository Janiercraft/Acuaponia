/* =========================================================================
   modules/three/core.js
   El corazón de la escena WebGL: crea explícitamente THREE.Scene,
   THREE.PerspectiveCamera, THREE.WebGLRenderer, OrbitControls y
   CSS2DRenderer dentro de #three-container, arranca el bucle de
   render/animación, y expone un pequeño registro de "callbacks de
   actualización" para que cada módulo enganche su propia lógica de
   fotograma a fotograma.

   Además, esta versión permite seleccionar un dispositivo con clic/tap:
   al enfocarlo se ocultan las etiquetas del sistema para despejar la vista;
   al limpiar la selección se restablece la vista general con etiquetas.
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
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerDown = null;
  let selectedObject = null;

  function registerUpdate(fn) {
    updateCallbacks.push(fn);
  }

  function registerSelectable(root, meta = {}) {
    if (!root) return root;
    root.userData = root.userData || {};
    root.userData.aquaSelectable = true;
    if (meta.id) root.userData.aquaDeviceId = meta.id;
    if (meta.name) root.userData.aquaDeviceName = meta.name;
    return root;
  }

  function findSelectableAncestor(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.aquaSelectable) return cur;
      if (cur === systemRoot) break;
      cur = cur.parent;
    }
    return null;
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

      bindPicking();

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cw = Math.round(entry.contentRect.width);
          const ch = Math.round(entry.contentRect.height);
          if (cw > 0 && ch > 0) applySize(cw, ch);
        }
      });
      resizeObserver.observe(container);
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

  function bindPicking() {
    if (!renderer || !renderer.domElement) return;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      pointerDown = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      if (!pointerDown) return;
      const dx = e.clientX - pointerDown.x;
      const dy = e.clientY - pointerDown.y;
      pointerDown = null;
      if (Math.hypot(dx, dy) > 8) return;
      const picked = pickSelectable(e.clientX, e.clientY);
      if (picked) focusObject(picked);
      else clearSelection();
    });
  }

  function pickSelectable(clientX, clientY) {
    if (!renderer || !camera || !systemRoot) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(systemRoot.children, true);
    for (const hit of hits) {
      const selectable = findSelectableAncestor(hit.object);
      if (selectable) return selectable;
    }
    return null;
  }

  function getContainerSize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
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

  function computeBoxFor(object3d) {
    const box = new THREE.Box3();
    object3d.updateMatrixWorld(true);
    object3d.traverse((obj) => {
      if (!obj || !obj.visible || !obj.isMesh || !obj.geometry) return;
      const meshBox = new THREE.Box3().setFromObject(obj);
      if (!meshBox.isEmpty()) box.union(meshBox);
    });
    return box;
  }

  function frameObject(object3d, paddingFactor = 1.45) {
    if (!object3d || !camera || !controls) return;
    const box = computeBoxFor(object3d);
    if (box.isEmpty()) return frameAll();

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.4);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.1));
    const distV = (size.y * 0.5) / Math.tan(vFov / 2);
    const distH = (size.x * 0.5) / Math.tan(hFov / 2);
    const distD = size.z * 1.2;
    let distance = Math.max(distV, distH, distD, maxDim * 1.15) * paddingFactor;
    distance = Math.max(2.6, Math.min(distance, 16));

    const dir = new THREE.Vector3(0.88, 0.38, 0.78).normalize();
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.near = 0.05;
    camera.far = 500;
    camera.updateProjectionMatrix();

    const visualCenter = center.clone();
    visualCenter.y += Math.max(0.08, size.y * 0.04);
    controls.target.copy(visualCenter);
    controls.minDistance = Math.max(1.2, maxDim * 0.45);
    controls.maxDistance = 100;
    camera.lookAt(visualCenter);
    controls.update();
  }

  function focusObject(object3d) {
    selectedObject = object3d;
    if (window.Aqua && Aqua.Labels && Aqua.Labels.showOnly) {
      Aqua.Labels.showOnly(object3d.userData && object3d.userData.aquaDeviceId);
    }
  }

  function frameAll(paddingFactor = 1.18) {
    if (!systemRoot || !camera || !controls) return;
    const box = computeBoxFor(systemRoot);
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

  function clearSelection(options = {}) {
    selectedObject = null;
    if (window.Aqua && Aqua.Labels && Aqua.Labels.hideAll) Aqua.Labels.hideAll();
    if (options.restoreFrame) frameAll();
  }

  return {
    init,
    registerUpdate,
    registerSelectable,
    frameAll,
    frameObject,
    clearSelection,
    getSelectedObject: () => selectedObject,
    getScene: () => scene,
    getSystemRoot: () => systemRoot,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getControls: () => controls,
    getLabelRenderer: () => labelRenderer,
  };
})();
