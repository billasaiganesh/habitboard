// ---------- shared ----------
export type ErrorResponse = { error?: string };

// ---------- templates ----------
export type Template = {
  id: string;
  name: string;
  created_at?: string; // API returns this from templates table (safe optional)
};

export type TemplateListResponse = {
  templates: Template[];
};

export type TemplateGetHabitsResponse = {
  habitIds: string[];
};

// ---------- day plan ----------
export type DayPlanResponse = {
  day: string;
  templateId: string | null;
};

// ---------- habits ----------
export type HabitSection = "Morning" | "Work" | "Evening";

export type Habit = {
  id: string;
  name: string;
  points: number;
  section: HabitSection;
  sort_order: number;
  active?: number;      // list endpoint may include this
  created_at?: string;  // list endpoint may include this
};

// ---------- today ----------
export type TodayResponse = {
  habits: Habit[];
  checks: Array<{ habit_id: string; checked: number }>;
};

// ---------- rules (user_rules table) ----------
export type Rules = {
  earn_ig_habit_id: string | null;
  steps_habit_id: string | null;
  study_habit_id: string | null;
};

export type RulesResponse = {
  rules: Rules;
};

// ---------- settings (user_settings + user_core_habits) ----------
export type UserSettings = {
  win_mode: "points" | "core" | null;
  win_threshold_percent: number | null;
  weekly_win_target: number | null;
  monthly_win_target: number | null;
};

export type SettingsResponse = {
  settings: UserSettings | null;
  coreHabitIds: string[];
};

// ---------- stats (computed) ----------
export type StatsResponse = {
  day: string;

  // points for the chosen day plan
  points: { totalPoints: number; donePoints: number };

  daily: {
    isWin: boolean;
    modeUsed: "points" | "core";
    threshold: number;
    usedFallback: boolean;
  };

  streaks: {
    dailyStreak: number;
    weeklyStreak: number;
    monthlyStreak: number;
  };

  week: {
    start: string;
    end: string;
    winsThisWeek: number;
    weeklyTarget: number;
  };

  month: {
    start: string;
    end: string;
    winsThisMonth: number;
    monthlyTarget: number;
  };

  rates?: {
    winRate7: number;
    winRate30: number;
  };

  settings?: UserSettings | null;
};

// ---------- week/month pages ----------
export type WeekDayRow = {
  day: string;
  templateId: string | null;
  totalPoints: number;
  donePoints: number;
  isWin: boolean;
  modeUsed: "points" | "core";
  usedFallback: boolean;
};


export type MonthDayRow = {
  day: string;
  totalPoints: number;
  donePoints: number;
  isWin: boolean;
  templateId: string | null;
};


export type MonthResponse = {
  ym: string;
  start: string;
  end: string;
  days: Array<{
    day: string;
    totalPoints: number;
    donePoints: number;
    isWin: boolean;
    templateId: string | null;
  }>;
};

export type WeekResponse = {
  days: Array<{
    day: string;
    templateId: string | null;
    totalPoints: number;
    donePoints: number;
    isWin: boolean;
    modeUsed: "points" | "core";
    usedFallback: boolean;
  }>;
};

