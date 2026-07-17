import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Save, Trash2, MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { SourcingChat } from "@/components/SourcingChat";

export const Route = createFileRoute("/admin/sourcing")({
  component: AdminSourcing,
});

const STATUSES = [
  "quote_pending",
  "quoted",
  "paid",
  "ordered_china",
  "qc",
  "shipped",
  "transit",
  "abidjan",
  "delivered",
  "cancelled",
];

function AdminSourcing() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");

  const {
    data: rows,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-sourcing", filter],
    queryFn: async () => {
      let q = supabase
        .from("custom_sourcing_orders")
        .select("*, profiles(full_name, phone)")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error(`Erreur de chargement du sourcing : ${(error as any)?.message ?? "inconnue"}`);
    }
  }, [isError, error]);

  async function save(id: string, patch: any) {
    const { error } = await supabase.from("custom_sourcing_orders").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-sourcing"] });
    }
  }
  async function del(id: string) {
    if (!confirm("Supprimer cette demande ?")) return;
    const { error } = await supabase.from("custom_sourcing_orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-sourcing"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold">Sourcing custom</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
        >
          <option value="all">Tous</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune demande.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(rows ?? []).map((r: any) => (
            <SourcingRow key={r.id} row={r} onSave={save} onDelete={del} adminUserId={user?.id} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SourcingRow({
  row,
  onSave,
  onDelete,
  adminUserId,
}: {
  row: any;
  onSave: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
  adminUserId?: string;
}) {
  const [showChat, setShowChat] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [edit, setEdit] = useState({
    status: row.status,
    final_total_xof: row.final_total_xof ?? "",
    msn_commission_xof: row.msn_commission_xof ?? "",
    admin_notes: row.admin_notes ?? "",
    qc_images: (row.qc_images ?? []).join(", "),
  });

  useEffect(() => {
    if (showChat) {
      // Laisse le panneau de discussion se monter avant de défiler vers lui, pour que
      // l'admin voie clairement qu'il a bien accès à la discussion (le bouton semblait
      // "ne rien faire" quand le panneau s'ouvrait hors de la zone visible).
      const t = setTimeout(
        () => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        50,
      );
      return () => clearTimeout(t);
    }
  }, [showChat]);

  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold">{row.product_name}</div>
          <div className="text-[10px] text-muted-foreground">
            {row.profiles?.full_name ?? "?"} · {row.profiles?.phone ?? ""}
          </div>
        </div>
        <a
          href={row.source_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold"
        >
          <ExternalLink className="h-3 w-3" /> Voir source
        </a>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[11px]">
        <div>
          <span className="text-muted-foreground">CNY :</span>{" "}
          <span className="font-semibold">
            {row.cny_unit_price ?? "—"} × {row.quantity}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Type :</span>{" "}
          <span className="font-semibold">{row.shipping_type}</span>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Estimé :</span>{" "}
          <span className="font-semibold">
            {row.estimated_total_xof ? formatXOF(Number(row.estimated_total_xof)) : "—"}
          </span>
        </div>
      </div>

      {row.notes && (
        <div className="rounded-lg bg-muted p-2 text-[11px]">
          <span className="font-semibold">Client :</span> {row.notes}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">Statut</span>
          <select
            value={edit.status}
            onChange={(e) => setEdit({ ...edit, status: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Total final XOF</span>
          <input
            type="number"
            value={edit.final_total_xof}
            onChange={(e) => setEdit({ ...edit, final_total_xof: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Commission MSN XOF</span>
          <input
            type="number"
            value={edit.msn_commission_xof}
            onChange={(e) => setEdit({ ...edit, msn_commission_xof: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="col-span-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">
            Photos QC (URLs séparées par virgule)
          </span>
          <textarea
            value={edit.qc_images}
            onChange={(e) => setEdit({ ...edit, qc_images: e.target.value })}
            rows={2}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="col-span-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">Notes admin</span>
          <textarea
            value={edit.admin_notes}
            onChange={(e) => setEdit({ ...edit, admin_notes: e.target.value })}
            rows={2}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setShowChat((v) => !v)}
        aria-expanded={showChat}
        className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
          showChat
            ? "bg-muted text-foreground"
            : "bg-gradient-brand text-primary-foreground shadow-brand"
        }`}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {showChat ? "Fermer la discussion" : "Discuter avec le client"}
      </button>

      {showChat && adminUserId && (
        <div ref={chatRef}>
          <SourcingChat sourcingOrderId={row.id} currentUserId={adminUserId} viewAsAdmin compact />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onDelete(row.id)}
          className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </button>
        <button
          type="button"
          onClick={() =>
            onSave(row.id, {
              status: edit.status,
              final_total_xof: edit.final_total_xof === "" ? null : Number(edit.final_total_xof),
              msn_commission_xof:
                edit.msn_commission_xof === "" ? null : Number(edit.msn_commission_xof),
              admin_notes: edit.admin_notes || null,
              qc_images: edit.qc_images
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean),
            })
          }
          className="flex items-center gap-1 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Save className="h-3.5 w-3.5" /> Enregistrer
        </button>
      </div>
    </li>
  );
}
