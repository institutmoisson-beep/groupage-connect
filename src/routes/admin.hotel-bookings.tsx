import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";

const STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
const PAY_STATUSES = ["pending", "paid", "refunded", "failed"] as const;

export const Route = createFileRoute("/admin/hotel-bookings")({
  head: () => ({
    meta: [{ title: "Réservations hôtel — Admin MSN" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminHotelBookings,
});

function AdminHotelBookings() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");

  const { data: rows, isError, error, isLoading } = useQuery({
    queryKey: ["admin-hotel-bookings", statusFilter, payFilter, modelFilter],
    queryFn: async () => {
      let q = supabase
        .from("hotel_bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (statusFilter) q = q.eq("status", statusFilter as any);
      if (payFilter) q = q.eq("payment_status", payFilter as any);
      if (modelFilter) q = q.eq("payment_model", modelFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isError) toast.error(`Erreur de chargement : ${(error as any)?.message ?? "inconnue"}`);
  }, [isError, error]);

  async function save(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("hotel_bookings").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-hotel-bookings"] });
    }
  }

  const totals = (rows ?? []).reduce(
    (acc, r: any) => {
      acc.count += 1;
      if (r.payment_status === "paid") acc.paidRevenue += Number(r.total_price ?? 0);
      acc.commission += Number(r.commission_amount ?? 0);
      return acc;
    },
    { count: 0, paidRevenue: 0, commission: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-black">Réservations hôtel</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
            <option value="">Tous statuts</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
            <option value="">Tout paiement</option>
            {PAY_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
            <option value="">Tout modèle</option>
            <option value="direct_merchant">Paiement direct (MSN)</option>
            <option value="api_delegated">Délégué fournisseur/hôtel</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-muted-foreground">Réservations</p>
          <p className="text-lg font-black">{totals.count}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-muted-foreground">CA encaissé (payé)</p>
          <p className="text-lg font-black text-primary">{formatMoney(totals.paidRevenue, "XOF")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-muted-foreground">Marge / commissions cumulées</p>
          <p className="text-lg font-black">{formatMoney(totals.commission, "XOF")}</p>
        </div>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1400px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Réf.</th>
              <th className="p-2">Client</th>
              <th className="p-2">Hôtel</th>
              <th className="p-2">Séjour</th>
              <th className="p-2">Modèle</th>
              <th className="p-2">Total</th>
              <th className="p-2">Marge/Commission</th>
              <th className="p-2">Statut résa</th>
              <th className="p-2">Statut paiement</th>
              <th className="p-2">Réf. paiement</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row: any) => (
              <BookingRow key={row.id} row={row} onSave={save} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingRow({ row, onSave }: { row: any; onSave: (id: string, patch: Record<string, unknown>) => void }) {
  const [status, setStatus] = useState<string>(row.status);
  const [paymentStatus, setPaymentStatus] = useState<string>(row.payment_status);
  const hotel = row.hotel_details ?? {};

  return (
    <tr className="border-b border-border align-top">
      <td className="p-2 text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString("fr-CI")}</td>
      <td className="p-2 font-mono text-[10px]">{row.booking_reference}</td>
      <td className="p-2">
        <div className="font-semibold">{row.guest_name ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground">{row.guest_email}</div>
        <div className="text-[10px] text-muted-foreground">{row.guest_phone}</div>
      </td>
      <td className="p-2">
        <div className="font-semibold">{hotel.name ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground">{hotel.city}, {hotel.country}</div>
      </td>
      <td className="p-2 text-[10px]">{row.check_in_date} → {row.check_out_date}</td>
      <td className="p-2 text-[10px]">
        {row.payment_model === "direct_merchant" ? "Direct (MSN)" : "Délégué"}
        <div className="text-muted-foreground">{row.payment_gateway}</div>
      </td>
      <td className="p-2 font-bold text-primary">{formatMoney(Number(row.total_price), row.currency ?? "XOF")}</td>
      <td className="p-2">
        <div>{formatMoney(Number(row.commission_amount ?? 0), row.currency ?? "XOF")}</div>
        <div className="text-[10px] text-muted-foreground">{row.commission_type ?? "—"}</div>
      </td>
      <td className="p-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-input bg-background px-1.5 py-1">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="rounded border border-input bg-background px-1.5 py-1">
          {PAY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>
      <td className="p-2 font-mono text-[10px]">{row.payment_reference ?? "—"}</td>
      <td className="p-2 text-right">
        <button
          onClick={() => onSave(row.id, { status, payment_status: paymentStatus })}
          className="rounded bg-primary p-1.5 text-primary-foreground"
          title="Enregistrer"
        >
          <Save className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
  }
            
