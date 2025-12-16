import { useState } from "react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, passcode }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }    
    window.location.href = "/";
  }

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h1>Habitboard</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode("login")} disabled={mode === "login"}>Login</button>
        <button onClick={() => setMode("register")} disabled={mode === "register"}>Register</button>
      </div>

      {msg && <p>{msg}</p>}

      <label style={{ display: "block", marginBottom: 8 }}>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%" }} />
      </label>

      <label style={{ display: "block", marginBottom: 12 }}>
        Passcode
        <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} style={{ width: "100%" }} />
      </label>

      <button onClick={submit} style={{ width: "100%" }}>
        {mode === "login" ? "Login" : "Create account"}
      </button>

      <p style={{ marginTop: 12, opacity: 0.75 }}>
        Multi-user. Your data is private per username.
      </p>
    </div>
  );
}
