registerServiceWorker();

let _bulkAtleti = [];

function bulkSelected(selector) {
  return qsa(selector).filter((x) => x.checked).map((x) => x.value);
}

function bulkAggiornaRiepilogo() {
  const atleti = bulkSelected('.bulk-atleta-check');
  const test = bulkSelected('.bulk-test-check');
  const summary = qs('#bulk-summary');
  summary.textContent = atleti.length + (atleti.length === 1 ? ' giocatore' : ' giocatori') +
    ' · ' + test.length + (test.length === 1 ? ' Test' : ' Test');

  const da = qs('#bulk-da').value;
  const a = qs('#bulk-a').value;
  qs('#bulk-genera').disabled = !atleti.length || !test.length || !da || !a || da > a;
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
      el('input', { type: 'checkbox', id, value: a.id, class: 'bulk-atleta-check' }),
      el('span', { text: nomeCompleto(a) }),
    ]));
  });

  qsa('.bulk-atleta-check', box).forEach((x) => x.addEventListener('change', bulkAggiornaRiepilogo));
}

function bulkRenderTest() {
  const box = qs('#bulk-test');
  box.innerHTML = '';
  TEST_STANDARD_KEYS.forEach((key) => {
    const id = 'bulk-test-' + key;
    box.appendChild(el('label', { class: 'bulk-choice-item', for: id }, [
      el('input', { type: 'checkbox', id, value: key, class: 'bulk-test-check' }),
      el('span', { text: TEST_STANDARD_LABELS[key] || getEsercizioConfig(key)?.label || key }),
    ]));
  });
  qsa('.bulk-test-check', box).forEach((x) => x.addEventListener('change', bulkAggiornaRiepilogo));
}

function bulkSet(selector, checked) {
  qsa(selector).forEach((x) => { x.checked = checked; });
  bulkAggiornaRiepilogo();
}

qs('#bulk-atleti-tutti').addEventListener('click', () => bulkSet('.bulk-atleta-check', true));
qs('#bulk-atleti-nessuno').addEventListener('click', () => bulkSet('.bulk-atleta-check', false));
qs('#bulk-test-tutti').addEventListener('click', () => bulkSet('.bulk-test-check', true));
qs('#bulk-test-nessuno').addEventListener('click', () => bulkSet('.bulk-test-check', false));
qs('#bulk-ricerca').addEventListener('input', debounce((e) => bulkRenderAtleti(e.target.value), 120));
qs('#bulk-da').addEventListener('change', bulkAggiornaRiepilogo);
qs('#bulk-a').addEventListener('change', bulkAggiornaRiepilogo);

qs('#bulk-genera').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const atletaIds = bulkSelected('.bulk-atleta-check');
  const testKeys = bulkSelected('.bulk-test-check');
  const periodoDa = qs('#bulk-da').value;
  const periodoA = qs('#bulk-a').value;

  if (!atletaIds.length || !testKeys.length || !periodoDa || !periodoA || periodoDa > periodoA) {
    bulkAggiornaRiepilogo();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Preparazione PDF…';

  try {
    const selezioni = [];
    for (let i = 0; i < atletaIds.length; i++) {
      const atleta = _bulkAtleti.find((a) => a.id === atletaIds[i]);
      if (!atleta) continue;
      btn.textContent = 'Caricamento ' + (i + 1) + '/' + atletaIds.length + '…';
      const sessioni = await dbGetSessioniByAtleta(atleta.id);
      selezioni.push({ atleta, sessioni });
    }

    btn.textContent = 'Generazione PDF…';
    await esportaReportMultiploPdf(selezioni, {
      testKeys,
      periodoDa,
      periodoA,
    });
  } catch (err) {
    mostraErrorePagina(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Genera PDF unico';
    bulkAggiornaRiepilogo();
  }
});

(async () => {
  const user = await richiedeLogin();
  if (!user) return;

  _bulkAtleti = await dbGetAtleti();
  bulkRenderAtleti();
  bulkRenderTest();

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
