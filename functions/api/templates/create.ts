import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as { name?: string } | null;
  const name = (body?.name || "").trim();
  if (!name) return j({ error: "Name required" }, 400);

  const id = crypto.randomUUID();
  await context.env.DB.prepare(
    `INSERT INTO templates (id, user_id, name) VALUES (?, ?, ?)`
  ).bind(id, auth.userId, name).run();

  return j({ ok: true, id });
};
