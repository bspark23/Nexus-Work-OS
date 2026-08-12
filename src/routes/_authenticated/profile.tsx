import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, Loader2, LogOut, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useDepartments } from "@/hooks/useData";
import { updateProfile } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import { initials } from "@/lib/format";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Nexus Work OS" },
      { name: "description", content: "Manage your personal workspace profile details." },
    ],
  }),
  component: ProfilePage,
});

const MAX_AVATAR_BYTES = 800 * 1024; // 800 KB

function ProfilePage() {
  const { profile, refreshProfile, isAdmin, isDeptAdmin } = useAuth();
  const { data: departments = [] } = useDepartments();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: "", job_title: "", phone: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Resign dialog
  const [resignOpen, setResignOpen] = useState(false);
  const [resignReason, setResignReason] = useState("");
  const [resignBusy, setResignBusy] = useState(false);

  // Department transfer request dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDeptId, setTransferDeptId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const roleLabel = isAdmin ? "Super Admin" : isDeptAdmin ? "Dept Admin" : "Employee";
  const currentDept = departments.find(d => d.id === profile?.department_id);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        job_title: profile.job_title ?? "",
        phone: profile.phone ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  async function handleAvatarChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WebP)");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(`Image too large. Max 800 KB (yours is ${(file.size / 1024).toFixed(0)} KB).`);
      return;
    }
    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAvatarPreview(dataUrl);
        setAvatarData(dataUrl);
        setUploadingAvatar(false);
        toast.success("Photo ready — click Save to apply");
      };
      reader.onerror = () => { toast.error("Could not read file"); setUploadingAvatar(false); };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Could not process image");
      setUploadingAvatar(false);
    }
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        ...form,
        ...(avatarData ? { avatar_url: avatarData } : {}),
      });
      refreshProfile();
      setAvatarData(null);
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function submitResign() {
    if (!profile || !resignReason.trim()) return;
    setResignBusy(true);
    try {
      // Log a resignation request in Firestore — admins will see it in Activity
      await addDoc(collection(db, "activities"), {
        actor_id: profile.id,
        action: "submitted resignation",
        entity_type: "profile",
        entity_id: profile.id,
        department_id: profile.department_id ?? null,
        description: `${profile.full_name} submitted a resignation request. Reason: ${resignReason}`,
        created_at: serverTimestamp(),
      });
      // Notify all super admins
      await broadcast({
        title: "Resignation request submitted",
        body: `${profile.full_name} has submitted a resignation request: "${resignReason}"`,
        actorId: profile.id,
        type: "warning",
      });
      toast.success("Resignation request sent to Super Admin — you will be contacted.");
      setResignOpen(false);
      setResignReason("");
    } catch {
      toast.error("Could not submit resignation request");
    } finally {
      setResignBusy(false);
    }
  }

  async function submitTransferRequest() {
    if (!profile || !transferDeptId) return;
    setTransferBusy(true);
    const targetDept = departments.find(d => d.id === transferDeptId);
    try {
      await addDoc(collection(db, "activities"), {
        actor_id: profile.id,
        action: "requested department transfer",
        entity_type: "profile",
        entity_id: profile.id,
        department_id: profile.department_id ?? null,
        description: `${profile.full_name} requested transfer from ${currentDept?.name ?? "current department"} to ${targetDept?.name ?? "new department"}. Reason: ${transferReason || "Not specified"}`,
        created_at: serverTimestamp(),
      });
      await broadcast({
        title: "Department transfer request",
        body: `${profile.full_name} wants to transfer to ${targetDept?.name ?? "another department"}. ${transferReason ? `Reason: ${transferReason}` : ""}`,
        actorId: profile.id,
        type: "info",
      });
      toast.success(`Transfer request sent to Super Admin for review.`);
      setTransferOpen(false);
      setTransferDeptId("");
      setTransferReason("");
    } catch {
      toast.error("Could not submit transfer request");
    } finally {
      setTransferBusy(false);
    }
  }

  const displayAvatar = avatarPreview ?? profile?.avatar_url ?? undefined;

  return (
    <>
      <PageHeader title="My Profile" subtitle="Keep your details up to date for your team." />
      <div className="max-w-2xl space-y-5">

        {/* ── Profile card ── */}
        <div className="surface-card animate-rise space-y-6 p-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="size-20">
                <AvatarImage src={displayAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">
                  {initials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Change photo"
              >
                {uploadingAvatar
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Camera className="size-3.5" />
                }
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => handleAvatarChange(e.target.files)}
              />
            </div>
            <div>
              <p className="font-semibold">{profile?.full_name}</p>
              <p className="text-muted-foreground text-xs">
                @{profile?.username} · {roleLabel}
                {currentDept && <> · {currentDept.name}</>}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Click the camera icon to upload a photo (max 800 KB).
              </p>
            </div>
          </div>

          {/* Form fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Job title</Label>
              <Input
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="e.g. Frontend Developer"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+234 800 000 0000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="A short description about yourself…"
            />
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>

        {/* ── Employee actions (non-admins only) ── */}
        {!isAdmin && (
          <div className="surface-card animate-rise p-6 space-y-4">
            <h2 className="font-semibold text-sm">Employment Actions</h2>
            <p className="text-muted-foreground text-xs">
              These requests are sent to the Super Admin for review and approval. You will be contacted directly.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Department transfer */}
              <div className="rounded-xl border p-4 space-y-2">
                <p className="font-medium text-sm">Request Department Transfer</p>
                <p className="text-muted-foreground text-xs">
                  Currently in: <span className="text-foreground font-medium">{currentDept?.name ?? "Unassigned"}</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => { setTransferDeptId(""); setTransferReason(""); setTransferOpen(true); }}
                >
                  Request Transfer
                </Button>
              </div>

              {/* Resign */}
              <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                <p className="font-medium text-sm text-destructive flex items-center gap-1.5">
                  <LogOut className="size-4" /> Submit Resignation
                </p>
                <p className="text-muted-foreground text-xs">
                  This sends a formal resignation request to Super Admin.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => { setResignReason(""); setResignOpen(true); }}
                >
                  <LogOut className="size-3.5" /> Resign
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Department Transfer Dialog ── */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Department Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              You are currently in <strong>{currentDept?.name ?? "No department"}</strong>.
              Select the department you want to transfer to.
            </p>
            <div className="space-y-2">
              <Label>Transfer to *</Label>
              <Select value={transferDeptId} onValueChange={setTransferDeptId}>
                <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
                <SelectContent>
                  {departments
                    .filter(d => d.id !== profile?.department_id)
                    .map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Textarea
                rows={3}
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                placeholder="Why do you want to transfer?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={submitTransferRequest} disabled={transferBusy || !transferDeptId}>
              {transferBusy && <Loader2 className="size-4 animate-spin" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resign Dialog ── */}
      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" /> Submit Resignation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Your resignation request will be sent to the Super Admin. They will contact you to process the offboarding.
            </p>
            <div className="space-y-2">
              <Label>Reason for resigning *</Label>
              <Textarea
                rows={4}
                value={resignReason}
                onChange={e => setResignReason(e.target.value)}
                placeholder="Please explain your reason for resigning…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResignOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={submitResign}
              disabled={resignBusy || !resignReason.trim()}
            >
              {resignBusy && <Loader2 className="size-4 animate-spin" />}
              Submit Resignation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
