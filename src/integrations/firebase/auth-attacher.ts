import { createMiddleware } from "@tanstack/react-start";

/**
 * Client-side TanStack Start middleware.
 * Attaches the Firebase ID token to every server function call
 * so the server-side auth middleware can validate it.
 *
 * Must be registered as a global `functionMiddleware` in `src/start.ts`.
 */
export const attachFirebaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    try {
      const { auth } = await import("./config");
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        return next({ headers: { Authorization: `Bearer ${token}` } });
      }
    } catch {
      // Not authenticated — proceed without token
    }
    return next({ headers: {} });
  },
);
