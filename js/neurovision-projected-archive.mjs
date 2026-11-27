// Read model for current projections from a FUTURE authenticated, owner-scoped bridge.
// Never accept untrusted uploaded JSON as an authenticated projection. No Firestore queries here.
import {normalizeDevice,deviceLabel,comparisonKey} from './neurovision-device.mjs';

export function projectArchive(documents,athleteId){
 if(!Array.isArray(documents)||documents.length>5000||typeof athleteId!=='string'||!athleteId)throw Error('Archivio non valido');
 const sessions=[],profiles=[],plans=[],voided=[],seen=new Set();
 for(const d of documents){
 if(!d||d.schema!=='nv.sync-event.v1'||d.atletaId!==athleteId||typeof d.sourceOwnerId!=='string'||typeof d.aggregateId!=='string'||!Number.isSafeInteger(d.revision)||d.revision<1)throw Error('Proiezione non autorizzata o non valida');
 const key=JSON.stringify([d.sourceOwnerId,d.kind,d.aggregateId]);if(seen.has(key))throw Error('Proiezione duplicata');seen.add(key);
 if(d.kind==='session'){
 const p=d.payload,r=p?.result;if(!r||r.source!=='neurovision'||r.schema!=='nv.result.v1'||r.sessionId!==d.aggregateId||!['test','training'].includes(r.mode)||!['completed','voided'].includes(p.state))throw Error('Sessione non valida');
 const device=normalizeDevice(p.device),row={...r,device,deviceLabel:deviceLabel(device),sourceOwnerId:d.sourceOwnerId,revision:d.revision};
 if(p.state==='voided'){voided.push({...row,reasonCode:p.reasonCode});continue}sessions.push(row);
 }else if(d.kind==='profile'){profiles.push({id:d.aggregateId,sourceOwnerId:d.sourceOwnerId,revision:d.revision,...d.payload})}
 else if(d.kind==='training_plan'){plans.push({id:d.aggregateId,sourceOwnerId:d.sourceOwnerId,revision:d.revision,...d.payload})}
 else throw Error('Tipo proiezione sconosciuto');
 }
 const groups=new Map();
 for(const r of sessions){
 const comparable=comparisonKey(r),k=JSON.stringify([r.sourceOwnerId,r.mode,r.exerciseId,comparable??['not-comparable',r.sessionId]]);
 if(!groups.has(k))groups.set(k,{mode:r.mode,exerciseId:r.exerciseId,deviceLabel:r.deviceLabel,comparisonAllowed:comparable!==null,rows:[]});
 groups.get(k).rows.push(r);
 }
 for(const g of groups.values())g.rows.sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.sessionId.localeCompare(b.sessionId));
 const staleProfiles=profiles.filter(p=>p.areas.some(a=>!sessions.some(s=>s.sourceOwnerId===p.sourceOwnerId&&s.sessionId===a.sessionId&&s.revision===a.sessionRevision&&s.mode==='test'))).map(p=>({sourceOwnerId:p.sourceOwnerId,id:p.id}));
 const stalePlans=plans.filter(p=>!profiles.some(pr=>pr.sourceOwnerId===p.sourceOwnerId&&pr.id===p.profileId&&pr.revision===p.profileRevision&&pr.reviewState==='reviewed'&&!staleProfiles.some(x=>x.sourceOwnerId===pr.sourceOwnerId&&x.id===pr.id))).map(p=>({sourceOwnerId:p.sourceOwnerId,id:p.id}));
 return {groups:[...groups.values()],profiles,plans,voided,staleProfiles,stalePlans};
}
