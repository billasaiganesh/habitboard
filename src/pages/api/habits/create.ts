import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as
    | { name?: string; points?: number; section?: string; sort_order?: number }
    | null;

  const name = (body?.name || "").trim();
  const points = Number(body?.points ?? 1);
  const section = (body?.section || "Morning").trim();
  const sort = Number(body?.sort_order ?? 999);

  if (!name) return j({ error: "Name required" }, 400);
  if (!["Morning", "Work", "Evening"].includes(section)) return j({ error: "Invalid section" }, 400);
  if (!Number.isFinite(points) || points < 0 || points > 10) return j({ error: "Invalid points (0..10)" }, 400);

  const id = crypto.randomUUID();
  await context.env.DB.prepare(
    `INSERT INTO habits (id, user_id, name, points, section, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(id, auth.userId, name, points, section, sort).run();

  return j({ ok: true, id });
};
