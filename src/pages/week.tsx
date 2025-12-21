import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { todayYMD } from "@/lib/date";
import type { WeekResponse, StatsResponse } from "@/lib/types";


type ApiWeekDay = {
  day: string;
  templateId: string | null;
  totalPoints: number;
  donePoints: number;
  isWin: boolean;
  modeUsed: "points" | "core";
  usedFallback: boolean;
};

type DayTile = ApiWeekDay & { pct: number };

function mondayOf(day: string) {
  const d = new Date(day + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // monday=0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export default function Week() {
  const today = todayYMD();

  const [guest, setGuest] = useState(false);
  const [start, setStart] = useState(mondayOf(today));
  const [tiles, setTiles] = useState<DayTile[]>([]);
  const [summary, setSummary] = useState<StatsResponse | null>(null);

  const end = useMemo(() => {
    const d = new Date(start + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [start]);

  const title = useMemo(() => `${start} → ${end}`, [start, end]);

  useEffect(() => {
    let cancelled = false;
  
    (async () => {
      const res = await fetch(`/api/week?start=${start}&end=${end}`);
      if (res.status === 401) {
        if (!cancelled) setGuest(true);
        return;
      }
  
      const data = (await res.json()) as WeekResponse;
  
      const nextTiles: DayTile[] = (data.days || []).map((d) => ({
        ...d,
        pct: d.totalPoints ? d.donePoints / d.totalPoints : 0,
      }));
  
      if (!cancelled) setTiles(nextTiles);
  
      const sRes = await fetch(`/api/stats?day=${today}`);
      if (sRes.ok && !cancelled) setSummary((await sRes.json()) as StatsResponse);
    })();
  
    return () => {
      cancelled = true;
    };
  }, [start, end, today]);
  

  if (guest) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Week</h1>
        <p>You’re not logged in.</p>
        <Link href="/login">Login →</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Week</h1>
          <div style={{ opacity: 0.75 }}>{title}</div>

          <div style={{ marginTop: 10 }}>
            <label style={{ opacity: 0.85 }}>Week starts (Monday): </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>

          {summary && (
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              📅 Wins this week: <b>{summary.week.winsThisWeek}</b> /{" "}
              <b>{summary.week.weeklyTarget}</b> • 🏆 streak:{" "}
              <b>{summary.streaks.weeklyStreak}</b>
            </div>
          )}
        </div>

        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/">Today</Link>
          <Link href="/month">Month</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>

      <div style={{ height: 16 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {tiles.map((t) => (
          <div key={t.day} style={{ padding: 14, border: "1px solid #333", borderRadius: 12 }}>
            <div style={{ fontWeight: 700 }}>{t.day}</div>
            <div style={{ marginTop: 6 }}>{t.isWin ? "✅ Win" : "⏳ Not yet"}</div>
            <div style={{ opacity: 0.8, marginTop: 6 }}>{Math.round(t.pct * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
