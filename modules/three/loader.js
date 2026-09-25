/* Cargador compatible con file:// y http(s)://.
   Evita ES Modules locales (bloqueados por CORS al abrir con doble clic)
   y prueba varios CDN para obtener THREE antes de cargar el bundle 3D local. */
(function () {
  'use strict';
  window.Aqua = window.Aqua || {};

  const sources = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
    'https://unpkg.com/three@0.128.0/build/three.min.js'
  ];

  function showError() {
    console.error('[AQUA 3D] No fue posible cargar Three.js desde ninguno de los CDN configurados.');
    const container = document.querySelector('#three-container');
    if (container && !container.querySelector('.three-fatal-error')) {
      const box = document.createElement('div');
      box.className = 'three-fatal-error';
      box.innerHTML = '<strong>No fue posible cargar la escena 3D.</strong><br>' +
        'Three.js no pudo descargarse. Comprueba tu conexión a internet y vuelve a cargar la página.<br>' +
        'El proyecto ya es compatible con abrir <code>index.html</code> con doble clic.';
      container.appendChild(box);
    }
  }

  function loadBundle() {
    const script = document.createElement('script');
    script.src = 'modules/three/three-classic-bundle.js';
    script.onload = () => console.log('[AQUA 3D] Bundle local cargado');
    script.onerror = () => {
      console.error('[AQUA 3D] No se pudo cargar modules/three/three-classic-bundle.js');
      showError();
    };
    document.head.appendChild(script);
  }

  function trySource(index) {
    if (window.THREE) { loadBundle(); return; }
    if (index >= sources.length) { showError(); return; }
    const script = document.createElement('script');
    script.src = sources[index];
    script.async = true;
    script.onload = () => {
      if (window.THREE) {
        console.log('[AQUA 3D] Three.js cargado desde', sources[index]);
        loadBundle();
      } else {
        trySource(index + 1);
      }
    };
    script.onerror = () => {
      console.warn('[AQUA 3D] Falló CDN:', sources[index]);
      trySource(index + 1);
    };
    document.head.appendChild(script);
  }

  trySource(0);
})();
