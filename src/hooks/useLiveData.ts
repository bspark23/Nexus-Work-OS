import { useEffect, useRef } from "react";
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

// How long to wait after the last snapshot event before invalidating the query cache.
// This prevents a cascade of re-fetches when Firestore fires many events quickly
// (e.g. a batch write, or multiple listeners firing at the same time).
const DEBOUNCE_MS = 2000;

/** Keeps every dashboard in sync with Firestore in real time, but throttled. */
export function useLiveData(enabled: boolean) {
  const queryClient = useQueryClient();
  // Per-collection debounce timers
  const timers = useRef<Partial<Record<string, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    if (!enabled) return;

    const unsubscribers = COLLECTIONS.map((col) =>
      onSnapshot(
        collection(db, col),
        { includeMetadataChanges: false },
        () => {
          // Debounce: clear any pending timer for this collection and schedule a fresh one.
          clearTimeout(timers.current[col]);
          timers.current[col] = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: [col] });
          }, DEBOUNCE_MS);
        },
      ),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      // Clear all pending debounce timers on unmount
      Object.values(timers.current).forEach((t) => clearTimeout(t));
    };
  }, [enabled, queryClient]);
}
