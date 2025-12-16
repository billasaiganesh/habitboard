import { requireUser, type Env } from "../_lib/auth";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const url = new URL(context.request.url);
  const day = url.searchParams.get("day");
  if (!day) return new Response("Missing day", { status: 400 });

  const DB = context.env.DB;

  const plan = await DB.prepare(
    `SELECT template_id FROM day_plan WHERE user_id = ? AND day = ?`
  ).bind(auth.userId, day).first<{ template_id: string | null }>();
  const templateId = plan?.template_id ?? null;

  let habitsQuery = `
    SELECT id, name, points, section, sort_order
    FROM habits
    WHERE user_id = ? AND active = 1
    ORDER BY section, sort_order
  `;
  let binds: any[] = [auth.userId];

  if (templateId) {
    habitsQuery = `
      SELECT h.id, h.name, h.points, h.section, h.sort_order
      FROM habits h
      JOIN template_habits th ON th.habit_id = h.id
      WHERE h.user_id = ? AND h.active = 1 AND th.template_id = ?
      ORDER BY h.section, h.sort_order
    `;
    binds = [auth.userId, templateId];
  }

  const habits = await DB.prepare(habitsQuery).bind(...binds).all();

  const checks = await DB.prepare(
    `SELECT habit_id, checked
     FROM habit_checks
     WHERE user_id = ? AND day = ?`
  ).bind(auth.userId, day).all();

  return new Response(JSON.stringify({
    templateId,
    habits: habits.results,
    checks: checks.results
  }), { headers: { "Content-Type": "application/json" } });
};
