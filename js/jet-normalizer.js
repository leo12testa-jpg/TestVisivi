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

function normalizzaSessioneJet(sessione) {
  if (!sessione || !haDatiJet(sessione)) return sessione;
  const test = jetTest(sessione);
  if (!test) return sessione;
  const originale = sessione.datiOriginali;
  if (!originale || typeof originale !== 'object' || Array.isArray(originale)) return sessione;
  const converted = {};
  // Solo proprietà dirette: non si mescolano prove individuali, impostazioni e risultati.
  test.campi.filter((c) => c.tipo === 'number').forEach((campo) => {
    const temporale = ['s', 'ms'].includes(campo.unit);
    const aliases = temporale ? [] : [{ name: campo.key, unit: campo.unit }];
    // Un'etichetta temporale senza unità non garantisce secondi/millisecondi.
    if (!temporale) aliases.push({ name: campo.label, unit: campo.unit });
    if (temporale) {
      for (const unit of ['s', 'ms']) {
        aliases.push({ name: `${campo.label} (${unit})`, unit });
        aliases.push({ name: `${campo.key}${unit}`, unit });
      }
    }
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

function riepilogoSessione(sessione) {
  const metriche = typeof metrichePrincipaliSessione === 'function' ? metrichePrincipaliSessione(sessione) : [];
  if (metriche.length) return metriche.slice(0, 3).map((m) => `${m.label}: ${m.valore}`).join(' · ');
  if (haDatiJet(sessione)) return 'Dati originali Jet Program disponibili';
  const n = contaEserciziCompilati(sessione);
  return n ? `${n} test con dati · Apri il dettaglio` : 'Nessun risultato registrato';
}
