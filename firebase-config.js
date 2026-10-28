import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAH7aKhGIKz9o3x7B4fS_6-39sW9-IDYsU",
  authDomain: "jarvis-personal-ai-5cd50.firebaseapp.com",
  projectId: "jarvis-personal-ai-5cd50",
  storageBucket: "jarvis-personal-ai-5cd50.firebasestorage.app",
  messagingSenderId: "749774207540",
  appId: "1:749774207540:web:12c93d1598b274e2ba2861",
  measurementId: "G-5WJGN4LRQR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
