import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, FileText, Hotel, XCircle } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { useTravelPrefs } from "@/hooks/use-travel-prefs";
import { supabase } from "@/integrations/supabase/client";
import { cancelHotelBooking } from "@/lib/hotels.functions";
import { formatFromXof } from "@/lib/currency";
import { t } from "@/lib/hotels-i18n";

export const Route = createFileRoute("/hotels/bookings")({
  head: () => ({
    meta: [
      { title: "Mes réservations d'hôtel — MSN Courtier" },
      { name: "description", content: "Suivez, annulez et téléchargez les bons de vos réservations d'hôtel MSN." },
      { property: "og:title", content: "Mes réservations d'hôtel — MSN Courtier" },
      { property: "og:description", content: "Historique de vos séjours d'affaires réservés via MSN Courtier." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HotelBookings,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
};

function HotelBookings() {
  const { user, loading } = useAuth();
  const prefs = useTravelPrefs();
  const lang = prefs.language;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-hotel-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancel = useMutation({
    mutationFn: (b: { id: string; guest_email: string }) =>
      cancelHotelBooking({ data: { bookingId: b.id, email: b.guest_email } }),
    onSuccess: (res) => {
      toast.success(
        res.penalty_xof > 0
          ? `Réservation annulée — pénalité ${formatFromXof(res.penalty_xof, prefs.currency, prefs.rates)}`
          : "Réservation annulée sans frais",
      );
      qc.invalidateQueries({ queryKey: ["my-hotel-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (xof: number) => formatFromXof(xof, prefs.currency, prefs.rates);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-8">
        <h1 className="font-display text-xl font-black">{t(lang, "myBookings")}</h1>

        {!loading && !user && (
          <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Connectez-vous pour retrouver vos réservations.{" "}
            <Link to="/auth" className="font-bold text-primary">
              Se connecter
            </Link>
          </p>
        )}

        {user && isLoading && <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>}

        {user && data?.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Aucune réservation pour l'instant.{" "}
            <Link to="/hotels" className="font-bold text-primary">
              Chercher un hôtel
            </Link>
          </p>
        )}

        <div className="mt-4 space-y-3">
          {(data ?? []).map((b) => {
            const hotel = (b.hotel_details ?? {}) as { name?: string; name_zh?: string; city?: string };
            const room = (b.room_details ?? {}) as { room_type?: string };
            return (
              <article key={b.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
                    <Hotel className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold">{hotel.name ?? "Hôtel"}</h2>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {hotel.name_zh} · {hotel.city}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase">
                    {STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {b.check_in_date} → {b.check_out_date} · {room.room_type}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">{b.booking_reference}</span>
                  <span className="font-display text-sm font-black text-primary">
                    {money(Number(b.total_price))}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Link
                    to="/hotels/voucher/$bookingId"
                    params={{ bookingId: b.id }}
                    search={{ email: b.guest_email }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-bold text-primary"
                  >
                    <FileText className="h-3.5 w-3.5" /> {t(lang, "voucher")}
                  </Link>
                  {b.status !== "cancelled" && (
                    <button
                      onClick={() => cancel.mutate({ id: b.id, guest_email: b.guest_email })}
                      disabled={cancel.isPending}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-destructive/40 px-2 py-1.5 text-[11px] font-bold text-destructive disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> {t(lang, "cancel")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
