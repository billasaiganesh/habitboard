const ITERATIONS = 100000; // Cloudflare/Workers limit
const HASH = "SHA-256";
const KEYLEN_BITS = 256; // 32 bytes

function b64(bytes: ArrayBuffer) {
  const u8 = new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(str: string) {
  const bin = atob(str);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

export async function hashPassword(password: string): Promise<{ saltB64: string; hashB64: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEYLEN_BITS
  );

  return { saltB64: b64(salt.buffer), hashB64: b64(bits) };
}

export async function verifyPassword(password: string, saltB64: string, hashB64: string): Promise<boolean> {
  const salt = unb64(saltB64);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEYLEN_BITS
  );

  const computed = new Uint8Array(bits);
  const expected = unb64(hashB64);

  return timingSafeEqual(computed, expected);
}
