export function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;

  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export type SameSite = "Lax" | "Strict" | "None";

export function setCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: SameSite;
    path?: string;
    maxAge?: number;
  } = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

export function deleteCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}
