// PDF sintetico: nessuna connessione al database. Richiede @napi-rs/canvas (o CANVAS_PATH).
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const root=require('path').resolve(__dirname, '..');
const {createCanvas}=require(process.env.CANVAS_PATH || '@napi-rs/canvas');
const Chart=require(root+'/vendor/chart.umd.js');
const jspdf=require(root+'/vendor/jspdf.umd.min.js');
const charts=[];
const ctx=vm.createContext({window:{jspdf},console,Blob,Chart,
getComputedStyle:()=>({getPropertyValue:(v)=>v.includes('series')?'#245e96':'#63707d'}),
document:{documentElement:{}},formatDataIt:s=>s.split('-').reverse().join('/'),
oggiIso:()=> '2026-10-09',nomeCompleto:a=>a.nome+' '+a.cognome});
for(const f of ['esercizi-config','jet-normalizer','charts','pdf-export']) vm.runInContext(fs.readFileSync(root+'/js/'+f+'.js','utf8'),ctx);
ctx.renderChartOffscreen=async(config,w,h)=>{
 charts.push(config.type);
 const canvas=createCanvas(w,h);
 config.options={...config.options,responsive:false,animation:false};
 const chart=new Chart(canvas,config); const data=canvas.toDataURL('image/png');chart.destroy(); return data;
};
ctx.selections=[
{atleta:{nome:'Andrea',cognome:'Esempio'},sessioni:[
{data:'2026-08-05',modalita:'test',esercizi:{proActionReaction:{tempoTotale:37.71,tempoRilascioMedio:310,errori:0},jetProgramOriginale:{nomeTestOriginale:'x/Pro Action and Reaction Time',risultatiOriginali:{'Parametro aggiuntivo':['17']}}}},
{data:'2026-08-06',modalita:'test',esercizi:{proActionReaction:{tempoTotale:36.5,tempoRilascioMedio:300,errori:1}}},
{data:'2026-08-05',modalita:'test',esercizi:{campoVisivoAvanzato:{durataSecondi:60,percentualiSettori:[{settore:1,fasciaAngoli:'5-10',percentualeCorretta:90}]}}}
]},
{atleta:{nome:'Giulia',cognome:'Secondo giocatore'},sessioni:[{data:'2026-08-05',modalita:'test',esercizi:{proActionReaction:{tempoTotale:40,tempoClickMedio:340,errori:0}}}]}];
(async()=>{
const result=await vm.runInContext("esportaReportMultiploPdf(selections,{automatico:true,periodoDa:'2026-08-01',periodoA:'2026-08-31',scarica:false})",ctx);
fs.mkdirSync(root+'/reports',{recursive:true});
fs.writeFileSync(root+'/reports/qa-multiplo.pdf',Buffer.from(await result.blob.arrayBuffer()));
assert(charts.includes('bar'));assert(charts.includes('line'));
assert.equal(charts.filter(t=>t==='bar').length,3);
assert.equal(charts.filter(t=>t==='line').length,3);
console.log(JSON.stringify({pages:result.pagine,charts}));
})().catch(e=>{console.error(e);process.exit(1)});
