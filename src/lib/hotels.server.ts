/**
 * Server-only hotel engine: inventory search, quoting, booking and cancellation.
 *
 * The inventory source is pluggable: when a supplier API key is configured we
 * would call the aggregator here; otherwise we serve the curated MSN catalog.
 */
import { HOTELS, type Hotel, type HotelRate, type TradeTag } from "./hotels-catalog";

/** MSN margin applied on the supplier net rate. */
export const MSN_MARKUP_RATE = 0.07;

export interface SearchParams {
  city?: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  minStars?: number;
  maxNightlyXof?: number;
  tags?: TradeTag[];
  refundableOnly?: boolean;
  payAtHotelOnly?: boolean;
}

export interface QuotedRate extends HotelRate {
  nights: number;
  rooms: number;
  supplier_net_total_xof: number;
  markup_xof: number;
  total_xof: number;
  per_night_public_xof: number;
}

export interface HotelResult extends Omit<Hotel, "rates"> {
  rates: QuotedRate[];
  cheapest_total_xof: number;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : 1;
}

export function quoteRate(rate: HotelRate, nights: number, rooms: number): QuotedRate {
  const net = rate.net_per_night_xof * nights * rooms;
  const markup = Math.round(net * MSN_MARKUP_RATE);
  const total = net + markup;
  return {
    ...rate,
    nights,
    rooms,
    supplier_net_total_xof: net,
    markup_xof: markup,
    total_xof: total,
    per_night_public_xof: Math.round(total / (nights * rooms)),
  };
}

export function searchInventory(params: SearchParams): HotelResult[] {
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const needle = params.city?.trim().toLowerCase() ?? "";

  const matches = HOTELS.filter((h) => {
    if (needle) {
      const haystack = `${h.city} ${h.city_zh} ${h.country} ${h.name} ${h.name_zh}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (params.minStars && h.star_rating < params.minStars) return false;
    if (params.tags?.length && !params.tags.every((tag) => h.trade_tags.includes(tag))) return false;
    return true;
  });

  const results: HotelResult[] = [];
  for (const hotel of matches) {
    let rates = hotel.rates;
    if (params.refundableOnly) rates = rates.filter((r) => r.refundable);
    if (params.payAtHotelOnly) rates = rates.filter((r) => r.pay_at_hotel);
    if (params.maxNightlyXof) rates = rates.filter((r) => r.net_per_night_xof <= params.maxNightlyXof!);
    if (!rates.length) continue;

    const quoted = rates
      .map((r) => quoteRate(r, nights, params.rooms))
      .sort((a, b) => a.total_xof - b.total_xof);
    const { rates: _drop, ...rest } = hotel;
    results.push({ ...rest, rates: quoted, cheapest_total_xof: quoted[0]!.total_xof });
  }

  return results.sort((a, b) => a.cheapest_total_xof - b.cheapest_total_xof);
}

export function findHotel(hotelId: string): Hotel | undefined {
  return HOTELS.find((h) => h.id === hotelId);
}

export interface PrebookResult {
  ok: boolean;
  hotel: Omit<Hotel, "rates">;
  rate: QuotedRate;
  /** Short-lived quote token: the supplier price is held for this window. */
  hold_expires_at: string;
  cancellation_policy: { refundable: boolean; free_until: string; penalty_xof: number };
}

export function prebook(
  hotelId: string,
  rateId: string,
  checkIn: string,
  checkOut: string,
  rooms: number,
): PrebookResult {
  const hotel = findHotel(hotelId);
  if (!hotel) throw new Error("Hôtel introuvable");
  const rawRate = hotel.rates.find((r) => r.id === rateId);
  if (!rawRate) throw new Error("Tarif introuvable ou expiré");

  const nights = nightsBetween(checkIn, checkOut);
  const rate = quoteRate(rawRate, nights, rooms);
  const freeUntil = new Date(`${checkIn}T00:00:00Z`);
  freeUntil.setUTCDate(freeUntil.getUTCDate() - rawRate.free_cancellation_until_days);
  const { rates: _drop, ...hotelInfo } = hotel;

  return {
    ok: true,
    hotel: hotelInfo,
    rate,
    hold_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    cancellation_policy: {
      refundable: rawRate.refundable,
      free_until: freeUntil.toISOString().slice(0, 10),
      penalty_xof: rawRate.refundable ? 0 : rate.total_xof,
    },
  };
}

/** Resolves the signed-in user from an optional Authorization header. */
export async function userIdFromBearer(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token);
  return data.user?.id ?? null;
}
