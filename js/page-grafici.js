registerServiceWorker();

const atletaId = getQueryParam('id');
let _renderJobs = [];

function buildTabellaSingola(esercizio, sessione) {
  const cols = colonneEsercizio(esercizio);
  const table = el('table', {}, [el('caption', { text: `${esercizio.label} — ${formatDataIt(sessione.data)}` })]);
  const tbody = el('tbody');
  cols.forEach((col) => {
    const val = col.get(sessione);
    if (val === '') return;
    tbody.appendChild(el('tr', {}, [el('th', { text: col.header }), el('td', { text: String(val) })]));
  });
  table.appendChild(tbody);
  return el('div', { class: 'table-scroll' }, [table]);
}

/** Tabella con le sole colonne non numeriche (testo/booleane), che non compaiono nei grafici. */
function buildTabellaAltreRisposte(esercizio, sessioni) {
  const colonne = colonneEsercizio(esercizio).filter((c) => c.tipo !== 'number');
  if (colonne.length === 0) return null;
  const righe = sessioni
    .map((s) => ({ s, valori: colonne.map((c) => c.get(s)) }))
    .filter(({ valori }) => valori.some((v) => v !== ''));
  if (righe.length === 0) return null;

  const thead = el('thead', {}, [el('tr', {}, [el('th', { text: 'Data' }), ...colonne.map((c) => el('th', { text: c.header }))])]);
  const tbody = el(
    'tbody',
    {},
    righe.map(({ s, valori }) => el('tr', {}, [el('td', { text: formatDataIt(s.data) }), ...valori.map((v) => el('td', { text: v === '' ? '-' : String(v) }))]))
  );
  const table = el('table', {}, [el('caption', { text: `${esercizio.label} — altre risposte` }), thead, tbody]);
  return el('div', { class: 'table-scroll' }, [table]);
}

/** Galleria per l'esercizio "custom" campoVisivoAvanzato: immagine polar plot + tabella settori per sessione. */
function buildGalleriaCampoVisivoAvanzato(sessioni) {
  const wrapper = el('div', { class: 'galleria-campo-avanzato' });
  sessioni.forEach((s) => {
    const dati = s.esercizi && s.esercizi.campoVisivoAvanzato;
    if (!dati) return;

    const modalitaTxt = dati.modalita ? `${dati.modalita}°` : '';
    const durataTxt = dati.durataSecondi !== undefined && dati.durataSecondi !== null && dati.durataSecondi !== '' ? `${dati.durataSecondi}s` : '';
    const intestazione = [formatDataIt(s.data), modalitaTxt, durataTxt].filter(Boolean).join(' · ');

    const blocco = el('div', { class: 'chart-block' }, [el('h3', { text: intestazione })]);

    if (dati.immaginePolarPlot) {
      blocco.appendChild(
        el('img', { src: dati.immaginePolarPlot, alt: 'Polar plot', style: 'max-width:100%;display:block;border-radius:8px;margin-bottom:10px;' })
      );
    }

    if (Array.isArray(dati.percentualiSettori) && dati.percentualiSettori.length > 0) {
      const table = el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [el('th', { text: 'Settore' }), el('th', { text: 'Fascia angoli' }), el('th', { text: '% corretta' })]),
        ]),
        el(
          'tbody',
          {},
          dati.percentualiSettori.map((r) =>
            el('tr', {}, [
              el('td', { text: String(r.settore) }),
              el('td', { text: r.fasciaAngoli }),
              el('td', { text: `${r.percentualeCorretta}%` }),
            ])
          )
        ),
      ]);
      blocco.appendChild(el('div', { class: 'table-scroll' }, [table]));
    }

    wrapper.appendChild(blocco);
  });
  return wrapper;
}

function buildChartBlock(group, sessioni) {
  const canvas = el('canvas');
  const block = el('div', { class: 'chart-block' }, [
    el('h3', { text: titoloGruppo(group) }),
    el('div', { class: 'chart-canvas-wrap' }, [canvas]),
  ]);
  _renderJobs.push({ canvas, sessioni, group });
  return block;
}

/**
 * Vista per l'esercizio "custom" tracciamentoVisivo: percentuale di risposte
 * corrette su tutte le sessioni, più un grafico dell'andamento del tempo di
 * risposta calcolato SOLO sulle sessioni con risposta corretta (il tempo non
 * è significativo se l'atleta non ha trovato la pallina giusta).
 */
function buildTracciamentoVisivoView(sessioni) {
  const totale = sessioni.length;
  const corrette = sessioni.filter((s) => s.esercizi.tracciamentoVisivo.corretto === true).length;
  const percentuale = totale ? Math.round((corrette / totale) * 100) : 0;

  const wrapper = el('div');
  wrapper.appendChild(
    el('div', { class: 'chart-block' }, [
      el('h3', { text: 'Risposte corrette' }),
      el('p', { style: 'font-size:2rem;font-weight:700;margin:0;', text: `${corrette}/${totale}` }),
      el('p', { class: 'meta', style: 'margin:4px 0 0;', text: `${percentuale}% di risposte corrette` }),
    ])
  );

  const sessioniCorrette = sessioni.filter((s) => s.esercizi.tracciamentoVisivo.corretto === true);
  if (sessioniCorrette.length >= 2) {
    const canvas = el('canvas');
    wrapper.appendChild(
      el('div', { class: 'chart-block' }, [
        el('h3', { text: 'Tempo di risposta (solo risposte corrette)' }),
        el('div', { class: 'chart-canvas-wrap' }, [canvas]),
      ])
    );
    _renderJobs.push({ canvas, tipo: 'tracciamentoVisivo', sessioni: sessioniCorrette });
  } else if (sessioniCorrette.length === 1) {
    const s = sessioniCorrette[0];
    wrapper.appendChild(
      el('p', {
        class: 'meta',
        text: `Tempo di risposta (unica sessione corretta): ${s.esercizi.tracciamentoVisivo.tempoRispostaMs} ms — ${formatDataIt(s.data)}`,
      })
    );
  } else {
    wrapper.appendChild(
      el('p', { class: 'meta', text: 'Nessuna risposta corretta ancora: il tempo di risposta comparirà qui non appena disponibile.' })
    );
  }
  return wrapper;
}

function renderTuttiGrafici() {
  _renderJobs.forEach((job) => {
    if (job.tipo === 'tracciamentoVisivo') {
      const labels = job.sessioni.map((s) => formatDataIt(s.data));
      const dati = job.sessioni.map((s) => Number(s.esercizi.tracciamentoVisivo.tempoRispostaMs));
      renderChart(job.canvas, lineChartConfig(labels, [{ label: 'Tempo di risposta', data: dati }], 'ms'));
      return;
    }
    const sessioniGruppo = sessioniConGruppo(job.sessioni, job.group);
    renderChart(job.canvas, buildGroupChartConfig(sessioniGruppo, job.group));
  });
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  const atleta = await dbGetAtleta(atletaId);
  if (!atleta) {
    window.location.href = './index.html';
    return;
  }
  qs('#back-link').href = `./atleta.html?id=${atletaId}`;
  qs('#titolo-grafici').textContent = `Grafici — ${nomeCompleto(atleta)}`;
  document.title = `Grafici ${nomeCompleto(atleta)} - Test Visivi`;

  const sessioni = await dbGetSessioniByAtleta(atletaId);
  const contenuto = qs('#contenuto');
  let mostratoAlmenoUno = false;

  ESERCIZI_CONFIG.forEach((esercizio) => {
    const sessioniCompilate = sessioni.filter((s) => esercizioCompilato(esercizio, s.esercizi && s.esercizi[esercizio.key]));
    if (sessioniCompilate.length === 0) return;
    mostratoAlmenoUno = true;

    const sezione = el('section', {}, [el('h2', { text: esercizio.label })]);

    if (esercizio.key === 'tracciamentoVisivo') {
      sezione.appendChild(buildTracciamentoVisivoView(sessioniCompilate));
    } else if (esercizio.custom) {
      sezione.appendChild(buildGalleriaCampoVisivoAvanzato(sessioniCompilate));
    } else if (sessioniCompilate.length === 1) {
      sezione.appendChild(buildTabellaSingola(esercizio, sessioniCompilate[0]));
    } else {
      getChartGroups(esercizio).forEach((group) => {
        sezione.appendChild(buildChartBlock(group, sessioniCompilate));
      });
      const tabellaAltreRisposte = buildTabellaAltreRisposte(esercizio, sessioniCompilate);
      if (tabellaAltreRisposte) sezione.appendChild(tabellaAltreRisposte);
    }
    contenuto.appendChild(sezione);
  });

  if (!mostratoAlmenoUno) {
    contenuto.appendChild(el('div', { class: 'empty-state', text: 'Nessun dato ancora registrato per questo atleta.' }));
    return;
  }

  renderTuttiGrafici();
  onThemeChange(renderTuttiGrafici);
}

init();
