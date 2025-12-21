import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const url = new URL(context.request.url);
  const templateId = url.searchParams.get("templateId");
  if (!templateId) return j({ error: "Missing templateId" }, 400);

  const owned = await context.env.DB.prepare(
    `SELECT id FROM templates WHERE id = ? AND user_id = ?`
  ).bind(templateId, auth.userId).first();
  if (!owned) return j({ error: "Not found" }, 404);

  const rows = await context.env.DB.prepare(
    `SELECT habit_id FROM template_habits WHERE template_id = ?`
  ).bind(templateId).all();

  return j({ habitIds: (rows.results || []).map((r: any) => r.habit_id) });
};
