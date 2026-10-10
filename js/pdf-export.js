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
// Helpers condivisi tra PDF individuale e PDF multiplo.
function testoValido(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
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
  // Helper locali autonomi: il report multiplo non dipende da definizioni globali
  // né dagli helper usati soltanto nel report individuale.
  const valorePresenteMultiplo = (v) => v !== undefined && v !== null && String(v).trim() !== '';
  const datiCliniciMultiploDaProfilo = (dc) => {
    if (!dc) return [];
    const rows = [];
    const add = (label, value) => { if (valorePresenteMultiplo(value)) rows.push([label, String(value)]); };
    add('Acuita visiva OD', dc.acuitaVisiva?.od);
    add('Acuita visiva OS', dc.acuitaVisiva?.os);
    add('Acuita visiva binoculare', dc.acuitaVisiva?.binoculare);
    add('Piede dominante', dc.piedeDominante);
    add('Mano dominante', dc.manoDominante);
    add('Occhio dominante', dc.occhioDirettoreMotorio);
    add('Abilita fusionale rapida', dc.abilitaFusionaleRapida);
    add('Messa a fuoco rapida', dc.abilitaMessaFuocoRapida);
    const corr = (v) => v ? [v.sf,v.cyl,v.ax].filter(valorePresenteMultiplo).join(' / ') : '';
    add('Correzione propria OD (Sf/Cyl/Ax)', corr(dc.correzionePropria?.od));
    add('Correzione propria OS (Sf/Cyl/Ax)', corr(dc.correzionePropria?.os));
    add('Correzione OD (Sf/Cyl/Ax)', corr(dc.correzione?.od));
    add('Correzione OS (Sf/Cyl/Ax)', corr(dc.correzione?.os));
    for (const [label,key] of [['Alto SX','altoSx'],['Basso SX','bassoSx'],['Centrale','centrale'],['Alto DX','altoDx'],['Basso DX','bassoDx']]) {
      add('Schober 3 m - ' + label, dc.schober3m?.[key]);
      add('Brock String - ' + label, dc.brockString?.[key]);
    }
    return rows;
  };
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
      if (intestazione) {
        doc.text(nomeAtletaPagina, marginX, 11, { maxWidth: usableWidth });
        doc.setDrawColor(...C.line);
        doc.line(marginX, 14, marginX + usableWidth, 14);
      }
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
    assicuraSpazio(titleLines.length * 5 + (sottotitolo ? Math.ceil(sottotitolo.length / 92) * 3.7 + 17 : 19));
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
    doc.setDrawColor(184,29,56); doc.setLineWidth(.7);
    doc.line(marginX,y+2,marginX+12,y+2);
    doc.setDrawColor(...C.line); doc.setLineWidth(.25);
    doc.line(marginX+14,y+2,marginX+usableWidth,y+2);
    y += 8;
    doc.setTextColor(...C.ink);
  }

  // Le tabelle molto larghe vengono suddivise per gruppi di colonne:
  // ogni parte ripete Data, mantenendo tutti i valori senza ridurre i testi a caratteri illeggibili.
  function disegnaTabellaLeggibile(headers, rows, widths) {
    if (headers.length <= 7) return disegnaTabella(headers, rows, widths);
    const colsPerBlock = 4;
    const hasDate = headers[0] === 'Data';
    const fixed = hasDate ? [0] : [];
    const other = headers.map((_,i)=>i).filter(i=>!fixed.includes(i));
    const parti = Math.ceil(other.length / colsPerBlock);
    for (let start=0;start<other.length;start+=colsPerBlock) {
      const parte = Math.floor(start / colsPerBlock) + 1;
      assicuraSpazio(12);
      doc.setFont('helvetica','bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text('PARAMETRI  ' + parte + ' / ' + parti,marginX,y);
      y += 5;
      const indices = [...fixed,...other.slice(start,start+colsPerBlock)];
      const partHeaders = indices.map(i=>headers[i]);
      const partRows = rows.map(row=>indices.map(i=>row[i]));
      disegnaTabella(partHeaders,partRows,
        indices.map(i=>i===0&&hasDate?27:31));
    }
  }

  function disegnaTabella(headers, rows, widths) {
    if (!rows.length) return;
    const supplied = widths && widths.length === headers.length ? widths : Array(headers.length).fill(1);
    const total = supplied.reduce((sum,w) => sum + Math.max(0,w),0) || headers.length;
    const colWidths = supplied.map(w => usableWidth * Math.max(0,w) / total);
    const fontSize = headers.length > 8 ? 7.0 : headers.length > 5 ? 7.6 : 8.2;
    const paddingX = 2.2, lineHeight = 3.8, bottom = footerY - 5;
    const splitCell = (value, width) => {
      const str = String(value ?? '-');
      const maxW = Math.max(1,width - 2 * paddingX);
      doc.setFontSize(fontSize);
      let lines = doc.splitTextToSize(str,maxW);
      const out = [];
      for (const line of lines) {
        if (doc.getTextWidth(line) <= maxW) { out.push(line); continue; }
        let part = '';
        for (const c of line) {
          if (part && doc.getTextWidth(part+c)>maxW) {out.push(part);part='';}
          part += c;
        }
        if (part) out.push(part);
      }
      return out.length ? out : ['-'];
    };
    const chunksFor = (cells,bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      return cells.map((v,i) => splitCell(v,colWidths[i]));
    };
    const heightFor = (chunks) => Math.max(...chunks.map(c=>c.length)) * lineHeight + 4;
    const paint = (chunks,header,index) => {
      const h = heightFor(chunks);
      if (header) {doc.setFillColor(...C.blueSoft);doc.rect(marginX,y,usableWidth,h,'F');}
      else if(index%2){doc.setFillColor(249,250,251);doc.rect(marginX,y,usableWidth,h,'F');}
      doc.setDrawColor(...C.line);
      doc.rect(marginX,y,usableWidth,h);
      let x = marginX;
      chunks.forEach((lines,i)=>{
        doc.setFont('helvetica',header?'bold':'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(...(header?C.navyDark:C.ink));
        doc.text(lines,x+paddingX,y+4.1);
        x += colWidths[i];
      });
      y+=h;
    };
    const head = chunksFor(headers,true);
    const headH = heightFor(head);
    const first = chunksFor(rows[0],false);
    if (y+headH+Math.min(heightFor(first),bottom-26)>bottom) paginaNuova();
    paint(head,true,0);
    rows.forEach((row,i)=>{
      const chunks=chunksFor(row,false);
      const h=heightFor(chunks);
      if (h > bottom-26) {
        // A row too tall for one page: split only this exceptional row into
        // complete line groups, with repeated table header on subsequent pages.
        const maxLines=Math.max(1,Math.floor((bottom-26-3)/lineHeight));
        const count=Math.max(...chunks.map(c=>c.length));
        for(let j=0;j<count;j+=maxLines){
          const piece=chunks.map(c=>c.slice(j,j+maxLines));
          if(y+heightFor(piece)>bottom){paginaNuova();paint(head,true,0);}
          paint(piece,false,i);
        }
      } else {
        if(y+h>bottom){paginaNuova();paint(head,true,0);}
        paint(chunks,false,i);
      }
    });
    y+=5;
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
  const archivioRadar = (Array.isArray(opzioni.archivioRadar) ? opzioni.archivioRadar : await dbGetAllSessioni()).filter((s) =>
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

  async function disegnaSoloRadarAtleta(sessioni) {
    const radar = radarDatiSintesi(sessioni, archivioRadar);
    if (!radar.righe.length) {
      titoloSezione('Radar prestazionale', 'Nessun test con parametri sufficienti per il radar.');
      return;
    }
    // Riserva spazio per titolo e radar: niente titolo isolato a piè pagina.
    const radarW = Math.min(usableWidth, 128);
    const radarH = radarW * 850 / 1100;
    if (radar.righe.length >= 3 && y + radarH + 35 > footerY - 5) paginaNuova();
    titoloSezione('Radar prestazionale',
      'Ultima valutazione valida di ogni Test nel periodo. Indice relativo all’archivio (0-100), non una soglia clinica.');
    if (radar.righe.length >= 3) {
      const config = radarChartConfig(
        radar.righe.map((r) => r.nome),
        [{ label: 'Profilo test', data: radar.righe.map((r) => r.valore) }],
        null
      );
      const png = await renderChartOffscreen(config, 1100, 850);
      const w = radarW;
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
    disegnaTabella(['Test eseguito', 'Indice', 'Valutazione', 'Data'], radar.righe.map((r) => [
      r.nome, r.valore + '/100', r.livello || radarLivello(r.valore) || '-', r.data ? formatDataIt(r.data) : '-'
    ]), [77, 23, 47, 33]);
  }

  // Copertina editoriale Bologna FC, senza riepiloghi o tabelle.
  doc.setFillColor(252,253,255); doc.rect(0,0,pageWidth,pageHeight,'F');
  doc.setFillColor(17,47,77); doc.rect(pageWidth-37,0,37,pageHeight,'F');
  doc.setFillColor(184,29,56);
  doc.triangle(pageWidth-55,pageHeight,pageWidth-37,pageHeight,pageWidth-37,0,'F');
  doc.setFillColor(233,238,243); doc.rect(0,0,10,pageHeight,'F');
  doc.setDrawColor(184,29,56); doc.setLineWidth(1.15); doc.line(29,86,48,86);

  // Il marchio è integrato nella composizione grafica, ma resta una
  // rappresentazione vettoriale semplificata per non dipendere dalla rete.
  function stemmaBolognaPdf(x,y,w,h) {
    doc.setFillColor(248,248,249); doc.setDrawColor(12,37,64);
    doc.setLineWidth(1.1); doc.ellipse(x+w/2,y+h/2,w/2,h/2,'FD');
    doc.setFillColor(170,29,53); doc.rect(x+w*.22,y+h*.24,w*.18,h*.55,'F');
    doc.setFillColor(12,37,64); doc.rect(x+w*.42,y+h*.24,w*.18,h*.55,'F');
    doc.setFillColor(170,29,53); doc.rect(x+w*.62,y+h*.24,w*.16,h*.55,'F');
    doc.setFillColor(12,37,64); doc.roundedRect(x+w*.14,y+h*.12,w*.72,h*.16,1.5,1.5,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');doc.setFontSize(8);
    doc.text('BFC',x+w/2,y+h*.23,{align:'center'});
  }
  stemmaBolognaPdf(82,26,39,54);
  doc.setTextColor(17,47,77);doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.text('BOLOGNA FC 1909',pageWidth/2,91,{align:'center'});
  doc.setFontSize(25);doc.text('REPORT',29,112);
  doc.setFontSize(19);doc.text('VALUTAZIONE TEST VISIVI',29,124,{maxWidth:146});
  doc.setFont('helvetica','normal');doc.setFontSize(10);
  const sub=doc.splitTextToSize('ANALISI DELLE PRESTAZIONI VISIVE E PERCETTIVE DEI GIOCATORI',142);
  doc.text(sub,29,139);
  doc.setFontSize(9.2);doc.setTextColor(65,81,97);
  const intro=doc.splitTextToSize(
    'Il presente report raccoglie i risultati delle valutazioni visive e percettive effettuate sui giocatori selezionati. Per ciascun atleta sono riportati i dati clinici e visivi disponibili, i risultati dei Test eseguiti e un profilo radar conclusivo delle prestazioni osservate.',139);
  doc.text(intro,29,169);
  doc.setDrawColor(184,29,56);doc.setLineWidth(.8);doc.line(29,228,29,257);
  doc.setFont('helvetica','bold');doc.setFontSize(8.3);doc.setTextColor(17,47,77);
  doc.text('PERIODO DI VALUTAZIONE',35,235);
  doc.setFont('helvetica','normal');doc.setFontSize(9.2);
  doc.text(formatDataIt(periodoDa)+' - '+formatDataIt(periodoA),35,242);
  doc.setFont('helvetica','bold');doc.setFontSize(8.3);
  doc.text('DATA DI GENERAZIONE',35,251);
  doc.setFont('helvetica','normal');doc.setFontSize(9.2);
  doc.text(formatDataIt(oggiIso()),35,258);

  for (let atletaIndex = 0; atletaIndex < selezioniConDati.length; atletaIndex++) {
    const { atleta, sessioni } = selezioniConDati[atletaIndex];

    nomeAtletaPagina = nomeCompleto(atleta);
    paginaNuova(false);

    doc.setFillColor(17,47,77);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setFillColor(184,29,56);
    doc.triangle(pageWidth-31,32,pageWidth,0,pageWidth,32,'F');
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

    const datiCliniciMultiplo = datiCliniciMultiploDaProfilo(atleta.datiClinici);
    titoloSezione('Dati clinici e visivi', 'Informazioni registrate nella scheda del giocatore.');
    if (datiCliniciMultiplo.length) {
      disegnaTabellaLeggibile(['Parametro', 'Valore'], datiCliniciMultiplo, [90, 90]);
    } else {
      disegnaTabellaLeggibile(['Parametro', 'Valore'], [['Dati clinici e visivi', 'Non compilati nella scheda giocatore']], [90, 90]);
    }

    if (!sessioni.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...C.muted);
      doc.text('Nessun risultato disponibile per i Test e il periodo selezionati.', marginX, y);
      continue;
    }

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
        disegnaTabellaLeggibile(headers, rows, [dataWidth, ...headers.slice(1).map(() => other)]);
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
          disegnaTabellaLeggibile(headers, rows, [dataWidth, ...cols.map(() => other)]);
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
          disegnaTabellaLeggibile(['Parametro', 'Valore'], [['Durata', dati.durataSecondi + ' s']], [110, 70]);
        }
        if (Array.isArray(dati.percentualiSettori) && dati.percentualiSettori.length) {
          disegnaTabellaLeggibile(['Settore', 'Fascia angoli', 'Risposte corrette'],
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
        disegnaTabellaLeggibile(
          ['Parametro', 'Valore'],
          righeOriginali,
          [usableWidth * 0.62, usableWidth * 0.38]
        );
      }
    }

    // Il radar chiude sempre la scheda dell'atleta, dopo tutte le tabelle.
    await disegnaSoloRadarAtleta(sessioni);
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
