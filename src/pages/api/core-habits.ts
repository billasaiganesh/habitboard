import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { all, run } from "@/lib/server/db";

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

  const body = (await req.json().catch(() => null)) as { habitIds?: string[] } | null;
  const habitIds = body?.habitIds;

  if (!habitIds || !Array.isArray(habitIds)) return j({ error: "Bad request" }, 400);
  if (habitIds.length > 20) return j({ error: "Too many core habits" }, 400);

  // Ensure all provided habits are owned + active
  if (habitIds.length > 0) {
    const qMarks = habitIds.map(() => "?").join(",");
    const owned = await all<{ id: string }>(
      `SELECT id FROM habits
       WHERE user_id = ? AND active = 1 AND id IN (${qMarks})`,
      [auth.userId, ...habitIds]
    );

    if (owned.length !== habitIds.length) {
      return j({ error: "One or more habits not found/owned/active" }, 400);
    }
  }

  // Replace core list
  await run(`DELETE FROM user_core_habits WHERE user_id = ?`, [auth.userId]);

  for (const id of habitIds) {
    await run(
      `INSERT INTO user_core_habits (user_id, habit_id) VALUES (?, ?)`,
      [auth.userId, id]
    );
  }

  return j({ ok: true });
}
