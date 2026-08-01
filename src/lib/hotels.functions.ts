import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  findHotel,
  nightsBetween,
  prebook,
  quoteRate,
  searchInventory,
  userIdFromBearer,
} from "./hotels.server";

const searchSchema = z.object({
  city: z.string().max(80).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rooms: z.number().int().min(1).max(9),
  guests: z.number().int().min(1).max(20),
  minStars: z.number().int().min(0).max(5).optional(),
  maxNightlyXof: z.number().min(0).max(10_000_000).optional(),
  tags: z.array(z.string()).max(8).optional(),
  refundableOnly: z.boolean().optional(),
  payAtHotelOnly: z.boolean().optional(),
});

export const searchHotels = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }) => ({
    nights: nightsBetween(data.checkIn, data.checkOut),
    hotels: searchInventory({ ...data, tags: data.tags as never }),
  }));

const prebookSchema = z.object({
  hotelId: z.string().min(1).max(80),
  rateId: z.string().min(1).max(80),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rooms: z.number().int().min(1).max(9),
});

export const prebookHotel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => prebookSchema.parse(input))
  .handler(async ({ data }) => prebook(data.hotelId, data.rateId, data.checkIn, data.checkOut, data.rooms));

const bookSchema = prebookSchema.extend({
  guests: z.number().int().min(1).max(20),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().trim().email().max(255),
  guestPhone: z.string().trim().min(6).max(30),
  paymentModel: z.enum(["direct_merchant", "api_delegated"]),
  paymentGateway: z.enum(["msn_smart", "stripe", "mobile_money_xof", "hotel_direct"]),
});

export const bookHotel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookSchema.parse(input))
  .handler(async ({ data }) => {
    const hotel = findHotel(data.hotelId);
    const rawRate = hotel?.rates.find((r) => r.id === data.rateId);
    if (!hotel || !rawRate) throw new Error("Tarif indisponible, relancez la recherche.");
    if (data.paymentModel === "api_delegated" && !rawRate.pay_at_hotel) {
      throw new Error("Ce tarif doit être payé à l'avance.");
    }

    const nights = nightsBetween(data.checkIn, data.checkOut);
    const rate = quoteRate(rawRate, nights, data.rooms);
    const quote = prebook(data.hotelId, data.rateId, data.checkIn, data.checkOut, data.rooms);

    const userId = await userIdFromBearer(getRequestHeader("authorization"));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const insert = {
      user_id: userId,
      guest_email: data.guestEmail.toLowerCase(),
      guest_phone: data.guestPhone,
      guest_name: data.guestName,
      payment_model: data.paymentModel,
      payment_gateway: data.paymentGateway,
      payment_status: "pending",
      hotel_details: {
        id: hotel.id,
        name: hotel.name,
        name_zh: hotel.name_zh,
        address: hotel.address,
        address_zh: hotel.address_zh,
        city: hotel.city,
        city_zh: hotel.city_zh,
        country: hotel.country,
        contact: hotel.contact,
        star_rating: hotel.star_rating,
        lat: hotel.lat,
        lng: hotel.lng,
      },
      room_details: {
        rate_id: rate.id,
        room_type: rate.room_type,
        room_type_zh: rate.room_type_zh,
        board_type: rate.board_type,
        amenities: rate.amenities,
        per_night_public_xof: rate.per_night_public_xof,
        nights,
      },
      check_in_date: data.checkIn,
      check_out_date: data.checkOut,
      rooms: data.rooms,
      guests: data.guests,
      supplier_net_price: rate.supplier_net_total_xof,
      markup_amount: rate.markup_xof,
      total_price: rate.total_xof,
      currency: "XOF",
      status: data.paymentModel === "api_delegated" ? "confirmed" : "pending",
      supplier_confirmation_id:
        data.paymentModel === "api_delegated"
          ? `MSN-API-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
          : null,
      cancellation_policy: quote.cancellation_policy,
    };

    const { data: row, error } = await supabaseAdmin
      .from("hotel_bookings")
      .insert(insert as never)
      .select("id, booking_reference, status, total_price")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; booking_reference: string; status: string; total_price: number };
  });

const voucherSchema = z.object({
  bookingId: z.string().uuid(),
  email: z.string().trim().email().max(255),
});

export const getHotelBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => voucherSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("hotel_bookings")
      .select("*")
      .eq("id", data.bookingId)
      .ilike("guest_email", data.email.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Réservation introuvable pour cet email.");
    return row;
  });

const cancelSchema = voucherSchema;

export const cancelHotelBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("hotel_bookings")
      .select("id, status, cancellation_policy, total_price, guest_email")
      .eq("id", data.bookingId)
      .ilike("guest_email", data.email.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Réservation introuvable pour cet email.");
    if (row.status === "cancelled") return { ok: true, penalty_xof: 0 };

    const policy = (row.cancellation_policy ?? {}) as { refundable?: boolean; free_until?: string };
    const today = new Date().toISOString().slice(0, 10);
    const penalty =
      policy.refundable && policy.free_until && today <= policy.free_until ? 0 : Number(row.total_price ?? 0);

    const { error: upErr } = await supabaseAdmin
      .from("hotel_bookings")
      .update({ status: "cancelled" } as never)
      .eq("id", data.bookingId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, penalty_xof: penalty };
  });
