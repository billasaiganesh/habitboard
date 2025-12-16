import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const rows = await context.env.DB.prepare(
    `SELECT id, name, created_at FROM templates
     WHERE user_id = ?
     ORDER BY created_at DESC`
  ).bind(auth.userId).all();

  return j({ templates: rows.results || [] });
};
