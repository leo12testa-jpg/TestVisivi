# TestVisivi — verifica locale del 28 settembre 2026

## Stato dopo la validazione reale

Implementati catalogo dei 13 test, normalizzazione conservativa in lettura,
form condivisi, storico con risultati e dettaglio originale, grafici, layout
responsive chiaro/scuro, ottimizzazione home e cache PWA v25.

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

La cache v25 usa rete con fallback offline, include il normalizzatore e limita
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
