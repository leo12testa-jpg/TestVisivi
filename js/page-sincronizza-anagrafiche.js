registerServiceWorker();

let _payloadAnagrafica = null;
let _previewAnagrafica = null;

function normKey(v) {
  return chiaveNome(String(v || ''));
}

function lateralita(v) {
  const key = normKey(v);
  if (!key) return '';
  if (key === 'dx') return 'Dx';
  if (key === 'sx') return 'Sx';
  if (key === 'alternato') return 'Alternato';
  if (key === 'sdx') return 'Sdx';
  if (key === 'rx') return 'Rx';
  return String(v).trim();
}

function scaricaBackup(dati, nomeFile) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }));
  const link = el('a', { href: url, download: nomeFile });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function normalizzaRiga(riga) {
  const key = normKey(riga.matchKey || riga.cognome || '');
  return {
    key,
    cognome: String(riga.cognome || '').trim(),
    aliases: [...new Set([key, ...(riga.aliases || []).map(normKey)].filter(Boolean))],
    avd: String(riga.avd ?? '').trim(),
    avs: String(riga.avs ?? '').trim(),
    avoo: String(riga.avoo ?? '').trim(),
    mano: lateralita(riga.mano),
    piede: lateralita(riga.piede),
    occhio: lateralita(riga.occhio),
  };
}

function firmaRiga(riga) {
  return JSON.stringify([riga.avd, riga.avs, riga.avoo, riga.mano, riga.piede, riga.occhio]);
}

function gruppiPayload(payload) {
  const mappa = new Map();
  (payload.righe || []).map(normalizzaRiga).forEach((riga) => {
    if (!riga.key) return;
    if (!mappa.has(riga.key)) mappa.set(riga.key, []);
    mappa.get(riga.key).push(riga);
  });
  return mappa;
}

function cognomiAtleta(atleta) {
  const normalizzato = normalizzaAnagraficaCalciatore(atleta || {});
  return new Set([
    normKey(atleta?.cognome),
    normKey(normalizzato?.cognome),
  ].filter(Boolean));
}

function atletaCorrisponde(atleta, riga) {
  const keys = cognomiAtleta(atleta);
  return riga.aliases.some((alias) => keys.has(alias));
}

async function preparaPreview(payload) {
  const atleti = await dbGetAtleti();
  const gruppi = gruppiPayload(payload);
  const righeValide = [];
  const conflitti = [];
  const mancanti = [];

  for (const [key, righe] of gruppi.entries()) {
    const firme = [...new Set(righe.map(firmaRiga))];
    if (firme.length > 1) {
      conflitti.push({
        key,
        cognome: righe[0].cognome || key,
        righe,
      });
      continue;
    }

    const riga = righe[righe.length - 1];
    const matches = atleti.filter((a) => atletaCorrisponde(a, riga));
    if (!matches.length) {
      mancanti.push({ key, cognome: riga.cognome || key });
      continue;
    }
    righeValide.push({ riga, matches });
  }

  return {
    atleti,
    righeValide,
    conflitti,
    mancanti,
    profiliDaAggiornare: righeValide.reduce((n, item) => n + item.matches.length, 0),
  };
}

function renderPreview() {
  const box = qs('#anagrafica-summary');
  box.innerHTML = '';

  if (!_payloadAnagrafica || !_previewAnagrafica) {
    box.appendChild(el('p', { class: 'meta', text: 'Nessun file selezionato.' }));
    return;
  }

  box.appendChild(el('div', { class: 'jet-sync-kpis' }, [
    el('div', { class: 'mini-metric' }, [
      el('span', { class: 'mini-metric-label', text: 'Atleti da aggiornare' }),
      el('strong', { text: String(_previewAnagrafica.profiliDaAggiornare) }),
    ]),
    el('div', { class: 'mini-metric' }, [
      el('span', { class: 'mini-metric-label', text: 'Conflitti' }),
      el('strong', { text: String(_previewAnagrafica.conflitti.length) }),
    ]),
    el('div', { class: 'mini-metric' }, [
      el('span', { class: 'mini-metric-label', text: 'Non trovati' }),
      el('strong', { text: String(_previewAnagrafica.mancanti.length) }),
    ]),
  ]));

  if (_previewAnagrafica.conflitti.length) {
    box.appendChild(el('p', {
      class: 'error-banner',
      text: 'Conflitti non applicati: ' + _previewAnagrafica.conflitti.map((x) => x.cognome).join(', ') + '.',
    }));
  }

  if (_previewAnagrafica.mancanti.length) {
    box.appendChild(el('p', {
      class: 'meta',
      text: 'Atleti non trovati: ' + _previewAnagrafica.mancanti.map((x) => x.cognome).join(', ') + '.',
    }));
  }

  box.appendChild(el('p', {
    class: 'meta',
    text: 'I campi vuoti nel file non cancellano valori già presenti.',
  }));
}

function unisciDatiClinici(atleta, riga) {
  const base = typeof datiCliniciVuoti === 'function' ? datiCliniciVuoti() : {};
  const dc = atleta.datiClinici || {};
  const merged = {
    ...base,
    ...dc,
    acuitaVisiva: {
      ...(base.acuitaVisiva || {}),
      ...(dc.acuitaVisiva || {}),
    },
    correzionePropria: {
      ...(base.correzionePropria || {}),
      ...(dc.correzionePropria || {}),
    },
    correzione: {
      ...(base.correzione || {}),
      ...(dc.correzione || {}),
    },
    schober3m: {
      ...(base.schober3m || {}),
      ...(dc.schober3m || {}),
    },
    brockString: {
      ...(base.brockString || {}),
      ...(dc.brockString || {}),
    },
  };

  if (riga.avd !== '') merged.acuitaVisiva.od = riga.avd;
  if (riga.avs !== '') merged.acuitaVisiva.os = riga.avs;
  if (riga.avoo !== '') merged.acuitaVisiva.binoculare = riga.avoo;
  if (riga.mano !== '') merged.manoDominante = riga.mano;
  if (riga.piede !== '') merged.piedeDominante = riga.piede;
  if (riga.occhio !== '') merged.occhioDirettoreMotorio = riga.occhio;

  return merged;
}

function log(msg) {
  const report = qs('#anagrafica-report');
  report.appendChild(el('div', { text: msg }));
}

async function applicaAggiornamento() {
  if (!_previewAnagrafica?.righeValide?.length) return;

  const btn = qs('#anagrafica-apply');
  btn.disabled = true;
  btn.textContent = 'Aggiornamento…';
  qs('#anagrafica-report-card').hidden = false;
  qs('#anagrafica-report').innerHTML = '';

  try {
    const backup = await dbEsportaCopiaDati();
    scaricaBackup(backup, 'testvisivi-prima-anagrafiche-' + oggiIso() + '.json');
    log('✓ Backup scaricato.');

    let aggiornati = 0;
    for (const item of _previewAnagrafica.righeValide) {
      for (const atleta of item.matches) {
        atleta.datiClinici = unisciDatiClinici(atleta, item.riga);
        await dbUpdateAtleta(atleta);
        aggiornati++;
        log('✓ ' + nomeCompleto(atleta));
      }
    }

    log('---');
    log('Aggiornamento completato: ' + aggiornati + ' profili aggiornati.');
    if (_previewAnagrafica.conflitti.length) {
      log('Non modificati per conflitto: ' + _previewAnagrafica.conflitti.map((x) => x.cognome).join(', ') + '.');
    }
    if (_previewAnagrafica.mancanti.length) {
      log('Non trovati: ' + _previewAnagrafica.mancanti.map((x) => x.cognome).join(', ') + '.');
    }

    btn.textContent = 'Aggiornamento completato';
  } catch (err) {
    log('ERRORE: ' + (err?.message || err));
    mostraErrorePagina(err);
    btn.disabled = false;
    btn.textContent = 'Applica aggiornamento';
  }
}

qs('#anagrafica-file').addEventListener('change', async (e) => {
  _payloadAnagrafica = null;
  _previewAnagrafica = null;
  qs('#anagrafica-apply').disabled = true;
  qs('#anagrafica-summary').innerHTML = '<p class="meta">Analisi del file…</p>';

  const file = e.target.files?.[0];
  if (!file) {
    renderPreview();
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.formato !== 'testvisivi-anagrafica-v1' || !Array.isArray(parsed.righe)) {
      throw new Error('Il file non è un aggiornamento anagrafico valido.');
    }
    _payloadAnagrafica = parsed;
    _previewAnagrafica = await preparaPreview(parsed);
    renderPreview();
    qs('#anagrafica-apply').disabled = _previewAnagrafica.righeValide.length === 0;
  } catch (err) {
    qs('#anagrafica-summary').innerHTML = '';
    qs('#anagrafica-summary').appendChild(el('p', { class: 'error-banner', text: err?.message || String(err) }));
  }
});

qs('#anagrafica-apply').addEventListener('click', applicaAggiornamento);

(async () => {
  const user = await richiedeLogin();
  if (!user) return;
})().catch(mostraErrorePagina);
