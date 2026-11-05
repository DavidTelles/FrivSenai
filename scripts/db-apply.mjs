import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const file = process.argv[2] ?? "db/schema.sql";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(readFileSync(file, "utf8"));
  console.log(`Applied ${file}`);
} finally {
  await pool.end();
}
