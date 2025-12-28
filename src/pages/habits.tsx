import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Habit = {
  id: string;
  name: string;
  points: number;
  section: "Morning" | "Work" | "Evening";
  sort_order: number;
  active: number; // 1/0
};

type ErrorResponse = { error?: string };

export default function HabitsPage() {
  const [guest, setGuest] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [habits, setHabits] = useState<Habit[]>([]);

  // create form
  const [name, setName] = useState("");
  const [points, setPoints] = useState<number>(1);
  const [section, setSection] = useState<"Morning" | "Work" | "Evening">("Morning");

  const grouped = useMemo(() => {
    const m = new Map<"Morning" | "Work" | "Evening", Habit[]>();
    m.set("Morning", []);
    m.set("Work", []);
    m.set("Evening", []);
    for (const h of habits) m.get(h.section)?.push(h);
    for (const k of m.keys()) m.get(k)!.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return m;
  }, [habits]);

  async function load() {
    setMsg("");
    const res = await fetch("/api/habits/list");
    if (res.status === 401) {
      setGuest(true);
      return;
    }
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to load habits");
      return;
    }
    const data = (await res.json()) as { habits: Habit[] };
    setHabits(data.habits || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createHabit() {
    setMsg("");
    const res = await fetch("/api/habits/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, points, section }),
    });

    if (res.status === 401) {
      setGuest(true);
      return;
    }
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to create habit");
      return;
    }

    setName("");
    setPoints(1);
    setSection("Morning");
    await load();
  }

  async function toggleActive(id: string, nextActive: boolean) {
    setMsg("");
    const res = await fetch("/api/habits/toogle-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: nextActive ? 1 : 0 }),
    });

    if (res.status === 401) {
      setGuest(true);
      return;
    }
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to update habit");
      return;
    }
    await load();
  }

  async function renameHabit(id: string, nextName: string) {
    setMsg("");
    const res = await fetch("/api/habits/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: nextName }),
    });

    if (res.status === 401) {
      setGuest(true);
      return;
    }
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to update habit");
      return;
    }
    await load();
  }

  async function deleteHabit(id: string) {
    setMsg("");
    const res = await fetch("/api/habits/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.status === 401) {
      setGuest(true);
      return;
    }
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to delete habit");
      return;
    }
    await load();
  }

  if (guest) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Habits</h1>
        <p>You’re not logged in.</p>
        <Link href="/login">Login →</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Habits</h1>
          <div style={{ opacity: 0.75 }}>Create and manage your habits</div>
        </div>

        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/">Today</Link>
          <Link href="/week">Week</Link>
          <Link href="/month">Month</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>

      <div style={{ height: 14 }} />

      {msg ? (
        <div style={{ padding: 12, border: "1px solid #333", borderRadius: 10, marginBottom: 12 }}>
          {msg}
        </div>
      ) : null}

      <section style={{ padding: 16, border: "1px solid #333", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Add a habit</h2>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 140px 160px 140px" }}>
          <input placeholder="Habit name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            title="Points"
          />
          <select value={section} onChange={(e) => setSection(e.target.value as any)} title="Section">
            <option value="Morning">Morning</option>
            <option value="Work">Work</option>
            <option value="Evening">Evening</option>
          </select>
          <button onClick={createHabit} disabled={!name.trim()}>
            Add
          </button>
        </div>
      </section>

      <div style={{ height: 14 }} />

      {(["Morning", "Work", "Evening"] as const).map((sec) => {
        const list = grouped.get(sec) || [];
        return (
          <section key={sec} style={{ marginTop: 14, padding: 16, border: "1px solid #333", borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>{sec}</h2>

            {list.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No habits yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {list.map((h) => (
                  <div key={h.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={h.active === 1}
                      onChange={(e) => toggleActive(h.id, e.target.checked)}
                      title="Active"
                    />
                    <input
                      style={{ minWidth: 260 }}
                      value={h.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, name: v } : x)));
                      }}
                      onBlur={(e) => renameHabit(h.id, e.target.value)}
                    />
                    <span style={{ opacity: 0.8 }}>{h.points} pts</span>
                    <button onClick={() => deleteHabit(h.id)} style={{ marginLeft: "auto" }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
