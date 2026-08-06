import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nexus Work OS" },
      { name: "description", content: "Workspace appearance and account settings." },
      { property: "og:title", content: "Settings — Nexus Work OS" },
      { property: "og:description", content: "Appearance and account settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { profile, isAdmin } = useAuth();

  return (
    <>
      <PageHeader title="Settings" subtitle="Personalise how your workspace looks and behaves." />
      <div className="surface-card animate-rise max-w-2xl divide-y">
        <div className="flex items-center justify-between p-5">
          <div>
            <Label className="text-sm font-medium">Dark mode</Label>
            <p className="text-muted-foreground text-xs">Switch between light and dark themes.</p>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <Label className="text-sm font-medium">Account</Label>
            <p className="text-muted-foreground text-xs">
              Signed in as @{profile?.username} · {isAdmin ? "Super Admin" : "Employee"}
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Managed by admin
          </Button>
        </div>
      </div>
    </>
  );
}
