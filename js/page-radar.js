registerServiceWorker();

const atletaId = getQueryParam('id');
let _sessioniAtleta = [];
let _tutteSessioni = [];
let radarChartAttuale = null;
let giornateDisponibili = [];

function giornateConTest() {
  const dates = new Set();
  for (const s of _sessioniAtleta) {
    const data = String(s.data || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) &&
      Object.keys(TEST_RADAR_CONFIG).includes(radarChiaveTestSessione(s))) dates.add(data);
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}

function sessioniDellaGiornata(data) {
  if (!data) return [];
  return _sessioniAtleta.filter(s => String(s.data || '').slice(0, 10) === data);
}

function riempiGiornate() {
  giornateDisponibili = giornateConTest();
  const predefinite = [giornateDisponibili[0] || '', ''];
  ['a', 'b'].forEach((lettera, i) => {
    const select = qs('#radar-day-' + lettera);
    select.replaceChildren(el('option', { value: '', text: 'Seleziona giornata…' }));
    giornateDisponibili.forEach(data => {
      const numero = sessioniDellaGiornata(data).length;
      select.appendChild(el('option', {
        value: data,
        text: formatDataIt(data) + ' · ' + numero + (numero === 1 ? ' test' : ' test')
      }));
    });
    select.value = predefinite[i];
  });
}

function costruisciRadar() {
  const container = qs('#contenuto-radar');
  if (radarChartAttuale) {
    radarChartAttuale.destroy();
    radarChartAttuale = null;
  }
  container.replaceChildren();

  const giornoA = qs('#radar-day-a').value;
  const giornoB = qs('#radar-day-b').value;
  const sessioniA = sessioniDellaGiornata(giornoA);
  const sessioniB = sessioniDellaGiornata(giornoB);
  const stato = qs('#radar-date-status');
  if (!giornateDisponibili.length) {
    stato.textContent = 'Nessuna giornata con test validi disponibile.';
    container.appendChild(el('div', { class: 'empty-state', text: 'Non ci sono test disponibili per costruire il radar.' }));
    return;
  }
  if (!giornoA) {
    stato.textContent = 'Seleziona almeno la prima giornata per visualizzare il radar.';
    return;
  }
  if (giornoB && giornoA === giornoB) {
    stato.textContent = 'Scegli due giornate diverse per un confronto significativo.';
    return;
  }
  const radarA = radarDatiSintesi(sessioniA, _tutteSessioni);
  const radarB = radarDatiSintesi(sessioniB, _tutteSessioni);
  // Solo i test realmente eseguiti in almeno una giornata selezionata.\n  // Nessun punteggio fittizio per i test mancanti.
  const keys = TEST_STANDARD_KEYS.filter(key =>
    radarA.righe.some(r => r.key === key) || (giornoB && radarB.righe.some(r => r.key === key))
  );
  stato.textContent = formatDataIt(giornoA) + ': ' + sessioniA.length + ' test' +
    (giornoB ? ' · ' + formatDataIt(giornoB) + ': ' + sessioniB.length + ' test' : '') +
    '. Punteggi rispetto allo stesso archivio.';
  if (!keys.length) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Le giornate selezionate non contengono risultati sufficienti.' }));
    return;
  }
  const labels = keys.map(key => TEST_STANDARD_LABELS[key] || key);
  const valori = radar => keys.map(key => radar.righe.find(r => r.key === key)?.valore ?? null);
  const canvas = el('canvas', { id: 'radar-canvas' });
  container.appendChild(el('section', { class: 'card radar-simple-card' }, [
    el('div', { class: 'chart-canvas-wrap radar-simple-canvas', style: 'height:490px;' }, [canvas]),
    el('p', { class: 'meta', text: giornoB ? 'Blu = prima giornata, verde = seconda. Punteggi relativi all’archivio. Sono visibili solo i test eseguiti.' : 'Radar della giornata selezionata. Punteggi relativi all’archivio; test non eseguiti senza punteggio.' })
  ]));
  const cfg = radarChartConfig(labels, [
    { label: formatDataIt(giornoA), data: valori(radarA) },
    ...(giornoB ? [{ label: formatDataIt(giornoB), data: valori(radarB) }] : []),
  ], null);
  const colors = [
    ['#2474ba', 'rgba(36,116,186,.16)'],
    ['#16a085', 'rgba(22,160,133,.16)'],
  ];
  cfg.data.datasets.forEach((dataset, i) => {
    dataset.borderColor = colors[i][0];
    dataset.pointBackgroundColor = colors[i][0];
    dataset.backgroundColor = colors[i][1];
    // Collega i risultati disponibili saltando gli assi senza test.\n    // I dati mancanti restano null: non vengono convertiti in 0.\n    dataset.spanGaps = true;\n    dataset.fill = dataset.data.filter(Number.isFinite).length >= 3 ? 'origin' : false;
  });
  const countA = valori(radarA).filter(Number.isFinite).length;\n  const countB = giornoB ? valori(radarB).filter(Number.isFinite).length : 0;\n  if (countA < 3 || (giornoB && countB < 3)) {\n    container.appendChild(el('p', { class: 'meta', text: 'Per formare un poligono servono almeno tre test con punteggio per giornata. Con uno o due risultati vedrai solo i punti o una linea.' }));\n  }\n  radarChartAttuale = renderChart(canvas, cfg);

  container.appendChild(el('section', { class: 'radar-test-summary' },
    keys.map(key => {
      const a = radarA.righe.find(r => r.key === key);
      const b = radarB.righe.find(r => r.key === key);
      return el('article', { class: 'radar-test-summary-item' }, [
        el('strong', { text: TEST_STANDARD_LABELS[key] || key }),
        el('span', { class: 'meta', text: formatDataIt(giornoA) + ': ' +
          (a ? a.valore + '/100' : 'non eseguito') +
          (giornoB ? '  |  ' + formatDataIt(giornoB) + ': ' + (b ? b.valore + '/100' : 'non eseguito') : '') })
      ]);
    })
  ));
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  const atleta = await dbGetAtleta(atletaId);
  if (!atleta) { window.location.href = './index.html'; return; }
  qs('#back-link').href = './atleta.html?id=' + encodeURIComponent(atletaId);
  qs('#titolo-pagina').textContent = 'Radar — ' + nomeCompleto(atleta);
  document.title = 'Radar ' + nomeCompleto(atleta) + ' - Test Visivi';

  const [tutte, sessioni] = await Promise.all([dbGetAllSessioni(), dbGetSessioniByAtleta(atletaId)]);
  _sessioniAtleta = sessioni.filter(s => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  _tutteSessioni = tutte.filter(s => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  riempiGiornate();
  qs('#radar-day-a').addEventListener('change', costruisciRadar);
  qs('#radar-day-b').addEventListener('change', costruisciRadar);
  qs('#radar-reset-date').addEventListener('click', () => { riempiGiornate(); costruisciRadar(); });
  costruisciRadar();
  onThemeChange(costruisciRadar);
}
init().catch(mostraErrorePagina);
