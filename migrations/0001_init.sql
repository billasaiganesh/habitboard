PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,         -- base64
  pass_salt TEXT NOT NULL,         -- base64
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions (cookie token)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- Habits per user
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  section TEXT NOT NULL DEFAULT 'Morning', -- Morning | Work | Evening
  sort_order INTEGER NOT NULL DEFAULT 999,
  active INTEGER NOT NULL DEFAULT 1,       -- 1 active, 0 hidden
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, active);

-- Checks per day
CREATE TABLE IF NOT EXISTS habit_checks (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,        -- YYYY-MM-DD
  habit_id TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0, -- 0/1
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, day, habit_id)
);

CREATE INDEX IF NOT EXISTS idx_checks_user_day ON habit_checks(user_id, day);
