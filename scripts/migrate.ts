import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _app_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrations = ["0000_initial.sql"];

  for (const migration of migrations) {
    const existing = await pool.query("SELECT 1 FROM _app_migrations WHERE name = $1", [migration]);
    if (existing.rowCount) {
      console.log(`skip ${migration}`);
      continue;
    }

    const sql = await readFile(join(process.cwd(), "drizzle", migration), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO _app_migrations (name) VALUES ($1)", [migration]);
      await pool.query("COMMIT");
      console.log(`applied ${migration}`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
