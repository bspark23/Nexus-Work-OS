import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "@/lib/api";
import { initials } from "@/lib/format";

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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: "", job_title: "", phone: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const roleLabel = isAdmin ? "Super Admin" : isDeptAdmin ? "Dept Admin" : "Employee";

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

  const displayAvatar = avatarPreview ?? profile?.avatar_url ?? undefined;

  return (
    <>
      <PageHeader title="My Profile" subtitle="Keep your details up to date for your team." />
      <div className="surface-card animate-rise max-w-2xl space-y-6 p-6">
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
            <p className="text-muted-foreground text-xs">@{profile?.username} · {roleLabel}</p>
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
    </>
  );
}
