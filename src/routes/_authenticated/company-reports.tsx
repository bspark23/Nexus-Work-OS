import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ClipboardList } from "lucide-react";
import { useProfiles, useReports } from "@/hooks/useData";
import { REPORT_STATUSES, REPORT_TYPES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/company-reports")({
  head: () => ({
    meta: [
      { title: "Company Reports — Nexus Work OS" },
      { name: "description", content: "All employee reports submitted across the company." },
      { property: "og:title", content: "Company Reports — Nexus Work OS" },
      { property: "og:description", content: "All employee reports in one place." },
    ],
  }),
  component: CompanyReports,
});

function CompanyReports() {
  const { data: reports = [] } = useReports();
  const { data: people = [] } = useProfiles();

  if (reports.length === 0) {
    return (
      <>
        <PageHeader title="Company reports" subtitle="Every report submitted by the team." />
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="No reports submitted yet"
          description="Employee daily, weekly and monthly reports will appear here."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Company reports" subtitle="Every report submitted by the team." />
      <div className="surface-card animate-rise divide-y">
        {reports.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-muted-foreground text-xs">
                {people.find((p) => p.id === r.author_id)?.full_name ?? "Unknown"} ·{" "}
                {labelOf(REPORT_TYPES, r.report_type)} · {formatDate(r.report_date)}
              </p>
            </div>
            <StatusBadge
              label={labelOf(REPORT_STATUSES, r.status)}
              tone={toneOf(REPORT_STATUSES, r.status)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
