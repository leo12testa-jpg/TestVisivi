import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nvNormalizeSequential,nvPrepareManualImport,nvCanonical,nvCreateOrCompare,nvFirestoreAdapter} from '../js/neurovision-archive.mjs';
const date='2026-11-26T14:00:00.000Z';
const raw={started:date,completed:date,config:{source:'10.1371/journal.pone.0289590',mode:'train',version:1,distance:60,pxmm:4,exposure:500,mask:1000,pause:500,sigmaRadiusRatio:.42,spatialFrequency:1.5,contrast:1,eccentricity:7.5,diameter:5,count:10},rows:Array.from({length:10},()=>({delta:12,variableFirst:false,angles:[45,57],choice:2,correct:true,rtMs:420,practice:false}))};
const digest=async s=>createHash('sha256').update(s).digest('hex');
test('training counts, accuracy, median response and no JND',()=>{let x=nvNormalizeSequential(raw);assert.equal(x.metrics.accuracyPercent,100);assert.equal(x.metrics.medianCorrectMs,420);assert.equal(x.metrics.jndDegrees,null)});
test('incomplete and inconsistent records rejected',()=>{assert.throws(()=>nvNormalizeSequential({...raw,rows:raw.rows.slice(1)}));assert.throws(()=>nvNormalizeSequential({...raw,rows:raw.rows.map(r=>({...r,correct:false}))}))});
test('cloud writer fails closed by default',()=>assert.throws(()=>nvFirestoreAdapter({},{},"uid")));
test('only whitelisted fields retained, deterministic ID scoped to file session not selected athlete',async()=>{let a=await nvPrepareManualImport({...raw,name:'synthetic'},'athlete-a',digest),b=await nvPrepareManualImport(raw,'athlete-b',digest);assert.equal(a.documentId,b.documentId);assert.equal('name' in a.document,false);assert.equal('fingerprintInput' in a.document,false)});
test('exact retry idempotent and cross-athlete reassignment conflicting (mock transaction)',async()=>{const store=new Map(),adapter={async createOrCompare(p){let s=nvCanonical(p.document);if(store.has(p.documentId)){if(store.get(p.documentId)!==s)throw Error('conflict');return 'already_exists'}store.set(p.documentId,s);return 'created'}};let a=await nvPrepareManualImport(raw,'athlete-a',digest),b=await nvPrepareManualImport(raw,'athlete-b',digest);assert.equal(await nvCreateOrCompare(a,adapter),'created');assert.equal(await nvCreateOrCompare(a,adapter),'already_exists');await assert.rejects(nvCreateOrCompare(b,adapter));assert.equal(store.size,1)});
test('standard test counts equal trials separately and excludes practice',()=>{let rows=Array.from({length:11},(_,i)=>(i-5)*3).flatMap(delta=>Array.from({length:10},()=>({delta,variableFirst:false,angles:[45,45+delta],choice:2,correct:delta===0?null:delta>0,rtMs:420,practice:false})));let r=nvNormalizeSequential({...raw,config:{...raw.config,mode:'test',count:165},rows:[...rows.slice(0,55).map(x=>({...x,practice:true})),...rows],model:{jnd:4,mu:0}});assert.equal(r.trials.completed,110);assert.equal(r.trials.scored,100);assert.equal(r.metrics.accuracyPercent,50);assert.equal(r.metrics.jndDegrees,4)});

test('SEQ-01 device metadata is retained but manual files cannot certify timing',()=>{
 const device={schema:'nv.device.v1',profileId:'synthetic-55',revision:1,category:'large_touch',input:'touch',screenWidthMm:1218,screenHeightMm:685,viewportWidthPx:1920,viewportHeightPx:1080,pixelRatio:1,distanceCm:60,frameCadenceHz:60,browserBuild:'chromium-test',osBuild:'windows-test',calibration:'confirmed',timingCheck:'physical_verified',timingEvidenceId:'synthetic-evidence'};
 const imported={...raw,sessionId:'seq_synthetic',device,deviceQuality:{geometryChanged:false,visibilityInterrupted:false,acceptedResponses:10,unrecognizedResponses:0}};
 const r=nvNormalizeSequential(imported);assert.equal(r.device.input,'touch');assert.equal(r.device.timingCheck,'unverified');assert.equal(r.sourceSessionId,'seq_synthetic');assert.equal(nvNormalizeSequential(raw).device,null);
 assert.throws(()=>nvNormalizeSequential({...imported,device:{...device,distanceCm:65}}));
 assert.throws(()=>nvNormalizeSequential({...imported,deviceQuality:{...imported.deviceQuality,acceptedResponses:9}}));
});
