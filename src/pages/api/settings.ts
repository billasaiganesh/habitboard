import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { DB, first, all, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

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

type SettingsRow = {
  win_mode: "points" | "core" | null;
  win_threshold_percent: number | null;
  weekly_win_target: number | null;
  monthly_win_target: number | null;
};

export default async function handler(req: NextRequest): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const userId = auth.userId;

  if (req.method === "GET") {
    await ensureSettings(userId);

    const settings = await first<SettingsRow>(
      `SELECT win_mode, win_threshold_percent, weekly_win_target, monthly_win_target
       FROM user_settings
       WHERE user_id = ?`,
      [userId]
    );

    const core = await all<{ habit_id: string }>(
      `SELECT habit_id FROM user_core_habits WHERE user_id = ?`,
      [userId]
    );

    return j({
      settings,
      coreHabitIds: core.map((r) => r.habit_id),
    });
  }

  if (req.method === "POST") {
    const body =
      (await req.json().catch(() => null)) as
        | {
            win_mode?: "points" | "core";
            win_threshold_percent?: number;
            weekly_win_target?: number;
            monthly_win_target?: number;
          }
        | null;

    if (!body) return j({ error: "Bad request" }, 400);

    const { win_mode, win_threshold_percent, weekly_win_target, monthly_win_target } = body;

    if (win_mode && !["points", "core"].includes(win_mode)) {
      return j({ error: "Invalid win_mode" }, 400);
    }
    if (win_threshold_percent !== undefined && (win_threshold_percent < 50 || win_threshold_percent > 100)) {
      return j({ error: "win_threshold_percent must be 50..100" }, 400);
    }
    if (weekly_win_target !== undefined && (weekly_win_target < 1 || weekly_win_target > 7)) {
      return j({ error: "weekly_win_target must be 1..7" }, 400);
    }
    if (monthly_win_target !== undefined && (monthly_win_target < 1 || monthly_win_target > 31)) {
      return j({ error: "monthly_win_target must be 1..31" }, 400);
    }

    await ensureSettings(userId);

    // Use COALESCE update like you had
    await run(
      `UPDATE user_settings
       SET win_mode = COALESCE(?, win_mode),
           win_threshold_percent = COALESCE(?, win_threshold_percent),
           weekly_win_target = COALESCE(?, weekly_win_target),
           monthly_win_target = COALESCE(?, monthly_win_target)
       WHERE user_id = ?`,
      [
        win_mode ?? null,
        win_threshold_percent ?? null,
        weekly_win_target ?? null,
        monthly_win_target ?? null,
        userId,
      ]
    );

    return j({ ok: true });
  }

  return j({ error: "Method not allowed" }, 405);
}
