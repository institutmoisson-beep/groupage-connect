import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, QrCode } from "lucide-react";

import { getHotelBooking } from "@/lib/hotels.functions";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/hotels/voucher/$bookingId")({
  validateSearch: (search: Record<string, unknown>) => ({ email: String(search.email ?? "") }),
  head: () => ({
    meta: [
      { title: "Bon de réservation hôtel — MSN Courtier" },
      { name: "description", content: "Bon de réservation bilingue français / mandarin à présenter à la réception." },
      { property: "og:title", content: "Bon de réservation hôtel — MSN Courtier" },
      { property: "og:description", content: "Adresse en mandarin, dates et référence de votre séjour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Voucher,
});

function Voucher() {
  const { bookingId } = Route.useParams();
  const { email } = Route.useSearch();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["hotel-voucher", bookingId, email],
    queryFn: () => getHotelBooking({ data: { bookingId, email } }),
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

  const hotel = (data.hotel_details ?? {}) as Record<string, string | number>;
  const room = (data.room_details ?? {}) as Record<string, string | number>;

  return (
    <div className="min-h-screen bg-muted/30 p-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5 print:border-0">
        <header className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <div className="font-display text-lg font-black text-primary">MSN Courtier</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Bon de réservation · 预订凭证
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold">{data.booking_reference}</div>
            <div className="text-[10px] text-muted-foreground">
              {data.supplier_confirmation_id ?? "Confirmation en attente"}
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hôtel · 酒店</h2>
            <p className="text-sm font-bold">{hotel.name}</p>
            <p className="text-sm">{hotel.name_zh}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hotel.address}</p>
            <p className="text-xs font-semibold">{hotel.address_zh}</p>
            <p className="mt-1 text-xs text-muted-foreground">Tél : {hotel.contact}</p>
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Séjour · 住宿</h2>
            <p className="text-xs">
              Arrivée / 入住 : <strong>{data.check_in_date}</strong>
            </p>
            <p className="text-xs">
              Départ / 退房 : <strong>{data.check_out_date}</strong>
            </p>
            <p className="text-xs">
              Chambres / 房间 : <strong>{data.rooms}</strong> · Voyageurs / 客人 : <strong>{data.guests}</strong>
            </p>
            <p className="mt-1 text-xs">
              {room.room_type} · {room.room_type_zh}
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Voyageur · 客人</h2>
            <p className="text-sm font-bold">{data.guest_name}</p>
            <p className="text-xs text-muted-foreground">{data.guest_email}</p>
            <p className="text-xs text-muted-foreground">{data.guest_phone}</p>
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paiement · 付款</h2>
            <p className="text-xs">
              {data.payment_model === "api_delegated" ? "À régler à l'hôtel / 到店付款" : "Prépayé via MSN / 预付"}
            </p>
            <p className="text-sm font-black text-primary">{formatMoney(Number(data.total_price), "XOF")}</p>
            <p className="text-[10px] text-muted-foreground">
              Statut : {data.status} · {data.payment_status}
            </p>
          </div>
        </section>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
          <QrCode className="h-8 w-8 shrink-0 text-primary" />
          Présentez cette référence à la réception. 请向前台出示此预订号。
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
