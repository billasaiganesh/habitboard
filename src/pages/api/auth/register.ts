import type { NextRequest } from "next/server";
import { first, run } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeId() {
  return crypto.randomUUID();
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const body =
    (await req.json().catch(() => null)) as
      | { username?: string; password?: string }
      | null;

  const username = (body?.username || "").trim();
  const password = body?.password || "";

  if (!username || username.length < 3) return j({ error: "Username must be at least 3 characters" }, 400);
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return j({ error: "Username can only use letters, numbers, _" }, 400);
  if (!password || password.length < 6) return j({ error: "Password must be at least 6 characters" }, 400);

  const exists = await first<{ id: string }>(
    `SELECT id FROM users WHERE username = ?`,
    [username]
  );
  if (exists) return j({ error: "Username already taken" }, 409);

  const { saltB64, hashB64 } = await hashPassword(password);

  const id = makeId();
  await run(
    `INSERT INTO users (id, username, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [id, username, hashB64, saltB64]
  );

  return j({ ok: true });
}
