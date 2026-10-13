/*
 * Radar per singolo TEST.
 * Ogni asse del radar corrisponde a una delle 13 tipologie standard.
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
  pedana360: [
    { campo: 'tempoReazioneMedio', direzione: 'basso', label: 'Tempo di reazione medio' },
  ],
  velocitaRiconoscimento: [
    { campo: 'quantitaNumeri', direzione: 'alto', label: 'Elementi riconosciuti' },
  ],
  percezioneCampoVisivo: [
    { campo: 'angoloMassimo', direzione: 'alto', label: 'Ampiezza periferica massima' },
  ],
  localizzazioneAffollamentoOculare: [
    { campo: 'tempoTotale', direzione: 'basso', label: 'Tempo totale' },
  ],
  ordinamentoStrategico: [
    { campo: 'clickErrati', direzione: 'basso', label: 'Click errati' },
  ],
  visualizzazioneTraiettorie: [
    { campo: 'clickErrati', direzione: 'basso', label: 'Click errati' },
  ],
  riconoscimentoNumeri: [
    { campo: 'quantitaNumeri', direzione: 'alto', label: 'Numeri riconosciuti' },
  ],
  reazioneVisuoMotoriaSceltaMultipla: [
    { campo: 'tempoReazioneMedio', direzione: 'basso', label: 'Tempo di reazione medio' },
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

// Lettura unica e NON distruttiva delle metriche radar: valori canonici e
// risultati originali JetProgram che il PDF già visualizza nelle sue tabelle.
// I tempi originali Jet senza suffisso sono secondi; i campi canonici in ms.
function radarMisureCampo(sessione, testKey, campoKey) {
  const esercizio = getEsercizioConfig(testKey);
  const campo = esercizio?.campi.find((x) => x.key === campoKey);
  if (!campo) return [];
  const dati = sessione?.esercizi?.[testKey];
  const canonici = [];
  const aggiungi = (raw) => {
    if (valoreCampoValido(campo, raw)) canonici.push(Number(raw));
  };
  if (dati) {
    if (esercizio.sottoCondizioni) {
      esercizio.sottoCondizioni.forEach((sc) => aggiungi(dati[sc.key]?.[campoKey]));
    } else aggiungi(dati[campoKey]);
  }
  if (canonici.length) return canonici;

  const risultati = typeof risultatiOriginaliJet === 'function'
    ? risultatiOriginaliJet(sessione) : null;
  if (!risultati || Array.isArray(risultati)) return [];
  const aliases = typeof aliasesCampoJet === 'function' ? aliasesCampoJet(campo) : [];
  const normalizza = (v) => typeof jetNome === 'function'
    ? jetNome(v) : String(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  // Ogni metrica deve avere un alias esplicito: non si mescolano parametri
  // omonimi di test diversi e non si interpretano liste grezze come medie.
  const originali = [];
  Object.entries(risultati).forEach(([label, raw]) => {
    const alias = aliases.find((a) => normalizza(a.name) === normalizza(label));
    if (!alias) return;
    const n = typeof jetNumero === 'function' ? jetNumero(raw) : Number(raw);
    if (n === null || !Number.isFinite(n)) return;
    let valore = n;
    if (alias.unit === 's' && campo.unit === 'ms') valore *= 1000;
    if (alias.unit === 'ms' && campo.unit === 's') valore /= 1000;
    if (valoreCampoValido(campo, valore)) originali.push(valore);
  });
  // Rifiuta conversioni ambigue (per esempio due valori incompatibili
  // associati allo stesso parametro).
  if (!originali.length || originali.some((v) => v !== originali[0])) return [];
  return [originali[0]];
}

function radarValoriCampo(sessioni, esercizioKey, campoKey) {
  const valori = [];
  (sessioni || []).forEach((sessione) => {
    if (radarChiaveTestSessione(sessione) !== esercizioKey) return;
    valori.push(...radarMisureCampo(sessione, esercizioKey, campoKey));
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

  // Il protocollo JetProgram identificato prevale su campi accessori presenti
  // in sessioni legacy: la prima chiave compilata può essere un altro test.
  if (sessione.testStandard && TEST_STANDARD_KEYS.includes(sessione.testStandard)) return sessione.testStandard;
  if (typeof jetTest === 'function') {
    const identificato = jetTest(sessione);
    if (identificato?.key && TEST_STANDARD_KEYS.includes(identificato.key)) return identificato.key;
  }
  if (typeof chiaveStandardDaNomeProtocollo === 'function') {
    const daNome = chiaveStandardDaNomeProtocollo(sessione);
    if (daNome && TEST_STANDARD_KEYS.includes(daNome)) return daNome;
  }
  const compilati = TEST_STANDARD_KEYS.filter((key) =>
    esercizioCompilato(getEsercizioConfig(key), sessione.esercizi?.[key])
  );
  if (compilati.length === 1) return compilati[0];

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
  const punteggi = [];
  config.forEach(({ campo: campoKey, direzione }) => {
    const valori = radarMisureCampo(sessione, testKey, campoKey);
    if (!valori.length) return;
    const distribuzione = radarDistribuzioneCampo(tutteSessioni, testKey, campoKey);
    valori.forEach((valore) => {
      const score = radarPercentileValore(valore, distribuzione, direzione);
      if (score !== null) punteggi.push(score);
    });
  });
  return punteggi.length
    ? punteggi.reduce((tot, valore) => tot + valore, 0) / punteggi.length
    : null;
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
    // Cerca l'ultima sessione effettivamente valutabile: l'ultima in ordine
    // cronologico potrebbe avere soltanto risultati originali o campi assenti.
    const candidate = testsAtleta
      .filter((sessione) => radarChiaveTestSessione(sessione) === testKey)
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) ||
        String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    let sessione = null;
    let valore = null;
    for (const candidata of candidate) {
      const score = radarPunteggioTest(testKey, candidata, testsGlobali);
      if (score !== null && Number.isFinite(score)) {
        sessione = candidata;
        valore = score;
        break;
      }
    }
    if (!sessione) return null;

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
