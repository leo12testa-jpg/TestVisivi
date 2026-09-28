registerServiceWorker();

const atletaId = getQueryParam('atletaId');
let _sessioni = [];
let _limite = 50;

function passaFiltri(sessione, testo, dataDa, dataA) {
  if (testo && !`${nomeTestSessione(sessione)} ${sessione.titolo || ''} ${sessione.nomeTestOriginale || ''}`.toLowerCase().includes(testo)) return false;
  if (dataDa && sessione.data < dataDa) return false;
  if (dataA && sessione.data > dataA) return false;
  return true;
}

function renderLista() {
  const testo = qs('#filtro-titolo').value.trim().toLowerCase();
  const dataDa = qs('#filtro-da').value;
  const dataA = qs('#filtro-a').value;

  const filtrate = [..._sessioni].reverse().filter((s) => passaFiltri(s, testo, dataDa, dataA));

  const container = qs('#lista-sessioni');
  container.innerHTML = '';

  if (filtrate.length === 0) {
    container.appendChild(
      el('div', {
        class: 'empty-state',
        text: _sessioni.length === 0 ? 'Nessuna sessione registrata per questo atleta.' : 'Nessuna sessione corrisponde ai filtri.',
      })
    );
    return;
  }

  filtrate.slice(0, _limite).forEach((s) => {
    const metriche = metrichePrincipaliSessione(s).slice(0, 3);
    const top = [el('time', { class: 'session-date', text: formatDataIt(s.data) })];
    if (isSessioneTraining(s)) top.push(el('span', { class: 'badge', text: 'Allenamento' }));

    const contenuto = [
      el('div', { class: 'session-list-top' }, top),
      el('div', { class: 'session-list-test', text: nomeTestSessione(s) }),
    ];

    if (metriche.length) {
      contenuto.push(el('div', { class: 'mini-metrics' }, metriche.map((m) =>
        el('span', { class: 'mini-metric' }, [
          el('span', { class: 'mini-metric-label', text: m.label }),
          el('strong', { text: m.valore }),
        ])
      )));
    } else {
      contenuto.push(el('div', { class: 'meta', text: riepilogoSessione(s) }));
    }

    const item = el('a', { class: 'list-item session-list-item', href: `./sessione.html?atletaId=${atletaId}&sessioneId=${s.id}`, style: 'text-decoration:none;color:inherit;' }, [
      el('div', { class: 'session-list-content' }, contenuto),
      el('div', { class: 'session-list-arrow', text: '›' }),
    ]);
    container.appendChild(item);
  });
  if (filtrate.length > _limite) container.appendChild(el('button', { class: 'secondary', text: `Mostra altre sessioni (${filtrate.length - _limite})`, onclick: () => { _limite += 50; renderLista(); } }));
}

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
  qs('#titolo-pagina').textContent = `Tutte le sessioni — ${nomeCompleto(atleta)}`;
  document.title = `Tutte le sessioni ${nomeCompleto(atleta)} - Test Visivi`;

  _sessioni = await dbGetSessioniByAtleta(atletaId);
  renderLista();
}

init().catch(mostraErrorePagina);
