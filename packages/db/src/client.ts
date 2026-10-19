import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

// The WebSocket driver (neon-serverless) is used instead of the HTTP driver
// because the domain logic relies on interactive transactions with
// `SELECT ... FOR UPDATE` for seat/tier inventory. In Node runtimes a
// WebSocket implementation must be provided; browsers/edge supply their own.
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({
  client: pool,
  schema,
  casing: "snake_case",
});
