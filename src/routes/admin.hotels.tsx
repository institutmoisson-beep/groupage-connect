import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Save,
  Trash2,
  X,
  ImagePlus,
  BedDouble,
  MapPin,
  Star,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import { uploadHotelMedia, uploadHotelMediaMany } from "@/lib/hotel-media-upload";

export const Route = createFileRoute("/admin/hotels")({
  head: () => ({
    meta: [{ title: "Hôtels en direct — Admin MSN" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminHotels,
});

const AMENITIES = [
  "WiFi",
  "Piscine",
  "Petit-déjeuner",
  "Climatisation",
  "Parking",
  "Navette aéroport",
  "Salle de sport",
  "Spa",
  "Restaurant",
  "Bar",
  "Coffre-fort",
  "Ascenseur",
  "Personnel anglophone",
  "Navette Foire de Canton",
];

type Tab = "destinations" | "hotels" | "bookings";

function AdminHotels() {
  const [tab, setTab] = useState<Tab>("hotels");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black">Hôtels en direct (Direct Contracting)</h1>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 text-xs">
        {(
          [
            ["destinations", "Destinations"],
            ["hotels", "Hôtels & chambres"],
            ["bookings", "Réservations"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 font-bold transition-colors ${
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "destinations" && <DestinationsTab />}
      {tab === "hotels" && <HotelsTab />}
      {tab === "bookings" && <BookingsTab />}
    </div>
  );
}

// ============================================================================
// Destinations
// ============================================================================
function DestinationsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ country_name: "", country_code: "", city_name: "" });

  const { data: destinations, isLoading } = useQuery({
    queryKey: ["admin-custom-destinations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_destinations")
        .select("*")
        .order("country_name")
        .order("city_name");
      if (error) throw error;
      return data;
    },
  });

  async function addDestination() {
    if (!form.country_name.trim() || !form.country_code.trim() || !form.city_name.trim()) {
      toast.error("Pays, code pays et ville sont requis.");
      return;
    }
    const { error } = await supabase.from("custom_destinations").insert({
      country_name: form.country_name.trim(),
      country_code: form.country_code.trim().toUpperCase(),
      city_name: form.city_name.trim(),
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success("Destination ajoutée");
      setForm({ country_name: "", country_code: "", city_name: "" });
      qc.invalidateQueries({ queryKey: ["admin-custom-destinations"] });
    }
  }

  async function toggleActive(id: string, is_active: boolean) {
    const { error } = await supabase.from("custom_destinations").update({ is_active } as never).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-custom-destinations"] });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-4">
        <input
          placeholder="Pays (ex. Côte d'Ivoire)"
          value={form.country_name}
          onChange={(e) => setForm({ ...form, country_name: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-xs"
        />
        <input
          placeholder="Code pays (ex. CI)"
          value={form.country_code}
          maxLength={2}
          onChange={(e) => setForm({ ...form, country_code: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-xs"
        />
        <input
          placeholder="Ville (ex. Abidjan)"
          value={form.city_name}
          onChange={(e) => setForm({ ...form, city_name: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-xs"
        />
        <button
          onClick={addDestination}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Pays</th>
              <th className="p-2">Code</th>
              <th className="p-2">Ville</th>
              <th className="p-2 text-right">Statut</th>
            </tr>
          </thead>
          <tbody>
            {(destinations ?? []).map((d: any) => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="p-2">{d.country_name}</td>
                <td className="p-2 font-mono">{d.country_code}</td>
                <td className="p-2 font-semibold">{d.city_name}</td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => toggleActive(d.id, !d.is_active)}
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      d.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {d.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Hôtels & chambres
// ============================================================================
function HotelsTab() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null | "new">(null);

  const { data: destinations } = useQuery({
    queryKey: ["admin-custom-destinations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_destinations").select("*").order("city_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: hotels, isLoading } = useQuery({
    queryKey: ["admin-custom-hotels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_hotels")
        .select("*, destination:custom_destinations(city_name, country_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    function onCreated(e: Event) {
      const id = (e as CustomEvent).detail as string;
      if (id) setEditingId(id);
    }
    window.addEventListener("admin-hotel-created", onCreated);
    return () => window.removeEventListener("admin-hotel-created", onCreated);
  }, []);

  if (editingId !== null) {
    return (
      <HotelEditor
        hotelId={editingId === "new" ? null : editingId}
        destinations={destinations ?? []}
        onClose={() => {
          setEditingId(null);
          qc.invalidateQueries({ queryKey: ["admin-custom-hotels"] });
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setEditingId("new")}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Plus className="h-3.5 w-3.5" /> Nouvel hôtel
        </button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(hotels ?? []).map((h: any) => (
          <button
            key={h.id}
            onClick={() => setEditingId(h.id)}
            className="rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-bold">{h.name}</span>
              {!h.is_active && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                  Inactif
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              {Array.from({ length: h.star_rating }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-secondary text-secondary" />
              ))}
              <MapPin className="ml-1 h-3 w-3" /> {h.city}, {h.country}
            </div>
            {h.is_featured && (
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                Mis en avant
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function HotelEditor({
  hotelId,
  destinations,
  onClose,
}: {
  hotelId: string | null;
  destinations: any[];
  onClose: () => void;
}) {
  const isNew = hotelId === null;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    destination_id: "",
    name: "",
    star_rating: 3,
    address: "",
    city: "",
    country: "",
    latitude: "" as string | number,
    longitude: "" as string | number,
    description: "",
    cover_image_url: "",
    gallery_urls: [] as string[],
    amenities: [] as string[],
    contact_email: "",
    contact_phone: "",
    is_featured: false,
    is_active: true,
  });

  const { data: existing } = useQuery({
    queryKey: ["admin-custom-hotel", hotelId],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_hotels").select("*").eq("id", hotelId!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setForm({
        destination_id: existing.destination_id,
        name: existing.name,
        star_rating: existing.star_rating,
        address: existing.address,
        city: existing.city,
        country: existing.country,
        latitude: existing.latitude ?? "",
        longitude: existing.longitude ?? "",
        description: existing.description,
        cover_image_url: existing.cover_image_url ?? "",
        gallery_urls: existing.gallery_urls ?? [],
        amenities: existing.amenities ?? [],
        contact_email: existing.contact_email ?? "",
        contact_phone: existing.contact_phone ?? "",
        is_featured: existing.is_featured,
        is_active: existing.is_active,
      });
    }
  }, [existing]);

  function onSelectDestination(id: string) {
    const d = destinations.find((x) => x.id === id);
    setForm((f) => ({ ...f, destination_id: id, city: d?.city_name ?? f.city, country: d?.country_name ?? f.country }));
  }

  function toggleAmenity(a: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadHotelMedia(file, `hotels/${hotelId ?? "new"}/cover`);
      setForm((f) => ({ ...f, cover_image_url: url }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadHotelMediaMany(files, `hotels/${hotelId ?? "new"}/gallery`);
      setForm((f) => ({ ...f, gallery_urls: [...f.gallery_urls, ...urls] }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.destination_id || !form.name.trim()) {
      toast.error("Destination et nom de l'hôtel requis.");
      return;
    }
    setSaving(true);
    const payload = {
      destination_id: form.destination_id,
      name: form.name.trim(),
      star_rating: Number(form.star_rating),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      description: form.description.trim(),
      cover_image_url: form.cover_image_url || null,
      gallery_urls: form.gallery_urls,
      amenities: form.amenities,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      is_featured: form.is_featured,
      is_active: form.is_active,
    };

    if (isNew) {
      const { data, error } = await supabase.from("custom_hotels").insert(payload as never).select("id").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Hôtel créé. Ajoutez maintenant ses chambres.");
      const newId = (data as any).id as string;
      onClose();
      setTimeout(() => window.dispatchEvent(new CustomEvent("admin-hotel-created", { detail: newId })), 0);
    } else {
      const { error } = await supabase.from("custom_hotels").update(payload as never).eq("id", hotelId!);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Hôtel mis à jour");
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black">{isNew ? "Nouvel hôtel" : `Modifier : ${existing?.name ?? "…"}`}</h2>
        <button onClick={onClose} className="rounded-lg border border-border p-1.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Destination</label>
          <select
            value={form.destination_id}
            onChange={(e) => onSelectDestination(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          >
            <option value="">— Choisir —</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.city_name}, {d.country_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Nom de l'hôtel</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Étoiles</label>
          <select
            value={form.star_rating}
            onChange={(e) => setForm({ ...form, star_rating: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} étoile{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Adresse</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Latitude</label>
          <input
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            placeholder="ex. 5.3097"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Longitude</label>
          <input
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            placeholder="ex. -4.0196"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Email de contact</label>
          <input
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Téléphone</label>
          <input
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Équipements</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {AMENITIES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAmenity(a)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                form.amenities.includes(a) ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Photo de couverture</label>
          <div className="mt-1 flex items-center gap-2">
            {form.cover_image_url && (
              <img src={form.cover_image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            )}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[10px] font-bold text-muted-foreground hover:bg-muted">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              Choisir une image
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </label>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">
            Galerie ({form.gallery_urls.length} photo(s))
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {form.gallery_urls.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <button
                  onClick={() => setForm((f) => ({ ...f, gallery_urls: f.gallery_urls.filter((u) => u !== url) }))}
                  className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[10px] font-bold text-muted-foreground hover:bg-muted">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              Ajouter
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
          />
          Mis en avant (featured)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Actif (visible en recherche)
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs font-bold">
          Annuler
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground shadow-brand disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Enregistrer
        </button>
      </div>

      {!isNew && (
        <div className="border-t border-border pt-4">
          <RoomsManager hotelId={hotelId!} />
        </div>
      )}
      {isNew && (
        <p className="rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground">
          Enregistrez d'abord l'hôtel : la gestion des chambres s'ouvrira ensuite depuis la fiche hôtel.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Chambres / inventaire d'un hôtel
// ============================================================================
function RoomsManager({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["admin-custom-rooms", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_rooms")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("base_price_per_night");
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    if (!confirm("Supprimer cette chambre ?")) return;
    const { error } = await supabase.from("custom_rooms").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-custom-rooms", hotelId] });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-black">
          <BedDouble className="h-3.5 w-3.5" /> Chambres & tarifs
        </h3>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold text-primary"
        >
          <Plus className="h-3 w-3" /> Ajouter une chambre
        </button>
      </div>

      {isLoading && <p className="text-[10px] text-muted-foreground">Chargement…</p>}

      <div className="space-y-1.5">
        {(rooms ?? []).map((r: any) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-[11px]">
            <div>
              <div className="font-bold">{r.room_type}</div>
              <div className="text-muted-foreground">
                {formatMoney(Number(r.base_price_per_night), r.currency)} / nuit · {r.max_adults} ad. + {r.max_children} enf. ·
                {" "}
                Stock : {r.available_quantity}
                {!r.is_active && " · inactif"}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setEditing(r)} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold">
                Éditer
              </button>
              <button onClick={() => remove(r.id)} className="rounded-lg border border-destructive/40 p-1.5 text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && !(rooms ?? []).length && (
          <p className="rounded-lg bg-muted/40 p-2 text-[10px] text-muted-foreground">Aucune chambre pour le moment.</p>
        )}
      </div>

      {editing !== null && (
        <RoomEditor
          hotelId={hotelId}
          room={editing}
          onClose={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin-custom-rooms", hotelId] });
          }}
        />
      )}
    </div>
  );
}

function RoomEditor({ hotelId, room, onClose }: { hotelId: string; room: any; onClose: () => void }) {
  const isNew = !room?.id;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    room_type: room?.room_type ?? "",
    description: room?.description ?? "",
    base_price_per_night: room?.base_price_per_night ?? "",
    currency: room?.currency ?? "XOF",
    max_adults: room?.max_adults ?? 2,
    max_children: room?.max_children ?? 0,
    available_quantity: room?.available_quantity ?? 1,
    amenities: room?.amenities ?? ([] as string[]),
    images: room?.images ?? ([] as string[]),
    is_active: room?.is_active ?? true,
  });

  function toggleAmenity(a: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x: string) => x !== a) : [...f.amenities, a],
    }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadHotelMediaMany(files, `hotels/${hotelId}/rooms`);
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.room_type.trim() || !form.base_price_per_night) {
      toast.error("Type de chambre et prix requis.");
      return;
    }
    setSaving(true);
    const payload = {
      hotel_id: hotelId,
      room_type: form.room_type.trim(),
      description: form.description.trim(),
      base_price_per_night: Number(form.base_price_per_night),
      currency: form.currency,
      max_adults: Number(form.max_adults),
      max_children: Number(form.max_children),
      available_quantity: Number(form.available_quantity),
      amenities: form.amenities,
      images: form.images,
      is_active: form.is_active,
    };
    const { error } = isNew
      ? await supabase.from("custom_rooms").insert(payload as never)
      : await supabase.from("custom_rooms").update(payload as never).eq("id", room.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "Chambre ajoutée" : "Chambre mise à jour");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black">{isNew ? "Nouvelle chambre" : "Modifier la chambre"}</h3>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Type de chambre</label>
            <input
              value={form.room_type}
              onChange={(e) => setForm({ ...form, room_type: e.target.value })}
              placeholder="ex. Deluxe Ocean View"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Prix / nuit</label>
              <input
                type="number"
                min={0}
                value={form.base_price_per_night}
                onChange={(e) => setForm({ ...form, base_price_per_night: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Devise</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
              >
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Adultes max</label>
              <input
                type="number"
                min={1}
                value={form.max_adults}
                onChange={(e) => setForm({ ...form, max_adults: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Enfants max</label>
              <input
                type="number"
                min={0}
                value={form.max_children}
                onChange={(e) => setForm({ ...form, max_children: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Stock total (chambres)</label>
              <input
                type="number"
                min={0}
                value={form.available_quantity}
                onChange={(e) => setForm({ ...form, available_quantity: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Équipements de la chambre</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {AMENITIES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    form.amenities.includes(a) ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Photos ({form.images.length})
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {form.images.map((url: string) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, images: f.images.filter((u: string) => u !== url) }))}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[10px] font-bold text-muted-foreground hover:bg-muted">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Ajouter
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Chambre active (réservable)
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs font-bold">
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground shadow-brand disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Réservations & vouchers
// ============================================================================
const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
const PAY_STATUSES = ["pending", "paid", "refunded", "failed"] as const;

function BookingsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["admin-custom-hotel-bookings", statusFilter, payFilter],
    queryFn: async () => {
      let q = supabase
        .from("custom_hotel_bookings")
        .select("*, hotel:custom_hotels(name, city, country), room:custom_rooms(room_type)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (statusFilter) q = q.eq("booking_status", statusFilter as any);
      if (payFilter) q = q.eq("payment_status", payFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return bookings ?? [];
    return (bookings ?? []).filter((b: any) =>
      [b.booking_reference, b.guest_name, b.guest_email, b.hotel?.name].some((v) =>
        String(v ?? "").toLowerCase().includes(needle),
      ),
    );
  }, [bookings, search]);

  async function setStatus(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("custom_hotel_bookings").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-custom-hotel-bookings"] });
    }
  }

  function copyVoucherLink(b: any) {
    const url = `${window.location.origin}/hotels/voucher-direct/${b.id}?email=${encodeURIComponent(b.guest_email)}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien du bon copié — à renvoyer au client");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <input
          placeholder="Rechercher (réf., client, hôtel)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] flex-1 rounded-lg border border-input bg-background px-3 py-2"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
          <option value="">Tous statuts</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
          <option value="">Tout paiement</option>
          {PAY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}

      <div className="space-y-2">
        {filtered.map((b: any) => (
          <div key={b.id} className="rounded-xl border border-border bg-card p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono font-bold">{b.booking_reference}</div>
                <div className="text-muted-foreground">{b.hotel?.name} · {b.room?.room_type}</div>
                <div className="text-muted-foreground">{b.guest_name} · {b.guest_email} · {b.guest_phone}</div>
                <div className="text-muted-foreground">{b.check_in_date} → {b.check_out_date} · {b.rooms_booked} ch.</div>
              </div>
              <div className="text-right">
                <div className="font-black text-primary">{formatMoney(Number(b.total_price), b.currency ?? "XOF")}</div>
                <div className="text-[10px] text-muted-foreground">{b.booking_status} · {b.payment_status}</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
              <button
                onClick={() => setStatus(b.id, { booking_status: "confirmed" })}
                className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold text-primary"
              >
                Confirmer
              </button>
              <button
                onClick={() => setStatus(b.id, { booking_status: "cancelled" })}
                className="rounded-lg border border-destructive/40 px-2.5 py-1 text-[10px] font-bold text-destructive"
              >
                Annuler
              </button>
              <button
                onClick={() => setStatus(b.id, { payment_status: "paid", booking_status: "confirmed" })}
                className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold"
              >
                Marquer payé
              </button>
              <button
                onClick={() => copyVoucherLink(b)}
                className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold"
              >
                Copier le lien du bon (renvoyer au client)
              </button>
            </div>
          </div>
        ))}
        {!isLoading && !filtered.length && (
          <p className="rounded-lg bg-muted/40 p-3 text-center text-[11px] text-muted-foreground">
            Aucune réservation pour ces filtres.
          </p>
        )}
      </div>
    </div>
  );
}
