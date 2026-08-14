registerServiceWorker();

let _atleti = [];

async function caricaLista() {
  const user = await richiedeLogin();
  if (!user) return;

  _atleti = await dbGetAtleti();
  const conteggi = await Promise.all(_atleti.map((a) => dbGetSessioniByAtleta(a.id)));
  _atleti.forEach((a, i) => {
    a._sessioni = conteggi[i];
  });
  renderLista(qs('#ricerca').value.trim().toLowerCase());
}

function renderLista(filtro) {
  const container = qs('#lista-atleti');
  container.innerHTML = '';
  const atletiFiltrati = _atleti.filter(
    (a) => !filtro || nomeCompleto(a).toLowerCase().includes(filtro) || a.nome.toLowerCase().includes(filtro) || a.cognome.toLowerCase().includes(filtro)
  );

  if (atletiFiltrati.length === 0) {
    container.appendChild(
      el('div', { class: 'empty-state', text: _atleti.length === 0 ? 'Nessun atleta ancora. Crea il primo con "Nuovo atleta".' : 'Nessun atleta corrisponde alla ricerca.' })
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
  const id = await dbAddAtleta({ nome, cognome });
  window.location.href = `./atleta.html?id=${id}`;
});

caricaLista();
