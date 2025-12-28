import type { NextRequest } from "next/server";
import { first, run } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { setCookie } from "@/lib/server/cookies";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

function uuid() {
  return crypto.randomUUID();
}

function addDaysSql(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 19).replace("T", " "); // sqlite datetime
}

export default async function handler(req: NextRequest): Promise<Response> {
  try {
    if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

    const body =
      (await req.json().catch(() => null)) as
        | { username?: string; password?: string; passcode?: string }
        | null;

    const username = (body?.username || "").trim().toLowerCase();
    const password = (body?.password ?? body?.passcode ?? "").toString();

    if (!username) return j({ error: "Missing username" }, 400);
    if (!password) return j({ error: "Missing password" }, 400);

    const user = await first<{
      id: string;
      username: string;
      pass_hash: string;
      pass_salt: string;
    }>(`SELECT id, username, pass_hash, pass_salt FROM users WHERE username = ?`, [username]);

    if (!user) return j({ error: "Invalid username or password" }, 401);

    const ok = await verifyPassword(password, user.pass_salt, user.pass_hash);
    if (!ok) return j({ error: "Invalid username or password" }, 401);

    const token = uuid();
    const sessionId = uuid();
    const expiresAt = addDaysSql(30);

    await run(
      `INSERT INTO sessions (id, token, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [sessionId, token, user.id, expiresAt]
    );

    const isHttps = new URL(req.url).protocol === "https:";

    return j(
      { ok: true },
      200,
      {
        "Set-Cookie": setCookie("hb_session", token, {
          httpOnly: true,
          secure: isHttps, // false locally, true on Cloudflare
          sameSite: "Lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        }),
      }
    );
  } catch (err: unknown) {
    console.error("LOGIN_ERROR", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return j({ error: msg }, 500);
  }
}
