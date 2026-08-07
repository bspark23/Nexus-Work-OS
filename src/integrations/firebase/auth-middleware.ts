import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Server-side TanStack Start middleware.
 * Validates the Firebase ID token from the Authorization header
 * and injects `userId` + `claims` into the server function context.
 */
export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Bearer token required");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    try {
      const { adminAuth } = await import("./admin.server");
      const decoded = await adminAuth.verifyIdToken(token);

      return next({
        context: {
          userId: decoded.uid,
          claims: decoded,
        },
      });
    } catch (err) {
      throw new Error("Unauthorized: Invalid or expired token");
    }
  },
);
