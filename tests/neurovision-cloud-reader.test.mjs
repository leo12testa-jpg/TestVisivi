import test from 'node:test';import assert from 'node:assert/strict';import {createCloudArchiveReader} from '../js/neurovision-cloud-reader.mjs';
function fixture({exists=true,docs=[],metadata={},onQuery=()=>{}}={}){
 const auth={currentUser:{uid:'owner'}},calls=[];
 const db={collection(name){calls.push(name);return {doc(uid){calls.push(uid);return {collection(c){calls.push(c);return {doc(id){calls.push(id);return {async get(options){assert.equal(options.source,'server');return {exists}}}},where(field,op,value){calls.push([field,op,value]);return {limit(n){assert.equal(n,5001);return {async get(options){assert.equal(options.source,'server');onQuery(auth);return {docs:docs.map(d=>({data:()=>d})),metadata}}}}}}}}}}}}};
 return {db,auth,calls};
}
test('disabled by default and anonymous access refused',async()=>{let f=fixture();assert.throws(()=>createCloudArchiveReader(f));f.auth.currentUser=null;await assert.rejects(createCloudArchiveReader({...f,enabled:true}).load('person'));assert.equal(f.calls.length,0)});
test('query only authenticated owner and explicit athlete, server read',async()=>{let f=fixture();let r=await createCloudArchiveReader({...f,enabled:true}).load('person');assert.equal(r.groups.length,0);assert.deepEqual(f.calls,['users','owner','atleti','person','neurovisionCurrent',['atletaId','==','person']])});
test('unknown person, account change and cache are rejected',async()=>{for(const opts of [{exists:false},{onQuery:a=>a.currentUser={uid:'other'}},{metadata:{fromCache:true}},{metadata:{hasPendingWrites:true}}]){let f=fixture(opts);await assert.rejects(createCloudArchiveReader({...f,enabled:true}).load('person'))}});
test('reject cross-person document and oversized response',async()=>{for(const docs of [[{schema:'nv.sync-event.v1',atletaId:'other'}],Array.from({length:5001},()=>({}))]){let f=fixture({docs});await assert.rejects(createCloudArchiveReader({...f,enabled:true}).load('person'))}});
