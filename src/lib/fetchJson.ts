export async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
    const res = await fetch(input, init);
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }
  