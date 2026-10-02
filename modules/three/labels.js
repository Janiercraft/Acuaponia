/* =========================================================================
   modules/three/labels.js
   Etiquetas de componentes. Permanecen ocultas en la vista general y sólo
   aparece la etiqueta del dispositivo seleccionado mediante clic/tap.
   ========================================================================= */

import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { LAYOUT } from './layout.js';

window.Aqua = window.Aqua || {};

Aqua.Labels = (function () {
  const labels = [];
  const labelsById = new Map();

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

  function add(id, text, x, y, z, sub) {
    const scene = Aqua.Three.getSystemRoot();
    const obj = new CSS2DObject(makeLabel(text, sub));
    obj.position.set(x, y, z);
    obj.visible = false;
    scene.add(obj);
    labels.push(obj);
    if (id) labelsById.set(id, obj);
    return obj;
  }

  function hideAll() {
    labels.forEach((label) => { label.visible = false; });
  }

  function showOnly(id) {
    hideAll();
    const label = labelsById.get(id);
    if (label) label.visible = true;
  }

  function setVisible(visible) {
    if (!visible) hideAll();
    // No mostramos todas las etiquetas: la nueva UX exige selección individual.
  }

  function init() {
    const ft = LAYOUT.fishTank;
    const mf = LAYOUT.mechanicalFilter;
    const bf = LAYOUT.biofilter;
    const gb = LAYOUT.growBed;
    const pbr = LAYOUT.photobioreactor;
    const co2 = LAYOUT.co2Pump;
    const sump = LAYOUT.sump;

    add('fishTank', 'TANQUE DE PECES', ft.center.x, ft.size.h + 0.35, ft.center.z, 'peces · desechos');
    add('mechanicalFilter', 'FILTRO MECÁNICO', mf.center.x, mf.height + 0.35, mf.center.z, 'retiene sólidos');
    add('biofilter', 'BIOFILTRO', bf.center.x, bf.height + 0.35, bf.center.z, 'NH₃ → NO₂⁻ → NO₃⁻');
    add('growBeds', 'ÁREA DE CRECIMIENTO', (gb.xStart + gb.xEnd) / 2, gb.tubeY + 0.55, gb.zRows[0] + 0.2, 'hortalizas');
    add('photobioreactor', 'FOTOBIORREACTOR', pbr.center.x, pbr.baseHeight + pbr.height + 0.4, pbr.center.z, 'microalgas');
    add('co2Pump', 'BOMBA CO₂', co2.center.x, co2.size.h + 0.3, co2.center.z);
    add('sump', 'BOMBA / DEPÓSITO', sump.center.x, sump.size.h + 0.35, sump.center.z, 'circulación');
    hideAll();
  }

  return { init, add, hideAll, showOnly, setVisible };
})();
