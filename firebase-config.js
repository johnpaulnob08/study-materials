// firebase-config.js — shared across index and admin
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwvhiPoRJGzlZf5anKM1Kt48qjpT3Jo5E",
  authDomain: "study-materials-2026.firebaseapp.com",
  projectId: "study-materials-2026",
  storageBucket: "study-materials-2026.firebasestorage.app",
  messagingSenderId: "613790178346",
  appId: "1:613790178346:web:6151c6bada7b389ffbf753",
  measurementId: "G-9WBFDBYZHX"
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);