import { getEnv } from "./env";

export function DB(): D1Database {
  return getEnv().DB;
}

export async function first<T extends Record<string, unknown>>(
  sql: string,
  bindings: unknown[] = []
): Promise<T | null> {
  const row = await DB().prepare(sql).bind(...bindings).first<T>();
  return row ?? null;
}

export async function all<T extends Record<string, unknown>>(
  sql: string,
  bindings: unknown[] = []
): Promise<T[]> {
  const res = await DB().prepare(sql).bind(...bindings).all<T>();
  return (res.results ?? []) as T[];
}

export async function run(sql: string, bindings: unknown[] = []) {
  return DB().prepare(sql).bind(...bindings).run();
}
