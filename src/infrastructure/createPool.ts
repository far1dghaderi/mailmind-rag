import pg from "pg";

export function createPool(url = process.env.DATABASE_URL): pg.Pool {
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in, or run via `npm run ask|index|db:init`.");
  return new pg.Pool({ connectionString: url });
}
