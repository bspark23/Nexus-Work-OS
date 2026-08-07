import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

const COLLECTIONS = [
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
] as const;

/** Keeps every dashboard in sync with Firestore in real time. */
export function useLiveData(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const unsubscribers = COLLECTIONS.map((col) =>
      onSnapshot(
        collection(db, col),
        { includeMetadataChanges: false },
        () => {
          queryClient.invalidateQueries({ queryKey: [col] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
      ),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled, queryClient]);
}
