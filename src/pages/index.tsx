import { useEffect, useState } from "react";
import Link from "next/link";
import { todayYMD } from "@/lib/date";
import type {
  DayPlanResponse,
  TemplateListResponse,
  TodayResponse,
  StatsResponse,
  RulesResponse,
  Rules,
  Habit,
} from "@/lib/types";

function Ring({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const deg = Math.round(pct * 360);
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: `conic-gradient(#fff ${deg}deg, #333 0deg)`,
        display: "grid",
        placeItems: "center",
        border: "1px solid #444",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#111",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {Math.round(pct * 100)}%
        </div>
      </div>
    </div>
  );
}

export default function Today() {
  const [me, setMe] = useState<"loading" | "guest" | "authed">("loading");
  const [day, setDay] = useState<string>("");

  const [habits, setHabits] = useState<Habit[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [templateId, setTemplateId] = useState<string | null>(null);

  const [rules, setRules] = useState<Rules | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("day") || todayYMD();
    setDay(d);
  }, []);

  async function load() {
    // templates
    const tRes = await fetch("/api/templates/list");
    if (tRes.ok) {
      const tData = (await tRes.json()) as TemplateListResponse;
      setTemplates(tData.templates || []);
    }

    // day plan
    const pRes = await fetch(`/api/day-plan?day=${day}`);
    if (pRes.status === 401) {
      setMe("guest");
      return;
    }
    const pData = (await pRes.json()) as DayPlanResponse;
    setTemplateId(pData.templateId ?? null);

    // today
    const res = await fetch(`/api/today?day=${day}`);
    if (res.status === 401) {
      setMe("guest");
      return;
    }
    const data = (await res.json()) as TodayResponse;
    setMe("authed");

    setHabits(data.habits || []);
    const map: Record<string, boolean> = {};
    for (const c of data.checks || []) {
      map[c.habit_id] = c.checked === 1;
    }
    setChecks(map);

    // stats
    const s = await fetch(`/api/stats?day=${day}`);
    if (s.ok) setStats((await s.json()) as StatsResponse);
  }

  useEffect(() => {
    if (day) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/rules");
      if (!r.ok) return;
      const j = (await r.json()) as RulesResponse;
      setRules(j.rules);
    })();
  }, []);

  async function toggle(habitId: string, checked: boolean) {
    setChecks((p) => ({ ...p, [habitId]: checked }));

    await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, habitId, checked }),
    });

    const s = await fetch(`/api/stats?day=${day}`);
    if (s.ok) setStats((await s.json()) as StatsResponse);
  }

  // Earn IG locking
  const earnId = rules?.earn_ig_habit_id ?? null;
  const stepsId = rules?.steps_habit_id ?? null;
  const studyId = rules?.study_habit_id ?? null;
  const depsMet =
    !!stepsId && !!studyId && !!checks[stepsId] && !!checks[studyId];

  useEffect(() => {
    if (!rules) return;
    if (!earnId || !stepsId || !studyId) return;
    if (checks[earnId] && !depsMet) toggle(earnId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, depsMet, earnId, stepsId, studyId]);

  if (me === "guest") {
    return (
      <div style={{ padding: 24 }}>
        <h1>Today</h1>
        <p>You’re not logged in.</p>
        <Link href="/login">Login →</Link>
      </div>
    );
  }

  if (me === "loading" || !day)
    return <div style={{ padding: 24 }}>Loading…</div>;

  const totalPoints = habits.reduce((s, h) => s + (h.points || 0), 0);
  const donePoints = habits.reduce(
    (s, h) => s + (checks[h.id] ? h.points || 0 : 0),
    0
  );

  const sections: Array<["Morning" | "Work" | "Evening", string]> = [
    ["Morning", "Morning"],
    ["Work", "Work"],
    ["Evening", "Evening"],
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Today</h1>
          <div style={{ opacity: 0.75 }}>{day}</div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <Ring value={totalPoints ? donePoints / totalPoints : 0} />
            <div style={{ opacity: 0.9 }}>
              <div>
                Points: <b>{donePoints}</b> / <b>{totalPoints}</b>
              </div>

              {stats && (
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  <div>
                    {stats.daily.isWin ? "✅ Day Win" : "⏳ Not yet"} • 🔥{" "}
                    {stats.streaks.dailyStreak} day streak
                  </div>
                  <div>
                    📅 Week: {stats.week.winsThisWeek}/{stats.week.weeklyTarget}{" "}
                    wins • 🏆 {stats.streaks.weeklyStreak} week streak
                  </div>
                  <div>
                    🗓️ Month: {stats.month.winsThisMonth}/{stats.month.monthlyTarget}{" "}
                    wins • 🏅 {stats.streaks.monthlyStreak} month streak
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ opacity: 0.85 }}>Plan:</label>
            <select
              value={templateId ?? ""}
              onChange={async (e) => {
                const next = e.target.value || null;
                setTemplateId(next);
                await fetch("/api/day-plan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ day, templateId: next }),
                });
                await load();
              }}
            >
              <option value="">All habits</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/week">Week</Link>
          <Link href="/month">Month</Link>
          <Link href="/settings">Settings</Link>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </nav>
      </header>

      <div style={{ height: 16 }} />

      {sections.map(([key, label]) => {
        const list = habits.filter((h) => h.section === key);
        if (list.length === 0) return null;

        return (
          <section
            key={key}
            style={{
              marginTop: 14,
              padding: 16,
              border: "1px solid #333",
              borderRadius: 12,
            }}
          >
            <h2 style={{ marginTop: 0 }}>{label}</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {list.map((h) => {
                const isEarnIG = !!earnId && h.id === earnId;
                const disabled = isEarnIG && !depsMet;
                return (
                  <label
                    key={h.id}
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={!!checks[h.id]}
                      disabled={disabled}
                      onChange={(e) => toggle(h.id, e.target.checked)}
                    />
                    <span style={{ fontWeight: 700 }}>{h.name}</span>
                    <span style={{ opacity: 0.7 }}>({h.points} pts)</span>
                    {isEarnIG && !depsMet && (
                      <span style={{ opacity: 0.7, fontSize: 12 }}>
                        Locked until Steps + Study
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
