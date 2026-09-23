/* =========================================================================
   modules/monitoring.js
   Construye y actualiza la vista de "Monitoreo": tarjetas de parámetros
   con minigráficas de tendencia, estado de componentes y tira/registro
   de alertas. No calcula los valores (eso vive en app.js, que es quien
   mantiene el estado); este módulo sólo pinta lo que recibe.
   ========================================================================= */

window.Aqua = window.Aqua || {};

Aqua.Monitoring = (function () {

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const SENSOR_META = [
    { key: 'temperature', label: 'Temperatura', unit: '°C', decimals: 1 },
    { key: 'ph', label: 'pH', unit: '', decimals: 2 },
    { key: 'ammonia', label: 'Amoníaco', unit: 'ppm', decimals: 2 },
    { key: 'nitrite', label: 'Nitrito', unit: 'ppm', decimals: 2 },
    { key: 'nitrate', label: 'Nitrato', unit: 'ppm', decimals: 0 },
    { key: 'oxygen', label: 'Oxígeno', unit: 'mg/L', decimals: 1 },
  ];

  function buildParamGrid(gridSelector) {
    const grid = document.querySelector(gridSelector);
    if (!grid) return;
    grid.innerHTML = '';

    SENSOR_META.forEach((meta) => {
      const card = document.createElement('div');
      card.className = 'param-card';
      card.id = 'paramCard-' + meta.key;

      card.innerHTML = `
        <div class="param-card-head">
          <span class="param-name">${meta.label}</span>
          <span class="param-trend flat" id="paramTrend-${meta.key}">→</span>
        </div>
        <div>
          <span class="param-value" id="paramValue-${meta.key}">--</span>
          <span class="param-unit">${meta.unit}</span>
        </div>
        <svg class="spark" viewBox="0 0 120 34" preserveAspectRatio="none">
          <polyline class="spark-line" id="paramSpark-${meta.key}" points=""></polyline>
        </svg>
      `;
      grid.appendChild(card);
    });
  }

  function sparkPoints(history) {
    if (!history || history.length < 2) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = (max - min) || 1;
    const stepX = 120 / (history.length - 1);
    return history
      .map((v, i) => {
        const x = (i * stepX).toFixed(1);
        const y = (30 - ((v - min) / span) * 26).toFixed(1); // margen de 4px arriba/abajo
        return `${x},${y}`;
      })
      .join(' ');
  }

  /**
   * Actualiza las tarjetas con los valores actuales, el historial (para la
   * minigráfica) y si el parámetro está en rango de alerta.
   */
  function updateParams(sensors, history, alertKeys) {
    SENSOR_META.forEach((meta) => {
      const valueEl = document.getElementById('paramValue-' + meta.key);
      const trendEl = document.getElementById('paramTrend-' + meta.key);
      const sparkEl = document.getElementById('paramSpark-' + meta.key);
      const cardEl = document.getElementById('paramCard-' + meta.key);
      if (!valueEl) return;

      const value = sensors[meta.key];
      valueEl.textContent = value.toFixed(meta.decimals);

      const hist = history[meta.key] || [];
      const prev = hist.length > 1 ? hist[hist.length - 2] : value;
      const delta = value - prev;
      trendEl.textContent = delta > 0.01 ? '↑' : (delta < -0.01 ? '↓' : '→');
      trendEl.className = 'param-trend ' + (delta > 0.01 ? 'up' : (delta < -0.01 ? 'down' : 'flat'));

      if (sparkEl) sparkEl.setAttribute('points', sparkPoints(hist));

      const isAlert = alertKeys && alertKeys.has(meta.key);
      valueEl.classList.toggle('alert', !!isAlert);
      if (cardEl) cardEl.classList.toggle('is-alert', !!isAlert);
    });
  }

  function updateStatusList(listSelector, components) {
    const list = document.querySelector(listSelector);
    if (!list) return;
    list.innerHTML = '';
    components.forEach((c) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="status-dot ${c.ok ? 'ok' : 'warn'}"></span> ${c.label} <span style="margin-left:auto;color:${c.ok ? 'var(--ok-green)' : 'var(--alert-red)'}">${c.ok ? 'OK' : 'FALLA'}</span>`;
      list.appendChild(li);
    });
  }

  /**
   * Panel dedicado del fotobiorreactor: a diferencia de updateStatusList
   * (que sólo muestra OK/FALLA), aquí cada fila también trae un valor
   * (porcentaje, ON/OFF, etc.), así que se arma con su propia función en
   * vez de forzarla dentro de la anterior.
   */
  function updatePBRPanel(listSelector, data) {
    const list = document.querySelector(listSelector);
    if (!list) return;
    const rateTxt = (data.growthRatePerMin >= 0 ? '+' : '') + (data.growthRatePerMin || 0).toFixed(1) + ' %/min';
    const rows = [
      { label: 'Estado', value: data.active ? 'ACTIVO' : 'PAUSADO', ok: data.active },
      { label: 'Luz', value: data.light ? 'ON' : 'OFF', ok: data.light },
      { label: 'Flujo', value: Math.round(data.flowPct) + '%', ok: data.flowPct >= 15 || !data.active },
      { label: 'Biomasa de algas', value: Math.round(data.biomass * 100) + '%', ok: true },
      { label: 'Etapa', value: data.stageName || '—', ok: true },
      { label: 'Crecimiento (simulado)', value: rateTxt, ok: true },
      { label: 'Actividad', value: Math.round(data.activity * 100) + '%', ok: data.activity >= 0.25 || !data.active },
    ];
    list.innerHTML = '';
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="status-dot ${r.ok ? 'ok' : 'warn'}"></span> ${r.label} <span style="margin-left:auto;color:${r.ok ? 'var(--text-light)' : 'var(--alert-red)'}">${r.value}</span>`;
      list.appendChild(li);
    });
  }

  function renderAlertBanners(stripSelector, alerts) {
    const strip = document.querySelector(stripSelector);
    if (!strip) return;
    strip.innerHTML = '';
    alerts.forEach((text) => {
      const div = document.createElement('div');
      div.className = 'alert-banner';
      div.textContent = '⚠ ' + text;
      strip.appendChild(div);
    });
  }

  function pushAlertLog(logSelector, entries) {
    const log = document.querySelector(logSelector);
    if (!log) return;
    log.innerHTML = '';
    if (!entries.length) {
      log.innerHTML = '<li class="alert-log-empty">Sin alertas registradas todavía.</li>';
      return;
    }
    entries.slice().reverse().forEach((entry) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="status-dot warn"></span> ${entry.text} <span class="alert-log-time">${entry.time}</span>`;
      log.appendChild(li);
    });
  }

  return { SENSOR_META, buildParamGrid, updateParams, updateStatusList, updatePBRPanel, renderAlertBanners, pushAlertLog };
})();
