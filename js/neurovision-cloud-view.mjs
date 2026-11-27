// Pure DOM renderer, no network requests and no HTML interpolation.
export function renderCloudArchive(root,archive,doc=document){
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=String(text);return n};
 const label={not_reviewed:'Da rivedere',maintain:'Mantenimento',train:'Allenamento prioritario',reassess:'Rivalutazione'};
 const fmt=(v,u,d=1)=>Number.isFinite(v)?v.toFixed(d)+' '+u:'n.d.';
 const count=archive.groups.reduce((n,g)=>n+g.rows.length,0);
 root.replaceChildren(el('p',count+' sessioni valide · '+archive.profiles.length+' profili · '+archive.plans.length+' programmi · '+archive.voided.length+' sessioni annullate'));
 for(const mode of ['test','training']){
 const section=el('section');section.append(el('h3',mode==='test'?'Test standardizzati':'Training'));
 const groups=archive.groups.filter(g=>g.mode===mode);
 if(!groups.length)section.append(el('p','Nessuna sessione.'));
 for(const g of groups){
 const block=el('section');block.append(el('h4',g.exerciseId+' · '+g.deviceLabel));
 block.append(el('p',g.comparisonAllowed?'Postazione e protocollo registrati compatibili; confronto descrittivo, non validazione clinica.':'Nessun confronto automatico: training o condizioni non documentate/verificate.'));
 const scroll=el('div');scroll.style.overflowX='auto';const table=el('table'),head=el('thead'),header=el('tr');
 for(const k of ['Data','Protocollo / revisione','Postazione','Accuratezza','RT mediana','JND','Prove']){const th=el('th',k);th.scope='col';header.append(th)}head.append(header);table.append(head);
 const body=el('tbody');
 for(const r of g.rows){
 const row=el('tr'),m=r.metrics??{},t=r.trials??{},d=r.device;
 for(const v of [new Date(r.completedAt).toLocaleString('it-IT'),r.protocolVersion+' / r'+r.revision,d.profileId+' / r'+d.revision,fmt(m.accuracyPercent,'%'),fmt(m.medianCorrectMs,'ms',0),fmt(m.jndDegrees,'°',2),t.completed??'n.d.'])row.append(el('td',v));body.append(row);
 }
 table.append(body);scroll.append(table);block.append(scroll);section.append(block);
 }
 root.append(section);
 }
 const profiles=el('section');profiles.append(el('h3','Profilazioni'));
 for(const p of archive.profiles){
 const row=el('div'),stale=archive.staleProfiles.some(x=>x.sourceOwnerId===p.sourceOwnerId&&x.id===p.id);
 row.append(el('h4',p.id+' · revisione '+p.revision),el('p',stale?'Da riesaminare: un risultato di riferimento è cambiato.':p.reviewState==='reviewed'?'Revisionato dal professionista':p.reviewState==='withdrawn'?'Ritirato':'Bozza'));
 const list=el('ul');for(const a of p.areas??[])list.append(el('li',a.skillId+' · '+(label[a.priority]??'Da rivedere')+' · sessione r'+a.sessionRevision));row.append(list);profiles.append(row);
 }
 if(!archive.profiles.length)profiles.append(el('p','Nessun profilo.'));root.append(profiles);
 const plans=el('section');plans.append(el('h3','Programmi di allenamento'));
 const status={draft:'Bozza',assigned:'Assegnato',paused:'In pausa',completed:'Completato',cancelled:'Annullato'};
 for(const p of archive.plans){
 const row=el('div'),stale=archive.stalePlans.some(x=>x.sourceOwnerId===p.sourceOwnerId&&x.id===p.id);
 row.append(el('h4',p.id+' · revisione '+p.revision),el('p',(status[p.status]??'Stato non riconosciuto')+(stale?' · Da riesaminare: profilo di riferimento non aggiornato.':'')));
 const list=el('ul');for(const i of p.items??[])list.append(el('li',i.skillId+' · '+i.exerciseId+' · '+i.durationSeconds+' s · protocollo '+i.protocolVersion));row.append(list);plans.append(row);
 }
 if(!archive.plans.length)plans.append(el('p','Nessun programma.'));root.append(plans);
 if(archive.voided.length){const section=el('section');section.append(el('h3','Sessioni annullate (escluse dalle valutazioni)'));for(const r of archive.voided)section.append(el('p',r.exerciseId+' · '+r.deviceLabel+' · r'+r.revision+' · '+r.reasonCode));root.append(section)}
}
