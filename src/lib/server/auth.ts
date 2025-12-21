import { getCookie } from "./cookies";

export type Env = {
  DB: D1Database;
};

export async function requireUser(req: Request, env: Env) {
  const token = getCookie(req, "hb_session");
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT s.user_id, u.username, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first<{ user_id: string; username: string; expires_at: string }>();

  if (!row) return null;

  // expiry check (SQLite datetime string compare is OK if same format)
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 19).replace("T", " ");
  if (row.expires_at < nowIso) return null;

  return { userId: row.user_id, username: row.username, token };
}
