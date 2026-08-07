/**
 * Generic error reporting utility.
 * Previously used Lovable's internal telemetry — now a no-op stub.
 * Replace with your own error tracking (Sentry, Datadog, etc.) if needed.
 */
export function reportLovableError(error: unknown, _context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  // Log to console in development
  if (import.meta.env.DEV) {
    console.error("[Error Boundary]", error);
  }
}
