import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // DB-backed tests run serially (shared Postgres state) and need headroom.
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
