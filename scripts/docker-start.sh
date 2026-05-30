#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

echo "Waiting for PostgreSQL..."
node --input-type=module <<'NODE'
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let lastError;

for (let attempt = 1; attempt <= 60; attempt += 1) {
  try {
    await pool.query("select 1");
    await pool.end();
    process.exit(0);
  } catch (error) {
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

console.error(lastError);
await pool.end().catch(() => undefined);
process.exit(1);
NODE

echo "Running migrations..."
npm run db:migrate

if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "Seeding demo data..."
  npm run db:seed
fi

echo "Starting Next.js on 0.0.0.0:${PORT:-3000}"
exec npm run start -- -H 0.0.0.0 -p "${PORT:-3000}"
