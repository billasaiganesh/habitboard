export type DayPlanResponse = {
  day: string;
  templateId: string | null;
};

export type Template = { id: string; name: string };

export type TemplateListResponse = {
  templates: Template[];
};

export type ErrorResponse = { error?: string };

export type Habit = {
  id: string;
  name: string;
  points: number;
  section: "Morning" | "Work" | "Evening";
  sort_order: number;
};

export type TodayResponse = {
  habits: Habit[];
  checks: Array<{ habit_id: string; checked: number }>;
};

export type Rules = {
  earn_ig_habit_id: string | null;
  steps_habit_id: string | null;
  study_habit_id: string | null;

  daily_win_mode: "points" | "core";
  daily_win_threshold: number;

  weekly_target: number;
  monthly_target: number;

  week_starts_on: "monday" | "sunday";
};

export type RulesResponse = { rules: Rules };

export type StatsResponse = {
  daily: { isWin: boolean };
  week: { winsThisWeek: number; weeklyTarget: number };
  month: { winsThisMonth: number; monthlyTarget: number };
  streaks: { dailyStreak: number; weeklyStreak: number; monthlyStreak: number };
};

export type WeekResponse<T> = { days: T[] };
export type MonthResponse<T> = { days: T[] };

export type TemplateGetResponse = { habitIds: string[] };
