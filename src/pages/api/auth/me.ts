import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";

export const config = { runtime: "edge" };

export default async function handler(req: NextRequest): Promise<Response> {
  const user = await requireUser(req);

  if (!user) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      user: {
        username: user.username,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
