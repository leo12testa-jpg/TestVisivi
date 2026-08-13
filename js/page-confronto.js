registerServiceWorker();

let _modalita = 'ultimo'; // 'ultimo' | 'andamento'

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
  const atleti = await dbGetAtleti();
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

async function aggiorna() {
  const { esercizio, scKey, campo } = campoSelezionato();
  if (!campo) return;
  const unitLabel = UNITA_LABEL[campo.unit] || '';
  const risultati = await raccogliDati(esercizio, scKey, campo);
  if (_modalita === 'ultimo') {
    renderUltimoValore(risultati, unitLabel);
  } else {
    renderAndamento(risultati, unitLabel);
  }
}

qs('#sel-esercizio').addEventListener('change', () => {
  popolaSelectCampi();
  aggiorna();
});
qs('#sel-campo').addEventListener('change', aggiorna);

qs('#btn-ultimo-valore').addEventListener('click', () => {
  _modalita = 'ultimo';
  qs('#btn-ultimo-valore').classList.remove('secondary');
  qs('#btn-andamento').classList.add('secondary');
  aggiorna();
});
qs('#btn-andamento').addEventListener('click', () => {
  _modalita = 'andamento';
  qs('#btn-andamento').classList.remove('secondary');
  qs('#btn-ultimo-valore').classList.add('secondary');
  aggiorna();
});

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  popolaSelectEsercizi();
  popolaSelectCampi();
  await aggiorna();
  onThemeChange(aggiorna);
}

init();
