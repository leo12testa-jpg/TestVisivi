registerServiceWorker();

const atletaId = getQueryParam('id');
let _renderJobs = [];

function buildTabellaSingola(esercizio, sessione) {
  const cols = colonneEsercizio(esercizio);
  const table = el('table', {}, [el('caption', { text: `${esercizio.label} — ${formatDataIt(sessione.data)}` })]);
  const tbody = el('tbody');
  cols.forEach((col) => {
    const val = col.get(sessione);
    if (val === '') return;
    tbody.appendChild(el('tr', {}, [el('th', { text: col.header }), el('td', { text: String(val) })]));
  });
  table.appendChild(tbody);
  return el('div', { class: 'table-scroll' }, [table]);
}

/** Tabella con le sole colonne non numeriche (testo/booleane), che non compaiono nei grafici. */
function buildTabellaAltreRisposte(esercizio, sessioni) {
  const colonne = colonneEsercizio(esercizio).filter((c) => c.tipo !== 'number');
  if (colonne.length === 0) return null;
  const righe = sessioni
    .map((s) => ({ s, valori: colonne.map((c) => c.get(s)) }))
    .filter(({ valori }) => valori.some((v) => v !== ''));
  if (righe.length === 0) return null;

  const thead = el('thead', {}, [el('tr', {}, [el('th', { text: 'Data' }), ...colonne.map((c) => el('th', { text: c.header }))])]);
  const tbody = el(
    'tbody',
    {},
    righe.map(({ s, valori }) => el('tr', {}, [el('td', { text: formatDataIt(s.data) }), ...valori.map((v) => el('td', { text: v === '' ? '-' : String(v) }))]))
  );
  const table = el('table', {}, [el('caption', { text: `${esercizio.label} — altre risposte` }), thead, tbody]);
  return el('div', { class: 'table-scroll' }, [table]);
}

function buildChartBlock(group, sessioni) {
  const canvas = el('canvas');
  const block = el('div', { class: 'chart-block' }, [
    el('h3', { text: titoloGruppo(group) }),
    el('div', { class: 'chart-canvas-wrap' }, [canvas]),
  ]);
  _renderJobs.push({ canvas, sessioni, group });
  return block;
}

function renderTuttiGrafici() {
  _renderJobs.forEach((job) => {
    const sessioniGruppo = sessioniConGruppo(job.sessioni, job.group);
    renderChart(job.canvas, buildGroupChartConfig(sessioniGruppo, job.group));
  });
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  const atleta = await dbGetAtleta(atletaId);
  if (!atleta) {
    window.location.href = './index.html';
    return;
  }
  qs('#back-link').href = `./atleta.html?id=${atletaId}`;
  qs('#titolo-grafici').textContent = `Grafici — ${nomeCompleto(atleta)}`;
  document.title = `Grafici ${nomeCompleto(atleta)} - Test Visivi`;

  const sessioni = await dbGetSessioniByAtleta(atletaId);
  const contenuto = qs('#contenuto');
  let mostratoAlmenoUno = false;

  ESERCIZI_CONFIG.forEach((esercizio) => {
    const sessioniCompilate = sessioni.filter((s) => esercizioCompilato(esercizio, s.esercizi && s.esercizi[esercizio.key]));
    if (sessioniCompilate.length === 0) return;
    mostratoAlmenoUno = true;

    const sezione = el('section', {}, [el('h2', { text: esercizio.label })]);

    if (sessioniCompilate.length === 1) {
      sezione.appendChild(buildTabellaSingola(esercizio, sessioniCompilate[0]));
    } else {
      getChartGroups(esercizio).forEach((group) => {
        sezione.appendChild(buildChartBlock(group, sessioniCompilate));
      });
      const tabellaAltreRisposte = buildTabellaAltreRisposte(esercizio, sessioniCompilate);
      if (tabellaAltreRisposte) sezione.appendChild(tabellaAltreRisposte);
    }
    contenuto.appendChild(sezione);
  });

  if (!mostratoAlmenoUno) {
    contenuto.appendChild(el('div', { class: 'empty-state', text: 'Nessun dato ancora registrato per questo atleta.' }));
    return;
  }

  renderTuttiGrafici();
  onThemeChange(renderTuttiGrafici);
}

init();
