registerServiceWorker();

const atletaId = getQueryParam('atletaId');
let _sessioni = [];
let _tipo = getQueryParam('tipo') === 'training' ? 'training' : 'test';
let _limite = 50;

function passaFiltri(sessione, testo, dataDa, dataA) {
  const nome = nomeStoricoSessione(sessione);
  if (testo && !`${nome} ${sessione.titolo || ''} ${sessione.nomeTestOriginale || ''}`.toLowerCase().includes(testo)) return false;
  if (dataDa && sessione.data < dataDa) return false;
  if (dataA && sessione.data > dataA) return false;
  return true;
}

function chiaveDuplicatoLayout(sessione) {
  return [
    sessione.data || '',
    nomeStoricoSessione(sessione).trim().toLowerCase(),
    firmaValoriStorico(sessione),
  ].join('||');
}

/*
 * Non elimina dati Firestore: nello storico fonde solo le righe perfettamente
 * identiche per data + nome protocollo + valori. Le prove ripetute restano
 * tracciate con il contatore "N prove uguali".
 */
function deduplicaPerLayout(sessioni) {
  const mappa = new Map();
  sessioni.forEach((sessione) => {
    const chiave = chiaveDuplicatoLayout(sessione);
    const esistente = mappa.get(chiave);
    if (!esistente) {
      mappa.set(chiave, { ...sessione, _duplicatiLayout: 1 });
      return;
    }
    esistente._duplicatiLayout += 1;
  });
  return [...mappa.values()];
}

function gruppiPerNome(sessioni) {
  const mappa = new Map();
  sessioni.forEach((sessione) => {
    const nome = nomeStoricoSessione(sessione);
    const chiave = nome.trim().toLocaleLowerCase('it-IT');
    if (!mappa.has(chiave)) mappa.set(chiave, { nome, sessioni: [] });
    mappa.get(chiave).sessioni.push(sessione);
  });

  return [...mappa.values()]
    .map((gruppo) => ({
      ...gruppo,
      sessioni: gruppo.sessioni.sort((a, b) =>
        String(b.data || '').localeCompare(String(a.data || '')) ||
        String(b.id || '').localeCompare(String(a.id || ''))
      ),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
}

function sessioniTipoCorrente() {
  return _sessioni.filter((s) => _tipo === 'training' ? isSessioneTraining(s) : isSessioneTest(s));
}

function renderSessione(sessione) {
  const metriche = metricheStoricoSessione(sessione, 6);
  if (!metriche.length) return null;

  const top = [
    el('time', { class: 'session-date', text: formatDataIt(sessione.data) }),
  ];
  if (sessione._duplicatiLayout > 1) {
    top.push(el('span', {
      class: 'badge duplicate-count-badge',
      text: `${sessione._duplicatiLayout} prove uguali`,
      title: 'Righe identiche accorpate solo nella visualizzazione',
    }));
  }

  const contenuto = [
    el('div', { class: 'session-list-top' }, top),
    el('div', { class: 'mini-metrics history-metrics' }, metriche.map((m) =>
      el('span', { class: 'mini-metric' }, [
        el('span', { class: 'mini-metric-label', text: m.label }),
        el('strong', { text: m.valore }),
      ])
    )),
  ];

  return el('a', {
    class: 'list-item session-list-item history-value-row',
    href: `./sessione.html?atletaId=${atletaId}&sessioneId=${sessione.id}`,
    style: 'text-decoration:none;color:inherit;',
  }, [
    el('div', { class: 'session-list-content' }, contenuto),
    el('div', { class: 'session-list-arrow', text: '›' }),
  ]);
}

function renderLista() {
  const testo = qs('#filtro-titolo').value.trim().toLowerCase();
  const dataDa = qs('#filtro-da').value;
  const dataA = qs('#filtro-a').value;

  const base = sessioniTipoCorrente();
  const filtrate = base.filter((s) => passaFiltri(s, testo, dataDa, dataA));
  const uniche = deduplicaPerLayout(filtrate)
    .sort((a, b) =>
      nomeStoricoSessione(a).localeCompare(nomeStoricoSessione(b), 'it', { sensitivity: 'base' }) ||
      String(b.data || '').localeCompare(String(a.data || ''))
    );

  const container = qs('#lista-sessioni');
  container.innerHTML = '';

  if (uniche.length === 0) {
    container.appendChild(
      el('div', {
        class: 'empty-state',
        text: base.length === 0
          ? (_tipo === 'training' ? 'Nessun training con valori registrato per questo atleta.' : 'Nessun test con valori registrato per questo atleta.')
          : 'Nessuna sessione con valori corrisponde ai filtri.',
      })
    );
    return;
  }

  const visibili = uniche.slice(0, _limite);
  const gruppi = gruppiPerNome(visibili);
  const conteggiCompleti = new Map(
    gruppiPerNome(uniche).map((g) => [g.nome.trim().toLocaleLowerCase('it-IT'), g.sessioni.length])
  );

  gruppi.forEach((gruppo) => {
    const chiave = gruppo.nome.trim().toLocaleLowerCase('it-IT');
    const n = conteggiCompleti.get(chiave) || gruppo.sessioni.length;
    const lista = el('div', { class: 'list history-group-list' });
    gruppo.sessioni.forEach((sessione) => {
      const item = renderSessione(sessione);
      if (item) lista.appendChild(item);
    });
    if (!lista.children.length) return;

    container.appendChild(el('section', { class: 'history-name-group' }, [
      el('div', { class: 'history-name-header' }, [
        el('h3', { text: gruppo.nome }),
        el('span', { class: 'history-name-count', text: n === 1 ? '1 risultato' : `${n} risultati` }),
      ]),
      lista,
    ]));
  });

  if (uniche.length > _limite) {
    container.appendChild(el('button', {
      class: 'secondary',
      text: `Mostra altri risultati (${uniche.length - _limite})`,
      onclick: () => {
        _limite += 50;
        renderLista();
      },
    }));
  }
}

function aggiornaTipoStorico() {
  const testAttivo = _tipo === 'test';
  qs('#tab-test').classList.toggle('secondary', !testAttivo);
  qs('#tab-training').classList.toggle('secondary', testAttivo);
  qs('#storico-heading').textContent = testAttivo ? 'Test' : 'Training';
  qs('#storico-description').textContent = testAttivo
    ? 'Valutazioni Test raggruppate per nome del protocollo, con i soli risultati valorizzati.'
    : 'Training raggruppati per nome del protocollo, con i soli risultati valorizzati.';
  const atleta = qs('#titolo-pagina').dataset.atleta || '';
  qs('#titolo-pagina').textContent = `${testAttivo ? 'Test' : 'Training'} — ${atleta}`;
  const url = new URL(window.location.href);
  url.searchParams.set('tipo', _tipo);
  history.replaceState(null, '', url);
  _limite = 50;
  renderLista();
}

function azzeraFiltriStorico() {
  qs('#filtro-titolo').value = '';
  qs('#filtro-da').value = '';
  qs('#filtro-a').value = '';
}

qs('#tab-test').addEventListener('click', () => {
  _tipo = 'test';
  azzeraFiltriStorico();
  aggiornaTipoStorico();
});

qs('#tab-training').addEventListener('click', () => {
  _tipo = 'training';
  azzeraFiltriStorico();
  aggiornaTipoStorico();
});

qs('#filtro-titolo').addEventListener('input', debounce(renderLista, 150));
qs('#filtro-da').addEventListener('change', renderLista);
qs('#filtro-a').addEventListener('change', renderLista);

async function init() {
  const user = await richiedeLogin();
  if (!user) return;

  const atleta = await dbGetAtleta(atletaId);
  if (!atleta) {
    window.location.href = './index.html';
    return;
  }

  qs('#back-link').href = `./atleta.html?id=${atletaId}`;
  qs('#titolo-pagina').dataset.atleta = nomeCompleto(atleta);
  document.title = `Storico ${nomeCompleto(atleta)} - Test Visivi`;

  _sessioni = (await dbGetSessioniByAtleta(atletaId)).filter(sessioneHaRisultatiVisibili);
  qs('#count-test').textContent = String(deduplicaPerLayout(_sessioni.filter(isSessioneTest)).length);
  qs('#count-training').textContent = String(deduplicaPerLayout(_sessioni.filter(isSessioneTraining)).length);
  aggiornaTipoStorico();
}

init().catch(mostraErrorePagina);
