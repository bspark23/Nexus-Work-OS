import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
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
      { property: "og:title", content: "My Profile — Nexus Work OS" },
      { property: "og:description", content: "Manage your workspace profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, refreshProfile, isAdmin } = useAuth();
  const [form, setForm] = useState({ full_name: "", job_title: "", phone: "", bio: "" });

  useEffect(() => {
    if (profile)
      setForm({
        full_name: profile.full_name,
        job_title: profile.job_title ?? "",
        phone: profile.phone ?? "",
        bio: profile.bio ?? "",
      });
  }, [profile]);

  async function save() {
    if (!profile) return;
    await updateProfile(profile.id, form);
    refreshProfile();
    toast.success("Profile updated");
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details up to date for your team." />
      <div className="surface-card animate-rise max-w-2xl space-y-5 p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
              {initials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{profile?.full_name}</p>
            <p className="text-muted-foreground text-xs">
              @{profile?.username} · {isAdmin ? "Super Admin" : "Employee"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
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
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>
        <Button onClick={save}>Save changes</Button>
      </div>
    </>
  );
}
