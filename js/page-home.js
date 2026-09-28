registerServiceWorker();

let _atleti = [];

async function caricaLista() {
  const user = await richiedeLogin();
  if (!user) return;

  try {
    _atleti = await dbGetAtleti();
    qs('#numero-atleti').textContent = String(_atleti.length);
    renderLista(qs('#ricerca').value.trim().toLowerCase());
  } catch (err) {
    console.error('Errore caricamento lista atleti:', err);
    const container = qs('#lista-atleti');
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'empty-state', text: `Impossibile caricare gli atleti: ${err.message}` }));
  }
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
    const metaText = 'Profilo, risultati e andamento';
    const anagrafica = normalizzaAnagraficaCalciatore(a);

    const item = el('a', { class: 'list-item', href: `./atleta.html?id=${a.id}`, style: 'text-decoration:none;color:inherit;' }, [
      el('span', { class: 'avatar', 'aria-hidden': 'true', text: `${(anagrafica.nome || '').slice(0, 1)}${(anagrafica.cognome || '').slice(0, 1)}` }),
      el('div', { class: 'athlete-card-text' }, [el('div', { class: 'athlete-name', text: nomeCompleto(a) }), el('div', { class: 'meta', text: metaText })]),
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

qs('#btn-sistema-archivio').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!confirm('Correggere i nomi dei calciatori e rimuovere le sessioni completamente vuote? I risultati dei test e i dati Jet Program non verranno cancellati.')) return;

  button.disabled = true;
  button.textContent = 'Sistemazione archivio…';
  try {
    const [nomiAggiornati, sessioniEliminate] = await Promise.all([
      dbCorreggiNomiAtleti(),
      dbPulisciSessioniVuote(),
    ]);
    await caricaLista();
    alert(`Archivio sistemato. Nomi aggiornati: ${nomiAggiornati}. Sessioni vuote eliminate: ${sessioniEliminate}.`);
  } catch (err) {
    mostraErrorePagina(err);
  } finally {
    button.disabled = false;
    button.textContent = 'Sistema archivio';
  }
});

qs('#btn-backup').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Preparazione copia…';
  try {
    const dati = await dbEsportaCopiaDati();
    const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }));
    const link = el('a', { href: url, download: `testvisivi-backup-${oggiIso()}.json` });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) { mostraErrorePagina(err); }
  finally { button.disabled = false; button.textContent = 'Esporta copia dati'; }
});

caricaLista();
