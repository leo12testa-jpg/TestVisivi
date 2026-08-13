registerServiceWorker();

function log(msg) {
  qs('#log').appendChild(el('div', { text: msg }));
}

async function migraAtleta(atletaLegacy) {
  if (atletaLegacy._migrato) {
    log(`- Salto ${atletaLegacy.cognome} ${atletaLegacy.nome} (già migrato in precedenza)`);
    return { migrato: false, sessioniOk: 0, fotoOk: 0, videoOk: 0 };
  }

  log(`Migrazione atleta: ${atletaLegacy.cognome} ${atletaLegacy.nome}...`);
  const vecchioAtletaId = atletaLegacy.id;

  const nuovoAtletaId = await dbAddAtleta({ nome: atletaLegacy.nome, cognome: atletaLegacy.cognome });
  const nuovoAtleta = await dbGetAtleta(nuovoAtletaId);
  nuovoAtleta.altezza = atletaLegacy.altezza ?? '';
  nuovoAtleta.dataNascita = atletaLegacy.dataNascita ?? '';
  nuovoAtleta.telefono = atletaLegacy.telefono ?? '';
  nuovoAtleta.email = atletaLegacy.email ?? '';
  if (atletaLegacy.datiClinici) nuovoAtleta.datiClinici = atletaLegacy.datiClinici;
  await dbUpdateAtleta(nuovoAtleta);

  const sessioniLegacy = await dbLegacyGetSessioniByAtleta(vecchioAtletaId);
  let sessioniOk = 0;
  let fotoOk = 0;
  let videoOk = 0;

  for (const sessioneLegacy of sessioniLegacy) {
    const vecchioSessioneId = sessioneLegacy.id;
    const nuovaSessione = {
      atletaId: nuovoAtletaId,
      data: sessioneLegacy.data,
      titolo: sessioneLegacy.titolo || '',
      esercizi: sessioneLegacy.esercizi || {},
    };
    const nuovoSessioneId = await dbAddSessione(nuovaSessione);
    sessioniOk++;

    await dbLegacyRilegaAllegati('allegati_foto', vecchioSessioneId, nuovoSessioneId);
    await dbLegacyRilegaAllegati('allegati_video', vecchioSessioneId, nuovoSessioneId);
    fotoOk += (await dbGetAllegatiFotoBySessione(nuovoSessioneId)).length;
    videoOk += (await dbGetAllegatiVideoBySessione(nuovoSessioneId)).length;
  }

  await dbLegacyMarkAtletaMigrato(atletaLegacy);
  log(`  → ${sessioniOk} sessioni migrate, ${fotoOk} foto e ${videoOk} video ricollegati.`);
  return { migrato: true, sessioniOk, fotoOk, videoOk };
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
}

qs('#btn-avvia').addEventListener('click', async () => {
  const btn = qs('#btn-avvia');
  btn.disabled = true;
  qs('#log').innerHTML = '';

  const atletiLegacy = await dbLegacyGetAtleti();
  if (atletiLegacy.length === 0) {
    log('Nessun dato locale trovato in questo browser: niente da migrare.');
    btn.disabled = false;
    return;
  }

  let atletiMigrati = 0;
  let sessioniTot = 0;
  let fotoTot = 0;
  let videoTot = 0;

  for (const atletaLegacy of atletiLegacy) {
    try {
      const risultato = await migraAtleta(atletaLegacy);
      if (risultato.migrato) atletiMigrati++;
      sessioniTot += risultato.sessioniOk;
      fotoTot += risultato.fotoOk;
      videoTot += risultato.videoOk;
    } catch (err) {
      log(`ERRORE su ${atletaLegacy.cognome} ${atletaLegacy.nome}: ${err.message}`);
    }
  }

  log('---');
  log(`Completato: ${atletiMigrati} nuovi atleti migrati, ${sessioniTot} sessioni, ${fotoTot} foto e ${videoTot} video ricollegati.`);
  btn.disabled = false;
});

init();
