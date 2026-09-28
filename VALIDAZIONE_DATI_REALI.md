# Validazione dati reali — export 28/09/2026

Analisi eseguita sull'export reale `testvisivi-backup-2026-09-28.json`.

## Quadro generale

- 139 atleti presenti nell'export.
- 8.622 sessioni totali.
- 8.544 sessioni con origine Jet Program.
- 78 sessioni non Jet/legacy dell'app.
- Tutte le 8.544 sessioni Jet conservano `esercizi.jetProgramOriginale`.
- 3.314 sessioni Jet hanno già una chiave standard e un blocco risultati standard corrispondente.
- 5.230 sessioni Jet restano non standardizzate ma mantengono integralmente i dati originali.

## Distribuzione delle 3.314 sessioni già standardizzate

| Test standard | Sessioni |
| --- | ---: |
| Attenzione separata (centrale/periferica) | 894 |
| Localizzazione spaziale (Equilibrio statico) | 730 |
| Percezione campo visivo periferico | 388 |
| Pro Action and Reaction Time | 253 |
| Equilibrio posturale e coordinazione occhio-mano su pedana | 251 |
| Memorizzazione sequenze spaziali 7x12 | 250 |
| Reazione visuo-motoria veloce con elevata concentrazione in scelta multipla | 218 |
| Velocità di riconoscimento visivo | 164 |
| Velocità e precisione nella localizzazione spaziale in affollamento percettivo | 100 |
| Riconoscimento visivo veloce di numeri | 39 |
| Ordinamento strategico in confusione percettiva | 20 |
| Visualizzazione e localizzazione delle traiettorie | 5 |
| Localizzazione in affollamento percettivo e movimenti oculari veloci | 2 |

## Unità temporali già presenti nel Firestore

Il confronto è stato fatto tra i risultati originali Jet e i campi standard già salvati.

- `Tempo di reazione medio`: 1.971 coppie confrontabili; in tutte il valore standard è esattamente il valore Jet × 1000 (es. 0,51 -> 510 ms).
- `Tempo di rilascio medio`: 253/253 coppie con rapporto ×1000.
- `Tempo di click medio`: 253/253 coppie con rapporto ×1000.
- `Tempo totale`: 3.314/3.314 coppie coincidono numericamente e restano in secondi.

Questa coerenza permette di mantenere nell'interfaccia i tempi medi in millisecondi e il tempo totale in secondi senza reinterpretare le sessioni già migrate.

## Problema trovato nel branch prima della correzione

Il catalogo implementato localmente usava quattro chiavi diverse da quelle realmente già presenti nel Firestore:

- `localizzazioneAffollamento` invece di `velocitaPrecisioneAffollamento`
- `affollamentoMovimentiOculari` invece di `localizzazioneAffollamentoOculare`
- `traiettorie` invece di `visualizzazioneTraiettorie`
- `reazioneSceltaMultipla` invece di `reazioneVisuoMotoriaSceltaMultipla`

Avrebbe reso invisibili o non confrontabili 325 sessioni già standardizzate. Il branch `finalizzazione-testvisivi` è stato corretto per usare le chiavi reali.

## Regola operativa

- Nessuna scrittura Firestore è necessaria per rendere leggibili le 3.314 sessioni già standardizzate.
- Le 5.230 non standardizzate restano consultabili con nome e dati Jet originali.
- Non eseguire una migrazione massiva aggiuntiva finché non esiste una regola verificata per ciascun gruppo non assegnato.
- Le nuove sessioni devono usare le stesse 13 chiavi reali e gli stessi campi delle sessioni storiche.
