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
      text: 'Ogni asse corrisponde a un Test. Il valore usa l’ultima valutazione disponibile di quel Test; i Training non entrano nel radar.',
    }),
  ]));

  renderChart(
    canvas,
    radarChartConfig(
      radar.labels,
      [{ label: 'Profilo test', data: radar.valori }],
      null
    )
  );
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
