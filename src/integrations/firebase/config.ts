import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] ?? "AIzaSyALrUYQYLRf0bIrCWs-ErV9Z7rdtVyv3Ug",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] ?? "workwise-harmoney.firebaseapp.com",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] ?? "workwise-harmoney",
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] ?? "workwise-harmoney.firebasestorage.app",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] ?? "383814708734",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] ?? "1:383814708734:web:e4664a3f8112de132f64af",
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] ?? "G-ZVLQL51JTN",
};

// Prevent re-initializing on hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
// Note: Firebase Storage is not used — files are stored as base64 in Firestore
// to stay on the free Spark plan. Upgrade to Blaze plan to enable Storage.
export default app;
