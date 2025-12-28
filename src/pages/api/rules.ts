import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/server/env";
import { requireUser } from "@/lib/server/auth";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureRules(DB: D1Database, userId: string) {
  await DB.prepare(
    `INSERT INTO user_rules (user_id) VALUES (?)
     ON CONFLICT(user_id) DO NOTHING`
  )
    .bind(userId)
    .run();
}

async function ensureOwnedActive(DB: D1Database, userId: string, habitId: string) {
  const row = await DB.prepare(
    `SELECT id FROM habits WHERE user_id = ? AND active = 1 AND id = ?`
  )
    .bind(userId, habitId)
    .first();
  return !!row;
}

export default async function handler(req: NextRequest): Promise<Response> {
  const env = getEnv();
  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const DB = env.DB;
  await ensureRules(DB, auth.userId);

  if (req.method === "GET") {
    const rules = await DB.prepare(
      `SELECT earn_ig_habit_id, steps_habit_id, study_habit_id
       FROM user_rules WHERE user_id = ?`
    )
      .bind(auth.userId)
      .first();

    return j({ rules });
  }

  if (req.method === "POST") {
    const body = (await req.json().catch(() => null)) as
      | { earn_ig_habit_id?: string | null; steps_habit_id?: string | null; study_habit_id?: string | null }
      | null;

    if (!body) return j({ error: "Bad request" }, 400);

    for (const key of ["earn_ig_habit_id", "steps_habit_id", "study_habit_id"] as const) {
      const id = body[key];
      if (id) {
        const ok = await ensureOwnedActive(DB, auth.userId, id);
        if (!ok) return j({ error: `Habit for ${key} not found/owned/active` }, 400);
      }
    }

    const chosen = [body.earn_ig_habit_id, body.steps_habit_id, body.study_habit_id].filter(Boolean);
    if (new Set(chosen).size !== chosen.length) {
      return j({ error: "Earn IG / Steps / Study must be different habits" }, 400);
    }

    await DB.prepare(
      `UPDATE user_rules
       SET earn_ig_habit_id = ?,
           steps_habit_id = ?,
           study_habit_id = ?
       WHERE user_id = ?`
    )
      .bind(
        body.earn_ig_habit_id ?? null,
        body.steps_habit_id ?? null,
        body.study_habit_id ?? null,
        auth.userId
      )
      .run();

    return j({ ok: true });
  }

  return j({ error: "Method not allowed" }, 405);
}
