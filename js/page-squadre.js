registerServiceWorker();

let _squadre = [];
let _atleti = [];

function render() {
  const container = qs('#lista-squadre');
  container.innerHTML = '';

  if (_squadre.length === 0) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessuna squadra ancora. Creane una qui sopra.' }));
    return;
  }

  _squadre.forEach((s) => {
    const atletiSquadra = _atleti
      .filter((a) => a.squadraId === s.id)
      .sort((a, b) => nomeCompleto(a).localeCompare(nomeCompleto(b)));
    const n = atletiSquadra.length;

    const listaAtleti = el('div', { class: 'list', style: 'margin-top:10px;' });
    if (n === 0) {
      listaAtleti.appendChild(el('div', { class: 'empty-state', text: 'Nessun atleta in questa squadra.' }));
    } else {
      atletiSquadra.forEach((a) => {
        listaAtleti.appendChild(
          el('a', { class: 'list-item', href: `./atleta.html?id=${a.id}`, style: 'text-decoration:none;color:inherit;' }, [
            el('div', { text: nomeCompleto(a) }),
            el('div', { text: '›', style: 'color:var(--text-muted);font-size:1.3rem;' }),
          ])
        );
      });
    }

    const btnElimina = el('button', {
      class: 'danger',
      text: 'Elimina squadra',
      style: 'margin-top:12px;',
      onclick: async () => {
        const messaggio =
          n > 0
            ? `Eliminare la squadra "${s.nome}"? I ${n} atlet${n === 1 ? 'a' : 'i'} assegnat${n === 1 ? 'o' : 'i'} NON vengono eliminat${n === 1 ? 'o' : 'i'}: resterà${n === 1 ? '' : 'nno'} senza squadra.`
            : `Eliminare la squadra "${s.nome}"?`;
        if (!confirm(messaggio)) return;
        await dbDeleteSquadra(s.id);
        await carica();
      },
    });

    const details = el('details', { class: 'esercizio', name: 'squadre' }, [
      el('summary', {}, [el('div', { text: s.nome }), el('div', { class: 'meta', text: `${n} atlet${n === 1 ? 'a' : 'i'}` })]),
      el('div', { class: 'esercizio-body' }, [listaAtleti, btnElimina]),
    ]);
    container.appendChild(details);
  });
}

async function carica() {
  _squadre = await dbGetSquadre();
  _atleti = await dbGetAtleti();
  render();
}

qs('#btn-crea-squadra').addEventListener('click', async () => {
  const input = qs('#nuovo-nome-squadra');
  const nome = input.value.trim();
  if (!nome) {
    input.focus();
    return;
  }
  await dbAddSquadra({ nome });
  input.value = '';
  await carica();
});

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  await carica();
}

init();
