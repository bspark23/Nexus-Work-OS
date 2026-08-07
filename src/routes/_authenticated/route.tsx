import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { auth } from "@/integrations/firebase/config";
import { AppShell } from "@/components/layout/AppShell";
import { runTaskExpiry } from "@/lib/jobs-api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    await new Promise<void>((resolve) => {
      const unsub = auth.onAuthStateChanged(() => { unsub(); resolve(); });
    });
    const user = auth.currentUser;
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // Run task expiry check once per session on load
  useEffect(() => {
    runTaskExpiry().catch(() => {});
  }, []);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
