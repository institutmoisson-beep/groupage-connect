import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, Upload, Loader2, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import { uploadCargoQcImage } from "@/lib/cargo-qc-upload";

export const Route = createFileRoute("/admin/cargo-packages")({
  component: AdminCargoPackages,
});

const STATUSES = ["DECLARED", "RECEIVED_CHINA", "IN_TRANSIT", "CUSTOMS", "READY_DELIVERY", "DISPATCHED", "DELIVERED", "CANCELLED"];

function AdminCargoPackages() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: rows, isError, error } = useQuery({
    queryKey: ["admin-cargo-packages", filter, search],
    queryFn: async () => {
      let q = supabase
        .from("forwarding_packages" as any)
        .select("*, profiles(full_name, phone)")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter as any);
      if (search.trim()) q = q.ilike("chinese_tracking_number", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error(`Erreur de chargement du manifest : ${(error as any)?.message ?? "inconnue"}`);
    }
  }, [isError, error]);

  async function save(id: string, patch: any) {
    const { error } = await supabase.from("forwarding_packages" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-cargo-packages"] });
    }
  }
  async function del(id: string) {
    if (!confirm("Supprimer ce colis ?")) return;
    const { error } = await supabase.from("forwarding_packages" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-cargo-packages"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold">Manifest Cargo — Colis Forwarding</h1>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un n° de suivi chinois…"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
          >
            <option value="all">Tous statuts</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun colis.
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {(rows ?? []).map((r: any) => (
            <PackageRow key={r.id} row={r} onSave={save} onDelete={del} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PackageRow({ row, onSave, onDelete }: { row: any; onSave: (id: string, patch: any) => void; onDelete: (id: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [edit, setEdit] = useState({
    status: row.status,
    weight_kg: row.weight_kg ?? "",
    volume_cbm: row.volume_cbm ?? "",
    rate_per_kg_xof: row.rate_per_kg_xof ?? "",
    rate_per_cbm_xof: row.rate_per_cbm_xof ?? "",
    customs_flat_fee_xof: row.customs_flat_fee_xof ?? "",
    admin_notes: row.admin_notes ?? "",
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        const url = await uploadCargoQcImage(file, row.user_id, row.id);
        urls.push(url);
      }
      const nextImages = [...(row.qc_images_urls ?? []), ...urls];
      const patch: any = { qc_images_urls: nextImages };
      if (row.status === "DECLARED") patch.status = "RECEIVED_CHINA";
      onSave(row.id, patch);
      toast.success(`${urls.length} photo(s) QC envoyée(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold">{row.description}</div>
          <div className="text-[10px] text-muted-foreground">
            {row.profiles?.full_name ?? "?"} · {row.profiles?.phone ?? ""}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {row.source_platform} · Suivi : {row.chinese_tracking_number}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
          {row.freight_type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[11px]">
        <div>
          <span className="text-muted-foreground">Valeur déclarée :</span>{" "}
          <span className="font-semibold">
            {row.declared_value ? `${row.declared_value} ${row.declared_value_currency}` : "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Qté :</span> <span className="font-semibold">{row.quantity}</span>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Fret calculé :</span>{" "}
          <span className="font-bold text-primary">
            {row.shipping_cost_xof ? formatXOF(Number(row.shipping_cost_xof)) : "— (saisir poids/volume)"}
          </span>
        </div>
      </div>

      {/* QC photo uploader */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground">Photos QC ({(row.qc_images_urls ?? []).length})</span>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? "Envoi…" : "Ajouter des photos"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        {(row.qc_images_urls ?? []).length > 0 && (
          <div className="grid grid-cols-4 gap-1">
            {row.qc_images_urls.map((img: string, i: number) => (
              <a key={i} href={img} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md">
                <img src={img} alt={`QC ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
        {row.qc_approved_at && <div className="text-[10px] font-bold text-success">✓ Qualité approuvée par le client</div>}
        {row.qc_rejected_at && <div className="text-[10px] font-bold text-destructive">✗ Rejeté par le client{row.qc_note ? ` : ${row.qc_note}` : ""}</div>}
      </div>

      {/* Billing */}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Poids vérifié (kg)</span>
          <input
            type="number"
            step="0.01"
            value={edit.weight_kg}
            onChange={(e) => setEdit({ ...edit, weight_kg: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Volume vérifié (CBM)</span>
          <input
            type="number"
            step="0.001"
            value={edit.volume_cbm}
            onChange={(e) => setEdit({ ...edit, volume_cbm: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Tarif/kg XOF (vide = défaut)</span>
          <input
            type="number"
            value={edit.rate_per_kg_xof}
            onChange={(e) => setEdit({ ...edit, rate_per_kg_xof: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-[11px]">
          <span className="font-semibold text-muted-foreground">Tarif/CBM XOF (vide = défaut)</span>
          <input
            type="number"
            value={edit.rate_per_cbm_xof}
            onChange={(e) => setEdit({ ...edit, rate_per_cbm_xof: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="col-span-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">Frais douane fixes XOF (vide = défaut)</span>
          <input
            type="number"
            value={edit.customs_flat_fee_xof}
            onChange={(e) => setEdit({ ...edit, customs_flat_fee_xof: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
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
          {edit.status === "IN_TRANSIT" && !row.qc_approved_at && (
            <span className="mt-0.5 block text-[10px] font-semibold text-destructive">
              ⚠ Bloqué tant que le client n'a pas approuvé le QC
            </span>
          )}
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

      <div className="flex justify-end gap-2">
        <button
          onClick={() => onDelete(row.id)}
          className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </button>
        <button
          onClick={() =>
            onSave(row.id, {
              status: edit.status,
              weight_kg: edit.weight_kg === "" ? null : Number(edit.weight_kg),
              volume_cbm: edit.volume_cbm === "" ? null : Number(edit.volume_cbm),
              rate_per_kg_xof: edit.rate_per_kg_xof === "" ? null : Number(edit.rate_per_kg_xof),
              rate_per_cbm_xof: edit.rate_per_cbm_xof === "" ? null : Number(edit.rate_per_cbm_xof),
              customs_flat_fee_xof: edit.customs_flat_fee_xof === "" ? null : Number(edit.customs_flat_fee_xof),
              admin_notes: edit.admin_notes || null,
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
