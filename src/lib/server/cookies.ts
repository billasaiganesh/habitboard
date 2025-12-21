export function getCookie(req: Request, name: string) {
    const raw = req.headers.get("cookie") || "";
    const parts = raw.split(";").map((p) => p.trim());
    for (const p of parts) {
      if (!p) continue;
      const idx = p.indexOf("=");
      if (idx === -1) continue;
      const k = p.slice(0, idx);
      const v = p.slice(idx + 1);
      if (k === name) return decodeURIComponent(v);
    }
    return null;
  }
  
  export function setCookie(name: string, value: string, opts?: { maxAgeSec?: number }) {
    const maxAge = opts?.maxAgeSec ?? 60 * 60 * 24 * 30; // 30d
    const cookie =
      `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
    return cookie;
  }
  
  export function clearCookie(name: string) {
    return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
  }
  