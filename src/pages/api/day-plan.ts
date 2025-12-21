import { requireUser, type Env } from "../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const url = new URL(context.request.url);
  const day = url.searchParams.get("day");
  if (!day) return j({ error: "Missing day" }, 400);

  const row = await context.env.DB.prepare(
    `SELECT template_id FROM day_plan WHERE user_id = ? AND day = ?`
  ).bind(auth.userId, day).first<{ template_id: string | null }>();

  return j({ day, templateId: row?.template_id ?? null });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as
    | { day?: string; templateId?: string | null }
    | null;

  const day = body?.day;
  const templateId = body?.templateId ?? null;
  if (!day) return j({ error: "Missing day" }, 400);

  if (templateId) {
    const owned = await context.env.DB.prepare(
      `SELECT id FROM templates WHERE id = ? AND user_id = ?`
    ).bind(templateId, auth.userId).first();
    if (!owned) return j({ error: "Template not found/owned" }, 400);
  }

  await context.env.DB.prepare(
    `INSERT INTO day_plan (user_id, day, template_id)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET template_id = excluded.template_id`
  ).bind(auth.userId, day, templateId).run();

  return j({ ok: true });
};
