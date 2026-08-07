/**
 * Firebase Admin SDK — server-side only.
 * Never import this from client code.
 */
import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let _adminApp: ReturnType<typeof initializeApp> | null = null;

function getAdminInstance() {
  if (_adminApp) return _adminApp;
  if (getApps().length > 0) {
    _adminApp = getApp();
    return _adminApp;
  }

  const projectId = process.env["FIREBASE_PROJECT_ID"] || process.env["VITE_FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey && projectId) {
    _adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env["FIREBASE_STORAGE_BUCKET"] || process.env["VITE_FIREBASE_STORAGE_BUCKET"],
    });
    return _adminApp;
  }

  if (projectId) {
    _adminApp = initializeApp({ projectId });
    return _adminApp;
  }

  throw new Error("Missing FIREBASE_PROJECT_ID environment variable");
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_, prop: keyof ReturnType<typeof getAuth>) {
    const auth = getAuth(getAdminInstance());
    const value = auth[prop];
    return typeof value === "function" ? value.bind(auth) : value;
  },
});

export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_, prop: keyof ReturnType<typeof getFirestore>) {
    const db = getFirestore(getAdminInstance());
    const value = db[prop];
    return typeof value === "function" ? value.bind(db) : value;
  },
});
