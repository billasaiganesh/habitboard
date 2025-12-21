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

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = (body?.name || "").trim();
  if (!name) return j({ error: "Name required" }, 400);

  const exists = await first<{ id: string }>(
    `SELECT id FROM templates WHERE user_id = ? AND lower(name) = lower(?)`,
    [auth.userId, name]
  );
  if (exists) return j({ error: "Template already exists" }, 409);

  const id = crypto.randomUUID();
  await run(
    `INSERT INTO templates (id, user_id, name, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [id, auth.userId, name]
  );

  return j({ ok: true, id });
}
