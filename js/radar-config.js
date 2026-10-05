/*
 * Radar per singolo TEST.
 * Ogni asse del radar corrisponde direttamente a uno dei 13 test standard.
 * Le sessioni Training sono sempre escluse.
 *
 * Il punteggio 0-100 di ciascun test usa l'ultima valutazione disponibile
 * dell'atleta e normalizza solo le misure di prestazione realmente presenti
 * rispetto ai valori osservati nello storico Test globale.
 */

const TEST_RADAR_CONFIG = {
  localizzazioneSpaziale: [
    { campo: 'tempoReazioneMedio', direzione: 'basso' },
    { campo: 'immaginiAlSec', direzione: 'alto' },
    { campo: 'immaginiColpite', direzione: 'alto' },
    { campo: 'errori', direzione: 'basso' },
  ],
  pedana360: [
    { campo: 'tempoReazioneMedio', direzione: 'basso' },
    { campo: 'immaginiAlSec', direzione: 'alto' },
    { campo: 'immaginiColpite', direzione: 'alto' },
    { campo: 'recuperi', direzione: 'basso' },
    { campo: 'tempoArea5', direzione: 'alto' },
    { campo: 'tempoAreaEsterna', direzione: 'basso' },
    { campo: 'errori', direzione: 'basso' },
  ],
  proActionReaction: [
    { campo: 'tempoRilascioMedio', direzione: 'basso' },
    { campo: 'tempoClickMedio', direzione: 'basso' },
    { campo: 'errori', direzione: 'basso' },
  ],
  attenzioneSeparata: [
    { campo: 'tempoReazioneMedio', direzione: 'basso' },
    { campo: 'immaginiColpite', direzione: 'alto' },
    { campo: 'immaginiAlSec', direzione: 'alto' },
    { campo: 'errori', direzione: 'basso' },
    { campo: 'recuperi', direzione: 'basso' },
    { campo: 'tempoArea5', direzione: 'alto' },
    { campo: 'tempoAreaEsterna', direzione: 'basso' },
  ],
  velocitaPrecisioneAffollamento: [
    { campo: 'clickErrati', direzione: 'basso' },
    { campo: 'immaginiColpite', direzione: 'alto' },
    { campo: 'velocita', direzione: 'alto' },
  ],
  velocitaRiconoscimento: [
    { campo: 'quantitaNumeri', direzione: 'alto' },
    { campo: 'tempoStimolo', direzione: 'basso' },
  ],
  percezioneCampoVisivo: [
    { campo: 'angoloMassimo', direzione: 'alto' },
    { campo: 'errori', direzione: 'basso' },
    { campo: 'v5', direzione: 'basso' },
    { campo: 'v10', direzione: 'basso' },
    { campo: 'v15', direzione: 'basso' },
    { campo: 'v20', direzione: 'basso' },
    { campo: 'v25', direzione: 'basso' },
    { campo: 'v30', direzione: 'basso' },
    { campo: 'v35', direzione: 'basso' },
    { campo: 'v40', direzione: 'basso' },
  ],
  localizzazioneAffollamentoOculare: [
    { campo: 'tempoTotale', direzione: 'basso' },
    { campo: 'metronomo', direzione: 'alto' },
  ],
  memorizzazioneSequenze: [
    { campo: 'livelloMassimo', direzione: 'alto' },
    { campo: 'totale', direzione: 'alto' },
    { campo: 'errori', direzione: 'basso' },
  ],
  ordinamentoStrategico: [
    { campo: 'clickErrati', direzione: 'basso' },
    { campo: 'immaginiColpite', direzione: 'alto' },
    { campo: 'velocita', direzione: 'alto' },
    { campo: 'tempoTotale', direzione: 'basso' },
  ],
  visualizzazioneTraiettorie: [
    { campo: 'immaginiColpite', direzione: 'alto' },
    { campo: 'clickErrati', direzione: 'basso' },
    { campo: 'velocita', direzione: 'alto' },
    { campo: 'tempoTotale', direzione: 'basso' },
  ],
  riconoscimentoNumeri: [
    { campo: 'quantitaNumeri', direzione: 'alto' },
    { campo: 'tempoStimolo', direzione: 'basso' },
  ],
  reazioneVisuoMotoriaSceltaMultipla: [
    { campo: 'tempoReazioneMedio', direzione: 'basso' },
    { campo: 'corretti', direzione: 'alto' },
    { campo: 'errori', direzione: 'basso' },
    { campo: 'metronomo', direzione: 'alto' },
  ],
};

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
      return;
    }

    const raw = dati[campoKey];
    if (valoreCampoValido(campo, raw)) valori.push(Number(raw));
  });
  return valori;
}

function radarStatCampo(tutteSessioni, testKey, campoKey) {
  const valori = radarValoriCampo(tutteSessioni, testKey, campoKey);
  if (!valori.length) return null;
  return { min: Math.min(...valori), max: Math.max(...valori) };
}

function radarNormalizzaValore(valore, stat, direzione) {
  if (!stat) return null;
  if (stat.max === stat.min) return 50;
  const quota = direzione === 'alto'
    ? (valore - stat.min) / (stat.max - stat.min)
    : (stat.max - valore) / (stat.max - stat.min);
  return Math.max(0, Math.min(100, quota * 100));
}

function radarChiaveTestSessione(sessione) {
  if (!sessione) return null;
  if (sessione.jetProgramStandardKey && TEST_STANDARD_KEYS.includes(sessione.jetProgramStandardKey)) {
    return sessione.jetProgramStandardKey;
  }

  const compilato = TEST_STANDARD_KEYS.find((key) =>
    esercizioCompilato(getEsercizioConfig(key), sessione.esercizi?.[key])
  );
  if (compilato) return compilato;

  if (typeof chiaveStandardDaNomeProtocollo === 'function') {
    const daNome = chiaveStandardDaNomeProtocollo(sessione);
    if (daNome && TEST_STANDARD_KEYS.includes(daNome)) return daNome;
  }

  return null;
}

function radarUltimaSessioneTest(sessioni, testKey) {
  return (sessioni || [])
    .filter((s) => radarChiaveTestSessione(s) === testKey)
    .sort((a, b) =>
      String(b.data || '').localeCompare(String(a.data || '')) ||
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    )[0] || null;
}

function radarPunteggioTest(testKey, sessione, tutteSessioni) {
  const config = TEST_RADAR_CONFIG[testKey] || [];
  const esercizio = getEsercizioConfig(testKey);
  const dati = sessione?.esercizi?.[testKey];
  const punteggi = [];

  if (esercizio && dati) {
    config.forEach(({ campo: campoKey, direzione }) => {
      const campo = esercizio.campi.find((x) => x.key === campoKey);
      if (!campo) return;

      const valori = [];
      if (esercizio.sottoCondizioni) {
        esercizio.sottoCondizioni.forEach((sc) => {
          const raw = dati[sc.key]?.[campoKey];
          if (valoreCampoValido(campo, raw)) valori.push(Number(raw));
        });
      } else {
        const raw = dati[campoKey];
        if (valoreCampoValido(campo, raw)) valori.push(Number(raw));
      }
      if (!valori.length) return;

      const stat = radarStatCampo(tutteSessioni, testKey, campoKey);
      valori.forEach((valore) => {
        const score = radarNormalizzaValore(valore, stat, direzione);
        if (score !== null) punteggi.push(score);
      });
    });
  }

  if (punteggi.length) {
    return punteggi.reduce((tot, valore) => tot + valore, 0) / punteggi.length;
  }

  // Il test esiste e ha valori reali ma non dispone ancora di campi confrontabili:
  // lo manteniamo visibile nel radar con un valore neutro, senza inventare misure.
  const haDatiStandard = esercizio && esercizioCompilato(esercizio, dati);
  const haDatiOriginali = typeof jetOriginaleHaRisultatiReali === 'function' && jetOriginaleHaRisultatiReali(sessione);
  return (haDatiStandard || haDatiOriginali) ? 50 : null;
}

function radarDatiSintesi(sessioniAtleta, tutteSessioni) {
  const testsAtleta = (sessioniAtleta || [])
    .filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  const testsGlobali = (tutteSessioni || [])
    .filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));

  const righe = TEST_STANDARD_KEYS.map((testKey) => {
    const sessione = radarUltimaSessioneTest(testsAtleta, testKey);
    if (!sessione) return null;
    const valore = radarPunteggioTest(testKey, sessione, testsGlobali);
    if (valore === null) return null;

    return {
      key: testKey,
      nome: TEST_STANDARD_LABELS[testKey] || getEsercizioConfig(testKey)?.label || testKey,
      valore: Math.round(valore * 10) / 10,
      data: sessione.data || '',
      metriche: sessione.esercizi?.[testKey]
        ? metricheEsercizioSessione(sessione, getEsercizioConfig(testKey), false)
        : (typeof metricheOriginaliJet === 'function' ? metricheOriginaliJet(sessione, 4) : []),
    };
  }).filter(Boolean);

  return {
    labels: righe.map((riga) => riga.nome),
    valori: righe.map((riga) => riga.valore),
    testNames: righe.map((riga) => [riga.nome]),
    righe,
  };
}
