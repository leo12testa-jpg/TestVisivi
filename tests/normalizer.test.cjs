const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
for (const file of ['esercizi-config.js', 'jet-normalizer.js']) vm.runInContext(fs.readFileSync(`${__dirname}/../js/${file}`, 'utf8'), context);
const run = (source) => JSON.parse(vm.runInContext(`JSON.stringify(${source})`, context));

test('13 standard distinti e chiavi legacy conservate', () => {
  const keys = run('TEST_STANDARD.map(t => t.key)');
  assert.equal(new Set(keys).size, 13);
  assert.equal(run('getEsercizioConfig("vvs").sottoCondizioni.length'), 3);
  assert.equal(run('getEsercizioConfig("movimentiOculari").standard'), false);
});

test('conversione decimali, zero e unità esplicite; nessuna mutazione', () => {
  const raw = { nomeTestOriginale: 'Pro Action and Reaction Time', tipoTest: 'proActionReaction', datiOriginali: { 'Tempo totale (ms)': '2500', 'Tempo di rilascio medio (s)': '0,32', errori: 0, nonInterpretato: [1, 2] } };
  context.input = structuredClone(raw);
  const result = run('normalizzaSessioneJet(input)');
  assert.deepEqual(result.esercizi.proActionReaction, { tempoTotale: 2.5, tempoRilascioMedio: 320, errori: 0 });
  assert.deepEqual(run('input'), raw);
  assert.deepEqual(result.datiOriginali, raw.datiOriginali);
  assert.deepEqual(run('normalizzaSessioneJet(normalizzaSessioneJet(input))'), result);
});

test('campi già salvati, sconosciuti e originali preservati', () => {
  context.input = { nomeTestOriginale: 'Memorizzazione sequenze spaziali 7x12', datiOriginali: { errori: 4, livelloMassimo: 7 }, esercizi: { memorizzazioneSequenze: { errori: 0, extra: 'resta' }, customEsterno: { payload: [1] } } };
  const result = run('normalizzaSessioneJet(input)');
  assert.equal(result.esercizi.memorizzazioneSequenze.errori, 0);
  assert.equal(result.esercizi.memorizzazioneSequenze.extra, 'resta');
  assert.deepEqual(result.esercizi.customEsterno, { payload: [1] });
});

test('nessun valore inventato per unità, nomi o strutture ambigui', () => {
  for (const raw of [
    { nomeTestOriginale: 'Test non noto', datiOriginali: { errori: 2 } },
    { nomeTestOriginale: 'Pro Action and Reaction Time', tipoTest: 'pedana360', datiOriginali: { errori: 2 } },
    { nomeTestOriginale: 'Pro Action and Reaction Time', datiOriginali: { tempoTotale: 5, tempoReazioneMedio: 400, 'Tempo totale': 5, prove: [{ errori: 2 }], errori: true, percentualeSuccesso: 150, livelloMassimo: '12abc', nTarget: '1.200,0' } },
    { nomeTestOriginale: 'Pro Action and Reaction Time', datiOriginali: { 'Tempo totale (s)': 5, 'Tempo totale (ms)': 6000 } },
  ]) {
    context.input = raw;
    assert.deepEqual(run('normalizzaSessioneJet(input)'), raw);
  }
});

test('Jet non mappato visibile nello storico senza zero esercizi', () => {
  context.input = { nomeTestOriginale: 'Sconosciuto', datiOriginali: { valore: 'originale' } };
  assert.match(run('riepilogoSessione(input)'), /Dati originali Jet Program disponibili/);
  assert.equal(run('nomeTestSessione(input)'), 'Sconosciuto');
});

test('ogni test standard condivide lo schema tra import e form', () => {
  for (const key of run('TEST_STANDARD_KEYS')) {
    context.input = { testStandard: key, datiOriginali: { errori: 0, 'Tempo totale (s)': 10 } };
    assert.equal(run('normalizzaSessioneJet(input)').esercizi[key].tempoTotale, 10);
  }
});


test('tempi legacy in secondi convertiti in ms solo in memoria', () => {
  context.input = {
    data: '2019-07-09',
    esercizi: {
      localizzazioneSpaziale: { tempoReazioneMedio: 0.46, immaginiColpite: 78 },
      proActionReaction: { tempoRilascioMedio: 0.33, tempoClickMedio: 0.36, tempoTotale: 59.8 },
    },
  };
  const result = run('normalizzaSessioneLegacy(input)');
  assert.equal(result.esercizi.localizzazioneSpaziale.tempoReazioneMedio, 460);
  assert.equal(result.esercizi.proActionReaction.tempoRilascioMedio, 330);
  assert.equal(result.esercizi.proActionReaction.tempoClickMedio, 360);
  assert.equal(run('input.esercizi.localizzazioneSpaziale.tempoReazioneMedio'), 0.46);
});

test('sessioni senza alcun test sono riconosciute come vuote', () => {
  context.input = { esercizi: {}, titolo: '' };
  assert.equal(run('sessioneHaDatiTest(input)'), false);
  context.input = { esercizi: { jetProgramOriginale: { nomeTestOriginale: 'legacy' } } };
  assert.equal(run('sessioneHaDatiTest(input)'), true);
  context.input = { nomeTestOriginale: 'Jet legacy', datiOriginali: { valore: 1 }, esercizi: {} };
  assert.equal(run('sessioneHaDatiTest(input)'), true);
});
