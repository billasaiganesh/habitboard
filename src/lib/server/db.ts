import { getEnv } from "./env";

export async function first<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const { DB } = getEnv();
  const row = await DB.prepare(sql).bind(...params).first<T>();
  return row ?? null;
}

export async function all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { DB } = getEnv();
  const res = await DB.prepare(sql).bind(...params).all<T>();
  return (res.results ?? []) as T[];
}

export async function run(sql: string, params: unknown[] = []): Promise<void> {
  const { DB } = getEnv();
  await DB.prepare(sql).bind(...params).run();
}
