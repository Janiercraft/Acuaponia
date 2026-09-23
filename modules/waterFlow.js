/* =========================================================================
   modules/waterFlow.js
   Controla la animación de las tuberías (flujo encendido/apagado, velocidad)
   y expone utilidades para recorrer un <path> SVG punto a punto, usadas
   luego por nutrients.js para mover partículas de agua/residuos/nutrientes.
   ========================================================================= */

window.Aqua = window.Aqua || {};

Aqua.WaterFlow = (function () {

  const SVG_NS = 'http://www.w3.org/2000/svg';

  let svgRoot = null;
  let pipeEls = [];       // todas las tuberías (.pipe)
  let overlayEls = [];    // líneas punteadas animadas que representan el agua moviéndose
  let flowing = false;    // si el flujo general está activo (bomba encendida y sin fallas que lo detengan)
  let speedMultiplier = 1;
  let flowOffset = 0;

  /**
   * Inserta, por cada tubería, una línea punteada superpuesta que se anima
   * con stroke-dashoffset para simular el desplazamiento del agua.
   */
  function init(svgSelector) {
    svgRoot = typeof svgSelector === 'string' ? document.querySelector(svgSelector) : svgSelector;
    if (!svgRoot) return;

    pipeEls = Array.from(svgRoot.querySelectorAll('.pipe'));
    overlayEls = [];

    pipeEls.forEach((pipe) => {
      const overlay = document.createElementNS(SVG_NS, 'path');
      overlay.setAttribute('d', pipe.getAttribute('d'));
      overlay.classList.add('pipe-flow-overlay');
      overlay.classList.add('paused');
      overlay.setAttribute('stroke-dashoffset', '0');
      pipe.insertAdjacentElement('afterend', overlay);
      overlayEls.push(overlay);
    });

    return { pipeEls, overlayEls };
  }

  /**
   * Activa o detiene visualmente el desplazamiento del agua en las tuberías.
   */
  function setFlowing(active) {
    flowing = !!active;
    overlayEls.forEach((el) => {
      el.classList.toggle('paused', !flowing);
    });
  }

  function isFlowing() {
    return flowing;
  }

  /**
   * Ajusta la velocidad visual del flujo (más rápido = duración menor de la
   * animación de guiones). multiplier: 0.5 a 3 típicamente.
   */
  function setSpeed(multiplier) {
    speedMultiplier = Math.max(0.1, Number(multiplier) || 1);
    if (!svgRoot) return;
    const base = 2.6;
    const duration = Math.max(0.4, base / speedMultiplier);
    svgRoot.style.setProperty('--flow-duration', duration + 's');
  }

  /**
   * Avanza los puntos de flujo desde JavaScript.
   * Esto evita diferencias entre navegadores al animar stroke-dashoffset
   * de elementos SVG mediante CSS (especialmente Safari/WebView y algunos
   * navegadores móviles).
   */
  function update(dt, multiplier) {
    if (!flowing || !overlayEls.length || !dt) return;
    const speed = Math.max(0.1, Number(multiplier) || speedMultiplier || 1);
    // Equivale aproximadamente a -160 unidades cada 2.6 s a velocidad 1x.
    flowOffset = (flowOffset - (160 / 2.6) * dt * speed) % 160;
    const value = flowOffset.toFixed(2);
    overlayEls.forEach((el) => el.setAttribute('stroke-dashoffset', value));
  }

  /**
   * Devuelve un elemento <path> por id junto con su longitud total,
   * cacheada para no recalcularla en cada frame.
   */
  const lengthCache = new Map();
  function getPathInfo(pathId) {
    let info = lengthCache.get(pathId);
    if (info) return info;
    const el = svgRoot ? svgRoot.querySelector('#' + pathId) : document.getElementById(pathId);
    if (!el) return null;
    info = { el, length: el.getTotalLength() };
    lengthCache.set(pathId, info);
    return info;
  }

  /**
   * Devuelve el punto {x,y} en un path para un progreso 0..1.
   */
  function pointAt(pathId, progress) {
    const info = getPathInfo(pathId);
    if (!info) return { x: 0, y: 0 };
    const p = Math.min(1, Math.max(0, progress));
    return info.el.getPointAtLength(p * info.length);
  }

  /**
   * Búsqueda binaria del progreso (0..1) en el que un path alcanza una
   * coordenada X determinada. Asume que el tramo de interés es monótono
   * en X (cierto para los tramos horizontales de nuestra tubería principal).
   */
  function progressAtX(pathId, targetX) {
    const info = getPathInfo(pathId);
    if (!info) return 0;
    let lo = 0, hi = 1;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      const pt = info.el.getPointAtLength(mid * info.length);
      if (pt.x < targetX) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  return {
    init,
    setFlowing,
    isFlowing,
    setSpeed,
    update,
    getPathInfo,
    pointAt,
    progressAtX,
  };
})();
