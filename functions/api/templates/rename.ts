import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as { id?: string; name?: string } | null;
  const id = body?.id;
  const name = (body?.name || "").trim();
  if (!id || !name) return j({ error: "Missing id or name" }, 400);

  const owned = await context.env.DB.prepare(
    `SELECT id FROM templates WHERE id = ? AND user_id = ?`
  ).bind(id, auth.userId).first();
  if (!owned) return j({ error: "Not found" }, 404);

  await context.env.DB.prepare(
    `UPDATE templates SET name = ? WHERE id = ? AND user_id = ?`
  ).bind(name, id, auth.userId).run();

  return j({ ok: true });
};
