registerServiceWorker();

let _atleti = [];

function scaricaJsonArchivio(dati, nomeFile) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }));
  const link = el('a', { href: url, download: nomeFile });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function aggiornaAvvisoDoppioni() {
  const banner = qs('#duplicate-banner');
  const count = qs('#duplicate-count');
  if (!banner || !count || typeof archivioTrovaDoppioniAtleti !== 'function') return;
  const gruppi = archivioTrovaDoppioniAtleti(_atleti, {});
  banner.hidden = gruppi.length === 0;
  count.textContent = gruppi.length === 1
    ? '1 doppione rilevato'
    : `${gruppi.length} gruppi duplicati rilevati`;
}

async function caricaLista() {
  const user = await richiedeLogin();
  if (!user) return;

  try {
    _atleti = await dbGetAtleti();
    qs('#numero-atleti').textContent = String(_atleti.length);
    aggiornaAvvisoDoppioni();
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

qs('#btn-unisci-doppioni').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const gruppi = archivioTrovaDoppioniAtleti(_atleti, {});
  if (!gruppi.length) {
    aggiornaAvvisoDoppioni();
    return;
  }

  if (!confirm(`Sono stati rilevati ${gruppi.length} gruppi duplicati. Verrà prima scaricato un backup, poi le sessioni saranno accorpate sul profilo principale. Continuare?`)) return;

  button.disabled = true;
  button.textContent = 'Unione in corso…';
  try {
    const backup = await dbEsportaCopiaDati();
    scaricaJsonArchivio(backup, `testvisivi-prima-unione-doppioni-${oggiIso()}.json`);

    await dbCorreggiNomiAtleti();
    const esito = await dbUnisciDoppioniAtleti();
    await caricaLista();

    const residui = archivioTrovaDoppioniAtleti(_atleti, {});
    alert(
      `Doppioni uniti: ${esito.gruppiUniti} gruppi. ` +
      `Profili rimossi: ${esito.profiliEliminati}. ` +
      `Sessioni riassegnate: ${esito.sessioniRiassegnate}. ` +
      `Doppioni residui: ${residui.length}.`
    );
  } catch (err) {
    mostraErrorePagina(err);
  } finally {
    button.disabled = false;
    button.textContent = 'Unisci doppioni';
  }
});

qs('#btn-sistema-archivio').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!confirm('Prima verrà scaricata una copia di sicurezza. Poi verranno corretti i nomi, uniti i profili duplicati e rimossi tutti i blocchi test senza valori reali. Continuare?')) return;

  button.disabled = true;
  button.textContent = 'Backup e sistemazione…';
  try {
    const backup = await dbEsportaCopiaDati();
    scaricaJsonArchivio(backup, `testvisivi-prima-pulizia-${oggiIso()}.json`);

    const nomiAggiornati = await dbCorreggiNomiAtleti();
    const unione = await dbUnisciDoppioniAtleti();
    const testPuliti = await dbPulisciTestVuoti();
    const sessioniEliminate = await dbPulisciSessioniVuote();
    const residui = await dbAnalizzaDoppioniAtleti();
    await caricaLista();

    alert(
      `Archivio sistemato. Backup scaricato. ` +
      `Nomi aggiornati: ${nomiAggiornati}. ` +
      `Doppioni uniti: ${unione.gruppiUniti} gruppi / ${unione.profiliEliminati} profili rimossi. ` +
      `Sessioni riassegnate: ${unione.sessioniRiassegnate}. ` +
      `Test vuoti rimossi: ${testPuliti.blocchiRimossi} in ${testPuliti.sessioniAggiornate} sessioni. ` +
      `Sessioni vuote eliminate: ${sessioniEliminate}. ` +
      `Doppioni compatibili residui: ${residui.length}.`
    );
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
    scaricaJsonArchivio(dati, `testvisivi-backup-${oggiIso()}.json`);
  } catch (err) { mostraErrorePagina(err); }
  finally { button.disabled = false; button.textContent = 'Esporta copia dati'; }
});

caricaLista();
