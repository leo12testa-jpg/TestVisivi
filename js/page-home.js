registerServiceWorker();

let _atleti = [];
let _squadreHome = [];
let _organizzaSquadre = false;
const _selezionatiSquadra = new Set();

function aggiornaSquadreHome() {
  for (const id of ['filtro-squadra', 'squadra-destinazione']) {
    const select = qs('#' + id);
    const precedente = select.value;
    select.replaceChildren(el('option', { value: '', text: id === 'filtro-squadra' ? 'Tutte le squadre' : 'Scegli squadra…' }),
      el('option', { value: '__nessuna__', text: 'Senza squadra' }));
    _squadreHome.forEach((s) => select.appendChild(el('option', { value: s.id, text: s.nome })));
    if ([...select.options].some((o) => o.value === precedente)) select.value = precedente;
  }
}
function atletiVisibiliHome(filtro) {
  const squadra = qs('#filtro-squadra').value;
  return _atleti.filter((a) =>
    (!filtro || nomeCompleto(a).toLowerCase().includes(filtro)) &&
    (!squadra || (squadra === '__nessuna__' ? !a.squadraId : a.squadraId === squadra)));
}
function aggiornaSelezioneSquadra() {
  qs('#selezione-conteggio').textContent = _selezionatiSquadra.size + ' selezionati';
  qs('#assegna-giocatori').disabled = !_selezionatiSquadra.size || !qs('#squadra-destinazione').value;
}
function renderHome() { renderLista(qs('#ricerca').value.trim().toLowerCase()); }


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
    [_atleti, _squadreHome] = await Promise.all([dbGetAtleti(), dbGetSquadre()]);
    aggiornaSquadreHome();
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
  const atletiFiltrati = atletiVisibiliHome(filtro);

  if (atletiFiltrati.length === 0) {
    container.appendChild(
      el('div', { class: 'empty-state', text: _atleti.length === 0 ? 'Nessun atleta ancora. Crea il primo con "Nuovo atleta".' : 'Nessun atleta corrisponde alla ricerca.' })
    );
    return;
  }

  atletiFiltrati.forEach((a) => {
    const anagrafica = normalizzaAnagraficaCalciatore(a);

    const item = el('a', { class: 'list-item', href: `./atleta.html?id=${a.id}`, style: 'text-decoration:none;color:inherit;' }, [
      el('span', { class: 'avatar', 'aria-hidden': 'true', text: `${(anagrafica.nome || '').slice(0, 1)}${(anagrafica.cognome || '').slice(0, 1)}` }),
      el('div', { class: 'athlete-card-text' }, [el('div', { class: 'athlete-name', text: nomeCompleto(a) })]),
      el('div', { text: '›', style: 'color:var(--text-muted);font-size:1.3rem;' }),
    ]);
    const squadra = _squadreHome.find((s) => s.id === a.squadraId);
    item.querySelector('.athlete-card-text').appendChild(el('div', { class: 'team-caption', text: squadra?.nome || 'Senza squadra' }));
    if (_organizzaSquadre) {
      const check = el('input', { type: 'checkbox', 'aria-label': 'Seleziona ' + nomeCompleto(a) });
      check.checked = _selezionatiSquadra.has(a.id);
      check.addEventListener('change', () => {
        if (check.checked) _selezionatiSquadra.add(a.id); else _selezionatiSquadra.delete(a.id);
        aggiornaSelezioneSquadra();
      });
      container.appendChild(el('div', { class: 'team-select-card' }, [check, item]));
    } else container.appendChild(item);
  });
}

qs('#ricerca').addEventListener(
  'input',
  () => { _selezionatiSquadra.clear(); aggiornaSelezioneSquadra(); renderHome(); }
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
  if (!confirm('Prima verrà scaricata una copia di sicurezza. Poi verranno corretti i nomi, uniti i profili duplicati, riclassificati i report Jet, rimossi i blocchi senza valori reali e cancellati solo i Training chiaramente accidentali (vuoti o con durata totale fino a 5 secondi). Continuare?')) return;

  button.disabled = true;
  button.textContent = 'Backup e sistemazione…';
  try {
    const backup = await dbEsportaCopiaDati();
    scaricaJsonArchivio(backup, `testvisivi-prima-pulizia-${oggiIso()}.json`);

    const nomiAggiornati = await dbCorreggiNomiAtleti();
    const unione = await dbUnisciDoppioniAtleti();
    const classificazioneJet = await dbRiclassificaSessioniJet();
    const testPuliti = await dbPulisciTestVuoti();
    const trainingPuliti = await dbPulisciTrainingAccidentali(5);
    const sessioniEliminate = await dbPulisciSessioniVuote();
    const residui = await dbAnalizzaDoppioniAtleti();
    await caricaLista();

    alert(
      `Archivio sistemato. Backup scaricato. ` +
      `Nomi aggiornati: ${nomiAggiornati}. ` +
      `Doppioni uniti: ${unione.gruppiUniti} gruppi / ${unione.profiliEliminati} profili rimossi. ` +
      `Sessioni riassegnate: ${unione.sessioniRiassegnate}. ` +
      `Jet riclassificati: ${classificazioneJet.aggiornate} (${classificazioneJet.test} test / ${classificazioneJet.training} training). ` +
      `Test vuoti rimossi: ${testPuliti.blocchiRimossi} in ${testPuliti.sessioniAggiornate} sessioni. ` +
      `Training accidentali rimossi: ${trainingPuliti.eliminati} (${trainingPuliti.vuoti} vuoti / ${trainingPuliti.brevi} fino a ${trainingPuliti.sogliaSecondi}s). ` +
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

qs('#filtro-squadra').addEventListener('change', () => {
  _selezionatiSquadra.clear(); aggiornaSelezioneSquadra(); renderHome();
});
qs('#organizza-squadre').addEventListener('click', () => {
  _organizzaSquadre = !_organizzaSquadre;
  qs('#assegna-squadre').hidden = !_organizzaSquadre;
  qs('#organizza-squadre').setAttribute('aria-expanded', String(_organizzaSquadre));
  _selezionatiSquadra.clear(); aggiornaSelezioneSquadra(); renderHome();
});
qs('#seleziona-visibili').addEventListener('click', () => {
  atletiVisibiliHome(qs('#ricerca').value.trim().toLowerCase()).forEach((a) => _selezionatiSquadra.add(a.id));
  aggiornaSelezioneSquadra(); renderHome();
});
qs('#svuota-selezione').addEventListener('click', () => {
  _selezionatiSquadra.clear(); aggiornaSelezioneSquadra(); renderHome();
});
qs('#squadra-destinazione').addEventListener('change', aggiornaSelezioneSquadra);
qs('#crea-squadra-rapida').addEventListener('click', async (event) => {
  const nome = qs('#squadra-rapida-nome').value.trim();
  if (!nome) return qs('#squadra-rapida-nome').focus();
  event.currentTarget.disabled = true;
  try {
    let squadra = _squadreHome.find((s) => s.nome.toLocaleLowerCase('it') === nome.toLocaleLowerCase('it'));
    if (!squadra) {
      squadra = { id: await dbAddSquadra({ nome }), nome };
      _squadreHome.push(squadra);
      _squadreHome.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    aggiornaSquadreHome();
    qs('#squadra-destinazione').value = squadra.id;
    qs('#squadra-rapida-nome').value = '';
    aggiornaSelezioneSquadra();
  } catch (err) { mostraErrorePagina(err); }
  finally { qs('#crea-squadra-rapida').disabled = false; }
});
qs('#assegna-giocatori').addEventListener('click', async () => {
  const scelta = qs('#squadra-destinazione').value;
  const ids = [..._selezionatiSquadra];
  if (!scelta || !ids.length) return;
  const squadraId = scelta === '__nessuna__' ? '' : scelta;
  qs('#assegna-squadre').disabled = true;
  qs('#organizza-squadre').disabled = true;
  qs('#ricerca').disabled = true;
  qs('#filtro-squadra').disabled = true;
  let riusciti = 0;
  try {
    for (const id of ids) {
      await dbAssegnaSquadraAtleta(id, squadraId);
      const atleta = _atleti.find((a) => a.id === id);
      if (atleta) atleta.squadraId = squadraId;
      _selezionatiSquadra.delete(id);
      riusciti++;
    }
    qs('#squadre-esito').textContent = riusciti + ' giocatori aggiornati.';
  } catch (err) {
    qs('#squadre-esito').textContent = riusciti + ' giocatori aggiornati; gli altri restano selezionati. Riprova. ' + err.message;
  } finally {
    qs('#assegna-squadre').disabled = false;
    qs('#organizza-squadre').disabled = false;
    qs('#ricerca').disabled = false;
    qs('#filtro-squadra').disabled = false;
    aggiornaSelezioneSquadra(); renderHome();
  }
});
