'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
for (const f of ['esercizi-config.js', 'jet-normalizer.js', 'radar-config.js'])
  vm.runInContext(fs.readFileSync(__dirname + '/../js/' + f, 'utf8'), context);
const evaluate = expr => JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', context));

test('jetNumero accepts one-element numeric arrays, not raw measurement sequences', () => {
  assert.equal(evaluate("jetNumero(['0.55'])"), 0.55);
  assert.equal(evaluate("jetNumero(['0,55'])"), 0.55);
  assert.equal(evaluate("jetNumero([0])"), 0);
  assert.equal(evaluate("jetNumero(['0.50','0.60'])"), null);
  assert.equal(evaluate("jetNumero([])"), null);
  assert.equal(evaluate("jetNumero(['NULL'])"), null);
});

const metrics = [
  ['PAT', {'Tempo di reazione medio':['0.55'], 'Immagini al secondo':['1.5']}],
  ['RT', {'Tempo di rilascio medio':['0.31'], 'Tempo di click medio':['0.34']}],
  ['DAS', {'Immagini al secondo':['1.2'], 'Tempo di reazione medio':['0.56']}],
  ['CIRCULAR', {'Tempo totale':['25.82'], 'Click errati':['2']}],
  ['MAM', {'Livello massimo completato':['9'], Errori:['3']}],
];
function sample(athlete, useFlat) {
  return metrics.map(([protocol, results], j) => {
    const values = Object.fromEntries(Object.entries(results).map(([k, arr]) => [
      k, arr.map(v => String(Number(v) + athlete * 0.01)),
    ]));
    return {
      id: athlete + '-' + j, atletaId: String(athlete), data:'2026-09-23',
      jetProgramNomeOriginale: 'xS/' + protocol + '/60s/TEST', modalita:'test',
      ...(useFlat ? {datiOriginali: values} :
        {esercizi:{jetProgramOriginale:{risultatiOriginali:values}}}),
    };
  });
}
test('all historical Test profiles with single-value Jet arrays get a data-driven radar', () => {
  const all = [sample(0,false),sample(1,true),sample(2,false),sample(3,true)].flat();
  const before = JSON.stringify(all);
  context.all = all;
  for (let i=0; i<4; i++) {
    context.playerId = String(i);
    const radar = evaluate('radarDatiSintesi(all.filter(s => s.atletaId === playerId), all)');
    assert.equal(radar.righe.length, 5, 'all five historical protocols must be scored');
    assert.ok(radar.righe.every(r => Number.isInteger(r.valore) && r.valore >= 0 && r.valore <= 100));
  }
  assert.equal(JSON.stringify(all),before,'original Firestore data must not be mutated');
});
