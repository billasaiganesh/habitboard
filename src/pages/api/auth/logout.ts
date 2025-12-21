import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { run } from "@/lib/server/db";
import { deleteCookie } from "@/lib/server/cookies";

export const config = { runtime: "edge" };

function j(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
  });
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  // Even if not logged in, return ok and clear cookie
  if (auth?.token) {
    await run(`DELETE FROM sessions WHERE token = ?`, [auth.token]);
  }

  return j({ ok: true }, 200, { "Set-Cookie": deleteCookie("hb_session") });
}
