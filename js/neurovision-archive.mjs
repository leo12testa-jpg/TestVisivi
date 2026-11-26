function nvObject(v,label){if(!v||typeof v!=='object'||Array.isArray(v))throw Error(label+' non valido');return v}

function nvNum(v,min,max,label,integer=false){if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isSafeInteger(v)))throw Error(label+' non valido');return v}

function nvInstant(v){if(typeof v!=='string'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)throw Error('Data UTC non valida');return v}

function nvKey(v){if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v))throw Error('Identificativo non valido');return v}

function nvCanonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(nvCanonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+nvCanonical(v[k])).join(',')+'}'}

function nvMedian(a){if(!a.length)return null;const t=[...a].sort((a,b)=>a-b),i=Math.floor(t.length/2);return t.length%2?t[i]:(t[i-1]+t[i])/2}

function nvNormalizeSequential(raw){
 nvObject(raw,'Sessione');const c=nvObject(raw.config,'Configurazione');if(c.source!=='10.1371/journal.pone.0289590'||!['test','train'].includes(c.mode)||!Array.isArray(raw.rows)||!raw.rows.length||raw.rows.length>200)throw Error('Formato SEQ-01 non supportato');
 const test=c.mode==='test',mode=test?'test':'training',completedAt=nvInstant(raw.completed),startedAt=nvInstant(raw.started);if(Date.parse(startedAt)>Date.parse(completedAt))throw Error('Cronologia non valida');
 const config={version:nvNum(c.version,1,1,'versione',true),distance:nvNum(c.distance,25,150,'distanza'),pxmm:nvNum(c.pxmm,.1,100,'scala'),exposure:nvNum(c.exposure,100,1000,'stimolo'),mask:nvNum(c.mask,1,10000,'maschera'),pause:nvNum(c.pause,0,10000,'pausa'),sigmaRadiusRatio:nvNum(c.sigmaRadiusRatio,.001,10,'sigma'),spatialFrequency:nvNum(c.spatialFrequency,.01,100,'frequenza'),contrast:nvNum(c.contrast,0,1,'contrasto'),eccentricity:nvNum(c.eccentricity,0,90,'eccentricità'),diameter:nvNum(c.diameter,.01,90,'diametro')};
 if(test&&(config.exposure!==500||config.mask!==1000||config.pause!==500||config.spatialFrequency!==1.5||config.contrast!==1||config.eccentricity!==7.5||config.diameter!==5))throw Error('Configurazione Test standard non riconosciuta');
 const rows=raw.rows.map((r,i)=>{
 nvObject(r,'Prova');if(typeof r.practice!=='boolean'||typeof r.variableFirst!=='boolean'||![1,2].includes(r.choice)||!Array.isArray(r.angles)||r.angles.length!==2)throw Error('Prova '+(i+1)+' non valida');
 const delta=nvNum(r.delta,-15,15,'delta');if(r.angles[r.variableFirst?0:1]!==45+delta||r.angles[r.variableFirst?1:0]!==45)throw Error('Angoli incoerenti');
 const expected=delta===0?null:(r.angles[0]>r.angles[1]?1:2),correct=expected===null?null:expected===r.choice;if(r.correct!==correct)throw Error('Scoring incoerente');
 return {delta,variableFirst:r.variableFirst,choice:r.choice,correct,rtMs:nvNum(r.rtMs,0,600000,'RT'),practice:r.practice};
 });
 const scored=rows.filter(r=>!r.practice),practice=rows.length-scored.length;
 if(test){if(practice!==55||scored.length!==110)throw Error('Test incompleto');for(let d=-15;d<=15;d+=3)if(scored.filter(r=>r.delta===d).length!==10)throw Error('Distribuzione Test incoerente')}
 else if(practice!==0||scored.length!==c.count||scored.length<10||scored.some(r=>r.delta===0))throw Error('Training incompleto');
 const valid=scored.filter(r=>r.correct!==null),hits=valid.filter(r=>r.correct),jnd=test&&raw.model?nvNum(raw.model.jnd,.000001,180,'JND'):null,pse=test&&raw.model?nvNum(raw.model.mu,-180,180,'PSE'):null;
 return {schema:'nv.manual-review.v1',source:'neurovision',exerciseId:'gabor-sequential',mode,startedAt,completedAt,validation:'experimental',provenance:'operator_import_unverified',protocol:config,trials:{completed:scored.length,scored:valid.length,correct:hits.length,timeouts:0},metrics:{accuracyPercent:valid.length?Math.round(hits.length/valid.length*10000)/100:null,medianCorrectMs:nvMedian(hits.map(r=>r.rtMs)),jndDegrees:jnd,pseDegrees:pse},fingerprintInput:{startedAt,completedAt,mode,config,rows}};
}

async function nvPrepareManualImport(raw,athleteId,digest){
 const r=nvNormalizeSequential(raw),id=nvKey(athleteId);if(typeof digest!=='function')throw Error('Digest mancante');
 const hash=await digest(nvCanonical(r.fingerprintInput));if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Hash non valido');const {fingerprintInput,...summary}=r;
 return {documentId:'manual_'+hash,document:{...summary,atletaId:id,sessionFingerprint:hash}};
}

async function nvCreateOrCompare(p,adapter){
 nvObject(p,'Import');nvKey(p.documentId);nvKey(p.document.atletaId);
 if(!adapter||typeof adapter.createOrCompare!=='function')throw Error('Archivio non abilitato');
 const status=await adapter.createOrCompare(p);if(!['created','already_exists'].includes(status))throw Error('Salvataggio non confermato');return status;
}

function nvFirestoreAdapter(db,auth,expectedUid,enabled=false){
 if(!enabled)throw Error('Scrittura NeuroVision disabilitata fino al collaudo delle regole');
 nvKey(expectedUid);
 return {async createOrCompare(p){
 if(auth.currentUser?.uid!==expectedUid)throw Error('Account cambiato');
 const owner=db.collection('users').doc(expectedUid),athlete=owner.collection('atleti').doc(nvKey(p.document.atletaId)),target=owner.collection('neurovisionResults').doc(nvKey(p.documentId));
 return db.runTransaction(async tx=>{if(auth.currentUser?.uid!==expectedUid)throw Error('Account cambiato');const a=await tx.get(athlete),old=await tx.get(target);if(!a.exists)throw Error('Atleta non trovato');if(old.exists){if(nvCanonical(old.data())!==nvCanonical(p.document))throw Error('Conflitto: sessione già presente con contenuto o atleta diverso');return 'already_exists'}tx.set(target,p.document);return 'created'});
 }};
}

export {nvCanonical,nvNormalizeSequential,nvPrepareManualImport,nvCreateOrCompare,nvFirestoreAdapter};
