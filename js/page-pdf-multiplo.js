registerServiceWorker();

let _bulkAtleti = [];
let _bulkSessioni = [];
let _bulkPreviewUrl = '';
let _bulkPreviewNomeFile = '';

function bulkPeriodoValido() {
  const da = qs('#bulk-da').value;
  const a = qs('#bulk-a').value;
  return !!da && !!a && da <= a;
}

function bulkSessioniNelPeriodo() {
  if (!bulkPeriodoValido()) return [];
  const da = qs('#bulk-da').value;
  const a = qs('#bulk-a').value;

  return (_bulkSessioni || [])
    .filter(isSessioneTest)
    .filter((s) => typeof sessioneHaRisultatiVisibili !== 'function' || sessioneHaRisultatiVisibili(s))
    .filter((s) => String(s.data || '') >= da && String(s.data || '') <= a)
    .sort((x, y) => String(x.data || '').localeCompare(String(y.data || '')));
}

function bulkDatiAutomatici() {
  const sessioni = bulkSessioniNelPeriodo();
  const perAtleta = new Map();

  sessioni.forEach((s) => {
    if (!s.atletaId) return;
    if (!perAtleta.has(s.atletaId)) perAtleta.set(s.atletaId, []);
    perAtleta.get(s.atletaId).push(s);
  });

  const selezioni = _bulkAtleti
    .filter((atleta) => perAtleta.has(atleta.id))
    .map((atleta) => ({ atleta, sessioni: perAtleta.get(atleta.id) }));

  const nomiTest = new Set(
    sessioni
      .map((s) => typeof nomeTestSessione === 'function' ? nomeTestSessione(s) : '')
      .filter(Boolean)
  );

  return { sessioni, selezioni, nomiTest };
}

function bulkAggiornaRiepilogo() {
  const btn = qs('#bulk-genera');
  const summary = qs('#bulk-summary');
  const detail = qs('#bulk-detail');

  if (!bulkPeriodoValido()) {
    summary.textContent = 'Seleziona un intervallo valido';
    detail.textContent = 'Indica Data da e Data a.';
    btn.disabled = true;
    return;
  }

  const { sessioni, selezioni, nomiTest } = bulkDatiAutomatici();
  const nAtleti = selezioni.length;
  const nSessioni = sessioni.length;
  const nTest = nomiTest.size;

  if (!nAtleti || !nSessioni) {
    summary.textContent = 'Nessun Test nel periodo selezionato';
    detail.textContent = 'Cambia l’intervallo per trovare valutazioni Test registrate.';
    btn.disabled = true;
    return;
  }

  summary.textContent =
    nAtleti + (nAtleti === 1 ? ' giocatore' : ' giocatori') +
    ' · ' + nSessioni + (nSessioni === 1 ? ' sessione Test' : ' sessioni Test');

  detail.textContent =
    nTest + (nTest === 1 ? ' tipo di Test rilevato automaticamente.' : ' tipi di Test rilevati automaticamente.');

  btn.disabled = false;
}

function bulkChiudiAnteprima() {
  const dialog = qs('#bulk-preview-dialog');
  const frame = qs('#bulk-preview-frame');
  if (dialog.open) dialog.close();
  frame.removeAttribute('src');
  if (_bulkPreviewUrl) {
    URL.revokeObjectURL(_bulkPreviewUrl);
    _bulkPreviewUrl = '';
  }
  _bulkPreviewNomeFile = '';
}

function bulkApriAnteprima(report) {
  if (!report?.blob) throw new Error('Anteprima PDF non disponibile.');

  if (_bulkPreviewUrl) URL.revokeObjectURL(_bulkPreviewUrl);
  _bulkPreviewUrl = URL.createObjectURL(report.blob);
  _bulkPreviewNomeFile = report.nomeFile || ('report_multiplo_test_visivi_' + oggiIso() + '.pdf');

  qs('#bulk-preview-frame').src = _bulkPreviewUrl;
  qs('#bulk-preview-meta').textContent =
    (report.pagine || 1) + ((report.pagine || 1) === 1 ? ' pagina' : ' pagine') +
    ' · controlla il contenuto e poi scegli se scaricarlo.';

  const dialog = qs('#bulk-preview-dialog');
  if (!dialog.open) dialog.showModal();
}

function bulkScaricaAnteprima() {
  if (!_bulkPreviewUrl) return;
  const link = document.createElement('a');
  link.href = _bulkPreviewUrl;
  link.download = _bulkPreviewNomeFile || ('report_multiplo_test_visivi_' + oggiIso() + '.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
}

qs('#bulk-da').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-a').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-preview-x').addEventListener('click', bulkChiudiAnteprima);
qs('#bulk-preview-close').addEventListener('click', bulkChiudiAnteprima);
qs('#bulk-preview-download').addEventListener('click', bulkScaricaAnteprima);
qs('#bulk-preview-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  bulkChiudiAnteprima();
});
window.addEventListener('beforeunload', () => {
  if (_bulkPreviewUrl) URL.revokeObjectURL(_bulkPreviewUrl);
});

qs('#bulk-genera').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const periodoDa = qs('#bulk-da').value;
  const periodoA = qs('#bulk-a').value;

  if (!bulkPeriodoValido()) {
    bulkAggiornaRiepilogo();
    return;
  }

  const { selezioni } = bulkDatiAutomatici();
  if (!selezioni.length) {
    bulkAggiornaRiepilogo();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Generazione anteprima…';

  try {
    const report = await esportaReportMultiploPdf(selezioni, {
      periodoDa,
      periodoA,
      automatico: true,
      scarica: false,
    });
    bulkApriAnteprima(report);
  } catch (err) {
    mostraErrorePagina(err);
  } finally {
    btn.textContent = 'Anteprima PDF';
    bulkAggiornaRiepilogo();
  }
});

(async () => {
  const user = await richiedeLogin();
  if (!user) return;

  [_bulkAtleti, _bulkSessioni] = await Promise.all([
    dbGetAtleti(),
    dbGetAllSessioni(),
  ]);

  const oggi = oggiIso();
  const d = new Date(oggi + 'T12:00:00');
  d.setFullYear(d.getFullYear() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  qs('#bulk-da').value = y + '-' + m + '-' + day;
  qs('#bulk-a').value = oggi;
  bulkAggiornaRiepilogo();
})().catch(mostraErrorePagina);
