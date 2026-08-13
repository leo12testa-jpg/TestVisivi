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

function nomeCompleto(atleta) {
  return `${atleta.cognome} ${atleta.nome}`;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
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

function slug(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
