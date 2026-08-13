/*
 * Inizializzazione Firebase (SDK "compat", vendorizzato in vendor/firebase/,
 * coerente con l'approccio statico/no-CDN del resto del progetto).
 *
 * L'apiKey qui sotto NON è un segreto: identifica solo il progetto Firebase,
 * l'accesso ai dati è protetto da Authentication + Regole di sicurezza
 * Firestore (users/{uid}/...), non dalla segretezza della chiave.
 */

const firebaseConfig = {
  apiKey: 'AIzaSyDAJXoEYzdx99T-p3lobBZiKHqv25LbAX8',
  authDomain: 'test-visivi.firebaseapp.com',
  projectId: 'test-visivi',
  storageBucket: 'test-visivi.firebasestorage.app',
  messagingSenderId: '1019022320779',
  appId: '1:1019022320779:web:a62e28f1b2d6542e71608e',
};

firebase.initializeApp(firebaseConfig);

firebase
  .firestore()
  .enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistenza offline Firestore non attivabile in questa scheda.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistenza offline Firestore non supportata da questo browser.');
    }
  });
