import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { first, run } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function normSection(s: string): "Morning" | "Work" | "Evening" | null {
  if (s === "Morning" || s === "Work" || s === "Evening") return s;
  return null;
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const body =
    (await req.json().catch(() => null)) as
      | { name?: string; points?: number; section?: string; sort_order?: number }
      | null;

  const name = (body?.name || "").trim();
  const points = Number(body?.points ?? 1);
  const section = normSection(String(body?.section || ""));
  const sort_order = Number(body?.sort_order ?? 100);

  if (!name) return j({ error: "Name required" }, 400);
  if (!section) return j({ error: "Invalid section" }, 400);
  if (!Number.isFinite(points) || points < 0 || points > 50) return j({ error: "points must be 0..50" }, 400);
  if (!Number.isFinite(sort_order) || sort_order < 0 || sort_order > 10000) return j({ error: "sort_order invalid" }, 400);

  // prevent duplicates (same name, same user)
  const exists = await first<{ id: string }>(
    `SELECT id FROM habits WHERE user_id = ? AND lower(name) = lower(?)`,
    [auth.userId, name]
  );
  if (exists) return j({ error: "Habit already exists" }, 409);

  const id = crypto.randomUUID();
  await run(
    `INSERT INTO habits (id, user_id, name, points, section, sort_order, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
    [id, auth.userId, name, points, section, sort_order]
  );

  return j({ ok: true, id });
}
