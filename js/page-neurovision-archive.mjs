import {nvPrepareManualImport} from './neurovision-archive.mjs';
import {historyGroups,historyCompare} from './neurovision-history.mjs';
const $=id=>document.getElementById(id);
let generation=0,uid=null,athleteId=null,stopAuth=null,selected=null,history=[];
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
function reset(){generation++;selected=null;$('nv-confirm-athlete').checked=false;$('nv-add-history').disabled=true;$('nv-file').value='';$('nv-review').hidden=true;$('nv-metrics').replaceChildren();$('nv-title').textContent='';$('nv-date').textContent='';$('nv-counts').textContent='';$('nv-protocol').textContent='';$('nv-status').textContent=''}
function clearPrivate(){reset();clearHistory();$('nv-athlete').textContent='';$('nv-root').hidden=true;uid=null;athleteId=null}
function metric(label,v){const cell=document.createElement('div'),title=document.createElement('span'),value=document.createElement('strong');title.textContent=label;value.textContent=v;cell.append(title,value);return cell}
const fmt=(v,unit,digits=1)=>v===null?'Non disponibile':v.toFixed(digits)+' '+unit;
async function review(){
 selected=null;$('nv-confirm-athlete').checked=false;$('nv-add-history').disabled=true;
 const file=$('nv-file').files?.[0],ticket=++generation;$('nv-review').hidden=true;$('nv-status').textContent='';$('nv-metrics').replaceChildren();if(!file)return;
 if(file.size>2*1024*1024){$('nv-status').textContent='File troppo grande (massimo 2 MB).';return}
 try{
 const raw=JSON.parse(await file.text()),prepared=await nvPrepareManualImport(raw,athleteId,digest);if(ticket!==generation||!uid||firebase.auth().currentUser?.uid!==uid)return;
 const d=prepared.document,m=d.metrics,t=d.trials;
 $('nv-title').textContent='SEQ-01 · '+(d.mode==='test'?'Test':'Training');
 $('nv-date').textContent=new Date(d.completedAt).toLocaleString('it-IT');
 $('nv-metrics').append(metric('Accuratezza',fmt(m.accuracyPercent,'%')),metric('Mediana RT corrette',fmt(m.medianCorrectMs,'ms',0)),metric('JND',fmt(m.jndDegrees,'°',2)),metric('PSE',fmt(m.pseDegrees,'°',2)));
 $('nv-counts').textContent=t.completed+' prove completate · '+t.scored+' valutabili · '+t.correct+' corrette.';
 $('nv-protocol').textContent='Dispositivo non documentato · Protocollo v'+d.protocol.version+' · '+d.protocol.exposure+' ms · '+d.protocol.spatialFrequency+' cicli/grado · distanza '+d.protocol.distance+' cm.';
 $('nv-status').textContent='Formato e conteggi verificati. Associazione proposta all’atleta selezionato, non ancora salvata.';
 selected=prepared;$('nv-review').hidden=false;
 }catch(e){if(ticket===generation)$('nv-status').textContent='Importazione non valida: '+(e instanceof SyntaxError?'JSON non leggibile.':e.message)}
}
function node(tag,value){const el=document.createElement(tag);el.textContent=value;return el}
function clearHistory(){history=[];$('nv-history').replaceChildren();$('nv-history-status').textContent=''}
function renderHistory(groups){
 const root=$('nv-history');root.replaceChildren();
 for(const group of groups){
 const section=document.createElement('section'),title=node('h3',group.exerciseId+' · '+(group.mode==='test'?'Test':'Training')+' · '+group.rows.length+' sessioni');
 section.append(title,node('p','Dispositivo non documentato · Protocollo v'+group.protocol.version+' · '+group.completedTrials+' prove · '+group.protocol.distance+' cm · '+group.protocol.exposure+' ms'));
 const scroll=document.createElement('div');scroll.style.overflowX='auto';const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr');
 for(const label of ['Data','Accuratezza','Mediana RT','JND','PSE']){const th=node('th',label);th.scope='col';header.append(th)}head.append(header);table.append(head);
 const body=document.createElement('tbody');
 for(const r of group.rows){const tr=document.createElement('tr');for(const v of [new Date(r.completedAt).toLocaleString('it-IT'),fmt(r.metrics.accuracyPercent,'%'),fmt(r.metrics.medianCorrectMs,'ms',0),fmt(r.metrics.jndDegrees,'°',2),fmt(r.metrics.pseDegrees,'°',2)])tr.append(node('td',v));body.append(tr)}table.append(body);scroll.append(table);section.append(scroll);
 const change=historyCompare(group);if(change){const signed=(v,unit)=>v===null?'n.d.':(v>0?'+':'')+v+' '+unit;section.append(node('p','Variazione descrittiva prima–ultima: accuratezza '+signed(change.accuracyPercentagePoints,'p.p.')+' · RT '+signed(change.medianCorrectMs,'ms')+' · JND '+signed(change.jndDegrees,'°')+'.'))}
 else section.append(node('p',group.mode==='training'?'Training: risultati riportati senza confronto psicometrico.':'Confronto disabilitato: dispositivo e input originali non documentati.'));
 root.append(section)
 }
}
$('nv-confirm-athlete').addEventListener('change',()=>{$('nv-add-history').disabled=!selected||!$('nv-confirm-athlete').checked});
$('nv-add-history').addEventListener('click',()=>{
 if(!selected||!$('nv-confirm-athlete').checked||!uid||firebase.auth().currentUser?.uid!==uid)return;
 try{const candidate=[...history,selected],groups=historyGroups(candidate,athleteId);const duplicate=history.some(p=>p.documentId===selected.documentId);if(!duplicate)history=candidate;renderHistory(groups);$('nv-history-status').textContent=duplicate?'Sessione già presente nel confronto.':history.length+' sessioni nel confronto locale.';}catch(e){$('nv-history-status').textContent=e.message}
});
$('nv-clear-history').addEventListener('click',clearHistory);
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
