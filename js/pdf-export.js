/*
 * Report PDF atleta - layout professionale, dati sintetici e grafici.
 * jsPDF e Chart.js sono vendorizzati: nessuna dipendenza esterna.
 */

function formatoImmagineDaDataUrl(dataUrl) {
  const match = /^data:image\/(png|jpeg|jpg);base64,/i.exec(dataUrl || '');
  if (!match) return 'PNG';
  const tipo = match[1].toUpperCase();
  return tipo === 'JPG' ? 'JPEG' : tipo;
}

function dimensioniImmagine(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ larghezza: img.naturalWidth, altezza: img.naturalHeight });
    img.onerror = () => reject(new Error('immagine non leggibile'));
    img.src = dataUrl;
  });
}

function renderChartOffscreen(config, widthPx, heightPx) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    // Risoluzione contenuta per report con molti grafici: meno pixel da codificare.
    canvas.width = Math.round(widthPx * 0.65);
    canvas.height = Math.round(heightPx * 0.65);
    canvas.style.position = 'fixed';
    canvas.style.left = '-99999px';
    canvas.style.top = '0';
    document.body.appendChild(canvas);

    const cfg = {
      ...config,
      options: {
        ...config.options,
        responsive: false,
        animation: false,
        devicePixelRatio: 1,
        plugins: {
          ...(config.options?.plugins || {}),
          legend: { ...(config.options?.plugins?.legend || {}), labels: { boxWidth: 10, font: { size: 11 } } },
        },
      },
    };

    const chart = new Chart(canvas, cfg);
    requestAnimationFrame(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        chart.destroy();
        canvas.remove();
      }
    });
  });
}
async function esportaReportPdf(atletaRaw, sessioniRaw, opzioni = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const atleta = typeof normalizzaAnagraficaCalciatore === 'function'
    ? normalizzaAnagraficaCalciatore(atletaRaw)
    : atletaRaw;

  let squadraNome = '';
  if (atleta.squadraId && typeof dbGetSquadra === 'function') {
    try {
      const squadra = await dbGetSquadra(atleta.squadraId);
      squadraNome = squadra?.nome || '';
    } catch (_) {}
  }

  const sessioni = (sessioniRaw || [])
    .filter(isSessioneTest)
    .filter((s) => typeof sessioneHaRisultatiVisibili !== 'function' || sessioneHaRisultatiVisibili(s))
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

  let tutteSessioniPerRadar = [];
  if (typeof dbGetAllSessioni === 'function') {
    try {
      tutteSessioniPerRadar = (await dbGetAllSessioni()).filter(isSessioneTest);
    } catch (_) {
      tutteSessioniPerRadar = sessioni;
    }
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const usableWidth = pageWidth - marginX * 2;
  const footerY = pageHeight - 9;
  let y = 18;

  const C = {
    navy: [21, 62, 105],
    navyDark: [12, 38, 65],
    blueSoft: [237, 244, 250],
    ink: [24, 31, 38],
    muted: [99, 112, 125],
    line: [220, 226, 232],
    paper: [250, 251, 252],
    white: [255, 255, 255],
  };

  function testoValido(v) {
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  function paginaNuova() {
    doc.addPage();
    y = 18;
  }

  function assicuraSpazio(mm) {
    if (y + mm > footerY - 6) paginaNuova();
  }

  function setInk() {
    doc.setTextColor(...C.ink);
  }

  function linea(yPos = y) {
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.25);
    doc.line(marginX, yPos, marginX + usableWidth, yPos);
  }

  function titoloSezione(titolo, sottotitolo = '') {
    assicuraSpazio(sottotitolo ? 16 : 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...C.navyDark);
    doc.text(titolo, marginX, y);
    y += 5;
    if (sottotitolo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text(sottotitolo, marginX, y, { maxWidth: usableWidth });
      y += 5;
    }
    linea(y);
    y += 5;
    setInk();
  }

  function testoRiga(label, valore, x, yPos, maxWidth) {
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, yPos, { maxWidth });
    doc.setTextColor(...C.ink);
    doc.setFont('helvetica', 'bold');
    doc.text(String(valore), x, yPos + 4.2, { maxWidth });
  }

  function cardKpi(x, yPos, width, label, value) {
    doc.setFillColor(...C.paper);
    doc.setDrawColor(...C.line);
    doc.roundedRect(x, yPos, width, 20, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...C.muted);
    doc.text(label, x + 4, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.navyDark);
    doc.text(String(value), x + 4, yPos + 14);
  }

  function datiCliniciNonVuoti(dc) {
    if (!dc) return [];
    const righe = [];
    const add = (label, value) => { if (testoValido(value)) righe.push([label, value]); };

    add('Acuita visiva OD', dc.acuitaVisiva?.od);
    add('Acuita visiva OS', dc.acuitaVisiva?.os);
    add('Acuita visiva binoculare', dc.acuitaVisiva?.binoculare);
    add('Piede dominante', dc.piedeDominante);
    add('Mano dominante', dc.manoDominante);
    add('Occhio dominante', dc.occhioDirettoreMotorio);
    add('Abilita fusionale rapida', dc.abilitaFusionaleRapida);
    add('Messa a fuoco rapida', dc.abilitaMessaFuocoRapida);

    const formatoCorr = (v) => {
      if (!v) return '';
      const valori = [v.sf, v.cyl, v.ax].filter(testoValido);
      return valori.length ? valori.join(' / ') : '';
    };
    add('Correzione propria OD (Sf/Cyl/Ax)', formatoCorr(dc.correzionePropria?.od));
    add('Correzione propria OS (Sf/Cyl/Ax)', formatoCorr(dc.correzionePropria?.os));
    add('Correzione OD (Sf/Cyl/Ax)', formatoCorr(dc.correzione?.od));
    add('Correzione OS (Sf/Cyl/Ax)', formatoCorr(dc.correzione?.os));

    const pos = [
      ['Alto SX', 'altoSx'], ['Basso SX', 'bassoSx'], ['Centrale', 'centrale'],
      ['Alto DX', 'altoDx'], ['Basso DX', 'bassoDx'],
    ];
    pos.forEach(([label, key]) => add('Schober 3 m - ' + label, dc.schober3m?.[key]));
    pos.forEach(([label, key]) => add('Brock String - ' + label, dc.brockString?.[key]));

    return righe;
  }

  function disegnaListaDueColonne(righe) {
    if (!righe.length) return;
    const colGap = 8;
    const colWidth = (usableWidth - colGap) / 2;
    for (let i = 0; i < righe.length; i += 2) {
      assicuraSpazio(13);
      const a = righe[i];
      const b = righe[i + 1];
      testoRiga(a[0], a[1], marginX, y, colWidth);
      if (b) testoRiga(b[0], b[1], marginX + colWidth + colGap, y, colWidth);
      y += 13;
    }
    y += 2;
  }

  function colonneConDati(esercizio, sessioniCompilate) {
    return colonneEsercizio(esercizio).filter((col) =>
      sessioniCompilate.some((s) => {
        const v = col.get(s);
        return valoreCampoValido(col.campo, v);
      })
    );
  }

  function formattaCella(col, value) {
    if (value === '' || value === undefined || value === null) return '-';
    if (col?.tipo === 'number' && col.campo) return formattaValoreCampo(col.campo, value);
    return String(value);
  }

  function disegnaTabella(headers, rows, widths) {
    if (!rows.length) return;
    const nCols = headers.length;
    const colWidths = widths || Array(nCols).fill(usableWidth / nCols);
    const fontSize = nCols > 8 ? 6.2 : nCols > 5 ? 7 : 7.7;
    const paddingX = 1.4;
    const lineHeight = 3.2;

    const splitCell = (text, width) => doc.splitTextToSize(String(text), Math.max(4, width - paddingX * 2));

    function rowHeight(cells, bold = false) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      return Math.max(...cells.map((cell, i) => splitCell(cell, colWidths[i]).length)) * lineHeight + 3;
    }

    function header() {
      const h = rowHeight(headers, true);
      assicuraSpazio(h + 5);
      doc.setFillColor(...C.blueSoft);
      doc.setDrawColor(...C.line);
      doc.rect(marginX, y, usableWidth, h, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(...C.navyDark);
      let x = marginX;
      headers.forEach((cell, i) => {
        doc.text(splitCell(cell, colWidths[i]), x + paddingX, y + 3.5);
        x += colWidths[i];
      });
      y += h;
      setInk();
    }

    header();

    rows.forEach((row, rowIndex) => {
      const h = rowHeight(row);
      if (y + h > footerY - 5) {
        paginaNuova();
        header();
      }
      if (rowIndex % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(marginX, y, usableWidth, h, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(...C.ink);
      let x = marginX;
      row.forEach((cell, i) => {
        doc.text(splitCell(cell, colWidths[i]), x + paddingX, y + 3.5);
        x += colWidths[i];
      });
      doc.setDrawColor(...C.line);
      doc.line(marginX, y + h, marginX + usableWidth, y + h);
      y += h;
    });
    y += 5;
  }

  async function disegnaGrafico(group, sessioniGruppo) {
    if (sessioniGruppo.length < 2) return;
    const config = buildGroupChartConfig(sessioniGruppo, group);
    const img = await renderChartOffscreen(config, 1100, 500);
    const imgHeight = usableWidth * (500 / 1100);
    assicuraSpazio(imgHeight + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.navyDark);
    doc.text(titoloGruppo(group), marginX, y);
    y += 4;
    doc.addImage(img, 'PNG', marginX, y, usableWidth, imgHeight);
    y += imgHeight + 7;
    setInk();
  }

  async function disegnaRadarTest() {
    if (typeof radarDatiSintesi !== 'function' || typeof radarChartConfig !== 'function') return;
    const radar = radarDatiSintesi(sessioni, tutteSessioniPerRadar);
    if (!radar.labels.length) return;

    titoloSezione(
      'Radar dei test',
      'Indice relativo 0-100 calcolato solo sui parametri selezionati per i cinque Test del radar. 50 corrisponde circa alla mediana dell’archivio. I Training sono esclusi.'
    );

    if (radar.labels.length >= 3) {
      const config = radarChartConfig(
        radar.righe.map((riga) => riga.nome + ' · ' + riga.valore + '/100'),
        [{ label: 'Profilo test', data: radar.valori }],
        null
      );
      const img = await renderChartOffscreen(config, 900, 720);
      const imgWidth = Math.min(usableWidth, 150);
      const imgHeight = imgWidth * (720 / 900);
      assicuraSpazio(imgHeight + 8);
      const x = marginX + (usableWidth - imgWidth) / 2;
      doc.addImage(img, 'PNG', x, y, imgWidth, imgHeight);
      y += imgHeight + 7;
    }

    const righe = radar.righe.map((riga) => [
      riga.nome,
      riga.valore + '/100',
      riga.livello || '-',
      (riga.parametriValoriRadar || []).map((m) => m.label + ' ' + m.valore).join(' + '),
      riga.data ? formatDataIt(riga.data) : '-',
    ]);
    disegnaTabella(
      ['Test', 'Indice', 'Stima', 'Parametri usati', 'Ultima valutazione'],
      righe,
      [44, 20, 28, usableWidth - 126, 34]
    );
  }

  async function disegnaCampoVisivoAvanzato(sessioniCompilate) {
    for (const s of sessioniCompilate) {
      const dati = s.esercizi?.campoVisivoAvanzato;
      if (!dati) continue;
      assicuraSpazio(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.navyDark);
      doc.text(formatDataIt(s.data), marginX, y);
      y += 5;

      if (dati.immaginePolarPlot) {
        try {
          const { larghezza, altezza } = await dimensioniImmagine(dati.immaginePolarPlot);
          const w = Math.min(usableWidth, 110);
          const h = w * (altezza / larghezza);
          assicuraSpazio(h + 4);
          doc.addImage(dati.immaginePolarPlot, formatoImmagineDaDataUrl(dati.immaginePolarPlot), marginX, y, w, h);
          y += h + 5;
        } catch (_) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.muted);
          doc.text('Grafico non disponibile', marginX, y);
          y += 5;
        }
      }

      if (Array.isArray(dati.percentualiSettori) && dati.percentualiSettori.length) {
        disegnaTabella(
          ['Settore', 'Fascia angoli', '% corretta'],
          dati.percentualiSettori.map((r) => [String(r.settore), String(r.fasciaAngoli || '-'), String(r.percentualeCorretta) + '%']),
          [30, 80, usableWidth - 110]
        );
      }
    }
  }

  async function disegnaTestOriginaliNonStandardizzati() {
    if (typeof metricheOriginaliJet !== 'function') return;

    const originali = sessioni.filter((s) =>
      contaEserciziCompilati(s) === 0 &&
      metricheOriginaliJet(s).length > 0
    );
    if (!originali.length) return;

    titoloSezione(
      'Test originali non standardizzati',
      'Valori reali dei Test Jet non ancora associati a uno schema standard. Le sessioni Training restano escluse.'
    );

    for (const sessione of originali.slice(-12)) {
      assicuraSpazio(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.navyDark);
      doc.text(`${formatDataIt(sessione.data)} - ${nomeTestSessione(sessione)}`, marginX, y);
      y += 5;

      const righe = metricheOriginaliJet(sessione).map((m) => [m.label, m.valore]);
      disegnaTabella(
        ['Parametro', 'Valore'],
        righe,
        [usableWidth * 0.58, usableWidth * 0.42]
      );
    }
  }

  async function disegnaAllegati() {
    const righe = [];
    for (const s of sessioni) {
      const [foto, video] = await Promise.all([
        dbGetAllegatiFotoBySessione(s.id),
        dbGetAllegatiVideoBySessione(s.id),
      ]);
      if (!foto.length && !video.length) continue;
      righe.push([
        formatDataIt(s.data),
        nomeTestSessione(s),
        (foto.length ? foto.length + ' foto' : '') + (foto.length && video.length ? ' - ' : '') + (video.length ? video.length + ' video' : ''),
      ]);
    }
    if (!righe.length) return;
    titoloSezione('Allegati', 'I file multimediali restano disponibili nell\'app e non vengono incorporati nel PDF.');
    disegnaTabella(['Data', 'Test', 'Allegati'], righe, [28, 105, usableWidth - 133]);
  }

  // Copertina / intestazione
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TEST VISIVI', marginX, 13);
  doc.setFontSize(19);
  doc.text('Report prestazioni visive', marginX, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Solo Test - andamento nel tempo e radar prestazionale', marginX, 30);
  y = 51;

  doc.setTextColor(...C.navyDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(nomeCompleto(atleta), marginX, y);
  y += 6;
  doc.setTextColor(...C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const sottotitoliAtleta = [
    squadraNome ? 'Squadra: ' + squadraNome : '',
    opzioni.periodoDa && opzioni.periodoA
      ? 'Periodo Test: ' + formatDataIt(opzioni.periodoDa) + ' - ' + formatDataIt(opzioni.periodoA)
      : '',
    'Report generato il ' + formatDataIt(oggiIso()),
  ].filter(Boolean);
  sottotitoliAtleta.forEach((riga) => {
    doc.text(riga, marginX, y);
    y += 4.5;
  });
  y += 5.5;

  const testKeys = new Set(sessioni.map((s) => nomeTestSessione(s)).filter(Boolean));
  const prima = sessioni.length ? sessioni[0].data : '';
  const ultima = sessioni.length ? sessioni[sessioni.length - 1].data : '';
  const giornateTest = new Set(sessioni.map((s) => s.data).filter(Boolean)).size;
  const kGap = 3;
  const kWidth = (usableWidth - kGap * 3) / 4;
  cardKpi(marginX, y, kWidth, 'GIORNATE TEST', giornateTest);
  cardKpi(marginX + (kWidth + kGap), y, kWidth, 'TEST DIVERSI', testKeys.size);
  cardKpi(marginX + (kWidth + kGap) * 2, y, kWidth, 'PRIMO TEST', prima ? formatDataIt(prima) : '-');
  cardKpi(marginX + (kWidth + kGap) * 3, y, kWidth, 'ULTIMO TEST', ultima ? formatDataIt(ultima) : '-');
  y += 27;

  const anagrafica = [
    ['Data di nascita', atleta.dataNascita ? formatDataIt(atleta.dataNascita) : ''],
    ['Altezza', testoValido(atleta.altezza) ? atleta.altezza + ' cm' : ''],
    ['Telefono', atleta.telefono],
    ['Email', atleta.email],
    ['Squadra', squadraNome],
  ].filter(([, v]) => testoValido(v));

  if (anagrafica.length) {
    titoloSezione('Anagrafica');
    disegnaListaDueColonne(anagrafica);
  }

  const clinici = datiCliniciNonVuoti(atleta.datiClinici);
  if (clinici.length) {
    titoloSezione('Dati visivi e clinici', 'Sono riportati solo i campi compilati nel profilo atleta.');
    disegnaListaDueColonne(clinici);
  }

  if (testoValido(atleta.note)) {
    titoloSezione('Note');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.ink);
    const lines = doc.splitTextToSize(String(atleta.note), usableWidth);
    assicuraSpazio(lines.length * 4 + 4);
    doc.text(lines, marginX, y);
    y += lines.length * 4 + 5;
  }

  await disegnaAllegati();
  await disegnaRadarTest();

  for (const esercizio of ESERCIZI_CONFIG) {
    const compilate = sessioni.filter((s) => esercizioCompilato(esercizio, s.esercizi?.[esercizio.key]));
    if (!compilate.length) continue;
    if (esercizio.custom && esercizio.key !== 'campoVisivoAvanzato') continue;

    const numeroValutazioni = compilate.length;
    const storicoTabella = compilate.slice(-12);
    const storicoGrafico = compilate.slice(-20);
    const notaStorico = numeroValutazioni > 12
      ? numeroValutazioni + ' valutazioni totali - tabella: ultime 12'
      : (numeroValutazioni === 1 ? '1 valutazione disponibile' : numeroValutazioni + ' valutazioni disponibili');

    titoloSezione(
      esercizio.label,
      [esercizio.descrizione, notaStorico].filter(Boolean).join(' - ')
    );

    if (esercizio.custom) {
      await disegnaCampoVisivoAvanzato(storicoTabella);
      continue;
    }

    const cols = colonneConDati(esercizio, storicoTabella);
    if (cols.length) {
      const headers = ['Data', ...cols.map((c) => c.header)];
      const rows = storicoTabella.map((s) => [
        formatDataIt(s.data),
        ...cols.map((c) => formattaCella(c, c.get(s))),
      ]);

      const dataWidth = 24;
      const other = (usableWidth - dataWidth) / cols.length;
      disegnaTabella(headers, rows, [dataWidth, ...cols.map(() => other)]);
    }

    if (storicoGrafico.length >= 2) {
      for (const group of getChartGroups(esercizio)) {
        const gruppo = sessioniConGruppo(storicoGrafico, group);
        const campiConDati = group.campi.filter((campo) =>
          gruppo.some((s) => getValoreCampoGruppo(s, group, campo) !== null)
        );
        if (gruppo.length >= 2 && campiConDati.length) {
          await disegnaGrafico({ ...group, campi: campiConDati }, gruppo);
        }
      }
    }
  }

  await disegnaTestOriginaliNonStandardizzati();

  // Footer e numerazione pagine.
  const totalePagine = doc.getNumberOfPages();
  for (let page = 1; page <= totalePagine; page++) {
    doc.setPage(page);
    doc.setDrawColor(...C.line);
    doc.line(marginX, pageHeight - 13, marginX + usableWidth, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('Test Visivi - ' + nomeCompleto(atleta), marginX, footerY);
    doc.text('Pagina ' + page + ' / ' + totalePagine, marginX + usableWidth, footerY, { align: 'right' });
    if (page === totalePagine) {
      doc.setFontSize(6.3);
      doc.setTextColor(135, 145, 155);
      doc.text('Il report riporta esclusivamente i dati registrati nell\'app e non costituisce una diagnosi clinica.', marginX, pageHeight - 5);
    }
  }

  const nomeFile = 'report_test_visivi_' + slug(atleta.cognome) + '_' + oggiIso() + '.pdf';
  doc.save(nomeFile);
}


/**
 * PDF unico per più atleti.
 * Contiene esclusivamente le sessioni Test, limitate al periodo e ai tipi di
 * Test scelti dall'utente. Ogni atleta inizia su una nuova pagina.
 */
async function esportaReportMultiploPdf(selezioniRaw, opzioni = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const automatico = opzioni.automatico === true;
  const testKeysRichiesti = (opzioni.testKeys || []).filter((key) => TEST_STANDARD_KEYS.includes(key));
  const periodoDa = String(opzioni.periodoDa || '');
  const periodoA = String(opzioni.periodoA || '');

  if (!Array.isArray(selezioniRaw) || !selezioniRaw.length) throw new Error('Nessun giocatore con Test nel periodo selezionato.');
  if (!automatico && !testKeysRichiesti.length) throw new Error('Seleziona almeno un Test.');
  if (!periodoDa || !periodoA || periodoDa > periodoA) throw new Error('Controlla il periodo selezionato.');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const usableWidth = pageWidth - marginX * 2;
  const footerY = pageHeight - 9;
  let y = 18;
  let nomeAtletaPagina = '';
  const atletiPerPagina = {};

  const C = {
    navy: [21, 62, 105],
    navyDark: [12, 38, 65],
    blueSoft: [237, 244, 250],
    ink: [24, 31, 38],
    muted: [99, 112, 125],
    line: [220, 226, 232],
    paper: [250, 251, 252],
    white: [255, 255, 255],
  };

  function paginaNuova(intestazione = true) {
    doc.addPage();
    y = 18;
    if (nomeAtletaPagina) {
      atletiPerPagina[doc.getNumberOfPages()] = nomeAtletaPagina;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.navyDark);
      if (intestazione) doc.text(nomeAtletaPagina, marginX, 10, { maxWidth: usableWidth });
    }
  }

  function assicuraSpazio(mm) {
    if (y + mm > footerY - 6) paginaNuova();
  }

  function linea(yPos = y) {
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.25);
    doc.line(marginX, yPos, marginX + usableWidth, yPos);
  }

  function titoloSezione(titolo, sottotitolo = '') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    const titleLines = doc.splitTextToSize(titolo, usableWidth);
    assicuraSpazio(titleLines.length * 5 + 34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...C.navyDark);
    doc.text(titleLines, marginX, y);
    y += titleLines.length * 5;
    if (sottotitolo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      const lines = doc.splitTextToSize(sottotitolo, usableWidth);
      doc.text(lines, marginX, y);
      y += lines.length * 3.7 + 1.5;
    }
    linea(y);
    y += 5;
    doc.setTextColor(...C.ink);
  }

  function cardKpi(x, yPos, width, label, value) {
    doc.setFillColor(...C.paper);
    doc.setDrawColor(...C.line);
    doc.roundedRect(x, yPos, width, 20, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...C.muted);
    doc.text(label, x + 4, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.navyDark);
    doc.text(String(value), x + 4, yPos + 14);
  }

  function disegnaTabella(headers, rows, widths) {
    if (!rows.length) return;
    // Mantieni la tabella entro i margini anche con molte colonne.
    const supplied = widths && widths.length === headers.length ? widths : Array(headers.length).fill(1);
    const total = supplied.reduce((sum, w) => sum + Math.max(0, w), 0) || headers.length;
    const colWidths = supplied.map(w => usableWidth * Math.max(0, w) / total);
    const fontSize = headers.length > 12 ? 5.2 : headers.length > 8 ? 6 : headers.length > 5 ? 6.7 : 7.6;
    const paddingX = 1.5;
    const lineHeight = 3.2;
    const splitCell = (value, width) => {
      const str = String(value ?? '-');
      // Forza anche le stringhe lunghe prive di spazi a rientrare nella cella.
      const maxW = Math.max(1, width - paddingX * 2);
      const lines = doc.splitTextToSize(str, maxW);
      const fitted = [];
      for (const line of lines) {
        if (doc.getTextWidth(line) <= maxW) { fitted.push(line); continue; }
        let part = '';
        for (const c of line) {
          if (part && doc.getTextWidth(part + c) > maxW) { fitted.push(part); part = ''; }
          part += c;
        }
        if (part) fitted.push(part);
      }
      return fitted.length ? fitted : ['-'];
    };
    const availableBottom = footerY - 5;
    function drawRow(cells, isHeader, index) {
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      const chunks = cells.map((cell, i) => splitCell(cell, colWidths[i]));
      const maxLinesPerPage = Math.max(1, Math.floor((availableBottom - 26) / lineHeight));
      const maxLines = Math.max(...chunks.map(c => c.length));
      for (let start = 0; start < maxLines; start += maxLinesPerPage) {
        const amount = Math.min(maxLinesPerPage, maxLines - start);
        const h = amount * lineHeight + 3;
        if (y + h > availableBottom) paginaNuova();
        if (isHeader) { doc.setFillColor(...C.blueSoft); doc.rect(marginX, y, usableWidth, h, 'F'); }
        else if (index % 2) { doc.setFillColor(249, 250, 251); doc.rect(marginX, y, usableWidth, h, 'F'); }
        doc.setDrawColor(...C.line);
        doc.rect(marginX, y, usableWidth, h);
        let x = marginX;
        chunks.forEach((lines, i) => {
          doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(...(isHeader ? C.navyDark : C.ink));
          doc.text(lines.slice(start, start + amount), x + paddingX, y + 3.5);
          x += colWidths[i];
        });
        y += h;
      }
    }
    drawRow(headers, true, 0);
    rows.forEach((row, i) => {
      // Riporta l'intestazione ogni volta che la tabella continua su nuova pagina.
      if (y > availableBottom - 18) { paginaNuova(); drawRow(headers, true, 0); }
      drawRow(row, false, i);
    });
    y += 5;
  }

  function sessioneDelTest(sessione, key) {
    const config = getEsercizioConfig(key);
    if (!config) return false;
    const jet = typeof jetTest === 'function' ? jetTest(sessione) : null;
    if (jet?.key === key) return true;
    if (sessione.testStandard === key || sessione.jetProgramStandardKey === key) return true;
    if (esercizioCompilato(config, sessione.esercizi?.[key])) return true;
    if (typeof chiaveStandardDaNomeProtocollo === 'function') {
      return chiaveStandardDaNomeProtocollo(sessione) === key;
    }
    return false;
  }

  function sessioniSelezionate(sessioni) {
    return (sessioni || [])
      .filter(isSessioneTest)
      .filter((s) => typeof sessioneHaRisultatiVisibili !== 'function' || sessioneHaRisultatiVisibili(s))
      .filter((s) => String(s.data || '') >= periodoDa && String(s.data || '') <= periodoA)
      .filter((s) => automatico || testKeysRichiesti.some((key) => sessioneDelTest(s, key)))
      .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
  }

  const selezioniConDati = selezioniRaw.map((selezione) => {
    const atleta = typeof normalizzaAnagraficaCalciatore === 'function'
      ? normalizzaAnagraficaCalciatore(selezione?.atleta || {})
      : (selezione?.atleta || {});
    return { atleta, sessioni: sessioniSelezionate(selezione?.sessioni) };
  }).filter((item) => item.sessioni.length > 0);

  if (!selezioniConDati.length) {
    throw new Error('Nessun giocatore ha Test nel periodo indicato.');
  }

  const testKeys = automatico
    ? TEST_STANDARD_KEYS.filter((key) =>
        selezioniConDati.some((item) => item.sessioni.some((s) => sessioneDelTest(s, key)))
      )
    : testKeysRichiesti;

  // Un'unica popolazione storica per tutti i radar; medesima scala di confronto.
  const archivioRadar = (await dbGetAllSessioni()).filter((s) =>
    isSessioneTest(s) && (typeof sessioneHaRisultatiVisibili !== 'function' || sessioneHaRisultatiVisibili(s))
  );

  // Controlla soltanto le sessioni del test corrente, senza ricreare
  // l'intero archivio per ogni colonna e per ogni atleta.
  function colonneConDati(esercizio, sessioniCompilate) {
    return colonneEsercizio(esercizio).filter((col) =>
      sessioniCompilate.some((s) => valoreCampoValido(col.campo, col.get(s)))
    );
  }

  function formattaCella(col, value) {
    if (value === '' || value === undefined || value === null) return '-';
    if (col?.tipo === 'number' && col.campo) return formattaValoreCampo(col.campo, value);
    return String(value);
  }

  async function disegnaGraficoUnicoTest(esercizio, sessioni) {
    const series = [];
    for (const group of getChartGroups(esercizio)) {
      const compatibili = new Set(sessioniConGruppo(sessioni, group));
      for (const campo of group.campi) {
        const values = sessioni.map(s => {
          if (!compatibili.has(s)) return null;
          const raw = getValoreCampoGruppo(s, group, campo);
          if (raw === '' || raw == null) return null;
          const n = Number(String(raw).replace(',', '.'));
          return Number.isFinite(n) ? n : null;
        });
        if (values.some(v => v !== null)) series.push({ label: campo.label + (group.unitLabel ? ' (' + group.unitLabel + ')' : ''), values });
      }
    }
    if (!series.length) return;
    const colors = ['#22577a','#38a3a5','#e09f3e','#9e4b9b','#c45353','#527c39','#6f71b5','#bc6c25'];
    const config = sessioni.length === 1
      ? buildBarChartConfig(series.map(s => s.label), series.map(s => s.values[0]), 'Valori rilevati')
      : {
          type: 'line',
          data: {
            labels: sessioni.map(s => formatDataIt(s.data)),
            datasets: series.map((s,i) => {
              const first = s.values.find(v => v !== null && v !== 0);
              return { label: s.label, data: s.values.map(v => v === null || !first ? null : Math.round(1000 * v / first) / 10), borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length], fill: false, tension: .2, spanGaps: false, pointRadius: 2 };
            }).filter(s => s.data.some(v => v !== null)),
          },
          options: {
            responsive: false, animation: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { color: '#182026', boxWidth: 9, font: { size: 10 } } } },
            scales: {
              x: { ticks: { color: '#63707d' }, grid: { color: '#dce2e8' } },
              y: { title: { display: true, text: 'Indice relativo (prima misura = 100)' }, ticks: { color: '#63707d' }, grid: { color: '#dce2e8' } },
            },
          },
        };
    const img = await renderChartOffscreen(config, 1100, 500);
    const graphWidth = usableWidth * .78;
    const graphHeight = graphWidth * 500 / 1100;
    assicuraSpazio(graphHeight + 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.navyDark);
    doc.text('Grafici', marginX, y);
    y += 7;
    doc.setFontSize(8.5);
    doc.text(esercizio.label + ' - riepilogo', marginX, y, { maxWidth: usableWidth });
    y += 7;
    doc.addImage(img, 'PNG', marginX + (usableWidth - graphWidth) / 2, y, graphWidth, graphHeight);
    y += graphHeight + 9;
  }

  async function disegnaSoloRadarAtleta(sessioni) {
    const radar = radarDatiSintesi(sessioni, archivioRadar);
    if (!radar.righe.length) {
      titoloSezione('Radar prestazionale', 'Nessun test con parametri sufficienti per il radar.');
      return;
    }
    titoloSezione('Radar prestazionale',
      'Solo Test eseguiti nel periodo. Per ciascuna tipologia viene considerata l’ultima valutazione valida. ' +
      'Indice relativo all’archivio Test: 50 corrisponde circa alla mediana, non a una soglia scientifica.');
    if (radar.righe.length >= 3) {
      const config = radarChartConfig(
        radar.righe.map((r) => r.nome),
        [{ label: 'Profilo test', data: radar.righe.map((r) => r.valore) }],
        null
      );
      const png = await renderChartOffscreen(config, 1100, 850);
      const w = Math.min(usableWidth, 164);
      const h = w * 850 / 1100;
      assicuraSpazio(h + 6);
      doc.addImage(png, 'PNG', marginX + (usableWidth - w) / 2, y, w, h);
      y += h + 6;
    } else {
      assicuraSpazio(8);
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text('Meno di tre test valutabili: impossibile formare un poligono radar.', marginX, y);
      y += 7;
    }
    disegnaTabella(['Test eseguito', 'Indice', 'Data'], radar.righe.map((r) => [
      r.nome, r.valore + '/100', r.data ? formatDataIt(r.data) : '-'
    ]), [110, 25, 45]);
  }

  // Copertina generale.
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageWidth, 55, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TEST VISIVI', marginX, 14);
  doc.setFontSize(21);
  doc.text('Report multiplo', marginX, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Giocatori e Test rilevati automaticamente nel periodo', marginX, 35);
  y = 70;

  const nomiTest = [...new Set(
    selezioniConDati.flatMap((item) =>
      item.sessioni.map((s) => typeof nomeTestSessione === 'function' ? nomeTestSessione(s) : '').filter(Boolean)
    )
  )];
  doc.setTextColor(...C.navyDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Riepilogo automatico', marginX, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.ink);
  doc.text('Giocatori con Test nel periodo: ' + selezioniConDati.length, marginX, y);
  y += 6;
  doc.text('Periodo: ' + formatDataIt(periodoDa) + ' - ' + formatDataIt(periodoA), marginX, y);
  y += 6;
  const testLines = doc.splitTextToSize('Test: ' + nomiTest.join(', '), usableWidth);
  doc.text(testLines, marginX, y);
  y += testLines.length * 4.5 + 5;
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text('Sono inclusi solo i Test realmente registrati nell’intervallo. I Training sono esclusi.', marginX, y);

  for (let atletaIndex = 0; atletaIndex < selezioniConDati.length; atletaIndex++) {
    const { atleta, sessioni } = selezioniConDati[atletaIndex];

    nomeAtletaPagina = nomeCompleto(atleta);
    paginaNuova(false);

    doc.setFillColor(...C.navy);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    while (doc.getTextWidth(nomeCompleto(atleta)) > usableWidth && doc.getFontSize() > 9) {
      doc.setFontSize(doc.getFontSize() - 1);
    }
    doc.text(nomeCompleto(atleta), marginX, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Periodo ' + formatDataIt(periodoDa) + ' - ' + formatDataIt(periodoA), marginX, 24);
    y = 42;

    const testPresenti = new Set(
      sessioni.map((s) => typeof nomeTestSessione === 'function' ? nomeTestSessione(s) : '').filter(Boolean)
    );
    const giornate = new Set(sessioni.map((s) => s.data).filter(Boolean)).size;
    const kGap = 4;
    const kWidth = (usableWidth - kGap * 2) / 3;
    cardKpi(marginX, y, kWidth, 'SESSIONI TEST', sessioni.length);
    cardKpi(marginX + kWidth + kGap, y, kWidth, 'GIORNATE', giornate);
    cardKpi(marginX + (kWidth + kGap) * 2, y, kWidth, 'TEST PRESENTI', testPresenti.size);
    y += 28;

    if (!sessioni.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...C.muted);
      doc.text('Nessun risultato disponibile per i Test e il periodo selezionati.', marginX, y);
      continue;
    }

    await disegnaSoloRadarAtleta(sessioni);

    for (const key of testKeys) {
      const esercizio = getEsercizioConfig(key);
      if (!esercizio || esercizio.custom) continue;

      const delTest = sessioni.filter((s) => sessioneDelTest(s, key));
      const compilate = delTest.filter((s) => esercizioCompilato(esercizio, s.esercizi?.[key]));
      const originali = delTest.filter((s) =>
        !esercizioCompilato(esercizio, s.esercizi?.[key]) &&
        typeof metricheOriginaliJet === 'function' &&
        metricheOriginaliJet(s).length > 0
      );
      if (!compilate.length && !originali.length) continue;

      const totaleValutazioni = compilate.length + originali.length;
      titoloSezione(
        TEST_STANDARD_LABELS[key] || esercizio.label,
        totaleValutazioni === 1 ? '1 valutazione nel periodo selezionato' : totaleValutazioni + ' valutazioni nel periodo selezionato'
      );

      const cols = colonneConDati(esercizio, compilate);
      const normalizzaLabel = (label) => String(label).toLowerCase()
        .replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
      const sinonimi = {
        immaginiColpite: ['Immagini colpite'],
        immaginiAlSec: ['Immagini al secondo'],
        numeroTarget: ['Numero target'],
      };
      const note = new Map();
      // Le colonne e le metriche devono appartenere al giocatore corrente.
      // In precedenza ogni giocatore rianalizzava l'intero archivio.
      const tutteDelTest = delTest;
      for (const s of tutteDelTest) {
        for (const m of typeof metricheOriginaliJet === 'function' ? metricheOriginaliJet(s) : []) {
          const giaInTabella = cols.some((col) => [
            col.header, col.campo.key,
            ...(typeof aliasesCampoJet === 'function' ? aliasesCampoJet(col.campo).map((a) => a.name) : []),
            ...(sinonimi[col.campo.key] || []),
          ].some((label) => normalizzaLabel(label) === normalizzaLabel(m.label)));
          if (!giaInTabella) note.set(m.key, m.label);
        }
      }
      const extra = [...note.entries()];
      const headers = ['Data', ...cols.map((col) => col.header), ...extra.map(([, label]) => label)];
      const rows = delTest.map((s) => {
        const raw = new Map((typeof metricheOriginaliJet === 'function' ? metricheOriginaliJet(s) : [])
          .map((m) => [m.key, m.valore]));
        return [formatDataIt(s.data), ...cols.map((col) => formattaCella(col, col.get(s))),
          ...extra.map(([key]) => raw.get(key) ?? '-')];
      });
      if (headers.length > 1) {
        const dataWidth = 24;
        const other = (usableWidth - dataWidth) / (headers.length - 1);
        disegnaTabella(headers, rows, [dataWidth, ...headers.slice(1).map(() => other)]);
      }

      // Il PDF multiplo contiene esclusivamente il radar come grafico.
    }

    // Eventuali esercizi/test storici configurati ma non compresi nei Test standard.
    if (automatico) {
      const standardSet = new Set(testKeys);
      const eserciziExtra = ESERCIZI_CONFIG.filter((esercizio) =>
        !esercizio.custom && !standardSet.has(esercizio.key)
      );

      for (const esercizio of eserciziExtra) {
        const compilate = sessioni.filter((s) =>
          esercizioCompilato(esercizio, s.esercizi?.[esercizio.key])
        );
        if (!compilate.length) continue;

        titoloSezione(
          esercizio.label,
          compilate.length === 1
            ? '1 valutazione nel periodo selezionato'
            : compilate.length + ' valutazioni nel periodo selezionato'
        );

        const cols = colonneConDati(esercizio, compilate);
        if (cols.length) {
          const headers = ['Data', ...cols.map((col) => col.header)];
          const rows = compilate.map((sessione) => [
            formatDataIt(sessione.data),
            ...cols.map((col) => formattaCella(col, col.get(sessione))),
          ]);
          const dataWidth = 24;
          const other = (usableWidth - dataWidth) / cols.length;
          disegnaTabella(headers, rows, [dataWidth, ...cols.map(() => other)]);
        }

        // Il PDF multiplo contiene esclusivamente il radar come grafico.
      }
    }

    if (automatico) {
      for (const s of sessioni) {
        const dati = s.esercizi?.campoVisivoAvanzato;
        if (!dati) continue;
        titoloSezione('Campo visivo avanzato', 'Valutazione del ' + formatDataIt(s.data));
        if (dati.durataSecondi !== undefined && dati.durataSecondi !== null) {
          disegnaTabella(['Parametro', 'Valore'], [['Durata', dati.durataSecondi + ' s']], [110, 70]);
        }
        if (Array.isArray(dati.percentualiSettori) && dati.percentualiSettori.length) {
          disegnaTabella(['Settore', 'Fascia angoli', 'Risposte corrette'],
            dati.percentualiSettori.map((r) => [String(r.settore), String(r.fasciaAngoli || '-'), r.percentualeCorretta == null ? '-' : r.percentualeCorretta + '%']),
            [35, 85, 60]);
        }
      }
    }

    // Test originali/non standard riconosciuti come Test ma non associati a una chiave standard.
    if (automatico && typeof metricheOriginaliJet === 'function') {
      const nonStandard = sessioni.filter((s) =>
        !testKeys.some((key) => sessioneDelTest(s, key)) &&
        metricheOriginaliJet(s).length > 0
      );

      for (const s of nonStandard) {
        const nome = typeof nomeTestSessione === 'function' ? nomeTestSessione(s) : 'Test';
        titoloSezione(nome || 'Test', 'Valutazione del ' + formatDataIt(s.data));
        const righeOriginali = metricheOriginaliJet(s).map((m) => [m.label, m.valore]);
        disegnaTabella(
          ['Parametro', 'Valore'],
          righeOriginali,
          [usableWidth * 0.62, usableWidth * 0.38]
        );
      }
    }
  }

  const totalePagine = doc.getNumberOfPages();
  for (let page = 1; page <= totalePagine; page++) {
    doc.setPage(page);
    doc.setDrawColor(...C.line);
    doc.line(marginX, pageHeight - 13, marginX + usableWidth, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(atletiPerPagina[page] || 'Test Visivi - Report multiplo', marginX, footerY, { maxWidth: usableWidth - 35 });
    doc.text('Pagina ' + page + ' / ' + totalePagine, marginX + usableWidth, footerY, { align: 'right' });
    if (page === totalePagine) {
      doc.setFontSize(6.3);
      doc.text("Il report riporta esclusivamente i dati registrati nell'app e non costituisce una diagnosi clinica.", marginX, pageHeight - 5);
    }
  }

  const nomeFile = 'report_multiplo_test_visivi_' + oggiIso() + '.pdf';
  if (opzioni.scarica === false) {
    return {
      blob: doc.output('blob'),
      nomeFile,
      pagine: totalePagine,
    };
  }

  doc.save(nomeFile);
  return { nomeFile, pagine: totalePagine };
}
