import { getPool } from "@/lib/db";

const transitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled", "no_show"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: []
};

export async function transitionReservation(input: {
  slug?: string;
  restaurantId?: string;
  id: string;
  status?: string;
  specialRequests?: string | null;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ status: string; restaurant_id: string }>(
      input.slug
        ? `SELECT r.status, r.restaurant_id
           FROM reservation r
           JOIN restaurant rest ON rest.id = r.restaurant_id
           WHERE r.id = $1 AND rest.slug = $2
           FOR UPDATE`
        : `SELECT status, restaurant_id
           FROM reservation
           WHERE id = $1 AND restaurant_id = $2
           FOR UPDATE`,
      input.slug ? [input.id, input.slug] : [input.id, input.restaurantId]
    );
    const row = current.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "not_found", message: "Reservation not found", status: 404 };
    }

    if (input.status && input.status !== row.status && !transitions[row.status]?.includes(input.status)) {
      await client.query("ROLLBACK");
      return { error: "invalid_transition", message: "Invalid reservation status transition", status: 409 };
    }

    if (input.status === "cancelled" || input.status === "no_show") {
      await client.query("DELETE FROM reservation_mesa WHERE reservation_id = $1", [input.id]);
    }

    const updated = await client.query(
      `UPDATE reservation
       SET status = COALESCE($2::reservation_status, status),
           special_requests = COALESCE($3, special_requests),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [input.id, input.status ?? null, input.specialRequests ?? null]
    );

    await client.query("COMMIT");
    return { reservation: updated.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
