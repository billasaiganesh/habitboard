CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  win_mode TEXT NOT NULL DEFAULT 'points',          -- 'points' | 'core'
  win_threshold_percent INTEGER NOT NULL DEFAULT 70,
  weekly_win_target INTEGER NOT NULL DEFAULT 5,
  monthly_win_target INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_core_habits (
  user_id TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  PRIMARY KEY (user_id, habit_id)
);
