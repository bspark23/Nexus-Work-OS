import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Don't re-fetch every time the user clicks back on the window.
        // This was the #1 cause of the app hanging — every window focus triggered
        // simultaneous Firestore reads for every mounted query.
        refetchOnWindowFocus: false,
        // Treat data as fresh for 2 minutes by default.
        // Individual queries can override this with a shorter staleTime.
        staleTime: 2 * 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
