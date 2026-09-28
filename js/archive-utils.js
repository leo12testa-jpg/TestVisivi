/*
 * Funzioni pure per individuare e unire profili atleta duplicati.
 * I dati esistenti non vengono sovrascritti: il profilo principale prevale,
 * i campi vuoti vengono completati e la sorgente unita resta tracciata.
 */

function archivioValoreVuoto(value) {
  return value === undefined || value === null || value === '';
}

function archivioContaCampiCompilati(value, key = '') {
  if (['id', 'createdAt', 'updatedAt', 'mergeStorico', 'mergedFromAthleteIds'].includes(key)) return 0;
  if (Array.isArray(value)) return value.reduce((tot, item) => tot + archivioContaCampiCompilati(item), 0);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((tot, [k, v]) => tot + archivioContaCampiCompilati(v, k), 0);
  }
  return archivioValoreVuoto(value) ? 0 : 1;
}

function archivioChiaveAtleta(atleta) {
  const corretto = typeof normalizzaAnagraficaCalciatore === 'function'
    ? normalizzaAnagraficaCalciatore(atleta || {})
    : (atleta || {});
  const testo = `${corretto.nome || ''}${corretto.cognome || ''}`;
  return typeof chiaveNome === 'function'
    ? chiaveNome(testo)
    : String(testo).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function archivioUnisciOggetti(principale, secondario, path = '') {
  if (!principale || typeof principale !== 'object' || Array.isArray(principale)) {
    return archivioValoreVuoto(principale) ? secondario : principale;
  }
  if (!secondario || typeof secondario !== 'object' || Array.isArray(secondario)) return principale;

  const risultato = { ...principale };
  Object.entries(secondario).forEach(([key, value]) => {
    if (['id', 'createdAt', 'updatedAt', 'mergeStorico', 'mergedFromAthleteIds'].includes(key)) return;
    const current = risultato[key];

    if (key === 'note' && !archivioValoreVuoto(value)) {
      if (archivioValoreVuoto(current)) risultato[key] = value;
      else if (String(current).trim() !== String(value).trim() && !String(current).includes(String(value))) {
        risultato[key] = `${String(current).trim()} · ${String(value).trim()}`;
      }
      return;
    }

    if (current && typeof current === 'object' && !Array.isArray(current) && value && typeof value === 'object' && !Array.isArray(value)) {
      risultato[key] = archivioUnisciOggetti(current, value, path ? `${path}.${key}` : key);
      return;
    }

    if (archivioValoreVuoto(current) && !archivioValoreVuoto(value)) risultato[key] = value;
  });
  return risultato;
}

function archivioUnisciProfiloAtleta(principale, secondario) {
  const corretto = typeof normalizzaAnagraficaCalciatore === 'function'
    ? normalizzaAnagraficaCalciatore(principale)
    : principale;
  const unito = archivioUnisciOggetti({ ...principale, nome: corretto.nome, cognome: corretto.cognome }, secondario);

  const ids = new Set([...(principale.mergedFromAthleteIds || []), ...(secondario.mergedFromAthleteIds || []), secondario.id].filter(Boolean));
  unito.mergedFromAthleteIds = [...ids];

  const storicoEsistente = Array.isArray(principale.mergeStorico) ? [...principale.mergeStorico] : [];
  if (secondario.id && !storicoEsistente.some((x) => x && x.sourceAthleteId === secondario.id)) {
    const snapshot = JSON.parse(JSON.stringify(secondario));
    delete snapshot.mergeStorico;
    unito.mergeStorico = [...storicoEsistente, {
      sourceAthleteId: secondario.id,
      mergedAt: new Date().toISOString(),
      sourceProfile: snapshot,
    }];
  } else if (storicoEsistente.length) {
    unito.mergeStorico = storicoEsistente;
  }

  return unito;
}

function archivioGruppoCompatibile(items) {
  const dateNascita = new Set(
    items.map((a) => String(a.dataNascita || '').trim()).filter(Boolean)
  );
  if (dateNascita.size > 1) return false;

  const nomiRaw = new Set(
    items
      .map((a) => typeof chiaveNome === 'function' ? chiaveNome(a.nome || '') : String(a.nome || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );
  return nomiRaw.size <= 1;
}

function archivioTrovaDoppioniAtleti(atleti, conteggioSessioni = {}) {
  const gruppi = new Map();
  (atleti || []).forEach((atleta) => {
    const key = archivioChiaveAtleta(atleta);
    if (!key) return;
    if (!gruppi.has(key)) gruppi.set(key, []);
    gruppi.get(key).push(atleta);
  });

  return [...gruppi.entries()]
    .filter(([, items]) => items.length > 1 && archivioGruppoCompatibile(items))
    .map(([key, items]) => {
      const ordinati = [...items].sort((a, b) => {
        const sa = Number(conteggioSessioni[a.id] || 0);
        const sb = Number(conteggioSessioni[b.id] || 0);
        if (sb !== sa) return sb - sa;
        const pa = archivioContaCampiCompilati(a);
        const pb = archivioContaCampiCompilati(b);
        if (pb !== pa) return pb - pa;
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });
      return {
        key,
        principale: ordinati[0],
        duplicati: ordinati.slice(1),
        sessioniTotali: ordinati.reduce((tot, a) => tot + Number(conteggioSessioni[a.id] || 0), 0),
      };
    });
}
