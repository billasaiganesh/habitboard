import { requireUser, type Env } from "../../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as
    | { id?: string; name?: string; points?: number; section?: string; sort_order?: number; active?: boolean }
    | null;

  if (!body?.id) return j({ error: "Missing id" }, 400);

  const id = body.id;
  const name = body.name !== undefined ? body.name.trim() : undefined;
  const points = body.points !== undefined ? Number(body.points) : undefined;
  const section = body.section !== undefined ? body.section.trim() : undefined;
  const sort = body.sort_order !== undefined ? Number(body.sort_order) : undefined;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : undefined;

  if (section !== undefined && !["Morning", "Work", "Evening"].includes(section)) return j({ error: "Invalid section" }, 400);
  if (points !== undefined && (!Number.isFinite(points) || points < 0 || points > 10)) return j({ error: "Invalid points (0..10)" }, 400);

  const owned = await context.env.DB.prepare(
    `SELECT id FROM habits WHERE id = ? AND user_id = ?`
  ).bind(id, auth.userId).first();

  if (!owned) return j({ error: "Not found" }, 404);

  await context.env.DB.prepare(
    `UPDATE habits
     SET name = COALESCE(?, name),
         points = COALESCE(?, points),
         section = COALESCE(?, section),
         sort_order = COALESCE(?, sort_order),
         active = COALESCE(?, active)
     WHERE id = ? AND user_id = ?`
  ).bind(
    name ?? null,
    points ?? null,
    section ?? null,
    sort ?? null,
    active ?? null,
    id,
    auth.userId
  ).run();

  return j({ ok: true });
};
