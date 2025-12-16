import { requireUser, type Env } from "../_lib/auth";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
}

function addDays(ymdStr: string, delta: number) {
  const d = new Date(ymdStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return ymd(d);
}

function mondayWeekRange(day: string) {
  const d = new Date(day + "T00:00:00");
  const dow = d.getDay(); // 0 Sun..6 Sat
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: ymd(mon), end: ymd(sun) };
}

function monthRange(day: string) {
  const d = new Date(day + "T00:00:00");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: ymd(first), end: ymd(last) };
}

async function ensureSettings(DB: D1Database, userId: string) {
  await DB.prepare(
    `INSERT INTO user_settings (user_id) VALUES (?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId).run();
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

    return { totalPoints: Number(totalRow?.totalPoints || 0), donePoints: Number(doneRow?.donePoints || 0) };
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

  return { totalPoints: Number(totalRow?.totalPoints || 0), donePoints: Number(doneRow?.donePoints || 0) };
}

async function isCoreWin(DB: D1Database, userId: string, day: string) {
  const core = await DB.prepare(
    `SELECT habit_id FROM user_core_habits WHERE user_id = ?`
  ).bind(userId).all();
  const coreIds = (core.results || []).map((r: any) => r.habit_id) as string[];
  if (coreIds.length === 0) return { configured: false, win: false };

  const checked = await DB.prepare(
    `SELECT habit_id FROM habit_checks
     WHERE user_id = ? AND day = ? AND checked = 1`
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
    if (core.configured) return { win: core.win, mode: "core" as const, threshold, usedFallback: false };
    const { totalPoints, donePoints } = await pointsForDay(DB, userId, day);
    const win = totalPoints > 0 && (donePoints / totalPoints) >= (threshold / 100);
    return { win, mode: "points" as const, threshold, usedFallback: true };
  }

  const { totalPoints, donePoints } = await pointsForDay(DB, userId, day);
  const win = totalPoints > 0 && (donePoints / totalPoints) >= (threshold / 100);
  return { win, mode: "points" as const, threshold, usedFallback: false };
}

async function dailyWinMap(DB: D1Database, userId: string, endDay: string, lookbackDays: number) {
  const days: string[] = [];
  for (let i = lookbackDays - 1; i >= 0; i--) days.push(addDays(endDay, -i));

  const winByDay: Record<string, boolean> = {};
  for (const d of days) {
    const r = await isDailyWin(DB, userId, d);
    winByDay[d] = r.win;
  }
  return { days, winByDay };
}

function computeDailyStreak(days: string[], winByDay: Record<string, boolean>) {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (winByDay[days[i]]) streak++;
    else break;
  }
  return streak;
}

function winsInRange(days: string[], winByDay: Record<string, boolean>, start: string, end: string) {
  return days.filter((d) => d >= start && d <= end && winByDay[d]).length;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireUser(context.request, context.env);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const url = new URL(context.request.url);
  const day = url.searchParams.get("day") || new Intl.DateTimeFormat("en-CA").format(new Date());

  const DB = context.env.DB;
  await ensureSettings(DB, auth.userId);

  const settings = await DB.prepare(
    `SELECT win_mode, win_threshold_percent, weekly_win_target, monthly_win_target
     FROM user_settings WHERE user_id = ?`
  ).bind(auth.userId).first<any>();

  const pts = await pointsForDay(DB, auth.userId, day);
  const daily = await isDailyWin(DB, auth.userId, day);

  const { days, winByDay } = await dailyWinMap(DB, auth.userId, day, 120);

  const dailyStreak = computeDailyStreak(days, winByDay);

  const w = mondayWeekRange(day);
  const winsThisWeek = winsInRange(days, winByDay, w.start, w.end);
  const weeklyTarget = Number(settings?.weekly_win_target || 5);

  let weeklyStreak = 0;
  let cursor = day;
  for (let i = 0; i < 52; i++) {
    const r = mondayWeekRange(cursor);
    const wins = winsInRange(days, winByDay, r.start, r.end);
    if (wins >= weeklyTarget) weeklyStreak++;
    else break;
    cursor = addDays(r.start, -1);
  }

  const m = monthRange(day);
  const winsThisMonth = winsInRange(days, winByDay, m.start, m.end);
  const monthlyTarget = Number(settings?.monthly_win_target || 20);

  let monthlyStreak = 0;
  let monthCursor = day;
  for (let i = 0; i < 24; i++) {
    const r = monthRange(monthCursor);
    const wins = winsInRange(days, winByDay, r.start, r.end);
    if (wins >= monthlyTarget) monthlyStreak++;
    else break;
    monthCursor = addDays(r.start, -1);
  }

  const last7 = days.slice(-7);
  const last30 = days.slice(-30);
  const winRate7 = last7.filter((d) => winByDay[d]).length / last7.length;
  const winRate30 = last30.filter((d) => winByDay[d]).length / last30.length;

  return j({
    day,
    points: pts,
    daily: { isWin: daily.win, modeUsed: daily.mode, threshold: daily.threshold, usedFallback: daily.usedFallback },
    streaks: { dailyStreak, weeklyStreak, monthlyStreak },
    week: { start: w.start, end: w.end, winsThisWeek, weeklyTarget },
    month: { start: m.start, end: m.end, winsThisMonth, monthlyTarget },
    rates: { winRate7, winRate30 },
    settings,
  });
};
