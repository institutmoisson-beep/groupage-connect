import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, PRESENCE_CHANNEL, setLivePresence, trackPageView } from "@/lib/analytics";

export function AnalyticsTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    void trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${PRESENCE_CHANNEL}`);
    if (existing) void supabase.removeChannel(existing);
    const ch = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: getSessionId() } },
    });
    channelRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ path?: string; user_id?: string | null }>>;
      setLivePresence(
        Object.entries(state).map(([key, metas]) => ({
          key,
          path: metas[metas.length - 1]?.path ?? "/",
          user_id: metas[metas.length - 1]?.user_id ?? null,
        })),
      );
    });
    ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      joinedRef.current = true;
      const { data } = await supabase.auth.getSession();
      await ch.track({
        path: window.location.pathname,
        user_id: data.session?.user.id ?? null,
        at: new Date().toISOString(),
      });
    });
    return () => {
      joinedRef.current = false;
      void supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !joinedRef.current) return;
    void supabase.auth.getSession().then(({ data }) =>
      ch.track({ path: pathname, user_id: data.session?.user.id ?? null, at: new Date().toISOString() }),
    );
  }, [pathname]);

  return null;
}
