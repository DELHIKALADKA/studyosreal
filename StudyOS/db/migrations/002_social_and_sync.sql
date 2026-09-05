-- ============================================================
--  Migration 002 — social layer, sync outbox, backup log
--
--  Nothing in this migration talks to a network. friends and
--  challenges are local rows; sync_queue exists so that turning on
--  optional cloud sync later is a feature flag, not a rebuild.
-- ============================================================

CREATE TABLE friends (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  avatar         TEXT NOT NULL DEFAULT '🙂',
  remote_user_id TEXT,
  xp             INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  minutes        INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  is_local       INTEGER NOT NULL DEFAULT 1 CHECK (is_local IN (0, 1)),
  created_at     TEXT NOT NULL
);
CREATE INDEX ix_friends_account ON friends (account_id, xp DESC);

CREATE TABLE challenges (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  metric       TEXT NOT NULL DEFAULT 'days'
                 CHECK (metric IN ('days', 'minutes', 'questions', 'chapters', 'cards')),
  goal         INTEGER NOT NULL CHECK (goal > 0),
  progress     INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  starts_on    TEXT NOT NULL,
  ends_on      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'won', 'lost', 'abandoned')),
  created_at   TEXT NOT NULL,
  CHECK (ends_on >= starts_on)
);
CREATE INDEX ix_challenges_active ON challenges (account_id, status, ends_on);

CREATE TABLE challenge_participants (
  challenge_id  TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  friend_id     TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  progress      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (challenge_id, friend_id)
);

-- Outbox pattern. Empty while sync is off.
CREATE TABLE sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  table_name  TEXT NOT NULL,
  row_id      TEXT NOT NULL,
  op          TEXT NOT NULL CHECK (op IN ('insert', 'update', 'delete')),
  payload     TEXT,
  local_rev   INTEGER NOT NULL DEFAULT 1,
  synced_at   TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_sync_pending ON sync_queue (account_id, synced_at);

CREATE TABLE backups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('export', 'import')),
  format      TEXT NOT NULL CHECK (format IN ('json', 'sqlite')),
  bytes       INTEGER,
  filename    TEXT,
  created_at  TEXT NOT NULL
);
