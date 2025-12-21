import { getRequestContext } from "@cloudflare/next-on-pages";

export type Env = { DB: D1Database };

export function getEnv(): Env {
  const ctx = getRequestContext();
  if (!ctx?.env) {
    throw new Error(
      "Cloudflare request context not found. Use `npm run preview` (wrangler pages dev) or deploy to Cloudflare."
    );
  }
  const env = ctx.env as Partial<Env>;
  if (!env.DB) {
    throw new Error("Missing D1 binding `DB`. Bind your D1 database to `DB` in Cloudflare Pages.");
  }
  return env as Env;
}
