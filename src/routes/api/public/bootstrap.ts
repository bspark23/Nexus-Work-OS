import { createFileRoute } from "@tanstack/react-router";

/**
 * Idempotent bootstrap for the pre-configured Super Admin account.
 * Becomes a permanent no-op as soon as any Super Admin exists, so it is safe
 * to expose and safe to call on every visit to the sign-in page.
 */
export const Route = createFileRoute("/api/public/bootstrap")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { ensureSeedSuperAdmin } = await import("@/lib/admin.server");
          const result = await ensureSeedSuperAdmin();
          return Response.json(result);
        } catch (error) {
          console.error("[bootstrap]", error);
          return Response.json({ created: false, error: "bootstrap_failed" }, { status: 500 });
        }
      },
    },
  },
});
