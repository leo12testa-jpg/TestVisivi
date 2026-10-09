registerServiceWorker();
// Collega il comando subito, senza attendere Firebase o il caricamento dell’archivio.
document.querySelector('#radar-add-player')?.addEventListener('click', aggiungiProfilo);

const atletaId = getQueryParam('id');
const _sessioniCache = new Map();
const COLORI_RADAR = ['#2474ba','#16a085','#d97706','#9333ea','#dc3868','#0d9488','#64748b','#c2410c'];
let _atleti = [];
let _tutteSessioni = [];
let radarChartAttuale = null;
let profili = [];
let counter = 0;
let inizialeId = '';
let ultimaRichiesta = 0;

function atletaDaId(id) { return _atleti.find(a => String(a.id) === String(id)); }
function nomeProfilo(p) { const a = atletaDaId(p.atletaId); return a ? nomeCompleto(a) : 'Giocatore'; }
function coloreProfilo(p) { return COLORI_RADAR[profili.indexOf(p) % COLORI_RADAR.length]; }

function giornateConTest(sessioni) {
  const dates = new Set();
  for (const s of (sessioni || [])) {
    const data = String(s.data || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) &&
        Object.prototype.hasOwnProperty.call(TEST_RADAR_CONFIG, radarChiaveTestSessione(s))) dates.add(data);
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}
async function caricaSessioni(id) {
  if (!id) return [];
  if (!_sessioniCache.has(id)) {
    const sessioni = await dbGetSessioniByAtleta(id);
    _sessioniCache.set(id, sessioni.filter(s => isSessioneTest(s) && sessioneHaRisultatiVisibili(s)));
  }
  return _sessioniCache.get(id);
}
function datiProfilo(p) {
  return (_sessioniCache.get(p.atletaId) || []).filter(s => String(s.data || '').slice(0,10) === p.data);
}
function opzioniGiornate(p, select, preferita) {
  const date = giornateConTest(_sessioniCache.get(p.atletaId) || []);
  select.replaceChildren(el('option', { value:'', text:'Seleziona giornata…' }));
  date.forEach(data => {
    const n = (_sessioniCache.get(p.atletaId) || []).filter(s => String(s.data || '').slice(0,10) === data).length;
    select.appendChild(el('option', { value:data, text:formatDataIt(data) + ' · ' + n + ' test' }));
  });
  p.data = preferita && date.includes(preferita) ? preferita : (date[0] || '');
  select.value = p.data;
}
function disegnaSelettori() {
  const container = qs('#radar-profiles');
  container.replaceChildren();
  profili.forEach((p, i) => {
    const selectAtleta = el('select', { 'aria-label':'Giocatore ' + (i + 1) });
    selectAtleta.appendChild(el('option', { value:'', text:'Seleziona giocatore…' }));
    _atleti.forEach(a => selectAtleta.appendChild(el('option', {value:String(a.id),text:nomeCompleto(a)})));
    selectAtleta.value = p.atletaId;
    const selectData = el('select', {'aria-label':'Giornata giocatore ' + (i + 1)});
    opzioniGiornate(p, selectData, p.data);
    const colore = COLORI_RADAR[i % COLORI_RADAR.length];
    const remove = el('button', { type:'button', class:'secondary', text:'Rimuovi' });
    remove.disabled = profili.length === 1;
    remove.addEventListener('click', () => {
      profili = profili.filter(x => x !== p);
      disegnaSelettori(); costruisciRadar();
    });
    selectAtleta.addEventListener('change', async () => {
      p.atletaId = selectAtleta.value;
      p.data = '';
      const request = ++ultimaRichiesta;
      try {
        await caricaSessioni(p.atletaId);
        if (request !== ultimaRichiesta || !profili.includes(p)) return;
        disegnaSelettori(); costruisciRadar();
      } catch (err) { mostraErrorePagina(err); }
    });
    selectData.addEventListener('change', () => { p.data = selectData.value; costruisciRadar(); });
    const block = el('div', { class:'radar-profile-row' }, [
      el('div', { class:'radar-profile-heading' }, [
        el('strong', {text:'Profilo ' + (i + 1)}),
        el('span', {class:'radar-profile-swatch', style:'background:' + colore}),
        remove
      ]),
      el('div', {class:'field'}, [
        el('label', {text:'Giocatore'}),
        selectAtleta
      ]),
      el('div', {class:'field'}, [
        el('label', {text:'Giornata'}),
        selectData
      ])
    ]);
    container.appendChild(block);
  });
}
function costruisciRadar() {
  const container = qs('#contenuto-radar');
  if (radarChartAttuale) { radarChartAttuale.destroy(); radarChartAttuale = null; }
  container.replaceChildren();
  const attivi = profili.filter(p => p.atletaId && p.data).map(p => ({
    profilo:p, radar:radarDatiSintesi(datiProfilo(p), _tutteSessioni)
  }));
  const stato = qs('#radar-date-status');
  if (!attivi.length) {
    stato.textContent = 'Seleziona almeno un giocatore e una giornata con test validi.';
    return;
  }
  const keys = TEST_STANDARD_KEYS.filter(key =>
    attivi.some(x => x.radar.righe.some(r => r.key === key))
  );
  stato.textContent = attivi.length + (attivi.length === 1 ? ' profilo' : ' profili') +
    ' nel radar. Punteggi confrontati con lo stesso archivio.';
  if (!keys.length) {
    container.appendChild(el('div', {class:'empty-state',text:'Nessun test con parametri sufficienti nelle giornate selezionate.'}));
    return;
  }
  const nomi = keys.map(key => TEST_STANDARD_LABELS[key] || key);
  const valori = r => keys.map(key => r.righe.find(x => x.key === key)?.valore ?? null);
  const canvas = el('canvas', {id:'radar-canvas'});
  container.appendChild(el('section', {class:'card radar-simple-card'}, [
    el('div', {class:'chart-canvas-wrap radar-simple-canvas',style:'height:540px;'}, [canvas]),
    el('p', {class:'meta radar-simple-note',text:'Ogni colore rappresenta un giocatore e una giornata. I risultati mancanti non sono zero; il punteggio è relativo all’archivio, non a soglie scientifiche.'})
  ]));
  const cfg = radarChartConfig(nomi, attivi.map(x => ({
    label:nomeProfilo(x.profilo) + ' · ' + formatDataIt(x.profilo.data),
    data:valori(x.radar)
  })), null);
  cfg.data.datasets.forEach((dataset,i) => {
    const c = coloreProfilo(attivi[i].profilo);
    dataset.borderColor = c;
    dataset.pointBackgroundColor = c;
    dataset.backgroundColor = c + '26';
    dataset.spanGaps = true;
    dataset.fill = dataset.data.filter(Number.isFinite).length >= 3 ? 'origin' : false;
  });
  radarChartAttuale = renderChart(canvas,cfg);
  if (attivi.some(x => valori(x.radar).filter(Number.isFinite).length < 3)) {
    container.appendChild(el('p',{class:'meta',text:'Con meno di tre test validi un profilo può mostrare soltanto punti o linee, non un poligono.'}));
  }
  container.appendChild(el('section',{class:'radar-test-summary'},keys.map(key => {
    const children = [el('strong',{text:TEST_STANDARD_LABELS[key] || key})];
    attivi.forEach(x => {
      const r = x.radar.righe.find(a => a.key === key);
      children.push(el('span',{class:'meta',text:nomeProfilo(x.profilo) + ' · ' +
        formatDataIt(x.profilo.data) + ': ' + (r ? r.valore + '/100' : 'non eseguito')}));
    });
    return el('article',{class:'radar-test-summary-item'},children);
  })));
}
function aggiungiProfilo() {
  if (profili.length >= 8) {
    qs('#radar-date-status').textContent = 'Limite di 8 profili raggiunto.';
    return;
  }
  if (!_atleti.length) {
    qs('#radar-date-status').textContent = 'Caricamento dei giocatori in corso. Riprova tra poco.';
    return;
  }
  // I nuovi profili non hanno una data preimpostata: devono essere scelti esplicitamente.
  profili.push({id:++counter,atletaId:inizialeId,data:''});
  try {
    disegnaSelettori();
    costruisciRadar();
    const rows = qs('#radar-profiles').querySelectorAll('.radar-profile-row');
    if (rows.length) rows[rows.length - 1].scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch (err) {
    qs('#radar-date-status').textContent = 'Errore nell’aggiunta del giocatore: ' + err.message;
    console.error(err);
  }
}
async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  const [tutte, atleti] = await Promise.all([dbGetAllSessioni(),dbGetAtleti()]);
  _atleti = atleti;
  _tutteSessioni = tutte.filter(s => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  if (!_atleti.length) {
    qs('#radar-date-status').textContent = 'Nessun giocatore disponibile.';
    return;
  }
  const iniziale = _atleti.find(a => String(a.id) === String(atletaId)) || _atleti[0];
  inizialeId = String(iniziale.id);
  await caricaSessioni(inizialeId);
  qs('#back-link').href = atletaId ? './atleta.html?id=' + encodeURIComponent(inizialeId) : './index.html';
  qs('#titolo-pagina').textContent = 'Confronto giocatori';
  document.title = 'Confronto giocatori - Test Visivi';
  profili = [{id:++counter,atletaId:inizialeId,data:''}];

  qs('#radar-reset-date').addEventListener('click', () => {
    profili = [{id:++counter,atletaId:inizialeId,data:''}];
    disegnaSelettori(); costruisciRadar();
  });
  disegnaSelettori();
  costruisciRadar();
  onThemeChange(costruisciRadar);
}
init().catch(mostraErrorePagina);
