registerServiceWorker();

const atletaId = getQueryParam('id');
let _sessioniAtleta = [];
let _tutteSessioni = [];
let radarChartAttuale = null;
let giornateDisponibili = [];
let _atleti = [];
const _sessioniCache = new Map();
let _sessioniB = [];
function sessioniPer(lettera) { return lettera === 'b' ? _sessioniB : _sessioniAtleta; }
function atletaPer(lettera) { const id = qs('#radar-player-' + lettera).value; return _atleti.find(a => String(a.id) === id); }
function nomePer(lettera) { const a = atletaPer(lettera) || (lettera === 'b' ? atletaPer('a') : null); return a ? nomeCompleto(a) : 'Giocatore'; }

function giornateConTest(sessioni) {
  const dates = new Set();
  for (const s of sessioni) {
    const data = String(s.data || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) &&
      Object.keys(TEST_RADAR_CONFIG).includes(radarChiaveTestSessione(s))) dates.add(data);
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}

function sessioniDellaGiornata(data, lettera = 'a') {
  if (!data) return [];
  return sessioniPer(lettera).filter(s => String(s.data || '').slice(0, 10) === data);
}

function riempiGiornata(lettera, keep = true) {
  const select = qs('#radar-day-' + lettera);
  const old = keep ? select.value : '';
  const dates = giornateConTest(sessioniPer(lettera));
  select.replaceChildren(el('option', { value: '', text: lettera === 'a' ? 'Seleziona giornata…' : 'Nessuna giornata (solo A)' }));
  dates.forEach(data => {
    const n = sessioniDellaGiornata(data, lettera).length;
    select.appendChild(el('option', { value: data, text: formatDataIt(data) + ' · ' + n + ' test' }));
  });
  const stesso = !qs('#radar-player-b').value;
  select.value = old && dates.includes(old) ? old : (
    lettera === 'a' ? dates[0] || '' : stesso ? '' : dates[0] || ''
  );
  return dates;
}
function riempiGiornate() {
  giornateDisponibili = riempiGiornata('a', false);
  riempiGiornata('b', false);
}
async function cambiaGiocatore(lettera) {
  const id = qs('#radar-player-' + lettera).value || qs('#radar-player-a').value;
  if (!_sessioniCache.has(id)) {
    const sessioni = await dbGetSessioniByAtleta(id);
    _sessioniCache.set(id, sessioni.filter(s => isSessioneTest(s) && sessioneHaRisultatiVisibili(s)));
  }
  if (lettera === 'a') {
    _sessioniAtleta = _sessioniCache.get(id);
    // Il secondo selettore vuoto confronta due giornate dello stesso atleta.
    if (!qs('#radar-player-b').value) _sessioniB = _sessioniAtleta;
    riempiGiornata('a', false);
    if (!qs('#radar-player-b').value) riempiGiornata('b', false);
  } else {
    _sessioniB = _sessioniCache.get(id);
    riempiGiornata('b', false);
  }
  costruisciRadar();
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
  const sessioniB = sessioniDellaGiornata(giornoB, 'b');
  const stato = qs('#radar-date-status');
  if (!giornateConTest(_sessioniAtleta).length) {
    stato.textContent = 'Nessuna giornata con test validi disponibile.';
    container.appendChild(el('div', { class: 'empty-state', text: 'Non ci sono test disponibili per costruire il radar.' }));
    return;
  }
  if (!giornoA) {
    stato.textContent = 'Seleziona almeno la prima giornata per visualizzare il radar.';
    return;
  }
  if (giornoB && giornoA === giornoB && qs('#radar-player-a').value === (qs('#radar-player-b').value || qs('#radar-player-a').value)) {
    stato.textContent = 'Scegli due giornate diverse per un confronto significativo.';
    return;
  }
  const radarA = radarDatiSintesi(sessioniA, _tutteSessioni);
  const radarB = radarDatiSintesi(sessioniB, _tutteSessioni);
  // Solo i test realmente eseguiti in almeno una giornata selezionata.
  // Nessun punteggio fittizio per i test mancanti.
  const keys = TEST_STANDARD_KEYS.filter(key =>
    radarA.righe.some(r => r.key === key) || (giornoB && radarB.righe.some(r => r.key === key))
  );
  stato.textContent = nomePer('a') + ' · ' + formatDataIt(giornoA) + ': ' + sessioniA.length + ' test' +
    (giornoB ? ' · ' + nomePer('b') + ' · ' + formatDataIt(giornoB) + ': ' + sessioniB.length + ' test' : '') +
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
    { label: nomePer('a') + ' · ' + formatDataIt(giornoA), data: valori(radarA) },
    ...(giornoB ? [{ label: nomePer('b') + ' · ' + formatDataIt(giornoB), data: valori(radarB) }] : []),
  ], null);
  const colors = [
    ['#2474ba', 'rgba(36,116,186,.16)'],
    ['#16a085', 'rgba(22,160,133,.16)'],
  ];
  cfg.data.datasets.forEach((dataset, i) => {
    dataset.borderColor = colors[i][0];
    dataset.pointBackgroundColor = colors[i][0];
    dataset.backgroundColor = colors[i][1];
    // Collega i risultati disponibili saltando gli assi senza test.
    // I dati mancanti restano null: non vengono convertiti in 0.
    dataset.spanGaps = true;
    dataset.fill = dataset.data.filter(Number.isFinite).length >= 3 ? 'origin' : false;
  });
  const countA = valori(radarA).filter(Number.isFinite).length;
  const countB = giornoB ? valori(radarB).filter(Number.isFinite).length : 0;
  if (countA < 3 || (giornoB && countB < 3)) {
    container.appendChild(el('p', { class: 'meta', text: 'Per formare un poligono servono almeno tre test con punteggio per giornata. Con uno o due risultati vedrai solo i punti o una linea.' }));
  }
  radarChartAttuale = renderChart(canvas, cfg);

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

  const [tutte, sessioni, atleti] = await Promise.all([dbGetAllSessioni(), dbGetSessioniByAtleta(atletaId), dbGetAtleti()]);
  _atleti = atleti;
  _sessioniAtleta = sessioni.filter(s => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  _sessioniCache.set(atletaId, _sessioniAtleta);
  _sessioniB = _sessioniAtleta;
  _tutteSessioni = tutte.filter(s => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  for (const lettera of ['a', 'b']) {
    const select = qs('#radar-player-' + lettera);
    select.replaceChildren(el('option', { value: '', text: lettera === 'b' ? 'Stesso giocatore A' : 'Seleziona giocatore…' }));
    _atleti.forEach(a => select.appendChild(el('option', { value: String(a.id), text: nomeCompleto(a) })));
  }
  qs('#radar-player-a').value = atletaId;
  qs('#radar-player-a').addEventListener('change', () => { if (qs('#radar-player-a').value) cambiaGiocatore('a').catch(mostraErrorePagina); });
  qs('#radar-player-b').addEventListener('change', () => cambiaGiocatore('b').catch(mostraErrorePagina));
  riempiGiornate();
  qs('#radar-day-a').addEventListener('change', costruisciRadar);
  qs('#radar-day-b').addEventListener('change', costruisciRadar);
  qs('#radar-reset-date').addEventListener('click', () => {
    qs('#radar-player-a').value = atletaId;
    qs('#radar-player-b').value = '';
    _sessioniAtleta = _sessioniCache.get(atletaId);
    _sessioniB = _sessioniAtleta;
    riempiGiornate();
    costruisciRadar();
  });
  costruisciRadar();
  onThemeChange(costruisciRadar);
}
init().catch(mostraErrorePagina);
