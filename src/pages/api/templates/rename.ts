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

  const body = (await req.json().catch(() => null)) as { id?: string; name?: string } | null;
  const id = body?.id;
  const name = (body?.name || "").trim();

  if (!id || !name) return j({ error: "Bad request" }, 400);

  const owned = await first<{ id: string }>(
    `SELECT id FROM habit_templates WHERE id = ? AND user_id = ?`,
    [id, auth.userId]
  );
  if (!owned) return j({ error: "Not found" }, 404);

  await run(
    `UPDATE habit_templates SET name = ? WHERE id = ? AND user_id = ?`,
    [name, id, auth.userId]
  );

  return j({ ok: true });
}
