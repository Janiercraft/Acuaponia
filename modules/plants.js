/* =========================================================================
   modules/plants.js
   Genera las plantas dentro de los orificios de los tubos y controla su
   crecimiento (planta pequeña -> mediana -> desarrollada). La velocidad de
   crecimiento depende de la disponibilidad de nutrientes (nitrato) y de
   los eventos puntuales de absorción que dispara nutrients.js.
   ========================================================================= */

window.Aqua = window.Aqua || {};

Aqua.Plants = (function () {

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HOLE_XS = [850, 930, 1010, 1090];

  let plants = []; // { inner, growth }

  function buildPlantSVG(x, y) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('plant');
    g.setAttribute('transform', `translate(${x},${y})`);

    // orificio del tubo
    const hole = document.createElementNS(SVG_NS, 'ellipse');
    hole.setAttribute('cx', 0);
    hole.setAttribute('cy', 0);
    hole.setAttribute('rx', 13);
    hole.setAttribute('ry', 8);
    hole.classList.add('plant-hole');
    g.appendChild(hole);

    const inner = document.createElementNS(SVG_NS, 'g');
    inner.classList.add('plant-inner');
    // El crecimiento se anima con el atributo SVG transform="scale(...)"
    // (ver render() más abajo), no con la propiedad CSS transform — misma
    // razón que en fish.js: evita inconsistencias entre navegadores.
    inner.setAttribute('transform', 'scale(0.15)');
    inner.style.transition = 'opacity 1.4s ease-out';
    inner.style.opacity = '0.35';

    const stem = document.createElementNS(SVG_NS, 'path');
    stem.setAttribute('d', 'M0,0 L0,-20');
    stem.classList.add('plant-stem');
    inner.appendChild(stem);

    const leafPaths = [
      'M0,-6 C-11,-10 -15,-1 -6,3 Z',
      'M0,-11 C11,-15 15,-6 6,-2 Z',
      'M0,-17 C-9,-20 -11,-12 -3,-10 Z',
      'M0,-20 C8,-23 10,-16 3,-14 Z',
    ];
    leafPaths.forEach((d) => {
      const leaf = document.createElementNS(SVG_NS, 'path');
      leaf.setAttribute('d', d);
      leaf.classList.add('plant-leaf');
      inner.appendChild(leaf);
    });

    g.appendChild(inner);
    return { g, inner };
  }

  function init(svgSelector) {
    const svgRoot = typeof svgSelector === 'string' ? document.querySelector(svgSelector) : svgSelector;
    plants = [];

    svgRoot.querySelectorAll('.holes-row').forEach((rowGroup) => {
      const y = parseFloat(rowGroup.getAttribute('data-y'));
      HOLE_XS.forEach((x) => {
        const { g, inner } = buildPlantSVG(x, y);
        rowGroup.appendChild(g);
        plants.push({ inner, growth: 0 });
      });
    });
  }

  /**
   * Incremento de crecimiento continuo, proporcional a la disponibilidad
   * de nutrientes (0..1, derivado del nitrato actual respecto al óptimo).
   */
  function growthTick(dt, speed, nutrientAvailability) {
    const rate = 0.006 * Math.max(0, nutrientAvailability);
    plants.forEach((p) => {
      p.growth = Math.min(1, p.growth + rate * dt * speed);
    });
    render();
  }

  /**
   * Evento puntual: una raíz absorbe un paquete de nutrientes. Se aplica
   * a una planta al azar con un salto de crecimiento algo mayor.
   */
  function absorbTick() {
    if (!plants.length) return;
    const p = plants[Math.floor(Math.random() * plants.length)];
    p.growth = Math.min(1, p.growth + 0.05);
    render();
  }

  function render() {
    plants.forEach((p) => {
      const scale = 0.15 + p.growth * 0.95;
      const opacity = 0.35 + p.growth * 0.65;
      p.inner.setAttribute('transform', `scale(${scale.toFixed(3)})`);
      p.inner.style.opacity = opacity.toFixed(2);
    });
  }

  function reset() {
    plants.forEach((p) => { p.growth = 0; });
    render();
  }

  return { init, growthTick, absorbTick, reset };
})();
