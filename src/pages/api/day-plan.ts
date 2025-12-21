import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { first, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureDayPlan(userId: string, day: string) {
  await run(
    `INSERT INTO day_plan (user_id, day)
     VALUES (?, ?)
     ON CONFLICT(user_id, day) DO NOTHING`,
    [userId, day]
  );
}

export default async function handler(req: NextRequest): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);

  if (req.method === "GET") {
    const day = url.searchParams.get("day");
    if (!day) return j({ error: "Missing day" }, 400);

    await ensureDayPlan(auth.userId, day);

    const row = await first<{ template_id: string | null }>(
      `SELECT template_id FROM day_plan WHERE user_id = ? AND day = ?`,
      [auth.userId, day]
    );

    return j({ templateId: row?.template_id ?? null });
  }

  if (req.method === "POST") {
    const body = (await req.json().catch(() => null)) as { day?: string; templateId?: string | null } | null;
    const day = body?.day;
    const templateId = body?.templateId ?? null;

    if (!day) return j({ error: "Bad request" }, 400);

    await ensureDayPlan(auth.userId, day);

    // Validate template belongs to user if provided
    if (templateId) {
      const t = await first<{ id: string }>(
        `SELECT id FROM habit_templates WHERE id = ? AND user_id = ?`,
        [templateId, auth.userId]
      );
      if (!t) return j({ error: "Template not found" }, 404);
    }

    await run(
      `UPDATE day_plan SET template_id = ? WHERE user_id = ? AND day = ?`,
      [templateId, auth.userId, day]
    );

    return j({ ok: true });
  }

  return j({ error: "Method not allowed" }, 405);
}
