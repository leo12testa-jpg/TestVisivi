registerServiceWorker();

const atletaId = getQueryParam('atletaId');
const sessioneId = getQueryParam('sessioneId') || null;

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
  }
  return el('div', { class: 'field' }, [el('label', { for: id, text: labelConUnita(campo) }), el('input', inputProps)]);
}

function buildEsercizioSection(esercizio) {
  const body = el('div', { class: 'esercizio-body' });
  if (esercizio.sottoCondizioni) {
    esercizio.sottoCondizioni.forEach((sc) => {
      const grid = el(
        'div',
        { class: 'field-grid' },
        esercizio.campi.map((campo) => buildCampoField(esercizio.key, sc.key, campo))
      );
      body.appendChild(el('div', { class: 'sotto-condizione' }, [el('h4', { text: sc.label }), grid]));
    });
  } else {
    const grid = el(
      'div',
      { class: 'field-grid' },
      esercizio.campi.map((campo) => buildCampoField(esercizio.key, null, campo))
    );
    body.appendChild(grid);
  }
  const details = el('details', { class: 'esercizio', id: `es-${esercizio.key}` }, [el('summary', { text: esercizio.label }), body]);
  return details;
}

function renderEserciziForm() {
  const container = qs('#esercizi-container');
  ESERCIZI_CONFIG.forEach((esercizio) => container.appendChild(buildEsercizioSection(esercizio)));
}

function popolaEsercizio(esercizio, valore) {
  if (!valore) return;
  const detailsEl = qs(`#es-${esercizio.key}`);
  let haValori = false;
  if (esercizio.sottoCondizioni) {
    esercizio.sottoCondizioni.forEach((sc) => {
      const scValore = valore[sc.key];
      if (!scValore) return;
      esercizio.campi.forEach((campo) => {
        const v = scValore[campo.key];
        if (v === undefined || v === null || v === '') return;
        const input = qs(`#${fieldId(esercizio.key, sc.key, campo.key)}`);
        input.value = v;
        sincronizzaToggleDaInput(input);
        haValori = true;
      });
    });
  } else {
    esercizio.campi.forEach((campo) => {
      const v = valore[campo.key];
      if (v === undefined || v === null || v === '') return;
      const input = qs(`#${fieldId(esercizio.key, null, campo.key)}`);
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
      esercizio.campi.forEach((campo) => {
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
  esercizio.campi.forEach((campo) => {
    const input = qs(`#${fieldId(esercizio.key, null, campo.key)}`);
    if (input.value === '') return;
    risultato[campo.key] = campo.tipo === 'number' ? Number(input.value) : input.value.trim();
    haValori = true;
  });
  return haValori ? risultato : null;
}

function leggiTuttiEsercizi() {
  const esercizi = {};
  ESERCIZI_CONFIG.forEach((esercizio) => {
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
      qs('#titolo-sessione').textContent = `Modifica sessione - ${nomeCompleto(atleta)}`;
      qs('#f-data').value = sessione.data;
      qs('#f-titolo').value = sessione.titolo || '';
      ESERCIZI_CONFIG.forEach((esercizio) => popolaEsercizio(esercizio, sessione.esercizi && sessione.esercizi[esercizio.key]));
      _fotoEsistenti = await dbGetAllegatiFotoBySessione(sessioneId);
      _videoEsistenti = await dbGetAllegatiVideoBySessione(sessioneId);
      qs('#btn-elimina-sessione').hidden = false;
    }
  } else {
    qs('#titolo-sessione').textContent = `Nuova sessione - ${nomeCompleto(atleta)}`;
    qs('#f-data').value = oggiIso();
  }
  renderGalleriaAllegati();
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
  const data = qs('#f-data').value;
  if (!data) {
    qs('#f-data').focus();
    return;
  }
  const titolo = qs('#f-titolo').value.trim();
  const esercizi = leggiTuttiEsercizi();
  const haAllegatiNuovi = _nuoveFoto.length > 0 || _nuoviVideo.length > 0;
  if (Object.keys(esercizi).length === 0 && !haAllegatiNuovi) {
    if (!confirm('Nessun esercizio compilato. Salvare comunque la sessione?')) return;
  }

  let idSessioneFinale = sessioneId;
  if (sessioneId) {
    const sessione = await dbGetSessione(sessioneId);
    sessione.data = data;
    sessione.titolo = titolo;
    sessione.esercizi = esercizi;
    await dbUpdateSessione(sessione);
  } else {
    idSessioneFinale = await dbAddSessione({ atletaId, data, titolo, esercizi });
  }

  for (const file of _nuoveFoto) {
    await dbAddAllegatoFoto({ sessioneId: idSessioneFinale, blob: file });
  }
  for (const { file, durata } of _nuoviVideo) {
    await dbAddAllegatoVideo({ sessioneId: idSessioneFinale, blob: file, durata });
  }

  window.location.href = `./atleta.html?id=${atletaId}`;
});

init();
