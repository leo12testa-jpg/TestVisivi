/* Adattatore puro: nessuna scrittura Firestore, nessuna deduzione di punteggi.
 * Nomi e unità devono essere espliciti. I campi canonici già salvati prevalgono.
 * L'oggetto originale non viene modificato, inclusi nomi, tipo e datiOriginali.
 */
function jetNome(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function jetNumero(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function jetOriginale(sessione) {
  const embedded = sessione && sessione.esercizi && sessione.esercizi.jetProgramOriginale;
  if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) return embedded;
  return null;
}

function jetTest(sessione) {
  if (!sessione) return null;
  for (const key of [sessione.jetProgramStandardKey, sessione.testStandard]) {
    if (key && TEST_STANDARD_KEYS.includes(key)) return getEsercizioConfig(key);
  }
  const originale = jetOriginale(sessione);
  const nomi = [
    sessione.nomeTestOriginale,
    sessione.jetProgramNomeOriginale,
    sessione.tipoTest,
    originale && originale.nomeTestOriginale,
    originale && originale.tipoTest,
  ];
  const matches = new Set();
  nomi.filter(Boolean).forEach((nome) => {
    const normalized = jetNome(nome);
    TEST_STANDARD.forEach((test) => {
      if ([test.key, test.label].some((n) => jetNome(n) === normalized)) matches.add(test.key);
    });
  });
  return matches.size === 1 ? getEsercizioConfig([...matches][0]) : null;
}

function haDatiJet(sessione) {
  return !!(
    sessione && (
      jetOriginale(sessione) ||
      (sessione.datiOriginali !== undefined && sessione.datiOriginali !== null) ||
      sessione.jetProgramReportId !== undefined ||
      sessione.jetProgramNomeOriginale ||
      sessione.nomeTestOriginale
    )
  );
}


function nomeOriginaleSessioneJet(sessione) {
  const originale = jetOriginale(sessione);
  return String(
    sessione?.jetProgramNomeOriginale ||
    sessione?.nomeTestOriginale ||
    originale?.nomeTestOriginale ||
    sessione?.titolo ||
    ''
  ).trim();
}

/*
 * Regola archivio Jet concordata:
 * - nome originale che inizia con "x" / "X" => TEST
 * - tutti gli altri report Jet => TRAINING
 * La regola riguarda solo i dati importati da Jet Program.
 */
function modalitaSessioneEffettiva(sessione) {
  if (!sessione) return 'test';
  if (haDatiJet(sessione)) {
    const nome = nomeOriginaleSessioneJet(sessione);
    return /^x/i.test(nome) ? 'test' : 'training';
  }
  return sessione.modalita === 'training' ? 'training' : 'test';
}

function isSessioneJetTest(sessione) {
  return haDatiJet(sessione) && modalitaSessioneEffettiva(sessione) === 'test';
}


function jetValoreReale(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.some(jetValoreReale);
  if (typeof value === 'object') return Object.values(value).some(jetValoreReale);
  return String(value).trim() !== '';
}

function risultatiOriginaliJet(sessione) {
  const originale = jetOriginale(sessione);
  if (originale?.risultatiOriginali && typeof originale.risultatiOriginali === 'object') {
    return originale.risultatiOriginali;
  }
  if (sessione?.datiOriginali && typeof sessione.datiOriginali === 'object') {
    return sessione.datiOriginali;
  }
  return null;
}

function jetOriginaleHaRisultatiReali(sessione) {
  const risultati = risultatiOriginaliJet(sessione);
  return !!(risultati && Object.values(risultati).some(jetValoreReale));
}

function metricheOriginaliJet(sessione, limite = Infinity) {
  const risultati = risultatiOriginaliJet(sessione);
  if (!risultati) return [];

  const metriche = [];
  Object.entries(risultati).forEach(([label, raw]) => {
    if (!jetValoreReale(raw) || metriche.length >= limite) return;
    let valore = raw;
    if (Array.isArray(raw)) valore = raw.filter(jetValoreReale).join(' · ');
    else if (raw && typeof raw === 'object') return;
    const labelVisuale = String(label || '').replace(/^./u, (ch) => ch.toLocaleUpperCase('it-IT'));
    metriche.push({ key: label, label: labelVisuale, valore: String(valore), raw });
  });
  return metriche;
}

const JET_RAW_LABELS = {
  tempoReazioneMedio: ['Tempo di reazione medio'],
  tempoRilascioMedio: ['Tempo di rilascio medio'],
  tempoClickMedio: ['Tempo di click medio'],
  tempoTotale: ['Tempo totale'],
  tempoStimolo: ['Tempo'],
};

function aliasesCampoJet(campo) {
  const temporale = ['s', 'ms'].includes(campo.unit);
  const labels = [campo.label, ...(JET_RAW_LABELS[campo.key] || [])];
  const aliases = temporale ? [] : [{ name: campo.key, unit: campo.unit }];

  if (!temporale) {
    labels.forEach((label) => aliases.push({ name: label, unit: campo.unit }));
    return aliases;
  }

  for (const unit of ['s', 'ms']) {
    labels.forEach((label) => aliases.push({ name: `${label} (${unit})`, unit }));
    aliases.push({ name: `${campo.key}${unit}`, unit });
  }
  return aliases;
}

function normalizzaSessioneJet(sessione) {
  if (!sessione || !haDatiJet(sessione)) return sessione;
  const test = jetTest(sessione);
  if (!test) return sessione;
  const originale = sessione.datiOriginali;
  if (!originale || typeof originale !== 'object' || Array.isArray(originale)) return sessione;
  const converted = {};
  // Solo proprietà dirette: non si mescolano prove individuali, impostazioni e risultati.
  test.campi.filter((c) => c.tipo === 'number').forEach((campo) => {
    // La label UI può cambiare senza rompere la lettura dei nomi storici Jet.
    // Per i tempi continuiamo a richiedere un'unità esplicita (s/ms).
    const aliases = aliasesCampoJet(campo);
    const candidates = [];
    Object.entries(originale).forEach(([key, raw]) => {
      const alias = aliases.find((a) => a.name === campo.key ? key === campo.key : jetNome(a.name) === jetNome(key));
      if (!alias) return;
      let n = jetNumero(raw);
      if (n === null) return;
      if (alias.unit === 's' && campo.unit === 'ms') n *= 1000;
      if (alias.unit === 'ms' && campo.unit === 's') n /= 1000;
      if (n < 0 || (campo.unit === 'percent' && n > 100)) return;
      candidates.push(n);
    });
    if (candidates.length && candidates.every((n) => n === candidates[0])) converted[campo.key] = candidates[0];
  });
  const existing = sessione.esercizi?.[test.key] || {};
  Object.keys(converted).forEach((key) => {
    if (existing[key] !== undefined && existing[key] !== null && existing[key] !== '') delete converted[key];
  });
  if (!Object.keys(converted).length) return sessione;
  return { ...sessione, esercizi: { ...sessione.esercizi, [test.key]: { ...existing, ...converted } } };
}

function nomeTestSessione(sessione) {
  const test = jetTest(sessione);
  if (test) return test.label;
  const compilati = ESERCIZI_CONFIG.filter((e) => esercizioCompilato(e, sessione.esercizi?.[e.key]));
  if (compilati.length) return compilati.map((e) => e.label).join(' · ');
  const originale = jetOriginale(sessione);
  return sessione.jetProgramNomeOriginale || sessione.nomeTestOriginale ||
    (originale && originale.nomeTestOriginale) || sessione.tipoTest ||
    (originale && originale.tipoTest) || sessione.titolo || 'Sessione';
}


/*
 * Nome uniforme usato negli storici Test/Training.
 * Per Jet Program mostriamo sempre il nome originale del protocollo, così Test e
 * Training seguono la stessa logica di denominazione. La "x" iniziale è solo il
 * marcatore storico che distingue i Test e non fa parte del nome visualizzato.
 */
function nomeStoricoSessione(sessione) {
  const originale = nomeOriginaleSessioneJet(sessione);
  if (originale) return originale.replace(/^[xX](?=[A-Za-z0-9])/u, '');
  return nomeTestSessione(sessione);
}

function metricheStoricoSessione(sessione, limite = 6) {
  let metriche = typeof metrichePrincipaliSessione === 'function'
    ? metrichePrincipaliSessione(sessione)
    : [];
  if (!metriche.length) metriche = metricheOriginaliJet(sessione, limite);
  return metriche.slice(0, limite);
}

function jsonStabileStorico(value) {
  if (Array.isArray(value)) return '[' + value.map(jsonStabileStorico).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + jsonStabileStorico(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

function firmaValoriStorico(sessione) {
  const originali = risultatiOriginaliJet(sessione);
  if (originali && Object.values(originali).some(jetValoreReale)) return jsonStabileStorico(originali);

  const esercizi = sessione?.esercizi && typeof sessione.esercizi === 'object'
    ? { ...sessione.esercizi }
    : {};
  delete esercizi.jetProgramOriginale;
  return jsonStabileStorico(esercizi);
}

function riepilogoSessione(sessione) {
  const metriche = typeof metrichePrincipaliSessione === 'function' ? metrichePrincipaliSessione(sessione) : [];
  if (metriche.length) return metriche.slice(0, 3).map((m) => `${m.label}: ${m.valore}`).join(' · ');
  const originali = metricheOriginaliJet(sessione, 3);
  if (originali.length) return originali.map((m) => `${m.label}: ${m.valore}`).join(' · ');
  if (haDatiJet(sessione)) return 'Dati originali Jet Program disponibili';
  const n = contaEserciziCompilati(sessione);
  return n ? `${n} test con dati · Apri il dettaglio` : 'Nessun risultato registrato';
}


/* Sessioni storiche dell'app precedente: i tempi medi erano salvati in secondi
 * (es. 0.46) mentre l'interfaccia attuale li esprime in millisecondi.
 * La conversione è solo in memoria; Firestore non viene riscritto.
 */
const LEGACY_MS_FIELDS = {
  localizzazioneSpaziale: ['tempoReazioneMedio'],
  pedana360: ['tempoReazioneMedio'],
  proActionReaction: ['tempoRilascioMedio', 'tempoClickMedio'],
  attenzioneSeparata: ['tempoReazioneMedio'],
  reazioneVisuoMotoriaSceltaMultipla: ['tempoReazioneMedio'],
};

function normalizzaSessioneLegacy(sessione) {
  if (!sessione || haDatiJet(sessione) || sessione.modalita || sessione.testStandard) return sessione;
  const esercizi = sessione.esercizi;
  if (!esercizi || typeof esercizi !== 'object') return sessione;

  let cambiata = false;
  const nuoviEsercizi = { ...esercizi };

  Object.entries(LEGACY_MS_FIELDS).forEach(([testKey, campi]) => {
    const dati = esercizi[testKey];
    if (!dati || typeof dati !== 'object') return;
    const nuovo = { ...dati };
    let testCambiato = false;

    campi.forEach((key) => {
      const v = Number(dati[key]);
      if (Number.isFinite(v) && v > 0 && v < 10) {
        nuovo[key] = Math.round(v * 1000 * 100) / 100;
        testCambiato = true;
      }
    });

    if (testCambiato) {
      nuoviEsercizi[testKey] = nuovo;
      cambiata = true;
    }
  });

  return cambiata ? { ...sessione, esercizi: nuoviEsercizi } : sessione;
}

function sessioneHaDatiTest(sessione) {
  if (!sessione) return false;
  if (haDatiJet(sessione)) return true;

  const esercizi = sessione.esercizi;
  if (!esercizi || typeof esercizi !== 'object') return false;
  return Object.entries(esercizi).some(([key, value]) => {
    if (key === 'jetProgramOriginale') return value && typeof value === 'object' && Object.keys(value).length > 0;
    if (!value || typeof value !== 'object') return false;
    return Object.values(value).some((v) => {
      if (v === null || v === undefined || v === '') return false;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    });
  });
}
