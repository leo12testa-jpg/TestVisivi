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
    const n = _atleti.filter((a) => a.squadraId === s.id).length;
    const item = el('div', { class: 'list-item' }, [
      el('div', {}, [el('div', { text: s.nome }), el('div', { class: 'meta', text: `${n} atlet${n === 1 ? 'a' : 'i'}` })]),
      el('button', {
        class: 'danger',
        text: 'Elimina',
        onclick: async () => {
          const messaggio =
            n > 0
              ? `Eliminare la squadra "${s.nome}"? I ${n} atlet${n === 1 ? 'a' : 'i'} assegnat${n === 1 ? 'o' : 'i'} NON vengono eliminat${n === 1 ? 'o' : 'i'}: resterà${n === 1 ? '' : 'nno'} senza squadra.`
              : `Eliminare la squadra "${s.nome}"?`;
          if (!confirm(messaggio)) return;
          await dbDeleteSquadra(s.id);
          await carica();
        },
      }),
    ]);
    container.appendChild(item);
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
