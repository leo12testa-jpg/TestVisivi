registerServiceWorker();

const atletaId = getQueryParam('id');
let _atleta = null;
let _sessioni = [];
let _training = [];

/** Da -20.00 a +20.00 step 0.25, segno sempre visibile (usa centesimi interi per evitare arrotondamenti float). */
function opzioniDiottrie() {
  const opzioni = [''];
  for (let centesimi = -2000; centesimi <= 2000; centesimi += 25) {
    if (centesimi === 0) {
      opzioni.push('0.00');
      continue;
    }
    const segno = centesimi > 0 ? '+' : '-';
    opzioni.push(`${segno}${(Math.abs(centesimi) / 100).toFixed(2)}`);
  }
  return opzioni;
}

/** Da 0° a 180° step 5°. */
function opzioniAsse() {
  const opzioni = [''];
  for (let grado = 0; grado <= 180; grado += 5) opzioni.push(`${grado}°`);
  return opzioni;
}

const OPZIONI_DIOTTRIE = opzioniDiottrie();
const OPZIONI_ASSE = opzioniAsse();

function buildSelectOpzioni(id, opzioni) {
  return el(
    'select',
    { id },
    opzioni.map((o) => el('option', { value: o, text: o === '' ? '-' : o }))
  );
}

function buildRigaCorrezione(prefix, occhioLabel, occhioKey) {
  const idSf = `${prefix}-${occhioKey}-sf`;
  const idCyl = `${prefix}-${occhioKey}-cyl`;
  const idAx = `${prefix}-${occhioKey}-ax`;
  return el('div', { class: 'field-grid' }, [
    el('div', { class: 'field' }, [el('label', { for: idSf, text: `${occhioLabel} — Sf` }), buildSelectOpzioni(idSf, OPZIONI_DIOTTRIE)]),
    el('div', { class: 'field' }, [el('label', { for: idCyl, text: `${occhioLabel} — Cyl` }), buildSelectOpzioni(idCyl, OPZIONI_DIOTTRIE)]),
    el('div', { class: 'field' }, [el('label', { for: idAx, text: `${occhioLabel} — Ax` }), buildSelectOpzioni(idAx, OPZIONI_ASSE)]),
  ]);
}

function costruisciSelectCorrezione() {
  qs('#blocco-propria-correzione').append(buildRigaCorrezione('cp', 'OD', 'od'), buildRigaCorrezione('cp', 'OS', 'os'));
  qs('#blocco-correzione').append(buildRigaCorrezione('cc', 'OD', 'od'), buildRigaCorrezione('cc', 'OS', 'os'));
}

function popolaCorrezione(prefix, valore) {
  const v = valore && valore.od && valore.os ? valore : correzioneVuota();
  qs(`#${prefix}-od-sf`).value = v.od.sf || '';
  qs(`#${prefix}-od-cyl`).value = v.od.cyl || '';
  qs(`#${prefix}-od-ax`).value = v.od.ax || '';
  qs(`#${prefix}-os-sf`).value = v.os.sf || '';
  qs(`#${prefix}-os-cyl`).value = v.os.cyl || '';
  qs(`#${prefix}-os-ax`).value = v.os.ax || '';
}

function leggiCorrezione(prefix) {
  return {
    od: { sf: qs(`#${prefix}-od-sf`).value, cyl: qs(`#${prefix}-od-cyl`).value, ax: qs(`#${prefix}-od-ax`).value },
    os: { sf: qs(`#${prefix}-os-sf`).value, cyl: qs(`#${prefix}-os-cyl`).value, ax: qs(`#${prefix}-os-ax`).value },
  };
}

function popolaPosizioni5(prefix, valore) {
  const v = valore && typeof valore === 'object' ? valore : posizioni5Vuote();
  qs(`#${prefix}-alto-sx`).value = v.altoSx || '';
  qs(`#${prefix}-basso-sx`).value = v.bassoSx || '';
  qs(`#${prefix}-centrale`).value = v.centrale || '';
  qs(`#${prefix}-alto-dx`).value = v.altoDx || '';
  qs(`#${prefix}-basso-dx`).value = v.bassoDx || '';
}

function leggiPosizioni5(prefix) {
  return {
    altoSx: qs(`#${prefix}-alto-sx`).value.trim(),
    bassoSx: qs(`#${prefix}-basso-sx`).value.trim(),
    centrale: qs(`#${prefix}-centrale`).value.trim(),
    altoDx: qs(`#${prefix}-alto-dx`).value.trim(),
    bassoDx: qs(`#${prefix}-basso-dx`).value.trim(),
  };
}

async function popolaSelectSquadra(squadraIdCorrente) {
  const squadre = await dbGetSquadre();
  const select = qs('#a-squadra');
  select.innerHTML = '';
  select.appendChild(el('option', { value: '', text: 'Nessuna squadra' }));
  squadre.forEach((s) => select.appendChild(el('option', { value: s.id, text: s.nome })));
  select.value = squadraIdCorrente || '';
}

function popolaAnagrafica(atleta) {
  qs('#a-altezza').value = atleta.altezza ?? '';
  qs('#a-data-nascita').value = atleta.dataNascita || '';
  qs('#a-telefono').value = atleta.telefono || '';
  qs('#a-email').value = atleta.email || '';
  qs('#a-note').value = atleta.note || '';
}

function leggiAnagrafica() {
  return {
    altezza: qs('#a-altezza').value === '' ? '' : Number(qs('#a-altezza').value),
    dataNascita: qs('#a-data-nascita').value,
    telefono: qs('#a-telefono').value.trim(),
    email: qs('#a-email').value.trim(),
    squadraId: qs('#a-squadra').value,
    note: qs('#a-note').value.trim(),
  };
}

/** Se il valore storico non è tra le opzioni del select (es. "alternato", "sdx", "rx"), lo aggiunge invece di azzerarlo. */
function assicuraOpzioneSelect(select, valore) {
  if (!valore) return;
  const esiste = Array.from(select.options).some((o) => o.value === valore);
  if (!esiste) select.appendChild(el('option', { value: valore, text: valore }));
}

function popolaFormClinici(dc) {
  qs('#c-od').value = dc.acuitaVisiva.od || '';
  qs('#c-os').value = dc.acuitaVisiva.os || '';
  qs('#c-binoculare').value = dc.acuitaVisiva.binoculare || '';
  popolaCorrezione('cp', dc.correzionePropria);
  popolaCorrezione('cc', dc.correzione);
  assicuraOpzioneSelect(qs('#c-piede'), dc.piedeDominante);
  assicuraOpzioneSelect(qs('#c-mano'), dc.manoDominante);
  assicuraOpzioneSelect(qs('#c-occhio'), dc.occhioDirettoreMotorio);
  qs('#c-piede').value = dc.piedeDominante || '';
  qs('#c-mano').value = dc.manoDominante || '';
  qs('#c-occhio').value = dc.occhioDirettoreMotorio || '';
  popolaPosizioni5('c-schober', dc.schober3m);
  popolaPosizioni5('c-brock', dc.brockString);
  qs('#c-fusionale').value = dc.abilitaFusionaleRapida ?? '';
  qs('#c-focus').value = dc.abilitaMessaFuocoRapida ?? '';
}

function leggiFormClinici() {
  return {
    acuitaVisiva: {
      od: qs('#c-od').value.trim(),
      os: qs('#c-os').value.trim(),
      binoculare: qs('#c-binoculare').value.trim(),
    },
    correzionePropria: leggiCorrezione('cp'),
    correzione: leggiCorrezione('cc'),
    piedeDominante: qs('#c-piede').value,
    manoDominante: qs('#c-mano').value,
    occhioDirettoreMotorio: qs('#c-occhio').value,
    schober3m: leggiPosizioni5('c-schober'),
    brockString: leggiPosizioni5('c-brock'),
    abilitaFusionaleRapida: qs('#c-fusionale').value === '' ? '' : Number(qs('#c-fusionale').value),
    abilitaMessaFuocoRapida: qs('#c-focus').value === '' ? '' : Number(qs('#c-focus').value),
  };
}

/** Carica una volta lo storico e separa nettamente Test e Training. */
async function caricaSessioni() {
  const tutte = (await dbGetSessioniByAtleta(atletaId)).filter(sessioneHaRisultatiVisibili);
  _sessioni = tutte.filter(isSessioneTest);
  _training = tutte.filter(isSessioneTraining);

  const anni = tutte
    .map((s) => String(s.data || '').slice(0, 4))
    .filter((anno) => /^\d{4}$/.test(anno))
    .sort();
  const annoRiferimento = anni.length ? anni[anni.length - 1] : '';
  const testAnno = annoRiferimento ? _sessioni.filter((s) => String(s.data || '').startsWith(annoRiferimento + '-')) : _sessioni;
  const trainingAnno = annoRiferimento ? _training.filter((s) => String(s.data || '').startsWith(annoRiferimento + '-')) : _training;

  qs('#label-stat-sessioni').textContent = annoRiferimento ? `Giornate test ${annoRiferimento}` : 'Giornate test';
  qs('#label-stat-training').textContent = annoRiferimento ? `Giornate training ${annoRiferimento}` : 'Giornate training';
  qs('#label-stat-test').textContent = annoRiferimento ? `Test diversi ${annoRiferimento}` : 'Test diversi';

  qs('#stat-sessioni').textContent = String(new Set(testAnno.map((s) => s.data).filter(Boolean)).size);
  qs('#stat-training').textContent = String(new Set(trainingAnno.map((s) => s.data).filter(Boolean)).size);
  qs('#stat-test').textContent = String(new Set(testAnno.map((s) => nomeStoricoSessione(s))).size);
  qs('#stat-ultima').textContent = _sessioni.length ? formatDataIt(_sessioni[_sessioni.length - 1].data) : '—';

  const recenti = qs('#sessioni-recenti');
  recenti.innerHTML = '';
  [..._sessioni].reverse().slice(0, 5).forEach((s) => {
    const metriche = metricheStoricoSessione(s, 3);
    const contenuto = [
      el('span', { class: 'eyebrow', text: formatDataIt(s.data) }),
      el('div', { class: 'session-title', text: nomeStoricoSessione(s) }),
    ];
    if (metriche.length) {
      contenuto.push(el('div', { class: 'mini-metrics compact' }, metriche.map((m) =>
        el('span', { class: 'mini-metric' }, [
          el('span', { class: 'mini-metric-label', text: m.label }),
          el('strong', { text: m.valore }),
        ])
      )));
    } else {
      contenuto.push(el('p', { class: 'meta', text: riepilogoSessione(s) }));
    }
    recenti.appendChild(el('a', {
      class: 'list-item session-list-item', href: `./sessione.html?atletaId=${atletaId}&sessioneId=${s.id}`,
    }, [el('div', { class: 'session-list-content' }, contenuto), el('span', { class: 'session-list-arrow', 'aria-hidden': 'true', text: '›' })]));
  });
  if (!_sessioni.length) recenti.appendChild(el('p', { class: 'empty-state', text: 'Nessun test registrato.' }));
}

function osservazioniAtleta() {
  return Array.isArray(_atleta?.osservazioni) ? _atleta.osservazioni : [];
}

function renderOsservazioni() {
  const container = qs('#lista-osservazioni');
  if (!container) return;
  container.innerHTML = '';
  const items = [...osservazioniAtleta()].sort((a, b) =>
    String(b.data || '').localeCompare(String(a.data || '')) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
  const count = qs('#note-count');
  if (count) count.textContent = String(items.length);

  if (!items.length) {
    container.appendChild(el('p', { class: 'empty-state compact', text: 'Nessuna osservazione annotata.' }));
    return;
  }

  items.forEach((item) => {
    const card = el('article', { class: 'observation-item' }, [
      el('div', { class: 'observation-content' }, [
        el('time', { class: 'eyebrow', text: item.data ? formatDataIt(item.data) : 'Senza data' }),
        el('p', { text: item.testo || '' }),
      ]),
      el('button', {
        type: 'button',
        class: 'secondary observation-delete',
        text: 'Elimina',
        onclick: async () => {
          if (!confirm('Eliminare questa osservazione?')) return;
          _atleta.osservazioni = osservazioniAtleta().filter((x) => x.id !== item.id);
          await dbUpdateAtleta(_atleta);
          renderOsservazioni();
          mostraToast('Osservazione eliminata');
        },
      }),
    ]);
    container.appendChild(card);
  });
}

async function aggiungiOsservazione() {
  const data = qs('#osservazione-data').value;
  const testo = qs('#osservazione-testo').value.trim();
  if (!data) {
    qs('#osservazione-data').focus();
    return;
  }
  if (!testo) {
    qs('#osservazione-testo').focus();
    return;
  }

  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `obs-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  _atleta.osservazioni = [...osservazioniAtleta(), {
    id,
    data,
    testo,
    createdAt: new Date().toISOString(),
  }];
  await dbUpdateAtleta(_atleta);
  qs('#osservazione-testo').value = '';
  renderOsservazioni();
  mostraToast('Osservazione aggiunta');
}

function mostraToast(msg) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

function mostraErroreInit(err) {
  console.error('Errore inizializzazione profilo atleta:', err);
  const main = document.querySelector('main');
  const banner = el('div', { class: 'card', style: 'border-color:var(--danger);' }, [
    el('p', { style: 'color:var(--danger);font-weight:600;margin:0 0 4px;', text: 'Errore nel caricamento del profilo' }),
    el('p', { class: 'meta', style: 'margin:0;', text: err && err.message ? err.message : String(err) }),
  ]);
  main.prepend(banner);
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  try {
    _atleta = await dbGetAtleta(atletaId);
    if (!_atleta) {
      window.location.href = './index.html';
      return;
    }
    qs('#titolo-atleta').textContent = nomeCompleto(_atleta);
    qs('#nome-atleta').textContent = nomeCompleto(_atleta);
    document.title = `${nomeCompleto(_atleta)} - Test Visivi`;
    qs('#link-grafici').href = `./grafici.html?id=${atletaId}`;
    qs('#link-radar').href = `./radar.html?id=${atletaId}`;
    qs('#link-tutte-sessioni').href = `./sessioni.html?atletaId=${atletaId}&tipo=test`;
    qs('#link-training-storico').href = `./sessioni.html?atletaId=${atletaId}&tipo=training`;
    costruisciSelectCorrezione();
    await popolaSelectSquadra(_atleta.squadraId);
    popolaAnagrafica(_atleta);
    qs('#osservazione-data').value = oggiIso();
    renderOsservazioni();
    const defaults = datiCliniciVuoti();
    const dc = _atleta.datiClinici || {};
    Object.keys(defaults).forEach((key) => {
      defaults[key] = typeof defaults[key] === 'object' ? { ...defaults[key], ...(dc[key] || {}) } : (dc[key] ?? defaults[key]);
    });
    popolaFormClinici(defaults);
    _atleta.datiClinici = { ...dc, ...defaults };
    await caricaSessioni();
  } catch (err) {
    mostraErroreInit(err);
  }
}

qs('#form-clinici').addEventListener('submit', async (e) => {
  e.preventDefault();
  Object.assign(_atleta, leggiAnagrafica());
  _atleta.datiClinici = leggiFormClinici();
  await dbUpdateAtleta(_atleta);
  mostraToast('Profilo salvato');
});

qs('#btn-aggiungi-osservazione').addEventListener('click', () => {
  aggiungiOsservazione().catch(mostraErrorePagina);
});

qs('#btn-test').addEventListener('click', () => {
  window.location.href = `./sessione.html?atletaId=${atletaId}&mode=test`;
});

qs('#btn-training').addEventListener('click', () => {
  window.location.href = `./sessione.html?atletaId=${atletaId}&mode=training`;
});

qs('#btn-elimina-atleta').addEventListener('click', async () => {
  if (!confirm(`Eliminare ${nomeCompleto(_atleta)} e tutte le sue sessioni? L'operazione non è reversibile.`)) return;
  await dbDeleteAtleta(atletaId);
  window.location.href = './index.html';
});

qs('#btn-export-pdf').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Generazione PDF...';
  try {
    await esportaReportPdf(_atleta, _sessioni);
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ Esporta PDF';
  }
});

init();
