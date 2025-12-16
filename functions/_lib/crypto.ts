function b64(bytes: ArrayBuffer) {
    const u8 = new Uint8Array(bytes);
    let s = "";
    for (const b of u8) s += String.fromCharCode(b);
    return btoa(s);
  }
  
  function u8FromB64(s: string) {
    const bin = atob(s);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  
  export async function hashPasscode(passcode: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const enc = new TextEncoder();
  
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(passcode),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
  
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
      key,
      256
    );
  
    return { saltB64: b64(salt.buffer), hashB64: b64(bits) };
  }
  
  export async function verifyPasscode(passcode: string, saltB64: string, hashB64: string) {
    const salt = u8FromB64(saltB64);
    const enc = new TextEncoder();
  
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(passcode),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
  
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
      key,
      256
    );
  
    return b64(bits) === hashB64;
  }
  