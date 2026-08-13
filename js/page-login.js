registerServiceWorker();

function messaggioErrore(codice) {
  switch (codice) {
    case 'auth/invalid-email':
      return 'Email non valida.';
    case 'auth/user-disabled':
      return 'Account disabilitato.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email o password non corrette.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi, riprova più tardi.';
    case 'auth/network-request-failed':
      return 'Nessuna connessione: il primo accesso su un dispositivo richiede internet.';
    default:
      return 'Accesso non riuscito. Riprova.';
  }
}

async function init() {
  const user = await attendiAutenticazione();
  if (user) {
    window.location.href = './index.html';
  }
}

qs('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = qs('#login-email').value.trim();
  const password = qs('#login-password').value;
  const erroreEl = qs('#login-errore');
  erroreEl.style.display = 'none';

  const btn = qs('#form-login button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Accesso in corso...';
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    window.location.href = './index.html';
  } catch (err) {
    erroreEl.textContent = messaggioErrore(err.code);
    erroreEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Accedi';
  }
});

init();
