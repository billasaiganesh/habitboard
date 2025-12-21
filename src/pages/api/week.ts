import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { first, all, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

type WeekDaySummary = {
  day: string;
  templateId: string | null;
  totalPoints: number;
  donePoints: number;
  isWin: boolean;
  modeUsed: "points" | "core";
  usedFallback: boolean;
};

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureSettings(userId: string) {
  await run(
    `INSERT INTO user_settings (user_id)
     VALUES (?)
     ON CONFLICT(user_id) DO NOTHING`,
    [userId]
  );
}

async function pointsForDay(userId: string, day: string) {
  const plan = await first<{ template_id: string | null }>(
    `SELECT template_id FROM day_plans WHERE user_id = ? AND day = ?`,
    [userId, day]
  );
  const templateId = plan?.template_id ?? null;

  if (!templateId) {
    const totalRow = await first<{ totalPoints: number }>(
      `SELECT COALESCE(SUM(points), 0) AS totalPoints
       FROM habits WHERE user_id = ? AND active = 1`,
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
    `SELECT win_mode, win_threshold_percent FROM user_settings WHERE user_id = ?`,
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
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) return j({ error: "Missing start/end" }, 400);

  const days: string[] = [];
  {
    const d = new Date(start + "T00:00:00");
    const endD = new Date(end + "T00:00:00");
    while (d <= endD) {
      days.push(new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d));
      d.setDate(d.getDate() + 1);
    }
  }

  const result: WeekDaySummary[] = [];
  for (const day of days) {
    const pts = await pointsForDay(auth.userId, day);
    const win = await isDailyWin(auth.userId, day);

    result.push({
      day,
      templateId: pts.templateId,
      totalPoints: pts.totalPoints,
      donePoints: pts.donePoints,
      isWin: win.isWin,
      modeUsed: win.modeUsed,
      usedFallback: win.usedFallback,
    });
  }

  return j({ days: result });
}
