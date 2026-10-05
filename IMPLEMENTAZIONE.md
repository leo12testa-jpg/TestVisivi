# TestVisivi — verifica locale del 28 settembre 2026

## Stato dopo la validazione reale

Implementati catalogo dei 13 test, normalizzazione conservativa in lettura,
form condivisi, storico con risultati e dettaglio originale, grafici, layout
responsive chiaro/scuro, ottimizzazione home e cache PWA v37.

Il 28/09/2026 è stato analizzato l'export Firestore reale:
139 atleti, 8.622 sessioni totali, di cui 8.544 Jet Program.
Tutte le sessioni Jet conservano i dati originali; 3.314 hanno già risultati
standard associati a uno dei 13 test e 5.230 restano consultabili come originali
non standardizzati. La validazione completa e i conteggi sono in
`VALIDAZIONE_DATI_REALI.md`.

Le chiavi dei 13 test sono state riallineate alle chiavi realmente presenti nel
Firestore. Non è necessaria una nuova migrazione massiva per leggere le 3.314
sessioni già standardizzate.

## Protezione dei dati

- Copia integrale iniziale, inclusi Git, modifiche locali e JSON ignorato:
  `C:\Users\Leonardo\TestVisivi-backup-20260928-204424`.
- Commit delle sei modifiche locali preesistenti: `4545639`.
- Nessuna migrazione eseguita, nessuna scrittura o cancellazione nel Firestore reale.
- Nessun push.
- L'adattatore produce un oggetto in memoria: i documenti non vengono riscritti
  quando si consultano home, profilo, storico o grafici.
- Il salvataggio esplicito di una sessione conserva `nomeTestOriginale`, `tipoTest`,
  `datiOriginali`, esercizi custom, campi sconosciuti e sotto-condizioni legacy.
  I campi lasciati vuoti in modifica non cancellano risultati già esistenti.
- I risultati numerici già presenti hanno precedenza sulla conversione.
- L'esportazione dalla home legge i documenti grezzi senza normalizzarli.
  Non include foto/video: questi restano nell'IndexedDB del dispositivo.
- Il backup iniziale del repository non costituisce un backup del Firestore remoto.

## Regole di conversione attuali

`js/jet-normalizer.js` riconosce i nomi standard e le relative chiavi esatte,
normalizzando accenti, maiuscole e punteggiatura. Due identificazioni standard
discordanti bloccano la conversione. I test legacy rimangono distinti.

Si associano soltanto proprietà dirette di `datiOriginali`, con chiavi canoniche
non temporali o etichette inequivoche. Per i tempi è richiesta un'unità esplicita
nel nome, come `Tempo totale (s)` o `Tempo reazione medio (ms)`; s/ms vengono
convertiti quando necessario. Anche `tempoTotale` senza unità resta originale.
Nessuna somma, percentuale, tempo medio o punteggio viene dedotto da altri dati.
Valori discordanti per la stessa misura non vengono convertiti. Zeri e decimali
con virgola sono gestiti; stringhe parzialmente numeriche, booleani, valori non
finiti e percentuali fuori intervallo non diventano misure numeriche.

I 13 test usano lo stesso catalogo per inserimento, lettura e grafici. I parametri
comuni sono opzionali; la disponibilità effettiva per ciascun protocollo Jet deve
ancora essere verificata sull'export reale. Le strutture originali non riconosciute
restano nel dettaglio, senza la dicitura errata «0 esercizi compilati».

## Performance e PWA

La home esegue una sola lettura della collezione atleti, senza query per gli
storici. Conteggi e ultima sessione vengono calcolati nel profilo. Lo storico
legge soltanto le sessioni dell'atleta selezionato e mostra 50 righe per volta,
con ricerca e filtri locali. È paginazione del rendering, non delle letture
Firestore: evita di escludere documenti legacy privi dei campi di ordinamento.

La cache v37 usa rete con fallback offline, include il normalizzatore e limita
la memorizzazione all'app shell. Rimuove soltanto vecchie cache `jetprogram-cache-*`;
non cancella cache di altre app, Firestore o IndexedDB.

## Verifiche eseguite

| Verifica | Esito e ambito |
| --- | --- |
| Sintassi di tutti gli script JS e `git diff --check` | Superati |
| Normalizzatore | 6 test superati, inclusi originali immutati e idempotenza |
| Login reale locale tramite agent-browser | Pagina caricata, campi visibili, nessun errore runtime rilevato |
| Home e ricerca | E2E sintetico superato; una sola query atleti |
| Backup JSON | Download verificato: originali grezzi preservati |
| Profilo | E2E sintetico superato anche senza dati clinici |
| Elenco sessioni | 69 sessioni sintetiche, 50 iniziali, espansione e filtro verificati |
| Apertura sessione | Campi numerici, zero errori e originali completi verificati |
| Modifica | Preservazione di metadati, custom e campi legacy verificata |
| Nuovo test | Salvataggio, rilettura e gestione di un errore simulato verificati |
| Grafici | Storico Jet e nuova sessione nello stesso dataset verificati |
| Mobile chiaro/scuro | Home, profilo, storico, sessione e grafici senza overflow |
| Console E2E | Nessun errore; nessuna richiesta esterna durante i test sintetici |
| PWA reale | v18 rimossa, v19 installata, cache estranea preservata, login offline caricato |
| Sessioni Firestore reali | Export reale verificato: 8.544 Jet, originali preservati, 3.314 già standardizzate |

Evidenze locali (ignorate da Git): `reports/browser-results.json`,
`reports/pwa-results.json` e screenshot desktop/mobile in `reports/`.

## Ripetere i controlli

Avviare dalla cartella del progetto:

```powershell
python -m http.server 8765 --bind 127.0.0.1
node --test tests/normalizer.test.cjs
```

I test browser richiedono Playwright e il suo Chromium. È possibile impostare
`PLAYWRIGHT_PATH` al percorso di un'installazione locale già disponibile:

```powershell
node tests/browser.cjs
node tests/pwa.cjs
```

Per l'audit reale, accedere alla home locale e usare **Esporta copia dati**.
Analizzare il file senza modificarlo:

```powershell
node scripts/audit-jet.cjs "percorso\testvisivi-backup-2026-09-28.json"
```

Lo script non usa credenziali né API: riporta conteggi, gruppi riconosciuti e
chiavi dei campi originali. Dopo l'ispezione dei campioni, aggiungere soltanto
equivalenze dimostrate e test di regressione anonimizzati. Non rilanciare le
vecchie pagine di importazione o migrazione per completare questa conversione.

## File modificati o aggiunti dopo il backup

- `.gitignore`
- `IMPLEMENTAZIONE.md` (nuovo)
- `atleta.html`
- `confronto.html`
- `css/style.css`
- `grafici.html`
- `import-anagrafiche.html` (solo caricamento normalizzatore)
- `import-storico.html` (solo caricamento normalizzatore)
- `index.html`
- `js/charts.js`
- `js/db.js`
- `js/esercizi-config.js`
- `js/jet-normalizer.js` (nuovo)
- `js/page-atleta.js`
- `js/page-elenco-sessioni.js`
- `js/page-grafici.js`
- `js/page-home.js`
- `js/page-sessione.js`
- `js/utils.js`
- `radar.html`
- `scripts/audit-jet.cjs` (nuovo)
- `sessione.html`
- `sessioni.html`
- `sw.js`
- `tests/browser.cjs` (nuovo)
- `tests/normalizer.test.cjs` (nuovo)
- `tests/pwa.cjs` (nuovo)


## Revisione leggibilità test e valori

Dopo il confronto con l'export reale, la UI dei test è stata semplificata:

- i 13 test standard hanno descrizione breve e ordine stabile;
- ogni test mostra prima solo le metriche principali;
- parametri tecnici, pedana e configurazioni sono raccolti sotto "Parametri e dettagli aggiuntivi";
- storico e profilo atleta mostrano mini-metriche già formattate con unità leggibili;
- le unità sono esplicitate: ms, s, img/s e bpm;
- i grafici usano solo i campi utili del test standard;
- i valori numerici Jet anomali vengono esclusi da riepiloghi e grafici, senza cancellarli dagli originali;
- i dati tecnici Jet Program restano disponibili in un pannello chiuso di dettaglio.

Nell'export reale risultano tre sessioni Pro Action/Reaction con medie temporali negative/anomale.
Questi valori restano conservati nei dati originali ma non vengono presentati come risultati validi.


## Stabilità operativa e PDF professionale

- Le sessioni storiche mostrano solo i test e i valori effettivamente presenti.
- I tempi legacy salvati in secondi vengono convertiti in millisecondi solo in memoria.
- Le sessioni Jet originali restano sempre nello storico anche se non standardizzate.
- La pulizia archivio scarica prima un backup JSON e rimuove soltanto le sessioni senza alcun dato test.
- I nomi atleta vengono normalizzati per maiuscole, entità HTML e refusi Bologna noti.
- Il report PDF è stato ridisegnato: copertina, KPI, anagrafica, dati clinici compilati, sezioni test, tabelle con unità, grafici, allegati, numerazione pagine e footer.
- Per evitare PDF enormi, ogni sezione riporta in tabella le ultime 12 valutazioni e nei grafici le ultime 20, indicando quante valutazioni totali sono disponibili.
- I test E2E verificano anche che il PDF generato sia un file PDF non vuoto.


## Fusione dei doppioni atleta

La voce "Sistema archivio" ora:
1. scarica un backup JSON prima di ogni modifica;
2. corregge le anagrafiche note;
3. individua solo gruppi duplicati compatibili;
4. unisce i profili scegliendo quello con più sessioni;
5. riassegna le sessioni mantenendo gli stessi id;
6. completa soltanto i campi mancanti del profilo principale;
7. conserva il profilo sorgente in `mergeStorico`;
8. elimina il documento atleta duplicato solo dopo la riassegnazione;
9. rimuove infine le sole sessioni prive di qualsiasi dato test.

Profili con nomi non vuoti incompatibili o date di nascita discordanti non vengono uniti automaticamente.


## Regola definitiva: mostrare solo test con valori reali

- Un test è considerato presente solo se almeno uno dei suoi campi configurati contiene un valore reale e valido.
- Stringhe vuote/spazi, null, valori numerici non finiti o valori negativi dove non ammessi non rendono un test compilato.
- Il valore numerico 0 resta valido e viene mostrato.
- Profilo atleta, storico, dettaglio sessione, grafici, radar, confronto e PDF ignorano i test senza risultati reali.
- Le sessioni Jet non standardizzate restano conservate nell'archivio sorgente ma non compaiono nello storico operativo.
- "Sistema archivio" rimuove fisicamente dai documenti Firestore i soli blocchi di test configurati che non contengono alcun risultato reale.
- Se un test contiene almeno un risultato reale, il blocco viene conservato integralmente per non perdere eventuali parametri storici/esterni.
- Le nuove sessioni non possono essere salvate senza almeno un risultato.


## Separazione Test / Training Jet

- Per i dati importati da Jet Program la modalità deriva dal nome originale:
  - nome che inizia con `x` o `X` = **Test**;
  - tutti gli altri nomi = **Training**.
- La regola viene applicata subito in lettura e può essere persistita con **Sistema archivio**.
- Sistema archivio usa batch Firestore per riclassificare migliaia di report senza una scrittura sequenziale per documento.
- Lo storico atleta ha due viste separate: **Test** e **Training**.
- Il profilo mostra contatori annuali per **giornate Test**, **giornate Training**, **Test diversi** e data dell'ultimo Test.
- I risultati Jet originali con valori reali restano visibili anche quando non sono ancora mappati a uno schema standard.

## Radar annuale e PDF

- Il Radar usa esclusivamente le sessioni **Test**, mai Training.
- È disponibile un selettore anno.
- Sotto il radar sono mostrati i nomi dei test e i valori reali registrati nelle diverse date dell'anno.
- Il PDF ufficiale usa esclusivamente sessioni Test per tabelle e grafici.
- Il PDF include il radar dell'ultimo anno disponibile e una tabella con aree, punteggi e soli test che hanno realmente contribuito.
- I Test Jet con valori originali ma non ancora standardizzati vengono riportati in una sezione separata del PDF; i Training restano esclusi.

## Diario osservazioni atleta

- Nel profilo atleta è presente una sezione **Note sul giocatore** con data e testo libero.
- Le osservazioni sono salvate sull'anagrafica Firestore e ordinate dalla più recente.
- Le osservazioni vengono preservate anche durante l'unione di profili duplicati.
- Le osservazioni operative non vengono inserite automaticamente nel PDF ufficiale.
