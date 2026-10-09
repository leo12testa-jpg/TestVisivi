registerServiceWorker();

const atletaId = getQueryParam('id');
let _sessioniAtleta = [];
let _tutteSessioni = [];
const radarScelte = { a: {}, b: {} };
let radarChartAttuale = null;

function sessioniNelPeriodo(periodo) {
  const dal = qs('#radar-' + periodo + '-from').value;
  const al = qs('#radar-' + periodo + '-to').value;
  if (dal && al && dal > al) return null;
  return _sessioniAtleta.filter(s =>
    (!dal || String(s.data || '') >= dal) && (!al || String(s.data || '') <= al)
  );
}

function testDisponibili(sessioni, key) {
  return sessioni.filter(s => radarChiaveTestSessione(s) === key)
    .sort((a,b) => String(b.data || '').localeCompare(String(a.data || '')) ||
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function scegliSessioni(periodo) {
  const sessioni = sessioniNelPeriodo(periodo);
  if (sessioni === null) return null;
  const container = qs('#radar-' + periodo + '-tests');
  container.replaceChildren();
  const selezionate = [];
  Object.keys(TEST_RADAR_CONFIG).forEach(key => {
    const disponibili = testDisponibili(sessioni, key);
    const scelta = radarScelte[periodo][key];
    if (!disponibili.length) {
      container.appendChild(el('p', { class: 'meta', text: (TEST_STANDARD_LABELS[key] || key) + ': nessun test nel periodo' }));
      return;
    }
    const select = el('select', { 'aria-label': 'Rilevazione ' + (TEST_STANDARD_LABELS[key] || key) });
    select.appendChild(el('option', { value: '__none__', text: 'Escludi dal radar' }));
    disponibili.forEach((s, i) => {
      select.appendChild(el('option', { value: String(i), text: formatDataIt(s.data) + (s.updatedAt ? ' · ' + String(s.updatedAt).slice(11,16) : '') }));
    });
    const selectedIndex = scelta === '__none__' ? -1 : disponibili.findIndex((s,i) => String(s.id || '') + '|' + i === scelta);
    select.value = scelta === '__none__' ? '__none__' : String(selectedIndex < 0 ? 0 : selectedIndex);
    if (select.value !== '__none__') selezionate.push(disponibili[Number(select.value)]);
    select.addEventListener('change', () => {
      radarScelte[periodo][key] = select.value === '__none__' ? '__none__' :
        String(disponibili[Number(select.value)].id || '') + '|' + select.value;
      costruisciRadar();
    });
    container.appendChild(el('div', { class: 'radar-test-picker' }, [
      el('label', { text: TEST_STANDARD_LABELS[key] || key }), select
    ]));
  });
  return selezionate;
}

function costruisciRadar() {
  const container = qs('#contenuto-radar');
  if (radarChartAttuale) { radarChartAttuale.destroy(); radarChartAttuale = null; }
  container.replaceChildren();
  const a = scegliSessioni('a');
  const b = scegliSessioni('b');
  if (a === null || b === null) {
    qs('#radar-date-status').textContent = 'Controlla le date: la data iniziale non può essere successiva a quella finale.';
    return;
  }
  const radarA = radarDatiSintesi(a, _tutteSessioni);
  const radarB = radarDatiSintesi(b, _tutteSessioni);
  const keys = [...new Set([...radarA.righe.map(r => r.key), ...radarB.righe.map(r => r.key)])];
  qs('#radar-date-status').textContent = 'A: ' + a.length + ' test · B: ' + b.length + ' test. Confronto rispetto allo stesso archivio storico.';
  if (!keys.length) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessun test valido nei periodi selezionati.' }));
    return;
  }
  const labels = keys.map(key => TEST_STANDARD_LABELS[key] || key);
  const valori = (radar) => keys.map(key => radar.righe.find(r => r.key === key)?.valore ?? null);
  const canvas = el('canvas', { id: 'radar-canvas' });
  container.appendChild(el('section', { class: 'card radar-simple-card' }, [
    el('div', { class: 'chart-canvas-wrap radar-simple-canvas', style: 'height:490px;' }, [canvas]),
    el('p', { class: 'meta', text: 'Blu = periodo A; verde = periodo B. Percentili relativi all’archivio completo, non soglie scientifiche assolute. Assenze indicate come dati mancanti.' })
  ]));
  const cfg = radarChartConfig(labels, [
    { label: 'Periodo A', data: valori(radarA) },
    { label: 'Periodo B', data: valori(radarB) }
  ], null);
  cfg.data.datasets[0].borderColor = '#2474ba';
  cfg.data.datasets[0].backgroundColor = 'rgba(36,116,186,.15)';
  cfg.data.datasets[0].pointBackgroundColor = '#2474ba';
  cfg.data.datasets[1].borderColor = '#16a085';
  cfg.data.datasets[1].backgroundColor = 'rgba(22,160,133,.15)';
  cfg.data.datasets[1].pointBackgroundColor = '#16a085';
  radarChartAttuale = renderChart(canvas, cfg);
  const righe = keys.map(key => {
    const ra = radarA.righe.find(r => r.key === key);
    const rb = radarB.righe.find(r => r.key === key);
    return el('article', { class: 'radar-test-summary-item' }, [
      el('strong', { text: TEST_STANDARD_LABELS[key] || key }),
      el('span', { class: 'meta', text: 'A: ' + (ra ? ra.valore + '/100 · ' + formatDataIt(ra.data) : '—') +
        '   |   B: ' + (rb ? rb.valore + '/100 · ' + formatDataIt(rb.data) : '—') })
    ]);
  });
  container.appendChild(el('section', { class: 'radar-test-summary' }, righe));
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
  ['a','b'].forEach(p => {
    ['from','to'].forEach(side => qs('#radar-' + p + '-' + side).addEventListener('change', () => {
      radarScelte[p] = {};
      costruisciRadar();
    }));
  });
  qs('#radar-reset-date').addEventListener('click', () => {
    ['a','b'].forEach(p => { qs('#radar-' + p + '-from').value = ''; qs('#radar-' + p + '-to').value = ''; radarScelte[p] = {}; });
    costruisciRadar();
  });
  costruisciRadar();
  onThemeChange(costruisciRadar);
}
init().catch(mostraErrorePagina);
