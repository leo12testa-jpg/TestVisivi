/*
 * Dataset per import-anagrafiche.html: elenco fornito dallo staff (cognome + dati clinici
 * essenziali). Un solo cognome per atleta (nessun nome noto): l'import lo tratta come
 * import-storico.js tratta i nomi di una sola parola, lasciando "nome" vuoto.
 *
 * Valori "non disponibile" nella fonte -> stringa vuota qui (mai inventati).
 * Valori di dominanza particolari (alternato, sdx, rx) vengono preservati così come
 * sono, senza forzarli a Dx/Sx: li normalizza solo nella capitalizzazione page-import-anagrafiche.js.
 *
 * Franceschelli e Bernardeschi: i dati originali della tabella fonte risultavano
 * ambigui/spostati di colonna; qui sono riportati i valori nell'interpretazione
 * concordata (vedi richiesta di import).
 */
const DATI_ANAGRAFICHE_IMPORT = [
  { cognome: 'Happonen', avd: '11', avs: '11', avoo: '11', mano: 'Dx', piede: 'Dx', occhio: 'Sx' },
  { cognome: 'Pessina', avd: '11', avs: '9', avoo: '11', mano: 'Sx', piede: 'Dx', occhio: 'Dx' },
  { cognome: 'Skorupsky', avd: '11', avs: '11', avoo: '11', mano: 'Dx', piede: 'Dx', occhio: 'Sx' },
  { cognome: 'Franceschelli', avd: '11', avs: '11', avoo: '11', mano: 'Dx', piede: 'Sx', occhio: 'alternato' },
  { cognome: 'Dovbyh', avd: '10', avs: '10', avoo: '10', mano: 'Dx', piede: 'Sx', occhio: 'sdx' },
  { cognome: 'Alhassane', avd: '9', avs: '9', avoo: '10', mano: 'Dx', piede: 'Sx', occhio: 'Sx' },
  { cognome: 'Vitik', avd: '10', avs: '10', avoo: '10', mano: 'Dx', piede: 'Dx', occhio: 'Dx' },
  { cognome: 'Libra', avd: '9', avs: '11', avoo: '', mano: 'Dx', piede: 'Dx', occhio: 'Dx', note: 'acerbo' },
  { cognome: 'Amondarain', avd: '11', avs: '11', avoo: '', mano: 'Dx', piede: 'Dx', occhio: 'Dx', note: 'molto sveglio' },
  { cognome: 'Heggem', avd: '11', avs: '11', avoo: '', mano: 'Sx', piede: 'Dx', occhio: '' },
  { cognome: 'Helland', avd: '11', avs: '11', avoo: '', mano: 'Dx', piede: 'Dx', occhio: 'Sx' },
  { cognome: 'Pobega', avd: '11', avs: '11', avoo: '', mano: 'Dx', piede: 'Sx', occhio: 'Sx' },
  { cognome: 'Ferguson', avd: '11', avs: '11', avoo: '', mano: 'Sx', piede: 'Dx', occhio: 'Sx' },
  { cognome: 'Moro', avd: '10', avs: '10', avoo: '', mano: 'Dx', piede: 'Dx', occhio: 'Dx' },
  { cognome: 'Odgaard', avd: '9', avs: '12', avoo: '', mano: 'Sx', piede: 'Sx', occhio: 'Dx' },
  { cognome: 'Bernardeschi', avd: '12', avs: '12', avoo: '', mano: 'Dx', piede: 'Sx', occhio: 'Dx' },
  { cognome: 'Cambiaghi', avd: '', avs: '', avoo: '', mano: '', piede: '', occhio: '' },
  { cognome: 'Piccoli', avd: '12', avs: '12', avoo: '', mano: 'Dx', piede: 'Dx', occhio: 'Dx' },
  { cognome: 'Zortea', avd: '12', avs: '12', avoo: '', mano: 'Dx', piede: 'Dx', occhio: 'Dx' },
  { cognome: 'Mbangula', avd: '12', avs: '12', avoo: '', mano: 'Dx', piede: 'Dx', occhio: 'Dx', note: 'top' },
  { cognome: 'Theate', avd: '11', avs: '11', avoo: '', mano: 'Dx', piede: 'Sx', occhio: 'Dx' },
  { cognome: 'enem', avd: '9', avs: '11', avoo: '', mano: 'rx', piede: 'rx', occhio: 'Sx' },
];
