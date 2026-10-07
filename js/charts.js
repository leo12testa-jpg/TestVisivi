/*
 * Helper per Chart.js: raggruppamento automatico dei campi di un esercizio
 * nello stesso grafico quando condividono l'unita' di misura (mai doppio
 * asse Y), palette categorica fissa letta dalle custom properties CSS
 * (cosi' il tema chiaro/scuro e' gestito in un unico posto: style.css).
 */

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
}

const SERIES_VARS = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartPalette() {
  return SERIES_VARS.map(cssVar);
}

function chartChrome() {
  return {
    text: cssVar('--chart-text-primary'),
    muted: cssVar('--chart-muted'),
    grid: cssVar('--chart-grid'),
  };
}

/**
 * Un "gruppo grafico" per esercizio: campi numerici che condividono la
 * stessa unit vengono raggruppati insieme; unit diverse -> gruppi separati.
 * Per esercizi con sottoCondizioni (es. VVS) viene generato un set di
 * gruppi per ciascuna sottoCondizione.
 */
function getChartGroups(esercizio) {
  if (esercizio.custom) return [];
  const condizioni = esercizio.sottoCondizioni || [null];
  const numerici = campiEsercizioVisibili(esercizio).filter((c) => c.tipo === 'number');
  const groups = [];
  condizioni.forEach((cond) => {
    const byUnit = new Map();
    numerici.forEach((c) => {
      if (!byUnit.has(c.unit)) byUnit.set(c.unit, []);
      byUnit.get(c.unit).push(c);
    });
    byUnit.forEach((campi, unit) => {
      groups.push({
        id: `${esercizio.key}__${cond ? cond.key : 'base'}__${unit}`,
        esercizioKey: esercizio.key,
        sottoCondizione: cond,
        unit,
        unitLabel: UNITA_LABEL[unit] || '',
        campi,
      });
    });
  });
  return groups;
}

function getValoreCampoGruppo(sessione, group, campo) {
  const dati = sessione.esercizi && sessione.esercizi[group.esercizioKey];
  if (!dati) return null;
  const scope = group.sottoCondizione ? dati[group.sottoCondizione.key] : dati;
  if (!scope) return null;
  const v = scope[campo.key];
  if (v === undefined || v === null || v === '' || !valoreCampoValido(campo, v)) return null;
  const n = jetNumero(v);
  if (n === null) return null;
  return campo.unit === 'ms' ? n / 1000 : n;
}

function formatChartValue(value, unitLabel = '') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const abs = Math.abs(n);
  const maxFractionDigits = Number.isInteger(n) ? 0 : (abs < 1 ? 3 : abs < 10 ? 2 : 1);
  const text = n.toLocaleString('it-IT', { maximumFractionDigits: maxFractionDigits });
  return unitLabel ? text + ' ' + unitLabel : text;
}

/** Sessioni (gia' ordinate per data) che hanno almeno un valore per il gruppo dato. */
function sessioniConGruppo(sessioni, group) {
  return sessioni.filter((s) => group.campi.some((c) => getValoreCampoGruppo(s, group, c) !== null));
}

function lineChartConfig(labels, datasetsRaw, unitLabel) {
  const palette = chartPalette();
  const chrome = chartChrome();
  const datasets = datasetsRaw.map((d, i) => ({
    label: d.label,
    data: d.data,
    borderColor: palette[i % palette.length],
    backgroundColor: palette[i % palette.length],
    borderWidth: 3,
    pointRadius: 4.5,
    pointHoverRadius: 7,
    pointHitRadius: 14,
    pointBorderWidth: 1.5,
    spanGaps: false,
    tension: 0.18,
    fill: false,
  }));
  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      normalized: true,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'bottom',
          labels: { color: chrome.text, usePointStyle: true, boxWidth: 9, padding: 16 },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => ctx.dataset.label + ': ' + formatChartValue(ctx.parsed.y, unitLabel),
          },
        },
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: {
          ticks: { color: chrome.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
          grid: { display: false },
          border: { color: chrome.grid },
        },
        y: {
          grace: '12%',
          ticks: {
            color: chrome.muted,
            maxTicksLimit: 6,
            callback: (value) => formatChartValue(value),
          },
          grid: { color: chrome.grid },
          border: { display: false },
          title: { display: !!unitLabel, text: unitLabel, color: chrome.muted, font: { weight: '600' } },
        },
      },
    },
  };
}

function buildGroupChartConfig(sessioniFiltrate, group) {
  const labels = sessioniFiltrate.map((s) => formatDataIt(s.data));
  const datasets = group.campi.map((campo) => ({
    label: campo.label,
    data: sessioniFiltrate.map((s) => getValoreCampoGruppo(s, group, campo)),
  }));
  return lineChartConfig(labels, datasets, group.unitLabel);
}

function buildBarChartConfig(labels, valori, unitLabel) {
  const palette = chartPalette();
  const chrome = chartChrome();
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: unitLabel || 'valore', data: valori, backgroundColor: palette[0], borderRadius: 4, maxBarThickness: 40 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { ticks: { color: chrome.muted }, grid: { display: false } },
        y: {
          ticks: { color: chrome.muted },
          grid: { color: chrome.grid },
          title: { display: !!unitLabel, text: unitLabel, color: chrome.muted },
        },
      },
    },
  };
}

/**
 * Radar chart 0-100: un asse per categoria, uno o due dataset (Periodo A / B).
 * tooltipTestNames: array parallelo a labels, con l'elenco dei nomi dei test associati
 * a ciascuna categoria (mostrato in fondo al tooltip quando si passa/clicca su un asse).
 */
function radarChartConfig(labels, datasetsRaw, tooltipTestNames) {
  const palette = chartPalette();
  const chrome = chartChrome();
  const datasets = datasetsRaw.map((d, i) => {
    const colore = palette[i % palette.length];
    return {
      label: d.label,
      data: d.data,
      borderColor: colore,
      backgroundColor: `${colore}33`,
      pointBackgroundColor: colore,
      borderWidth: 2,
      pointRadius: 4,
    };
  });
  return {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: datasets.length > 1, labels: { color: chrome.text, usePointStyle: true } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: tooltipTestNames
            ? {
                footer: (items) => {
                  const nomi = items.length ? tooltipTestNames[items[0].dataIndex] : null;
                  return nomi && nomi.length ? ['Test associati:', ...nomi.map((n) => `• ${n}`)] : '';
                },
              }
            : undefined,
        },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          angleLines: { color: chrome.grid },
          grid: { color: chrome.grid },
          pointLabels: {
            color: chrome.text,
            font: { size: 11 },
            callback: (label) => {
              const parole = String(label || '').split(/\s+/);
              const righe = [];
              let corrente = '';
              parole.forEach((parola) => {
                const prova = corrente ? corrente + ' ' + parola : parola;
                if (prova.length > 18 && corrente) {
                  righe.push(corrente);
                  corrente = parola;
                } else {
                  corrente = prova;
                }
              });
              if (corrente) righe.push(corrente);
              return righe;
            },
          },
          ticks: { color: chrome.muted, backdropColor: 'transparent', stepSize: 25 },
        },
      },
    },
  };
}

const _chartInstances = new WeakMap();

function renderChart(canvas, config) {
  const existing = _chartInstances.get(canvas);
  if (existing) existing.destroy();
  const instance = new Chart(canvas, config);
  _chartInstances.set(canvas, instance);
  return instance;
}

function titoloGruppo(group) {
  const campiTxt = group.campi.map((c) => c.label).join(' / ');
  return group.sottoCondizione ? `${group.sottoCondizione.label} — ${campiTxt}` : campiTxt;
}

function onThemeChange(cb) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', cb);
}
