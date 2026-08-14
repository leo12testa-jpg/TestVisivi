registerServiceWorker();

async function renderSezioneSquadre() {
  const listaSquadre = qs('#lista-squadre');
  try {
    const squadre = await dbGetSquadre();
    const atleti = await dbGetAtleti();
    listaSquadre.innerHTML = '';
    if (squadre.length === 0) {
      listaSquadre.appendChild(el('div', { class: 'empty-state', text: 'Nessuna squadra ancora. Creane una da "Gestisci squadre".' }));
      return;
    }
    squadre.forEach((s) => {
      const n = atleti.filter((a) => a.squadraId === s.id).length;
      listaSquadre.appendChild(
        el('a', { class: 'list-item', href: `./squadra.html?squadraId=${s.id}`, style: 'text-decoration:none;color:inherit;' }, [
          el('div', {}, [el('div', { text: s.nome }), el('div', { class: 'meta', text: `${n} atlet${n === 1 ? 'a' : 'i'}` })]),
          el('div', { text: '›', style: 'color:var(--text-muted);font-size:1.3rem;' }),
        ])
      );
    });
  } catch (err) {
    console.error('Errore caricamento squadre:', err);
    listaSquadre.innerHTML = '';
    listaSquadre.appendChild(el('div', { class: 'empty-state', text: 'Impossibile caricare le squadre. Riprova più tardi.' }));
  }
}

async function renderSezioneAltro() {
  const listaAltro = qs('#lista-altro');
  try {
    const atleti = await dbGetAtleti();
    const senzaSquadra = atleti.filter((a) => !a.squadraId).length;

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
  } catch (err) {
    console.error('Errore caricamento elenco atleti:', err);
    listaAltro.innerHTML = '';
    listaAltro.appendChild(el('div', { class: 'empty-state', text: 'Impossibile caricare questa sezione. Riprova più tardi.' }));
  }
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;

  await Promise.allSettled([renderSezioneSquadre(), renderSezioneAltro()]);
}

init();
