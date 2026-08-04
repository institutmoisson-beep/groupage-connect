import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, QrCode, BadgeCheck } from "lucide-react";

import { getCustomHotelBooking } from "@/lib/hotels.functions";
import { formatMoney, type SupportedCurrency } from "@/lib/currency";

export const Route = createFileRoute("/hotels/voucher-direct/$bookingId")({
  validateSearch: (search: Record<string, unknown>) => ({ email: String(search.email ?? "") }),
  head: () => ({
    meta: [
      { title: "Bon de réservation — Partenaire Direct MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VoucherDirect,
});

function VoucherDirect() {
  const { bookingId } = Route.useParams();
  const { email } = Route.useSearch();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["custom-hotel-voucher", bookingId, email],
    queryFn: () => getCustomHotelBooking({ data: { bookingId, email } }),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Chargement du bon…</p>;
  if (isError || !data)
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{(error as Error)?.message ?? "Bon introuvable."}</p>
        <Link to="/hotels" className="mt-2 inline-block text-xs font-bold text-primary">
          ← Hôtels
        </Link>
      </div>
    );

  const hotel = (data as any).hotel ?? {};
  const room = (data as any).room ?? {};

  return (
    <div className="min-h-screen bg-muted/30 p-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5 print:border-0">
        <header className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <div className="font-display text-lg font-black text-primary">MSN Courtier</div>
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              <BadgeCheck className="h-3 w-3" /> Partenaire Direct MSN
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold">{data.booking_reference}</div>
            <div className="text-[10px] text-muted-foreground">Réservation en direct</div>
          </div>
        </header>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hôtel</h2>
            <p className="text-sm font-bold">{hotel.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hotel.address}</p>
            <p className="text-xs text-muted-foreground">{hotel.city}, {hotel.country}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tél : {hotel.contact_phone} {hotel.contact_email ? `· ${hotel.contact_email}` : ""}
            </p>
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Séjour</h2>
            <p className="text-xs">Arrivée : <strong>{data.check_in_date}</strong></p>
            <p className="text-xs">Départ : <strong>{data.check_out_date}</strong></p>
            <p className="text-xs">Chambres : <strong>{data.rooms_booked}</strong></p>
            <p className="mt-1 text-xs">{room.room_type}</p>
          </div>
        </section>

        <section className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Voyageur</h2>
            <p className="text-sm font-bold">{data.guest_name}</p>
            <p className="text-xs text-muted-foreground">{data.guest_email}</p>
            <p className="text-xs text-muted-foreground">{data.guest_phone}</p>
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paiement</h2>
            <p className="text-xs">Prépayé via MSN (Mobile Money / carte)</p>
            <p className="text-sm font-black text-primary">{formatMoney(Number(data.total_price), (data.currency as SupportedCurrency || "XOF"))}</p>
            <p className="text-[10px] text-muted-foreground">
              Statut : {data.booking_status} · {data.payment_status}
            </p>
          </div>
        </section>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
          <QrCode className="h-8 w-8 shrink-0 text-primary" />
          Présentez cette référence à la réception de l'hôtel.
        </div>

        <div className="mt-4 flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimer / PDF
          </button>
          <Link
            to="/hotels/bookings"
            className="flex flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary"
          >
            Mes réservations
          </Link>
        </div>
      </div>
    </div>
  );
}
