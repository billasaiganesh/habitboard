import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  Habit,
  Rules,
  RulesResponse,
  Template,
  TemplateListResponse,
  TemplateGetResponse,
  ErrorResponse,
} from "@/lib/types";

type HabitsResponse = { habits: Habit[] };

export default function Settings() {
  const [guest, setGuest] = useState(false);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  const [templateHabitIds, setTemplateHabitIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string>("");

  async function load() {
    setMsg("");

    // habits
    const resHabits = await fetch("/api/habits");
    if (resHabits.status === 401) { setGuest(true); return; }
    if (resHabits.ok) {
      const h = (await resHabits.json()) as HabitsResponse;
      setHabits(h.habits || []);
    } else {
      const e = (await resHabits.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to load habits");
      return;
    }

    // rules
    const resRules = await fetch("/api/rules");
    if (resRules.status === 401) { setGuest(true); return; }
    if (resRules.ok) {
      const r = (await resRules.json()) as RulesResponse;
      setRules(r.rules);
    } else {
      const e = (await resRules.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to load rules");
      return;
    }

    // templates
    const resTemplates = await fetch("/api/templates/list");
    if (resTemplates.status === 401) { setGuest(true); return; }
    if (resTemplates.ok) {
      const t = (await resTemplates.json()) as TemplateListResponse;
      setTemplates(t.templates || []);
    } else {
      const e = (await resTemplates.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to load templates");
      return;
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTemplateHabits(id: string) {
    setTemplateHabitIds(new Set());
    if (!id) return;

    const res = await fetch(`/api/templates/get?id=${encodeURIComponent(id)}`);
    if (res.status === 401) { setGuest(true); return; }
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as ErrorResponse;
      setMsg(e.error || "Failed to load template");
      return;
    }

    const data = (await res.json()) as TemplateGetResponse;
    setTemplateHabitIds(new Set(data.habitIds || []));
  }

  if (guest) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Settings</h1>
        <p>You’re not logged in.</p>
        <Link href="/login">Login →</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      {msg ? (
        <div style={{ padding: 12, border: "1px solid #333", borderRadius: 10, marginBottom: 12 }}>
          {msg}
        </div>
      ) : null}

      <section style={{ padding: 16, border: "1px solid #333", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Templates</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ opacity: 0.85 }}>Select template:</label>
          <select
            value={templateId}
            onChange={async (e) => {
              const id = e.target.value;
              setTemplateId(id);
              await loadTemplateHabits(id);
            }}
          >
            <option value="">Choose…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {templateId ? (
          <div style={{ marginTop: 12, opacity: 0.9 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Habits in this template:</div>
            <div style={{ display: "grid", gap: 6 }}>
              {habits.map((h) => (
                <div key={h.id} style={{ opacity: templateHabitIds.has(h.id) ? 1 : 0.35 }}>
                  {templateHabitIds.has(h.id) ? "✅ " : "⬜ "} {h.name}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div style={{ height: 14 }} />

      <section style={{ padding: 16, border: "1px solid #333", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Rules</h2>
        <div style={{ opacity: 0.85 }}>
          {rules ? (
            <>
              <div>Daily win mode: <b>{rules.daily_win_mode}</b></div>
              <div>Daily win threshold: <b>{rules.daily_win_threshold}</b></div>
              <div>Weekly target: <b>{rules.weekly_target}</b></div>
              <div>Monthly target: <b>{rules.monthly_target}</b></div>
              <div>Week starts on: <b>{rules.week_starts_on}</b></div>
            </>
          ) : (
            <div>Loading…</div>
          )}
        </div>
      </section>

      <div style={{ height: 14 }} />

      <nav style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/">Today</Link>
        <Link href="/week">Week</Link>
        <Link href="/month">Month</Link>
      </nav>
    </div>
  );
}
