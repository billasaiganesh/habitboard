import { getRequestContext } from "@cloudflare/next-on-pages";

export type Env = {
  DB: D1Database;
};

export function getEnv(): Env {
  const ctx = getRequestContext();

  // next-on-pages provides env here (CF Pages / Wrangler)
  const env = ctx?.env as unknown as Env | undefined;
  if (!env || !("DB" in env) || !env.DB) {
    throw new Error(
      "Missing D1 binding 'DB'. If using Pages Git deploy, add DB binding in Pages → Settings → Functions → D1."
    );
  }

  return env;
}
