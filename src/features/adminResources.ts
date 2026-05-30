import { getPool } from "@/lib/db";

type CastMap = Record<string, string>;

export async function listRows(table: string, restaurantId: string, orderBy = "created_at") {
  const result = await getPool().query(`SELECT * FROM ${table} WHERE restaurant_id = $1 ORDER BY ${orderBy}`, [restaurantId]);
  return result.rows;
}

export async function insertRow(table: string, restaurantId: string, values: Record<string, unknown>, casts: CastMap = {}) {
  const keys = Object.keys(values).filter((key) => values[key] !== undefined);
  const columns = ["restaurant_id", ...keys];
  const params = [restaurantId, ...keys.map((key) => values[key])];
  const placeholders = columns.map((column, index) => {
    const cast = casts[column];
    return `$${index + 1}${cast ? `::${cast}` : ""}`;
  });

  const result = await getPool().query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function updateRow(
  table: string,
  restaurantId: string,
  id: string,
  values: Record<string, unknown>,
  casts: CastMap = {}
) {
  const keys = Object.keys(values).filter((key) => values[key] !== undefined);
  if (!keys.length) {
    const current = await getPool().query(`SELECT * FROM ${table} WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
    return current.rows[0] ?? null;
  }

  const sets = keys.map((key, index) => `${key} = $${index + 3}${casts[key] ? `::${casts[key]}` : ""}`);
  const result = await getPool().query(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE id = $1 AND restaurant_id = $2 RETURNING *`,
    [id, restaurantId, ...keys.map((key) => values[key])]
  );
  return result.rows[0] ?? null;
}

export async function deleteRow(table: string, restaurantId: string, id: string) {
  const result = await getPool().query(`DELETE FROM ${table} WHERE id = $1 AND restaurant_id = $2 RETURNING id`, [
    id,
    restaurantId
  ]);
  return result.rows[0] ?? null;
}

export function unauthorized(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHORIZED";
}
