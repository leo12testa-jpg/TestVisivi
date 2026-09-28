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
  bpm: 'bpm',
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
      { key: 'immaginiAlSec', label: 'Target al secondo', unit: 'per_sec' },
      { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
    ]),
  },
  {
    key: 'pedana360',
    label: 'Equilibrio posturale e coordinazione occhio-mano su pedana',
    campi: campoValori([
      { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
      { key: 'immaginiAlSec', label: 'Target al secondo', unit: 'per_sec' },
      { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
      { key: 'recuperi', label: 'Recuperi equilibrio', unit: 'count' },
      { key: 'tempoArea5', label: 'Tempo in area 5°', unit: 's' },
      { key: 'tempoAreaEsterna', label: 'Tempo fuori area 5°', unit: 's' },
    ]),
  },
  {
    key: 'proActionReaction',
    label: 'Pro Action and Reaction Time',
    campi: campoValori([
      { key: 'tempoRilascioMedio', label: 'Tempo medio di rilascio', unit: 'ms' },
      { key: 'tempoClickMedio', label: 'Tempo medio di tocco', unit: 'ms' },
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
        { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
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
      { key: 'quantitaNumeri', label: 'Numeri riconosciuti', unit: 'count' },
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
      { key: 'livelloMassimo', label: 'Livello massimo', unit: 'count' },
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
    // Test sperimentale rimosso dall'app (era tracciamento.html/page-tracciamento.js): la
    // voce resta qui solo per continuare a leggere/mostrare le sessioni storiche già
    // salvate, mai da un form manuale. Vedi charts.js (getChartGroups), page-grafici.js
    // e page-sessione.js (che salta/preserva questo esercizio).
    // Escluso di proposito da pdf-export.js (nessun render dedicato richiesto).
    custom: true,
    campi: [
      { key: 'corretto', label: 'Corretto', tipo: 'boolean' },
      { key: 'tempoRispostaMs', label: 'Tempo di risposta', unit: 'ms', tipo: 'number' },
      { key: 'numPalline', label: 'N. palline', tipo: 'number' },
    ],
  },
];

// I 13 test standard usano le STESSE chiavi già presenti nei documenti Firestore reali.
// Queste chiavi non vanno rinominate: storico Jet e nuove sessioni devono essere confrontabili.
const TEST_STANDARD_KEYS = [
  'localizzazioneSpaziale',
  'pedana360',
  'proActionReaction',
  'attenzioneSeparata',
  'velocitaPrecisioneAffollamento',
  'velocitaRiconoscimento',
  'percezioneCampoVisivo',
  'localizzazioneAffollamentoOculare',
  'memorizzazioneSequenze',
  'ordinamentoStrategico',
  'visualizzazioneTraiettorie',
  'riconoscimentoNumeri',
  'reazioneVisuoMotoriaSceltaMultipla',
];

const TEST_STANDARD_LABELS = {
  localizzazioneSpaziale: 'Localizzazione spaziale (Equilibrio statico)',
  pedana360: 'Equilibrio posturale e coordinazione occhio-mano su pedana',
  proActionReaction: 'Pro Action and Reaction Time',
  attenzioneSeparata: 'Attenzione separata (centrale/periferica)',
  velocitaPrecisioneAffollamento: 'Velocità e precisione nella localizzazione spaziale in affollamento percettivo',
  velocitaRiconoscimento: 'Velocità di riconoscimento visivo',
  percezioneCampoVisivo: 'Percezione campo visivo periferico',
  localizzazioneAffollamentoOculare: 'Localizzazione in affollamento percettivo e movimenti oculari veloci',
  memorizzazioneSequenze: 'Memorizzazione sequenze spaziali 7x12',
  ordinamentoStrategico: 'Ordinamento strategico in confusione percettiva',
  visualizzazioneTraiettorie: 'Visualizzazione e localizzazione delle traiettorie',
  riconoscimentoNumeri: 'Riconoscimento visivo veloce di numeri',
  reazioneVisuoMotoriaSceltaMultipla: 'Reazione visuo-motoria veloce con elevata concentrazione in scelta multipla',
};

// Campi realmente presenti nello storico Jet già migrato. Gli eventuali campi legacy
// già definiti sopra restano disponibili e non vengono cancellati.
const CAMPI_STANDARD_REALI = {
  localizzazioneSpaziale: [
    { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
    { key: 'immaginiAlSec', label: 'Target al secondo', unit: 'per_sec' },
    { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'numeroTarget', label: 'Target presentati', unit: 'count' },
    { key: 'errori', label: 'Errori', unit: 'count' },
  ],
  pedana360: [
    { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
    { key: 'immaginiAlSec', label: 'Target al secondo', unit: 'per_sec' },
    { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
    { key: 'recuperi', label: 'Recuperi equilibrio', unit: 'count' },
    { key: 'tempoArea5', label: 'Tempo in area 5°', unit: 's' },
    { key: 'tempoAreaEsterna', label: 'Tempo fuori area 5°', unit: 's' },
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'numeroTarget', label: 'Target presentati', unit: 'count' },
    { key: 'errori', label: 'Errori', unit: 'count' },
  ],
  proActionReaction: [
    { key: 'tempoRilascioMedio', label: 'Tempo medio di rilascio', unit: 'ms' },
    { key: 'tempoClickMedio', label: 'Tempo medio di tocco', unit: 'ms' },
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'numeroTarget', label: 'Target presentati', unit: 'count' },
    { key: 'errori', label: 'Errori', unit: 'count' },
  ],
  attenzioneSeparata: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
    { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
    { key: 'immaginiAlSec', label: 'Target al secondo', unit: 'per_sec' },
    { key: 'numeroTarget', label: 'Target presentati', unit: 'count' },
    { key: 'errori', label: 'Errori', unit: 'count' },
    { key: 'recuperi', label: 'Recuperi equilibrio', unit: 'count' },
    { key: 'tempoArea5', label: 'Tempo in area 5°', unit: 's' },
    { key: 'tempoAreaEsterna', label: 'Tempo fuori area 5°', unit: 's' },
  ],
  velocitaPrecisioneAffollamento: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'clickErrati', label: 'Click errati', unit: 'count' },
    { key: 'numeroImmagini', label: 'Stimoli totali', unit: 'count' },
    { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
    { key: 'velocita', label: 'Velocità rilevata' },
    { key: 'recuperi', label: 'Recuperi equilibrio', unit: 'count' },
    { key: 'tempoArea5', label: 'Tempo in area 5°', unit: 's' },
    { key: 'tempoAreaEsterna', label: 'Tempo fuori area 5°', unit: 's' },
  ],
  velocitaRiconoscimento: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'quantitaNumeri', label: 'Elementi riconosciuti', unit: 'count' },
    { key: 'tempoStimolo', label: 'Durata stimolo', unit: 's' },
    { key: 'recuperi', label: 'Recuperi equilibrio', unit: 'count' },
    { key: 'tempoArea5', label: 'Tempo in area 5°', unit: 's' },
    { key: 'tempoAreaEsterna', label: 'Tempo fuori area 5°', unit: 's' },
  ],
  percezioneCampoVisivo: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'angoloMassimo', label: 'Ampiezza periferica massima', unit: 'deg' },
    { key: 'numeroTarget', label: 'Target presentati', unit: 'count' },
    { key: 'numeroLettere', label: 'Numero lettere', unit: 'count' },
    { key: 'errori', label: 'Errori', unit: 'count' },
    { key: 'recuperi', label: 'Recuperi equilibrio', unit: 'count' },
    { key: 'tempoArea5', label: 'Tempo in area 5°', unit: 's' },
    { key: 'tempoAreaEsterna', label: 'Tempo fuori area 5°', unit: 's' },
  ],
  localizzazioneAffollamentoOculare: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'metronomo', label: 'Ritmo metronomo', unit: 'bpm' },
  ],
  memorizzazioneSequenze: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'livelloMassimo', label: 'Livello massimo', unit: 'count' },
    { key: 'errori', label: 'Errori', unit: 'count' },
    { key: 'completa', label: 'Test completato', tipo: 'text' },
  ],
  ordinamentoStrategico: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'clickErrati', label: 'Click errati', unit: 'count' },
    { key: 'numeroImmagini', label: 'Stimoli totali', unit: 'count' },
    { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
    { key: 'velocita', label: 'Velocità rilevata' },
  ],
  visualizzazioneTraiettorie: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'clickErrati', label: 'Click errati', unit: 'count' },
    { key: 'numeroImmagini', label: 'Stimoli totali', unit: 'count' },
    { key: 'immaginiColpite', label: 'Target colpiti', unit: 'count' },
    { key: 'velocita', label: 'Velocità rilevata' },
  ],
  riconoscimentoNumeri: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'quantitaNumeri', label: 'Numeri riconosciuti', unit: 'count' },
    { key: 'tempoStimolo', label: 'Durata stimolo', unit: 's' },
  ],
  reazioneVisuoMotoriaSceltaMultipla: [
    { key: 'tempoTotale', label: 'Tempo totale', unit: 's' },
    { key: 'tempoReazioneMedio', label: 'Tempo reazione medio', unit: 'ms' },
    { key: 'numeroTarget', label: 'Target presentati', unit: 'count' },
    { key: 'errori', label: 'Errori', unit: 'count' },
    { key: 'corretti', label: 'Risposte corrette', unit: 'count' },
    { key: 'metronomo', label: 'Ritmo metronomo', unit: 'bpm' },
  ],
};

TEST_STANDARD_KEYS.forEach((key) => {
  let test = ESERCIZI_CONFIG.find((e) => e.key === key);
  if (!test) {
    test = { key, label: TEST_STANDARD_LABELS[key], campi: [] };
    ESERCIZI_CONFIG.push(test);
  } else {
    test.label = TEST_STANDARD_LABELS[key];
  }
  (CAMPI_STANDARD_REALI[key] || []).forEach((campo) => {
    const esistente = test.campi.find((c) => c.key === campo.key);
    if (esistente) Object.assign(esistente, campo);
    else test.campi.push({ tipo: 'number', ...campo });
  });
});

ESERCIZI_CONFIG.forEach((test) => { test.standard = TEST_STANDARD_KEYS.includes(test.key); });
const TEST_STANDARD = TEST_STANDARD_KEYS.map((key) => ESERCIZI_CONFIG.find((e) => e.key === key));

const TEST_STANDARD_INFO = {
  localizzazioneSpaziale: {
    descrizione: 'Coordinazione occhio-mano nella percezione e nel tocco periferico.',
    principali: ['tempoReazioneMedio', 'immaginiColpite', 'errori', 'immaginiAlSec'],
    secondari: ['tempoTotale', 'numeroTarget'],
  },
  pedana360: {
    descrizione: 'Equilibrio visuo-posturale e coordinazione occhio-mano su pedana.',
    principali: ['tempoReazioneMedio', 'immaginiColpite', 'errori', 'recuperi'],
    secondari: ['tempoTotale', 'numeroTarget', 'immaginiAlSec', 'tempoArea5', 'tempoAreaEsterna'],
  },
  proActionReaction: {
    descrizione: 'Tempo di reazione e di risposta motoria.',
    principali: ['tempoRilascioMedio', 'tempoClickMedio', 'errori', 'tempoTotale'],
    secondari: ['numeroTarget'],
  },
  attenzioneSeparata: {
    descrizione: 'Attenzione divisa tra lettura centrale e risposta periferica occhio-mano.',
    principali: ['tempoReazioneMedio', 'errori', 'immaginiColpite', 'tempoTotale'],
    secondari: ['numeroTarget', 'immaginiAlSec', 'recuperi', 'tempoArea5', 'tempoAreaEsterna'],
  },
  velocitaPrecisioneAffollamento: {
    descrizione: 'Velocità e precisione della localizzazione spaziale in affollamento percettivo.',
    principali: ['clickErrati', 'tempoTotale', 'immaginiColpite'],
    secondari: ['numeroImmagini', 'velocita', 'recuperi', 'tempoArea5', 'tempoAreaEsterna'],
  },
  velocitaRiconoscimento: {
    descrizione: 'Riconoscimento visivo veloce di stimoli presentati per un tempo definito.',
    principali: ['quantitaNumeri', 'tempoTotale'],
    secondari: ['tempoStimolo', 'recuperi', 'tempoArea5', 'tempoAreaEsterna'],
  },
  percezioneCampoVisivo: {
    descrizione: 'Consapevolezza e riconoscimento di stimoli periferici mantenendo una mira centrale.',
    principali: ['angoloMassimo', 'errori', 'numeroLettere', 'numeroTarget'],
    secondari: ['tempoTotale', 'recuperi', 'tempoArea5', 'tempoAreaEsterna'],
  },
  localizzazioneAffollamentoOculare: {
    descrizione: 'Localizzazione in affollamento percettivo con movimenti oculari rapidi.',
    principali: ['tempoTotale'],
    secondari: ['metronomo'],
  },
  memorizzazioneSequenze: {
    descrizione: 'Memoria visiva e concentrazione su sequenze spaziali 7×12.',
    principali: ['livelloMassimo', 'errori', 'tempoTotale', 'completa'],
    secondari: [],
  },
  ordinamentoStrategico: {
    descrizione: 'Ordinamento strategico di stimoli in condizioni di confusione percettiva.',
    principali: ['clickErrati', 'tempoTotale', 'immaginiColpite'],
    secondari: ['numeroImmagini', 'velocita'],
  },
  visualizzazioneTraiettorie: {
    descrizione: 'Visualizzazione e localizzazione di traiettorie.',
    principali: ['immaginiColpite', 'clickErrati', 'tempoTotale'],
    secondari: ['numeroImmagini', 'velocita'],
  },
  riconoscimentoNumeri: {
    descrizione: 'Riconoscimento visivo veloce specifico di numeri.',
    principali: ['quantitaNumeri', 'tempoTotale'],
    secondari: ['tempoStimolo'],
  },
  reazioneVisuoMotoriaSceltaMultipla: {
    descrizione: 'Reazione visuo-motoria rapida con elevata concentrazione e scelta multipla.',
    principali: ['tempoReazioneMedio', 'corretti', 'errori', 'numeroTarget'],
    secondari: ['tempoTotale', 'metronomo'],
  },
};

TEST_STANDARD.forEach((test) => {
  const info = TEST_STANDARD_INFO[test.key] || {};
  test.descrizione = info.descrizione || '';
  test.campiPrincipali = info.principali || [];
  test.campiSecondari = info.secondari || [];
  test.campiStandard = [...test.campiPrincipali, ...test.campiSecondari];
});

function campiEsercizioVisibili(esercizio) {
  if (!esercizio || !esercizio.standard || !esercizio.campiStandard?.length) return esercizio?.campi || [];
  return esercizio.campi.filter((campo) => esercizio.campiStandard.includes(campo.key));
}

function campoEsercizio(esercizio, key) {
  return (esercizio?.campi || []).find((campo) => campo.key === key);
}

function valoreCampoValido(campo, value) {
  if (value === undefined || value === null || value === '') return false;
  if (campo?.tipo !== 'number') return true;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  if (['ms', 's', 'count', 'percent', 'per_sec', 'bpm'].includes(campo.unit) && n < 0) return false;
  if (campo.unit === 'percent' && n > 100) return false;
  return true;
}

const _FORMAT_NUMERO = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

function formattaValoreCampo(campo, value) {
  if (!valoreCampoValido(campo, value)) return '—';
  if (campo?.tipo !== 'number') return String(value);
  const n = Number(value);
  const numero = campo.unit === 'ms' || campo.unit === 'count'
    ? new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(n)
    : _FORMAT_NUMERO.format(n);
  const unita = campo.unit === 'per_sec' ? 'img/s' : (UNITA_LABEL[campo.unit] || '');
  return unita ? `${numero} ${unita}` : numero;
}

function metrichePrincipaliSessione(sessione) {
  const test = typeof jetTest === 'function' ? jetTest(sessione) : null;
  if (!test) return [];
  const dati = sessione?.esercizi?.[test.key] || {};
  return (test.campiPrincipali || []).map((key) => {
    const campo = campoEsercizio(test, key);
    const raw = dati[key];
    return campo && valoreCampoValido(campo, raw)
      ? { key, label: campo.label, valore: formattaValoreCampo(campo, raw), raw }
      : null;
  }).filter(Boolean);
}

function anomalieValoriSessione(sessione) {
  const test = typeof jetTest === 'function' ? jetTest(sessione) : null;
  if (!test) return [];
  const dati = sessione?.esercizi?.[test.key] || {};
  return campiEsercizioVisibili(test).filter((campo) => {
    const raw = dati[campo.key];
    return raw !== undefined && raw !== null && raw !== '' && !valoreCampoValido(campo, raw);
  }).map((campo) => campo.label);
}

function getEsercizioConfig(key) {
  return ESERCIZI_CONFIG.find((e) => e.key === key);
}

/*
 * Config di modalità per sessione.html: Test e Training riusano lo stesso
 * form/stessi esercizi (ESERCIZI_CONFIG) e la stessa logica di salvataggio;
 * qui c'è solo ciò che può differenziare le due modalità (per ora titoli).
 * TRAINING_CONFIG parte da una copia di TEST_CONFIG: per adesso i valori
 * sono identici, ma da qui si può differenziare il Training in futuro
 * senza toccare il Test (es. escludere un esercizio, cambiare un default).
 */
const TEST_CONFIG = {
  modalita: 'test',
  titoloNuova: 'Nuova sessione',
  titoloModifica: 'Modifica sessione',
};

const TRAINING_CONFIG = {
  ...TEST_CONFIG,
  modalita: 'training',
  titoloNuova: 'Nuova sessione di allenamento',
  titoloModifica: 'Modifica sessione di allenamento',
};

const SESSIONE_CONFIG_BY_MODE = { test: TEST_CONFIG, training: TRAINING_CONFIG };

/** Restituisce la config della modalità richiesta (default 'test' se mode non valido/assente). */
function getSessioneConfig(mode) {
  return SESSIONE_CONFIG_BY_MODE[mode] || TEST_CONFIG;
}

function isSessioneTraining(sessione) {
  return !!(sessione && sessione.modalita === 'training');
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
  const campi = campiEsercizioVisibili(esercizio);
  if (esercizio.sottoCondizioni) {
    const cols = [];
    esercizio.sottoCondizioni.forEach((sc) => {
      campi.forEach((campo) => {
        cols.push({
          header: `${sc.label} — ${campo.label}`,
          get: (s) => getValoreCampoRaw(s, esercizio.key, sc.key, campo.key),
          tipo: campo.tipo,
          campo,
        });
      });
    });
    return cols;
  }
  return campi.map((campo) => ({
    header: campo.label,
    get: (s) => getValoreCampoRaw(s, esercizio.key, null, campo.key),
    tipo: campo.tipo,
    campo,
  }));
}

/**
 * Un esercizio e' "compilato" in una sessione se almeno un campo numerico/testo
 * al suo interno ha un valore non vuoto (gestisce anche le sottoCondizioni).
 */
function esercizioCompilato(esercizio, valore) {
  if (!valore) return false;
  const campi = campiEsercizioVisibili(esercizio);
  if (esercizio.sottoCondizioni) {
    return esercizio.sottoCondizioni.some((sc) => {
      const v = valore[sc.key];
      return v && campi.some((c) => v[c.key] !== undefined && v[c.key] !== '' && v[c.key] !== null);
    });
  }
  return campi.some((c) => valore[c.key] !== undefined && valore[c.key] !== '' && valore[c.key] !== null);
}

/** Numero di esercizi compilati in una sessione (usato nell'elenco sessioni del profilo e nella vista "Tutte le sessioni"). */
function contaEserciziCompilati(sessione) {
  return ESERCIZI_CONFIG.filter((e) => esercizioCompilato(e, sessione.esercizi && sessione.esercizi[e.key])).length;
}
