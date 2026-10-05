registerServiceWorker();

const atletaId = getQueryParam('id');
let _sessioniAtleta = [];
let _tutteSessioni = [];

function costruisciRadar() {
  const container = qs('#contenuto-radar');
  container.innerHTML = '';

  const radar = radarDatiSintesi(_sessioniAtleta, _tutteSessioni);
  if (!radar.labels.length) {
    container.appendChild(el('div', {
      class: 'empty-state',
      text: 'Nessun Test con valori sufficienti per costruire il radar.',
    }));
    return;
  }

  const canvas = el('canvas', { id: 'radar-canvas' });
  const height = Math.max(430, Math.min(620, 360 + radar.labels.length * 18));
  container.appendChild(el('section', { class: 'card radar-simple-card' }, [
    el('div', { class: 'chart-canvas-wrap radar-simple-canvas', style: `height:${height}px;` }, [canvas]),
    el('p', {
      class: 'meta radar-simple-note',
      text: 'Indice relativo 0-100 calcolato solo sui parametri scelti per ciascun Test. 50 è circa la mediana dell’archivio; i Training sono esclusi.',
    }),
  ]));

  const labelsConPunteggio = radar.righe.map((riga) => riga.nome + ' · ' + riga.valore + '/100');

  renderChart(
    canvas,
    radarChartConfig(
      labelsConPunteggio,
      [{ label: 'Profilo test', data: radar.valori }],
      null
    )
  );

  container.appendChild(el('section', { class: 'radar-test-summary' }, radar.righe.map((riga) =>
    el('article', { class: 'radar-test-summary-item' }, [
      el('div', {}, [
        el('strong', { text: riga.nome }),
        el('span', { class: 'meta', text: riga.data ? `Ultimo test: ${formatDataIt(riga.data)}` : '' }),
        el('span', {
          class: 'meta',
          text: riga.parametriValoriRadar?.length
            ? `Basato su: ${riga.parametriValoriRadar.map((m) => m.label + ' ' + m.valore).join(' + ')}`
            : '',
        }),
        el('span', { class: 'radar-strength-label', text: riga.livello || '' }),
      ]),
      el('span', { class: 'radar-score-pill', text: riga.valore + '/100' }),
    ])
  )));
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
  qs('#titolo-pagina').textContent = `Radar — ${nomeCompleto(atleta)}`;
  document.title = `Radar ${nomeCompleto(atleta)} - Test Visivi`;

  const [tutteSessioni, sessioniAtleta] = await Promise.all([
    dbGetAllSessioni(),
    dbGetSessioniByAtleta(atletaId),
  ]);

  _sessioniAtleta = sessioniAtleta.filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  _tutteSessioni = tutteSessioni.filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));

  costruisciRadar();
  onThemeChange(costruisciRadar);
}

init().catch(mostraErrorePagina);
