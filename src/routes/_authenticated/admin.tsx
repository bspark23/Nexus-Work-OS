import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2, FolderKanban, ShieldCheck, Users, Plus, Pencil,
  Trash2, UserX, UserCheck, ChevronDown, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  doc, setDoc, updateDoc, deleteDoc, collection, addDoc,
  getDocs, query, where, serverTimestamp, writeBatch,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "@/integrations/firebase/config";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useDepartments, useProfiles, useProjects, useRoles } from "@/hooks/useData";
import { createDepartment, updateDepartment, deleteDepartment } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import { usernameToAuthEmail, ROLES } from "@/lib/constants";
import type { Department, Profile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Nexus Work OS" },
      { name: "description", content: "Super admin control centre for the company workspace." },
    ],
  }),
  component: AdminPage,
});

/* ─── types ─── */
type UserForm = {
  fullName: string; username: string; email: string;
  password: string; departmentId: string; jobTitle: string;
  role: "super_admin" | "admin" | "employee";
};
const emptyUserForm: UserForm = {
  fullName: "", username: "", email: "", password: "",
  departmentId: "", jobTitle: "", role: "employee",
};

type DeptForm = { name: string; description: string };
const emptyDeptForm: DeptForm = { name: "", description: "" };

/* ─── component ─── */
function AdminPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();

  const { data: people = [] } = useProfiles(isAdmin);
  const { data: departments = [] } = useDepartments();
  const { data: projects = [] } = useProjects(isAdmin);
  const { data: roles = [] } = useRoles(isAdmin);

  // User management state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [userBusy, setUserBusy] = useState(false);

  // Department management state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState<DeptForm>(emptyDeptForm);
  const [deptBusy, setDeptBusy] = useState(false);

  if (!isAdmin) {
    return (
      <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
        Super Admin access required.
      </div>
    );
  }

  const roleMap = Object.fromEntries(roles.map((r) => [r.user_id, r.role]));

  const superAdminsSorted = [...people.filter((u) => roleMap[u.id] === "super_admin")]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const originalSuperAdminId = superAdminsSorted[0]?.id;

  /* ─── user handlers ─── */
  function openAddUser() {
    setEditUser(null);
    setUserForm(emptyUserForm);
    setUserDialogOpen(true);
  }

  function openEditUser(p: Profile) {
    setEditUser(p);
    setUserForm({
      fullName: p.full_name,
      username: p.username,
      email: p.email,
      password: "",
      departmentId: p.department_id ?? "",
      jobTitle: p.job_title ?? "",
      role: (roleMap[p.id] as UserForm["role"]) ?? "employee",
    });
    setUserDialogOpen(true);
  }

  async function submitUser() {
    if (!userForm.fullName || !userForm.username) return;
    setUserBusy(true);
    try {
      if (editUser) {
        // Update profile directly in Firestore
        await updateDoc(doc(db, "profiles", editUser.id), {
          full_name: userForm.fullName,
          department_id: userForm.departmentId || null,
          job_title: userForm.jobTitle || null,
        });

        // Update role if changed
        const currentRole = roleMap[editUser.id];
        if (userForm.role !== currentRole) {
          // Guard: can't remove last super admin
          if (currentRole === "super_admin" && userForm.role !== "super_admin") {
            const superCount = roles.filter((r) => r.role === "super_admin").length;
            if (superCount <= 1) {
              toast.error("Cannot remove the last Super Admin");
              setUserBusy(false);
              return;
            }
          }
          await setDoc(doc(db, "user_roles", editUser.id), {
            role: userForm.role,
            user_id: editUser.id,
          });
          if (userForm.role === "admin") {
            await broadcast({
              userId: editUser.id,
              title: "You have been promoted to Department Admin",
              body: "Your role has been updated by a Super Admin.",
              actorId: user?.id ?? null,
              type: "promotion",
            });
          }
          if (userForm.role === "super_admin") {
            await broadcast({
              title: "New Super Admin added",
              body: `${userForm.fullName} is now a Super Admin.`,
              actorId: user?.id ?? null,
              type: "admin",
            });
          }
        }
        toast.success("User updated");
      } else {
        // Create new user via Firebase Auth + Firestore
        if (!userForm.password || userForm.password.length < 8) {
          toast.error("Password must be at least 8 characters");
          setUserBusy(false);
          return;
        }

        const authEmail = usernameToAuthEmail(userForm.username);

        // Check username taken
        const existing = await getDocs(
          query(collection(db, "profiles"), where("username", "==", userForm.username.trim().toLowerCase())),
        );
        if (!existing.empty) {
          toast.error("Username is already taken");
          setUserBusy(false);
          return;
        }

        const { user: newUser } = await createUserWithEmailAndPassword(auth, authEmail, userForm.password);

        await setDoc(doc(db, "profiles", newUser.uid), {
          id: newUser.uid,
          full_name: userForm.fullName,
          username: userForm.username.trim().toLowerCase(),
          email: userForm.email || authEmail,
          department_id: userForm.departmentId || null,
          job_title: userForm.jobTitle || null,
          status: "active",
          avatar_url: null,
          bio: null,
          phone: null,
          last_seen_at: serverTimestamp(),
          created_at: serverTimestamp(),
        });

        await setDoc(doc(db, "user_roles", newUser.uid), {
          role: userForm.role,
          user_id: newUser.uid,
        });

        await broadcast({
          title: "New user created",
          body: `${userForm.fullName} was added as ${userForm.role.replace("_", " ")}.`,
          actorId: user?.id ?? null,
          type: "info",
        });
        toast.success(`User "${userForm.fullName}" created — login: ${userForm.username} / ${userForm.password}`);
      }

      setUserDialogOpen(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save user");
    } finally {
      setUserBusy(false);
    }
  }

  async function toggleSuspend(p: Profile) {
    const newStatus = p.status === "suspended" ? "active" : "suspended";
    try {
      await updateDoc(doc(db, "profiles", p.id), { status: newStatus });
      toast.success(newStatus === "suspended" ? "User suspended" : "User activated");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  }

  async function deleteUser(p: Profile) {
    if (!confirm(`Delete ${p.full_name}? This cannot be undone.`)) return;
    try {
      // Guard: can't delete yourself
      if (p.id === user?.id) {
        toast.error("You cannot delete your own account");
        return;
      }
      // Guard: protect the original first Super Admin (earliest created_at)
      if (roleMap[p.id] === "super_admin") {
        const superAdmins = people.filter((u) => roleMap[u.id] === "super_admin");
        const sorted = [...superAdmins].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        if (sorted[0]?.id === p.id) {
          toast.error("The original Super Admin account cannot be deleted");
          return;
        }
        const superCount = roles.filter((r) => r.role === "super_admin").length;
        if (superCount <= 1) {
          toast.error("Cannot delete the last Super Admin");
          return;
        }
      }
      // Delete profile document and role document — this removes them from all counts
      const batch = writeBatch(db);
      batch.delete(doc(db, "profiles", p.id));
      batch.delete(doc(db, "user_roles", p.id));
      await batch.commit();
      toast.success(`${p.full_name} has been deleted`);
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["user_roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove user");
    }
  }

  /* ─── department handlers ─── */
  function openAddDept() {
    setEditDept(null);
    setDeptForm(emptyDeptForm);
    setDeptDialogOpen(true);
  }

  function openEditDept(d: Department) {
    setEditDept(d);
    setDeptForm({ name: d.name, description: d.description ?? "" });
    setDeptDialogOpen(true);
  }

  async function submitDept() {
    if (!deptForm.name) return;
    setDeptBusy(true);
    try {
      if (editDept) {
        await updateDepartment(editDept.id, { name: deptForm.name, description: deptForm.description || null });
        toast.success("Department updated");
      } else {
        await createDepartment({ name: deptForm.name, ...(deptForm.description ? { description: deptForm.description } : {}) });
        await broadcast({
          title: "New department created",
          body: `The "${deptForm.name}" department has been created.`,
          actorId: user?.id ?? null,
          type: "info",
        });
        toast.success("Department created");
      }
      setDeptDialogOpen(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save department");
    } finally {
      setDeptBusy(false);
    }
  }

  async function handleDeleteDept(d: Department) {
    const memberCount = people.filter((p) => p.department_id === d.id).length;
    const confirmMsg = memberCount > 0
      ? `Delete department "${d.name}"? ${memberCount} member${memberCount > 1 ? "s" : ""} will be moved to Unassigned so you can reassign them.`
      : `Delete department "${d.name}"? This cannot be undone.`;
    if (!confirm(confirmMsg)) return;
    try {
      // 1. Null out department_id on all members of this department
      const members = people.filter((p) => p.department_id === d.id);
      if (members.length > 0) {
        // Batch in chunks of 400 (Firestore max 500 per batch)
        for (let i = 0; i < members.length; i += 400) {
          const chunk = members.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((m) =>
            batch.update(doc(db, "profiles", m.id), { department_id: null }),
          );
          await batch.commit();
        }
      }
      // 2. Delete the department document
      await deleteDepartment(d.id);
      toast.success(
        memberCount > 0
          ? `"${d.name}" deleted — ${memberCount} member${memberCount > 1 ? "s" : ""} moved to Unassigned`
          : `"${d.name}" deleted`,
      );
      qc.invalidateQueries({ queryKey: ["departments"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete department");
    }
  }

  /* ─── clear all data (original super admin only) ─── */
  const [clearing, setClearing] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");

  async function clearAllData() {
    if (clearConfirmText !== "CLEAR ALL DATA") {
      toast.error('Type "CLEAR ALL DATA" to confirm');
      return;
    }
    setClearing(true);
    try {
      // Collections to clear (keep profiles and user_roles to preserve accounts)
      const collections = [
        "projects", "tasks", "reports", "activities",
        "notifications", "attachments", "customer_jobs",
        "customer_job_departments", "saved_files",
      ];

      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        // Firestore batch max 500 writes
        const chunks: typeof snap.docs[] = [];
        for (let i = 0; i < snap.docs.length; i += 400) {
          chunks.push(snap.docs.slice(i, i + 400));
        }
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }

      toast.success("All data cleared. The app is now ready for production use.");
      setClearConfirmOpen(false);
      setClearConfirmText("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear data");
    } finally {
      setClearing(false);
    }
  }

  /* ─── render ─── */
  return (
    <>
      <PageHeader title="Admin Panel" subtitle="Manage users, departments and company-wide settings." />

      {/* Clear All Data — only for the original (undeletable) super admin */}
      {user?.id === originalSuperAdminId && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm text-destructive">Reset App Data</p>
            <p className="text-muted-foreground text-xs">
              Clear all projects, tasks, reports, activities and files to start fresh for production. User accounts are kept.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { setClearConfirmText(""); setClearConfirmOpen(true); }}
          >
            <AlertTriangle className="size-4" /> Clear All Data
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Employees" value={people.length} icon={<Users className="size-5" />} />
        <StatCard label="Departments" value={departments.length} tone="info" icon={<Building2 className="size-5" />} />
        <StatCard label="Projects" value={projects.length} tone="success" icon={<FolderKanban className="size-5" />} />
        <StatCard label="Super Admins" value={roles.filter(r => r.role === "super_admin").length} tone="warning" icon={<ShieldCheck className="size-5" />} />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users" className="mt-4">
          <div className="surface-card animate-rise">
            <header className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">All Users</h2>
              <Button size="sm" onClick={openAddUser}>
                <Plus className="size-4" /> Add User
              </Button>
            </header>
            <div className="divide-y">
              {people.map((p) => {
                const role = roleMap[p.id] ?? "employee";
                const suspended = p.status === "suspended";
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{p.full_name}</p>
                      <p className="text-muted-foreground text-xs">
                        @{p.username} · {departments.find((d) => d.id === p.department_id)?.name ?? "No dept"}
                      </p>
                    </div>
                    <StatusBadge
                      label={role === "super_admin" ? "Super Admin" : role === "admin" ? "Dept Admin" : "Employee"}
                      tone={role === "super_admin" ? "warning" : role === "admin" ? "info" : "neutral"}
                    />
                    {suspended && <StatusBadge label="Suspended" tone="destructive" />}
                    {p.id === originalSuperAdminId && (
                      <StatusBadge label="Protected" tone="success" />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                          Actions <ChevronDown className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditUser(p)}>
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleSuspend(p)}>
                          {suspended
                            ? <><UserCheck className="size-4" /> Activate</>
                            : <><UserX className="size-4" /> Suspend</>
                          }
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteUser(p)}
                          disabled={p.id === user?.id || p.id === originalSuperAdminId}
                        >
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {people.length === 0 && (
                <p className="text-muted-foreground px-5 py-10 text-center text-sm">No users yet.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Departments Tab ── */}
        <TabsContent value="departments" className="mt-4">
          <div className="surface-card animate-rise">
            <header className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">Departments</h2>
              <Button size="sm" onClick={openAddDept}>
                <Plus className="size-4" /> Add Department
              </Button>
            </header>
            <div className="divide-y">
              {departments.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{d.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {people.filter((p) => p.department_id === d.id).length} members ·{" "}
                      {d.description ?? "No description"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => openEditDept(d)}>
                    <Pencil className="size-3" /> Edit
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDeleteDept(d)}>
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              ))}
              {departments.length === 0 && (
                <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                  No departments yet. Create one to get started.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add / Edit User Dialog ── */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? `Edit — ${editUser.full_name}` : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Full name *</Label>
                <Input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="jane.doe"
                  disabled={!!editUser}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="jane@company.com" />
              </div>
              {!editUser && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Password *</Label>
                  <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Min. 8 characters" minLength={8} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={userForm.departmentId} onValueChange={(v) => setUserForm({ ...userForm, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No department</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Job title</Label>
                <Input value={userForm.jobTitle} onChange={(e) => setUserForm({ ...userForm, jobTitle: e.target.value })} placeholder="Developer…" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Role *</Label>
                <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v as UserForm["role"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {userForm.role === "super_admin" && (
                  <p className="text-warning text-xs">⚠ This grants full company access.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitUser} disabled={userBusy || !userForm.fullName || !userForm.username}>
              {userBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              {editUser ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Department Dialog ── */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editDept ? "Edit Department" : "New Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="Web Development" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitDept} disabled={deptBusy || !deptForm.name}>
              {deptBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              {editDept ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Clear All Data Confirmation Dialog ── */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" /> Clear All Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              This will permanently delete all <strong>projects, tasks, reports, activities, notifications, file uploads,</strong> and <strong>customer jobs</strong>. User accounts are kept.
            </p>
            <p className="text-sm font-medium">Data stored in Firebase is permanent — it will not disappear on its own once you start using the app for real.</p>
            <div className="space-y-2">
              <Label>Type <span className="font-mono text-destructive">CLEAR ALL DATA</span> to confirm</Label>
              <Input
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="CLEAR ALL DATA"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={clearAllData}
              disabled={clearing || clearConfirmText !== "CLEAR ALL DATA"}
            >
              {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {clearing ? "Clearing…" : "Clear everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
