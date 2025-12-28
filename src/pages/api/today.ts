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
  const day = url.searchParams.get("day");
  if (!day) return j({ error: "Missing day" }, 400);

  // Read day plan template (if any)
  const plan = await first<{ template_id: string | null }>(
    `SELECT template_id FROM day_plan WHERE user_id = ? AND day = ?`,
    [auth.userId, day]
  );

  const templateId = plan?.template_id ?? null;

  // Choose habits:
  // - if templateId set => habits assigned to template
  // - else => all active habits
  const habits =
    templateId
      ? await all<{
          id: string;
          name: string;
          points: number;
          section: "Morning" | "Work" | "Evening";
          sort_order: number;
        }>(
          `SELECT h.id, h.name, h.points, h.section, h.sort_order
           FROM habits h
           JOIN template_habits th ON th.habit_id = h.id
           WHERE h.user_id = ? AND h.active = 1 AND th.template_id = ?
           ORDER BY h.section, h.sort_order, h.name`,
          [auth.userId, templateId]
        )
      : await all<{
          id: string;
          name: string;
          points: number;
          section: "Morning" | "Work" | "Evening";
          sort_order: number;
        }>(
          `SELECT id, name, points, section, sort_order
           FROM habits
           WHERE user_id = ? AND active = 1
           ORDER BY section, sort_order, name`,
          [auth.userId]
        );

  const checks = await all<{ habit_id: string; checked: number }>(
    `SELECT habit_id, checked
     FROM habit_checks
     WHERE user_id = ? AND day = ?`,
    [auth.userId, day]
  );

  return j({ habits, checks });
}
