import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BedDouble, Building2, Filter, Languages, Search, Star, Coins, ArrowRightLeft, BadgeCheck } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useTravelPrefs } from "@/hooks/use-travel-prefs";
import { searchHotels } from "@/lib/hotels.functions";
import { DESTINATIONS, TRADE_TAG_LABELS, BOARD_LABELS, type TradeTag } from "@/lib/hotels-catalog";
import { SUPPORTED_CURRENCIES, formatFromXof } from "@/lib/currency";
import { LANGUAGES, LANGUAGE_LABELS, t } from "@/lib/hotels-i18n";

export const Route = createFileRoute("/hotels/")({
  head: () => ({
    meta: [
      { title: "Hôtels voyages d'affaires Chine — MSN Courtier" },
      {
        name: "description",
        content:
          "Recherchez, comparez et réservez vos hôtels à Guangzhou, Yiwu, Shenzhen et Dubaï. Tarifs en FCFA, paiement Mobile Money ou à l'hôtel.",
      },
      { property: "og:title", content: "Hôtels voyages d'affaires Chine — MSN Courtier" },
      {
        property: "og:description",
        content: "Moteur de réservation hôtelière optimisé pour les importateurs ouest-africains.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HotelsSearch,
});

function today(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const ALL_TAGS = Object.keys(TRADE_TAG_LABELS) as TradeTag[];

function HotelsSearch() {
  const navigate = useNavigate();
  const prefs = useTravelPrefs();
  const lang = prefs.language;

  const [city, setCity] = useState("Guangzhou");
  const [checkIn, setCheckIn] = useState(today(14));
  const [checkOut, setCheckOut] = useState(today(19));
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(1);
  const [minStars, setMinStars] = useState(0);
  const [tags, setTags] = useState<TradeTag[]>([]);
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [payAtHotelOnly, setPayAtHotelOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);

  const search = useMutation({
    mutationFn: () =>
      searchHotels({
        data: {
          city,
          checkIn,
          checkOut,
          rooms,
          guests,
          minStars: minStars || undefined,
          tags: tags.length ? tags : undefined,
          refundableOnly: refundableOnly || undefined,
          payAtHotelOnly: payAtHotelOnly || undefined,
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const results = search.data?.hotels ?? [];
  const nights = search.data?.nights ?? 0;
  const money = (xof: number) => formatFromXof(xof, prefs.currency, prefs.rates);
  const compared = results.filter((h) => compare.includes(h.id));

  function toggleCompare(id: string) {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-black">{t(lang, "title")}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(lang, "subtitle")}</p>
          </div>
          <Link
            to="/hotels/bookings"
            className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-primary"
          >
            {t(lang, "myBookings")}
          </Link>
        </div>

        <div className="mt-3 flex gap-2">
          <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={prefs.currency}
              onChange={(e) => void prefs.update({ currency: e.target.value as never })}
              className="w-full bg-transparent text-xs font-semibold outline-none"
              aria-label="Devise"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5">
            <Languages className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={lang}
              onChange={(e) => void prefs.update({ language: e.target.value as never })}
              className="w-full bg-transparent text-xs font-semibold outline-none"
              aria-label="Langue"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="mt-3 space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t(lang, "destination")}
            </span>
            <input
              list="msn-destinations"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Guangzhou, Yiwu, Dubaï…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <datalist id="msn-destinations">
              {DESTINATIONS.map((d) => (
                <option key={d.city} value={d.city}>
                  {d.city_zh} · {d.country}
                </option>
              ))}
            </datalist>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(lang, "checkIn")}
              </span>
              <input
                type="date"
                value={checkIn}
                min={today()}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(lang, "checkOut")}
              </span>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(lang, "rooms")}
              </span>
              <input
                type="number"
                min={1}
                max={9}
                value={rooms}
                onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(lang, "guests")}
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              />
            </label>
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-primary"
          >
            <Filter className="h-3.5 w-3.5" /> {t(lang, "filters")}
          </button>

          {showFilters && (
            <div className="space-y-2 rounded-lg bg-muted/40 p-2.5">
              <label className="flex items-center justify-between text-xs font-semibold">
                {t(lang, "stars")}
                <select
                  value={minStars}
                  onChange={(e) => setMinStars(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value={0}>Toutes</option>
                  <option value={3}>3+</option>
                  <option value={4}>4+</option>
                  <option value={5}>5</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={refundableOnly}
                  onChange={(e) => setRefundableOnly(e.target.checked)}
                />
                Annulation gratuite uniquement
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={payAtHotelOnly}
                  onChange={(e) => setPayAtHotelOnly(e.target.checked)}
                />
                Paiement à l'hôtel possible
              </label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALL_TAGS.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => setTags((p) => (on ? p.filter((x) => x !== tag) : [...p, tag]))}
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                        on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                      }`}
                    >
                      {TRADE_TAG_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => search.mutate()}
            disabled={search.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60"
          >
            <Search className="h-4 w-4" /> {search.isPending ? "…" : t(lang, "search")}
          </button>
        </section>

        {search.isSuccess && (
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            {results.length} {t(lang, "results")} · {nights} {t(lang, "nights")} · {t(lang, "cheapest")}
          </p>
        )}

        {search.isSuccess && results.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {t(lang, "noResults")}
          </p>
        )}

        {compared.length >= 2 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-primary/40 bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary">
              <ArrowRightLeft className="h-3.5 w-3.5" /> {t(lang, "compare")} ({compared.length})
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-2">Hôtel</th>
                  <th className="pb-1 pr-2">{t(lang, "stars")}</th>
                  <th className="pb-1 pr-2">{t(lang, "total")}</th>
                  <th className="pb-1">Annulation</th>
                </tr>
              </thead>
              <tbody>
                {compared.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className="py-1.5 pr-2 font-semibold">{h.name}</td>
                    <td className="py-1.5 pr-2">{h.star_rating}★</td>
                    <td className="py-1.5 pr-2 font-bold text-primary">{money(h.cheapest_total_xof)}</td>
                    <td className="py-1.5">{h.rates[0]?.refundable ? "Gratuite" : "Non remboursable"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {results.map((h) => (
            <article key={h.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-sm font-bold">{h.name}</h2>
                    {h.is_direct_partner && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
                        <BadgeCheck className="h-2.5 w-2.5" /> Partenaire Direct MSN
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {h.name_zh} · {h.city_zh}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {Array.from({ length: h.star_rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-secondary text-secondary" />
                    ))}
                    <span className="ml-1 truncate">
                      {h.city}, {h.country}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{h.description}</p>

              <div className="mt-2 flex flex-wrap gap-1">
                {h.trade_tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-foreground">
                    {TRADE_TAG_LABELS[tag]}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex items-end justify-between gap-2 border-t border-border pt-2">
                <div>
                  <div className="text-[10px] text-muted-foreground">
                    {BOARD_LABELS[h.rates[0]!.board_type]} · {h.rates[0]!.rooms} × {nights}{" "}
                    {t(lang, "nights")}
                  </div>
                  <div className="font-display text-base font-black text-primary">
                    {money(h.cheapest_total_xof)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {money(h.rates[0]!.per_night_public_xof)} {t(lang, "perNight")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    onClick={() => toggleCompare(h.id)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                      compare.includes(h.id)
                        ? "bg-secondary text-secondary-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {t(lang, "compare")}
                  </button>
                  <button
                    onClick={() =>
                      navigate({
                        to: "/hotels/$hotelId",
                        params: { hotelId: h.id },
                        search: { checkIn, checkOut, rooms, guests },
                      })
                    }
                    className="flex items-center gap-1 rounded-lg bg-gradient-brand px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-brand"
                  >
                    <BedDouble className="h-3.5 w-3.5" /> {t(lang, "book")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
