import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nexus Work OS" },
      {
        name: "description",
        content: "Sign in or register to access your company work management workspace.",
      },
      { property: "og:title", content: "Sign in — Nexus Work OS" },
      {
        property: "og:description",
        content: "Access projects, tasks and reports in your company workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: departments = [] } = useDepartments();
  const [busy, setBusy] = useState(false);

  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(loginUser),
      password: loginPass,
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid username or password");
      return;
    }
    await supabase.rpc("claim_initial_role" as never);
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!departmentId) {
      toast.error("Choose your department");
      return;
    }
    setBusy(true);
    const email = usernameToAuthEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error(error?.message ?? "Could not create the account");
      return;
    }

    if (!data.session) {
      await supabase.auth.signInWithPassword({ email, password });
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      username: username.trim().toLowerCase(),
      email,
      department_id: departmentId,
      job_title: jobTitle || null,
    } as never);

    if (profileError) {
      setBusy(false);
      toast.error(profileError.message);
      return;
    }

    await supabase.rpc("claim_initial_role" as never);
    setBusy(false);
    toast.success("Account created — welcome aboard");
    navigate({ to: "/dashboard", replace: true });
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

        <div className="surface-card p-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

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
                  <Label>Department</Label>
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
                  Create account
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  The first account registered becomes the company Super Admin.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
