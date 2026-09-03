registerServiceWorker();

/*
 * Import massivo/idempotente delle anagrafiche in DATI_ANAGRAFICHE_IMPORT (vedi
 * js/import-anagrafiche-dati.js) nell'utente autenticato corrente. Nessun UID
 * hardcoded: dbAddAtleta/dbGetAtleta/dbUpdateAtleta operano già sull'utente loggato
 * (vedi js/db.js, _uid()).
 */

function log(msg) {
  qs('#log').appendChild(el('div', { text: msg }));
}

/** "dx"/"DX"/"Dx" -> "Dx", "sx"/"SX" -> "Sx". Altri valori (rx, alternato, sdx, ...) sono
 * preservati come dato originale: solo la capitalizzazione viene uniformata a quella di
 * Dx/Sx, MAI convertiti a Dx o Sx. */
function normalizzaDominanza(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'dx') return 'Dx';
  if (low === 'sx') return 'Sx';
  return low.charAt(0).toUpperCase() + low.slice(1);
}

/** Imposta obj[campo] = valore solo se valore è fornito (non vuoto): non sovrascrive mai
 * un dato già presente con una stringa vuota. Ritorna true solo se il valore cambia
 * davvero (così un rilancio dell'import su dati invariati non conta come "aggiornato"). */
function applicaSeValorizzato(obj, campo, valore) {
  if (valore === undefined || valore === null || valore === '') return false;
  if (obj[campo] === valore) return false;
  obj[campo] = valore;
  return true;
}

async function trovaAtletaEsistente(atleti, cognome, nome) {
  const target = `${cognome} ${nome}`.trim().toLowerCase();
  return atleti.find((a) => `${a.cognome} ${a.nome}`.trim().toLowerCase() === target);
}

async function importaAnagrafica(item, atletiEsistenti) {
  const cognome = item.cognome.trim();
  const nome = '';
  const contesto = cognome;

  let atleta = await trovaAtletaEsistente(atletiEsistenti, cognome, nome);
  let creato = false;
  if (!atleta) {
    const id = await dbAddAtleta({ nome, cognome });
    atleta = await dbGetAtleta(id);
    atletiEsistenti.push(atleta);
    creato = true;
  }

  const dc = atleta.datiClinici || datiCliniciVuoti();
  let modificato = false;

  if (applicaSeValorizzato(dc.acuitaVisiva, 'od', item.avd)) modificato = true;
  if (applicaSeValorizzato(dc.acuitaVisiva, 'os', item.avs)) modificato = true;
  if (applicaSeValorizzato(dc.acuitaVisiva, 'binoculare', item.avoo)) modificato = true;
  if (applicaSeValorizzato(dc, 'manoDominante', normalizzaDominanza(item.mano))) modificato = true;
  if (applicaSeValorizzato(dc, 'piedeDominante', normalizzaDominanza(item.piede))) modificato = true;
  if (applicaSeValorizzato(dc, 'occhioDirettoreMotorio', normalizzaDominanza(item.occhio))) modificato = true;
  atleta.datiClinici = dc;

  if (applicaSeValorizzato(atleta, 'note', item.note)) modificato = true;

  if (creato || modificato) {
    await dbUpdateAtleta(atleta);
  }

  if (creato) {
    log(`Creato: ${contesto}`);
  } else if (modificato) {
    log(`Aggiornato: ${contesto}`);
  } else {
    log(`Invariato (nessun dato da aggiornare): ${contesto}`);
  }

  return { creato, aggiornato: !creato && modificato, invariato: !creato && !modificato };
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
}

qs('#btn-avvia').addEventListener('click', async () => {
  const btn = qs('#btn-avvia');
  btn.disabled = true;
  qs('#log').innerHTML = '';

  let creati = 0;
  let aggiornati = 0;
  let invariati = 0;
  const errori = [];

  try {
    log(`Trovati ${DATI_ANAGRAFICHE_IMPORT.length} atleti nel dataset.`);
    const atletiEsistenti = await dbGetAtleti();

    for (const item of DATI_ANAGRAFICHE_IMPORT) {
      try {
        const risultato = await importaAnagrafica(item, atletiEsistenti);
        if (risultato.creato) creati++;
        else if (risultato.aggiornato) aggiornati++;
        else invariati++;
      } catch (err) {
        log(`ERRORE su "${item.cognome}": ${err.message}`);
        errori.push(`${item.cognome}: ${err.message}`);
      }
    }

    log('---');
    log(`Completato: ${creati} creati, ${aggiornati} aggiornati, ${invariati} invariati${errori.length ? `, ${errori.length} errori` : ''}.`);
    if (errori.length) log(`Errori: ${errori.join(' | ')}`);
  } catch (err) {
    log('ERRORE GENERALE: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

init();
