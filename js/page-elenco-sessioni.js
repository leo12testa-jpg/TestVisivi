registerServiceWorker();

const atletaId = getQueryParam('atletaId');
let _sessioni = [];

function passaFiltri(sessione, testo, dataDa, dataA) {
  if (testo && !(sessione.titolo || '').toLowerCase().includes(testo)) return false;
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

  filtrate.forEach((s) => {
    const nEsercizi = contaEserciziCompilati(s);
    const etichettaData = s.titolo ? `${formatDataIt(s.data)} · ${s.titolo}` : formatDataIt(s.data);
    const item = el('a', { class: 'list-item', href: `./sessione.html?atletaId=${atletaId}&sessioneId=${s.id}`, style: 'text-decoration:none;color:inherit;' }, [
      el('div', {}, [
        el('div', { text: etichettaData }),
        el('div', { class: 'meta', text: `${nEsercizi} esercizi${nEsercizi === 1 ? 'o' : ''} compilat${nEsercizi === 1 ? 'o' : 'i'}` }),
      ]),
      el('div', { text: '›', style: 'color:var(--text-muted);font-size:1.3rem;' }),
    ]);
    container.appendChild(item);
  });
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

init();
