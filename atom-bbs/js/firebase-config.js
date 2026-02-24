import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyACZidkRc4rh6iXXlMP4XQmP3-R6wqBiBU",
    authDomain: "pwa-atom-bbs.firebaseapp.com",
    projectId: "pwa-atom-bbs",
    storageBucket: "pwa-atom-bbs.firebasestorage.app",
    messagingSenderId: "1034132974214",
    appId: "1:1034132974214:web:66a482ba361a6b7d417f07",
    measurementId: "G-CCQSG6Y1DV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
