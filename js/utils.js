/* Helper generici condivisi da tutte le pagine. */

function qs(selector, root) {
  return (root || document).querySelector(selector);
}

function qsa(selector, root) {
  return Array.from((root || document).querySelectorAll(selector));
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Crea un elemento DOM senza passare da innerHTML (evita rischi XSS su dati utente). */
function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
  }
  (children || []).forEach((c) => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function formatDataIt(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function oggiIso() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function riparaTestoNome(value) {
  return String(value || '')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/Ã²/g, 'ò').replace(/Ã³/g, 'ó').replace(/Ã¹/g, 'ù')
    .replace(/Ã /g, 'à').replace(/Ã¨/g, 'è').replace(/Ã©/g, 'é')
    .replace(/Ã¬/g, 'ì').replace(/Ã­/g, 'í').replace(/Ã±/g, 'ñ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titoloNome(value) {
  return riparaTestoNome(value)
    .toLocaleLowerCase('it-IT')
    .replace(/(^|[\s'’-])([\p{L}])/gu, (_, sep, lettera) => sep + lettera.toLocaleUpperCase('it-IT'));
}

function chiaveNome(value) {
  return riparaTestoNome(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Nomi verificati sul sito Bologna FC o su schede storiche del Club.
// Serve sia per correggere refusi/import incompleti sia per uniformare accenti e spazi.
const NOMI_CALCIATORI_BOLOGNA = {
  dallinga: ['Thijs', 'Dallinga'],
  cambiaghi: ['Nicolò', 'Cambiaghi'],
  ferguson: ['Lewis', 'Ferguson'],
  holm: ['Emil', 'Holm'],
  pobega: ['Tommaso', 'Pobega'],
  sohm: ['Simon', 'Sohm'],
  freuler: ['Remo', 'Freuler'],
  rowe: ['Jonathan', 'Rowe'],
  castro: ['Santiago', 'Castro'],
  odgaard: ['Jens', 'Odgaard'],
  zortea: ['Nadir', 'Zortea'],
  heggem: ['Torbjørn', 'Heggem'],
  lucumi: ['Jhon', 'Lucumí'],
  skorupski: ['Łukasz', 'Skorupski'],
  skorupsky: ['Łukasz', 'Skorupski'],
  bernardeschi: ['Federico', 'Bernardeschi'],
  piccoli: ['Roberto', 'Piccoli'],
  vitik: ['Martin', 'Vitík'],
  dovbyk: ['Artem', 'Dovbyk'],
  dovbyh: ['Artem', 'Dovbyk'],
  miranda: ['Juan', 'Miranda'],
  helland: ['Eivind', 'Helland'],
  lykogiannis: ['Charalampos', 'Lykogiannis'],
  casale: ['Nicolò', 'Casale'],
  moro: ['Nikola', 'Moro'],
  mbangula: ['Samuel', 'Mbangula'],
  amondarain: ['Mikel', 'Amondarain'],
  alhassane: ['Rahim', 'Alhassane'],
  alhassanebonkano: ['Rahim', 'Alhassane'],
  happonen: ['Ukko', 'Happonen'],
  libra: ['Marco', 'Libra'],
  enem: ['Jay', 'Enem'],
  orsolini: ['Riccardo', 'Orsolini'],
  theate: ['Arthur', 'Theate'],
  pessina: ['Massimo', 'Pessina'],
  ravaglia: ['Federico', 'Ravaglia'],
  franceschelli: ['Matteo', 'Franceschelli'],
  dominguez: ['Benjamín', 'Domínguez'],
  immobile: ['Ciro', 'Immobile'],
  sarr: ['Fallou', 'Sarr'],
  molla: ['Marco', 'Molla'],
  bardi: ['Francesco', 'Bardi'],
  okwonkwo: ['Orji', 'Okwonkwo'],
  svanberg: ['Mattias', 'Svanberg'],
  svamberg: ['Mattias', 'Svanberg'],
  corbo: ['Gabriele', 'Corbo'],
  tomiyasu: ['Takehiro', 'Tomiyasu'],
  donsah: ['Godfred', 'Donsah'],
  bani: ['Mattia', 'Bani'],
  pulgar: ['Erick', 'Pulgar'],
  pirana: ['Caio Vinicius', 'Pirana'],
  bagnolini: ['Nicola', 'Bagnolini'],
  denswil: ['Stefano', 'Denswil'],
  denswill: ['Stefano', 'Denswil'],
  dacosta: ['Angelo', 'Da Costa'],
  skovolsen: ['Andreas', 'Skov Olsen'],
  santurro: ['Antonio', 'Santurro'],
  mattiello: ['Federico', 'Mattiello'],
  breza: ['Sebastian', 'Breza'],
  dijks: ['Mitchell', 'Dijks'],
  schouten: ['Jerdy', 'Schouten'],
  barrow: ['Musa', 'Barrow'],
  mirante: ['Antonio', 'Mirante'],
  mbaye: ['Ibrahima', 'Mbaye'],
  difrancesco: ['Federico', 'Di Francesco'],
  verdi: ['Simone', 'Verdi'],
  destro: ['Mattia', 'Destro'],
  masina: ['Adam', 'Masina'],
  helander: ['Filip', 'Helander'],
  aebischer: ['Michel', 'Aebischer'],
  prisco: ['Antonio', 'Prisco'],
};

const NOMI_COMPLETI_BOLOGNA = {
  michaelkingsley: ['Kingsley', 'Michael'],
  joaolopes: ['João Mário', 'Neto Lopes'],
};

function normalizzaAnagraficaCalciatore(atleta) {
  const nomeRaw = riparaTestoNome(atleta?.nome);
  const cognomeRaw = riparaTestoNome(atleta?.cognome);
  const fullKey = chiaveNome(nomeRaw + cognomeRaw);
  const cognomeKey = chiaveNome(cognomeRaw);
  const match = NOMI_COMPLETI_BOLOGNA[fullKey] || NOMI_CALCIATORI_BOLOGNA[cognomeKey];

  if (match) return { ...atleta, nome: match[0], cognome: match[1] };
  return { ...atleta, nome: titoloNome(nomeRaw), cognome: titoloNome(cognomeRaw) };
}

function nomeCompleto(atleta) {
  const a = normalizzaAnagraficaCalciatore(atleta || {});
  return [a.nome, a.cognome].filter(Boolean).join(' ');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((registration) => registration.update()).catch(() => {});
    });
  }
}

function mostraErrorePagina(err) {
  let banner = qs('#errore-pagina');
  if (!banner) {
    banner = el('div', { id: 'errore-pagina', class: 'error-banner', role: 'alert' });
    qs('main').prepend(banner);
  }
  banner.textContent = err?.message || 'Operazione non riuscita. Riprova.';
  banner.scrollIntoView({ block: 'nearest' });
}

/** Badge Online/Offline iniettato automaticamente nell'header di ogni pagina. */
function montaIndicatoreConnessione() {
  const header = document.querySelector('header.app-header');
  if (!header) return;
  const badge = el('span', { id: 'stato-connessione', class: 'conn-badge' }, [el('span', { class: 'conn-dot' }), el('span', { class: 'conn-text' })]);
  header.appendChild(badge);

  function aggiorna() {
    const online = navigator.onLine;
    badge.classList.toggle('conn-online', online);
    badge.classList.toggle('conn-offline', !online);
    qs('.conn-text', badge).textContent = online ? 'Online' : 'Offline';
  }

  window.addEventListener('online', aggiorna);
  window.addEventListener('offline', aggiorna);
  aggiorna();
}
montaIndicatoreConnessione();

const APP_BUILD_VERSION = '86';

async function leggiVersionePubblicata() {
  if (!navigator.onLine) return null;
  try {
    const response = await fetch(`./version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return String(data?.version || '').trim() || null;
  } catch (_) {
    return null;
  }
}

function montaPulsanteAggiornaApp() {
  const header = document.querySelector('header.app-header');
  if (!header) return;

  let btn = null;

  function nascondi() {
    if (btn) btn.remove();
    btn = null;
  }

  function mostra() {
    if (btn) return;
    btn = el('button', {
      type: 'button',
      id: 'btn-aggiorna-app',
      class: 'header-update-btn',
      text: '↻ Aggiorna',
      title: 'È disponibile una nuova versione dell’app',
    });

    btn.addEventListener('click', async () => {
      if (!navigator.onLine) return;

      const pubblicata = await leggiVersionePubblicata();
      if (pubblicata) segnaVersioneGestita(pubblicata);

      const clickedBtn = btn;
      clickedBtn.disabled = true;
      clickedBtn.textContent = 'Aggiornamento…';

      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.update().catch(() => {})));
        }

        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith('jetprogram-cache-'))
              .map((key) => caches.delete(key))
          );
        }

        window.location.reload();
      } catch (err) {
        console.warn('Aggiornamento app non completato:', err);
        if (pubblicata) {
          try { sessionStorage.removeItem(UPDATE_ACK_KEY); } catch (_) {}
        }
        if (clickedBtn?.isConnected) {
          clickedBtn.disabled = false;
          clickedBtn.textContent = '↻ Aggiorna';
        }
      }
    });

    header.appendChild(btn);
  }

  const UPDATE_ACK_KEY = 'jetprogram-update-ack';

  function versioneGiaGestita(versione) {
    try {
      return sessionStorage.getItem(UPDATE_ACK_KEY) === String(versione || '');
    } catch (_) {
      return false;
    }
  }

  function segnaVersioneGestita(versione) {
    try {
      sessionStorage.setItem(UPDATE_ACK_KEY, String(versione || ''));
    } catch (_) {}
  }

  async function verifica() {
    const pubblicata = await leggiVersionePubblicata();
    if (
      pubblicata &&
      pubblicata !== APP_BUILD_VERSION &&
      !versioneGiaGestita(pubblicata)
    ) mostra();
    else nascondi();
  }

  window.addEventListener('online', verifica);
  window.addEventListener('focus', verifica);
  verifica();
}
montaPulsanteAggiornaApp();

function slug(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
