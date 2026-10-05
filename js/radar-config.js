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
  attenzioneSeparata: [
    { campo: 'immaginiAlSec', direzione: 'alto', label: 'Immagini al secondo' },
  ],
  localizzazioneSpaziale: [
    { campo: 'immaginiAlSec', direzione: 'alto', label: 'Immagini al secondo' },
    { campo: 'tempoReazioneMedio', direzione: 'basso', label: 'Tempo di reazione medio' },
  ],
  memorizzazioneSequenze: [
    { campo: 'livelloMassimo', direzione: 'alto', label: 'Livello massimo' },
  ],
  velocitaPrecisioneAffollamento: [
    { campo: 'tempoTotale', direzione: 'basso', label: 'Tempo totale' },
  ],
  proActionReaction: [
    { campo: 'tempoRilascioMedio', direzione: 'basso', label: 'Tempo medio di rilascio' },
    { campo: 'tempoClickMedio', direzione: 'basso', label: 'Tempo medio di tocco' },
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

function radarDistribuzioneCampo(tutteSessioni, testKey, campoKey) {
  return radarValoriCampo(tutteSessioni, testKey, campoKey)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
}

/*
 * Indice relativo 0-100 basato sul percentile interno dell'archivio.
 * 50 = circa mediana dei Test osservati; valori alti = prestazione migliore.
 * Non è un punteggio clinico/normativo: serve per confrontare rapidamente il
 * profilo dell'atleta con i risultati Test presenti nell'archivio.
 */
function radarPercentileValore(valore, distribuzione, direzione) {
  if (!Array.isArray(distribuzione) || !distribuzione.length) return null;
  if (distribuzione.length === 1) return 50;

  let minori = 0;
  let uguali = 0;
  let maggiori = 0;
  distribuzione.forEach((v) => {
    if (v < valore) minori++;
    else if (v > valore) maggiori++;
    else uguali++;
  });

  const n = distribuzione.length;
  const quota = direzione === 'alto'
    ? (minori + uguali * 0.5) / n
    : (maggiori + uguali * 0.5) / n;

  return Math.max(0, Math.min(100, quota * 100));
}

function radarLivello(score) {
  if (!Number.isFinite(score)) return '';
  if (score >= 80) return 'Molto forte';
  if (score >= 65) return 'Buono';
  if (score >= 45) return 'Nella media';
  if (score >= 30) return 'Da migliorare';
  return 'Debole';
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

      const distribuzione = radarDistribuzioneCampo(tutteSessioni, testKey, campoKey);
      valori.forEach((valore) => {
        const score = radarPercentileValore(valore, distribuzione, direzione);
        if (score !== null) punteggi.push(score);
      });
    });
  }

  if (punteggi.length) {
    return punteggi.reduce((tot, valore) => tot + valore, 0) / punteggi.length;
  }

  // Se i parametri scelti per il radar non sono presenti, il Test non entra nel radar.
  return null;
}

function radarMetricheSelezionate(testKey, sessione) {
  const esercizio = getEsercizioConfig(testKey);
  const dati = sessione?.esercizi?.[testKey];
  if (!esercizio || !dati) return [];

  return (TEST_RADAR_CONFIG[testKey] || []).map((parametro) => {
    const campo = esercizio.campi.find((x) => x.key === parametro.campo);
    if (!campo) return null;
    const raw = dati[parametro.campo];
    if (!valoreCampoValido(campo, raw)) return null;
    return {
      key: parametro.campo,
      label: parametro.label || campo.label,
      valore: formattaValoreCampo(campo, raw),
      raw,
    };
  }).filter(Boolean);
}

function radarDatiSintesi(sessioniAtleta, tutteSessioni) {
  const testsAtleta = (sessioniAtleta || [])
    .filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));
  const testsGlobali = (tutteSessioni || [])
    .filter((s) => isSessioneTest(s) && sessioneHaRisultatiVisibili(s));

  const righe = Object.keys(TEST_RADAR_CONFIG).map((testKey) => {
    const sessione = radarUltimaSessioneTest(testsAtleta, testKey);
    if (!sessione) return null;
    const valore = radarPunteggioTest(testKey, sessione, testsGlobali);
    if (valore === null) return null;

    const score = Math.round(valore);
    return {
      key: testKey,
      nome: TEST_STANDARD_LABELS[testKey] || getEsercizioConfig(testKey)?.label || testKey,
      valore: score,
      livello: radarLivello(score),
      data: sessione.data || '',
      parametriRadar: (TEST_RADAR_CONFIG[testKey] || []).map((p) => p.label || p.campo),
      parametriValoriRadar: radarMetricheSelezionate(testKey, sessione),
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
