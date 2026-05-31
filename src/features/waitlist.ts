import { DateTime } from "luxon";
import { createDinerToken } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { assertRestaurantScoped, ensureCustomer, getRestaurantBySlug } from "@/features/repositories";

export type WaitlistInput = {
  slug: string;
  date: string;
  partySize: number;
  zoneId?: string | null;
  serviceId?: string | null;
  preferredTime?: string | null;
  customer: {
    name: string;
    email?: string | null;
    phone: string;
  };
  specialRequests?: string | null;
};

export type WaitlistResult =
  | {
      ok: true;
      entry: {
        id: string;
        status: string;
        date: string;
        partySize: number;
        preferredTime: string | null;
        serviceId: string | null;
        zoneId: string | null;
      };
      dinerToken: string;
    }
  | { ok: false; error: "restaurant_not_found" | "restaurant_suspended" | "invalid_scope" | "past_date" };

export async function joinWaitlist(input: WaitlistInput): Promise<WaitlistResult> {
  const restaurant = await getRestaurantBySlug(input.slug);
  if (!restaurant) return { ok: false, error: "restaurant_not_found" };
  if (restaurant.suspendedAt) return { ok: false, error: "restaurant_suspended" };

  const requestedDate = DateTime.fromISO(input.date, { zone: restaurant.timezone }).startOf("day");
  const today = DateTime.now().setZone(restaurant.timezone).startOf("day");
  if (requestedDate < today) return { ok: false, error: "past_date" };

  if (input.zoneId && !(await assertRestaurantScoped("zone", input.zoneId, restaurant.id))) {
    return { ok: false, error: "invalid_scope" };
  }
  if (input.serviceId && !(await assertRestaurantScoped("service", input.serviceId, restaurant.id))) {
    return { ok: false, error: "invalid_scope" };
  }

  const customerId = await ensureCustomer({
    restaurantId: restaurant.id,
    name: input.customer.name,
    email: input.customer.email,
    phone: input.customer.phone
  });

  const result = await getPool().query<{
    id: string;
    status: string;
    date: string;
    party_size: number;
    preferred_time: string | null;
    service_id: string | null;
    zone_id: string | null;
  }>(
    `INSERT INTO waitlist_entry
       (restaurant_id, customer_id, service_id, zone_id, date, party_size, preferred_time, special_requests)
     VALUES ($1, $2, $3, $4, $5::date, $6, $7::time, $8)
     RETURNING id, status, date::text, party_size, preferred_time::text, service_id, zone_id`,
    [
      restaurant.id,
      customerId,
      input.serviceId ?? null,
      input.zoneId ?? null,
      input.date,
      input.partySize,
      input.preferredTime ?? null,
      input.specialRequests ?? null
    ]
  );

  const row = result.rows[0];
  return {
    ok: true,
    entry: {
      id: row.id,
      status: row.status,
      date: row.date,
      partySize: row.party_size,
      preferredTime: row.preferred_time,
      serviceId: row.service_id,
      zoneId: row.zone_id
    },
    dinerToken: createDinerToken({ type: "diner", customerId })
  };
}
