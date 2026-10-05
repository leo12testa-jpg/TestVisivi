registerServiceWorker();

const atletaId = getQueryParam('id');
let _statsGlobali = null;
let _sessioniAtleta = [];

/** Valori grezzi di un campo su un insieme di sessioni, gestendo le sottoCondizioni (VVS) per somma/pool. */
function valoriGrezziCampo(sessioni, esercizioKey, campoKey) {
  const esercizio = getEsercizioConfig(esercizioKey);
  const valori = [];
  if (!esercizio) return valori;
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

function filtraPerAnno(sessioni, anno) {
  if (!anno) return sessioni;
  return sessioni.filter((s) => String(s.data || '').startsWith(anno + '-'));
}

function popolaAnniRadar() {
  const select = qs('#anno-radar');
  const anni = [...new Set(_sessioniAtleta
    .map((s) => String(s.data || '').slice(0, 4))
    .filter((a) => /^\d{4}$/.test(a))
  )].sort((a, b) => b.localeCompare(a));

  select.innerHTML = '';
  anni.forEach((anno) => select.appendChild(el('option', { value: anno, text: anno })));
  if (anni.length) select.value = anni[0];

  const picker = select.closest('.radar-year-picker');
  if (picker) picker.hidden = anni.length <= 1;
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

function costruisciContenuto() {
  const container = qs('#contenuto-radar');
  container.innerHTML = '';
  const canvas = el('canvas', { id: 'radar-canvas' });
  container.appendChild(
    el('div', { class: 'chart-block' }, [el('div', { class: 'chart-canvas-wrap', style: 'height:340px;' }, [canvas])])
  );
  container.appendChild(el('div', { id: 'tabella-radar' }));
  container.appendChild(el('section', { class: 'radar-year-tests' }, [
    el('p', { class: 'eyebrow', text: 'ANDAMENTO ANNUALE' }),
    el('h2', { text: 'Valori dei test nel corso dell’anno' }),
    el('div', { id: 'andamento-test-annuale' }),
  ]));
}

function renderRadar(punteggi, indiciAttivi, anno) {
  const categorie = indiciAttivi.map((i) => CATEGORIE_RADAR[i]);
  const labels = categorie.map((c) => c.nome);
  const tooltipTestNames = categorie.map((cat) => getTestNamesForCategoria(cat));
  const arrotonda = (v) => (v === null ? null : Math.round(v * 10) / 10);
  const datasets = [{
    label: anno ? `Test ${anno}` : 'Test',
    data: indiciAttivi.map((i) => arrotonda(punteggi[i])),
  }];
  renderChart(qs('#radar-canvas'), radarChartConfig(labels, datasets, tooltipTestNames));
}

function renderTabella(punteggi, indiciAttivi) {
  const headers = ['Categoria', 'Test associati', 'Punteggio'];
  const formatta = (v) => (v === null ? '—' : v.toFixed(1));
  const table = el('table', {}, [
    el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { text: h })))]),
    el('tbody', {}, indiciAttivi.map((i) => {
      const cat = CATEGORIE_RADAR[i];
      return el('tr', {}, [
        el('td', { text: cat.nome }),
        el('td', { class: 'radar-test-cell' }, [
          el('ul', { class: 'radar-test-list' }, getTestNamesForCategoria(cat).map((nome) => el('li', { text: nome }))),
        ]),
        el('td', { text: formatta(punteggi[i]) }),
      ]);
    })),
  ]);
  qs('#tabella-radar').innerHTML = '';
  qs('#tabella-radar').appendChild(el('div', { class: 'table-scroll' }, [table]));
}

function renderAndamentoTestAnnuale(sessioniAnno) {
  const container = qs('#andamento-test-annuale');
  if (!container) return;
  container.innerHTML = '';

  let mostrato = false;
  ESERCIZI_CONFIG.forEach((test) => {
    const prove = sessioniAnno.filter((s) => esercizioCompilato(test, s.esercizi?.[test.key]));
    if (!prove.length) return;

    mostrato = true;
    const righe = [...prove].sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))).map((sessione) => {
      const metriche = metricheEsercizioSessione(sessione, test, false);
      return el('div', { class: 'radar-test-date-row' }, [
        el('time', { class: 'session-date', text: formatDataIt(sessione.data) }),
        el('div', { class: 'mini-metrics' }, metriche.map((m) =>
          el('span', { class: 'mini-metric' }, [
            el('span', { class: 'mini-metric-label', text: m.label }),
            el('strong', { text: m.valore }),
          ])
        )),
      ]);
    });

    container.appendChild(el('article', { class: 'card radar-test-year-card' }, [
      el('h3', { text: test.label }),
      ...righe,
    ]));
  });


  const originaliNonStandard = sessioniAnno.filter((s) =>
    contaEserciziCompilati(s) === 0 &&
    typeof metricheOriginaliJet === 'function' &&
    metricheOriginaliJet(s).length > 0
  );
  const gruppiOriginali = new Map();
  originaliNonStandard.forEach((sessione) => {
    const nome = nomeTestSessione(sessione);
    if (!gruppiOriginali.has(nome)) gruppiOriginali.set(nome, []);
    gruppiOriginali.get(nome).push(sessione);
  });

  gruppiOriginali.forEach((prove, nome) => {
    mostrato = true;
    const righe = [...prove].sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))).map((sessione) => {
      const metriche = metricheOriginaliJet(sessione);
      return el('div', { class: 'radar-test-date-row' }, [
        el('time', { class: 'session-date', text: formatDataIt(sessione.data) }),
        el('div', { class: 'mini-metrics' }, metriche.map((m) =>
          el('span', { class: 'mini-metric' }, [
            el('span', { class: 'mini-metric-label', text: m.label }),
            el('strong', { text: m.valore }),
          ])
        )),
      ]);
    });

    container.appendChild(el('article', { class: 'card radar-test-year-card' }, [
      el('h3', { text: nome }),
      ...righe,
    ]));
  });

  if (!mostrato) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessun test con valori reali nell’anno selezionato.' }));
  }
}

function calcola() {
  if (_sessioniAtleta.length === 0) return;

  const anno = qs('#anno-radar').value;
  const sessioniAnno = filtraPerAnno(_sessioniAtleta, anno);
  const punteggi = CATEGORIE_RADAR.map((cat) => calcolaCategoria(cat, sessioniAnno));
  const indiciAttivi = CATEGORIE_RADAR
    .map((_, i) => i)
    .filter((i) => punteggi[i] !== null);

  costruisciContenuto();

  if (!indiciAttivi.length) {
    qs('#radar-canvas')?.closest('.chart-block')?.remove();
    qs('#tabella-radar').appendChild(el('div', { class: 'empty-state', text: 'Radar sintetico non disponibile per questo anno.' }));
    renderAndamentoTestAnnuale(sessioniAnno);
    return;
  }

  renderRadar(punteggi, indiciAttivi, anno);
  renderTabella(punteggi, indiciAttivi);
  renderAndamentoTestAnnuale(sessioniAnno);
}

qs('#anno-radar').addEventListener('change', calcola);

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

  popolaAnniRadar();
  calcola();
  onThemeChange(calcola);
}

init();
