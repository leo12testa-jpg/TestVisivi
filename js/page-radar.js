registerServiceWorker();

const atletaId = getQueryParam('id');
let _statsGlobali = null;
let _sessioniAtleta = [];

/** Valori grezzi di un campo su un insieme di sessioni, gestendo le sottoCondizioni (VVS) per somma/pool. */
function valoriGrezziCampo(sessioni, esercizioKey, campoKey) {
  const esercizio = getEsercizioConfig(esercizioKey);
  const valori = [];
  sessioni.forEach((s) => {
    const dati = s.esercizi && s.esercizi[esercizioKey];
    if (!dati) return;
    if (esercizio.sottoCondizioni) {
      esercizio.sottoCondizioni.forEach((sc) => {
        const scDati = dati[sc.key];
        if (!scDati) return;
        const v = scDati[campoKey];
        const campo = esercizio.campi.find((x) => x.key === campoKey);
        if (campo && valoreCampoValido(campo, v)) valori.push(Number(v));
      });
    } else {
      const v = dati[campoKey];
      const campo = esercizio.campi.find((x) => x.key === campoKey);
      if (campo && valoreCampoValido(campo, v)) valori.push(Number(v));
    }
  });
  return valori;
}

/** Min/max globali (su tutte le sessioni di tutti gli atleti) per ogni campo usato dalle categorie. */
function calcolaStatisticheGlobali(tutteSessioni) {
  const stats = new Map();
  CATEGORIE_RADAR.forEach((cat) => {
    cat.campi.forEach((c) => {
      const chiave = `${c.esercizio}::${c.campo}`;
      if (stats.has(chiave)) return;
      let valori = valoriGrezziCampo(tutteSessioni, c.esercizio, c.campo);
      if (c.assoluto) valori = valori.map(Math.abs);
      stats.set(chiave, valori.length === 0 ? null : { min: Math.min(...valori), max: Math.max(...valori) });
    });
  });
  return stats;
}

function normalizza(valore, stat, direzione) {
  if (!stat) return null;
  if (stat.max === stat.min) return 50;
  const frac = direzione === 'alto' ? (valore - stat.min) / (stat.max - stat.min) : (stat.max - valore) / (stat.max - stat.min);
  return Math.max(0, Math.min(100, frac * 100));
}

function filtraPerPeriodo(sessioni, da, a) {
  return sessioni.filter((s) => (!da || s.data >= da) && (!a || s.data <= a));
}

/** Punteggio 0-100 di una categoria: media piatta di tutti i valori normalizzati di tutti i suoi campi. */
function calcolaCategoria(categoria, sessioniPeriodo) {
  const normalizzati = [];
  categoria.campi.forEach((c) => {
    const stat = _statsGlobali.get(`${c.esercizio}::${c.campo}`);
    if (!stat) return;
    let valori = valoriGrezziCampo(sessioniPeriodo, c.esercizio, c.campo);
    if (c.assoluto) valori = valori.map(Math.abs);
    valori.forEach((v) => {
      const n = normalizza(v, stat, c.direzione);
      if (n !== null) normalizzati.push(n);
    });
  });
  return normalizzati.length === 0 ? null : normalizzati.reduce((s, v) => s + v, 0) / normalizzati.length;
}

function leggiPeriodo(prefix, sempreAttivo) {
  const da = qs(`#${prefix}-da`).value;
  const a = qs(`#${prefix}-a`).value;
  return { da, a, attivo: sempreAttivo || !!da || !!a };
}

function costruisciContenuto() {
  const container = qs('#contenuto-radar');
  container.innerHTML = '';
  const canvas = el('canvas', { id: 'radar-canvas' });
  container.appendChild(
    el('div', { class: 'chart-block' }, [el('div', { class: 'chart-canvas-wrap', style: 'height:340px;' }, [canvas])])
  );
  container.appendChild(el('div', { id: 'tabella-radar' }));
}

function renderRadar(punteggiA, punteggiB, indiciAttivi) {
  const categorie = indiciAttivi.map((i) => CATEGORIE_RADAR[i]);
  const labels = categorie.map((c) => c.nome);
  const tooltipTestNames = categorie.map((cat) => getTestNamesForCategoria(cat));
  const arrotonda = (v) => (v === null ? null : Math.round(v * 10) / 10);
  const datasets = [{ label: 'Periodo A', data: indiciAttivi.map((i) => arrotonda(punteggiA[i])) }];
  if (punteggiB) datasets.push({ label: 'Periodo B', data: indiciAttivi.map((i) => arrotonda(punteggiB[i])) });
  renderChart(qs('#radar-canvas'), radarChartConfig(labels, datasets, tooltipTestNames));
}

function renderTabella(punteggiA, punteggiB, indiciAttivi) {
  const headers = ['Categoria', 'Test associati', 'Periodo A', ...(punteggiB ? ['Periodo B'] : [])];
  const formatta = (v) => (v === null ? '—' : v.toFixed(1));
  const table = el('table', {}, [
    el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { text: h })))]),
    el(
      'tbody',
      {},
      indiciAttivi.map((i) => {
        const cat = CATEGORIE_RADAR[i];
        return el('tr', {}, [
          el('td', { text: cat.nome }),
          el('td', { class: 'radar-test-cell' }, [
            el('ul', { class: 'radar-test-list' }, getTestNamesForCategoria(cat).map((nome) => el('li', { text: nome }))),
          ]),
          el('td', { text: formatta(punteggiA[i]) }),
          ...(punteggiB ? [el('td', { text: formatta(punteggiB[i]) })] : []),
        ]);
      })
    ),
  ]);
  qs('#tabella-radar').innerHTML = '';
  qs('#tabella-radar').appendChild(el('div', { class: 'table-scroll' }, [table]));
}

function calcola() {
  if (_sessioniAtleta.length === 0) return;

  const periodoA = leggiPeriodo('periodo-a', true);
  const sessioniA = filtraPerPeriodo(_sessioniAtleta, periodoA.da, periodoA.a);
  const punteggiA = CATEGORIE_RADAR.map((cat) => calcolaCategoria(cat, sessioniA));

  const periodoB = leggiPeriodo('periodo-b', false);
  let punteggiB = null;
  if (periodoB.attivo) {
    const sessioniB = filtraPerPeriodo(_sessioniAtleta, periodoB.da, periodoB.a);
    punteggiB = CATEGORIE_RADAR.map((cat) => calcolaCategoria(cat, sessioniB));
  }

  const indiciAttivi = CATEGORIE_RADAR
    .map((_, i) => i)
    .filter((i) => punteggiA[i] !== null || (punteggiB && punteggiB[i] !== null));

  if (!indiciAttivi.length) {
    const container = qs('#contenuto-radar');
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessun valore reale disponibile nel periodo selezionato.' }));
    return;
  }

  costruisciContenuto();
  renderRadar(punteggiA, punteggiB, indiciAttivi);
  renderTabella(punteggiA, punteggiB, indiciAttivi);
}

qs('#periodo-a-da').addEventListener('change', calcola);
qs('#periodo-a-a').addEventListener('change', calcola);
qs('#periodo-b-da').addEventListener('change', calcola);
qs('#periodo-b-a').addEventListener('change', calcola);

async function init() {
  const user = await richiedeLogin();
  if (!user) return;

  const atleta = await dbGetAtleta(atletaId);
  if (!atleta) {
    window.location.href = './index.html';
    return;
  }
  qs('#back-link').href = `./atleta.html?id=${atletaId}`;
  qs('#titolo-pagina').textContent = `Radar — ${nomeCompleto(atleta)}`;
  document.title = `Radar ${nomeCompleto(atleta)} - Test Visivi`;

  const [tutteSessioni, sessioniAtleta] = await Promise.all([dbGetAllSessioni(), dbGetSessioniByAtleta(atletaId)]);
  _sessioniAtleta = sessioniAtleta.filter((s) => !isSessioneTraining(s) && sessioneHaRisultatiVisibili(s));
  _statsGlobali = calcolaStatisticheGlobali(tutteSessioni.filter((s) => !isSessioneTraining(s) && sessioneHaRisultatiVisibili(s)));

  if (_sessioniAtleta.length === 0) {
    qs('#contenuto-radar').appendChild(el('div', { class: 'empty-state', text: 'Nessun risultato reale disponibile per questo atleta.' }));
    return;
  }

  calcola();
  onThemeChange(calcola);
}

init();
