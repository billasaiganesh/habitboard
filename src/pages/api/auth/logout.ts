import { type Env } from "../../_lib/auth";
import { verifyPasscode } from "../../_lib/crypto";
import { setCookie } from "../../_lib/cookies";

function j(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await context.request.json().catch(() => null) as
    | { username?: string; passcode?: string }
    | null;

  const username = (body?.username || "").trim().toLowerCase();
  const passcode = (body?.passcode || "").trim();

  if (!username || !passcode) return j({ error: "Missing username/passcode" }, 400);

  const user = await context.env.DB.prepare(
    `SELECT id, pass_hash, pass_salt FROM users WHERE username = ?`
  ).bind(username).first<{ id: string; pass_hash: string; pass_salt: string }>();

  if (!user) return j({ error: "Invalid credentials" }, 401);

  const ok = await verifyPasscode(passcode, user.pass_salt, user.pass_hash);
  if (!ok) return j({ error: "Invalid credentials" }, 401);

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const expiresSql = expires.toISOString().slice(0, 19).replace("T", " ");

  await context.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, token, expiresSql).run();

  return j(
    { ok: true, username },
    200,
    { "Set-Cookie": setCookie("hb_session", token, { maxAgeSec: 60 * 60 * 24 * 30 }) }
  );
};
    