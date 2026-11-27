import test from 'node:test';
import assert from 'node:assert/strict';
import {historyGroups,historyCompare} from '../js/neurovision-history.mjs';
const a={schema:'nv.manual-review.v1',source:'neurovision',exerciseId:'gabor-sequential',mode:'test',validation:'experimental',provenance:'operator_import_unverified',protocol:{version:1,distance:60},trials:{completed:110},atletaId:'athlete',metrics:{accuracyPercent:70,medianCorrectMs:400,jndDegrees:5,pseDegrees:null},completedAt:'2026-11-26T14:00:00.000Z'};
function p(d,letter){return {documentId:'manual_'+letter.repeat(64),document:{...d,sessionFingerprint:letter.repeat(64)}}}
const one=p(a,'a'),two=p({...a,completedAt:'2026-12-01T14:00:00.000Z',metrics:{...a.metrics,accuracyPercent:80,jndDegrees:4}},'b');
test('exact duplicates removed and chronological order restored',()=>{let g=historyGroups([two,one,one],'athlete');assert.equal(g.length,1);assert.equal(g[0].rows.length,2);assert.equal(g[0].rows[0].id,one.documentId)});
test('legacy imports without device metadata never generate retest differences',()=>{assert.equal(historyCompare(historyGroups([one,two],'athlete')[0]),null)});
test('different configuration or training are separate groups',()=>{assert.equal(historyGroups([one,p({...a,protocol:{version:1,distance:70}},'c')],'athlete').length,2);assert.equal(historyGroups([one,p({...a,mode:'training'},'c')],'athlete').length,2);assert.equal(historyCompare({...historyGroups([one,two],'athlete')[0],mode:'training'}),null)});
test('wrong athlete and conflicting duplicate refused',()=>{assert.throws(()=>historyGroups([one],'other'));assert.throws(()=>historyGroups([one,{...one,document:{...one.document,metrics:{...a.metrics,accuracyPercent:99}}}],'athlete'))});
