/* Compatibilità UI con lo schema reale importato da Jet Program.
 * Crea solo alias in memoria per le vecchie viste; non scrive su Firestore.
 */
const _normalizzaSessioneJetBase = normalizzaSessioneJet;

normalizzaSessioneJet = function normalizzaSessioneJetCompat(sessione) {
  const normalizzata = _normalizzaSessioneJetBase(sessione);
  const originale = normalizzata && normalizzata.esercizi && normalizzata.esercizi.jetProgramOriginale;
  if (!originale || typeof originale !== 'object') return normalizzata;

  return {
    ...normalizzata,
    nomeTestOriginale: normalizzata.nomeTestOriginale || normalizzata.jetProgramNomeOriginale || originale.nomeTestOriginale || '',
    tipoTest: normalizzata.tipoTest || originale.tipoTest || '',
    datiOriginali: normalizzata.datiOriginali || originale,
  };
};
