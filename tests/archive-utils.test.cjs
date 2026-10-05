const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({
  console,
  normalizzaAnagraficaCalciatore(atleta) {
    const cognome = String(atleta.cognome || '').toLowerCase();
    if (cognome === 'skovolsen') return { ...atleta, nome: 'Andreas', cognome: 'Skov Olsen' };
    if (cognome === 'amondarain') return { ...atleta, nome: 'Mikel', cognome: 'Amondarain' };
    if (cognome === 'alhassane' || cognome === 'alhassane bonkano') return { ...atleta, nome: 'Rahim', cognome: 'Alhassane' };
    return atleta;
  },
  chiaveNome(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  },
});
vm.runInContext(fs.readFileSync(__dirname + '/../js/archive-utils.js', 'utf8'), context);

function run(source) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${source})`, context));
}

test('individua doppioni dopo normalizzazione e sceglie il profilo con più sessioni', () => {
  context.atleti = [
    { id: 'a', nome: 'andreas ', cognome: 'skovolsen', altezza: 180 },
    { id: 'b', nome: 'Andreas', cognome: 'Skov Olsen', squadraId: 'team' },
    { id: 'c', nome: 'Altro', cognome: 'Atleta' },
  ];
  context.counts = { a: 55, b: 4, c: 2 };
  const gruppi = run('archivioTrovaDoppioniAtleti(atleti, counts)');
  assert.equal(gruppi.length, 1);
  assert.equal(gruppi[0].principale.id, 'a');
  assert.equal(gruppi[0].duplicati[0].id, 'b');
  assert.equal(gruppi[0].sessioniTotali, 59);
});

test('unione completa campi vuoti senza sovrascrivere dati esistenti', () => {
  context.a = { id: 'a', nome: 'Andreas', cognome: 'Skov Olsen', altezza: 180, squadraId: '', note: 'prima', datiClinici: { acuitaVisiva: { od: '11/10', os: '' } } };
  context.b = { id: 'b', nome: 'Andreas', cognome: 'Skov Olsen', altezza: 190, squadraId: 'team', note: 'seconda', datiClinici: { acuitaVisiva: { od: '10/10', os: '12/10' } } };
  const unito = run('archivioUnisciProfiloAtleta(a, b)');
  assert.equal(unito.altezza, 180);
  assert.equal(unito.squadraId, 'team');
  assert.equal(unito.datiClinici.acuitaVisiva.od, '11/10');
  assert.equal(unito.datiClinici.acuitaVisiva.os, '12/10');
  assert.equal(unito.note, 'prima · seconda');
  assert.deepEqual(unito.mergedFromAthleteIds, ['b']);
  assert.equal(unito.mergeStorico[0].sourceAthleteId, 'b');
});


test('non unisce omonimi incompatibili o date di nascita diverse', () => {
  context.atleti = [
    { id: 'a', nome: 'Mario', cognome: 'Rossi', dataNascita: '2000-01-01' },
    { id: 'b', nome: 'Marco', cognome: 'Rossi', dataNascita: '2001-01-01' },
  ];
  context.counts = { a: 2, b: 3 };
  assert.equal(run('archivioTrovaDoppioniAtleti(atleti, counts)').length, 0);
});


test('riconosce anche profilo con nome vuoto come duplicato dello stesso atleta', () => {
  context.atleti = [
    { id: 'a', nome: 'mikel', cognome: 'amondarain', dataNascita: '2005-01-06' },
    { id: 'b', nome: '', cognome: 'Amondarain', dataNascita: '' },
  ];
  context.counts = { a: 6, b: 0 };
  const gruppi = run('archivioTrovaDoppioniAtleti(atleti, counts)');
  assert.equal(gruppi.length, 1);
  assert.equal(gruppi[0].principale.id, 'a');
});


test('unione conserva osservazioni distinte dei profili duplicati', () => {
  context.a = { id: 'a', nome: 'Mario', cognome: 'Rossi', osservazioni: [{ id: 'o1', data: '2026-01-01', testo: 'prima' }] };
  context.b = { id: 'b', nome: 'Mario', cognome: 'Rossi', osservazioni: [{ id: 'o2', data: '2026-02-01', testo: 'seconda' }] };
  const unito = run('archivioUnisciProfiloAtleta(a, b)');
  assert.equal(unito.osservazioni.length, 2);
  assert.deepEqual(unito.osservazioni.map(x => x.id), ['o1', 'o2']);
});
