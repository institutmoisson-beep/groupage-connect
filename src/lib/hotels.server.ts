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

/** Loads raw inventory: live Hotelbeds when configured, curated catalog otherwise. */
async function loadInventory(params: SearchParams & { hotelCodes?: string[] }): Promise<Hotel[]> {
  const { isHotelbedsEnabled, hbSearchHotels } = await import("./hotelbeds.server");
  if (!isHotelbedsEnabled()) return HOTELS;
  try {
    const live = await hbSearchHotels(
      {
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        rooms: params.rooms,
        guests: params.guests,
        ...(params.city ? { city: params.city } : {}),
        ...(params.hotelCodes ? { hotelCodes: params.hotelCodes } : {}),
      },
      nightsBetween(params.checkIn, params.checkOut),
    );
    if (live.length) return live;
  } catch (e) {
    console.error("[Hotelbeds] search failed, fallback catalogue", e);
  }
  return HOTELS;
}

export async function searchInventory(
  params: SearchParams & { hotelCodes?: string[] },
): Promise<HotelResult[]> {
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const needle = params.city?.trim().toLowerCase() ?? "";
  const inventory = await loadInventory(params);
  const live = inventory !== HOTELS;

  const matches = inventory.filter((h) => {
    if (needle && !live) {
      const haystack = `${h.city} ${h.city_zh} ${h.country} ${h.name} ${h.name_zh}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (params.minStars && h.star_rating < params.minStars) return false;
    if (params.tags?.length && !live && !params.tags.every((tag) => h.trade_tags.includes(tag))) return false;
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

/** Resolves one hotel (live by Hotelbeds code, otherwise from the catalog). */
export async function resolveHotel(
  hotelId: string,
  stay: { checkIn: string; checkOut: string; rooms: number; guests: number },
): Promise<Hotel | undefined> {
  const { isHotelbedsEnabled, hotelCodeFromId } = await import("./hotelbeds.server");
  const code = hotelCodeFromId(hotelId);
  if (isHotelbedsEnabled() && code) {
    const list = await loadInventory({ ...stay, hotelCodes: [code] });
    const found = list.find((h) => h.id === hotelId);
    if (found) return found;
  }
  return HOTELS.find((h) => h.id === hotelId);
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

export async function prebook(
  hotelId: string,
  rateId: string,
  checkIn: string,
  checkOut: string,
  rooms: number,
  guests = rooms,
): Promise<PrebookResult> {
  const hotel = await resolveHotel(hotelId, { checkIn, checkOut, rooms, guests });
  if (!hotel) throw new Error("Hôtel introuvable");
  const rawRate = hotel.rates.find((r) => r.id === rateId);
  if (!rawRate) throw new Error("Tarif introuvable ou expiré");

  const nights = nightsBetween(checkIn, checkOut);
  let rate = quoteRate(rawRate, nights, rooms);
  let refundable = rawRate.refundable;
  let freeUntilDays = rawRate.free_cancellation_until_days;

  // Hotelbeds: verrouillage du prix via /checkrates avant paiement.
  const { isHotelbedsEnabled, hbCheckRates, hotelCodeFromId } = await import("./hotelbeds.server");
  if (isHotelbedsEnabled() && hotelCodeFromId(hotelId)) {
    try {
      const checked = await hbCheckRates(rateId);
      if (checked) {
        const perNight = Math.max(1, Math.round(checked.netXof / Math.max(1, nights) / Math.max(1, rooms)));
        rate = quoteRate({ ...rawRate, net_per_night_xof: perNight }, nights, rooms);
        refundable = checked.cancellationPolicies.length > 0;
        if (checked.cancellationPolicies[0]?.from) {
          const from = new Date(checked.cancellationPolicies[0].from).getTime();
          const start = new Date(`${checkIn}T00:00:00Z`).getTime();
          freeUntilDays = Math.max(0, Math.round((start - from) / 86_400_000));
        }
      }
    } catch (e) {
      console.error("[Hotelbeds] checkrates failed", e);
    }
  }

  const freeUntil = new Date(`${checkIn}T00:00:00Z`);
  freeUntil.setUTCDate(freeUntil.getUTCDate() - freeUntilDays);
  const { rates: _drop, ...hotelInfo } = hotel;

  return {
    ok: true,
    hotel: hotelInfo,
    rate,
    hold_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    cancellation_policy: {
      refundable,
      free_until: freeUntil.toISOString().slice(0, 10),
      penalty_xof: refundable ? 0 : rate.total_xof,
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
