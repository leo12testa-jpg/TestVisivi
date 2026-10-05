registerServiceWorker();

let _deltaJet = null;
let _preview = null;

function jetSyncNorm(v) {
  return String(v ?? '').trim().toLocaleLowerCase('it-IT').replace(/\s+/g, ' ');
}

function jetSyncNameKey(cognome, nome) {
  return jetSyncNorm(cognome) + '|' + jetSyncNorm(nome);
}

function jetSyncDateIso(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
}

function jetSyncCount(delta) {
  return (delta?.atleti || []).reduce((tot, atleta) => tot + (Array.isArray(atleta.sessioni) ? atleta.sessioni.length : 0), 0);
}

function jetSyncLog(msg) {
  const box = qs('#jet-sync-log');
  if (!box) return;
  box.appendChild(el('div', { text: msg }));
  box.scrollTop = box.scrollHeight;
}

function jetSyncDownloadJson(nome, dati) {
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function jetSyncFillIfEmpty(obj, key, value) {
  if ((obj[key] === '' || obj[key] === null || obj[key] === undefined) &&
      value !== '' && value !== null && value !== undefined) {
    obj[key] = value;
  }
}

function jetSyncApplyProfile(atleta, src) {
  const a = src.anagrafica || {};
  jetSyncFillIfEmpty(atleta, 'altezza', a.altezza ?? '');
  jetSyncFillIfEmpty(atleta, 'dataNascita', jetSyncDateIso(a.dataNascita));
  jetSyncFillIfEmpty(atleta, 'telefono', a.telefono || '');
  jetSyncFillIfEmpty(atleta, 'email', a.email || '');
  jetSyncFillIfEmpty(atleta, 'note', a.note || '');
  atleta.jetProgramUserId = src.jetUserId;
  atleta.jetProgramAnagraficaOriginale = a;
  atleta.updatedAt = new Date().toISOString();
  return atleta;
}

function jetSyncRawValues(raw, label) {
  const v = raw?.[label];
  const values = Array.isArray(v) ? v : [v];
  return values
    .map((x) => typeof x === 'string' ? x.trim() : x)
    .filter((x) => x !== '' && x !== null && x !== undefined);
}

function jetSyncRawNumber(raw, label, mode = 'first') {
  const nums = jetSyncRawValues(raw, label)
    .map((x) => Number(String(x).replace(',', '.')))
    .filter(Number.isFinite);
  if (!nums.length) return null;
  if (mode === 'max') return Math.max(...nums);
  return nums[0];
}

function jetSyncStandardizzaRisultati(nomeOriginale, raw) {
  const temp = { jetProgramNomeOriginale: nomeOriginale, esercizi: { jetProgramOriginale: { nomeTestOriginale: nomeOriginale } } };
  const key = typeof chiaveStandardDaNomeProtocollo === 'function' ? chiaveStandardDaNomeProtocollo(temp) : null;
  if (!key) return { key: null, dati: null };

  const n = (label, mode) => jetSyncRawNumber(raw, label, mode);
  const dati = {};
  const set = (campo, valore) => {
    if (valore !== null && valore !== undefined && valore !== '') dati[campo] = valore;
  };
  const ms = (label) => {
    const valore = n(label);
    return valore === null ? null : Math.round(valore * 1000 * 1000) / 1000;
  };

  const comuniTarget = () => {
    set('tempoTotale', n('Tempo totale'));
    set('numeroTarget', n('Numero target'));
    set('errori', n('Errori'));
  };
  const comuniPedana = () => {
    set('recuperi', n('Pedana - numero recuperi'));
    set('tempoArea5', n('Pedana - tempo area 5gradi'));
    set('tempoAreaEsterna', n('Pedana - tempo area esterna'));
  };

  if (['localizzazioneSpaziale', 'pedana360', 'attenzioneSeparata'].includes(key)) {
    comuniTarget();
    set('tempoReazioneMedio', ms('Tempo di reazione medio'));
    set('immaginiColpite', n('Immagini colpite'));
    set('immaginiAlSec', n('Immagini al secondo'));
    if (key !== 'localizzazioneSpaziale' || n('Pedana - numero recuperi') !== null) comuniPedana();
  } else if (key === 'proActionReaction') {
    comuniTarget();
    set('tempoRilascioMedio', ms('Tempo di rilascio medio'));
    set('tempoClickMedio', ms('Tempo di click medio'));
  } else if (['velocitaPrecisioneAffollamento', 'ordinamentoStrategico', 'visualizzazioneTraiettorie'].includes(key)) {
    set('tempoTotale', n('Tempo totale'));
    set('clickErrati', n('Click errati'));
    set('numeroImmagini', n('Numero immagini'));
    set('immaginiColpite', n('Immagini colpite'));
    set('velocita', n('Velocita'));
    if (key === 'velocitaPrecisioneAffollamento') comuniPedana();
  } else if (['velocitaRiconoscimento', 'riconoscimentoNumeri'].includes(key)) {
    set('tempoTotale', n('Tempo totale'));
    set('quantitaNumeri', n('Cifre viste'));
    set('tempoStimolo', n('Tempo'));
    if (key === 'velocitaRiconoscimento') comuniPedana();
  } else if (key === 'percezioneCampoVisivo') {
    set('tempoTotale', n('Tempo totale'));
    set('angoloMassimo', n('angolo', 'max'));
    set('numeroTarget', n('Numero target'));
    set('numeroLettere', n('Numero lettere'));
    set('errori', n('Errori'));
    comuniPedana();
  } else if (key === 'memorizzazioneSequenze') {
    set('tempoTotale', n('Tempo totale'));
    set('livelloMassimo', n('Livello massimo completato'));
    set('errori', n('Errori'));
    const completa = jetSyncRawValues(raw, 'Completa')[0];
    set('completa', completa);
  } else if (key === 'reazioneVisuoMotoriaSceltaMultipla') {
    comuniTarget();
    set('tempoReazioneMedio', ms('Tempo di reazione medio'));
    set('corretti', n('Corretti'));
    set('metronomo', n('Metronomo'));
  } else if (key === 'localizzazioneAffollamentoOculare') {
    set('tempoTotale', n('Tempo totale'));
    set('metronomo', n('Metronomo'));
  }

  return { key, dati: Object.keys(dati).length ? dati : null };
}

function jetSyncSessionFromSource(atletaId, jetUserId, s) {
  const nomeOriginale = s.nomeTestOriginale || s.titolo || 'Sessione Jet Program';
  const modalita = /^x/i.test(String(nomeOriginale).trim()) ? 'test' : 'training';

  const standard = jetSyncStandardizzaRisultati(nomeOriginale, s.risultatiOriginali || {});
  const esercizi = {
    jetProgramOriginale: {
      nomeTestOriginale: nomeOriginale,
      nomeBreve: s.nomeBreve || '',
      categoria: s.categoria || '',
      tipoTest: s.tipoTest || '',
      descrizione: s.descrizione || '',
      noteReport: s.noteReport || '',
      risultatiSintesi: s.risultatiSintesi || {},
      parametriOriginali: s.parametriOriginali || {},
      risultatiOriginali: s.risultatiOriginali || {},
    },
  };
  if (standard.key && standard.dati) esercizi[standard.key] = standard.dati;

  return {
    atletaId,
    data: s.data || '',
    titolo: standard.key ? (TEST_STANDARD_LABELS[standard.key] || nomeOriginale) : nomeOriginale,
    modalita,
    origine: 'jetprogram',
    jetProgramUserId: jetUserId,
    jetProgramReportId: s.jetReportId,
    jetProgramStandardKey: standard.key || undefined,
    jetProgramNomeOriginale: nomeOriginale,
    jetProgramDataOraOriginale: s.dataOraOriginale || '',
    esercizi,
    createdAt: new Date().toISOString(),
  };
}

async function jetSyncLoadAthleteMaps() {
  const list = await dbGetAtleti();
  const byJet = new Map();
  const byName = new Map();

  list.forEach((a) => {
    if (a.jetProgramUserId !== undefined && a.jetProgramUserId !== null && a.jetProgramUserId !== '') {
      byJet.set(String(a.jetProgramUserId), a);
    }
    byName.set(jetSyncNameKey(a.cognome, a.nome), a);
  });

  return { list, byJet, byName };
}

async function jetSyncPreview(delta) {
  const maps = await jetSyncLoadAthleteMaps();
  let nuoviAtleti = 0;
  let esistentiAtleti = 0;
  let sessioniNuove = 0;
  let sessioniGiaPresenti = 0;

  for (const src of delta.atleti) {
    const esistente = maps.byJet.get(String(src.jetUserId)) || maps.byName.get(jetSyncNameKey(src.cognome, src.nome));
    if (esistente) esistentiAtleti++;
    else nuoviAtleti++;

    for (const s of (src.sessioni || [])) {
      const id = 'jet_' + String(src.jetUserId) + '_' + String(s.jetReportId);
      const doc = await _sessioniCol().doc(id).get();
      if (doc.exists) sessioniGiaPresenti++;
      else sessioniNuove++;
    }
  }

  return {
    nuoviAtleti,
    esistentiAtleti,
    sessioniNuove,
    sessioniGiaPresenti,
    sessioniTotali: jetSyncCount(delta),
  };
}

function jetSyncRenderPreview() {
  const box = qs('#jet-sync-summary');
  box.innerHTML = '';
  if (!_deltaJet || !_preview) {
    box.appendChild(el('p', { class: 'meta', text: 'Nessun file selezionato.' }));
    return;
  }

  box.appendChild(el('div', { class: 'jet-sync-kpis' }, [
    el('div', { class: 'mini-metric' }, [el('span', { class: 'mini-metric-label', text: 'Nuove sessioni' }), el('strong', { text: String(_preview.sessioniNuove) })]),
    el('div', { class: 'mini-metric' }, [el('span', { class: 'mini-metric-label', text: 'Già presenti' }), el('strong', { text: String(_preview.sessioniGiaPresenti) })]),
    el('div', { class: 'mini-metric' }, [el('span', { class: 'mini-metric-label', text: 'Nuovi atleti' }), el('strong', { text: String(_preview.nuoviAtleti) })]),
    el('div', { class: 'mini-metric' }, [el('span', { class: 'mini-metric-label', text: 'Atleti esistenti' }), el('strong', { text: String(_preview.esistentiAtleti) })]),
  ]));

  const periodi = [];
  _deltaJet.atleti.forEach((a) => (a.sessioni || []).forEach((s) => { if (s.data) periodi.push(s.data); }));
  periodi.sort();
  if (periodi.length) {
    box.appendChild(el('p', {
      class: 'meta',
      text: 'Periodo dati: ' + formatDataIt(periodi[0]) + ' - ' + formatDataIt(periodi[periodi.length - 1]) + '.',
    }));
  }
}

async function jetSyncFindOrCreateAthlete(src, maps) {
  let atleta = maps.byJet.get(String(src.jetUserId)) || maps.byName.get(jetSyncNameKey(src.cognome, src.nome));
  if (!atleta) {
    const id = await dbAddAtleta({ nome: src.nome || '', cognome: src.cognome || '', squadraId: '' });
    atleta = await dbGetAtleta(id);
    jetSyncLog('Creato atleta: ' + nomeCompleto(atleta));
  }

  jetSyncApplyProfile(atleta, src);
  await dbUpdateAtleta(atleta);
  maps.byJet.set(String(src.jetUserId), atleta);
  maps.byName.set(jetSyncNameKey(atleta.cognome, atleta.nome), atleta);
  return atleta;
}

async function jetSyncRun() {
  if (!_deltaJet || !_preview || !_preview.sessioniNuove) return;

  const button = qs('#jet-sync-start');
  const fileInput = qs('#jet-delta-file');
  const progressCard = qs('#jet-sync-progress-card');
  const progress = qs('#jet-sync-progress');
  const label = qs('#jet-sync-progress-label');

  button.disabled = true;
  fileInput.disabled = true;
  progressCard.hidden = false;
  qs('#jet-sync-log').innerHTML = '';

  try {
    label.textContent = 'Creazione copia di sicurezza…';
    const backup = await dbEsportaCopiaDati();
    jetSyncDownloadJson('testvisivi-prima-sync-jet-' + oggiIso() + '.json', backup);
    jetSyncLog('✓ Copia di sicurezza scaricata.');

    const maps = await jetSyncLoadAthleteMaps();
    const totale = _preview.sessioniNuove;
    let completate = 0;
    let saltate = 0;
    progress.max = Math.max(1, totale);
    progress.value = 0;

    for (const src of _deltaJet.atleti) {
      const atleta = await jetSyncFindOrCreateAthlete(src, maps);
      const nuove = [];

      for (const s of (src.sessioni || [])) {
        const id = 'jet_' + String(src.jetUserId) + '_' + String(s.jetReportId);
        const ref = _sessioniCol().doc(id);
        const doc = await ref.get();
        if (doc.exists) {
          saltate++;
          continue;
        }
        nuove.push({ id, data: jetSyncSessionFromSource(atleta.id, src.jetUserId, s) });
      }

      const chunkSize = 20;
      for (let i = 0; i < nuove.length; i += chunkSize) {
        const batch = firebase.firestore().batch();
        const chunk = nuove.slice(i, i + chunkSize);
        chunk.forEach((item) => batch.set(_sessioniCol().doc(item.id), item.data, { merge: false }));
        await batch.commit();
        completate += chunk.length;
        progress.value = completate;
        label.textContent = completate + ' / ' + totale + ' nuove sessioni';
      }

      jetSyncLog('✓ ' + nomeCompleto(atleta) + ': ' + nuove.length + ' nuove sessioni.');
    }

    jetSyncLog('---');
    jetSyncLog('COMPLETATO: ' + completate + ' nuove sessioni importate' + (saltate ? ', ' + saltate + ' già presenti saltate' : '') + '.');
    label.textContent = 'Completato: ' + completate + ' nuove sessioni.';
    _preview = await jetSyncPreview(_deltaJet);
    jetSyncRenderPreview();
  } catch (err) {
    jetSyncLog('ERRORE: ' + (err?.message || err));
    mostraErrorePagina(err);
  } finally {
    button.disabled = !_preview?.sessioniNuove;
    fileInput.disabled = false;
  }
}

qs('#jet-delta-file').addEventListener('change', async (e) => {
  _deltaJet = null;
  _preview = null;
  qs('#jet-sync-start').disabled = true;
  qs('#jet-sync-summary').innerHTML = '<p class="meta">Analisi del file…</p>';

  const file = e.target.files?.[0];
  if (!file) {
    jetSyncRenderPreview();
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.meta?.format !== 'jetprogram-backup-v1' || !Array.isArray(parsed.atleti)) {
      throw new Error('Il file selezionato non è un delta Jet Program valido.');
    }

    _deltaJet = parsed;
    _preview = await jetSyncPreview(parsed);
    jetSyncRenderPreview();
    qs('#jet-sync-start').disabled = _preview.sessioniNuove === 0;
    jetSyncLog('File valido: ' + parsed.atleti.length + ' atleti, ' + _preview.sessioniTotali + ' sessioni nel delta.');
  } catch (err) {
    qs('#jet-sync-summary').innerHTML = '';
    qs('#jet-sync-summary').appendChild(el('p', { class: 'error-banner', text: err?.message || String(err) }));
  }
});

qs('#jet-sync-start').addEventListener('click', jetSyncRun);

async function initJetSync() {
  const user = await richiedeLogin();
  if (!user) return;
  jetSyncLog('Pronto. Seleziona il file delta Jet Program.');
}

initJetSync().catch(mostraErrorePagina);
