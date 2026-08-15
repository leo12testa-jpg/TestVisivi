/*
 * Config unica per tutti gli esercizi del JetProgram.
 * Guida: generazione form sessione, tabelle riassuntive, raggruppamento
 * automatico dei grafici, menu della vista confronto ed export PDF.
 *
 * Convenzione dati sessione:
 *   sessione.esercizi[esercizio.key][campo.key] = valore
 * Per gli esercizi con sottoCondizioni (es. VVS):
 *   sessione.esercizi[esercizio.key][sottoCondizione.key][campo.key] = valore
 *
 * unit: chiave usata per raggruppare automaticamente i campi nello stesso
 * grafico quando condividono la scala (vedi UNITA_LABEL sotto e charts.js).
 */

const UNITA_LABEL = {
  ms: 'ms',
  s: 's',
  per_sec: 'immagini/sec',
  count: 'n°',
  deg: '°',
  campo_periferico: 'valore',
  percent: '%',
};

function campoValori(campiSemplici) {
  return campiSemplici.map((c) => ({ tipo: 'number', ...c }));
}

const ESERCIZI_CONFIG = [
  {
    key: 'localizzazioneSpaziale',
    label: 'Localizzazione spaziale (Equilibrio statico)',
    campi: campoValori([
      { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
      { key: 'immaginiAlSec', label: 'Immagini al sec', unit: 'per_sec' },
      { key: 'immaginiColpite', label: 'Immagini colpite', unit: 'count' },
    ]),
  },
  {
    key: 'pedana360',
    label: 'Pedana 360',
    campi: campoValori([
      { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
      { key: 'immaginiAlSec', label: 'Immagini al sec', unit: 'per_sec' },
      { key: 'immaginiColpite', label: 'Immagini colpite', unit: 'count' },
      { key: 'recuperi', label: 'Recuperi', unit: 'count' },
      { key: 'tempoArea5', label: 'Tempo area 5°', unit: 's' },
      { key: 'tempoAreaEsterna', label: 'Tempo area esterna', unit: 's' },
    ]),
  },
  {
    key: 'proActionReaction',
    label: 'Pro Action and Reaction Time',
    campi: campoValori([
      { key: 'tempoRilascioMedio', label: 'Tempo di rilascio medio', unit: 'ms' },
      { key: 'tempoClickMedio', label: 'Tempo di click medio', unit: 'ms' },
      { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
      { key: 'errori', label: 'Errori', unit: 'count' },
    ]),
  },
  {
    key: 'attenzioneSeparata',
    label: 'Attenzione separata (centrale/periferica)',
    campi: [
      ...campoValori([
        { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
        { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
        { key: 'immaginiColpite', label: 'Immagini colpite', unit: 'count' },
        { key: 'centrale', label: 'Centrale', unit: 'count' },
        { key: 'periferica', label: 'Periferica', unit: 'count' },
      ]),
      { key: 'attivitaRitmicaToccoLettura', label: 'Produce un’attività ritmica tra tocco e lettura?', tipo: 'boolean' },
      { key: 'cambiaModalitaSpontanea', label: 'Riesce a cambiare la modalità spontanea?', tipo: 'boolean' },
    ],
  },
  {
    key: 'vvs',
    label: 'Verticale Soggettiva (VVS) al buio',
    sottoCondizioni: [
      { key: 'gioco', label: 'In posizione di gioco' },
      { key: 'orto', label: 'In ortoposizione eretta' },
      { key: 'orto360', label: 'In ortoposizione con pedana 360°' },
    ],
    campi: campoValori([
      { key: 'primaDeviazione', label: '1a Deviazione', unit: 'deg' },
      { key: 'secondaDeviazione', label: '2a Deviazione', unit: 'deg' },
      { key: 'angoloAssoluto', label: 'Angolo Assoluto', unit: 'deg' },
    ]),
  },
  {
    key: 'velocitaRiconoscimento',
    label: 'Velocità di riconoscimento visivo',
    campi: campoValori([
      { key: 'tempoTotale', label: 'Tempo Totale', unit: 's' },
      { key: 'quantitaNumeri', label: 'Quantità numeri', unit: 'count' },
    ]),
  },
  {
    key: 'percezioneCampoVisivo',
    label: 'Percezione campo visivo periferico',
    campi: [
      ...campoValori(
        [5, 10, 15, 20, 25, 30, 35, 40].map((g) => ({
          key: `v${g}`,
          label: `${g}°`,
          unit: 'campo_periferico',
        }))
      ),
      { key: 'areaDifficolta', label: 'Area di difficoltà', unit: 'text', tipo: 'text' },
    ],
  },
  {
    key: 'movimentiOculari',
    label: 'Movimenti oculari (mire veloci)',
    campi: [
      { key: 'tempo', label: 'Tempo', unit: 's', tipo: 'number' },
      { key: 'numTotale', label: 'N° Totale', unit: 'count', tipo: 'number' },
      { key: 'stancabilitaDopo', label: 'Stancabilità dopo', unit: 'text', tipo: 'text' },
    ],
  },
  {
    key: 'memorizzazioneSequenze',
    label: 'Memorizzazione sequenze spaziali 7x12',
    campi: campoValori([
      { key: 'totale', label: 'Totale', unit: 'count' },
      { key: 'livelloMassimo', label: 'Livello massimo completato', unit: 'count' },
      { key: 'errori', label: 'Errori', unit: 'count' },
    ]),
  },
  {
    key: 'sincronizzazioneRitmica',
    label: 'Sincronizzazione ritmica del corpo durante il gesto motorio (pedana oscillante)',
    campi: [
      ...campoValori([
        { key: 'percentualeSuccesso', label: 'Percentuale successo', unit: 'percent' },
        { key: 'nTarget', label: 'N.Target', unit: 'count' },
        { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
        { key: 'errori', label: 'Errori', unit: 'count' },
      ]),
      { key: 'siNo', label: 'Sì/No', tipo: 'boolean' },
      { key: 'svincolaCingoloPelvico', label: 'Svincola il cingolo pelvico', tipo: 'boolean' },
      { key: 'rigidita', label: 'Rigidità', tipo: 'boolean' },
      { key: 'naturalmenteSincrono', label: 'È naturalmente sincrono', tipo: 'boolean' },
    ],
  },
  {
    key: 'campoVisivoAvanzato',
    label: 'Campo visivo periferico avanzato',
    // Rendering completamente diverso da quello standard (immagine + tabella settori,
    // scritto solo da uno script Python esterno): niente grafico a linee, niente form
    // di inserimento manuale. Vedi charts.js (getChartGroups), page-grafici.js,
    // pdf-export.js e page-sessione.js (che salta/preserva questo esercizio).
    custom: true,
    campi: [
      { key: 'modalita', label: 'Modalità', tipo: 'text' },
      { key: 'durataSecondi', label: 'Durata', unit: 's', tipo: 'number' },
      { key: 'immaginePolarPlot', label: 'Immagine polar plot', tipo: 'text' },
      { key: 'percentualiSettori', label: 'Percentuali per settore', tipo: 'text' },
    ],
  },
  {
    key: 'tracciamentoVisivo',
    label: 'Tracciamento visivo (Multi Object Tracking)',
    // Dati generati giocando in tracciamento.html/page-tracciamento.js, mai da un form
    // manuale: niente grafico automatico a linee. Vedi charts.js (getChartGroups),
    // page-grafici.js e page-sessione.js (che salta/preserva questo esercizio).
    // Escluso di proposito da pdf-export.js (nessun render dedicato richiesto).
    custom: true,
    campi: [
      { key: 'corretto', label: 'Corretto', tipo: 'boolean' },
      { key: 'tempoRispostaMs', label: 'Tempo di risposta', unit: 'ms', tipo: 'number' },
      { key: 'numPalline', label: 'N. palline', tipo: 'number' },
    ],
  },
];

function getEsercizioConfig(key) {
  return ESERCIZI_CONFIG.find((e) => e.key === key);
}

function getValoreCampoRaw(sessione, esercizioKey, scKey, campoKey) {
  const dati = sessione.esercizi && sessione.esercizi[esercizioKey];
  if (!dati) return '';
  const scope = scKey ? dati[scKey] : dati;
  if (!scope) return '';
  const v = scope[campoKey];
  return v === undefined || v === null ? '' : v;
}

/**
 * Colonne (una per campo, o per sottoCondizione x campo) da usare per
 * tabelle riassuntive: [{ header, get(sessione), tipo }].
 * "tipo" permette ai chiamanti di separare i campi numerici (già coperti
 * dai grafici) da quelli testo/booleani (mostrati solo in tabella).
 */
function colonneEsercizio(esercizio) {
  if (esercizio.sottoCondizioni) {
    const cols = [];
    esercizio.sottoCondizioni.forEach((sc) => {
      esercizio.campi.forEach((campo) => {
        cols.push({
          header: `${sc.label} — ${campo.label}`,
          get: (s) => getValoreCampoRaw(s, esercizio.key, sc.key, campo.key),
          tipo: campo.tipo,
        });
      });
    });
    return cols;
  }
  return esercizio.campi.map((campo) => ({
    header: campo.label,
    get: (s) => getValoreCampoRaw(s, esercizio.key, null, campo.key),
    tipo: campo.tipo,
  }));
}

/**
 * Un esercizio e' "compilato" in una sessione se almeno un campo numerico/testo
 * al suo interno ha un valore non vuoto (gestisce anche le sottoCondizioni).
 */
function esercizioCompilato(esercizio, valore) {
  if (!valore) return false;
  if (esercizio.sottoCondizioni) {
    return esercizio.sottoCondizioni.some((sc) => {
      const v = valore[sc.key];
      return v && esercizio.campi.some((c) => v[c.key] !== undefined && v[c.key] !== '' && v[c.key] !== null);
    });
  }
  return esercizio.campi.some((c) => valore[c.key] !== undefined && valore[c.key] !== '' && valore[c.key] !== null);
}

/** Numero di esercizi compilati in una sessione (usato nell'elenco sessioni del profilo e nella vista "Tutte le sessioni"). */
function contaEserciziCompilati(sessione) {
  return ESERCIZI_CONFIG.filter((e) => esercizioCompilato(e, sessione.esercizi && sessione.esercizi[e.key])).length;
}
