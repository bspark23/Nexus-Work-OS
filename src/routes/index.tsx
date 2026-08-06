import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bell,
  FolderKanban,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus Work OS — Company Work Management System" },
      {
        name: "description",
        content:
          "Nexus Work OS is an internal work management platform for projects, tasks, daily reports, department analytics and live team activity.",
      },
      { property: "og:title", content: "Nexus Work OS — Company Work Management System" },
      {
        property: "og:description",
        content:
          "Projects, tasks, reports and analytics for every department — in one live enterprise workspace.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: FolderKanban,
    title: "Projects & tasks",
    body: "Track every project through its lifecycle with progress, blockers and priorities.",
  },
  {
    icon: BarChart3,
    title: "Department analytics",
    body: "Live performance insight across Web, Video, Graphic Design and Social Media teams.",
  },
  {
    icon: Users,
    title: "Employee workspaces",
    body: "Each person gets a personal dashboard, work log and daily reporting flow.",
  },
  {
    icon: Bell,
    title: "Realtime activity",
    body: "Admins see updates, submissions and status changes the moment they happen.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Super Admins manage the company; employees only ever see their own work.",
  },
  {
    icon: Sparkles,
    title: "Built to scale",
    body: "Persistent database, secure file storage and shared live data for the whole company.",
  },
];

function Landing() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="brand-gradient text-primary-foreground flex size-9 items-center justify-center rounded-xl">
            <Sparkles className="size-4.5" />
          </div>
          <span className="font-bold">Nexus Work OS</span>
        </div>
        <Link to="/auth">
          <Button size="sm">Sign in</Button>
        </Link>
      </header>

      <section className="relative overflow-hidden px-6 pt-12 pb-24">
        <div className="bg-primary/20 pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full blur-[140px]" />
        <div className="animate-rise relative mx-auto max-w-3xl text-center">
          <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            Internal company platform
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            One workspace for every team's work
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-base sm:text-lg">
            Plan projects, log daily progress, submit reports and give leadership a live view of
            company performance — all in one secure system.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg">
                Enter workspace <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="surface-card transition-smooth hover:shadow-lifted p-6">
              <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-xl">
                <f.icon className="size-5" />
              </div>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-muted-foreground border-t px-6 py-8 text-center text-xs">
        Nexus Work OS — internal use only.
      </footer>
    </div>
  );
}
