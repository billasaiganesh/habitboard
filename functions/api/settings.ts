import { requireUser, type Env } from "../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function ensureSettings(DB: D1Database, userId: string) {
  await DB.prepare(
    `INSERT INTO user_settings (user_id)
     VALUES (?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId).run();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const DB = context.env.DB;
  await ensureSettings(DB, auth.userId);

  const settings = await DB.prepare(
    `SELECT win_mode, win_threshold_percent, weekly_win_target, monthly_win_target
     FROM user_settings WHERE user_id = ?`
  ).bind(auth.userId).first();

  const core = await DB.prepare(
    `SELECT habit_id FROM user_core_habits WHERE user_id = ?`
  ).bind(auth.userId).all();

  return j({
    settings,
    coreHabitIds: (core.results || []).map((r: any) => r.habit_id),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = await context.request.json().catch(() => null) as
    | {
        win_mode?: "points" | "core";
        win_threshold_percent?: number;
        weekly_win_target?: number;
        monthly_win_target?: number;
      }
    | null;

  if (!body) return j({ error: "Bad request" }, 400);

  const { win_mode, win_threshold_percent, weekly_win_target, monthly_win_target } = body;

  if (win_mode && !["points", "core"].includes(win_mode)) return j({ error: "Invalid win_mode" }, 400);
  if (win_threshold_percent !== undefined && (win_threshold_percent < 50 || win_threshold_percent > 100))
    return j({ error: "win_threshold_percent must be 50..100" }, 400);
  if (weekly_win_target !== undefined && (weekly_win_target < 1 || weekly_win_target > 7))
    return j({ error: "weekly_win_target must be 1..7" }, 400);
  if (monthly_win_target !== undefined && (monthly_win_target < 1 || monthly_win_target > 31))
    return j({ error: "monthly_win_target must be 1..31" }, 400);

  const DB = context.env.DB;
  await ensureSettings(DB, auth.userId);

  await DB.prepare(
    `UPDATE user_settings
     SET win_mode = COALESCE(?, win_mode),
         win_threshold_percent = COALESCE(?, win_threshold_percent),
         weekly_win_target = COALESCE(?, weekly_win_target),
         monthly_win_target = COALESCE(?, monthly_win_target)
     WHERE user_id = ?`
  )
    .bind(
      win_mode ?? null,
      win_threshold_percent ?? null,
      weekly_win_target ?? null,
      monthly_win_target ?? null,
      auth.userId
    )
    .run();

  return j({ ok: true });
};
