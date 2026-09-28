/* Analisi locale di un export, esclusivamente in lettura. Nessuna credenziale/API. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = process.argv[2];
if (!filename) { console.error('Uso: node scripts/audit-jet.cjs <export-json>'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
const sessions = Array.isArray(data) ? data : data.sessioni;
if (!Array.isArray(sessions)) throw new Error('Atteso un export TestVisivi con array sessioni. Nessun file modificato.');
const context = vm.createContext({});
for (const file of ['esercizi-config.js', 'jet-normalizer.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
context.sessions = sessions;
const report = vm.runInContext(`(() => {
  const report = { sessioni: sessions.length, jet: 0, testRiconosciuti: 0, sessioniConNuoviValori: 0, senzaCampiCanonici: 0, gruppi: {} };
  for (const session of sessions) {
    if (!haDatiJet(session)) continue;
    report.jet++;
    const test = jetTest(session);
    if (test) report.testRiconosciuti++;
    const converted = normalizzaSessioneJet(session);
    if (converted !== session) report.sessioniConNuoviValori++;
    if (!contaEserciziCompilati(converted)) report.senzaCampiCanonici++;
    const key = test?.key || 'non-riconosciuto';
    const group = report.gruppi[key] ||= { sessioni: 0, campiOriginali: [] };
    group.sessioni++;
    if (session.datiOriginali && typeof session.datiOriginali === 'object') {
      for (const field of Object.keys(session.datiOriginali)) if (!group.campiOriginali.includes(field)) group.campiOriginali.push(field);
    }
  }
  return report;
})()`, context);
console.log(JSON.stringify(report, null, 2));
