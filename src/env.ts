// Standalone scripts (tsx) and drizzle-kit don't auto-load .env.local the way
// Next.js does. Import this first to load it, with .env.local taking precedence
// over .env (dotenv never overrides already-set vars, so the first load wins).
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true }); // .env fallback
