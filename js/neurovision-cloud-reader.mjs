// Authenticated browser read adapter for the future cloud archive.
// Disabled by default; enable ONLY after target rules and privacy/retention review.
// No write, cache persistence, anonymous queries, or cross-owner query.
import {projectArchive} from './neurovision-projected-archive.mjs';
const id=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(x))throw Error('Identificativo non valido');return x};
export function createCloudArchiveReader({db,auth,enabled=false}){
 if(enabled!==true||!db||!auth)throw Error('Archivio cloud non abilitato');
 return Object.freeze({async load(athleteId){
 id(athleteId);const ownerId=id(auth.currentUser?.uid);
 const verify=()=>{if(auth.currentUser?.uid!==ownerId)throw Error('Account cambiato durante la lettura')};
 const root=db.collection('users').doc(ownerId);
 const athlete=await root.collection('atleti').doc(athleteId).get({source:'server'});verify();
 if(!athlete.exists)throw Error('Persona non disponibile');
 const snap=await root.collection('neurovisionCurrent').where('atletaId','==',athleteId).limit(5001).get({source:'server'});verify();
 if(snap.metadata?.fromCache===true||snap.metadata?.hasPendingWrites===true)throw Error('Lettura cloud non confermata');
 if(snap.docs.length>5000)throw Error('Archivio esteso: paginazione necessaria, nessun risultato parziale mostrato');
 const docs=snap.docs.map(d=>d.data());
 const archive=projectArchive(docs,athleteId);verify();return archive;
 }});
}
