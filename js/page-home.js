registerServiceWorker();

async function init() {
  const user = await richiedeLogin();
  if (!user) return;

  const [squadre, atleti] = await Promise.all([dbGetSquadre(), dbGetAtleti()]);

  const listaSquadre = qs('#lista-squadre');
  listaSquadre.innerHTML = '';
  if (squadre.length === 0) {
    listaSquadre.appendChild(el('div', { class: 'empty-state', text: 'Nessuna squadra ancora. Creane una da "Gestisci squadre".' }));
  } else {
    squadre.forEach((s) => {
      const n = atleti.filter((a) => a.squadraId === s.id).length;
      listaSquadre.appendChild(
        el('a', { class: 'list-item', href: `./squadra.html?squadraId=${s.id}`, style: 'text-decoration:none;color:inherit;' }, [
          el('div', {}, [el('div', { text: s.nome }), el('div', { class: 'meta', text: `${n} atlet${n === 1 ? 'a' : 'i'}` })]),
          el('div', { text: '›', style: 'color:var(--text-muted);font-size:1.3rem;' }),
        ])
      );
    });
  }

  const senzaSquadra = atleti.filter((a) => !a.squadraId).length;
  const listaAltro = qs('#lista-altro');
  listaAltro.innerHTML = '';
  listaAltro.appendChild(
    el('a', { class: 'list-item', href: './squadra.html?tutti=1', style: 'text-decoration:none;color:inherit;' }, [
      el('div', { text: 'Tutti gli atleti' }),
      el('div', { text: `${atleti.length}`, class: 'meta' }),
    ])
  );
  listaAltro.appendChild(
    el('a', { class: 'list-item', href: './squadra.html?senzaSquadra=1', style: 'text-decoration:none;color:inherit;' }, [
      el('div', { text: 'Senza squadra' }),
      el('div', { text: `${senzaSquadra}`, class: 'meta' }),
    ])
  );
  listaAltro.appendChild(
    el('a', { class: 'list-item', href: './squadre.html', style: 'text-decoration:none;color:inherit;' }, [
      el('div', { text: '⚙ Gestisci squadre' }),
      el('div', { text: '›', style: 'color:var(--text-muted);font-size:1.3rem;' }),
    ])
  );
}

init();
