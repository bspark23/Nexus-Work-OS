import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "projects",
  "tasks",
  "reports",
  "activities",
  "notifications",
  "departments",
  "profiles",
  "attachments",
  "user_roles",
  "customer_jobs",
  "customer_job_departments",
];

/** Keeps every dashboard in sync with the shared company database in real time. */
export function useLiveData(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel("nexus-live");
    TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries({ queryKey: [table] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      });
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
