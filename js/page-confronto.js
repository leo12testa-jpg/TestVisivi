registerServiceWorker();

let _modalita = 'ultimo'; // 'ultimo' | 'andamento'

async function popolaSelectSquadre() {
  const squadre = await dbGetSquadre();
  const sel = qs('#sel-squadra');
  sel.innerHTML = '';
  sel.appendChild(el('option', { value: '', text: 'Tutte' }));
  squadre.forEach((s) => sel.appendChild(el('option', { value: s.id, text: s.nome })));
}

function popolaSelectEsercizi() {
  const sel = qs('#sel-esercizio');
  ESERCIZI_CONFIG.forEach((es) => {
    sel.appendChild(el('option', { value: es.key, text: es.label }));
  });
}

function popolaSelectCampi() {
  const esercizio = getEsercizioConfig(qs('#sel-esercizio').value);
  const sel = qs('#sel-campo');
  sel.innerHTML = '';
  const numerici = esercizio.campi.filter((c) => c.tipo !== 'text');
  if (esercizio.sottoCondizioni) {
    esercizio.sottoCondizioni.forEach((sc) => {
      numerici.forEach((campo) => {
        sel.appendChild(el('option', { value: `${sc.key}::${campo.key}`, text: `${sc.label} — ${campo.label}` }));
      });
    });
  } else {
    numerici.forEach((campo) => {
      sel.appendChild(el('option', { value: `::${campo.key}`, text: campo.label }));
    });
  }
}

function campoSelezionato() {
  const esercizio = getEsercizioConfig(qs('#sel-esercizio').value);
  const [scKey, campoKey] = qs('#sel-campo').value.split('::');
  const campo = esercizio.campi.find((c) => c.key === campoKey);
  return { esercizio, scKey: scKey || null, campo };
}

async function raccogliDati(esercizio, scKey, campo) {
  let atleti = await dbGetAtleti();
  const squadraSelezionata = qs('#sel-squadra').value;
  if (squadraSelezionata) atleti = atleti.filter((a) => a.squadraId === squadraSelezionata);
  const risultati = [];
  for (const atleta of atleti) {
    const sessioni = await dbGetSessioniByAtleta(atleta.id);
    const punti = sessioni
      .map((s) => ({ data: s.data, valore: getValoreCampoRaw(s, esercizio.key, scKey, campo.key) }))
      .filter((p) => p.valore !== '')
      .map((p) => ({ data: p.data, valore: Number(p.valore) }));
    if (punti.length > 0) risultati.push({ atleta, punti });
  }
  return risultati;
}

function renderUltimoValore(risultati, unitLabel) {
  const container = qs('#risultato');
  container.innerHTML = '';
  if (risultati.length === 0) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessun atleta ha ancora questo dato registrato.' }));
    return;
  }
  const ordinati = [...risultati].sort((a, b) => nomeCompleto(a.atleta).localeCompare(nomeCompleto(b.atleta)));
  const labels = ordinati.map((r) => nomeCompleto(r.atleta));
  const valori = ordinati.map((r) => r.punti[r.punti.length - 1].valore);

  const canvas = el('canvas');
  const block = el('div', { class: 'chart-block' }, [el('h3', { text: 'Ultimo valore per atleta' }), el('div', { class: 'chart-canvas-wrap' }, [canvas])]);
  container.appendChild(block);
  renderChart(canvas, buildBarChartConfig(labels, valori, unitLabel));
}

function renderMediaSquadra(risultati, unitLabel) {
  const container = qs('#risultato');
  container.innerHTML = '';
  if (risultati.length === 0) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessun atleta della squadra ha ancora questo dato registrato.' }));
    return;
  }
  const medieAtleta = risultati.map((r) => r.punti.reduce((somma, p) => somma + p.valore, 0) / r.punti.length);
  const media = medieAtleta.reduce((somma, v) => somma + v, 0) / medieAtleta.length;

  const block = el('div', { class: 'chart-block' }, [
    el('h3', { text: 'Media squadra' }),
    el('p', { style: 'font-size:2rem;font-weight:700;margin:8px 0 4px;', text: `${media.toFixed(2)}${unitLabel ? ' ' + unitLabel : ''}` }),
    el('p', { class: 'meta', text: `Calcolata su ${risultati.length} atlet${risultati.length === 1 ? 'a' : 'i'} con almeno un dato.` }),
  ]);
  container.appendChild(block);
}

function renderAndamento(risultati, unitLabel) {
  const container = qs('#risultato');
  container.innerHTML = '';
  const conAndamento = risultati.filter((r) => r.punti.length >= 2);
  if (conAndamento.length === 0) {
    container.appendChild(el('div', { class: 'empty-state', text: 'Nessun atleta ha almeno 2 sessioni con questo dato.' }));
    return;
  }
  const ordinati = [...conAndamento].sort((a, b) => nomeCompleto(a.atleta).localeCompare(nomeCompleto(b.atleta)));
  const palette = chartPalette();
  const troncato = ordinati.length > palette.length;
  const inclusi = troncato ? ordinati.slice(0, palette.length) : ordinati;

  const dateSet = new Set();
  inclusi.forEach((r) => r.punti.forEach((p) => dateSet.add(p.data)));
  const dateOrdinate = Array.from(dateSet).sort();
  const labels = dateOrdinate.map(formatDataIt);

  const datasets = inclusi.map((r) => {
    const mappa = new Map(r.punti.map((p) => [p.data, p.valore]));
    return { label: nomeCompleto(r.atleta), data: dateOrdinate.map((d) => (mappa.has(d) ? mappa.get(d) : null)) };
  });

  const canvas = el('canvas');
  const block = el('div', { class: 'chart-block' }, [el('h3', { text: 'Andamento per atleta' }), el('div', { class: 'chart-canvas-wrap' }, [canvas])]);
  container.appendChild(block);
  renderChart(canvas, lineChartConfig(labels, datasets, unitLabel));

  if (troncato) {
    container.appendChild(
      el('p', { class: 'meta', text: `Mostrati i primi ${palette.length} atleti su ${ordinati.length} (in ordine alfabetico) per leggibilità del grafico.` })
    );
  }
}

function aggiornaClassiModalita() {
  qs('#btn-ultimo-valore').classList.toggle('secondary', _modalita !== 'ultimo');
  qs('#btn-andamento').classList.toggle('secondary', _modalita !== 'andamento');
  qs('#btn-media-squadra').classList.toggle('secondary', _modalita !== 'media');
}

function selezionaModalita(nuovaModalita) {
  _modalita = nuovaModalita;
  aggiornaClassiModalita();
  aggiorna();
}

function aggiornaVisibilitaMediaSquadra() {
  const squadraSelezionata = qs('#sel-squadra').value;
  qs('#btn-media-squadra').hidden = !squadraSelezionata;
  if (!squadraSelezionata && _modalita === 'media') {
    _modalita = 'ultimo';
  }
  aggiornaClassiModalita();
}

async function aggiorna() {
  const { esercizio, scKey, campo } = campoSelezionato();
  if (!campo) return;
  const unitLabel = UNITA_LABEL[campo.unit] || '';
  const risultati = await raccogliDati(esercizio, scKey, campo);
  if (_modalita === 'ultimo') {
    renderUltimoValore(risultati, unitLabel);
  } else if (_modalita === 'media') {
    renderMediaSquadra(risultati, unitLabel);
  } else {
    renderAndamento(risultati, unitLabel);
  }
}

qs('#sel-squadra').addEventListener('change', () => {
  aggiornaVisibilitaMediaSquadra();
  aggiorna();
});
qs('#sel-esercizio').addEventListener('change', () => {
  popolaSelectCampi();
  aggiorna();
});
qs('#sel-campo').addEventListener('change', aggiorna);

qs('#btn-ultimo-valore').addEventListener('click', () => selezionaModalita('ultimo'));
qs('#btn-andamento').addEventListener('click', () => selezionaModalita('andamento'));
qs('#btn-media-squadra').addEventListener('click', () => selezionaModalita('media'));

async function init() {
  const user = await richiedeLogin();
  if (!user) return;

  await popolaSelectSquadre();
  aggiornaVisibilitaMediaSquadra();
  popolaSelectEsercizi();
  popolaSelectCampi();
  await aggiorna();
  onThemeChange(aggiorna);
}

init();
