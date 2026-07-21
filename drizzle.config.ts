import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` diffs the schema against ./drizzle and emits SQL without
// touching a database, so the fallback URL below is only a placeholder that keeps
// the config valid. `migrate` / `push` / `studio` need a real DATABASE_URL.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/sift',
  },
  strict: true,
  verbose: true,
});
