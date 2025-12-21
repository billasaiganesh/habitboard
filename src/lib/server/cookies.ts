export function getCookie(req: Request, name: string) {
  const h = req.headers.get("cookie") || "";
  const parts = h.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

export function setCookie(name: string, value: string, opts: {
  maxAgeSeconds?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
} = {}) {
  const {
    maxAgeSeconds,
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    path = "/",
  } = opts;

  let out = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (typeof maxAgeSeconds === "number") out += `; Max-Age=${maxAgeSeconds}`;
  if (httpOnly) out += `; HttpOnly`;
  if (secure) out += `; Secure`;
  return out;
}

export function deleteCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}
