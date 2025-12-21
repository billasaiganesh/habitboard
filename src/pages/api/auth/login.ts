import type { NextRequest } from "next/server";
import { first, run } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { setCookie } from "@/lib/server/cookies";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
  });
}

function isoSql(dt: Date) {
  return dt.toISOString().slice(0, 19).replace("T", " ");
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const body =
    (await req.json().catch(() => null)) as
      | { username?: string; password?: string }
      | null;

  const username = (body?.username || "").trim();
  const password = body?.password || "";

  if (!username || !password) return j({ error: "Missing username/password" }, 400);

  const user = await first<{
    id: string;
    username: string;
    password_hash: string;
    password_salt: string;
  }>(
    `SELECT id, username, password_hash, password_salt
     FROM users WHERE username = ?`,
    [username]
  );

  if (!user) return j({ error: "Invalid username or password" }, 401);

  const ok = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!ok) return j({ error: "Invalid username or password" }, 401);

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
  const expiresSql = isoSql(expires);

  await run(
    `INSERT INTO sessions (token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [token, user.id, expiresSql]
  );

  const isLocalhost = (new URL(req.url)).hostname === "localhost";
  const cookie = setCookie("hb_session", token, {
    maxAgeSeconds: 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: !isLocalhost, // secure cookies don't work on http://localhost
    sameSite: "Lax",
    path: "/",
  });

  return j({ ok: true }, 200, { "Set-Cookie": cookie });
}
