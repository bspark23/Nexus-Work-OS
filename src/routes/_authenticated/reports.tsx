import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useReports } from "@/hooks/useData";
import { saveReport, track } from "@/lib/api";
import { REPORT_STATUSES, REPORT_TYPES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Report } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Nexus Work OS" },
      { name: "description", content: "Submit daily, weekly and monthly work reports." },
      { property: "og:title", content: "Reports — Nexus Work OS" },
      { property: "og:description", content: "Daily, weekly and monthly work reporting." },
    ],
  }),
  component: ReportsPage,
});

const empty: Partial<Report> = {
  title: "",
  report_type: "daily",
  status: "submitted",
  report_date: new Date().toISOString().slice(0, 10),
};

function ReportsPage() {
  const { user, profile } = useAuth();
  const { data: reports = [] } = useReports();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Report>>(empty);

  async function submit() {
    if (!draft.title || !user) return;
    const id = await saveReport({
      ...draft,
      author_id: draft.author_id ?? user.id,
      department_id: draft.department_id ?? profile?.department_id ?? null,
    });
    await track({
      actorId: user.id,
      actorName: profile?.full_name ?? "Someone",
      action: "submitted a report",
      entityType: "report",
      entityId: id,
      detail: `${profile?.full_name ?? "Someone"} submitted the report “${draft.title}”`,
      type: "report",
    });
    toast.success("Report submitted");
    setOpen(false);
    setDraft(empty);
    qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Log what you completed, what blocked you and what's next."
        actions={
          <Button
            onClick={() => {
              setDraft(empty);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New report
          </Button>
        }
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No reports yet"
          description="Submit your first daily report so leadership can see your progress."
          action={
            <Button
              onClick={() => {
                setDraft(empty);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New report
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => (
            <article key={r.id} className="surface-card animate-rise space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{r.title}</h2>
                  <p className="text-muted-foreground text-xs">
                    {labelOf(REPORT_TYPES, r.report_type)} · {formatDate(r.report_date)}
                  </p>
                </div>
                <StatusBadge
                  label={labelOf(REPORT_STATUSES, r.status)}
                  tone={toneOf(REPORT_STATUSES, r.status)}
                />
              </div>
              {r.summary ? <p className="text-muted-foreground text-sm">{r.summary}</p> : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraft(r);
                  setOpen(true);
                }}
              >
                Open
              </Button>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Report" : "New report"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={draft.title ?? ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={draft.report_type ?? "daily"}
                  onValueChange={(v) => setDraft({ ...draft, report_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={draft.report_date ?? ""}
                  onChange={(e) => setDraft({ ...draft, report_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea
                rows={2}
                value={draft.summary ?? ""}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Completed work</Label>
              <Textarea
                rows={3}
                value={draft.completed_work ?? ""}
                onChange={(e) => setDraft({ ...draft, completed_work: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Challenges</Label>
              <Textarea
                rows={2}
                value={draft.challenges ?? ""}
                onChange={(e) => setDraft({ ...draft, challenges: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Next steps</Label>
              <Textarea
                rows={2}
                value={draft.next_steps ?? ""}
                onChange={(e) => setDraft({ ...draft, next_steps: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
