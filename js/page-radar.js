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
        if (v !== undefined && v !== null && v !== '') valori.push(Number(v));
      });
    } else {
      const v = dati[campoKey];
      if (v !== undefined && v !== null && v !== '') valori.push(Number(v));
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

function renderRadar(punteggiA, punteggiB) {
  const labels = CATEGORIE_RADAR.map((c) => c.nome);
  const arrotonda = (v) => (v === null ? null : Math.round(v * 10) / 10);
  const datasets = [{ label: 'Periodo A', data: punteggiA.map(arrotonda) }];
  if (punteggiB) datasets.push({ label: 'Periodo B', data: punteggiB.map(arrotonda) });
  renderChart(qs('#radar-canvas'), radarChartConfig(labels, datasets));
}

function renderTabella(punteggiA, punteggiB) {
  const headers = ['Categoria', 'Periodo A', ...(punteggiB ? ['Periodo B'] : [])];
  const formatta = (v) => (v === null ? '—' : v.toFixed(1));
  const table = el('table', {}, [
    el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { text: h })))]),
    el(
      'tbody',
      {},
      CATEGORIE_RADAR.map((cat, i) =>
        el('tr', {}, [
          el('td', { text: cat.nome }),
          el('td', { text: formatta(punteggiA[i]) }),
          ...(punteggiB ? [el('td', { text: formatta(punteggiB[i]) })] : []),
        ])
      )
    ),
  ]);
  qs('#tabella-radar').innerHTML = '';
  qs('#tabella-radar').appendChild(el('div', { class: 'table-scroll' }, [table]));
}

function calcola() {
  if (_sessioniAtleta.length === 0) return;
  costruisciContenuto();

  const periodoA = leggiPeriodo('periodo-a', true);
  const sessioniA = filtraPerPeriodo(_sessioniAtleta, periodoA.da, periodoA.a);
  const punteggiA = CATEGORIE_RADAR.map((cat) => calcolaCategoria(cat, sessioniA));

  const periodoB = leggiPeriodo('periodo-b', false);
  let punteggiB = null;
  if (periodoB.attivo) {
    const sessioniB = filtraPerPeriodo(_sessioniAtleta, periodoB.da, periodoB.a);
    punteggiB = CATEGORIE_RADAR.map((cat) => calcolaCategoria(cat, sessioniB));
  }

  renderRadar(punteggiA, punteggiB);
  renderTabella(punteggiA, punteggiB);
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
  _sessioniAtleta = sessioniAtleta;
  _statsGlobali = calcolaStatisticheGlobali(tutteSessioni);

  if (_sessioniAtleta.length === 0) {
    qs('#contenuto-radar').appendChild(el('div', { class: 'empty-state', text: 'Nessuna sessione registrata per questo atleta: il radar non può essere calcolato.' }));
    return;
  }

  calcola();
  onThemeChange(calcola);
}

init();
