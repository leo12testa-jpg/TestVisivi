registerServiceWorker();

const atletaId = getQueryParam('id');
let _atleta = null;
let _sessioni = [];

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
}

function leggiAnagrafica() {
  return {
    altezza: qs('#a-altezza').value === '' ? '' : Number(qs('#a-altezza').value),
    dataNascita: qs('#a-data-nascita').value,
    telefono: qs('#a-telefono').value.trim(),
    email: qs('#a-email').value.trim(),
    squadraId: qs('#a-squadra').value,
  };
}

function popolaFormClinici(dc) {
  qs('#c-od').value = dc.acuitaVisiva.od || '';
  qs('#c-os').value = dc.acuitaVisiva.os || '';
  qs('#c-binoculare').value = dc.acuitaVisiva.binoculare || '';
  popolaCorrezione('cp', dc.correzionePropria);
  popolaCorrezione('cc', dc.correzione);
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

function renderSessioni() {
  const container = qs('#lista-sessioni');
  container.innerHTML = '';
  if (_sessioni.length === 0) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessuna sessione registrata. Crea la prima con "Nuova sessione".' }));
    return;
  }
  [..._sessioni].reverse().forEach((s) => {
    const nEsercizi = contaEserciziCompilati(s);
    const etichettaData = s.titolo ? `${formatDataIt(s.data)} · ${s.titolo}` : formatDataIt(s.data);
    const item = el('div', { class: 'list-item' }, [
      el('a', { href: `./sessione.html?atletaId=${atletaId}&sessioneId=${s.id}`, style: 'text-decoration:none;color:inherit;flex:1;' }, [
        el('div', { text: etichettaData }),
        el('div', { class: 'meta', text: `${nEsercizi} esercizi${nEsercizi === 1 ? 'o' : ''} compilat${nEsercizi === 1 ? 'o' : 'i'}` }),
      ]),
      el('button', {
        class: 'danger',
        text: 'Elimina',
        onclick: async () => {
          if (!confirm(`Eliminare la sessione del ${formatDataIt(s.data)}?`)) return;
          await dbDeleteSessione(s.id);
          await caricaSessioni();
        },
      }),
    ]);
    container.appendChild(item);
  });
}

async function caricaSessioni() {
  _sessioni = await dbGetSessioniByAtleta(atletaId);
  renderSessioni();
}

function mostraToast(msg) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  _atleta = await dbGetAtleta(atletaId);
  if (!_atleta) {
    window.location.href = './index.html';
    return;
  }
  qs('#titolo-atleta').textContent = nomeCompleto(_atleta);
  document.title = `${nomeCompleto(_atleta)} - JetProgram Tracker`;
  qs('#link-grafici').href = `./grafici.html?id=${atletaId}`;
  qs('#link-tutte-sessioni').href = `./sessioni.html?atletaId=${atletaId}`;
  costruisciSelectCorrezione();
  await popolaSelectSquadra(_atleta.squadraId);
  popolaAnagrafica(_atleta);
  popolaFormClinici(_atleta.datiClinici);
  await caricaSessioni();
}

qs('#form-clinici').addEventListener('submit', async (e) => {
  e.preventDefault();
  Object.assign(_atleta, leggiAnagrafica());
  _atleta.datiClinici = leggiFormClinici();
  await dbUpdateAtleta(_atleta);
  mostraToast('Profilo salvato');
});

qs('#btn-nuova-sessione').addEventListener('click', () => {
  window.location.href = `./sessione.html?atletaId=${atletaId}`;
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
