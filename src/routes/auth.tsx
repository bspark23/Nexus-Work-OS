import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles, ShieldCheck, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usernameToAuthEmail } from "@/lib/constants";
import { useDepartments } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — Nexus Work OS" }],
  }),
  component: AuthPage,
});

// Default company departments seeded on first run
const DEFAULT_DEPARTMENTS = [
  { name: "Sales", description: "Customer acquisition and sales operations" },
  { name: "Web Development", description: "Website and web application development" },
  { name: "Graphic Design", description: "Visual design and brand identity" },
  { name: "Video Production", description: "Video creation and editing" },
  { name: "Social Media", description: "Social media management and content" },
  { name: "Marketing", description: "Marketing campaigns and strategy" },
  { name: "UI/UX Design", description: "User interface and experience design" },
  { name: "Mobile Development", description: "iOS and Android app development" },
  { name: "Human Resources", description: "Recruitment and people operations" },
  { name: "Finance", description: "Accounting and financial management" },
];

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: departments = [], refetch: refetchDepts } = useDepartments();
  const qc = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [seedingDepts, setSeedingDepts] = useState(false);
  const [superAdminExists, setSuperAdminExists] = useState<boolean | null>(null);

  // Login state
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");

  // Register state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  // Check if super admin exists to determine first-run state
  useEffect(() => {
    getDocs(query(collection(db, "user_roles"), where("role", "==", "super_admin")))
      .then((snap) => setSuperAdminExists(!snap.empty))
      .catch(() => setSuperAdminExists(true));
  }, []);

  const isFirstRun = superAdminExists === false;
  const noDepartments = departments.length === 0;

  async function seedDepartments() {
    setSeedingDepts(true);
    try {
      // Only seed if there are no departments yet
      const existing = await getDocs(collection(db, "departments"));
      if (!existing.empty) {
        toast.info("Departments already exist");
        qc.invalidateQueries({ queryKey: ["departments"] });
        return;
      }
      for (const dept of DEFAULT_DEPARTMENTS) {
        await addDoc(collection(db, "departments"), {
          name: dept.name,
          description: dept.description,
          created_at: serverTimestamp(),
        });
      }
      await qc.invalidateQueries({ queryKey: ["departments"] });
      await refetchDepts();
      toast.success(`${DEFAULT_DEPARTMENTS.length} departments created`);
    } catch (e) {
      toast.error("Could not seed departments — check Firestore rules");
    } finally {
      setSeedingDepts(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, usernameToAuthEmail(loginUser), loginPass);
      toast.success("Welcome back");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Invalid username or password");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!isFirstRun && !departmentId) {
      toast.error("Choose your department");
      return;
    }
    setBusy(true);
    try {
      const email = usernameToAuthEmail(username);

      const existing = await getDocs(
        query(collection(db, "profiles"), where("username", "==", username.trim().toLowerCase())),
      );
      if (!existing.empty) {
        toast.error("Username is already taken");
        setBusy(false);
        return;
      }

      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);

      // First user (no existing super_admin) becomes super_admin
      const rolesSnap = await getDocs(
        query(collection(db, "user_roles"), where("role", "==", "super_admin")),
      );
      const existingSupers = rolesSnap.docs.filter((d) => d.id !== newUser.uid);
      const role = existingSupers.length === 0 ? "super_admin" : "employee";

      await setDoc(doc(db, "profiles", newUser.uid), {
        id: newUser.uid,
        full_name: fullName,
        username: username.trim().toLowerCase(),
        email,
        department_id: departmentId || null,
        job_title: jobTitle || null,
        status: "active",
        avatar_url: null,
        bio: null,
        phone: null,
        last_seen_at: serverTimestamp(),
        created_at: serverTimestamp(),
      });

      await setDoc(doc(db, "user_roles", newUser.uid), {
        role,
        user_id: newUser.uid,
      });

      if (role === "employee") {
        await addDoc(collection(db, "notifications"), {
          user_id: null,
          actor_id: newUser.uid,
          department_id: departmentId || null,
          title: "New employee registered",
          body: `${fullName} joined.`,
          type: "info",
          audience: "admin",
          read: false,
          created_at: serverTimestamp(),
        });
      }

      toast.success(
        role === "super_admin"
          ? "Super Admin account created — welcome!"
          : "Account created — welcome aboard",
      );
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="bg-primary/20 pointer-events-none absolute -top-32 -left-32 size-[420px] rounded-full blur-[130px]" />
      <div className="bg-info/15 pointer-events-none absolute -right-32 -bottom-32 size-[420px] rounded-full blur-[130px]" />

      <div className="animate-rise relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="brand-gradient text-primary-foreground flex size-12 items-center justify-center rounded-2xl shadow-lg">
            <Sparkles className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Nexus Work OS</h1>
            <p className="text-muted-foreground text-sm">Company work management system</p>
          </div>
        </div>

        {/* First-run banner */}
        {isFirstRun && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
            <ShieldCheck className="text-warning mt-0.5 size-5 shrink-0" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium">First-time setup</p>
              <p className="text-muted-foreground text-xs">
                No Super Admin exists yet. The first account you create will become the Super Admin.
              </p>
              {noDepartments && (
                <div className="pt-1">
                  <p className="text-muted-foreground text-xs mb-2">
                    No departments found. Click below to create the default departments so employees can register.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={seedDepartments}
                    disabled={seedingDepts}
                  >
                    {seedingDepts
                      ? <Loader2 className="size-3 animate-spin" />
                      : <Building2 className="size-3" />
                    }
                    {seedingDepts ? "Creating departments…" : "Create default departments"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="surface-card p-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            {/* ── Login ── */}
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lu">Username</Label>
                  <Input
                    id="lu"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="jane.doe"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp">Password</Label>
                  <Input
                    id="lp"
                    type="password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            {/* ── Register ── */}
            <TabsContent value="register" className="mt-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fn">Full name</Label>
                  <Input
                    id="fn"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="un">Username</Label>
                    <Input
                      id="un"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="jane.doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw">Password</Label>
                    <Input
                      id="pw"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Department{" "}
                    {isFirstRun && (
                      <span className="text-muted-foreground text-xs">(optional for Super Admin)</span>
                    )}
                  </Label>
                  {noDepartments ? (
                    <div className="rounded-lg border border-dashed p-3 text-center">
                      <p className="text-muted-foreground text-xs">
                        No departments yet.{" "}
                        {isFirstRun
                          ? "Use the \"Create default departments\" button above, or continue without one."
                          : "Ask your Super Admin to create departments first."}
                      </p>
                    </div>
                  ) : (
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jt">Job title</Label>
                  <Input
                    id="jt"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Frontend Developer"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isFirstRun ? "Create Super Admin account" : "Create account"}
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  {isFirstRun
                    ? "This will create the company Super Admin account."
                    : "Registering creates an employee account. Admins are created by a Super Admin."}
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
