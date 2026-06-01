import { getPool } from "@/lib/db";

type PrivacyRequestType = "export" | "delete";
type PrivacyRequestStatus = "pending" | "completed" | "rejected";

export type PrivacyRequest = {
  id: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  email: string | null;
  phone: string | null;
  requester_note: string | null;
  metadata: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
};

export async function createPrivacyRequest(input: {
  type: PrivacyRequestType;
  restaurantId?: string | null;
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
  requesterNote?: string | null;
  status?: PrivacyRequestStatus;
  metadata?: Record<string, unknown>;
}) {
  const result = await getPool().query<PrivacyRequest>(
    `INSERT INTO data_privacy_request
       (restaurant_id, customer_id, type, status, email, phone, requester_note, metadata, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, CASE WHEN $4 = 'completed' THEN now() ELSE NULL END)
     RETURNING id, restaurant_id, NULL::text AS restaurant_name, customer_id, NULL::text AS customer_name,
               type, status, email::text, phone, requester_note, metadata, completed_at::text, created_at::text`,
    [
      input.restaurantId ?? null,
      input.customerId ?? null,
      input.type,
      input.status ?? "pending",
      input.email ?? null,
      input.phone ?? null,
      input.requesterNote ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
  return result.rows[0];
}

export async function listPrivacyRequests(restaurantId: string, limit = 50): Promise<PrivacyRequest[]> {
  const result = await getPool().query<PrivacyRequest>(
    `SELECT dpr.id,
            dpr.restaurant_id,
            r.name AS restaurant_name,
            dpr.customer_id,
            c.name AS customer_name,
            dpr.type,
            dpr.status,
            dpr.email::text,
            dpr.phone,
            dpr.requester_note,
            dpr.metadata,
            dpr.completed_at::text,
            dpr.created_at::text
     FROM data_privacy_request dpr
     LEFT JOIN restaurant r ON r.id = dpr.restaurant_id
     LEFT JOIN customer c ON c.id = dpr.customer_id
     WHERE dpr.restaurant_id = $1
     ORDER BY dpr.created_at DESC
     LIMIT $2`,
    [restaurantId, limit]
  );
  return result.rows;
}

export async function getPrivacyRequestForRestaurant(restaurantId: string, requestId: string) {
  const result = await getPool().query<PrivacyRequest>(
    `SELECT dpr.id,
            dpr.restaurant_id,
            r.name AS restaurant_name,
            dpr.customer_id,
            c.name AS customer_name,
            dpr.type,
            dpr.status,
            dpr.email::text,
            dpr.phone,
            dpr.requester_note,
            dpr.metadata,
            dpr.completed_at::text,
            dpr.created_at::text
     FROM data_privacy_request dpr
     LEFT JOIN restaurant r ON r.id = dpr.restaurant_id
     LEFT JOIN customer c ON c.id = dpr.customer_id
     WHERE dpr.restaurant_id = $1 AND dpr.id = $2
     LIMIT 1`,
    [restaurantId, requestId]
  );
  return result.rows[0] ?? null;
}

export async function exportCustomerData(customerId: string) {
  const pool = getPool();
  const [customer, restaurants, reservations, waitlist, whatsapp, privacyRequests] = await Promise.all([
    pool.query(
      `SELECT id, name, email::text, phone, created_at::text
       FROM customer
       WHERE id = $1`,
      [customerId]
    ),
    pool.query(
      `SELECT cr.restaurant_id, r.name AS restaurant_name, r.slug, cr.notes, cr.tags,
              cr.no_show_count, cr.visit_count, cr.vip
       FROM customer_restaurant cr
       JOIN restaurant r ON r.id = cr.restaurant_id
       WHERE cr.customer_id = $1
       ORDER BY r.name`,
      [customerId]
    ),
    pool.query(
      `SELECT r.id, rest.name AS restaurant_name, rest.slug, r.starts_at::text, r.ends_at::text,
              r.party_size, r.status, r.special_requests, r.source, r.created_at::text, r.updated_at::text
       FROM reservation r
       JOIN restaurant rest ON rest.id = r.restaurant_id
       WHERE r.customer_id = $1
       ORDER BY r.starts_at DESC`,
      [customerId]
    ),
    pool.query(
      `SELECT we.id, rest.name AS restaurant_name, rest.slug, we.date::text, we.party_size,
              we.preferred_time::text, we.status, we.special_requests, we.created_at::text, we.updated_at::text
       FROM waitlist_entry we
       JOIN restaurant rest ON rest.id = we.restaurant_id
       WHERE we.customer_id = $1
       ORDER BY we.created_at DESC`,
      [customerId]
    ),
    pool.query(
      `SELECT wc.id AS conversation_id, rest.name AS restaurant_name, rest.slug,
              wc.phone, wc.status, wc.created_at::text,
              COALESCE(
                json_agg(
                  json_build_object(
                    'direction', wm.direction,
                    'body', wm.body,
                    'messageType', wm.message_type,
                    'createdAt', wm.created_at::text
                  )
                  ORDER BY wm.created_at
                ) FILTER (WHERE wm.id IS NOT NULL),
                '[]'
              ) AS messages
       FROM whatsapp_conversation wc
       JOIN restaurant rest ON rest.id = wc.restaurant_id
       LEFT JOIN whatsapp_message wm ON wm.conversation_id = wc.id
       WHERE wc.customer_id = $1
       GROUP BY wc.id, rest.id
       ORDER BY wc.created_at DESC`,
      [customerId]
    ),
    pool.query(
      `SELECT id, type, status, email::text, phone, requester_note, metadata,
              completed_at::text, created_at::text
       FROM data_privacy_request
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    )
  ]);

  return {
    exportedAt: new Date().toISOString(),
    customer: customer.rows[0] ?? null,
    restaurants: restaurants.rows,
    reservations: reservations.rows,
    waitlist: waitlist.rows,
    whatsapp: whatsapp.rows,
    privacyRequests: privacyRequests.rows
  };
}

export async function anonymizeCustomerData(input: {
  customerId: string;
  requestId?: string | null;
  handledBy?: string | null;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ id: string; phone: string }>("SELECT id, phone FROM customer WHERE id = $1 FOR UPDATE", [
      input.customerId
    ]);
    const customer = current.rows[0];
    if (!customer) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "not_found" };
    }

    const redactedPhone = `deleted:${input.customerId}`;
    const futureReservations = await client.query<{ id: string }>(
      `UPDATE reservation
       SET status = 'cancelled', special_requests = NULL, updated_at = now()
       WHERE customer_id = $1
         AND starts_at >= now()
         AND status NOT IN ('cancelled', 'no_show', 'completed')
       RETURNING id`,
      [input.customerId]
    );

    if (futureReservations.rows.length) {
      await client.query(
        "DELETE FROM reservation_mesa WHERE reservation_id = ANY($1::uuid[])",
        [futureReservations.rows.map((row) => row.id)]
      );
    }

    await client.query(
      `UPDATE customer_restaurant
       SET notes = NULL,
           tags = '{}'::text[],
           vip = false
       WHERE customer_id = $1`,
      [input.customerId]
    );
    await client.query(
      `UPDATE waitlist_entry
       SET status = 'cancelled',
           special_requests = NULL,
           updated_at = now()
       WHERE customer_id = $1
         AND status IN ('open', 'notified')`,
      [input.customerId]
    );
    await client.query(
      `UPDATE whatsapp_message
       SET phone = $2,
           body = '[redacted]',
           raw = '{"redacted":true}'::jsonb
       WHERE phone = $1`,
      [customer.phone, redactedPhone]
    );
    await client.query(
      `UPDATE whatsapp_conversation
       SET customer_id = NULL,
           phone = $2,
           state = '{"redacted":true}'::jsonb,
           status = 'closed',
           updated_at = now()
       WHERE customer_id = $1 OR phone = $3`,
      [input.customerId, redactedPhone, customer.phone]
    );
    await client.query(
      `UPDATE customer
       SET name = 'Cliente eliminado',
           email = NULL,
           phone = $2
       WHERE id = $1`,
      [input.customerId, redactedPhone]
    );

    if (input.requestId) {
      await client.query(
        `UPDATE data_privacy_request
         SET status = 'completed',
             handled_by = $3,
             completed_at = now(),
             metadata = metadata || $4::jsonb
         WHERE id = $1 AND customer_id = $2`,
        [
          input.requestId,
          input.customerId,
          input.handledBy ?? null,
          JSON.stringify({ anonymizedAt: new Date().toISOString(), cancelledFutureReservations: futureReservations.rows.length })
        ]
      );
    }

    await client.query("COMMIT");
    return {
      ok: true as const,
      cancelledFutureReservations: futureReservations.rows.length
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePrivacyRequestStatus(input: {
  restaurantId: string;
  requestId: string;
  status: PrivacyRequestStatus;
  handledBy: string;
}) {
  const request = await getPrivacyRequestForRestaurant(input.restaurantId, input.requestId);
  if (!request) return null;

  if (input.status === "completed" && request.type === "delete" && request.customer_id) {
    const deletion = await anonymizeCustomerData({
      customerId: request.customer_id,
      requestId: request.id,
      handledBy: input.handledBy
    });
    if (!deletion.ok) return null;
    return getPrivacyRequestForRestaurant(input.restaurantId, input.requestId);
  }

  const result = await getPool().query<PrivacyRequest>(
    `UPDATE data_privacy_request
     SET status = $3,
         handled_by = $4,
         completed_at = CASE WHEN $3 IN ('completed', 'rejected') THEN now() ELSE NULL END
     WHERE id = $1 AND restaurant_id = $2
     RETURNING id, restaurant_id, NULL::text AS restaurant_name, customer_id, NULL::text AS customer_name,
               type, status, email::text, phone, requester_note, metadata, completed_at::text, created_at::text`,
    [input.requestId, input.restaurantId, input.status, input.handledBy]
  );
  return result.rows[0] ?? null;
}
