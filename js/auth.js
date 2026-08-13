/* Helper di autenticazione condivisi da tutte le pagine protette. */

function attendiAutenticazione() {
  return new Promise((resolve) => {
    const unsub = firebase.auth().onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

function montaLogout() {
  const header = document.querySelector('header.app-header');
  if (!header || qs('#btn-logout', header)) return;
  header.appendChild(
    el('button', {
      id: 'btn-logout',
      class: 'secondary',
      text: 'Esci',
      style: 'min-height:0;padding:6px 10px;font-size:0.78rem;',
      onclick: async () => {
        await firebase.auth().signOut();
        window.location.href = './login.html';
      },
    })
  );
}

/** Da chiamare a inizio pagina: reindirizza a login.html se non autenticato, altrimenti monta "Esci" e restituisce l'utente. */
async function richiedeLogin() {
  const user = await attendiAutenticazione();
  if (!user) {
    window.location.href = './login.html';
    return null;
  }
  montaLogout();
  return user;
}
