import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BedDouble, CheckCircle2, CreditCard, Hotel, MapPin, Star, Wallet } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { useTravelPrefs } from "@/hooks/use-travel-prefs";
import { bookHotel, initiateHotelPayment, prebookHotel, searchHotels } from "@/lib/hotels.functions";
import { BOARD_LABELS, TRADE_TAG_LABELS } from "@/lib/hotels-catalog";
import { formatFromXof } from "@/lib/currency";
import { t } from "@/lib/hotels-i18n";

interface HotelSearchParams {
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
}

export const Route = createFileRoute("/hotels/$hotelId")({
  validateSearch: (search: Record<string, unknown>): HotelSearchParams => ({
    checkIn: String(search.checkIn ?? new Date().toISOString().slice(0, 10)),
    checkOut: String(search.checkOut ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10)),
    rooms: Number(search.rooms ?? 1) || 1,
    guests: Number(search.guests ?? 1) || 1,
  }),
  head: () => ({
    meta: [
      { title: "Réservation d'hôtel — MSN Courtier" },
      {
        name: "description",
        content: "Choisissez votre chambre, votre mode de paiement et confirmez votre séjour d'affaires.",
      },
      { property: "og:title", content: "Réservation d'hôtel — MSN Courtier" },
      { property: "og:description", content: "Chambres, tarifs et conditions d'annulation en FCFA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HotelDetail,
});

function HotelDetail() {
  const { hotelId } = Route.useParams();
  const { checkIn, checkOut, rooms, guests } = Route.useSearch();
  const navigate = useNavigate();
  const prefs = useTravelPrefs();
  const lang = prefs.language;
  const { user } = useAuth();

  const [rateId, setRateId] = useState<string | null>(null);
  const [payAtHotel, setPayAtHotel] = useState(false);
  const [gateway, setGateway] = useState<"msn_smart" | "mobile_money_xof" | "stripe">("msn_smart");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["hotel", hotelId, checkIn, checkOut, rooms],
    queryFn: () => searchHotels({ data: { checkIn, checkOut, rooms, guests } }),
  });

  const hotel = data?.hotels.find((h) => h.id === hotelId);
  const nights = data?.nights ?? 1;
  const selected = hotel?.rates.find((r) => r.id === rateId) ?? hotel?.rates[0];
  const money = (xof: number) => formatFromXof(xof, prefs.currency, prefs.rates);

  const quote = useQuery({
    queryKey: ["hotel-prebook", hotelId, selected?.id, checkIn, checkOut, rooms],
    enabled: !!selected,
    queryFn: () =>
      prebookHotel({ data: { hotelId, rateId: selected!.id, checkIn, checkOut, rooms } }),
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Sélectionnez une chambre.");
      if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
        throw new Error("Renseignez le nom, l'email et le téléphone du voyageur.");
      }
      return bookHotel({
        data: {
          hotelId,
          rateId: selected.id,
          checkIn,
          checkOut,
          rooms,
          guests,
          guestName: form.name.trim(),
          guestEmail: form.email.trim(),
          guestPhone: form.phone.trim(),
          paymentModel: payAtHotel ? "api_delegated" : "direct_merchant",
          paymentGateway: payAtHotel ? "hotel_direct" : gateway,
        },
      });
    },
    onSuccess: async (res) => {
      toast.success(`Réservation ${res.booking_reference} enregistrée`);
      const email = form.email.trim();

      // Modèle 1 : le paiement se fait sur MSN via GeniusPay (Mobile Money / carte).
      // Modèle 2 (payAtHotel / hotel_direct) : réservation déjà confirmée, pas de paiement MSN.
      if (!payAtHotel) {
        try {
          const pay = await initiateHotelPayment({ data: { bookingId: res.id, email } });
          if (pay.paymentUrl) {
            window.location.href = pay.paymentUrl;
            return;
          }
        } catch (e) {
          toast.error((e as Error).message ?? "Paiement indisponible, réessayez depuis votre bon de réservation.");
        }
      }

      navigate({
        to: "/hotels/voucher/$bookingId",
        params: { bookingId: res.id },
        search: { email },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!hotel || !selected) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
          <p className="text-sm text-muted-foreground">Hôtel indisponible pour ces dates.</p>
          <Link to="/hotels" className="mt-3 inline-block text-xs font-bold text-primary">
            ← Retour à la recherche
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-8">
        <Link to="/hotels" className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t(lang, "search")}
        </Link>

        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
              <Hotel className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black">{hotel.name}</h1>
              <p className="text-[11px] text-muted-foreground">{hotel.name_zh}</p>
              <div className="mt-0.5 flex">
                {Array.from({ length: hotel.star_rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-secondary text-secondary" />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{hotel.description}</p>
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/40 p-2 text-[11px]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <div>{hotel.address}</div>
              <div className="font-semibold text-foreground">{hotel.address_zh}</div>
              <div className="text-muted-foreground">{hotel.contact}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {hotel.trade_tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold">
                {TRADE_TAG_LABELS[tag]}
              </span>
            ))}
          </div>
        </div>

        <h2 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Chambres · {nights} {t(lang, "nights")} · {rooms} {t(lang, "rooms")}
        </h2>
        <div className="mt-2 space-y-2">
          {hotel.rates.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRateId(r.id);
                if (!r.pay_at_hotel) setPayAtHotel(false);
              }}
              className={`w-full rounded-xl border p-3 text-left ${
                selected.id === r.id ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold">{r.room_type}</div>
                  <div className="text-[11px] text-muted-foreground">{r.room_type_zh}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {BOARD_LABELS[r.board_type]} ·{" "}
                    {r.refundable
                      ? `Annulation gratuite jusqu'à J-${r.free_cancellation_until_days}`
                      : "Non remboursable"}
                    {r.pay_at_hotel ? " · Paiement à l'hôtel possible" : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-sm font-black text-primary">{money(r.total_xof)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {money(r.per_night_public_xof)} {t(lang, "perNight")}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <section className="mt-4 space-y-2 rounded-xl border border-border bg-card p-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Voyageur principal</h2>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nom complet (comme sur le passeport)"
            maxLength={120}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder={user?.email ?? "email@exemple.com"}
            maxLength={255}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+225 07 00 00 00 00"
            maxLength={30}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {!user && (
            <p className="text-[10px] text-muted-foreground">
              Réservation en tant qu'invité possible : elle sera automatiquement rattachée à votre compte si vous vous
              inscrivez plus tard avec ce même email.
            </p>
          )}
        </section>

        <section className="mt-3 space-y-2 rounded-xl border border-border bg-card p-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paiement</h2>
          <button
            onClick={() => setPayAtHotel(false)}
            className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left ${
              !payAtHotel ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <CreditCard className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-xs font-bold">{t(lang, "payNow")} — MSN encaisse</div>
              <div className="text-[10px] text-muted-foreground">Mobile Money / carte, confirmation par MSN</div>
            </div>
          </button>
          {!payAtHotel && (
            <div className="ml-6 flex flex-wrap gap-1.5">
              {(
                [
                  ["msn_smart", "MSN Smart (preuve)"],
                  ["mobile_money_xof", "Mobile Money"],
                  ["stripe", "Carte bancaire"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setGateway(value)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    gateway === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            disabled={!selected.pay_at_hotel}
            onClick={() => setPayAtHotel(true)}
            className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left disabled:opacity-40 ${
              payAtHotel ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Wallet className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-xs font-bold">{t(lang, "payAtHotel")} — paiement délégué</div>
              <div className="text-[10px] text-muted-foreground">
                {selected.pay_at_hotel
                  ? "Confirmation immédiate, règlement sur place"
                  : "Non disponible pour ce tarif"}
              </div>
            </div>
          </button>
        </section>

        <section className="mt-3 rounded-xl border border-border bg-card p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tarif fournisseur</span>
            <span>{money(selected.supplier_net_total_xof)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service MSN (7 %)</span>
            <span>{money(selected.markup_xof)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-black text-primary">
            <span>{t(lang, "total")}</span>
            <span>{money(selected.total_xof)}</span>
          </div>
          {quote.data && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              {quote.data.cancellation_policy.refundable
                ? `Annulation gratuite jusqu'au ${quote.data.cancellation_policy.free_until}`
                : "Tarif non remboursable"}
            </p>
          )}
        </section>

        <button
          onClick={() => book.mutate()}
          disabled={book.isPending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-3 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60"
        >
          <BedDouble className="h-4 w-4" />
          {book.isPending ? "Réservation…" : `${t(lang, "book")} · ${money(selected.total_xof)}`}
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
