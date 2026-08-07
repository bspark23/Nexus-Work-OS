/**
 * Firebase Admin SDK — server-side only.
 * Never import this from client code.
 */
import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const projectId = process.env["FIREBASE_PROJECT_ID"] ?? "workwise-harmoney";
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env["FIREBASE_STORAGE_BUCKET"] ?? "workwise-harmoney.firebasestorage.app",
    });
  }

  // Dev fallback: use Application Default Credentials or emulator
  return initializeApp({ projectId });
}

const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
