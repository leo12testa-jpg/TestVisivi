/*
 * Export PDF del report atleta con jsPDF (vendorizzato in vendor/, no CDN).
 * I grafici vengono ridisegnati offscreen con Chart.js e inseriti come PNG.
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
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    canvas.style.position = 'fixed';
    canvas.style.left = '-99999px';
    canvas.style.top = '0';
    document.body.appendChild(canvas);
    const cfg = {
      ...config,
      options: { ...config.options, responsive: false, animation: false, devicePixelRatio: 2 },
    };
    const chart = new Chart(canvas, cfg);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        chart.destroy();
        document.body.removeChild(canvas);
        resolve(dataUrl);
      });
    });
  });
}

async function esportaReportPdf(atleta, sessioni) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginX * 2;
  let y = 18;

  function nuovaPaginaSeNecessario(spazio) {
    if (y + spazio > pageHeight - 14) {
      doc.addPage();
      y = 18;
    }
  }

  function formatCorrezioneOcchio(v) {
    if (!v) return '-';
    const parti = [v.sf, v.cyl, v.ax].map((x) => x || '-');
    return parti.join(' / ');
  }

  function disegnaAnagrafica(atleta) {
    const righe = [
      ['Altezza (cm)', atleta.altezza],
      ['Data di nascita', atleta.dataNascita ? formatDataIt(atleta.dataNascita) : ''],
      ['Telefono', atleta.telefono],
      ['Email', atleta.email],
    ];
    nuovaPaginaSeNecessario(12);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Dati anagrafici', marginX, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const colWidth = usableWidth / 2;
    righe.forEach(([label, valore], i) => {
      const col = i % 2;
      if (col === 0) nuovaPaginaSeNecessario(6);
      const xPos = marginX + col * colWidth;
      const testo = valore === '' || valore === undefined || valore === null ? '-' : String(valore);
      doc.text(`${label}: ${testo}`, xPos, y, { maxWidth: colWidth - 4 });
      if (col === 1) y += 6;
    });
    if (righe.length % 2 === 1) y += 6;
    y += 6;
  }

  function disegnaDatiClinici(dc) {
    const righe = [
      ['Acuità visiva Od', dc.acuitaVisiva.od],
      ['Acuità visiva Os', dc.acuitaVisiva.os],
      ['Acuità visiva Binoculare', dc.acuitaVisiva.binoculare],
      ['Propria correzione OD (Sf/Cyl/Ax)', formatCorrezioneOcchio(dc.correzionePropria && dc.correzionePropria.od)],
      ['Propria correzione OS (Sf/Cyl/Ax)', formatCorrezioneOcchio(dc.correzionePropria && dc.correzionePropria.os)],
      ['Correzione OD (Sf/Cyl/Ax)', formatCorrezioneOcchio(dc.correzione && dc.correzione.od)],
      ['Correzione OS (Sf/Cyl/Ax)', formatCorrezioneOcchio(dc.correzione && dc.correzione.os)],
      ['Piede dominante', dc.piedeDominante],
      ['Mano dominante', dc.manoDominante],
      ['Occhio dominante', dc.occhioDirettoreMotorio],
      ['Schober a 3m — Alto sinistro', dc.schober3m && dc.schober3m.altoSx],
      ['Schober a 3m — Basso sinistro', dc.schober3m && dc.schober3m.bassoSx],
      ['Schober a 3m — Centrale', dc.schober3m && dc.schober3m.centrale],
      ['Schober a 3m — Alto destro', dc.schober3m && dc.schober3m.altoDx],
      ['Schober a 3m — Basso destro', dc.schober3m && dc.schober3m.bassoDx],
      ['Brock String — Alto sinistro', dc.brockString.altoSx],
      ['Brock String — Basso sinistro', dc.brockString.bassoSx],
      ['Brock String — Centrale', dc.brockString.centrale],
      ['Brock String — Alto destro', dc.brockString.altoDx],
      ['Brock String — Basso destro', dc.brockString.bassoDx],
      ['Abilità fusionale rapida (cicli fusionali/min)', dc.abilitaFusionaleRapida],
      ['Abilità di messa a fuoco rapida (cicli accomodativi/min)', dc.abilitaMessaFuocoRapida],
    ];
    nuovaPaginaSeNecessario(12);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Dati clinici', marginX, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const colWidth = usableWidth / 2;
    righe.forEach(([label, valore], i) => {
      const col = i % 2;
      if (col === 0) nuovaPaginaSeNecessario(6);
      const xPos = marginX + col * colWidth;
      const testo = valore === '' || valore === undefined || valore === null ? '-' : String(valore);
      doc.text(`${label}: ${testo}`, xPos, y, { maxWidth: colWidth - 4 });
      if (col === 1) y += 6;
    });
    if (righe.length % 2 === 1) y += 6;
    y += 6;
  }

  function disegnaTabella(headers, rows) {
    const nCols = headers.length;
    const fontSize = nCols > 8 ? 6.5 : nCols > 5 ? 7.5 : 8.5;
    const rowHeight = fontSize * 0.6 + 3.5;
    const colWidth = usableWidth / nCols;

    function disegnaHeader() {
      doc.setFontSize(fontSize);
      doc.setFont(undefined, 'bold');
      doc.setFillColor(240, 240, 238);
      doc.rect(marginX, y, usableWidth, rowHeight, 'F');
      headers.forEach((h, i) => {
        doc.text(String(h), marginX + i * colWidth + 1.5, y + rowHeight - 2, { maxWidth: colWidth - 3 });
      });
      y += rowHeight;
      doc.setFont(undefined, 'normal');
    }

    nuovaPaginaSeNecessario(rowHeight * 2);
    disegnaHeader();

    rows.forEach((riga) => {
      if (y + rowHeight > pageHeight - 14) {
        doc.addPage();
        y = 18;
        disegnaHeader();
      }
      riga.forEach((cell, i) => {
        doc.text(String(cell), marginX + i * colWidth + 1.5, y + rowHeight - 2, { maxWidth: colWidth - 3 });
      });
      doc.setDrawColor(225, 224, 217);
      doc.line(marginX, y + rowHeight, marginX + usableWidth, y + rowHeight);
      y += rowHeight;
    });
    y += 4;
  }

  async function disegnaGrafico(group, sessioniGruppo) {
    const config = buildGroupChartConfig(sessioniGruppo, group);
    const widthPx = 900;
    const heightPx = 420;
    const img = await renderChartOffscreen(config, widthPx, heightPx);
    const imgWidthMm = usableWidth;
    const imgHeightMm = imgWidthMm * (heightPx / widthPx);
    nuovaPaginaSeNecessario(imgHeightMm + 10);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(titoloGruppo(group), marginX, y);
    y += 4;
    doc.addImage(img, 'PNG', marginX, y, imgWidthMm, imgHeightMm);
    y += imgHeightMm + 8;
    doc.setFont(undefined, 'normal');
  }

  async function disegnaCampoVisivoAvanzato(sessioniCompilate) {
    for (const s of sessioniCompilate) {
      const dati = s.esercizi && s.esercizi.campoVisivoAvanzato;
      if (!dati) continue;

      const modalitaTxt = dati.modalita ? `${dati.modalita}°` : '-';
      const durataTxt = dati.durataSecondi !== undefined && dati.durataSecondi !== null && dati.durataSecondi !== '' ? `${dati.durataSecondi}s` : '-';

      nuovaPaginaSeNecessario(14);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`${formatDataIt(s.data)} — Modalità ${modalitaTxt}, Durata ${durataTxt}`, marginX, y);
      y += 6;
      doc.setFont(undefined, 'normal');

      if (dati.immaginePolarPlot) {
        try {
          const { larghezza, altezza } = await dimensioniImmagine(dati.immaginePolarPlot);
          const larghezzaMm = Math.min(usableWidth, 100);
          const altezzaMm = larghezzaMm * (altezza / larghezza);
          nuovaPaginaSeNecessario(altezzaMm + 10);
          doc.addImage(dati.immaginePolarPlot, formatoImmagineDaDataUrl(dati.immaginePolarPlot), marginX, y, larghezzaMm, altezzaMm);
          y += altezzaMm + 6;
        } catch (err) {
          doc.text('(immagine non leggibile)', marginX, y);
          y += 8;
        }
      }

      if (Array.isArray(dati.percentualiSettori) && dati.percentualiSettori.length > 0) {
        const headers = ['Settore', 'Fascia angoli', '% corretta'];
        const rows = dati.percentualiSettori.map((r) => [String(r.settore), r.fasciaAngoli, `${r.percentualeCorretta}%`]);
        disegnaTabella(headers, rows);
      }
      y += 4;
    }
  }

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`Report JetProgram — ${nomeCompleto(atleta)}`, marginX, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(110);
  doc.text(`Generato il ${formatDataIt(oggiIso())}`, marginX, y);
  doc.setTextColor(0);
  y += 8;

  async function disegnaAllegati() {
    const righe = [];
    for (const s of sessioni) {
      const foto = await dbGetAllegatiFotoBySessione(s.id);
      const video = await dbGetAllegatiVideoBySessione(s.id);
      if (foto.length === 0 && video.length === 0) continue;
      righe.push(`${formatDataIt(s.data)} — ${foto.length} foto e ${video.length} video allegati, disponibili nell'app.`);
    }
    if (righe.length === 0) return;

    nuovaPaginaSeNecessario(12);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Allegati', marginX, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    righe.forEach((riga) => {
      nuovaPaginaSeNecessario(6);
      doc.text(riga, marginX, y, { maxWidth: usableWidth });
      y += 6;
    });
    y += 4;
  }

  disegnaAnagrafica(atleta);
  disegnaDatiClinici(atleta.datiClinici);
  await disegnaAllegati();

  for (const esercizio of ESERCIZI_CONFIG) {
    const sessioniCompilate = sessioni.filter((s) => esercizioCompilato(esercizio, s.esercizi && s.esercizi[esercizio.key]));
    if (sessioniCompilate.length === 0) continue;

    nuovaPaginaSeNecessario(14);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(esercizio.label, marginX, y);
    y += 6;
    doc.setFont(undefined, 'normal');

    if (esercizio.custom) {
      await disegnaCampoVisivoAvanzato(sessioniCompilate);
      continue;
    }

    const cols = colonneEsercizio(esercizio);
    const headers = ['Data', 'Titolo', ...cols.map((c) => c.header)];
    const rows = sessioniCompilate.map((s) => [
      formatDataIt(s.data),
      s.titolo || '-',
      ...cols.map((c) => (c.get(s) === '' ? '-' : String(c.get(s)))),
    ]);
    disegnaTabella(headers, rows);

    if (sessioniCompilate.length >= 2) {
      for (const group of getChartGroups(esercizio)) {
        const sessioniGruppo = sessioniConGruppo(sessioniCompilate, group);
        await disegnaGrafico(group, sessioniGruppo);
      }
    }
  }

  const nomeFile = `report_${slug(atleta.cognome)}_${oggiIso()}.pdf`;
  doc.save(nomeFile);
}
