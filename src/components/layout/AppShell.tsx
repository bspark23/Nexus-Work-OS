import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  FileText,
  Activity as ActivityIcon,
  UserRound,
  Settings,
  LogOut,
  Building2,
  Users,
  BarChart3,
  ClipboardList,
  ShieldCheck,
  Menu,
  Moon,
  Sun,
  Search,
  Sparkles,
  AlarmClock,
  Briefcase,
  FileSpreadsheet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { signOut } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useLiveData } from "@/hooks/useLiveData";
import { useMyDepartment } from "@/hooks/useData";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const accountNav: NavItem[] = [
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

function workspaceNav(opts: {
  isAdmin: boolean;
  isDeptAdmin: boolean;
  isSales: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: opts.isAdmin || opts.isDeptAdmin ? "Projects" : "My Projects", icon: FolderKanban },
    { to: "/tasks", label: opts.isAdmin || opts.isDeptAdmin ? "Tasks" : "My Tasks", icon: ListChecks },
    { to: "/reports", label: opts.isAdmin || opts.isDeptAdmin ? "Reports" : "My Reports", icon: FileText },
  ];
  if (opts.isAdmin || opts.isDeptAdmin) {
    items.push({ to: "/overdue", label: "Overdue Tasks", icon: AlarmClock });
  }
  if (opts.isSales || opts.isAdmin || opts.isDeptAdmin) {
    items.push({ to: "/customer-jobs", label: "Customer Jobs", icon: Briefcase });
    items.push({ to: "/file-workspace", label: "File Workspace", icon: FileSpreadsheet });
  }
  items.push({ to: "/activity", label: opts.isAdmin || opts.isDeptAdmin ? "Activity" : "My Activity", icon: ActivityIcon });
  return items;
}

const deptAdminNav: NavItem[] = [{ to: "/employees", label: "My Team", icon: Users }];

const superAdminNav: NavItem[] = [
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/company-reports", label: "Company Reports", icon: ClipboardList },
  { to: "/admin", label: "Admin Panel", icon: ShieldCheck },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, isDeptAdmin } = useAuth();
  const { isSales } = useMyDepartment();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const item = (to: string, label: string, Icon: typeof LayoutDashboard) => {
    const active = pathname === to || pathname.startsWith(to + "/");
    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        className={cn(
          "transition-smooth group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
          active
            ? "bg-sidebar-primary/15 text-sidebar-primary-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        {active ? (
          <span className="bg-sidebar-primary absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full" />
        ) : null}
        <Icon
          className={cn(
            "size-4.5 shrink-0",
            active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100",
          )}
        />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  const management = isAdmin ? superAdminNav : isDeptAdmin ? deptAdminNav : [];

  return (
    <nav className="space-y-1 px-3">
      <p className="text-sidebar-foreground/40 px-3 pt-2 pb-2 text-[11px] font-semibold tracking-widest uppercase">
        Workspace
      </p>
      {workspaceNav({ isAdmin, isDeptAdmin, isSales }).map((n) => item(n.to, n.label, n.icon))}

      {management.length ? (
        <>
          <p className="text-sidebar-foreground/40 px-3 pt-5 pb-2 text-[11px] font-semibold tracking-widest uppercase">
            {isAdmin ? "Administration" : "Department"}
          </p>
          {management.map((n) => item(n.to, n.label, n.icon))}
        </>
      ) : null}

      <p className="text-sidebar-foreground/40 px-3 pt-5 pb-2 text-[11px] font-semibold tracking-widest uppercase">
        Account
      </p>
      {accountNav.map((n) => item(n.to, n.label, n.icon))}
    </nav>
  );
}


function Brand() {
  return (
    <div className="flex items-center gap-3 px-6 py-5">
      <div className="brand-gradient text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-lg">
        <Sparkles className="size-4.5" />
      </div>
      <div className="leading-tight">
        <p className="text-sidebar-accent-foreground text-sm font-bold">Nexus Work OS</p>
        <p className="text-sidebar-foreground/50 text-[11px]">Company Work Management</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useLiveData(!!user);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut(auth);
    navigate({ to: "/auth", replace: true });
  }

  const sidebarBody = (
    <div className="bg-sidebar flex h-full flex-col">
      <Brand />
      <ScrollArea className="flex-1">
        <NavList onNavigate={() => setDrawer(false)} />
        <div className="h-6" />
      </ScrollArea>
      <div className="border-sidebar-border border-t p-3">
        <div className="bg-sidebar-accent/60 flex items-center gap-3 rounded-xl p-2.5">
          <Avatar className="size-9">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
              {initials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sidebar-accent-foreground truncate text-sm font-medium">
              {profile?.full_name ?? "Loading…"}
            </p>
            <p className="text-sidebar-foreground/50 truncate text-[11px]">
              {isAdmin ? "Super Admin" : "Employee"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/70 hover:text-destructive size-8"
            onClick={handleSignOut}
            aria-label="Log out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-sidebar-border sticky top-0 hidden h-screen w-[264px] shrink-0 border-r lg:block">
        {sidebarBody}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 sm:px-6">
          <Sheet open={drawer} onOpenChange={setDrawer}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] border-0 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebarBody}
            </SheetContent>
          </Sheet>

          <button
            onClick={() => setSearchOpen(true)}
            className="bg-secondary/60 text-muted-foreground hover:bg-secondary transition-smooth flex h-9 flex-1 items-center gap-2 rounded-xl border px-3 text-sm sm:max-w-md"
          >
            <Search className="size-4" />
            <span className="truncate">Search everything…</span>
            <kbd className="bg-background ml-auto hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </Button>
            <NotificationBell />
            <Link to="/profile" className="ml-1">
              <Avatar className="ring-border size-8 ring-2">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">
                  {initials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
