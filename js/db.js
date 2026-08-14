/*
 * Livello dati dell'app. Da questa migrazione in poi è un ibrido:
 *
 *  - atleti e sessioni (incluso datiClinici) vivono su Firestore, sotto
 *    users/{uid}/atleti/{atletaId} e users/{uid}/sessioni/{sessioneId}
 *    (collezione FLAT con campo atletaId, non sottocollezione: così le
 *    funzioni sotto restano identiche nella firma a quelle di prima, che
 *    prendevano solo l'id della sessione senza bisogno dell'atleta).
 *    Nessun indice composito richiesto: l'ordinamento (per cognome/nome
 *    o per data) resta fatto in JS dopo il fetch, come già accadeva con
 *    IndexedDB.
 *
 *  - le squadre vivono su Firestore sotto users/{uid}/squadre/{squadraId}
 *    (solo campo "nome"). Un atleta appartiene a una squadra tramite il
 *    campo atleta.squadraId (stringa vuota o assente = nessuna squadra:
 *    trattare sempre con un controllo "falsy", mai con IDBKeyRange/where,
 *    per includere correttamente anche gli atleti creati prima che questo
 *    campo esistesse).
 *
 *  - allegati_foto e allegati_video restano SOLO nella IndexedDB locale
 *    del dispositivo (jetprogram-db), esattamente come prima: Firebase
 *    Storage non è usato in questo progetto (piano gratuito Spark, niente
 *    carta di credito). Le funzioni relative sono quindi invariate.
 *
 *  - in fondo al file: accessori "legacy" di sola lettura/marcatura sulla
 *    IndexedDB storica (che conteneva anche atleti/sessioni), usati solo
 *    da migrazione.html per la migrazione una tantum verso Firestore.
 */

const DB_NAME = 'jetprogram-db';
const DB_VERSION = 2;

let _dbPromise = null;

function dbOpen() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('atleti')) {
        const atletiStore = db.createObjectStore('atleti', { keyPath: 'id', autoIncrement: true });
        atletiStore.createIndex('cognome', 'cognome', { unique: false });
      }
      if (!db.objectStoreNames.contains('sessioni')) {
        const sessioniStore = db.createObjectStore('sessioni', { keyPath: 'id', autoIncrement: true });
        sessioniStore.createIndex('atletaId', 'atletaId', { unique: false });
      }
      if (!db.objectStoreNames.contains('allegati_foto')) {
        const fotoStore = db.createObjectStore('allegati_foto', { keyPath: 'id', autoIncrement: true });
        fotoStore.createIndex('sessioneId', 'sessioneId', { unique: false });
      }
      if (!db.objectStoreNames.contains('allegati_video')) {
        const videoStore = db.createObjectStore('allegati_video', { keyPath: 'id', autoIncrement: true });
        videoStore.createIndex('sessioneId', 'sessioneId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function dbRequest(store, mode, fn) {
  return dbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const os = tx.objectStore(store);
        const req = fn(os);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function correzioneVuota() {
  return {
    od: { sf: '', cyl: '', ax: '' },
    os: { sf: '', cyl: '', ax: '' },
  };
}

function posizioni5Vuote() {
  return { altoSx: '', bassoSx: '', centrale: '', altoDx: '', bassoDx: '' };
}

function datiCliniciVuoti() {
  return {
    acuitaVisiva: { od: '', os: '', binoculare: '' },
    correzionePropria: correzioneVuota(),
    correzione: correzioneVuota(),
    piedeDominante: '',
    manoDominante: '',
    occhioDirettoreMotorio: '',
    schober3m: posizioni5Vuote(),
    brockString: posizioni5Vuote(),
    abilitaFusionaleRapida: '',
    abilitaMessaFuocoRapida: '',
  };
}

/* --- Firestore: atleti e sessioni --- */

function _uid() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Utente non autenticato');
  return user.uid;
}

function _userDoc() {
  return firebase.firestore().collection('users').doc(_uid());
}

function _atletiCol() {
  return _userDoc().collection('atleti');
}

function _sessioniCol() {
  return _userDoc().collection('sessioni');
}

function _squadreCol() {
  return _userDoc().collection('squadre');
}

function _snapToObj(doc) {
  return { id: doc.id, ...doc.data() };
}

async function dbGetAtleti() {
  const snap = await _atletiCol().get();
  const atleti = snap.docs.map(_snapToObj);
  return atleti.sort((a, b) => {
    const ca = `${a.cognome} ${a.nome}`.toLowerCase();
    const cb = `${b.cognome} ${b.nome}`.toLowerCase();
    return ca.localeCompare(cb);
  });
}

async function dbGetAtleta(id) {
  const doc = await _atletiCol().doc(id).get();
  return doc.exists ? _snapToObj(doc) : undefined;
}

async function dbAddAtleta({ nome, cognome, squadraId }) {
  const now = new Date().toISOString();
  const atleta = {
    nome,
    cognome,
    squadraId: squadraId || '',
    altezza: '',
    dataNascita: '',
    telefono: '',
    email: '',
    createdAt: now,
    updatedAt: now,
    datiClinici: datiCliniciVuoti(),
  };
  const ref = await _atletiCol().add(atleta);
  return ref.id;
}

function dbUpdateAtleta(atleta) {
  atleta.updatedAt = new Date().toISOString();
  const { id, ...dati } = atleta;
  return _atletiCol().doc(id).set(dati);
}

async function dbDeleteAtleta(id) {
  const sessioni = await dbGetSessioniByAtleta(id);
  for (const s of sessioni) {
    await dbDeleteSessione(s.id);
  }
  await _atletiCol().doc(id).delete();
}

async function dbGetSessioniByAtleta(atletaId) {
  const snap = await _sessioniCol().where('atletaId', '==', atletaId).get();
  const sessioni = snap.docs.map(_snapToObj);
  return sessioni.sort((a, b) => a.data.localeCompare(b.data));
}

async function dbGetAllSessioni() {
  const snap = await _sessioniCol().get();
  return snap.docs.map(_snapToObj);
}

async function dbGetSessione(id) {
  const doc = await _sessioniCol().doc(id).get();
  return doc.exists ? _snapToObj(doc) : undefined;
}

async function dbAddSessione(sessione) {
  sessione.createdAt = new Date().toISOString();
  const ref = await _sessioniCol().add(sessione);
  return ref.id;
}

function dbUpdateSessione(sessione) {
  const { id, ...dati } = sessione;
  return _sessioniCol().doc(id).set(dati);
}

async function dbDeleteSessione(id) {
  const foto = await dbGetAllegatiFotoBySessione(id);
  for (const f of foto) await dbDeleteAllegatoFoto(f.id);
  const video = await dbGetAllegatiVideoBySessione(id);
  for (const v of video) await dbDeleteAllegatoVideo(v.id);
  await _sessioniCol().doc(id).delete();
}

/* --- Firestore: squadre --- */

async function dbGetSquadre() {
  const snap = await _squadreCol().get();
  const squadre = snap.docs.map(_snapToObj);
  return squadre.sort((a, b) => a.nome.toLowerCase().localeCompare(b.nome.toLowerCase()));
}

async function dbGetSquadra(id) {
  const doc = await _squadreCol().doc(id).get();
  return doc.exists ? _snapToObj(doc) : undefined;
}

async function dbAddSquadra({ nome }) {
  const ref = await _squadreCol().add({ nome });
  return ref.id;
}

/** Elimina la squadra; gli atleti assegnati NON vengono eliminati, restano senza squadra. */
async function dbDeleteSquadra(id) {
  const atleti = await dbGetAtleti();
  const assegnati = atleti.filter((a) => a.squadraId === id);
  for (const a of assegnati) {
    a.squadraId = '';
    await dbUpdateAtleta(a);
  }
  await _squadreCol().doc(id).delete();
}

/* --- IndexedDB locale: allegati foto/video (invariati, non sincronizzati) --- */

function dbAddAllegatoFoto({ sessioneId, blob }) {
  const record = { sessioneId, blob, tipoMime: blob.type, createdAt: new Date().toISOString() };
  return dbRequest('allegati_foto', 'readwrite', (os) => os.add(record));
}

function dbGetAllegatiFotoBySessione(sessioneId) {
  return dbRequest('allegati_foto', 'readonly', (os) => os.index('sessioneId').getAll(IDBKeyRange.only(sessioneId)));
}

function dbDeleteAllegatoFoto(id) {
  return dbRequest('allegati_foto', 'readwrite', (os) => os.delete(id));
}

function dbAddAllegatoVideo({ sessioneId, blob, durata }) {
  const record = { sessioneId, blob, tipoMime: blob.type, durata, createdAt: new Date().toISOString() };
  return dbRequest('allegati_video', 'readwrite', (os) => os.add(record));
}

function dbGetAllegatiVideoBySessione(sessioneId) {
  return dbRequest('allegati_video', 'readonly', (os) => os.index('sessioneId').getAll(IDBKeyRange.only(sessioneId)));
}

function dbDeleteAllegatoVideo(id) {
  return dbRequest('allegati_video', 'readwrite', (os) => os.delete(id));
}

/* --- Legacy: lettura/marcatura sulla IndexedDB storica, solo per migrazione.html --- */

function dbLegacyGetAtleti() {
  return dbRequest('atleti', 'readonly', (os) => os.getAll());
}

function dbLegacyGetSessioniByAtleta(atletaId) {
  return dbRequest('sessioni', 'readonly', (os) => os.index('atletaId').getAll(IDBKeyRange.only(atletaId)));
}

function dbLegacyMarkAtletaMigrato(atletaLegacy) {
  atletaLegacy._migrato = true;
  return dbRequest('atleti', 'readwrite', (os) => os.put(atletaLegacy));
}

/** Riassegna gli allegati locali (foto o video) di una sessione legacy al nuovo id Firestore. */
async function dbLegacyRilegaAllegati(store, vecchioSessioneId, nuovoSessioneId) {
  const records = await dbRequest(store, 'readonly', (os) => os.index('sessioneId').getAll(IDBKeyRange.only(vecchioSessioneId)));
  for (const r of records) {
    r.sessioneId = nuovoSessioneId;
    await dbRequest(store, 'readwrite', (os) => os.put(r));
  }
}
