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

test('Jet non mappato con risultati originali reali resta visibile senza inventare uno standard', () => {
  context.input = { nomeTestOriginale: 'Sconosciuto', datiOriginali: { valore: 'originale' } };
  assert.equal(run('sessioneHaRisultatiVisibili(input)'), true);
  assert.equal(run('nomeTestSessione(input)'), 'Sconosciuto');
  assert.match(run('riepilogoSessione(input)'), /Valore: originale/);
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


test('blocchi test vuoti vengono eliminati, zero e dati extra di test compilati restano', () => {
  context.input = {
    esercizi: {
      localizzazioneSpaziale: { tempoReazioneMedio: '', errori: null },
      proActionReaction: { tempoTotale: 0, errori: 0, parametroStorico: 77 },
      vvs: { gioco: { primaDeviazione: 2, parametroEsterno: 99 } },
      jetProgramOriginale: { nomeTestOriginale: 'legacy' },
    },
  };
  const result = run('pulisciEserciziSessione(input)');
  assert.equal(result.esercizi.localizzazioneSpaziale, undefined);
  assert.equal(result.esercizi.proActionReaction.tempoTotale, 0);
  assert.equal(result.esercizi.proActionReaction.parametroStorico, 77);
  assert.equal(result.esercizi.vvs.gioco.parametroEsterno, 99);
  assert.equal(result.esercizi.jetProgramOriginale.nomeTestOriginale, 'legacy');
  assert.equal(run('sessioneHaRisultatiVisibili(input)'), true);
});

test('stringhe vuote o spazi non rendono un test compilato', () => {
  context.input = { esercizi: { velocitaRiconoscimento: { tempoTotale: '   ', quantitaNumeri: '' } } };
  assert.equal(run('sessioneHaRisultatiVisibili(input)'), false);
});


test('classifica i report Jet x come test e tutti gli altri come training', () => {
  context.input = {
    jetProgramReportId: 1,
    jetProgramNomeOriginale: 'xS/PAT/60s/120spot/5cm/0,7s/Fix',
    esercizi: { jetProgramOriginale: { nomeTestOriginale: 'xS/PAT/60s/120spot/5cm/0,7s/Fix' } },
    modalita: 'training',
  };
  assert.equal(run('modalitaSessioneEffettiva(input)'), 'test');

  context.input = {
    jetProgramReportId: 2,
    jetProgramNomeOriginale: '5E training di equilibrio 360°',
    esercizi: { jetProgramOriginale: { nomeTestOriginale: '5E training di equilibrio 360°' } },
    modalita: 'test',
  };
  assert.equal(run('modalitaSessioneEffettiva(input)'), 'training');

  context.input = { modalita: 'training', esercizi: { proActionReaction: { errori: 0 } } };
  assert.equal(run('modalitaSessioneEffettiva(input)'), 'training');
});

test('risultati originali Jet reali rendono visibile la sessione anche senza mapping standard', () => {
  context.input = {
    jetProgramNomeOriginale: '5E training',
    esercizi: {
      jetProgramOriginale: {
        nomeTestOriginale: '5E training',
        risultatiOriginali: { Errori: ['0'], 'Tempo totale': ['47.11'] },
      },
    },
  };
  assert.equal(run('jetOriginaleHaRisultatiReali(input)'), true);
  assert.equal(run('sessioneHaRisultatiVisibili(input)'), true);
  assert.match(run('riepilogoSessione(input)'), /Errori: 0/);
});


test('usa i nomi standard nello storico Test e Training quando il test è riconosciuto', () => {
  context.input = {
    jetProgramReportId: 1,
    jetProgramStandardKey: 'localizzazioneSpaziale',
    jetProgramNomeOriginale: 'xS/PAT/60s/120spot/5cm/0,7s/Fix',
    esercizi: {
      localizzazioneSpaziale: { tempoReazioneMedio: 500 },
      jetProgramOriginale: { nomeTestOriginale: 'xS/PAT/60s/120spot/5cm/0,7s/Fix', risultatiOriginali: { Errori: ['0'] } },
    },
  };
  assert.equal(run('nomeStoricoSessione(input)'), 'Localizzazione spaziale');

  context.input = {
    jetProgramReportId: 2,
    jetProgramNomeOriginale: 'PAT/60s/spot5cm/0,7s/LargeScreen',
    esercizi: { jetProgramOriginale: { nomeTestOriginale: 'PAT/60s/spot5cm/0,7s/LargeScreen', risultatiOriginali: { Errori: ['0'] } } },
  };
  assert.equal(run('nomeStoricoSessione(input)'), 'Localizzazione spaziale');
});


test('VPB e MAM non mappati mostrano comunque Pedana 360 e Memoria', () => {
  context.input = {
    jetProgramReportId: 10,
    jetProgramNomeOriginale: 'xS/VPB/60s/120spot/5cm/0,9s/Pedana_J3/Fix',
    esercizi: { jetProgramOriginale: { nomeTestOriginale: 'xS/VPB/60s/120spot/5cm/0,9s/Pedana_J3/Fix', risultatiOriginali: { Errori: ['2'] } } },
  };
  assert.equal(run('nomeStoricoSessione(input)'), 'Pedana 360');

  context.input = {
    jetProgramReportId: 11,
    jetProgramNomeOriginale: 'xS/MAM/7x12/Spot5cm/1,5s',
    esercizi: { jetProgramOriginale: { nomeTestOriginale: 'xS/MAM/7x12/Spot5cm/1,5s', risultatiOriginali: { Errori: ['1'] } } },
  };
  assert.equal(run('nomeStoricoSessione(input)'), 'Memoria');
});


test('FTT e BSF usano nomi standard e le metriche tecniche non invadono il layout', () => {
  context.input = {
    jetProgramNomeOriginale: 'FTT/C-number/tot.9/6cm/LargeSceen',
    esercizi: { jetProgramOriginale: { nomeTestOriginale: 'FTT/C-number/tot.9/6cm/LargeSceen', risultatiOriginali: {
      'Tempo totale': ['8.38'],
      'ArrayPunti': Array.from({ length: 20 }, (_, i) => String(i)),
      'Con pedana': ['True']
    } } }
  };
  assert.equal(run('nomeStoricoSessione(input)'), 'Visualizzazione traiettorie');
  assert.deepEqual(run('metricheOriginaliJet(input).map(x => x.label)'), ['Tempo totale']);

  context.input = {
    jetProgramNomeOriginale: 'BSF/VISION/1Letter_3cm/Obliques_h10-4',
    esercizi: { jetProgramOriginale: { nomeTestOriginale: 'BSF/VISION/1Letter_3cm/Obliques_h10-4', risultatiOriginali: {
      'Tempo totale': ['93.77'],
      'Metronomo': ['66']
    } } }
  };
  assert.equal(run('nomeStoricoSessione(input)'), 'Localizzazione in affollamento oculare');
});


test('formatta i decimali senza arrotondare e mostra i millisecondi come secondi', () => {
  context.campoMs = { tipo: 'number', unit: 'ms', label: 'Tempo' };
  context.campoS = { tipo: 'number', unit: 's', label: 'Tempo totale' };
  assert.equal(run('formattaValoreCampo(campoMs, 350.1234)'), '0,3501234 s');
  assert.equal(run('formattaValoreCampo(campoS, 47.123456)'), '47,123456 s');
  assert.equal(run('valoreVisualeCampo(campoMs, 350.1234)'), '0.3501234');
  assert.equal(run('valoreInputInterno(campoMs, "0.3501234")'), 350.1234);
});


test('training accidentali: solo vuoti o durata totale fino a 5 secondi', () => {
  context.input = {
    modalita: 'training',
    esercizi: { proActionReaction: { tempoTotale: 4, errori: 0 } },
  };
  assert.equal(run('durataSessioneSecondi(input)'), 4);
  assert.equal(run('trainingAccidentale(input, 5)'), true);

  context.input = {
    modalita: 'training',
    esercizi: { proActionReaction: { tempoTotale: 30, errori: 1 } },
  };
  assert.equal(run('trainingAccidentale(input, 5)'), false);

  context.input = {
    modalita: 'test',
    esercizi: { proActionReaction: { tempoTotale: 2, errori: 0 } },
  };
  assert.equal(run('trainingAccidentale(input, 5)'), false);

  context.input = {
    nomeTestOriginale: 'Allenamento libero',
    datiOriginali: { 'Tempo totale (ms)': 3500, errori: 0 },
  };
  assert.equal(run('modalitaSessioneEffettiva(input)'), 'training');
  assert.equal(run('durataSessioneSecondi(input)'), 3.5);
  assert.equal(run('trainingAccidentale(input, 5)'), true);
});
