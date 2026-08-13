registerServiceWorker();

/*
 * Mappatura chiavi esercizio del JSON storico -> chiavi reali di ESERCIZI_CONFIG.
 */
const MAPPA_ESERCIZI = {
  equilibrio: 'localizzazioneSpaziale',
  pedana360: 'pedana360',
  sincronizzazione: 'sincronizzazioneRitmica',
  proaction: 'proActionReaction',
  attenzioneseparata: 'attenzioneSeparata',
  vvs: 'vvs',
  velocita: 'velocitaRiconoscimento',
  percezione: 'percezioneCampoVisivo',
  movimentioculari: 'movimentiOculari',
  memorizzazione: 'memorizzazioneSequenze',
};

/* Per ogni esercizio (tranne vvs, gestito a parte): chiave campo JSON -> chiave campo app. */
const MAPPA_CAMPI_PER_ESERCIZIO = {
  equilibrio: { tempoReazioneMedio: 'tempoReazioneMedio', immaginiAlSec: 'immaginiAlSec', immaginiColpite: 'immaginiColpite' },
  pedana360: { tempoReazioneMedio: 'tempoReazioneMedio', immaginiAlSec: 'immaginiAlSec', immaginiColpite: 'immaginiColpite', recuperi: 'recuperi', tempoArea5: 'tempoArea5', tempoAreaEsterna: 'tempoAreaEsterna' },
  sincronizzazione: {
    percentualeSuccesso: 'percentualeSuccesso',
    nTarget: 'nTarget',
    tempoReazioneMedio: 'tempoReazioneMedio',
    errori: 'errori',
    sino: 'siNo',
    svincolaCingoloPelvico: 'svincolaCingoloPelvico',
    rigidita: 'rigidita',
    naturalmenteSincrono: 'naturalmenteSincrono',
  },
  proaction: { tempoRilascioMedio: 'tempoRilascioMedio', tempoClickMedio: 'tempoClickMedio', tempoTotale: 'tempoTotale', errori: 'errori' },
  attenzioneseparata: {
    tempoTotale: 'tempoTotale',
    tempoReazioneMedio: 'tempoReazioneMedio',
    immaginiColpite: 'immaginiColpite',
    centrale: 'centrale',
    periferica: 'periferica',
    attivitaRitmicaToccoLettura: 'attivitaRitmicaToccoLettura',
    cambiaModalitaSpontanea: 'cambiaModalitaSpontanea',
  },
  velocita: { tempoTotale: 'tempoTotale', quantitaNumeri: 'quantitaNumeri' },
  percezione: { g5: 'v5', g10: 'v10', g15: 'v15', g20: 'v20', g25: 'v25', g30: 'v30', g35: 'v35', g40: 'v40' },
  movimentioculari: { tempo: 'tempo', nTotale: 'numTotale', stancabilitaDopo: 'stancabilitaDopo' },
  memorizzazione: { totale: 'totale', livelloMassimo: 'livelloMassimo', errori: 'errori' },
};

const MAPPA_VVS_SOTTOCONDIZIONI = { gioco: 'gioco', eretta: 'orto', pedana360: 'orto360' };

const CAMPI_BOOLEANI = new Set(['siNo', 'svincolaCingoloPelvico', 'rigidita', 'naturalmenteSincrono', 'attivitaRitmicaToccoLettura', 'cambiaModalitaSpontanea']);

function log(msg) {
  qs('#log').appendChild(el('div', { text: msg }));
}

/* --- Normalizzazione valori dati clinici --- */

function normalizzaDxSx(v, contesto, campo) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim().toLowerCase();
  if (s === 'dx') return 'Dx';
  if (s === 'sx') return 'Sx';
  log(`  ⚠ ${contesto}: valore non riconosciuto per ${campo}: "${v}", lasciato vuoto`);
  return '';
}

function normalizzaSchoberValore(v, contesto, campo) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim().toLowerCase();
  if (['orto', 'eso', 'exo'].includes(s)) return s;
  log(`  ⚠ ${contesto}: valore Schober non riconosciuto per ${campo}: "${v}", lasciato vuoto`);
  return '';
}

function normalizzaDiottria(v, contesto, campo) {
  if (v === null || v === undefined || v === '') return '';
  const numero = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (Number.isNaN(numero) || numero < -20 || numero > 20) {
    log(`  ⚠ ${contesto}: valore diottrico non valido per ${campo}: "${v}", lasciato vuoto`);
    return '';
  }
  const arrotondato = Math.round(numero / 0.25) * 0.25;
  if (arrotondato === 0) return '0.00';
  const segno = arrotondato > 0 ? '+' : '-';
  return `${segno}${Math.abs(arrotondato).toFixed(2)}`;
}

function normalizzaAsseValore(v, contesto, campo) {
  if (v === null || v === undefined || v === '') return '';
  const numero = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (Number.isNaN(numero) || numero < 0 || numero > 180) {
    log(`  ⚠ ${contesto}: valore asse non valido per ${campo}: "${v}", lasciato vuoto`);
    return '';
  }
  return `${Math.round(numero / 5) * 5}°`;
}

function verificaAcuita(v, contesto, campo) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v);
  if (!/^[0-9]+([.,][0-9]+)?\/[0-9]+([.,][0-9]+)?$/.test(s)) {
    log(`  ⚠ ${contesto}: valore acuità visiva sospetto per ${campo}: "${v}" — controlla a mano`);
  }
  return s;
}

function convertiDatiClinici(dc, contesto) {
  const risultato = datiCliniciVuoti();
  if (!dc) return risultato;

  risultato.acuitaVisiva.od = verificaAcuita(dc.acuitaOd, contesto, 'acuitaOd');
  risultato.acuitaVisiva.os = verificaAcuita(dc.acuitaOs, contesto, 'acuitaOs');
  risultato.acuitaVisiva.binoculare = verificaAcuita(dc.acuitaBinoculare, contesto, 'acuitaBinoculare');

  [
    ['propriaCorrezione', 'correzionePropria'],
    ['correzione', 'correzione'],
  ].forEach(([chiaveJson, chiaveApp]) => {
    const src = dc[chiaveJson];
    if (!src) return;
    ['od', 'os'].forEach((occhio) => {
      const s = src[occhio];
      if (!s) return;
      risultato[chiaveApp][occhio].sf = normalizzaDiottria(s.sf, contesto, `${chiaveJson}.${occhio}.sf`);
      risultato[chiaveApp][occhio].cyl = normalizzaDiottria(s.cyl, contesto, `${chiaveJson}.${occhio}.cyl`);
      risultato[chiaveApp][occhio].ax = normalizzaAsseValore(s.ax, contesto, `${chiaveJson}.${occhio}.ax`);
    });
  });

  risultato.piedeDominante = normalizzaDxSx(dc.piedeDominante, contesto, 'piedeDominante');
  risultato.manoDominante = normalizzaDxSx(dc.manoDominante, contesto, 'manoDominante');
  risultato.occhioDirettoreMotorio = normalizzaDxSx(dc.occhioDominante, contesto, 'occhioDominante');

  ['altoSx', 'bassoSx', 'centrale', 'altoDx', 'bassoDx'].forEach((pos) => {
    if (dc.schober3m) risultato.schober3m[pos] = normalizzaSchoberValore(dc.schober3m[pos], contesto, `schober3m.${pos}`);
    if (dc.brockString3m) {
      const v = dc.brockString3m[pos];
      risultato.brockString[pos] = v === null || v === undefined ? '' : String(v);
    }
  });

  risultato.abilitaFusionaleRapida = dc.abilitaFusionaleRapida ?? '';
  risultato.abilitaMessaFuocoRapida = dc.abilitaMessaFuocoRapida ?? '';

  return risultato;
}

/* --- Normalizzazione valori esercizi --- */

function normalizzaBooleano(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v === true) return 'Sì';
  if (v === false) return 'No';
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'si', 'sì', 'yes'].includes(s)) return 'Sì';
  if (['false', '0', 'no'].includes(s)) return 'No';
  return '';
}

function convertiValoreCampo(campoApp, valoreOriginale, contesto) {
  if (valoreOriginale === null || valoreOriginale === undefined || valoreOriginale === '') return undefined;
  if (CAMPI_BOOLEANI.has(campoApp)) {
    const b = normalizzaBooleano(valoreOriginale);
    if (b === '') {
      log(`  ⚠ ${contesto}: valore booleano non riconosciuto per ${campoApp}: "${valoreOriginale}", lasciato vuoto`);
      return undefined;
    }
    return b;
  }
  if (campoApp === 'stancabilitaDopo') return String(valoreOriginale);
  return valoreOriginale;
}

function convertiVvs(datiJson, contesto) {
  const risultato = {};
  Object.entries(MAPPA_VVS_SOTTOCONDIZIONI).forEach(([scJson, scApp]) => {
    const scDati = datiJson[scJson];
    if (!scDati) return;
    const scRisultato = {};
    ['primaDeviazione', 'secondaDeviazione', 'angoloAssoluto'].forEach((campo) => {
      const v = convertiValoreCampo(campo, scDati[campo], contesto);
      if (v !== undefined) scRisultato[campo] = v;
    });
    if (Object.keys(scRisultato).length > 0) risultato[scApp] = scRisultato;
  });
  return Object.keys(risultato).length > 0 ? risultato : null;
}

function convertiEsercizio(jsonKey, datiJson, contesto) {
  if (jsonKey === 'vvs') return convertiVvs(datiJson, contesto);

  const mappaCampi = MAPPA_CAMPI_PER_ESERCIZIO[jsonKey];
  const risultato = {};
  Object.entries(mappaCampi).forEach(([campoJson, campoApp]) => {
    const v = convertiValoreCampo(campoApp, datiJson[campoJson], contesto);
    if (v !== undefined) risultato[campoApp] = v;
  });
  return Object.keys(risultato).length > 0 ? risultato : null;
}

function convertiEserciziSessione(eserciziJson, contesto) {
  const risultato = {};
  Object.entries(MAPPA_ESERCIZI).forEach(([jsonKey, appKey]) => {
    const datiJson = eserciziJson[jsonKey];
    if (!datiJson) return;
    const convertito = convertiEsercizio(jsonKey, datiJson, contesto);
    if (convertito) risultato[appKey] = convertito;
  });
  return risultato;
}

/* --- Nome completo -> nome/cognome --- */

function dividiNomeCompleto(nomeCompleto) {
  const parole = nomeCompleto.trim().split(/\s+/);
  if (parole.length === 1) return { cognome: parole[0], nome: '' };
  return { cognome: parole.slice(0, -1).join(' '), nome: parole[parole.length - 1] };
}

/* --- Import con dedup idempotente --- */

async function trovaAtletaEsistente(cognome, nome) {
  const atleti = await dbGetAtleti();
  const target = `${cognome} ${nome}`.trim().toLowerCase();
  return atleti.find((a) => `${a.cognome} ${a.nome}`.trim().toLowerCase() === target);
}

async function importaAtleta(datiJson) {
  const { cognome, nome } = dividiNomeCompleto(datiJson.nomeCompleto);
  const contesto = datiJson.nomeCompleto;
  if (!nome) log(`  ⚠ ${contesto}: nome completo di una sola parola, "nome" lasciato vuoto — controlla a mano`);

  let atleta = await trovaAtletaEsistente(cognome, nome);
  let nuovo = false;
  if (!atleta) {
    const id = await dbAddAtleta({ nome, cognome });
    atleta = await dbGetAtleta(id);
    atleta.datiClinici = convertiDatiClinici(datiJson.datiClinici, contesto);
    await dbUpdateAtleta(atleta);
    nuovo = true;
    log(`Creato nuovo atleta: ${contesto}`);
  } else {
    log(`Atleta già presente, riuso: ${contesto}`);
  }

  const sessioniEsistenti = await dbGetSessioniByAtleta(atleta.id);
  const dateEsistenti = new Set(sessioniEsistenti.map((s) => s.data));

  let sessioniAggiunte = 0;
  let sessioniSaltate = 0;
  for (const sessioneJson of datiJson.sessioni || []) {
    if (dateEsistenti.has(sessioneJson.data)) {
      sessioniSaltate++;
      continue;
    }
    const esercizi = convertiEserciziSessione(sessioneJson.esercizi || {}, `${contesto} (${sessioneJson.data})`);
    await dbAddSessione({ atletaId: atleta.id, data: sessioneJson.data, titolo: '', esercizi });
    dateEsistenti.add(sessioneJson.data);
    sessioniAggiunte++;
  }

  log(`  → ${sessioniAggiunte} sessioni aggiunte, ${sessioniSaltate} già presenti (saltate).`);
  return { nuovo, sessioniAggiunte, sessioniSaltate };
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
}

qs('#btn-avvia').addEventListener('click', async () => {
  const btn = qs('#btn-avvia');
  btn.disabled = true;
  qs('#log').innerHTML = '';

  try {
    const risposta = await fetch('./atleti_importati.json');
    if (!risposta.ok) throw new Error(`File non trovato o non leggibile (HTTP ${risposta.status})`);
    const dati = await risposta.json();
    const chiavi = Object.keys(dati);
    log(`Trovati ${chiavi.length} atleti nel file.`);

    let nuoviAtleti = 0;
    let sessioniTot = 0;
    let saltateTot = 0;

    for (const chiave of chiavi) {
      try {
        const risultato = await importaAtleta(dati[chiave]);
        if (risultato.nuovo) nuoviAtleti++;
        sessioniTot += risultato.sessioniAggiunte;
        saltateTot += risultato.sessioniSaltate;
      } catch (err) {
        log(`ERRORE su "${chiave}": ${err.message}`);
      }
    }

    log('---');
    log(`Completato: ${nuoviAtleti} nuovi atleti, ${sessioniTot} sessioni aggiunte, ${saltateTot} sessioni già presenti saltate.`);
  } catch (err) {
    log('ERRORE GENERALE: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

init();
