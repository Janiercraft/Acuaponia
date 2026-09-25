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

export const FLOOR_SIZE = { width: 16, depth: 11 };

export const LAYOUT = {
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
export function computePorts() {
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
