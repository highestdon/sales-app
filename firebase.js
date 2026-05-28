// firebase.js
// Initializes Firebase for the app using the modern Modular SDK to fix TBT latency.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

const firebaseConfig = {

  apiKey: "AIzaSyDpvZLMJWFuYtW1QuI7x2FDrWWS0cZYLNU",
  authDomain: "sales-tracker-a1324.firebaseapp.com",
  databaseURL: "https://sales-tracker-a1324-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sales-tracker-a1324",
  storageBucket: "sales-tracker-a1324.firebasestorage.app",
  messagingSenderId: "745359721955",
  appId: "1:745359721955:web:c06017e7b074a3a7254cd6",
  measurementId: "G-1SES2989Y6"
};

// Core app initialization (very lightweight)
const app = initializeApp(firebaseConfig);

/**
 * FIXED: LAZY INITIALIZERS
 * Instead of creating these heavy instances instantly on page load,
 * they will only initialize the exact millisecond your components call them.
 */
let authInstance = null;
let dbInstance = null;

// Call this function when you need Firebase Auth features
export const getAuthInstance = async () => {
  if (!authInstance) {
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    authInstance = getAuth(app);
  }

  return authInstance;
};

// Call this function when you need Realtime Database features
export const getDbInstance = async () => {
  if (!dbInstance) {
    const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
    dbInstance = getDatabase(app);
  }

  return dbInstance;
};

export { firebaseConfig };
console.log("Firebase modular initialization complete", firebaseConfig.projectId);