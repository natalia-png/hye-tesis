// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);

// Messaging solo funciona en navegadores que soporten Service Workers
// isSupported() retorna una Promise, lo manejamos en el hook
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

// Firebase AI Logic (Gemini)
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
const ai = getAI(app, { backend: new GoogleAIBackend() });
export const geminiModel = getGenerativeModel(ai, { model: "gemini-2.5-flash-lite" });

// Exportamos la config para inyectarla en el Service Worker
export { firebaseConfig };