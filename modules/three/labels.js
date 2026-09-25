/* =========================================================================
   modules/three/labels.js
   Nombres de los componentes (TANQUE DE PECES, FILTRO MECÁNICO, etc.) como
   etiquetas HTML ancladas a un punto 3D mediante CSS2DObject — permanecen
   legibles y del mismo tamaño en pantalla sin importar cómo rote la
   cámara, a diferencia de un texto SVG que hubiera quedado "pegado" al
   dibujo plano anterior.
   ========================================================================= */

import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Labels = (function () {

  function makeLabel(text, sub) {
    const wrap = document.createElement('div');
    wrap.className = 'label3d';
    const title = document.createElement('div');
    title.className = 'label3d-title';
    title.textContent = text;
    wrap.appendChild(title);
    if (sub) {
      const subEl = document.createElement('div');
      subEl.className = 'label3d-sub';
      subEl.textContent = sub;
      wrap.appendChild(subEl);
    }
    return wrap;
  }

  function add(text, x, y, z, sub) {
    const scene = Aqua.Three.getSystemRoot(); // meshes "físicos": entran al bounding box de frameAll()
    const obj = new CSS2DObject(makeLabel(text, sub));
    obj.position.set(x, y, z);
    scene.add(obj);
    return obj;
  }

  function init() {
    const ft = LAYOUT.fishTank;
    const mf = LAYOUT.mechanicalFilter;
    const bf = LAYOUT.biofilter;
    const gb = LAYOUT.growBed;
    const pbr = LAYOUT.photobioreactor;
    const co2 = LAYOUT.co2Pump;
    const sump = LAYOUT.sump;

    add('TANQUE DE PECES', ft.center.x, ft.size.h + 0.35, ft.center.z, 'peces · desechos');
    add('FILTRO MECÁNICO', mf.center.x, mf.height + 0.35, mf.center.z, 'retiene sólidos');
    add('BIOFILTRO', bf.center.x, bf.height + 0.35, bf.center.z, 'NH₃ → NO₂⁻ → NO₃⁻');
    add('ÁREA DE CRECIMIENTO', (gb.xStart + gb.xEnd) / 2, gb.tubeY + 0.55, gb.zRows[0] + 0.2, 'hortalizas');
    add('FOTOBIORREACTOR', pbr.center.x, pbr.baseHeight + pbr.height + 0.4, pbr.center.z, 'microalgas');
    add('BOMBA CO₂', co2.center.x, co2.size.h + 0.3, co2.center.z);
    add('BOMBA / DEPÓSITO', sump.center.x, sump.size.h + 0.35, sump.center.z, 'circulación');
  }

  return { init, add };
})();
