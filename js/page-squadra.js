registerServiceWorker();

const squadraId = getQueryParam('squadraId');
const modoSenzaSquadra = getQueryParam('senzaSquadra') === '1';

let _atleti = []; // già filtrati in base al contesto (squadra / tutti / senza squadra)

async function popolaSelectSquadraNuovoAtleta() {
  const squadre = await dbGetSquadre();
  const select = qs('#nuovo-squadra');
  select.innerHTML = '';
  select.appendChild(el('option', { value: '', text: 'Nessuna squadra' }));
  squadre.forEach((s) => select.appendChild(el('option', { value: s.id, text: s.nome })));
  select.value = squadraId || '';
}

function renderLista(filtro) {
  const container = qs('#lista-atleti');
  container.innerHTML = '';
  const atletiFiltrati = _atleti.filter(
    (a) => !filtro || nomeCompleto(a).toLowerCase().includes(filtro) || a.nome.toLowerCase().includes(filtro) || a.cognome.toLowerCase().includes(filtro)
  );

  if (atletiFiltrati.length === 0) {
    container.appendChild(
      el('div', { class: 'empty-state', text: _atleti.length === 0 ? 'Nessun atleta qui.' : 'Nessun atleta corrisponde alla ricerca.' })
    );
    return;
  }

  atletiFiltrati.forEach((a) => {
    const nSessioni = a._sessioni.length;
    const ultima = nSessioni ? formatDataIt(a._sessioni[nSessioni - 1].data) : null;
    const metaText = nSessioni === 0 ? 'Nessuna sessione' : `${nSessioni} session${nSessioni === 1 ? 'e' : 'i'} · ultima: ${ultima}`;

    const item = el('a', { class: 'list-item', href: `./atleta.html?id=${a.id}`, style: 'text-decoration:none;color:inherit;' }, [
      el('div', {}, [el('div', { text: nomeCompleto(a) }), el('div', { class: 'meta', text: metaText })]),
      el('div', { text: '›', style: 'color:var(--text-muted);font-size:1.3rem;' }),
    ]);
    container.appendChild(item);
  });
}

async function caricaLista() {
  const tutti = await dbGetAtleti();
  const conteggi = await Promise.all(tutti.map((a) => dbGetSessioniByAtleta(a.id)));
  tutti.forEach((a, i) => {
    a._sessioni = conteggi[i];
  });

  if (squadraId) {
    _atleti = tutti.filter((a) => a.squadraId === squadraId);
  } else if (modoSenzaSquadra) {
    _atleti = tutti.filter((a) => !a.squadraId);
  } else {
    _atleti = tutti;
  }

  renderLista(qs('#ricerca').value.trim().toLowerCase());
}

qs('#ricerca').addEventListener(
  'input',
  debounce((e) => renderLista(e.target.value.trim().toLowerCase()), 150)
);

qs('#btn-nuovo-atleta').addEventListener('click', () => {
  qs('#form-nuovo-atleta').hidden = false;
  qs('#nuovo-nome').focus();
});

qs('#btn-annulla-atleta').addEventListener('click', () => {
  qs('#form-nuovo-atleta').hidden = true;
  qs('#nuovo-nome').value = '';
  qs('#nuovo-cognome').value = '';
});

qs('#btn-crea-atleta').addEventListener('click', async () => {
  const nome = qs('#nuovo-nome').value.trim();
  const cognome = qs('#nuovo-cognome').value.trim();
  if (!nome) {
    qs('#nuovo-nome').focus();
    return;
  }
  if (!cognome) {
    qs('#nuovo-cognome').focus();
    return;
  }
  const squadraSelezionata = qs('#nuovo-squadra').value;
  const id = await dbAddAtleta({ nome, cognome, squadraId: squadraSelezionata });
  window.location.href = `./atleta.html?id=${id}`;
});

async function init() {
  const user = await richiedeLogin();
  if (!user) return;

  let titolo = 'Tutti gli atleti';
  if (squadraId) {
    const squadra = await dbGetSquadra(squadraId);
    if (!squadra) {
      window.location.href = './index.html';
      return;
    }
    titolo = squadra.nome;
    qs('#btn-confronta-squadra').hidden = false;
    qs('#btn-confronta-squadra').href = `./confronto.html?squadraId=${squadraId}`;
  } else if (modoSenzaSquadra) {
    titolo = 'Senza squadra';
  }
  qs('#titolo-pagina').textContent = titolo;
  document.title = `${titolo} - JetProgram Tracker`;

  await popolaSelectSquadraNuovoAtleta();
  await caricaLista();
}

init();
