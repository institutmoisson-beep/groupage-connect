import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  nightsBetween,
  prebook,
  quoteRate,
  resolveHotel,
  searchInventory,
  userIdFromBearer,
} from "./hotels.server";

const searchSchema = z.object({
  city: z.string().max(80).optional(),
  hotelId: z.string().max(120).optional(),
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
  .handler(async ({ data }) => {
    const { hotelId, ...rest } = data;
    const code = hotelId?.startsWith("hb-") ? hotelId.slice(3) : undefined;
    return {
      nights: nightsBetween(data.checkIn, data.checkOut),
      hotels: await searchInventory({
        ...rest,
        tags: rest.tags as never,
        ...(code ? { hotelCodes: [code] } : {}),
      }),
    };
  });

const prebookSchema = z.object({
  hotelId: z.string().min(1).max(120),
  rateId: z.string().min(1).max(2000),
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
    const hotel = await resolveHotel(data.hotelId, {
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      rooms: data.rooms,
      guests: data.guests,
    });
    const rawRate = hotel?.rates.find((r) => r.id === data.rateId);
    if (!hotel || !rawRate) throw new Error("Tarif indisponible, relancez la recherche.");
    if (data.paymentModel === "api_delegated" && !rawRate.pay_at_hotel) {
      throw new Error("Ce tarif doit être payé à l'avance.");
    }

    const nights = nightsBetween(data.checkIn, data.checkOut);
    const quote = await prebook(data.hotelId, data.rateId, data.checkIn, data.checkOut, data.rooms, data.guests);
    const rate = quote.rate.total_xof > 0 ? quote.rate : quoteRate(rawRate, nights, data.rooms);

    // Réservation fournisseur immédiate uniquement quand le paiement est délégué
    // (tarif « payer à l'hôtel ») ; sinon on attend la confirmation du paiement.
    let supplierRef: string | null = null;
    const { isHotelbedsEnabled, hbBook, hotelCodeFromId } = await import("./hotelbeds.server");
    if (isHotelbedsEnabled() && hotelCodeFromId(data.hotelId) && data.paymentModel === "api_delegated") {
      const [firstName, ...restName] = data.guestName.trim().split(/\s+/);
      const booked = await hbBook({
        rateKey: data.rateId,
        holderName: firstName ?? data.guestName,
        holderSurname: restName.join(" ") || (firstName ?? "MSN"),
        clientReference: `MSN-${Date.now().toString(36).toUpperCase()}`,
        email: data.guestEmail,
        phone: data.guestPhone,
        rooms: data.rooms,
      });
      supplierRef = booked.reference || null;
    }


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
        supplierRef ??
        (data.paymentModel === "api_delegated"
          ? `MSN-API-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
          : null),

      cancellation_policy: quote.cancellation_policy,
      // Modèle 1 (paiement direct) : la marge MSN est déjà dans markup_amount.
      // Modèle 2 (délégué au fournisseur/hôtel) : on trace la commission affiliée attendue,
      // par défaut alignée sur le markup catalogue tant que le vrai barème fournisseur n'est pas branché.
      commission_type: data.paymentModel === "api_delegated" ? "affiliate_payout" : "merchant_markup",
      commission_amount: rate.markup_xof,
    };


    const { data: row, error } = await supabaseAdmin
      .from("hotel_bookings")
      .insert(insert as never)
      .select("id, booking_reference, status, total_price")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; booking_reference: string; status: string; total_price: number };
  });

const initiateHotelPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  email: z.string().trim().email().max(255),
});

/**
 * Modèle 1 (Direct Merchant) : ouvre une session GeniusPay (Mobile Money / carte)
 * pour une réservation hôtel déjà créée avec payment_status = 'pending'.
 * Le webhook /api/public/webhooks/geniuspay confirme ensuite le paiement.
 */
export const initiateHotelPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => initiateHotelPaymentSchema.parse(input))
  .handler(async ({ data }) => {
    const secretKey = process.env.GENIUSPAY_SECRET_KEY;
    const publicKey = process.env.GENIUSPAY_PUBLIC_KEY;
    const apiUrl = process.env.GENIUSPAY_API_URL ?? "https://geniuspay.ci/api/v1/merchant";
    if (!secretKey || !publicKey) throw new Error("GeniusPay non configuré (clés manquantes).");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking, error } = await supabaseAdmin
      .from("hotel_bookings")
      .select(
        "id, guest_email, guest_name, guest_phone, total_price, currency, payment_status, payment_url, payment_reference, booking_reference, payment_model",
      )
      .eq("id", data.bookingId)
      .ilike("guest_email", data.email.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Réservation introuvable pour cet email.");
    if (booking.payment_model !== "direct_merchant") {
      throw new Error("Cette réservation ne relève pas du paiement direct.");
    }
    if (booking.payment_status === "paid") {
      return { paymentUrl: booking.payment_url ?? "", reference: booking.payment_reference ?? "", alreadyPaid: true };
    }
    if (booking.payment_status === "pending" && booking.payment_url && booking.payment_reference) {
      return { paymentUrl: booking.payment_url, reference: booking.payment_reference, reused: true };
    }

    const reference = `MSNH-${booking.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const origin = process.env.SITE_URL ?? process.env.PUBLIC_SITE_URL ?? "https://groupage-connect.lovable.app";

    const payload = {
      apikey: publicKey,
      site_id: publicKey,
      transaction_id: reference,
      amount: Math.round(Number(booking.total_price)),
      currency: booking.currency ?? "XOF",
      description: `MSN Hôtels · Réservation ${booking.booking_reference}`,
      notify_url: `${origin}/api/public/webhooks/geniuspay`,
      return_url: `${origin}/hotels/voucher/${booking.id}?email=${encodeURIComponent(data.email)}`,
      cancel_url: `${origin}/hotels/voucher/${booking.id}?email=${encodeURIComponent(data.email)}&status=cancelled`,
      customer_name: booking.guest_name ?? "Client MSN",
      customer_phone_number: booking.guest_phone ?? "",
      channels: "ALL",
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${secretKey}`,
        "X-API-Key": secretKey,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let providerResponse: any;
    try {
      providerResponse = JSON.parse(text);
    } catch {
      providerResponse = { raw: text };
    }
    if (!res.ok) {
      throw new Error(`Paiement indisponible (${res.status}). ${providerResponse?.message ?? "Réessayez plus tard."}`);
    }
    const paymentUrl =
      providerResponse?.data?.payment_url ??
      providerResponse?.payment_url ??
      providerResponse?.url ??
      providerResponse?.data?.url ??
      null;
    if (!paymentUrl) throw new Error("GeniusPay n'a pas renvoyé d'URL de paiement.");

    const { error: updErr } = await supabaseAdmin
      .from("hotel_bookings")
      .update({
        payment_provider: "geniuspay",
        payment_reference: reference,
        payment_url: paymentUrl,
        payment_meta: providerResponse ?? null,
      } as never)
      .eq("id", booking.id);
    if (updErr) throw new Error(updErr.message);

    return { paymentUrl, reference, reused: false };
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
      .select("id, status, cancellation_policy, total_price, guest_email, supplier_confirmation_id")
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

    // Annulation fournisseur Hotelbeds si la réservation y a été confirmée.
    const supplierRef = row.supplier_confirmation_id;
    if (supplierRef && !supplierRef.startsWith("MSN-API-")) {
      const { isHotelbedsEnabled, hbCancel } = await import("./hotelbeds.server");
      if (isHotelbedsEnabled()) {
        try {
          await hbCancel(supplierRef);
        } catch (e) {
          console.error("[Hotelbeds] cancel failed", e);
        }
      }
    }


    const { error: upErr } = await supabaseAdmin
      .from("hotel_bookings")
      .update({ status: "cancelled" } as never)
      .eq("id", data.bookingId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, penalty_xof: penalty };
  });
