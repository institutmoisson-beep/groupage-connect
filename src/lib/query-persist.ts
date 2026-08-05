import type { QueryClient } from "@tanstack/react-query";

/**
 * Cache persistant léger (localStorage) pour le cache React Query.
 *
 * Effet à grande échelle : au retour dans l'application, les écrans s'affichent
 * instantanément depuis le cache local puis se rafraîchissent en arrière-plan.
 * Cela supprime la majorité des requêtes réseau au démarrage — c'est ce qui
 * permet de tenir une très forte audience simultanée sans saturer le backend.
 */

const STORAGE_KEY = "msn-query-cache-v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 h
const MAX_BYTES = 1_500_000; // garde-fou localStorage (~1,5 Mo)
const WRITE_DEBOUNCE_MS = 1500;

/** Ne jamais persister ce qui est sensible ou volatile. */
const DENY_LIST = ["session", "auth", "profile", "wallet", "withdrawals", "admin", "messages"];

type Entry = { key: unknown[]; data: unknown; at: number };

function isPersistable(key: unknown[]): boolean {
  const flat = key.map(String).join("/").toLowerCase();
  return !DENY_LIST.some((deny) => flat.includes(deny));
}

export function setupQueryPersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") return;

  // 1. Hydratation
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const entries = JSON.parse(raw) as Entry[];
      const now = Date.now();
      for (const entry of entries) {
        if (now - entry.at > MAX_AGE_MS) continue;
        queryClient.setQueryData(entry.key, entry.data, { updatedAt: entry.at });
      }
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  // 2. Sauvegarde différée
  let timer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    try {
      const entries: Entry[] = [];
      for (const query of queryClient.getQueryCache().getAll()) {
        if (query.state.status !== "success" || query.state.data === undefined) continue;
        if (!isPersistable(query.queryKey as unknown[])) continue;
        entries.push({
          key: query.queryKey as unknown[],
          data: query.state.data,
          at: query.state.dataUpdatedAt,
        });
      }
      let payload = JSON.stringify(entries);
      while (payload.length > MAX_BYTES && entries.length > 0) {
        entries.shift();
        payload = JSON.stringify(entries);
      }
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // quota dépassé ou mode privé : on ignore, le cache mémoire suffit
    }
  };

  queryClient.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, WRITE_DEBOUNCE_MS);
  });

  window.addEventListener("pagehide", persist);
}
