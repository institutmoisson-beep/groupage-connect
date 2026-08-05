import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupQueryPersistence } from "./lib/query-persist";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache agressif : les écrans se servent d'abord du cache, puis
        // se rafraîchissent en arrière-plan. Moins de requêtes = plus de
        // requêtes simultanées supportées par le backend.
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
        // Backoff exponentiel : évite l'effet « troupeau » si le backend ralentit.
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
        structuralSharing: true,
        networkMode: "offlineFirst",
      },
      mutations: { retry: 0, networkMode: "online" },
    },
  });

  setupQueryPersistence(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Précharge au survol/toucher en réutilisant le cache existant.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 1000 * 30,
    defaultPreloadDelay: 40,
  });

  return router;
};
