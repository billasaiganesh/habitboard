import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { all, first, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body =
    (await req.json().catch(() => null)) as
      | { templateId?: string; habitIds?: string[] }
      | null;

  const templateId = body?.templateId;
  const habitIds = body?.habitIds;

  if (!templateId || !Array.isArray(habitIds)) return j({ error: "Bad request" }, 400);
  if (habitIds.length > 200) return j({ error: "Too many habits" }, 400);

  const tpl = await first<{ id: string }>(
    `SELECT id FROM templates WHERE id = ? AND user_id = ?`,
    [templateId, auth.userId]
  );
  if (!tpl) return j({ error: "Template not found" }, 404);

  // validate habits are owned + active
  if (habitIds.length > 0) {
    const q = habitIds.map(() => "?").join(",");
    const owned = await all<{ id: string }>(
      `SELECT id FROM habits
       WHERE user_id = ? AND active = 1 AND id IN (${q})`,
      [auth.userId, ...habitIds]
    );
    if (owned.length !== habitIds.length) {
      return j({ error: "One or more habits not found/owned/active" }, 400);
    }
  }

  await run(`DELETE FROM template_habits WHERE template_id = ?`, [templateId]);

  for (const hid of habitIds) {
    await run(
      `INSERT INTO template_habits (template_id, habit_id)
       VALUES (?, ?)`,
      [templateId, hid]
    );
  }

  return j({ ok: true });
}
