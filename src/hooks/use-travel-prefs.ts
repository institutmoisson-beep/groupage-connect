import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_RATES, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/currency";
import { LANGUAGES, type Language } from "@/lib/hotels-i18n";

const STORAGE_KEY = "msn-travel-prefs";

interface Prefs {
  currency: SupportedCurrency;
  language: Language;
}

/** Currency + language preference, persisted locally and in the account when signed in. */
export function useTravelPrefs() {
  const [prefs, setPrefs] = useState<Prefs>({ currency: "XOF", language: "FR" });
  const [rates, setRates] = useState<Partial<Record<SupportedCurrency, number>>>(FALLBACK_RATES);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({
          currency: SUPPORTED_CURRENCIES.includes(parsed.currency as SupportedCurrency)
            ? (parsed.currency as SupportedCurrency)
            : "XOF",
          language: LANGUAGES.includes(parsed.language as Language) ? (parsed.language as Language) : "FR",
        });
      }
    } catch {
      /* ignore malformed storage */
    }

    void (async () => {
      const { data } = await supabase.from("exchange_rates").select("quote_currency, rate").eq("base_currency", "XOF");
      if (data?.length) {
        const map: Partial<Record<SupportedCurrency, number>> = {};
        for (const row of data) map[row.quote_currency as SupportedCurrency] = Number(row.rate);
        setRates({ ...FALLBACK_RATES, ...map });
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: pref } = await supabase
        .from("user_preferences")
        .select("default_currency, preferred_language")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (pref) {
        setPrefs({
          currency: (pref.default_currency as SupportedCurrency) ?? "XOF",
          language: (pref.preferred_language as Language) ?? "FR",
        });
      }
    })();
  }, []);

  async function update(next: Partial<Prefs>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* storage unavailable */
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("user_preferences").upsert(
      {
        user_id: auth.user.id,
        default_currency: merged.currency,
        preferred_language: merged.language,
      } as never,
      { onConflict: "user_id" },
    );
  }

  return { ...prefs, rates, update };
}
