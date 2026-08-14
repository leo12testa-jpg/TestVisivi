/*
 * Mappatura esercizi -> 6 categorie di skill per il radar chart (radar.html).
 * Ogni voce indica: esercizio (chiave di ESERCIZI_CONFIG), campo, e direzione
 * ('alto' = più alto è meglio, 'basso' = più basso è meglio). Per i campi con
 * sottoCondizioni (VVS) tutte le sotto-condizioni vengono sommate insieme.
 * assoluto:true significa che va normalizzato sul valore assoluto (la
 * direzione della deviazione non conta, solo la sua ampiezza).
 *
 * Campi volutamente esclusi perché sono parametri fissi del test e non
 * misure di prestazione (confermato: vedi conversazione di progetto):
 *  - proActionReaction.tempoTotale, attenzioneSeparata.tempoTotale,
 *    velocitaRiconoscimento.tempoTotale (durata del test, non un risultato)
 *  - movimentiOculari.tempo (idem)
 *  - sincronizzazioneRitmica.nTarget (numero di prove, non una prestazione)
 */

const CATEGORIE_RADAR = [
  {
    nome: 'Equilibrio',
    campi: [
      { esercizio: 'localizzazioneSpaziale', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'localizzazioneSpaziale', campo: 'immaginiAlSec', direzione: 'alto' },
      { esercizio: 'localizzazioneSpaziale', campo: 'immaginiColpite', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'pedana360', campo: 'immaginiAlSec', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'immaginiColpite', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'recuperi', direzione: 'basso' },
      { esercizio: 'pedana360', campo: 'tempoArea5', direzione: 'alto' },
      { esercizio: 'pedana360', campo: 'tempoAreaEsterna', direzione: 'basso' },
      { esercizio: 'sincronizzazioneRitmica', campo: 'percentualeSuccesso', direzione: 'alto' },
      { esercizio: 'sincronizzazioneRitmica', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'sincronizzazioneRitmica', campo: 'errori', direzione: 'basso' },
    ],
  },
  {
    nome: 'Attenzione',
    campi: [
      { esercizio: 'attenzioneSeparata', campo: 'tempoReazioneMedio', direzione: 'basso' },
      { esercizio: 'attenzioneSeparata', campo: 'immaginiColpite', direzione: 'alto' },
      { esercizio: 'attenzioneSeparata', campo: 'centrale', direzione: 'alto' },
      { esercizio: 'attenzioneSeparata', campo: 'periferica', direzione: 'alto' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v5', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v10', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v15', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v20', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v25', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v30', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v35', direzione: 'basso' },
      { esercizio: 'percezioneCampoVisivo', campo: 'v40', direzione: 'basso' },
    ],
  },
  {
    nome: 'Velocità di reazione',
    campi: [
      { esercizio: 'proActionReaction', campo: 'tempoRilascioMedio', direzione: 'basso' },
      { esercizio: 'proActionReaction', campo: 'tempoClickMedio', direzione: 'basso' },
      { esercizio: 'proActionReaction', campo: 'errori', direzione: 'basso' },
      { esercizio: 'velocitaRiconoscimento', campo: 'quantitaNumeri', direzione: 'alto' },
    ],
  },
  {
    nome: 'Percezione spaziale',
    campi: [
      { esercizio: 'vvs', campo: 'primaDeviazione', direzione: 'basso', assoluto: true },
      { esercizio: 'vvs', campo: 'secondaDeviazione', direzione: 'basso', assoluto: true },
      { esercizio: 'vvs', campo: 'angoloAssoluto', direzione: 'basso', assoluto: true },
    ],
  },
  {
    nome: 'Movimenti oculari',
    campi: [{ esercizio: 'movimentiOculari', campo: 'numTotale', direzione: 'alto' }],
  },
  {
    nome: 'Memoria',
    campi: [
      { esercizio: 'memorizzazioneSequenze', campo: 'totale', direzione: 'alto' },
      { esercizio: 'memorizzazioneSequenze', campo: 'livelloMassimo', direzione: 'alto' },
      { esercizio: 'memorizzazioneSequenze', campo: 'errori', direzione: 'basso' },
    ],
  },
];
