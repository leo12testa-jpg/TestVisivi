registerServiceWorker();

let _bulkAtleti = [];
let _bulkSessioni = [];
const _bulkAtletiSelezionati = new Set();
let _bulkPreviewUrl = '';
let _bulkPreviewNomeFile = '';

function bulkModalita() {
  return qs('input[name="bulk-mode"]:checked')?.value || 'periodo';
}

function bulkSessioneValida(s) {
  return isSessioneTest(s) &&
    (typeof sessioneHaRisultatiVisibili !== 'function' || sessioneHaRisultatiVisibili(s));
}

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
    .filter(bulkSessioneValida)
    .filter((s) => String(s.data || '') >= da && String(s.data || '') <= a)
    .sort((x, y) => String(x.data || '').localeCompare(String(y.data || '')));
}

function bulkDatiDaSessioni(sessioni, atletaIds = null) {
  const perAtleta = new Map();
  sessioni.forEach((s) => {
    if (!s.atletaId) return;
    if (atletaIds && !atletaIds.has(s.atletaId)) return;
    if (!perAtleta.has(s.atletaId)) perAtleta.set(s.atletaId, []);
    perAtleta.get(s.atletaId).push(s);
  });

  const selezioni = _bulkAtleti
    .filter((atleta) => perAtleta.has(atleta.id))
    .map((atleta) => ({ atleta, sessioni: perAtleta.get(atleta.id) }));

  const sessioniIncluse = selezioni.flatMap((item) => item.sessioni);
  const nomiTest = new Set(
    sessioniIncluse
      .map((s) => typeof nomeTestSessione === 'function' ? nomeTestSessione(s) : '')
      .filter(Boolean)
  );

  return { sessioni: sessioniIncluse, selezioni, nomiTest };
}

function bulkDatiAutomatici() {
  return bulkDatiDaSessioni(bulkSessioniNelPeriodo());
}

function bulkDateManuali() {
  if (qs('#bulk-date-type').value === 'intervallo') {
    return { da: qs('#bulk-manual-da').value, a: qs('#bulk-manual-a').value };
  }
  const data = qs('#bulk-data-test').value;
  return { da: data, a: data };
}

function bulkDateManualiValide() {
  const { da, a } = bulkDateManuali();
  return !!da && !!a && da <= a;
}

function bulkAggiornaTipoData() {
  const intervallo = qs('#bulk-date-type').value === 'intervallo';
  qs('#bulk-manual-single').hidden = intervallo;
  qs('#bulk-manual-range').hidden = !intervallo;
  bulkAggiornaRiepilogo();
}

function bulkDatiManuali() {
  const { da, a } = bulkDateManuali();
  const ids = new Set(_bulkAtletiSelezionati);
  if (!bulkDateManualiValide() || !ids.size) return { sessioni: [], selezioni: [], nomiTest: new Set() };

  const sessioni = (_bulkSessioni || [])
    .filter(bulkSessioneValida)
    .filter((s) => String(s.data || '').slice(0, 10) >= da && String(s.data || '').slice(0, 10) <= a);

  return bulkDatiDaSessioni(sessioni, ids);
}

function bulkRenderAtleti(filtro = '') {
  const box = qs('#bulk-atleti');
  box.innerHTML = '';
  const needle = String(filtro || '').trim().toLowerCase();
  const lista = _bulkAtleti.filter((a) => !needle || nomeCompleto(a).toLowerCase().includes(needle));

  if (!lista.length) {
    box.appendChild(el('div', { class: 'empty-state', text: 'Nessun giocatore corrisponde alla ricerca.' }));
    return;
  }

  lista.forEach((a) => {
    const id = 'bulk-atleta-' + a.id;
    box.appendChild(el('label', { class: 'bulk-choice-item', for: id }, [
      el('input', {
        type: 'checkbox',
        id,
        value: a.id,
        class: 'bulk-atleta-check',
        checked: _bulkAtletiSelezionati.has(a.id),
      }),
      el('span', { text: nomeCompleto(a) }),
    ]));
  });

  qsa('.bulk-atleta-check', box).forEach((x) => x.addEventListener('change', () => {
    if (x.checked) _bulkAtletiSelezionati.add(x.value);
    else _bulkAtletiSelezionati.delete(x.value);
    bulkAggiornaRiepilogo();
  }));
}

function bulkSetAtleti(checked) {
  if (checked) _bulkAtleti.forEach((a) => _bulkAtletiSelezionati.add(a.id));
  else _bulkAtletiSelezionati.clear();
  qsa('.bulk-atleta-check').forEach((x) => { x.checked = checked; });
  bulkAggiornaRiepilogo();
}

function bulkAggiornaModalita() {
  const manuale = bulkModalita() === 'giocatori-data';
  qs('#bulk-periodo-panel').hidden = manuale;
  qs('#bulk-manuale-panel').hidden = !manuale;
  bulkAggiornaRiepilogo();
}

function bulkAggiornaRiepilogo() {
  const btn = qs('#bulk-genera');
  const summary = qs('#bulk-summary');
  const detail = qs('#bulk-detail');

  if (bulkModalita() === 'periodo') {
    if (!bulkPeriodoValido()) {
      summary.textContent = 'Seleziona un intervallo valido';
      detail.textContent = 'Indica Data da e Data a.';
      btn.disabled = true;
      return;
    }

    const { sessioni, selezioni, nomiTest } = bulkDatiAutomatici();
    if (!selezioni.length || !sessioni.length) {
      summary.textContent = 'Nessun Test nel periodo selezionato';
      detail.textContent = 'Cambia l’intervallo per trovare valutazioni Test registrate.';
      btn.disabled = true;
      return;
    }

    summary.textContent =
      selezioni.length + (selezioni.length === 1 ? ' giocatore' : ' giocatori') +
      ' · ' + sessioni.length + (sessioni.length === 1 ? ' sessione Test' : ' sessioni Test');
    detail.textContent =
      nomiTest.size + (nomiTest.size === 1 ? ' tipo di Test rilevato automaticamente.' : ' tipi di Test rilevati automaticamente.');
    btn.disabled = false;
    return;
  }

  const intervallo = qs('#bulk-date-type').value === 'intervallo';
  if (!_bulkAtletiSelezionati.size || !bulkDateManualiValide()) {
    summary.textContent = !_bulkAtletiSelezionati.size ? 'Seleziona almeno un giocatore' : 'Seleziona date valide (Dal non successivo ad Al)';
    detail.textContent = intervallo
      ? 'Verranno inclusi tutti i Test dei giocatori scelti nel periodo, date comprese.'
      : 'Verranno inclusi tutti i Test svolti dai giocatori scelti in quella giornata.';
    btn.disabled = true;
    return;
  }

  const { sessioni, selezioni, nomiTest } = bulkDatiManuali();
  if (!selezioni.length || !sessioni.length) {
    summary.textContent = 'Nessun Test trovato';
    detail.textContent = intervallo ? 'I giocatori selezionati non hanno Test nel periodo scelto.' : 'I giocatori selezionati non hanno Test nella data scelta.';
    btn.disabled = true;
    return;
  }

  summary.textContent =
    selezioni.length + (selezioni.length === 1 ? ' giocatore con Test' : ' giocatori con Test') +
    ' · ' + sessioni.length + (sessioni.length === 1 ? ' sessione Test' : ' sessioni Test');
  detail.textContent =
    nomiTest.size + (nomiTest.size === 1 ? ' tipo di Test incluso.' : ' tipi di Test inclusi.');
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
  if (!(report?.blob instanceof Blob) || report.blob.size < 100 || report.blob.type && report.blob.type !== 'application/pdf') {
    throw new Error('Il PDF generato non è valido. Riprova a creare l’anteprima.');
  }
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

function bulkApriInScheda() {
  if (!_bulkPreviewUrl) return;
  const aperta = window.open(_bulkPreviewUrl, '_blank', 'noopener');
  if (!aperta) {
    qs('#bulk-preview-meta').textContent = 'Il browser ha bloccato la nuova scheda: consenti i popup oppure usa Scarica PDF.';
  }
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

qsa('input[name="bulk-mode"]').forEach((x) => x.addEventListener('change', bulkAggiornaModalita));
qs('#bulk-da').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-a').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-data-test').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-manual-da').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-manual-a').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-date-type').addEventListener('change', bulkAggiornaTipoData);
qs('#bulk-ricerca').addEventListener('input', debounce((e) => bulkRenderAtleti(e.target.value), 120));
qs('#bulk-atleti-tutti').addEventListener('click', () => bulkSetAtleti(true));
qs('#bulk-atleti-nessuno').addEventListener('click', () => bulkSetAtleti(false));
qs('#bulk-preview-x').addEventListener('click', bulkChiudiAnteprima);
qs('#bulk-preview-close').addEventListener('click', bulkChiudiAnteprima);
qs('#bulk-preview-download').addEventListener('click', bulkScaricaAnteprima);
qs('#bulk-preview-open').addEventListener('click', bulkApriInScheda);
qs('#bulk-preview-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  bulkChiudiAnteprima();
});
window.addEventListener('beforeunload', () => {
  if (_bulkPreviewUrl) URL.revokeObjectURL(_bulkPreviewUrl);
});

qs('#bulk-genera').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const manuale = bulkModalita() === 'giocatori-data';
  const dati = manuale ? bulkDatiManuali() : bulkDatiAutomatici();

  if (!dati.selezioni.length) {
    bulkAggiornaRiepilogo();
    return;
  }

  const periodoDa = manuale ? bulkDateManuali().da : qs('#bulk-da').value;
  const periodoA = manuale ? bulkDateManuali().a : qs('#bulk-a').value;

  btn.disabled = true;
  btn.textContent = 'Generazione anteprima…';

  try {
    const report = await esportaReportMultiploPdf(dati.selezioni, {
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
  bulkRenderAtleti();

  const oggi = oggiIso();
  const d = new Date(oggi + 'T12:00:00');
  d.setFullYear(d.getFullYear() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  qs('#bulk-da').value = y + '-' + m + '-' + day;
  qs('#bulk-a').value = oggi;
  qs('#bulk-data-test').value = oggi;
  qs('#bulk-manual-da').value = y + '-' + m + '-' + day;
  qs('#bulk-manual-a').value = oggi;
  bulkAggiornaTipoData();
  bulkAggiornaModalita();
})().catch(mostraErrorePagina);
