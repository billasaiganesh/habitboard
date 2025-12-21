import { getCookie } from "./cookies";
import { first } from "./db";

export async function requireUser(req: Request) {
  const token = getCookie(req, "hb_session");
  if (!token) return null;

  const row = await first<{
    user_id: string;
    username: string;
    expires_at: string;
  }>(
    `SELECT s.user_id, u.username, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token]
  );

  if (!row) return null;

  const nowIso = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (row.expires_at < nowIso) return null;

  return { userId: row.user_id, username: row.username, token };
}
