import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { DB, first, all, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

type DaySummary = {
  day: string;
  totalPoints: number;
  donePoints: number;
  isWin: boolean;
  templateId: string | null;
};

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function monthStartEnd(ym: string) {
  const [Y, M] = ym.split("-").map(Number);
  const firstD = new Date(Y, M - 1, 1);
  const lastD = new Date(Y, M, 0);
  return { firstD, lastD, start: ymd(firstD), end: ymd(lastD) };
}

async function pointsForDay(userId: string, day: string) {
  // NOTE: using day_plans (plural) to match your newer day-plan API + migrations
  const plan = await first<{ template_id: string | null }>(
    `SELECT template_id FROM day_plans WHERE user_id = ? AND day = ?`,
    [userId, day]
  );
  const templateId = plan?.template_id ?? null;

  if (!templateId) {
    const totalRow = await first<{ totalPoints: number }>(
      `SELECT COALESCE(SUM(points), 0) AS totalPoints
       FROM habits
       WHERE user_id = ? AND active = 1`,
      [userId]
    );

    const doneRow = await first<{ donePoints: number }>(
      `SELECT COALESCE(SUM(h.points), 0) AS donePoints
       FROM habit_checks hc
       JOIN habits h ON h.id = hc.habit_id
       WHERE hc.user_id = ? AND hc.day = ? AND hc.checked = 1 AND h.active = 1`,
      [userId, day]
    );

    return {
      templateId: null,
      totalPoints: Number(totalRow?.totalPoints || 0),
      donePoints: Number(doneRow?.donePoints || 0),
    };
  }

  const totalRow = await first<{ totalPoints: number }>(
    `SELECT COALESCE(SUM(h.points), 0) AS totalPoints
     FROM habits h
     JOIN template_habits th ON th.habit_id = h.id
     WHERE h.user_id = ? AND h.active = 1 AND th.template_id = ?`,
    [userId, templateId]
  );

  const doneRow = await first<{ donePoints: number }>(
    `SELECT COALESCE(SUM(h.points), 0) AS donePoints
     FROM habit_checks hc
     JOIN habits h ON h.id = hc.habit_id
     JOIN template_habits th ON th.habit_id = h.id
     WHERE hc.user_id = ? AND hc.day = ? AND hc.checked = 1
       AND h.active = 1 AND th.template_id = ?`,
    [userId, day, templateId]
  );

  return {
    templateId,
    totalPoints: Number(totalRow?.totalPoints || 0),
    donePoints: Number(doneRow?.donePoints || 0),
  };
}

async function ensureSettings(userId: string) {
  await run(
    `INSERT INTO user_settings (user_id)
     VALUES (?)
     ON CONFLICT(user_id) DO NOTHING`,
    [userId]
  );
}

async function isCoreWin(userId: string, day: string) {
  const core = await all<{ habit_id: string }>(
    `SELECT habit_id FROM user_core_habits WHERE user_id = ?`,
    [userId]
  );
  const coreIds = core.map((r) => r.habit_id);
  if (coreIds.length === 0) return { configured: false, win: false };

  const checked = await all<{ habit_id: string }>(
    `SELECT habit_id FROM habit_checks WHERE user_id = ? AND day = ? AND checked = 1`,
    [userId, day]
  );
  const checkedSet = new Set(checked.map((r) => r.habit_id));
  return { configured: true, win: coreIds.every((id) => checkedSet.has(id)) };
}

async function isDailyWin(userId: string, day: string) {
  await ensureSettings(userId);

  const s = await first<{ win_mode: string | null; win_threshold_percent: number | null }>(
    `SELECT win_mode, win_threshold_percent
     FROM user_settings
     WHERE user_id = ?`,
    [userId]
  );

  const mode = ((s?.win_mode || "points") as "points" | "core");
  const threshold = Number(s?.win_threshold_percent || 70);

  if (mode === "core") {
    const core = await isCoreWin(userId, day);
    if (core.configured) return { isWin: core.win, modeUsed: "core" as const, usedFallback: false };
    const pts = await pointsForDay(userId, day);
    const win = pts.totalPoints > 0 && pts.donePoints / pts.totalPoints >= threshold / 100;
    return { isWin: win, modeUsed: "points" as const, usedFallback: true };
  }

  const pts = await pointsForDay(userId, day);
  const win = pts.totalPoints > 0 && pts.donePoints / pts.totalPoints >= threshold / 100;
  return { isWin: win, modeUsed: "points" as const, usedFallback: false };
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const ym = url.searchParams.get("ym");
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return j({ error: "Missing/invalid ym (YYYY-MM)" }, 400);

  const { firstD, lastD, start, end } = monthStartEnd(ym);

  const days: string[] = [];
  {
    const d = new Date(firstD);
    while (d <= lastD) {
      days.push(ymd(d));
      d.setDate(d.getDate() + 1);
    }
  }

  const out: DaySummary[] = [];
  for (const day of days) {
    const pts = await pointsForDay(auth.userId, day);
    const win = await isDailyWin(auth.userId, day);
    out.push({
      day,
      totalPoints: pts.totalPoints,
      donePoints: pts.donePoints,
      isWin: win.isWin,
      templateId: pts.templateId,
    });
  }

  return j({ ym, start, end, days: out });
}
