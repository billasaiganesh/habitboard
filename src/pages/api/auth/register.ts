import { type Env } from "../../_lib/auth";
import { hashPasscode } from "../../_lib/crypto";
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

  if (!username || username.length < 3) return j({ error: "Username must be at least 3 chars" }, 400);
  if (!passcode || passcode.length < 4) return j({ error: "Passcode must be at least 4 chars" }, 400);

  const existing = await context.env.DB.prepare(
    `SELECT id FROM users WHERE username = ?`
  ).bind(username).first();

  if (existing) return j({ error: "Username already exists" }, 409);

  const { saltB64, hashB64 } = await hashPasscode(passcode);

  const userId = crypto.randomUUID();
  await context.env.DB.prepare(
    `INSERT INTO users (id, username, pass_hash, pass_salt) VALUES (?, ?, ?, ?)`
  ).bind(userId, username, hashB64, saltB64).run();

  // create session
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30d
  const expiresSql = expires.toISOString().slice(0, 19).replace("T", " ");

  await context.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), userId, token, expiresSql).run();

  return j(
    { ok: true, username },
    200,
    { "Set-Cookie": setCookie("hb_session", token, { maxAgeSec: 60 * 60 * 24 * 30 }) }
  );
};
