import { requireUser, type Env } from "../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as
    | { day?: string; habitId?: string; checked?: boolean }
    | null;

  const day = body?.day;
  const habitId = body?.habitId;
  const checked = body?.checked;

  if (!day || !habitId || typeof checked !== "boolean") return j({ error: "Bad request" }, 400);

  // ownership check
  const owned = await context.env.DB.prepare(
    `SELECT id FROM habits WHERE id = ? AND user_id = ? AND active = 1`
  ).bind(habitId, auth.userId).first();
  if (!owned) return j({ error: "Habit not found" }, 404);

  await context.env.DB.prepare(
    `INSERT INTO habit_checks (user_id, day, habit_id, checked, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, day, habit_id) DO UPDATE SET
       checked = excluded.checked,
       updated_at = datetime('now')`
  ).bind(auth.userId, day, habitId, checked ? 1 : 0).run();

  return j({ ok: true });
};
