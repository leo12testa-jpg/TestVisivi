import {nvPrepareManualImport} from './neurovision-archive.mjs';
const $=id=>document.getElementById(id);
let generation=0,uid=null,athleteId=null,stopAuth=null;
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
function reset(){generation++;$('nv-file').value='';$('nv-review').hidden=true;$('nv-metrics').replaceChildren();$('nv-title').textContent='';$('nv-date').textContent='';$('nv-counts').textContent='';$('nv-protocol').textContent='';$('nv-status').textContent=''}
function clearPrivate(){reset();$('nv-athlete').textContent='';$('nv-root').hidden=true;uid=null;athleteId=null}
function metric(label,v){const cell=document.createElement('div'),title=document.createElement('span'),value=document.createElement('strong');title.textContent=label;value.textContent=v;cell.append(title,value);return cell}
const fmt=(v,unit,digits=1)=>v===null?'Non disponibile':v.toFixed(digits)+' '+unit;
async function review(){
 const file=$('nv-file').files?.[0],ticket=++generation;$('nv-review').hidden=true;$('nv-status').textContent='';$('nv-metrics').replaceChildren();if(!file)return;
 if(file.size>2*1024*1024){$('nv-status').textContent='File troppo grande (massimo 2 MB).';return}
 try{
 const raw=JSON.parse(await file.text()),prepared=await nvPrepareManualImport(raw,athleteId,digest);if(ticket!==generation||!uid||firebase.auth().currentUser?.uid!==uid)return;
 const d=prepared.document,m=d.metrics,t=d.trials;
 $('nv-title').textContent='SEQ-01 · '+(d.mode==='test'?'Test':'Training');
 $('nv-date').textContent=new Date(d.completedAt).toLocaleString('it-IT');
 $('nv-metrics').append(metric('Accuratezza',fmt(m.accuracyPercent,'%')),metric('Mediana RT corrette',fmt(m.medianCorrectMs,'ms',0)),metric('JND',fmt(m.jndDegrees,'°',2)),metric('PSE',fmt(m.pseDegrees,'°',2)));
 $('nv-counts').textContent=t.completed+' prove completate · '+t.scored+' valutabili · '+t.correct+' corrette.';
 $('nv-protocol').textContent='Protocollo v'+d.protocol.version+' · '+d.protocol.exposure+' ms · '+d.protocol.spatialFrequency+' cicli/grado · distanza '+d.protocol.distance+' cm.';
 $('nv-status').textContent='Formato e conteggi verificati. Associazione proposta all’atleta selezionato, non ancora salvata.';
 $('nv-review').hidden=false;
 }catch(e){if(ticket===generation)$('nv-status').textContent='Importazione non valida: '+(e instanceof SyntaxError?'JSON non leggibile.':e.message)}
}
$('nv-file').addEventListener('change',review);$('nv-clear').addEventListener('click',reset);
async function init(){
 try{
 const user=await richiedeLogin();if(!user)return;uid=user.uid;
 stopAuth=firebase.auth().onAuthStateChanged(u=>{if(!u||u.uid!==uid){clearPrivate();location.replace('./login.html')}});
 const id=new URLSearchParams(location.search).get('id');if(!id||!/^[-_A-Za-z0-9]{1,128}$/.test(id))throw Error('Atleta non valido.');
 const athlete=await dbGetAtleta(id);if(firebase.auth().currentUser?.uid!==uid||!uid)return;if(!athlete)throw Error('Atleta non disponibile per questo account.');athleteId=id;
 $('nv-back').href='./atleta.html?id='+encodeURIComponent(id);$('nv-athlete').textContent=[athlete.nome,athlete.cognome].filter(Boolean).join(' ');$('nv-root').hidden=false;
 }catch(e){clearPrivate();$('nv-fatal').textContent='Archivio non disponibile: '+e.message}
}
window.addEventListener('pagehide',()=>{clearPrivate();stopAuth?.()});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
init();
