// Local preview grouping only: inputs must be prepared by nvPrepareManualImport; identical recorded settings do not prove physical equivalence.
function historyCanonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(historyCanonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+historyCanonical(v[k])).join(',')+'}'}

function historyGroups(items,athleteId){
 if(!Array.isArray(items)||items.length>100)throw Error('Massimo 100 sessioni');
 const seen=new Map(),groups=new Map();
 for(const p of items){
 const d=p?.document;if(!d||d.atletaId!==athleteId||d.schema!=='nv.manual-review.v1'||d.source!=='neurovision'||d.validation!=='experimental'||d.provenance!=='operator_import_unverified'||!['test','training'].includes(d.mode)||!/^manual_[a-f0-9]{64}$/.test(p.documentId)||p.documentId!=='manual_'+d.sessionFingerprint)throw Error('Sessione o atleta non compatibile');
 if(seen.has(p.documentId)){if(historyCanonical(seen.get(p.documentId))!==historyCanonical(d))throw Error('Conflitto tra file della stessa sessione');continue}
 seen.set(p.documentId,d);
 const key=historyCanonical({exercise:d.exerciseId,mode:d.mode,protocol:d.protocol,trials:d.trials.completed,provenance:d.provenance});
 if(!groups.has(key))groups.set(key,{exerciseId:d.exerciseId,mode:d.mode,protocol:d.protocol,completedTrials:d.trials.completed,deviceLabel:'Dispositivo non documentato',rows:[]});
 groups.get(key).rows.push({id:p.documentId,completedAt:d.completedAt,metrics:d.metrics,trials:d.trials});
 }
 return [...groups.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.id.localeCompare(b.id))}));
}

function historyCompare(g){
 // Historical manual JSON does not contain a verified workstation snapshot. Never compare it automatically.
 return null;
 /* Future comparisons use the new device-aware projection read model. */

}
export {historyGroups,historyCompare};
