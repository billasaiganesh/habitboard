CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS template_habits (
  template_id TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  PRIMARY KEY (template_id, habit_id)
);

CREATE TABLE IF NOT EXISTS day_plan (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,        -- YYYY-MM-DD
  template_id TEXT,         -- NULL => "All active habits"
  PRIMARY KEY (user_id, day)
);
