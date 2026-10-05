/*
 * Mappatura esercizi -> 6 categorie di skill per il radar chart (radar.html).
 * Ogni voce indica: esercizio (chiave di ESERCIZI_CONFIG), campo, e direzione
 * ('alto' = più alto è meglio, 'basso' = più basso è meglio). Per i campi con
 * sottoCondizioni (VVS) tutte le sotto-condizioni vengono sommate insieme.
 * assoluto:true significa che va normalizzato sul valore assoluto (la
 * direzione della deviazione non conta, solo la sua ampiezza).
 *
 * Campi volutamente esclusi perché sono parametri fissi del test e non
 * misure di prestazione (confermato: vedi conversazione di progetto):
 *  - proActionReaction.tempoTotale, attenzioneSeparata.tempoTotale,
 *    velocitaRiconoscimento.tempoTotale (durata del test, non un risultato)
 *  - movimentiOculari.tempo (idem)
 *  - sincronizzazioneRitmica.nTarget (numero di prove, non una prestazione)
 */

const CATEGORIE_RADAR = [
  {
    nome: 'Equilibrio',
    campi: [
      { esercizio: 'localizzazioneSpaziale', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'localizzazioneSpaziale', campo: 'immaginiAlSec', direzione: 'alto' },
      { esercizio: 'localizzazioneSpaziale', campo: 'immaginiColpite', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'pedana360', campo: 'immaginiAlSec', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'immaginiColpite', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'recuperi', direzione: 'basso' },
      { esercizio: 'pedana360', campo: 'tempoArea5', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'tempoAreaEsterna', direzione: 'basso' },
      { esercizio: 'sincronizzazioneRitmica', campo: 'percentualeSuccesso', direzione: 'alto' },
      { esercizio: 'sincronizzazioneRitmica', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'sincronizzazioneRitmica', campo: 'errori', direzione: 'basso' },
    ],
  },
  {
    nome: 'Attenzione',
    campi: [
      { esercizio: 'attenzioneSeparata', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'attenzioneSeparata', campo: 'immaginiColpite', direzione: 'alto' },
      { esercizio: 'attenzioneSeparata', campo: 'centrale', direzione: 'alto' },
      { esercizio: 'attenzioneSeparata', campo: 'periferica', direzione: 'alto' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v5', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v10', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v15', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v20', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v25', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v30', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v35', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v40', direzione: 'basso' },
    ],
  },
  {
    nome: 'Velocità di reazione',
    campi: [
      { esercizio: 'proActionReaction', campo: 'tempoRilascioMedio', direzione: 'basso' },
      { esercizio: 'proActionReaction', campo: 'tempoClickMedio', direzione: 'basso' },
      { esercizio: 'proActionReaction', campo: 'errori', direzione: 'basso' },
      { esercizio: 'velocitaRiconoscimento', campo: 'quantitaNumeri', direzione: 'alto' },
    ],
  },
  {
    nome: 'Percezione spaziale',
    campi: [
      { esercizio: 'vvs', campo: 'primaDeviazione', direzione: 'basso', assoluto: true },
      { esercizio: 'vvs', campo: 'secondaDeviazione', direzione: 'basso', assoluto: true },
      { esercizio: 'vvs', campo: 'angoloAssoluto', direzione: 'basso', assoluto: true },
    ],
  },
  {
    nome: 'Movimenti oculari',
    campi: [{ esercizio: 'movimentiOculari', campo: 'numTotale', direzione: 'alto' }],
  },
  {
    nome: 'Memoria',
    campi: [
      { esercizio: 'memorizzazioneSequenze', campo: 'totale', direzione: 'alto' },
      { esercizio: 'memorizzazioneSequenze', campo: 'livelloMassimo', direzione: 'alto' },
      { esercizio: 'memorizzazioneSequenze', campo: 'errori', direzione: 'basso' },
    ],
  },
];

/**
 * Nomi reali dei test (label da ESERCIZI_CONFIG) che concorrono a una categoria del
 * radar, senza duplicati anche quando la categoria usa più campi dello stesso test.
 */
function getTestNamesForCategoria(categoria) {
  const nomi = [];
  categoria.campi.forEach((c) => {
    const esercizio = getEsercizioConfig(c.esercizio);
    const nome = esercizio ? esercizio.label : c.esercizio;
    if (!nomi.includes(nome)) nomi.push(nome);
  });
  return nomi;
}


function radarValoriCampo(sessioni, esercizioKey, campoKey) {
  const esercizio = getEsercizioConfig(esercizioKey);
  if (!esercizio) return [];
  const campo = esercizio.campi.find((x) => x.key === campoKey);
  if (!campo) return [];
  const valori = [];

  (sessioni || []).forEach((sessione) => {
    const dati = sessione.esercizi?.[esercizioKey];
    if (!dati) return;

    if (esercizio.sottoCondizioni) {
      esercizio.sottoCondizioni.forEach((sc) => {
        const raw = dati[sc.key]?.[campoKey];
        if (valoreCampoValido(campo, raw)) valori.push(Number(raw));
      });
    } else {
      const raw = dati[campoKey];
      if (valoreCampoValido(campo, raw)) valori.push(Number(raw));
    }
  });
  return valori;
}

function radarStatisticheGlobali(sessioni) {
  const stats = new Map();
  CATEGORIE_RADAR.forEach((categoria) => {
    categoria.campi.forEach((config) => {
      const key = `${config.esercizio}::${config.campo}`;
      if (stats.has(key)) return;
      let valori = radarValoriCampo(sessioni, config.esercizio, config.campo);
      if (config.assoluto) valori = valori.map(Math.abs);
      stats.set(key, valori.length ? { min: Math.min(...valori), max: Math.max(...valori) } : null);
    });
  });
  return stats;
}

function radarNormalizzaValore(valore, stat, direzione) {
  if (!stat) return null;
  if (stat.max === stat.min) return 50;
  const quota = direzione === 'alto'
    ? (valore - stat.min) / (stat.max - stat.min)
    : (stat.max - valore) / (stat.max - stat.min);
  return Math.max(0, Math.min(100, quota * 100));
}

function radarPunteggioCategoria(categoria, sessioni, stats) {
  const valoriNormalizzati = [];
  categoria.campi.forEach((config) => {
    const stat = stats.get(`${config.esercizio}::${config.campo}`);
    if (!stat) return;
    let valori = radarValoriCampo(sessioni, config.esercizio, config.campo);
    if (config.assoluto) valori = valori.map(Math.abs);
    valori.forEach((valore) => {
      const score = radarNormalizzaValore(valore, stat, config.direzione);
      if (score !== null) valoriNormalizzati.push(score);
    });
  });
  if (!valoriNormalizzati.length) return null;
  return valoriNormalizzati.reduce((tot, valore) => tot + valore, 0) / valoriNormalizzati.length;
}

function radarDatiSintesi(sessioniAtleta, tutteSessioni) {
  const testsAtleta = (sessioniAtleta || []).filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  const testsGlobali = (tutteSessioni || []).filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  const stats = radarStatisticheGlobali(testsGlobali);
  const righe = CATEGORIE_RADAR.map((categoria) => ({
    categoria,
    valore: radarPunteggioCategoria(categoria, testsAtleta, stats),
  })).filter((riga) => riga.valore !== null);

  return {
    labels: righe.map((riga) => riga.categoria.nome),
    valori: righe.map((riga) => Math.round(riga.valore * 10) / 10),
    testNames: righe.map((riga) => getTestNamesForCategoria(riga.categoria)),
  };
}
