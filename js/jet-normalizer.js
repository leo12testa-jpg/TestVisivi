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

function jetTest(sessione) {
  const nomi = [sessione.testStandard, sessione.nomeTestOriginale, sessione.tipoTest];
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
  return sessione.datiOriginali !== undefined && sessione.datiOriginali !== null;
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
  return sessione.nomeTestOriginale || sessione.tipoTest || sessione.titolo || 'Sessione';
}

function riepilogoSessione(sessione) {
  const parti = [];
  ESERCIZI_CONFIG.forEach((test) => {
    colonneEsercizio(test).forEach((col, i) => {
      const value = col.get(sessione);
      if (value === '' || col.tipo !== 'number' || jetNumero(value) === null) return;
      const campo = test.campi[i % test.campi.length];
      parti.push(`${col.header}: ${value}${UNITA_LABEL[campo.unit] ? ' ' + UNITA_LABEL[campo.unit] : ''}`);
    });
  });
  if (parti.length) return parti.slice(0, 3).join(' · ');
  if (haDatiJet(sessione)) return 'Risultati Jet Program disponibili · Apri il dettaglio originale';
  const n = contaEserciziCompilati(sessione);
  return n ? `${n} test con dati · Apri il dettaglio` : 'Nessun risultato registrato';
}
