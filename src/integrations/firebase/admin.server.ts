/**
 * Firebase Admin SDK stub.
 * All admin operations (user create/edit/delete/role changes) are now handled
 * client-side via Firestore directly in the Admin Panel UI.
 *
 * The firebase-admin package is NOT used in production because it requires
 * ESM-only dependencies (jose, jwks-rsa) that crash in Netlify Lambda.
 *
 * If you need server-side admin operations in the future, use:
 * - Cloudflare Workers (natively supports ESM)
 * - Firebase Cloud Functions
 */

export const adminAuth = null;
export const adminDb = null;
