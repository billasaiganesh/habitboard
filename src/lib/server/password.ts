function b64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }
  
  function fromB64(s: string) {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  
  function randBytes(n: number) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }
  
  async function pbkdf2(password: string, salt: ArrayBuffer, iterations = 120_000) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      256
    );
    return bits; // ArrayBuffer(32 bytes)
  }
  
  export async function hashPassword(password: string) {
    const saltBytes = randBytes(16);
    const hashBuf = await pbkdf2(password, saltBytes.buffer);
    return {
      saltB64: b64(saltBytes.buffer),
      hashB64: b64(hashBuf),
    };
  }
  
  export async function verifyPassword(password: string, saltB64: string, hashB64: string) {
    const saltBuf = fromB64(saltB64);
    const hashBuf = await pbkdf2(password, saltBuf);
    return b64(hashBuf) === hashB64;
  }
  