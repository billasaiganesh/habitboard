import { requireUser, type Env } from "../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
}

function monthStartEnd(ym: string) {
  const [Y, M] = ym.split("-").map(Number);
  const first = new Date(Y, M - 1, 1);
  const last = new Date(Y, M, 0);
  return { first, last, start: ymd(first), end: ymd(last) };
}

async function pointsForDay(DB: D1Database, userId: string, day: string) {
  const plan = await DB.prepare(
    `SELECT template_id FROM day_plan WHERE user_id = ? AND day = ?`
  ).bind(userId, day).first<{ template_id: string | null }>();
  const templateId = plan?.template_id ?? null;

  if (!templateId) {
    const totalRow = await DB.prepare(
      `SELECT COALESCE(SUM(points), 0) AS totalPoints
       FROM habits WHERE user_id = ? AND active = 1`
    ).bind(userId).first<{ totalPoints: number }>();

    const doneRow = await DB.prepare(
      `SELECT COALESCE(SUM(h.points), 0) AS donePoints
       FROM habit_checks hc
       JOIN habits h ON h.id = hc.habit_id
       WHERE hc.user_id = ? AND hc.day = ? AND hc.checked = 1 AND h.active = 1`
    ).bind(userId, day).first<{ donePoints: number }>();

    return { templateId: null, totalPoints: Number(totalRow?.totalPoints || 0), donePoints: Number(doneRow?.donePoints || 0) };
  }

  const totalRow = await DB.prepare(
    `SELECT COALESCE(SUM(h.points), 0) AS totalPoints
     FROM habits h
     JOIN template_habits th ON th.habit_id = h.id
     WHERE h.user_id = ? AND h.active = 1 AND th.template_id = ?`
  ).bind(userId, templateId).first<{ totalPoints: number }>();

  const doneRow = await DB.prepare(
    `SELECT COALESCE(SUM(h.points), 0) AS donePoints
     FROM habit_checks hc
     JOIN habits h ON h.id = hc.habit_id
     JOIN template_habits th ON th.habit_id = h.id
     WHERE hc.user_id = ? AND hc.day = ? AND hc.checked = 1
       AND h.active = 1 AND th.template_id = ?`
  ).bind(userId, day, templateId).first<{ donePoints: number }>();

  return { templateId, totalPoints: Number(totalRow?.totalPoints || 0), donePoints: Number(doneRow?.donePoints || 0) };
}

async function ensureSettings(DB: D1Database, userId: string) {
  await DB.prepare(
    `INSERT INTO user_settings (user_id)
     VALUES (?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId).run();
}

async function isCoreWin(DB: D1Database, userId: string, day: string) {
  const core = await DB.prepare(
    `SELECT habit_id FROM user_core_habits WHERE user_id = ?`
  ).bind(userId).all();
  const coreIds = (core.results || []).map((r: any) => r.habit_id) as string[];
  if (coreIds.length === 0) return { configured: false, win: false };

  const checked = await DB.prepare(
    `SELECT habit_id FROM habit_checks WHERE user_id = ? AND day = ? AND checked = 1`
  ).bind(userId, day).all();

  const checkedSet = new Set((checked.results || []).map((r: any) => r.habit_id));
  return { configured: true, win: coreIds.every((id) => checkedSet.has(id)) };
}

async function isDailyWin(DB: D1Database, userId: string, day: string) {
  await ensureSettings(DB, userId);
  const s = await DB.prepare(
    `SELECT win_mode, win_threshold_percent FROM user_settings WHERE user_id = ?`
  ).bind(userId).first<{ win_mode: string; win_threshold_percent: number }>();

  const mode = (s?.win_mode || "points") as "points" | "core";
  const threshold = Number(s?.win_threshold_percent || 70);

  if (mode === "core") {
    const core = await isCoreWin(DB, userId, day);
    if (core.configured) return { isWin: core.win, modeUsed: "core", usedFallback: false };
    const pts = await pointsForDay(DB, userId, day);
    const win = pts.totalPoints > 0 && (pts.donePoints / pts.totalPoints) >= (threshold / 100);
    return { isWin: win, modeUsed: "points", usedFallback: true };
  }

  const pts = await pointsForDay(DB, userId, day);
  const win = pts.totalPoints > 0 && (pts.donePoints / pts.totalPoints) >= (threshold / 100);
  return { isWin: win, modeUsed: "points", usedFallback: false };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const url = new URL(context.request.url);
  const ym = url.searchParams.get("ym");
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return j({ error: "Missing/invalid ym (YYYY-MM)" }, 400);

  const { first, last, start, end } = monthStartEnd(ym);

  const days: string[] = [];
  {
    const d = new Date(first);
    while (d <= last) {
      days.push(ymd(d));
      d.setDate(d.getDate() + 1);
    }
  }

  const DB = context.env.DB;
  const out: any[] = [];
  for (const day of days) {
    const pts = await pointsForDay(DB, auth.userId, day);
    const win = await isDailyWin(DB, auth.userId, day);
    out.push({
      day,
      totalPoints: pts.totalPoints,
      donePoints: pts.donePoints,
      isWin: win.isWin,
      templateId: pts.templateId,
    });
  }

  return j({ ym, start, end, days: out });
};
