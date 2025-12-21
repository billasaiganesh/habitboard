import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { all } from "@/lib/server/db";

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

  const habits = await all<{
    id: string;
    name: string;
    points: number;
    section: "Morning" | "Work" | "Evening";
    sort_order: number;
    active: number;
    created_at: string;
  }>(
    `SELECT id, name, points, section, sort_order, active, created_at
     FROM habits
     WHERE user_id = ?
     ORDER BY active DESC, section, sort_order, name`,
    [auth.userId]
  );

  return j({ habits });
}
