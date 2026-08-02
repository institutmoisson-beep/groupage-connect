/**
 * In-house "Direct Contracting" hotel inventory (custom_destinations /
 * custom_hotels / custom_rooms), served alongside the Hotelbeds connector.
 *
 * Custom hotels are exposed to the rest of the hotel engine using the exact
 * same `Hotel` / `HotelRate` shape as `hotels-catalog.ts`, so `hotels.server.ts`
 * can merge them into search results, prebook and checkout without any
 * special-casing beyond the `custom-` id prefix.
 */
import type { Hotel, HotelRate } from "./hotels-catalog";

const ID_PREFIX = "custom-";

export function isCustomHotelId(hotelId: string): boolean {
  return hotelId.startsWith(ID_PREFIX);
}

export function customHotelUuid(hotelId: string): string | null {
  return isCustomHotelId(hotelId) ? hotelId.slice(ID_PREFIX.length) : null;
}

interface CustomHotelRow {
  id: string;
  name: string;
  star_rating: number;
  address: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
  amenities: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  custom_rooms: Array<{
    id: string;
    room_type: string;
    description: string | null;
    base_price_per_night: number;
    currency: string;
    max_adults: number;
    max_children: number;
    available_quantity: number;
    amenities: string[] | null;
    images: string[] | null;
    is_active: boolean;
  }>;
}

function toHotel(row: CustomHotelRow): Hotel {
  const rates: HotelRate[] = (row.custom_rooms ?? [])
    .filter((r) => r.is_active && r.available_quantity > 0)
    .map((r) => ({
      id: r.id,
      room_type: r.room_type,
      room_type_zh: r.room_type,
      board_type: "room_only",
      // NOTE: pricing engine ci-dessous (quoteRate) travaille en XOF ; si une
      // chambre est saisie en EUR, brancher ici la conversion via la table
      // exchange_rates avant mise en prod multi-devises réelle.
      net_per_night_xof: Math.round(Number(r.base_price_per_night)),
      refundable: true,
      free_cancellation_until_days: 2,
      // Modèle "Direct Contracting" : toujours payé sur MSN (Mobile Money / carte),
      // jamais délégué au fournisseur — cf. section 4 du cahier des charges.
      pay_at_hotel: false,
      amenities: r.amenities ?? [],
    }));

  return {
    id: `${ID_PREFIX}${row.id}`,
    name: row.name,
    name_zh: row.name,
    address: row.address,
    address_zh: row.address,
    city: row.city,
    city_zh: row.city,
    country: row.country,
    lat: row.latitude ?? 0,
    lng: row.longitude ?? 0,
    star_rating: row.star_rating,
    contact: [row.contact_phone, row.contact_email].filter(Boolean).join(" · "),
    description: row.description,
    trade_tags: [],
    rates,
    is_direct_partner: true,
    cover_image_url: row.cover_image_url ?? undefined,
    gallery_urls: row.gallery_urls ?? undefined,
  };
}

const SELECT = `
  id, name, star_rating, address, city, country, latitude, longitude, description,
  cover_image_url, gallery_urls, amenities, contact_email, contact_phone,
  custom_rooms:custom_rooms!custom_rooms_hotel_id_fkey (
    id, room_type, description, base_price_per_night, currency,
    max_adults, max_children, available_quantity, amenities, images, is_active
  )
`;

/** Loads active in-house hotels, optionally filtered by city (case-insensitive substring). */
export async function loadCustomHotels(city?: string): Promise<Hotel[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("custom_hotels").select(SELECT).eq("is_active", true);
  if (city?.trim()) q = q.ilike("city", `%${city.trim()}%`);
  const { data, error } = await q;
  if (error) {
    console.error("[custom-hotels] search failed", error);
    return [];
  }
  return ((data ?? []) as unknown as CustomHotelRow[]).map(toHotel);
}

/** Resolves a single in-house hotel by its `custom-<uuid>` id. */
export async function resolveCustomHotel(hotelId: string): Promise<Hotel | undefined> {
  const uuid = customHotelUuid(hotelId);
  if (!uuid) return undefined;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("custom_hotels")
    .select(SELECT)
    .eq("id", uuid)
    .maybeSingle();
  if (error || !data) return undefined;
  return toHotel(data as unknown as CustomHotelRow);
}

/**
 * Best-effort stock check: counts rooms already committed (booking_status
 * confirmed/completed, or still pending payment) on overlapping dates and
 * compares against `available_quantity`. Not fully race-condition proof
 * without a serializable transaction / row lock, acceptable for MVP volumes.
 */
export async function checkCustomRoomAvailability(
  roomId: string,
  checkIn: string,
  checkOut: string,
  roomsRequested: number,
): Promise<{ ok: boolean; availableQuantity: number; alreadyBooked: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: room, error: roomErr } = await supabaseAdmin
    .from("custom_rooms")
    .select("available_quantity")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr || !room) return { ok: false, availableQuantity: 0, alreadyBooked: 0 };

  const { data: overlapping, error: bookErr } = await supabaseAdmin
    .from("custom_hotel_bookings")
    .select("rooms_booked")
    .eq("room_id", roomId)
    .neq("booking_status", "cancelled")
    .neq("payment_status", "failed")
    .lt("check_in_date", checkOut)
    .gt("check_out_date", checkIn);
  if (bookErr) return { ok: false, availableQuantity: room.available_quantity, alreadyBooked: 0 };

  const alreadyBooked = (overlapping ?? []).reduce((sum, b: any) => sum + (b.rooms_booked ?? 1), 0);
  const ok = alreadyBooked + roomsRequested <= room.available_quantity;
  return { ok, availableQuantity: room.available_quantity, alreadyBooked };
}
