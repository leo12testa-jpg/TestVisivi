// Explicit workstation metadata; capture/verification must be supplied by trusted runtime. No fingerprinting or hardware inference.
// A browser's frame cadence is an estimate, not proof of panel refresh rate or end-to-end latency.
function nvId(v){if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v))throw Error('ID non valido');return v}

function nvExact(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw Error('Campi non consentiti');return o}

function nvNumber(v,min,max,int=false){if(!Number.isFinite(v)||v<min||v>max||(int&&!Number.isSafeInteger(v)))throw Error('Valore numerico non valido');return v}

function nvChoice(v,allowed){if(!allowed.includes(v))throw Error('Valore non riconosciuto');return v}

function nvCanonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(nvCanonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+nvCanonical(v[k])).join(',')+'}'}

function normalizeDevice(raw){
 nvExact(raw,['schema','profileId','revision','category','input','screenWidthMm','screenHeightMm','viewportWidthPx','viewportHeightPx','pixelRatio','distanceCm','frameCadenceHz','browserBuild','osBuild','calibration','timingCheck','timingEvidenceId']);
 if(raw.schema!=='nv.device.v1')throw Error('Schema dispositivo non riconosciuto');
 const category=nvChoice(raw.category,['ipad','large_touch','computer','other']),input=nvChoice(raw.input,['touch','mouse','keyboard','pen','mixed','unknown']);
 const calibration=nvChoice(raw.calibration,['confirmed','unconfirmed']),timingCheck=nvChoice(raw.timingCheck,['physical_verified','unverified']);
 const nullable=(v,min,max)=>v===null?null:nvNumber(v,min,max);
 const screenWidthMm=nullable(raw.screenWidthMm,40,3000),screenHeightMm=nullable(raw.screenHeightMm,40,3000),distanceCm=nullable(raw.distanceCm,15,300);
 if(calibration==='confirmed'&&[screenWidthMm,screenHeightMm,distanceCm].some(v=>v===null))throw Error('Calibrazione incompleta');
 const timingEvidenceId=timingCheck==='physical_verified'?nvId(raw.timingEvidenceId):null;
 if(timingCheck==='unverified'&&raw.timingEvidenceId!==null)throw Error('Evidenza temporale incoerente');
 return {schema:'nv.device.v1',profileId:nvId(raw.profileId),revision:nvNumber(raw.revision,1,100000,true),category,input,screenWidthMm,screenHeightMm,viewportWidthPx:nvNumber(raw.viewportWidthPx,1,20000,true),viewportHeightPx:nvNumber(raw.viewportHeightPx,1,20000,true),pixelRatio:nvNumber(raw.pixelRatio,.25,10),distanceCm,frameCadenceHz:nullable(raw.frameCadenceHz,1,500),browserBuild:nvId(raw.browserBuild),osBuild:nvId(raw.osBuild),calibration,timingCheck,timingEvidenceId};
}

function deviceLabel(raw){
 if(raw==null)return 'Dispositivo non documentato';
 const d=normalizeDevice(raw),names={ipad:'iPad',large_touch:'Monitor touch',computer:'Computer',other:'Altra postazione'},inputs={touch:'Touch',mouse:'Mouse',keyboard:'Tastiera',pen:'Penna',mixed:'Input misto',unknown:'Input non rilevato'};
 const inch=d.screenWidthMm&&d.screenHeightMm?Math.round(Math.hypot(d.screenWidthMm,d.screenHeightMm)/25.4):null;
 return names[d.category]+(inch?' '+inch+'″':'')+' · '+inputs[d.input];
}

function comparisonKey(result){
 if(!result||!result.device||result.mode!=='test')return null;
 const d=normalizeDevice(result.device);
 if(d.calibration!=='confirmed'||d.timingCheck!=='physical_verified'||d.frameCadenceHz===null||['mixed','unknown'].includes(d.input))return null;
 if(typeof result.protocolHash!=='string'||!/^[a-f0-9]{64}$/.test(result.protocolHash))return null;
 return nvCanonical({exerciseId:nvId(result.exerciseId),protocolVersion:nvId(result.protocolVersion),protocolHash:result.protocolHash,device:d,mode:'test'});
}

function canCompare(a,b){const x=comparisonKey(a),y=comparisonKey(b);return x!==null&&x===y}
export {normalizeDevice,deviceLabel,comparisonKey,canCompare};
