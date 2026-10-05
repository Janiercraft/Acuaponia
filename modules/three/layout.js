/* Layout paramétrico generado desde window.AquaModelConfig. */
export const CONFIG = window.AquaModelConfig || {};
const c = CONFIG;
const fishW = Number(c.tankWidth) || 2.3, fishH = Number(c.tankHeight) || 2.0, fishD = Number(c.tankLength) || 2.3;
const fishLeft = -7.0;
const fishX = fishLeft + fishW / 2;
const filterX = fishX + fishW / 2 + 1.45;
const bioX = filterX + 1.9;
const growStart = bioX + 1.65;
const rows = Math.max(1, Math.round(Number(c.plantRows) || 3));
const plantCount = Math.max(1, Math.round(Number(c.plantCount) || 18));
const holesPerRow = Math.ceil(plantCount / rows);
const requestedGrowLength = Number(c.growLength) || 4.2;
const autoGrowLength = 0.52 * holesPerRow + 0.55;
const growLength = c.adaptiveLayout === false ? requestedGrowLength : Math.max(requestedGrowLength, autoGrowLength);
const zRows = Array.from({length: rows}, (_, i) => -0.15 - i * Math.max(0.52, (Number(c.growWidth)||0.44) * 1.45));
const pbrW = Number(c.pbrWidth) || 1.0, pbrD = Number(c.pbrLength) || 1.0, pbrH = Number(c.pbrHeight) || 2.0;
const pbrBaseDiameter = Math.min(pbrW, pbrD);
const pbrX = growStart + growLength + 1.35 + pbrW / 2;
// La bomba de aire/CO2 escala con el tamaño tridimensional del PBR.
// La raíz cúbica evita que crezca de forma exagerada si sólo una dimensión es grande.
const pbrRelativeVolume = Math.max(0.05, (pbrW * pbrD * pbrH) / 2.0);
const co2Scale = Math.min(2.8, Math.max(0.75, Math.cbrt(pbrRelativeVolume)));
const co2Size = { w: 0.55 * co2Scale, h: 0.60 * co2Scale, d: 0.50 * co2Scale };
const CO2_PBR_GAP = 0.32 + 0.08 * co2Scale;
const co2X = pbrX + pbrW / 2 + CO2_PBR_GAP + co2Size.w / 2;
// Separación visual entre el fotobiorreactor y la bomba/depósito.
// Se calcula desde los bordes físicos para que siga funcionando si cambia el ancho del PBR.
const sumpW = 1.5;
const PBR_SUMP_GAP = 1.35;
const sumpX = pbrX + pbrW / 2 + PBR_SUMP_GAP + sumpW / 2;
export const FLOOR_SIZE = { width: Math.max(16, Math.max(co2X + co2Size.w / 2, sumpX + sumpW / 2) - fishLeft + 2.2), depth: Math.max(11, rows * 0.7 + 7) };
export const LAYOUT = {
  fishTank: { center: { x: fishX, y: 0, z: 1.7 }, size: { w: fishW, h: fishH, d: fishD } },
  mechanicalFilter: { center: { x: filterX, y: 0, z: 2.1 }, radius: 0.55, height: 1.8 },
  biofilter: { center: { x: bioX, y: 0, z: 1.7 }, radius: 0.55, height: 1.8 },
  growBed: { xStart: growStart, xEnd: growStart + growLength, zRows, tubeRadius: (Number(c.growWidth)||0.44)/2, tubeY: Number(c.growHeight)||1.55, holesPerRow, plantCount },
  photobioreactor: { center: { x: pbrX, y: 0, z: -1.1 }, radius: pbrBaseDiameter/2, width:pbrW, depth:pbrD, scaleX:pbrW/pbrBaseDiameter, scaleZ:pbrD/pbrBaseDiameter, height:pbrH, baseHeight: Math.max(.12, pbrH*.09) },
  co2Pump: { center: { x: co2X, y: 0, z: -1.1 }, size: co2Size },
  sump: { center: { x: sumpX, y: 0, z: 2.2 }, size: { w: sumpW, h: 1.5, d: 1.5 } },
};
export function computePorts() {
  const ft=LAYOUT.fishTank,mf=LAYOUT.mechanicalFilter,bf=LAYOUT.biofilter,gb=LAYOUT.growBed,pbr=LAYOUT.photobioreactor,sump=LAYOUT.sump;
  return {
    fishOutlet:{x:ft.center.x,y:ft.center.y+0.06,z:ft.center.z},
    fishInlet:{x:ft.center.x,y:ft.center.y+ft.size.h*.75,z:ft.center.z-ft.size.d/2},
    filterIn:{x:mf.center.x-mf.radius,y:mf.center.y+mf.height*.55,z:mf.center.z}, filterOut:{x:mf.center.x+mf.radius,y:mf.center.y+mf.height*.55,z:mf.center.z},
    bioIn:{x:bf.center.x-bf.radius,y:bf.center.y+bf.height*.55,z:bf.center.z}, bioOut:{x:bf.center.x+bf.radius,y:bf.center.y+bf.height*.55,z:bf.center.z},
    bifurcation:{x:bf.center.x+bf.radius+.6,y:bf.height*.55,z:bf.center.z},
    growBedIn:{x:gb.xStart,y:gb.tubeY,z:gb.zRows[Math.floor(gb.zRows.length/2)]}, growBedOut:{x:gb.xEnd,y:gb.tubeY,z:gb.zRows[Math.floor(gb.zRows.length/2)]},
    // puertos del PBR desplazados hacia los lados frontales para que las
    // tuberías externas no crucen visualmente el reactor al conectar.
    pbrIn:{x:pbr.center.x - pbr.width * 0.22,y:pbr.baseHeight+pbr.height*.82,z:pbr.center.z-pbr.depth/2},
    pbrOut:{x:pbr.center.x + pbr.width * 0.22,y:pbr.baseHeight+.12,z:pbr.center.z-pbr.depth/2},
    converge:{x:sump.center.x-sump.size.w/2-.6,y:sump.center.y+sump.size.h*.55,z:sump.center.z},
    sumpIn:{x:sump.center.x-sump.size.w/2,y:sump.center.y+sump.size.h*.55,z:sump.center.z}, sumpOut:{x:sump.center.x,y:sump.center.y+sump.size.h+.05,z:sump.center.z},
    co2PumpTop:{x:LAYOUT.co2Pump.center.x,y:LAYOUT.co2Pump.size.h,z:LAYOUT.co2Pump.center.z}, diffuser:{x:pbr.center.x,y:pbr.baseHeight+.1,z:pbr.center.z}
  };
}
