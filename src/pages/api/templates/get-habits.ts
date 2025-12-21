import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { all, first } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId");
  if (!templateId) return j({ error: "Missing templateId" }, 400);

  const owned = await first<{ id: string }>(
    `SELECT id FROM templates WHERE id = ? AND user_id = ?`,
    [templateId, auth.userId]
  );
  if (!owned) return j({ error: "Not found" }, 404);

  const rows = await all<{ habit_id: string }>(
    `SELECT habit_id FROM template_habits WHERE template_id = ?`,
    [templateId]
  );

  return j({ habitIds: rows.map((r) => r.habit_id) });
}
