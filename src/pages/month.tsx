import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { todayYMD } from "@/lib/date";
import type { MonthResponse, StatsResponse } from "@/lib/types";

type DayRow = {
  day: string; // YYYY-MM-DD
  isWin: boolean;
  pct: number; // 0..1
};

export default function Month() {
  const today = todayYMD();
  const [guest, setGuest] = useState(false);
  const [ym, setYm] = useState(today.slice(0, 7)); // YYYY-MM
  const [rows, setRows] = useState<DayRow[]>([]);
  const [summary, setSummary] = useState<StatsResponse | null>(null);

  const label = useMemo(() => ym, [ym]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/month?ym=${ym}`);
      if (res.status === 401) {
        setGuest(true);
        return;
      }
      const data = (await res.json()) as MonthResponse<DayRow>;
      setRows(data.days || []);

      const sRes = await fetch(`/api/stats?day=${today}`);
      if (sRes.ok) setSummary((await sRes.json()) as StatsResponse);
    })();
  }, [ym, today]);

  if (guest) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Month</h1>
        <p>You’re not logged in.</p>
        <Link href="/login">Login →</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Month</h1>
          <div style={{ opacity: 0.75 }}>{label}</div>

          <div style={{ marginTop: 10 }}>
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
            />
          </div>

          {summary && (
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              🗓️ Wins this month: <b>{summary.month.winsThisMonth}</b> /{" "}
              <b>{summary.month.monthlyTarget}</b> • 🏅 streak:{" "}
              <b>{summary.streaks.monthlyStreak}</b>
            </div>
          )}
        </div>

        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/">Today</Link>
          <Link href="/week">Week</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>

      <div style={{ height: 16 }} />

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.day}
            style={{
              padding: 12,
              border: "1px solid #333",
              borderRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div>
              <b>{r.day}</b> {r.isWin ? "✅" : "⏳"}
            </div>
            <div style={{ opacity: 0.8 }}>{Math.round(r.pct * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
