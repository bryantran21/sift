import './src/env';
import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` diffs the schema against ./drizzle and emits SQL without
// touching a database, so the fallback URL below is only a placeholder that keeps
// the config valid. `migrate` / `push` / `studio` need a real connection.
//
// Migrations must use a SESSION-mode (:5432) or direct connection — the transaction
// pooler (:6543) the app uses for serverless doesn't support the session features
// migrations rely on. Prefer MIGRATION_DATABASE_URL, falling back to DATABASE_URL
// (so nothing breaks if you keep a single :5432 URL for everything).
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.MIGRATION_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgres://placeholder:placeholder@localhost:5432/sift',
  },
  strict: true,
  verbose: true,
});
