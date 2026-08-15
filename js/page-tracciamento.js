registerServiceWorker();

const atletaId = getQueryParam('atletaId');

/* --- Parametri facilmente modificabili --- */
const NUM_PALLINE = 10;
const NUM_TARGET = 1;
const DIAMETRO_PALLINA_MM = 20;
const PX_PER_MM = 96 / 25.4; // 96px = 1 pollice CSS, 25.4mm = 1 pollice
const DURATA_VISIBILITA_TARGET_MS = 5000;
const DURATA_MOVIMENTO_MS = 20000;
const VELOCITA_PALLINE = 60; // px/secondo, costante per tutte le palline
const INTERVALLO_CAMBIO_DIREZIONE_MIN_MS = 800;
const INTERVALLO_CAMBIO_DIREZIONE_MAX_MS = 2000;
const DURATA_FEEDBACK_MS = 1800;

/* --- Effetto pseudo-3D (zoom): z=1 distanza base, z<1 più lontana/piccola, z>1 più vicina/grande --- */
const Z_MIN = 0.6;
const Z_MAX = 1.6;
const ZOOM_PERIODO_MIN_MS = 4000;
const ZOOM_PERIODO_MAX_MS = 8000;
const Z_MINIMO_BERSAGLIO_VISIBILE = 0.9; // il verde non scende sotto questa soglia nei primi 5s

const Z_CENTRO = (Z_MIN + Z_MAX) / 2;
const Z_AMPIEZZA = (Z_MAX - Z_MIN) / 2;

const COLORE_ROSSO = '#e34948';
const COLORE_VERDE = '#0ca30c';
const COLORE_GIALLO = '#eda100';

const RAGGIO_PX = (DIAMETRO_PALLINA_MM * PX_PER_MM) / 2;

const canvas = qs('#canvas-gioco');
const ctx = canvas.getContext('2d');
const overlay = qs('#overlay-avvio');
const testoStato = qs('#testo-stato');

let larghezza = 0;
let altezza = 0;
let palline = [];
let indiciBersaglio = [];
let faseGioco = 'attesa'; // 'attesa' | 'target' | 'movimento' | 'risposta' | 'feedback'
let tGameStart = 0;
let tInizioRisposta = 0;
let ultimoFrame = 0;

function dimensionaCanvas() {
  const dpr = window.devicePixelRatio || 1;
  larghezza = Math.max(280, canvas.clientWidth || 320);
  altezza = Math.max(320, Math.round(window.innerHeight * 0.55));
  canvas.style.height = `${altezza}px`;
  canvas.width = Math.round(larghezza * dpr);
  canvas.height = Math.round(altezza * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function distanza(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function direzioneCasuale() {
  const angolo = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angolo) * VELOCITA_PALLINE, vy: Math.sin(angolo) * VELOCITA_PALLINE };
}

function intervalloCambioDirezione() {
  return INTERVALLO_CAMBIO_DIREZIONE_MIN_MS + Math.random() * (INTERVALLO_CAMBIO_DIREZIONE_MAX_MS - INTERVALLO_CAMBIO_DIREZIONE_MIN_MS);
}

/** Velocità angolare (rad/s) casuale per l'oscillazione di profondità z di una pallina. */
function omegaZoomCasuale() {
  const periodoMs = ZOOM_PERIODO_MIN_MS + Math.random() * (ZOOM_PERIODO_MAX_MS - ZOOM_PERIODO_MIN_MS);
  return (2 * Math.PI) / (periodoMs / 1000);
}

/** Fisher-Yates: n indici distinti tra 0 e totale-1 (usati per le palline bersaglio). */
function scegliIndiciCasuali(n, totale) {
  const indici = Array.from({ length: totale }, (_, i) => i);
  for (let i = indici.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indici[i], indici[j]] = [indici[j], indici[i]];
  }
  return indici.slice(0, n);
}

/** Piazzamento senza sovrapposizioni eccessive: rejection sampling con un tetto di tentativi. */
function piazzaPalline() {
  const separazioneMinima = RAGGIO_PX * 3; // un diametro e mezzo di spazio tra i centri
  const nuovePalline = [];
  for (let i = 0; i < NUM_PALLINE; i++) {
    let posizione = null;
    for (let tentativo = 0; tentativo < 300 && !posizione; tentativo++) {
      const candidataX = RAGGIO_PX + Math.random() * (larghezza - 2 * RAGGIO_PX);
      const candidataY = RAGGIO_PX + Math.random() * (altezza - 2 * RAGGIO_PX);
      if (nuovePalline.every((p) => distanza(p.x, p.y, candidataX, candidataY) >= separazioneMinima)) {
        posizione = { x: candidataX, y: candidataY };
      }
    }
    if (!posizione) {
      posizione = {
        x: RAGGIO_PX + Math.random() * (larghezza - 2 * RAGGIO_PX),
        y: RAGGIO_PX + Math.random() * (altezza - 2 * RAGGIO_PX),
      };
    }
    nuovePalline.push({
      ...posizione,
      ...direzioneCasuale(),
      prossimoCambioDirezione: 0,
      verde: false,
      z: 1,
      zOmega: omegaZoomCasuale(),
      zFase: Math.random() * Math.PI * 2,
    });
  }
  indiciBersaglio = scegliIndiciCasuali(NUM_TARGET, NUM_PALLINE);
  nuovePalline.forEach((p, i) => {
    p.verde = indiciBersaglio.includes(i);
  });
  return nuovePalline;
}

/**
 * Il moto a tratti rettilinei cambia direzione per due cause indipendenti:
 * un timer casuale per pallina (imprevedibilità oltre ai soli rimbalzi) e il
 * rimbalzo fisico contro i bordi dell'area di gioco (necessario per restare
 * in campo). Le collisioni tra palline non sono gestite: possono sovrapporsi
 * visivamente per un istante, non è richiesto altro dalla specifica.
 */
function aggiornaFisica(dt, now) {
  const elapsedSec = (now - tGameStart) / 1000;
  palline.forEach((p) => {
    if (now >= p.prossimoCambioDirezione) {
      Object.assign(p, direzioneCasuale());
      p.prossimoCambioDirezione = now + intervalloCambioDirezione();
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x - RAGGIO_PX < 0) {
      p.x = RAGGIO_PX;
      p.vx = Math.abs(p.vx);
    } else if (p.x + RAGGIO_PX > larghezza) {
      p.x = larghezza - RAGGIO_PX;
      p.vx = -Math.abs(p.vx);
    }
    if (p.y - RAGGIO_PX < 0) {
      p.y = RAGGIO_PX;
      p.vy = Math.abs(p.vy);
    } else if (p.y + RAGGIO_PX > altezza) {
      p.y = altezza - RAGGIO_PX;
      p.vy = -Math.abs(p.vy);
    }

    p.z = Z_CENTRO + Z_AMPIEZZA * Math.sin(p.zOmega * elapsedSec + p.zFase);
    if (p.verde && faseGioco === 'target') p.z = Math.max(p.z, Z_MINIMO_BERSAGLIO_VISIBILE);
  });
}

function disegnaPallina(x, y, raggio, colore) {
  ctx.beginPath();
  ctx.arc(x, y, raggio, 0, Math.PI * 2);
  ctx.fillStyle = colore;
  ctx.fill();
}

/** Indici delle palline ordinati per z crescente: le più "lontane" disegnate per prime, le più "vicine" sopra. */
function ordinePerProfondita() {
  return palline.map((_, i) => i).sort((a, b) => palline[a].z - palline[b].z);
}

function disegna() {
  ctx.clearRect(0, 0, larghezza, altezza);
  ordinePerProfondita().forEach((i) => {
    const p = palline[i];
    disegnaPallina(p.x, p.y, RAGGIO_PX * p.z, p.verde ? COLORE_VERDE : COLORE_ROSSO);
  });
}

function disegnaFeedback(idCliccata) {
  ctx.clearRect(0, 0, larghezza, altezza);
  ordinePerProfondita().forEach((i) => {
    const p = palline[i];
    let colore = COLORE_ROSSO;
    if (indiciBersaglio.includes(i)) colore = COLORE_VERDE;
    else if (i === idCliccata) colore = COLORE_GIALLO;
    disegnaPallina(p.x, p.y, RAGGIO_PX * p.z, colore);
  });
}

function loop(now) {
  if (!ultimoFrame) ultimoFrame = now;
  const dt = (now - ultimoFrame) / 1000;
  ultimoFrame = now;
  const elapsed = now - tGameStart;

  if (faseGioco === 'target' && elapsed >= DURATA_VISIBILITA_TARGET_MS) {
    palline.forEach((p) => (p.verde = false));
    faseGioco = 'movimento';
    testoStato.textContent = 'Segui il movimento…';
  } else if (faseGioco === 'movimento' && elapsed >= DURATA_VISIBILITA_TARGET_MS + DURATA_MOVIMENTO_MS) {
    faseGioco = 'risposta';
    tInizioRisposta = now;
    testoStato.textContent = 'Tocca la pallina bersaglio!';
    disegna();
    return;
  }

  if (faseGioco === 'target' || faseGioco === 'movimento') {
    aggiornaFisica(dt, now);
    disegna();
    requestAnimationFrame(loop);
  }
}

async function salvaRisultato(datiTracciamento) {
  const oggi = oggiIso();
  const sessioni = await dbGetSessioniByAtleta(atletaId);
  const sessioneOggi = sessioni.find((s) => s.data === oggi);
  if (sessioneOggi) {
    sessioneOggi.esercizi = { ...sessioneOggi.esercizi, tracciamentoVisivo: datiTracciamento };
    await dbUpdateSessione(sessioneOggi);
  } else {
    await dbAddSessione({ atletaId, data: oggi, titolo: '', esercizi: { tracciamentoVisivo: datiTracciamento } });
  }
}

async function gestisciRisposta(idCliccata) {
  faseGioco = 'feedback';
  const tempoRispostaMs = Math.round(performance.now() - tInizioRisposta);
  const corretto = indiciBersaglio.includes(idCliccata);
  disegnaFeedback(idCliccata);
  testoStato.textContent = corretto ? 'Corretto!' : 'Risposta sbagliata.';
  try {
    await salvaRisultato({ corretto, tempoRispostaMs, numPalline: NUM_PALLINE });
  } catch (err) {
    testoStato.textContent = 'Errore nel salvataggio del risultato.';
    console.error('Errore salvataggio tracciamento visivo:', err);
    return;
  }
  setTimeout(() => {
    window.location.href = `./atleta.html?id=${atletaId}`;
  }, DURATA_FEEDBACK_MS);
}

canvas.addEventListener('click', (evento) => {
  if (faseGioco !== 'risposta') return;
  const rect = canvas.getBoundingClientRect();
  const clickX = evento.clientX - rect.left;
  const clickY = evento.clientY - rect.top;
  let idCliccata = -1;
  let distanzaMinima = Infinity;
  palline.forEach((p, i) => {
    const d = distanza(p.x, p.y, clickX, clickY);
    if (d <= RAGGIO_PX * p.z && d < distanzaMinima) {
      distanzaMinima = d;
      idCliccata = i;
    }
  });
  gestisciRisposta(idCliccata);
});

function avviaGioco() {
  overlay.hidden = true;
  palline = piazzaPalline();
  faseGioco = 'target';
  tGameStart = performance.now();
  ultimoFrame = 0;
  testoStato.textContent = 'Osserva la pallina verde…';
  disegna();
  requestAnimationFrame(loop);
}

qs('#btn-avvia').addEventListener('click', avviaGioco);

function mostraErroreInit(err) {
  console.error('Errore inizializzazione tracciamento visivo:', err);
  const main = document.querySelector('main');
  const banner = el('div', { class: 'card', style: 'border-color:var(--danger);' }, [
    el('p', { style: 'color:var(--danger);font-weight:600;margin:0 0 4px;', text: 'Errore nel caricamento' }),
    el('p', { class: 'meta', style: 'margin:0;', text: err && err.message ? err.message : String(err) }),
  ]);
  main.prepend(banner);
}

async function init() {
  const user = await richiedeLogin();
  if (!user) return;
  try {
    const atleta = await dbGetAtleta(atletaId);
    if (!atleta) {
      window.location.href = './index.html';
      return;
    }
    qs('#titolo-tracciamento').textContent = `Tracciamento — ${nomeCompleto(atleta)}`;
    document.title = `Tracciamento ${nomeCompleto(atleta)} - Test Visivi`;
    qs('#link-annulla').href = `./atleta.html?id=${atletaId}`;

    dimensionaCanvas();
    testoStato.textContent = 'Tocca "Pronto?" per iniziare il test.';
    overlay.hidden = false;
  } catch (err) {
    mostraErroreInit(err);
  }
}

init();
