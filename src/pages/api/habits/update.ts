import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { first, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function normSection(s: string | undefined): "Morning" | "Work" | "Evening" | null {
  if (!s) return null;
  if (s === "Morning" || s === "Work" || s === "Evening") return s;
  return null;
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body =
    (await req.json().catch(() => null)) as
      | { id?: string; name?: string; points?: number; section?: string; sort_order?: number }
      | null;

  const id = body?.id;
  if (!id) return j({ error: "Missing id" }, 400);

  const owned = await first<{ id: string }>(
    `SELECT id FROM habits WHERE id = ? AND user_id = ?`,
    [id, auth.userId]
  );
  if (!owned) return j({ error: "Not found" }, 404);

  const name = body?.name !== undefined ? String(body.name).trim() : undefined;
  const points = body?.points !== undefined ? Number(body.points) : undefined;
  const section = body?.section !== undefined ? normSection(String(body.section)) : undefined;
  const sort_order = body?.sort_order !== undefined ? Number(body.sort_order) : undefined;

  if (name !== undefined && !name) return j({ error: "Name cannot be empty" }, 400);
  if (section !== undefined && !section) return j({ error: "Invalid section" }, 400);
  if (points !== undefined && (!Number.isFinite(points) || points < 0 || points > 50)) return j({ error: "points must be 0..50" }, 400);
  if (sort_order !== undefined && (!Number.isFinite(sort_order) || sort_order < 0 || sort_order > 10000)) return j({ error: "sort_order invalid" }, 400);

  await run(
    `UPDATE habits
     SET name = COALESCE(?, name),
         points = COALESCE(?, points),
         section = COALESCE(?, section),
         sort_order = COALESCE(?, sort_order)
     WHERE id = ? AND user_id = ?`,
    [name ?? null, points ?? null, section ?? null, sort_order ?? null, id, auth.userId]
  );

  return j({ ok: true });
}
