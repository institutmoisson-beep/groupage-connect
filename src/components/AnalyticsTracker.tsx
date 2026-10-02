import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, PRESENCE_CHANNEL, trackPageView } from "@/lib/analytics";

export function AnalyticsTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    void trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    const ch = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: getSessionId() } },
    });
    channelRef.current = ch;
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
