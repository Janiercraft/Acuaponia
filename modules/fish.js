/* =========================================================================
   modules/fish.js
   Mueve los peces dentro del tanque calculando su posición en JavaScript,
   fotograma a fotograma, y aplicándola con el atributo SVG
   transform="translate(x,y) scale(sx,1)".

   A PROPÓSITO no se usa una animación CSS (@keyframes con `transform`)
   para esto: cuando un elemento SVG ya trae su propio atributo
   `transform` (como el grupo del rotor de la bomba, ver app.js) y además
   se le anima la propiedad CSS `transform`, el valor animado por CSS
   sustituye por completo al atributo — y el navegador termina
   posicionando el elemento en el lugar equivocado. Ese comportamiento
   además varía entre navegadores, así que en unos computadores se ve
   "bien" y en otros no. Calculando la posición nosotros mismos y
   escribiéndola siempre como atributo evitamos ese problema de raíz.
   ========================================================================= */

window.Aqua = window.Aqua || {};

Aqua.Fish = (function () {

  // Cada pez oscila entre dos puntos (ida y vuelta) con una curva suave
  // tipo seno, igual que antes, pero calculada a mano en vez de con
  // @keyframes de CSS.
  const FISH_DEFS = [
    { from: [70, 260], to: [190, 240], period: 7.0, phase: 0 },
    { from: [180, 220], to: [80, 310], period: 9.0, phase: -2 },
    { from: [120, 320], to: [210, 290], period: 6.4, phase: -4 },
  ];

  let fish = []; // { el, def, t }
  let tankOutline = null;
  let sluggishFactor = 1; // 1 = velocidad normal, <1 = más lento (bajo oxígeno)

  function init(svgSelector) {
    const svgRoot = typeof svgSelector === 'string' ? document.querySelector(svgSelector) : svgSelector;
    const els = Array.from(svgRoot.querySelectorAll('.fish'));
    tankOutline = svgRoot.querySelector('.tank-outline');

    fish = els.map((el, i) => ({
      el,
      def: FISH_DEFS[i % FISH_DEFS.length],
      t: FISH_DEFS[i % FISH_DEFS.length].phase,
    }));

    render(); // posición inicial, sin esperar al primer tick
  }

  function setSluggish(active) {
    sluggishFactor = active ? 0.3 : 1;
  }

  function setTankAtRisk(active) {
    if (!tankOutline) return;
    tankOutline.style.stroke = active ? 'var(--alert-red)' : 'var(--metal)';
  }

  /**
   * Avanza la posición de cada pez. `dt` en segundos reales; ya viene en 0
   * cuando la simulación está en pausa, así que los peces se congelan
   * junto con el resto del sistema.
   */
  function update(dt) {
    if (dt > 0) {
      fish.forEach((f) => { f.t += dt * sluggishFactor; });
    }
    render();
  }

  function render() {
    fish.forEach((f) => {
      const { from, to, period } = f.def;
      const cyclePos = (((f.t / period) % 1) + 1) % 1; // 0..1, siempre positivo
      const angle = 2 * Math.PI * cyclePos - Math.PI / 2;
      const wave = Math.sin(angle);       // -1..1
      const derivative = Math.cos(angle); // signo = sentido del movimiento

      const progress = (wave + 1) / 2; // 0..1 entre 'from' y 'to'
      const x = from[0] + (to[0] - from[0]) * progress;
      const y = from[1] + (to[1] - from[1]) * progress;

      const dxSign = to[0] - from[0] >= 0 ? 1 : -1;
      const movingTowardTo = derivative >= 0;
      const facingRight = movingTowardTo ? dxSign > 0 : dxSign < 0;
      const scaleX = facingRight ? 1 : -1;

      f.el.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${scaleX},1)`);
    });
  }

  return { init, update, setSluggish, setTankAtRisk };
})();
