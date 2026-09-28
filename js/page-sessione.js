registerServiceWorker();

const atletaId = getQueryParam('atletaId');
const sessioneId = getQueryParam('sessioneId') || null;
// Modalità dalla querystring per una sessione nuova; se si modifica una sessione
// esistente prevale la sua modalita già salvata (vedi init()), non quella nell'URL.
let _modalitaSessione = getSessioneConfig(getQueryParam('mode')).modalita;
let _sessioneCaricata = null;
let _salvataggio = false;

qs('#back-link').href = `./atleta.html?id=${atletaId}`;

function fieldId(esercizioKey, scKey, campoKey) {
  return scKey ? `f__${esercizioKey}__${scKey}__${campoKey}` : `f__${esercizioKey}__${campoKey}`;
}

function labelConUnita(campo) {
  if (campo.tipo !== 'number') return campo.label;
  const u = UNITA_LABEL[campo.unit];
  return u ? `${campo.label} (${u})` : campo.label;
}

/** Sincronizza lo stato visivo attivo dei pulsanti toggle Sì/No con il valore corrente dell'input nascosto. */
function sincronizzaToggle(wrapper, valore) {
  qsa('.toggle-btn', wrapper).forEach((b) => b.classList.toggle('active', b.dataset.value === valore));
}

function sincronizzaToggleDaInput(input) {
  const wrapper = input.parentElement.querySelector('.toggle-group');
  if (wrapper) sincronizzaToggle(wrapper, input.value);
}

function buildCampoBooleano(id, campo) {
  const hidden = el('input', { type: 'hidden', id, value: '' });
  const wrapper = el('div', { class: 'toggle-group' }, [
    el('button', { type: 'button', class: 'toggle-btn', 'data-value': 'Sì', text: 'Sì' }),
    el('button', { type: 'button', class: 'toggle-btn', 'data-value': 'No', text: 'No' }),
  ]);
  wrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    hidden.value = hidden.value === btn.dataset.value ? '' : btn.dataset.value;
    sincronizzaToggle(wrapper, hidden.value);
  });
  return el('div', { class: 'field' }, [el('label', { text: campo.label }), wrapper, hidden]);
}

function buildCampoField(esercizioKey, scKey, campo) {
  const id = fieldId(esercizioKey, scKey, campo.key);
  if (campo.tipo === 'boolean') return buildCampoBooleano(id, campo);
  const isText = campo.tipo === 'text';
  const inputProps = { type: isText ? 'text' : 'number', id };
  if (!isText) {
    inputProps.step = 'any';
    inputProps.inputmode = 'decimal';
    if (['s', 'ms', 'count', 'percent', 'per_sec', 'bpm'].includes(campo.unit)) inputProps.min = '0';
    if (campo.unit === 'percent') inputProps.max = '100';
  }
  return el('div', { class: 'field' }, [el('label', { for: id, text: labelConUnita(campo) }), el('input', inputProps)]);
}

function buildEsercizioSection(esercizio) {
  const body = el('div', { class: 'esercizio-body' });
  const campi = campiEsercizioVisibili(esercizio);

  if (esercizio.sottoCondizioni) {
    esercizio.sottoCondizioni.forEach((sc) => {
      const grid = el('div', { class: 'field-grid' }, campi.map((campo) => buildCampoField(esercizio.key, sc.key, campo)));
      body.appendChild(el('div', { class: 'sotto-condizione' }, [el('h4', { text: sc.label }), grid]));
    });
  } else if (esercizio.standard) {
    const principali = (esercizio.campiPrincipali || []).map((key) => campoEsercizio(esercizio, key)).filter(Boolean);
    const secondari = (esercizio.campiSecondari || []).map((key) => campoEsercizio(esercizio, key)).filter(Boolean);

    if (principali.length) {
      body.appendChild(el('p', { class: 'form-section-label', text: 'Risultati principali' }));
      body.appendChild(el('div', { class: 'field-grid primary-fields' }, principali.map((campo) => buildCampoField(esercizio.key, null, campo))));
    }
    if (secondari.length) {
      const extra = el('details', { class: 'secondary-fields' }, [
        el('summary', { text: 'Parametri e dettagli aggiuntivi' }),
        el('div', { class: 'field-grid', style: 'margin-top:14px;' }, secondari.map((campo) => buildCampoField(esercizio.key, null, campo))),
      ]);
      body.appendChild(extra);
    }
  } else {
    body.appendChild(el('div', { class: 'field-grid' }, campi.map((campo) => buildCampoField(esercizio.key, null, campo))));
  }

  return el('details', { class: 'esercizio', id: `es-${esercizio.key}` }, [el('summary', { text: esercizio.label }), body]);
}

function renderEserciziForm() {
  const container = qs('#esercizi-container');
  ESERCIZI_CONFIG.filter((esercizio) => !esercizio.custom).forEach((esercizio) => container.appendChild(buildEsercizioSection(esercizio)));
  const select = qs('#test-standard');
  TEST_STANDARD.forEach((test, index) => select.appendChild(el('option', { value: test.key, text: `${index + 1}. ${test.label}` })));
  if (!qs('#test-help')) {
    select.parentElement.appendChild(el('p', { id: 'test-help', class: 'test-help', text: 'Scegli un test per vedere solo i valori utili da compilare.' }));
    select.parentElement.appendChild(el('p', { class: 'unit-legend', text: 'Unità: ms = millisecondi · s = secondi · img/s = target al secondo · bpm = battiti/minuto.' }));
  }
  select.addEventListener('change', aggiornaTestVisibili);
  aggiornaTestVisibili();
}

function aggiornaTestVisibili() {
  const key = qs('#test-standard').value;
  const test = getEsercizioConfig(key);
  const help = qs('#test-help');
  if (help) help.textContent = test?.descrizione || 'Scegli un test per vedere solo i valori utili da compilare.';
  qsa('#esercizi-container > details').forEach((details) => {
    const testKey = details.id.slice(3);
    const esistente = _sessioneCaricata?.esercizi?.[testKey];
    details.hidden = testKey !== key && !esistente;
    if (!details.hidden) details.open = true;
  });
}

function mostraOriginali(sessione) {
  const test = jetTest(sessione) || getEsercizioConfig(sessione.testStandard);
  const metriche = metrichePrincipaliSessione(sessione);
  if (!test && !haDatiJet(sessione)) return;

  const container = qs('#dati-jet');
  container.hidden = false;
  container.classList.add('result-overview');

  if (test) {
    container.appendChild(el('p', { class: 'eyebrow', text: 'RISULTATI SESSIONE' }));
    container.appendChild(el('h2', { class: 'result-title', text: test.label }));
    if (test.descrizione) container.appendChild(el('p', { class: 'result-description', text: test.descrizione }));
  }

  if (metriche.length) {
    container.appendChild(el('div', { class: 'metric-grid' }, metriche.map((m) =>
      el('div', { class: 'metric-card' }, [
        el('span', { class: 'metric-label', text: m.label }),
        el('strong', { class: 'metric-value', text: m.valore }),
      ])
    )));
  } else if (haDatiJet(sessione)) {
    container.appendChild(el('p', { class: 'meta', text: 'I dati Jet Program originali sono presenti, ma questa prova non ha ancora valori standard utilizzabili.' }));
  }

  const anomalie = anomalieValoriSessione(sessione);
  if (anomalie.length) {
    container.appendChild(el('div', {
      class: 'data-warning',
      text: `${anomalie.length} valore/i Jet anomalo/i escluso/i dai riepiloghi e dai grafici: ${anomalie.join(', ')}.`,
    }));
  }

  if (haDatiJet(sessione)) {
    const originale = typeof jetOriginale === 'function' ? jetOriginale(sessione) : null;
    const nomeOriginale = sessione.jetProgramNomeOriginale || sessione.nomeTestOriginale || originale?.nomeTestOriginale || '';
    const details = el('details', { class: 'jet-original-details' }, [
      el('summary', { text: 'Dati tecnici originali Jet Program' }),
      nomeOriginale ? el('p', { class: 'original-test-name', text: nomeOriginale }) : el('span'),
      el('pre', { class: 'raw-data', text: JSON.stringify(originale || sessione.datiOriginali || {}, null, 2) }),
    ]);
    container.appendChild(details);
  }
}
function popolaEsercizio(esercizio, valore) {
  if (!valore) return;
  const detailsEl = qs(`#es-${esercizio.key}`);
  let haValori = false;
  if (esercizio.sottoCondizioni) {
    esercizio.sottoCondizioni.forEach((sc) => {
      const scValore = valore[sc.key];
      if (!scValore) return;
      campiEsercizioVisibili(esercizio).forEach((campo) => {
        const v = scValore[campo.key];
        if (v === undefined || v === null || v === '') return;
        const input = qs(`#${fieldId(esercizio.key, sc.key, campo.key)}`);
        if (!input) return;
        if (campo.tipo === 'number' && !valoreCampoValido(campo, v)) {
          input.parentElement.appendChild(el('small', { class: 'field-warning', text: 'Dato Jet anomalo escluso' }));
          return;
        }
        input.value = v;
        sincronizzaToggleDaInput(input);
        haValori = true;
      });
    });
  } else {
    campiEsercizioVisibili(esercizio).forEach((campo) => {
      const v = valore[campo.key];
      if (v === undefined || v === null || v === '') return;
      const input = qs(`#${fieldId(esercizio.key, null, campo.key)}`);
      if (!input) return;
      if (campo.tipo === 'number' && !valoreCampoValido(campo, v)) {
        input.parentElement.appendChild(el('small', { class: 'field-warning', text: 'Dato Jet anomalo escluso' }));
        return;
      }
      input.value = v;
      sincronizzaToggleDaInput(input);
      haValori = true;
    });
  }
  if (haValori) detailsEl.open = true;
}

function leggiEsercizio(esercizio) {
  if (esercizio.sottoCondizioni) {
    const risultato = {};
    let haValori = false;
    esercizio.sottoCondizioni.forEach((sc) => {
      const scRisultato = {};
      let scHaValori = false;
      campiEsercizioVisibili(esercizio).forEach((campo) => {
        const input = qs(`#${fieldId(esercizio.key, sc.key, campo.key)}`);
        if (input.value === '') return;
        scRisultato[campo.key] = campo.tipo === 'number' ? Number(input.value) : input.value.trim();
        scHaValori = true;
      });
      if (scHaValori) {
        risultato[sc.key] = scRisultato;
        haValori = true;
      }
    });
    return haValori ? risultato : null;
  }
  const risultato = {};
  let haValori = false;
  campiEsercizioVisibili(esercizio).forEach((campo) => {
    const input = qs(`#${fieldId(esercizio.key, null, campo.key)}`);
    if (input.value === '') return;
    risultato[campo.key] = campo.tipo === 'number' ? Number(input.value) : input.value.trim();
    haValori = true;
  });
  return haValori ? risultato : null;
}

function leggiTuttiEsercizi() {
  const esercizi = {};
  ESERCIZI_CONFIG.filter((esercizio) => !esercizio.custom && (sessioneId || esercizio.key === qs('#test-standard').value)).forEach((esercizio) => {
    const valore = leggiEsercizio(esercizio);
    if (valore) esercizi[esercizio.key] = valore;
  });
  return esercizi;
}

/* --- Allegati (foto/video) --- */

let _fotoEsistenti = []; // già salvate in IndexedDB (solo se si sta modificando una sessione esistente)
let _videoEsistenti = [];
let _nuoveFoto = []; // File in memoria, non ancora salvati (persistiti solo al click su "Salva sessione")
let _nuoviVideo = []; // [{ file, durata }]
let _objectUrlsGalleria = [];

function revocaUrlGalleria() {
  _objectUrlsGalleria.forEach((u) => URL.revokeObjectURL(u));
  _objectUrlsGalleria = [];
}

function creaUrlGalleria(blob) {
  const url = URL.createObjectURL(blob);
  _objectUrlsGalleria.push(url);
  return url;
}

function apriLightbox(url) {
  qs('#lightbox-img').src = url;
  qs('#lightbox').hidden = false;
}

/** Legge la durata (in secondi) di un video tramite un elemento <video> temporaneo. */
function leggiDurataVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossibile leggere i metadati del video'));
    };
  });
}

function buildAllegatoFoto(blob, onElimina) {
  const url = creaUrlGalleria(blob);
  return el('div', { class: 'allegato-item' }, [
    el('img', { src: url, alt: 'Foto allegata', onclick: () => apriLightbox(url) }),
    el('button', { type: 'button', class: 'allegato-elimina', text: '✕', onclick: onElimina }),
  ]);
}

function buildAllegatoVideo(blob, onElimina) {
  const url = creaUrlGalleria(blob);
  return el('div', { class: 'allegato-item video' }, [
    el('video', { src: url, controls: true }),
    el('button', { type: 'button', class: 'allegato-elimina', text: '✕', onclick: onElimina }),
  ]);
}

function renderGalleriaAllegati() {
  revocaUrlGalleria();
  const container = qs('#galleria-allegati');
  container.innerHTML = '';

  _fotoEsistenti.forEach((f) => {
    container.appendChild(
      buildAllegatoFoto(f.blob, async (e) => {
        e.stopPropagation();
        if (!confirm('Eliminare questa foto?')) return;
        await dbDeleteAllegatoFoto(f.id);
        _fotoEsistenti = _fotoEsistenti.filter((x) => x.id !== f.id);
        renderGalleriaAllegati();
      })
    );
  });

  _nuoveFoto.forEach((file, index) => {
    container.appendChild(
      buildAllegatoFoto(file, (e) => {
        e.stopPropagation();
        _nuoveFoto.splice(index, 1);
        renderGalleriaAllegati();
      })
    );
  });

  _videoEsistenti.forEach((v) => {
    container.appendChild(
      buildAllegatoVideo(v.blob, async () => {
        if (!confirm('Eliminare questo video?')) return;
        await dbDeleteAllegatoVideo(v.id);
        _videoEsistenti = _videoEsistenti.filter((x) => x.id !== v.id);
        renderGalleriaAllegati();
      })
    );
  });

  _nuoviVideo.forEach((entry, index) => {
    container.appendChild(
      buildAllegatoVideo(entry.file, () => {
        _nuoviVideo.splice(index, 1);
        renderGalleriaAllegati();
      })
    );
  });
}

qs('#btn-aggiungi-foto').addEventListener('click', () => qs('#input-foto').click());
qs('#btn-aggiungi-video').addEventListener('click', () => qs('#input-video').click());

qs('#input-foto').addEventListener('change', (e) => {
  _nuoveFoto.push(...e.target.files);
  e.target.value = '';
  renderGalleriaAllegati();
});

qs('#input-video').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const file of files) {
    try {
      const durata = await leggiDurataVideo(file);
      if (durata > 20) {
        alert('Il video supera i 20 secondi, registrane uno più breve.');
        continue;
      }
      _nuoviVideo.push({ file, durata });
    } catch (err) {
      alert('Impossibile leggere il video selezionato.');
    }
  }
  renderGalleriaAllegati();
});

qs('#lightbox').addEventListener('click', () => {
  qs('#lightbox').hidden = true;
});

window.addEventListener('pagehide', revocaUrlGalleria);

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  const atleta = await dbGetAtleta(atletaId);
  if (!atleta) {
    window.location.href = './index.html';
    return;
  }
  renderEserciziForm();

  if (sessioneId) {
    const sessione = await dbGetSessione(sessioneId);
    if (sessione) {
      if (sessione.atletaId !== atletaId) throw new Error('Questa sessione appartiene a un altro atleta.');
      _sessioneCaricata = sessione;
      qs('#test-standard').value = jetTest(sessione)?.key || sessione.testStandard || '';
      if (jetTest(sessione)) qs('#test-standard').disabled = true;
      mostraOriginali(sessione);
      if (sessione.esercizi && Object.keys(sessione.esercizi).length) qs('#esercizi-container').after(el('details', { class: 'card' }, [
        el('summary', { text: 'Tutti i risultati salvati, inclusi i parametri aggiuntivi' }),
        el('pre', { class: 'raw-data', text: JSON.stringify(sessione.esercizi, null, 2) }),
      ]));
      aggiornaTestVisibili();
      _modalitaSessione = getSessioneConfig(sessione.modalita).modalita;
      qs('#titolo-sessione').textContent = `${getSessioneConfig(_modalitaSessione).titoloModifica} - ${nomeCompleto(atleta)}`;
      qs('#f-data').value = sessione.data;
      qs('#f-titolo').value = sessione.titolo || '';
      ESERCIZI_CONFIG.filter((esercizio) => !esercizio.custom).forEach((esercizio) =>
        popolaEsercizio(esercizio, sessione.esercizi && sessione.esercizi[esercizio.key])
      );
      _fotoEsistenti = await dbGetAllegatiFotoBySessione(sessioneId);
      _videoEsistenti = await dbGetAllegatiVideoBySessione(sessioneId);
      qs('#btn-elimina-sessione').hidden = false;
    } else throw new Error('Sessione non trovata. Nessun dato è stato modificato.');
  } else {
    qs('#titolo-sessione').textContent = `${getSessioneConfig(_modalitaSessione).titoloNuova} - ${nomeCompleto(atleta)}`;
    qs('#f-data').value = oggiIso();
  }
  renderGalleriaAllegati();
  qs('#btn-salva').disabled = false;
}

qs('#btn-annulla').addEventListener('click', () => {
  window.location.href = `./atleta.html?id=${atletaId}`;
});

qs('#btn-elimina-sessione').addEventListener('click', async () => {
  if (!sessioneId) return;
  const data = qs('#f-data').value;
  if (!confirm(`Eliminare la sessione del ${formatDataIt(data)}?`)) return;
  await dbDeleteSessione(sessioneId);
  window.location.href = `./atleta.html?id=${atletaId}`;
});

qs('#btn-salva').addEventListener('click', async () => {
  if (_salvataggio) return;
  const data = qs('#f-data').value;
  if (!data) {
    qs('#f-data').focus();
    return;
  }
  const titolo = qs('#f-titolo').value.trim();
  const esercizi = leggiTuttiEsercizi();
  const testStandard = qs('#test-standard').value;
  if (!sessioneId && !testStandard) {
    mostraErrorePagina(new Error('Scegli il test da registrare.'));
    qs('#test-standard').focus();
    return;
  }
  if (!qsa('#esercizi-container input').every((input) => input.checkValidity())) {
    mostraErrorePagina(new Error('Controlla i valori inseriti.'));
    return;
  }
  const haAllegatiNuovi = _nuoveFoto.length > 0 || _nuoviVideo.length > 0;
  if (Object.keys(esercizi).length === 0 && !haAllegatiNuovi) {
    if (!confirm('Nessun esercizio compilato. Salvare comunque la sessione?')) return;
  }

  _salvataggio = true;
  qs('#btn-salva').disabled = true;
  try {
    let idSessioneFinale = sessioneId;
    if (sessioneId) {
      const sessione = await dbGetSessione(sessioneId);
      if (!sessione || sessione.atletaId !== atletaId) throw new Error('Sessione non disponibile.');
      // Gli esercizi "custom" (es. campoVisivoAvanzato) non passano da questo form: se la sessione
      // li aveva già (scritti da uno script esterno), li preservo invece di perderli al salvataggio.
      ESERCIZI_CONFIG.filter((e) => e.custom).forEach((e) => {
        if (sessione.esercizi && sessione.esercizi[e.key]) esercizi[e.key] = sessione.esercizi[e.key];
      });
      sessione.data = data;
      sessione.titolo = titolo;
      // Conserva anche chiavi e campi sconosciuti. Il form non cancella risultati storici.
      const merged = { ...sessione.esercizi };
      Object.entries(esercizi).forEach(([key, value]) => {
        merged[key] = { ...merged[key], ...value };
        const config = getEsercizioConfig(key);
        if (config?.sottoCondizioni) config.sottoCondizioni.forEach((sc) => {
          if (value[sc.key]) merged[key][sc.key] = { ...sessione.esercizi?.[key]?.[sc.key], ...value[sc.key] };
        });
      });
      sessione.esercizi = merged;
      if (testStandard) sessione.testStandard = testStandard;
      sessione.modalita = _modalitaSessione;
      await dbUpdateSessione(sessione);
    } else {
      idSessioneFinale = await dbAddSessione({ atletaId, data, titolo, esercizi, testStandard, modalita: _modalitaSessione });
    }

    for (const file of _nuoveFoto) {
      await dbAddAllegatoFoto({ sessioneId: idSessioneFinale, blob: file });
    }
    for (const { file, durata } of _nuoviVideo) {
      await dbAddAllegatoVideo({ sessioneId: idSessioneFinale, blob: file, durata });
    }

    window.location.href = `./atleta.html?id=${atletaId}`;
  } catch (err) {
    mostraErrorePagina(err);
  } finally {
    _salvataggio = false;
    qs('#btn-salva').disabled = false;
  }
});

init().catch((err) => { mostraErrorePagina(err); qs('#btn-salva').disabled = true; });
