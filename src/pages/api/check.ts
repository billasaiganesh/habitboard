import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { first, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body =
    (await req.json().catch(() => null)) as
      | { day?: string; habitId?: string; checked?: boolean }
      | null;

  const day = body?.day;
  const habitId = body?.habitId;
  const checked = body?.checked;

  if (!day || !habitId || typeof checked !== "boolean") return j({ error: "Bad request" }, 400);

  const owned = await first<{ id: string }>(
    `SELECT id FROM habits WHERE id = ? AND user_id = ? AND active = 1`,
    [habitId, auth.userId]
  );
  if (!owned) return j({ error: "Habit not found" }, 404);

  await run(
    `INSERT INTO habit_checks (user_id, day, habit_id, checked, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, day, habit_id) DO UPDATE SET
       checked = excluded.checked,
       updated_at = datetime('now')`,
    [auth.userId, day, habitId, checked ? 1 : 0]
  );

  return j({ ok: true });
}
