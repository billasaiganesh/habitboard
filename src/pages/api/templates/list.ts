import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { all } from "@/lib/server/db";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (!auth) return j({ error: "Unauthorized" }, 401);

  const templates = await all<{ id: string; name: string; created_at: string }>(
    `SELECT id, name, created_at
     FROM templates
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [auth.userId]
  );

  return j({ templates });
}
