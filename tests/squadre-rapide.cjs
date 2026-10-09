const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { parseHTML } = require(process.env.DOM_PATH || 'linkedom');
const { document, window } = parseHTML(fs.readFileSync(__dirname + '/../index.html', 'utf8'));
const qs = (s) => document.querySelector(s);
for (const select of document.querySelectorAll('select')) {
  Object.defineProperty(select, 'value', { writable: true, value: '' });
}
const writes = [];
let fail = false;
const c = vm.createContext({ document, window, console, setTimeout, URL, Blob,
  registerServiceWorker() {}, richiedeLogin: async () => null,
  normalizzaAnagraficaCalciatore: a => a, nomeCompleto: a => a.nome + ' ' + a.cognome,
  dbAssegnaSquadraAtleta: async (id, squadraId) => { if (fail && id === 'b') throw Error('offline'); writes.push({ id, squadraId }); },
});
vm.runInContext(fs.readFileSync(__dirname + '/../js/utils.js', 'utf8').split('function getQueryParam')[0] +
  fs.readFileSync(__dirname + '/../js/utils.js', 'utf8').split('/** Crea un elemento')[1].split('function formatDataIt')[0].replace(/^[\s\S]*?function el/, 'function el'), c);
vm.runInContext(fs.readFileSync(__dirname + '/../js/page-home.js', 'utf8'), c);
vm.runInContext("_atleti = [{id:'a',nome:'Anna',cognome:'Uno',squadraId:''},{id:'b',nome:'Bruno',cognome:'Due',squadraId:'s'}]; _squadreHome=[{id:'s',nome:'Squadra prova'}]; aggiornaSquadreHome(); renderHome();", c);
const click = id => qs('#' + id).click();
const tick = () => new Promise(r => setImmediate(r));
(async () => {
  assert.equal(qs('#lista-atleti').children.length, 2);
  click('organizza-squadre');
  assert.equal(qs('#lista-atleti input').checked, false);
  click('seleziona-visibili');
  assert.match(qs('#selezione-conteggio').textContent, /2/);
  qs('#filtro-squadra').value = '__nessuna__';
  qs('#filtro-squadra').dispatchEvent(new window.Event('change'));
  assert.equal(qs('#lista-atleti').children.length, 1);
  assert.match(qs('#selezione-conteggio').textContent, /0/);
  qs('#filtro-squadra').value = '';
  qs('#filtro-squadra').dispatchEvent(new window.Event('change'));
  click('seleziona-visibili');
  qs('#squadra-destinazione').value = 's';
  qs('#squadra-destinazione').dispatchEvent(new window.Event('change'));
  fail = true; click('assegna-giocatori'); await tick();
  assert.deepEqual(writes, [{id:'a',squadraId:'s'}]);
  assert.match(qs('#selezione-conteggio').textContent, /1/);
  fail = false; click('assegna-giocatori'); await tick();
  assert.equal(writes.length, 2);
  assert.match(qs('#selezione-conteggio').textContent, /0/);
  assert.equal(qs('#assegna-squadre').disabled, false);
  console.log('OK: filtro squadra, selezione visibili, reset filtro, assegnazione e ripresa dopo errore parziale.');
})().catch(e => { console.error(e); process.exitCode=1; });
