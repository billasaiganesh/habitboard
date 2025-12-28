import type { NextRequest } from "next/server";
import { first, run } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
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

    const usernameRaw = (body?.username || "").trim();
    const username = usernameRaw.toLowerCase();
    const password = (body?.password ?? body?.passcode ?? "").toString();

    if (!usernameRaw || usernameRaw.length < 3) return j({ error: "Username must be at least 3 characters" }, 400);
    if (!/^[a-zA-Z0-9_]+$/.test(usernameRaw)) return j({ error: "Username can only use letters, numbers, _" }, 400);
    if (!password || password.length < 6) return j({ error: "Password must be at least 6 characters" }, 400);

    const exists = await first<{ id: string }>(`SELECT id FROM users WHERE username = ?`, [username]);
    if (exists) return j({ error: "Username already taken" }, 409);

    const { saltB64, hashB64 } = await hashPassword(password);

    const userId = uuid();
    await run(
      `INSERT INTO users (id, username, pass_hash, pass_salt, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [userId, username, hashB64, saltB64]
    );

    // Auto-login after register
    const token = uuid();
    const sessionId = uuid();
    const expiresAt = addDaysSql(30);

    await run(
      `INSERT INTO sessions (id, token, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [sessionId, token, userId, expiresAt]
    );

    const isHttps = new URL(req.url).protocol === "https:";

    return j(
      { ok: true },
      200,
      {
        "Set-Cookie": setCookie("hb_session", token, {
          httpOnly: true,
          secure: isHttps,
          sameSite: "Lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        }),
      }
    );
  } catch (err: unknown) {
    console.error("REGISTER_ERROR", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return j({ error: msg }, 500);
  }
}
