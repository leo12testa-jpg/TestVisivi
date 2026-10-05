const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({});
for (const file of ['esercizi-config.js', 'jet-normalizer.js']) {
  vm.runInContext(fs.readFileSync(`${__dirname}/../js/${file}`, 'utf8'), context);
}
const run = (source) => JSON.parse(vm.runInContext(`JSON.stringify(${source})`, context));

test('le 13 chiavi standard coincidono con quelle Firestore reali', () => {
  assert.deepEqual(run('TEST_STANDARD_KEYS'), [
    'localizzazioneSpaziale',
    'pedana360',
    'proActionReaction',
    'attenzioneSeparata',
    'velocitaPrecisioneAffollamento',
    'velocitaRiconoscimento',
    'percezioneCampoVisivo',
    'localizzazioneAffollamentoOculare',
    'memorizzazioneSequenze',
    'ordinamentoStrategico',
    'visualizzazioneTraiettorie',
    'riconoscimentoNumeri',
    'reazioneVisuoMotoriaSceltaMultipla',
  ]);
});

test('una sessione Jet reale usa la chiave standard già salvata', () => {
  context.input = {
    jetProgramStandardKey: 'reazioneVisuoMotoriaSceltaMultipla',
    jetProgramNomeOriginale: 'legacy/name',
    jetProgramReportId: 123,
    esercizi: {
      reazioneVisuoMotoriaSceltaMultipla: {
        tempoTotale: 60,
        tempoReazioneMedio: 510,
        errori: 2,
      },
      jetProgramOriginale: {
        nomeTestOriginale: 'legacy/name',
        tipoTest: 'legacy',
        risultatiOriginali: { 'Tempo di reazione medio': ['0.51'] },
      },
    },
  };
  assert.equal(run('jetTest(input).key'), 'reazioneVisuoMotoriaSceltaMultipla');
  assert.equal(run('nomeTestSessione(input)'), 'Reazione visuo-motoria veloce con elevata concentrazione in scelta multipla');
  assert.match(run('riepilogoSessione(input)'), /510 ms/);
});

test('un Jet non standardizzato conserva il nome originale', () => {
  context.input = {
    jetProgramNomeOriginale: 'TEST/ORIGINALE',
    jetProgramReportId: 456,
    esercizi: {
      jetProgramOriginale: {
        nomeTestOriginale: 'TEST/ORIGINALE',
        risultatiOriginali: { Valore: ['1'] },
      },
    },
  };
  assert.equal(run('nomeTestSessione(input)'), 'TEST/ORIGINALE');
  assert.match(run('riepilogoSessione(input)'), /Jet Program/);
});


test('regola reale x Test e altri Training', () => {
  context.input = {
    jetProgramNomeOriginale: 'xS/PAT/60s/120spot/5cm/0,7s/Fix',
    jetProgramReportId: 1,
    esercizi: { jetProgramOriginale: { nomeTestOriginale: 'xS/PAT/60s/120spot/5cm/0,7s/Fix' } },
    modalita: 'training',
  };
  assert.equal(run('modalitaSessioneEffettiva(input)'), 'test');

  context.input = {
    jetProgramNomeOriginale: '5E training di equilibrio 360°',
    jetProgramReportId: 2,
    esercizi: {
      jetProgramOriginale: {
        nomeTestOriginale: '5E training di equilibrio 360°',
        risultatiOriginali: { 'Tempo totale': ['47.11'], Errori: ['0'] },
      },
    },
    modalita: 'test',
  };
  assert.equal(run('modalitaSessioneEffettiva(input)'), 'training');
  assert.equal(run('sessioneHaRisultatiVisibili(input)'), true);
});
