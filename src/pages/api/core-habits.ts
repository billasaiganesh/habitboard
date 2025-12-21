import { requireUser, type Env } from "../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as
    | { habitIds?: string[] }
    | null;

  const habitIds = body?.habitIds;
  if (!Array.isArray(habitIds)) return j({ error: "habitIds must be array" }, 400);
  if (habitIds.length > 10) return j({ error: "Too many core habits (max 10)" }, 400);

  const DB = context.env.DB;

  if (habitIds.length) {
    const qMarks = habitIds.map(() => "?").join(",");
    const owned = await DB.prepare(
      `SELECT id FROM habits WHERE user_id = ? AND active = 1 AND id IN (${qMarks})`
    ).bind(auth.userId, ...habitIds).all();

    const ownedSet = new Set((owned.results || []).map((r: any) => r.id));
    for (const id of habitIds) {
      if (!ownedSet.has(id)) return j({ error: "One or more habits not found/owned" }, 400);
    }
  }

  await DB.prepare(`DELETE FROM user_core_habits WHERE user_id = ?`).bind(auth.userId).run();
  for (const id of habitIds) {
    await DB.prepare(`INSERT INTO user_core_habits (user_id, habit_id) VALUES (?, ?)`)
      .bind(auth.userId, id)
      .run();
  }

  return j({ ok: true });
};
