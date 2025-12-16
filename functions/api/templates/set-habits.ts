import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as
    | { templateId?: string; habitIds?: string[] }
    | null;

  const templateId = body?.templateId;
  const habitIds = body?.habitIds;
  if (!templateId || !Array.isArray(habitIds)) return j({ error: "Bad request" }, 400);

  const DB = context.env.DB;

  const owned = await DB.prepare(
    `SELECT id FROM templates WHERE id = ? AND user_id = ?`
  ).bind(templateId, auth.userId).first();
  if (!owned) return j({ error: "Not found" }, 404);

  if (habitIds.length) {
    const q = habitIds.map(() => "?").join(",");
    const rows = await DB.prepare(
      `SELECT id FROM habits WHERE user_id = ? AND active = 1 AND id IN (${q})`
    ).bind(auth.userId, ...habitIds).all();
    const ownedSet = new Set((rows.results || []).map((r: any) => r.id));
    for (const id of habitIds) if (!ownedSet.has(id)) return j({ error: "Habit not found/owned/active" }, 400);
  }

  await DB.prepare(`DELETE FROM template_habits WHERE template_id = ?`).bind(templateId).run();
  for (const hid of habitIds) {
    await DB.prepare(
      `INSERT INTO template_habits (template_id, habit_id) VALUES (?, ?)`
    ).bind(templateId, hid).run();
  }

  return j({ ok: true });
};
