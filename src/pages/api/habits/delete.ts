import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { first, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return j({ error: "Missing id" }, 400);

  const owned = await first<{ id: string }>(
    `SELECT id FROM habits WHERE id = ? AND user_id = ?`,
    [id, auth.userId]
  );
  if (!owned) return j({ error: "Not found" }, 404);

  // Hard delete. (Alternatively you could soft-delete by active=0)
  await run(`DELETE FROM habits WHERE id = ? AND user_id = ?`, [id, auth.userId]);

  // Clean-up references (optional but good)
  await run(`DELETE FROM template_habits WHERE habit_id = ?`, [id]);
  await run(`DELETE FROM habit_checks WHERE habit_id = ? AND user_id = ?`, [id, auth.userId]);
  await run(`DELETE FROM user_core_habits WHERE habit_id = ? AND user_id = ?`, [id, auth.userId]);

  return j({ ok: true });
}
