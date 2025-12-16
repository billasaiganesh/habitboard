import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as { id?: string } | null;
  const id = body?.id;
  if (!id) return j({ error: "Missing id" }, 400);

  const owned = await context.env.DB.prepare(
    `SELECT id FROM templates WHERE id = ? AND user_id = ?`
  ).bind(id, auth.userId).first();
  if (!owned) return j({ error: "Not found" }, 404);

  await context.env.DB.prepare(`DELETE FROM template_habits WHERE template_id = ?`).bind(id).run();
  await context.env.DB.prepare(
    `UPDATE day_plan SET template_id = NULL WHERE user_id = ? AND template_id = ?`
  ).bind(auth.userId, id).run();

  await context.env.DB.prepare(
    `DELETE FROM templates WHERE id = ? AND user_id = ?`
  ).bind(id, auth.userId).run();

  return j({ ok: true });
};
