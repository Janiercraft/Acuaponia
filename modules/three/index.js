/* =========================================================================
   modules/three/index.js
   Punto de entrada único: importa todos los submódulos de la escena 3D.
   index.html sólo necesita un <script type="module" src="modules/three/
   index.js">; el propio ES module system resuelve el grafo de
   dependencias (cada archivo importa lo que necesita de los demás).
   Cada submódulo, al ejecutarse, se registra en window.Aqua.<Nombre> —
   la llamada real a cada init() la hace app.js dentro de su
   DOMContentLoaded, exactamente igual que antes con los módulos SVG.
   ========================================================================= */

import './core.js';
import './materials.js';
import './layout.js';
import './environment.js';
import './labels.js';
import './pipes.js';
import './fishTank.js';
import './fish.js';
import './mechanicalFilter.js';
import './biofilter.js';
import './growBeds.js';
import './sump.js';
import './photobioreactor.js';
import './co2System.js';
import './particles.js';

// Todos los imports de arriba son síncronos en su ejecución de nivel
// superior (sólo definen window.Aqua.<Nombre>, no llaman a ningún init()
// todavía), así que en el momento en que esta línea se ejecuta, TODOS los
// módulos ya rellenaron su espacio de nombres. Avisamos con un evento
// explícito en vez de que app.js tenga que ASUMIR el orden entre un
// script clásico y uno type="module" — ver la espera correspondiente en
// app.js (aguarda tanto DOMContentLoaded como este evento, lo que llegue
// último, así no importa cuál gane la carrera en cada navegador).
console.log('[AQUA 3D] Todos los módulos de modules/three/ se cargaron correctamente');
window.dispatchEvent(new CustomEvent('aqua-three-ready'));

