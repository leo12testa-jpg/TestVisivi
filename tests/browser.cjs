/* E2E isolato: sostituisce SOLO Firebase con un doppio in memoria/localStorage.
 * Tutte le richieste fuori localhost sono bloccate. Mai dati o scritture reali.
 * PLAYWRIGHT_PATH opzionale per riusare un'installazione locale di Playwright.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8765';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Solo server locale');
const out = path.join(__dirname, '../reports');
fs.mkdirSync(out, { recursive: true });
const fixture = {
  atleti: {
    demo: { nome: 'Andrea', cognome: 'Atleta demo', note: 'Dati sintetici' },
    secondo: { nome: 'Giulia', cognome: 'Esempio', datiClinici: {} },
  }, squadre: {}, sessioni: {
    jet: { atletaId: 'demo', data: '2026-08-01', nomeTestOriginale: 'x/Pro Action and Reaction Time', tipoTest: 'proActionReaction', datiOriginali: { 'Tempo totale (s)': 45, 'Tempo medio di rilascio (ms)': 350, errori: 0, sconosciuto: 'conservare' }, esercizi: { testEsterno: { valore: 22 } } },
    jet2: { atletaId: 'demo', data: '2026-08-12', nomeTestOriginale: 'x/Pro Action and Reaction Time', tipoTest: 'proActionReaction', datiOriginali: { 'Tempo totale (s)': 40, 'Tempo medio di rilascio (ms)': 320, errori: 1 } },
    unknown: { atletaId: 'demo', data: '2026-08-20', nomeTestOriginale: 'Protocollo non riconosciuto', tipoTest: 999, datiOriginali: { misura: 'nessuna unità' } },
    legacy: { atletaId: 'demo', data: '2026-08-18', esercizi: { vvs: { gioco: { primaDeviazione: 2, parametroEsterno: 77 } }, campoVisivoAvanzato: { durataSecondi: 5, percentualiSettori: [{ settore: 1, fasciaAngoli: '5-10', percentualeCorretta: 90 }] } } },
  },
};
for (let i = 0; i < 65; i++) fixture.sessioni[`old-${i}`] = { atletaId: 'demo', data: '2025-01-01', testStandard: 'memorizzazioneSequenze', esercizi: { memorizzazioneSequenze: { errori: i % 3, livelloMassimo: 5 } } };

function fakeFirebase(seed) {
  const storageKey = 'testvisivi-synthetic-e2e';
  if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(seed));
  window.__dbReads = [];
  const load = () => JSON.parse(localStorage.getItem(storageKey));
  const save = (data) => localStorage.setItem(storageKey, JSON.stringify(data));
  function merge(a, b) {
    const out = { ...a };
    Object.entries(b).forEach(([k, v]) => { out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k], v) : v; });
    return out;
  }
  class Collection {
    constructor(name, filter) { this.name = name; this.filter = filter; }
    async get() {
      window.__dbReads.push(this.name);
      const items = Object.entries(load()[this.name] || {}).filter(([, d]) => !this.filter || d[this.filter[0]] === this.filter[1]);
      return { docs: items.map(([id, data]) => ({ id, data: () => data })) };
    }
    where(key, op, value) { if (op !== '==') throw new Error('Unexpected query'); return new Collection(this.name, [key, value]); }
    doc(id) {
      const name = this.name;
      return {
        collection: (child) => new Collection(child),
        get: async () => { window.__dbReads.push(`${name}/${id}`); const data = load()[name]?.[id]; return { id, exists: !!data, data: () => data }; },
        set: async (data, options) => {
          if (localStorage.getItem('simulate-write-error')) throw new Error('Salvataggio di prova non riuscito');
          const state = load(); state[name][id] = options?.merge ? merge(state[name][id], data) : data; save(state);
        },
        delete: async () => { throw new Error('Le eliminazioni sono vietate nei test'); },
      };
    }
    async add(data) {
      if (localStorage.getItem('simulate-write-error')) throw new Error('Salvataggio di prova non riuscito');
      const state = load(); const id = `new-${Date.now()}`; state[this.name][id] = data; save(state); return { id };
    }
  }
  const auth = { currentUser: { uid: 'synthetic-user' }, onAuthStateChanged(cb) { queueMicrotask(() => cb(this.currentUser)); return () => {}; }, signOut: async () => {} };
  window.firebase = { auth: () => auth, firestore: () => ({ collection: (name) => new Collection(name) }) };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const errors = [];
  const external = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) { external.push(url.origin); return route.abort(); }
    if (url.pathname === '/js/firebase-config.js') return route.fulfill({ contentType: 'application/javascript', body: `(${fakeFirebase.toString()})(${JSON.stringify(fixture)});` });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  const go = async (url) => { await page.goto(`${base}/${url}`); await page.waitForLoadState('networkidle'); };
  const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Nessun overflow orizzontale');
  try {
    await go('index.html');
    assert.equal(await page.locator('#lista-atleti a').count(), 2);
    assert.deepEqual(await page.evaluate(() => window.__dbReads), ['atleti'], 'Home: una sola query, nessuna sessione');
    await page.screenshot({ path: `${out}/home-desktop.png`, fullPage: true });
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-backup').click();
    const download = await downloadPromise;
    await download.saveAs(`${out}/synthetic-export.local.json`);
    const backup = JSON.parse(fs.readFileSync(`${out}/synthetic-export.local.json`, 'utf8'));
    assert.equal(backup.atleti.length, 2);
    assert.equal(backup.sessioni.length, 69);
    assert.deepEqual(backup.sessioni.find(s => s.id === 'jet').datiOriginali, fixture.sessioni.jet.datiOriginali);
    assert.equal(backup.sessioni.find(s => s.id === 'jet').esercizi.proActionReaction, undefined, 'Backup grezzo non normalizzato');
    await page.locator('#ricerca').fill('Giulia');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#lista-atleti a').count(), 1);
    await page.locator('#ricerca').fill('');
    await page.waitForTimeout(200);
    await page.locator('a[href="./atleta.html?id=demo"]').click();
    await page.waitForSelector('#stat-sessioni:text("6")');
    assert.equal(await page.locator('#stat-training').innerText(), '1');
    assert.match(await page.locator('#stat-test').innerText(), /18\/08\/2026/);
    assert.match(await page.locator('#stat-ultima').innerText(), /20\/08\/2026/);
    assert.equal(await page.locator('#sessioni-recenti a').count(), 5);
    await overflow();
    await page.locator('#note-compact > summary').click();
    await page.locator('#osservazione-data').fill('2026-08-22');
    await page.locator('#osservazione-testo').fill('Osservazione sintetica di prova');
    await page.locator('#btn-aggiungi-osservazione').click();
    await page.waitForSelector('#lista-osservazioni .observation-item');
    assert.match(await page.locator('#lista-osservazioni').innerText(), /Osservazione sintetica di prova/);
    await page.screenshot({ path: `${out}/profile-desktop.png`, fullPage: true });

    await page.locator('#btn-export-pdf').click();
    await page.waitForSelector('#pdf-period-dialog[open]');
    await page.locator('#pdf-period-da').fill('2025-01-01');
    await page.locator('#pdf-period-a').fill('2026-12-31');
    assert.match(await page.locator('#pdf-period-summary').innerText(), /Test verr/);
    const pdfDownloadPromise = page.waitForEvent('download');
    await page.locator('#pdf-period-export').click();
    const pdfDownload = await pdfDownloadPromise;
    const pdfPath = `${out}/synthetic-report.pdf`;
    await pdfDownload.saveAs(pdfPath);
    const pdfBytes = fs.readFileSync(pdfPath);
    assert.ok(pdfBytes.length > 10000, 'PDF non vuoto');
    assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'PDF valido e filtrato per periodo');

    await page.locator('#link-tutte-sessioni').click();
    await page.waitForSelector('#lista-sessioni a');
    assert.equal(await page.locator('#lista-sessioni a').count(), 6);
    assert.ok(await page.locator('.history-name-group').count() >= 3);
    assert.ok(await page.locator('.duplicate-count-badge').count() >= 1);
    assert.ok(!(await page.locator('#lista-sessioni').innerText()).includes('Protocollo non riconosciuto'));
    await page.locator('#filtro-titolo').fill('Pro Action');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#lista-sessioni a').count(), 2);
    assert.ok(!(await page.locator('#lista-sessioni').innerText()).includes('0 esercizi'));
    await page.locator('#tab-training').click();
    assert.equal(await page.locator('#lista-sessioni a').count(), 1);
    assert.match(await page.locator('#lista-sessioni').innerText(), /Protocollo non riconosciuto/);
    await page.locator('#tab-test').click();
    await page.screenshot({ path: `${out}/sessions-desktop.png`, fullPage: true });

    await go('sessione.html?atletaId=demo&sessioneId=jet');
    assert.match(await page.locator('#dati-jet').innerText(), /45 s/);
    assert.match(await page.locator('#dati-jet').innerText(), /Errori/);
    await page.locator('#dati-jet summary').click();
    assert.match(await page.locator('#dati-jet pre').innerText(), /sconosciuto/);
    await page.getByRole('button', { name: 'Modifica risultati' }).click();
    assert.equal(await page.locator('#f__proActionReaction__tempoTotale').inputValue(), '45');
    assert.equal(await page.locator('#f__proActionReaction__errori').inputValue(), '0');
    await page.locator('#f__proActionReaction__tempoTotale').fill('44');
    await page.locator('#btn-salva').click();
    await page.waitForURL('**/atleta.html?id=demo');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('testvisivi-synthetic-e2e')).sessioni.jet);
    assert.deepEqual(saved.datiOriginali, fixture.sessioni.jet.datiOriginali);
    assert.equal(saved.nomeTestOriginale, fixture.sessioni.jet.nomeTestOriginale);
    assert.equal(saved.tipoTest, fixture.sessioni.jet.tipoTest);
    assert.deepEqual(saved.esercizi.testEsterno, { valore: 22 });
    assert.equal(saved.esercizi.proActionReaction.tempoTotale, 44);

    await go('sessione.html?atletaId=demo&sessioneId=legacy');
    await page.getByRole('button', { name: 'Modifica risultati' }).click();
    await page.locator('#f__vvs__gioco__primaDeviazione').fill('3');
    await page.locator('#btn-salva').click();
    await page.waitForURL('**/atleta.html?id=demo');
    const legacy = await page.evaluate(() => JSON.parse(localStorage.getItem('testvisivi-synthetic-e2e')).sessioni.legacy);
    assert.equal(legacy.esercizi.vvs.gioco.parametroEsterno, 77);
    assert.deepEqual(legacy.esercizi.campoVisivoAvanzato, fixture.sessioni.legacy.esercizi.campoVisivoAvanzato);

    await go('sessione.html?atletaId=demo&mode=test');
    assert.equal(await page.locator('#test-standard option').count(), 14);
    await page.locator('#test-standard').selectOption('proActionReaction');
    await page.locator('#f__proActionReaction__tempoTotale').fill('38');
    await page.locator('#f__proActionReaction__tempoRilascioMedio').fill('300');
    await page.locator('#f__proActionReaction__tempoClickMedio').fill('340');
    await page.locator('#f__proActionReaction__errori').fill('0');
    await page.screenshot({ path: `${out}/new-test-desktop.png`, fullPage: true });
    await page.evaluate(() => localStorage.setItem('simulate-write-error', '1'));
    await page.locator('#btn-salva').click();
    await page.waitForSelector('#errore-pagina');
    assert.equal(await page.locator('#f__proActionReaction__tempoTotale').inputValue(), '38');
    assert.equal(await page.locator('#btn-salva').isEnabled(), true);
    await page.evaluate(() => localStorage.removeItem('simulate-write-error'));
    await page.locator('#btn-salva').click();
    await page.waitForURL('**/atleta.html?id=demo');
    const added = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('testvisivi-synthetic-e2e')).sessioni).filter(s => s.createdAt));
    assert.equal(added.length, 1);
    assert.equal(added[0].testStandard, 'proActionReaction');
    assert.equal(added[0].esercizi.proActionReaction.errori, 0);

    await go('grafici.html?id=demo');
    await page.locator('#filtro-test-grafici').selectOption('proActionReaction');
    const datasets = await page.evaluate(() => Object.values(Chart.instances).map(c => c.data.datasets).flat());
    assert.ok(datasets.some(d => JSON.stringify(d.data) === '[350,320,300]'), 'Grafico contiene storico e nuovo test');
    assert.ok(datasets.some(d => JSON.stringify(d.data) === '[44,40,38]'));
    await page.screenshot({ path: `${out}/charts-desktop.png`, fullPage: true });
    await overflow();

    await go('radar.html?id=demo');
    assert.equal(await page.locator('#anno-radar').count(), 0);
    assert.equal(await page.locator('#periodo-a-da').count(), 0);
    assert.equal(await page.locator('#periodo-b-da').count(), 0);
    const radarLabels = await page.evaluate(() => Object.values(Chart.instances).flatMap((chart) => chart.config.type === 'radar' ? chart.data.labels : []));
    assert.ok(radarLabels.some((label) => String(label).startsWith('Pro Action / Reaction · ')));
    assert.ok(radarLabels.some((label) => String(label).startsWith('Memoria · ')));
    const radarNames = radarLabels.map((label) => String(label).split(' · ')[0]);
    assert.ok(radarNames.every((name) => [
      'Attenzione separata',
      'Localizzazione spaziale',
      'Memoria',
      'Velocità e precisione in affollamento',
      'Pro Action / Reaction',
    ].includes(name)));
    assert.ok(radarNames.length <= 5);
    assert.match(await page.locator('.radar-score-pill').first().innerText(), /^\d+\/100$/);
    assert.ok(await page.locator('#radar-canvas').isVisible());
    assert.ok(await page.locator('.radar-test-summary-item').count() >= 2);
    await page.screenshot({ path: `${out}/radar-desktop.png`, fullPage: true });
    await overflow();

    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [name, url] of [['home', 'index.html'], ['profile', 'atleta.html?id=demo'], ['sessions', 'sessioni.html?atletaId=demo&type=test'], ['test', 'sessione.html?atletaId=demo&sessioneId=jet'], ['charts', 'grafici.html?id=demo'], ['radar', 'radar.html?id=demo']]) {
        await go(url);
        if (name === 'charts') await page.locator('#filtro-test-grafici').selectOption('proActionReaction');
        await overflow();
        await page.screenshot({ path: `${out}/${name}-mobile-${theme}.png`, fullPage: true });
      }
    }
    assert.deepEqual(errors, [], 'Console e runtime senza errori');
    assert.deepEqual(external, [], 'Nessuna richiesta esterna');
    const result = { ok: true, fixture: 'sintetica, Firebase sostituito; nessuna verifica dati reali', checks: ['home una query', 'backup JSON grezzo', 'ricerca', 'profilo senza dati clinici', 'PDF valido', 'storico raggruppato per nome e doppi accorpati', 'solo sessioni con risultati reali', 'modifica conservativa e custom', 'nuovo test', 'errore salvataggio recuperabile', 'grafici storico + nuovo', 'radar per singolo test', 'diario osservazioni', 'Test e Training separati', 'mobile chiaro/scuro', 'console senza errori'], errors, external };
    fs.writeFileSync(`${out}/browser-results.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
