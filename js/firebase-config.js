/* ===========================================================
   CONFIGURAÇÃO DO FIREBASE — TRAÇO D
   Arquivo: js/firebase-config.js
   =========================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyC_XI5aOwiAE-vPu2KxZxUIUX2jRIdYvZU",
  authDomain: "calendario-editorial-cd7b3.firebaseapp.com",
  projectId: "calendario-editorial-cd7b3",
  storageBucket: "calendario-editorial-cd7b3.firebasestorage.app",
  messagingSenderId: "182591786955",
  appId: "1:182591786955:web:9c603cef0cd39778fef04e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
