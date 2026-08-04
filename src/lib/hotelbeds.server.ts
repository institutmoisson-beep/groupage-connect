/**
 * Hotelbeds (HBX Group) APItude connector — server only.
 *
 * Auth: every call needs `Api-key` + `X-Signature` = SHA256(apiKey + secret + unixSeconds).
 * Prices come back in the supplier currency; we normalise everything to XOF so the
 * existing quoting/markup layer in `hotels.server.ts` stays unchanged.
 */
import { HOTELS, type Hotel, type HotelRate, type TradeTag } from "./hotels-catalog";

const EUR_PER_XOF = 1 / 655.957;
/** Supplier currency -> XOF multipliers (fallbacks; EUR is the pegged reference). */
const TO_XOF: Record<string, number> = {
  XOF: 1,
  EUR: 655.957,
  USD: 606,
  GBP: 775,
  CNY: 84,
  HKD: 78,
  AED: 165,
  MAD: 62,
};

export interface HotelbedsConfig {
  apiKey: string;
  secret: string;
  endpoint: string;
}

export function getHotelbedsConfig(): HotelbedsConfig | null {
  const apiKey = process.env["HOTELBEDS_API_KEY"];
  const secret = process.env["HOTELBEDS_SECRET"];
  if (!apiKey || !secret) return null;
  const endpoint = (process.env["HOTELBEDS_ENDPOINT"] ?? "https://api.test.hotelbeds.com/hotelapi/1.0/").replace(
    /\/+$/,
    "",
  );
  return { apiKey, secret, endpoint };
}

export function isHotelbedsEnabled(): boolean {
  return getHotelbedsConfig() !== null;
}

/** X-Signature = SHA256(apiKey + secret + unix seconds), hex lowercase. */
export async function hotelbedsHeaders(cfg: HotelbedsConfig): Promise<Record<string, string>> {
  const stamp = Math.floor(Date.now() / 1000);
  const bytes = new TextEncoder().encode(`${cfg.apiKey}${cfg.secret}${stamp}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const signature = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    "Api-key": cfg.apiKey,
    "X-Signature": signature,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip",
  };
}

async function hbFetch<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const cfg = getHotelbedsConfig();
  if (!cfg) throw new Error("Hotelbeds non configuré (clés manquantes).");
  const res = await fetch(`${cfg.endpoint}${path}`, {
    method: init.method,
    headers: await hotelbedsHeaders(cfg),
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.message ?? `Hotelbeds a répondu ${res.status}`;
    throw new Error(String(msg));
  }
  return json as T;
}

function toXof(amount: number, currency: string | undefined): number {
  const rate = TO_XOF[(currency ?? "EUR").toUpperCase()] ?? 1 / EUR_PER_XOF;
  return Math.round(amount * rate);
}

/** City centroids derived from the curated catalog, used for geolocation search. */
function cityGeo(city: string): { latitude: number; longitude: number } | null {
  const needle = city.trim().toLowerCase();
  if (!needle) return null;
  const matches = HOTELS.filter((h) =>
    `${h.city} ${h.city_zh} ${h.country}`.toLowerCase().includes(needle),
  );
  if (!matches.length) return null;
  const latitude = matches.reduce((s, h) => s + h.lat, 0) / matches.length;
  const longitude = matches.reduce((s, h) => s + h.lng, 0) / matches.length;
  return { latitude, longitude };
}

function tagsFromHotel(h: any): TradeTag[] {
  const tags: TradeTag[] = [];
  const blob = JSON.stringify(h?.facilities ?? h?.zoneName ?? "").toLowerCase();
  if (blob.includes("wifi") || blob.includes("internet")) tags.push("fast_wifi");
  if (blob.includes("business")) tags.push("business_center");
  if (blob.includes("shuttle") || blob.includes("airport")) tags.push("airport_shuttle");
  return tags;
}

function daysBefore(fromIso: string | undefined, checkIn: string): number {
  if (!fromIso) return 0;
  const from = new Date(fromIso).getTime();
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const d = Math.round((start - from) / 86_400_000);
  return d > 0 ? d : 0;
}

function mapRate(raw: any, roomName: string, currency: string, nights: number, rooms: number, checkIn: string): HotelRate {
  const netTotalXof = toXof(Number(raw?.net ?? raw?.sellingRate ?? 0), currency);
  const perNight = Math.max(1, Math.round(netTotalXof / Math.max(1, nights) / Math.max(1, rooms)));
  const policies: any[] = Array.isArray(raw?.cancellationPolicies) ? raw.cancellationPolicies : [];
  const nonRefundable = String(raw?.rateClass ?? "").toUpperCase() === "NRF" || raw?.rateType === "RECHECK" && !policies.length;
  const refundable = !nonRefundable && policies.length > 0;
  return {
    id: String(raw?.rateKey ?? `${roomName}-${perNight}`),
    room_type: roomName,
    room_type_zh: roomName,
    board_type:
      String(raw?.boardCode ?? "").toUpperCase() === "RO"
        ? "room_only"
        : String(raw?.boardCode ?? "").toUpperCase() === "HB"
          ? "half_board"
          : "breakfast",
    net_per_night_xof: perNight,
    refundable,
    free_cancellation_until_days: refundable ? daysBefore(policies[0]?.from, checkIn) : 0,
    pay_at_hotel: String(raw?.paymentType ?? "").toUpperCase() === "AT_HOTEL",
    amenities: [raw?.boardName, raw?.rateComments].filter(Boolean).map(String).slice(0, 3),
  };
}

function mapHotel(raw: any, nights: number, rooms: number, checkIn: string): Hotel | null {
  const currency = String(raw?.currency ?? "EUR");
  const rates: HotelRate[] = [];
  for (const room of Array.isArray(raw?.rooms) ? raw.rooms : []) {
    for (const rate of Array.isArray(room?.rates) ? room.rates : []) {
      rates.push(mapRate(rate, String(room?.name ?? "Chambre"), currency, nights, rooms, checkIn));
    }
  }
  if (!rates.length) return null;
  return {
    id: `hb-${raw?.code}`,
    name: String(raw?.name ?? "Hôtel"),
    name_zh: String(raw?.name ?? "Hôtel"),
    address: String(raw?.address ?? raw?.zoneName ?? raw?.destinationName ?? ""),
    address_zh: String(raw?.address ?? ""),
    city: String(raw?.destinationName ?? ""),
    city_zh: String(raw?.destinationName ?? ""),
    country: String(raw?.countryCode ?? ""),
    lat: Number(raw?.latitude ?? 0),
    lng: Number(raw?.longitude ?? 0),
    star_rating: Number(String(raw?.categoryCode ?? "3").replace(/\D/g, "")) || 3,
    contact: "",
    description: String(raw?.categoryName ?? ""),
    trade_tags: tagsFromHotel(raw),
    rates,
  };
}

export interface HbSearchInput {
  city?: string;
  hotelCodes?: string[];
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  minStars?: number;
}

/** Live availability search (`POST /hotels`). Returns catalog-shaped hotels. */
export async function hbSearchHotels(input: HbSearchInput, nights: number): Promise<Hotel[]> {
  const adults = Math.max(1, Math.ceil(input.guests / Math.max(1, input.rooms)));
  const body: Record<string, unknown> = {
    stay: { checkIn: input.checkIn, checkOut: input.checkOut },
    occupancies: [{ rooms: input.rooms, adults, children: 0 }],
  };

  if (input.hotelCodes?.length) {
    body.hotels = { hotel: input.hotelCodes.map((c) => Number(c)).filter((n) => Number.isFinite(n)) };
  } else {
    const geo = cityGeo(input.city ?? "");
    if (!geo) return [];
    body.geolocation = { ...geo, radius: 25, unit: "km" };
  }

  const json = await hbFetch<any>("/hotels", { method: "POST", body });
  const list: any[] = json?.hotels?.hotels ?? [];
  return list
    .map((h) => mapHotel(h, nights, input.rooms, input.checkIn))
    .filter((h): h is Hotel => h !== null);
}

/** Rate check / price lock (`POST /checkrates`). */
export async function hbCheckRates(rateKey: string): Promise<{
  netXof: number;
  currency: string;
  cancellationPolicies: Array<{ amount: number; from: string }>;
  raw: unknown;
} | null> {
  const json = await hbFetch<any>("/checkrates", {
    method: "POST",
    body: { rooms: [{ rateKey }] },
  });
  const hotel = json?.hotel;
  const rate = hotel?.rooms?.[0]?.rates?.[0];
  if (!rate) return null;
  const currency = String(hotel?.currency ?? "EUR");
  return {
    netXof: toXof(Number(rate.net ?? 0), currency),
    currency,
    cancellationPolicies: (rate.cancellationPolicies ?? []).map((p: any) => ({
      amount: toXof(Number(p.amount ?? 0), currency),
      from: String(p.from ?? ""),
    })),
    raw: json,
  };
}

/** Final booking (`POST /bookings`). */
export async function hbBook(input: {
  rateKey: string;
  holderName: string;
  holderSurname: string;
  clientReference: string;
  email: string;
  phone: string;
  rooms: number;
}): Promise<{ reference: string; status: string; raw: unknown }> {
  const paxes = Array.from({ length: Math.max(1, input.rooms) }, (_, i) => ({
    roomId: i + 1,
    type: "AD",
    name: input.holderName,
    surname: input.holderSurname,
  }));
  const json = await hbFetch<any>("/bookings", {
    method: "POST",
    body: {
      holder: { name: input.holderName, surname: input.holderSurname },
      rooms: [{ rateKey: input.rateKey, paxes }],
      clientReference: input.clientReference,
      remark: "MSN Courtier — réservation d'affaires",
      tolerance: 2,
      clientData: { email: input.email, phone: input.phone },
    },
  });
  return {
    reference: String(json?.booking?.reference ?? ""),
    status: String(json?.booking?.status ?? "CONFIRMED"),
    raw: json,
  };
}

/** Cancellation (`DELETE /bookings/{reference}`). */
export async function hbCancel(reference: string): Promise<{ status: string; raw: unknown }> {
  const json = await hbFetch<any>(
    `/bookings/${encodeURIComponent(reference)}?cancellationFlag=CANCELLATION`,
    { method: "DELETE" },
  );
  return { status: String(json?.booking?.status ?? "CANCELLED"), raw: json };
}

export function hotelCodeFromId(hotelId: string): string | null {
  return hotelId.startsWith("hb-") ? hotelId.slice(3) : null;
}

