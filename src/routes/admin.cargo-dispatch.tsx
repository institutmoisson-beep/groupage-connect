import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Save, CheckCircle2, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import { googleMapsLink } from "@/lib/geo";

export const Route = createFileRoute("/admin/cargo-dispatch")({
  component: AdminCargoDispatch,
});

function AdminCargoDispatch() {
  const qc = useQueryClient();

  const { data: rows, isError, error } = useQuery({
    queryKey: ["admin-cargo-dispatch"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_delivery_logs" as any)
        .select(
          "*, forwarding_packages(id, description, status, user_id, profiles(full_name, phone))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).filter((r) =>
        ["READY_DELIVERY", "DISPATCHED"].includes(r.forwarding_packages?.status),
      );
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error(`Erreur de chargement du dispatch : ${(error as any)?.message ?? "inconnue"}`);
    }
  }, [isError, error]);

  async function assignDriver(logId: string, name: string, contact: string) {
    const { error } = await supabase
      .from("package_delivery_logs" as any)
      .update({ assigned_driver_name: name || null, assigned_driver_contact: contact || null })
      .eq("id", logId);
    if (error) toast.error(error.message);
    else {
      toast.success("Chauffeur assigné");
      qc.invalidateQueries({ queryKey: ["admin-cargo-dispatch"] });
    }
  }

  async function markDelivered(logId: string, packageId: string) {
    const { error: logErr } = await supabase
      .from("package_delivery_logs" as any)
      .update({ delivery_timestamp: new Date().toISOString() })
      .eq("id", logId);
    const { error: pkgErr } = await supabase
      .from("forwarding_packages" as any)
      .update({ status: "DELIVERED" })
      .eq("id", packageId);
    if (logErr || pkgErr) toast.error((logErr || pkgErr)?.message ?? "Erreur");
    else {
      toast.success("Colis marqué comme livré");
      qc.invalidateQueries({ queryKey: ["admin-cargo-dispatch"] });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-bold">GPS Dispatch — Livraisons en attente</h1>
      <p className="text-xs text-muted-foreground">
        Colis dont le client a verrouillé sa position GPS. Assignez un chauffeur local et confirmez la livraison une
        fois effectuée.
      </p>

      {(rows ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune livraison en attente de dispatch.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(rows ?? []).map((log: any) => (
            <DispatchRow key={log.id} log={log} onAssign={assignDriver} onDelivered={markDelivered} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DispatchRow({
  log,
  onAssign,
  onDelivered,
}: {
  log: any;
  onAssign: (logId: string, name: string, contact: string) => void;
  onDelivered: (logId: string, packageId: string) => void;
}) {
  const [driverName, setDriverName] = useState(log.assigned_driver_name ?? "");
  const [driverContact, setDriverContact] = useState(log.assigned_driver_contact ?? "");
  const pkg = log.forwarding_packages;

  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold">{pkg?.description ?? "Colis"}</div>
          <div className="text-[10px] text-muted-foreground">
            {pkg?.profiles?.full_name ?? "?"} · {pkg?.profiles?.phone ?? "—"}
          </div>
        </div>
        <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
          {pkg?.status}
        </span>
      </div>

      <a
        href={googleMapsLink(Number(log.delivery_latitude), Number(log.delivery_longitude))}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between rounded-lg bg-muted px-2 py-1.5 text-[11px] font-semibold"
      >
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {Number(log.delivery_latitude).toFixed(5)}, {Number(log.delivery_longitude).toFixed(5)}
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </a>

      <div className="grid grid-cols-2 gap-1 text-[11px]">
        <div>
          <span className="text-muted-foreground">Distance :</span>{" "}
          <span className="font-semibold">{log.distance_km ? `${Number(log.distance_km).toFixed(1)} km` : "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Frais livraison :</span>{" "}
          <span className="font-semibold">{log.delivery_fee_xof ? formatXOF(Number(log.delivery_fee_xof)) : "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Chauffeur</span>
          <input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="Nom"
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Contact chauffeur</span>
          <input
            value={driverContact}
            onChange={(e) => setDriverContact(e.target.value)}
            placeholder="+225…"
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => onAssign(log.id, driverName, driverContact)}
          className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold"
        >
          <Save className="h-3.5 w-3.5" /> Assigner
        </button>
        {log.assigned_driver_contact && (
          <a
            href={`tel:${log.assigned_driver_contact}`}
            className="flex items-center gap-1 rounded-lg bg-secondary/10 px-3 py-1.5 text-xs font-semibold text-secondary"
          >
            <Phone className="h-3.5 w-3.5" /> Appeler
          </a>
        )}
        {!log.delivery_timestamp && (
          <button
            onClick={() => onDelivered(log.id, pkg.id)}
            className="flex items-center gap-1 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-brand"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Marquer livré
          </button>
        )}
      </div>
    </li>
  );
}
