import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SID_KEY = "msn-analytics-sid";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem(SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID().replace(/-/g, "");
    sessionStorage.setItem(SID_KEY, sid);
  }
  return sid;
}

function device(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function trackPageView(path: string) {
  if (typeof window === "undefined") return;
  try {
    const ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : null;
    await supabase.from("app_events").insert({
      session_id: getSessionId(),
      user_id: await currentUserId(),
      event_type: "page_view",
      path: path.slice(0, 300),
      device: device(),
      referrer: ref?.slice(0, 300) ?? null,
    });
  } catch {
    /* ignore */
  }
}

export async function trackSearch(term: string, context: string) {
  const t = term.trim().toLowerCase().slice(0, 120);
  if (t.length < 2 || typeof window === "undefined") return;
  try {
    await supabase.from("app_events").insert({
      session_id: getSessionId(),
      user_id: await currentUserId(),
      event_type: "search",
      path: location.pathname.slice(0, 300),
      search_term: t,
      search_context: context,
      device: device(),
    });
  } catch {
    /* ignore */
  }
}

/** Logs a search term once the user stops typing for 1.5s. */
export function useTrackSearch(term: string, context: string) {
  useEffect(() => {
    if (term.trim().length < 2) return;
    const id = setTimeout(() => void trackSearch(term, context), 1500);
    return () => clearTimeout(id);
  }, [term, context]);
}

export const PRESENCE_CHANNEL = "msn-online-users";
