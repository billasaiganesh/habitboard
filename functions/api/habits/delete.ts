import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return j({ error: "Missing id" }, 400);

  await context.env.DB.prepare(
    `UPDATE habits SET active = 0 WHERE id = ? AND user_id = ?`
  ).bind(body.id, auth.userId).run();

  return j({ ok: true });
};
