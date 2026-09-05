-- ============================================================
--  StudyOS — canonical SQLite schema (target: schema_version = 3)
--
--  This file is the readable reference for the whole database. It is
--  the result of applying every file in db/migrations/ in order, so
--  DO NOT run it against an existing database — run the migrations.
--  A fresh install may use this file directly.
--
--  Conventions
--    * every table has an INTEGER or TEXT primary key
--    * every user-owned row carries account_id -> accounts(id)
--    * timestamps are TEXT in ISO-8601 UTC ('2026-09-05T14:03:00Z')
--    * calendar days are TEXT 'YYYY-MM-DD' (local day, on purpose:
--      a study streak is about the student's day, not UTC's)
--    * booleans are INTEGER 0/1 with a CHECK constraint
--    * deletes cascade from account -> subject -> chapter -> note/card
--
--  Nothing here reaches a network. The file lives on the device.
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
--  Meta
-- ------------------------------------------------------------

-- Single-row table tracking which migrations have been applied.
CREATE TABLE IF NOT EXISTS schema_meta (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version  INTEGER NOT NULL,
  app_version     TEXT    NOT NULL,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

-- Append-only log, so a backup file can be inspected for its history.
CREATE TABLE IF NOT EXISTS migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL
);

-- ------------------------------------------------------------
--  Accounts & profile
-- ------------------------------------------------------------

-- A local profile. 'guest' needs no email or password, which is what
-- makes requirement 3 (usable without an account) work.
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  email         TEXT,
  provider      TEXT NOT NULL DEFAULT 'guest'
                  CHECK (provider IN ('guest', 'email', 'google', 'apple')),
  -- Local password hash. Only ever set for provider='email'.
  -- Hashing here separates profiles on one device; it is not server auth.
  pass_hash     TEXT,
  avatar        TEXT NOT NULL DEFAULT '🎓',
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT,
  is_active     INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  -- A guest row has no email; every other provider must have one.
  CHECK ((provider = 'guest' AND email IS NULL) OR (provider <> 'guest' AND email IS NOT NULL))
);

-- One email may exist once per provider (same address via Google and email
-- is two distinct local profiles). NULL emails are exempt, so any number of
-- guest profiles is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_email_provider
  ON accounts (lower(email), provider) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS profiles (
  account_id       TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  class_name       TEXT    NOT NULL DEFAULT '',
  xp               INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  daily_goal_min   INTEGER NOT NULL DEFAULT 120 CHECK (daily_goal_min BETWEEN 5 AND 1440),
  theme            TEXT    NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  onboarded        INTEGER NOT NULL DEFAULT 0 CHECK (onboarded IN (0, 1)),
  is_pro           INTEGER NOT NULL DEFAULT 0 CHECK (is_pro IN (0, 1)),
  updated_at       TEXT    NOT NULL
);

-- Free-form key/value settings. Anything that is a preference rather than
-- data goes here, so adding a toggle never needs a migration.
CREATE TABLE IF NOT EXISTS settings (
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (account_id, key)
);

-- ------------------------------------------------------------
--  Subjects & chapters
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subjects (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
  emoji        TEXT NOT NULL DEFAULT '📘',
  teacher      TEXT,
  target_pct   INTEGER NOT NULL DEFAULT 85 CHECK (target_pct BETWEEN 0 AND 100),
  colour       TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  archived     INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Two subjects with the same name in one account would make every
-- subject picker ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS ux_subjects_account_name
  ON subjects (account_id, lower(name));
CREATE INDEX IF NOT EXISTS ix_subjects_account ON subjects (account_id, sort_order);

CREATE TABLE IF NOT EXISTS chapters (
  id             TEXT PRIMARY KEY,
  subject_id     TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  -- 0-100 self-assessed understanding. Nudged by sessions and quizzes.
  progress_pct   INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  difficulty     INTEGER NOT NULL DEFAULT 2 CHECK (difficulty IN (1, 2, 3)),
  last_revised   TEXT,     -- 'YYYY-MM-DD', NULL = never
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_chapters_subject ON chapters (subject_id, sort_order);
-- Drives the Smart Revision queue: weakest and least recently seen first.
CREATE INDEX IF NOT EXISTS ix_chapters_revision
  ON chapters (account_id, last_revised, progress_pct);

-- ------------------------------------------------------------
--  Notes
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id  TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body        TEXT NOT NULL DEFAULT '',
  -- 'manual' | 'scan' | 'tutor' — where the text came from.
  source      TEXT NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'scan', 'tutor')),
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_notes_chapter ON notes (chapter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notes_account ON notes (account_id, created_at DESC);

-- Full-text search over notes. External-content FTS5 table: the index
-- stores no copy of the text, it points back at notes.rowid.
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title, body, content='notes', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS trg_notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
END;
CREATE TRIGGER IF NOT EXISTS trg_notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
END;
CREATE TRIGGER IF NOT EXISTS trg_notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
END;

-- ------------------------------------------------------------
--  Tasks / homework
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  title         TEXT NOT NULL CHECK (length(trim(title)) > 0),
  notes         TEXT,
  due_date      TEXT,     -- 'YYYY-MM-DD'
  priority      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'done', 'archived')),
  est_minutes   INTEGER CHECK (est_minutes IS NULL OR est_minutes BETWEEN 1 AND 1440),
  completed_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  -- A done task must record when; a pending one must not claim to be done.
  CHECK ((status = 'done' AND completed_at IS NOT NULL)
      OR (status <> 'done' AND completed_at IS NULL))
);

-- The dashboard's hottest query: what's still open, soonest first.
CREATE INDEX IF NOT EXISTS ix_tasks_due ON tasks (account_id, status, due_date);
CREATE INDEX IF NOT EXISTS ix_tasks_subject ON tasks (subject_id, status);

-- ------------------------------------------------------------
--  Exams
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exams (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL CHECK (length(trim(title)) > 0),
  exam_date     TEXT NOT NULL,   -- 'YYYY-MM-DD'
  exam_time     TEXT,            -- 'HH:MM'
  total_marks   INTEGER CHECK (total_marks IS NULL OR total_marks > 0),
  target_pct    INTEGER NOT NULL DEFAULT 85 CHECK (target_pct BETWEEN 0 AND 100),
  -- Filled in after the exam, so Progress can compare target vs actual.
  scored_marks  INTEGER CHECK (scored_marks IS NULL OR scored_marks >= 0),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_exams_date ON exams (account_id, exam_date);

CREATE TABLE IF NOT EXISTS exam_syllabus (
  id          TEXT PRIMARY KEY,
  exam_id     TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  topic       TEXT NOT NULL CHECK (length(trim(topic)) > 0),
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_exam_syllabus_exam ON exam_syllabus (exam_id, sort_order);

-- ------------------------------------------------------------
--  Study sessions
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS study_sessions (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  -- Local calendar day. Denormalised from started_at so streak and
  -- heatmap queries are a plain indexed equality, not a date function.
  day           TEXT NOT NULL,
  started_at    TEXT,
  ended_at      TEXT,
  minutes       INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  mode          TEXT NOT NULL DEFAULT 'pomodoro'
                  CHECK (mode IN ('pomodoro', 'deep', 'custom', 'manual')),
  -- 1 lost .. 4 confident. Captured right after the session.
  confidence    INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 4),
  interrupted   INTEGER NOT NULL DEFAULT 0 CHECK (interrupted IN (0, 1)),
  note          TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sessions_day ON study_sessions (account_id, day);
CREATE INDEX IF NOT EXISTS ix_sessions_subject ON study_sessions (subject_id, day);

-- ------------------------------------------------------------
--  Flashcards (Leitner-box spaced repetition)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS flashcards (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id   TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  note_id      TEXT REFERENCES notes(id) ON DELETE SET NULL,
  front        TEXT NOT NULL CHECK (length(trim(front)) > 0),
  back         TEXT NOT NULL CHECK (length(trim(back)) > 0),
  -- Leitner box 1-5. Interval in days: 1, 3, 7, 16, 35.
  box          INTEGER NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  due_date     TEXT NOT NULL,   -- 'YYYY-MM-DD'
  reps         INTEGER NOT NULL DEFAULT 0 CHECK (reps >= 0),
  lapses       INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  last_seen    TEXT,
  source       TEXT NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual', 'note', 'scan', 'quiz', 'tutor')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- "What's due today" across all decks.
CREATE INDEX IF NOT EXISTS ix_cards_due ON flashcards (account_id, due_date, box);
CREATE INDEX IF NOT EXISTS ix_cards_chapter ON flashcards (chapter_id, due_date);

-- Every review, kept so Progress can show recall over time.
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id      TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day          TEXT NOT NULL,
  -- 0 forgot, 1 hard, 2 good, 3 easy
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 3),
  box_before   INTEGER NOT NULL,
  box_after    INTEGER NOT NULL,
  reviewed_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_reviews_day ON flashcard_reviews (account_id, day);

-- ------------------------------------------------------------
--  Quizzes
-- ------------------------------------------------------------

-- A quiz definition: either generated locally or hand-written.
CREATE TABLE IF NOT EXISTS quizzes (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id   TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  title        TEXT NOT NULL DEFAULT 'Practice quiz',
  difficulty   TEXT NOT NULL DEFAULT 'mixed'
                 CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  -- 'bank'      curated offline question bank
  -- 'generated' built from the student's own notes
  -- 'manual'    typed in by the student
  -- 'ai'        reserved: only ever set if the user turns on an online model
  source       TEXT NOT NULL DEFAULT 'bank'
                 CHECK (source IN ('bank', 'generated', 'manual', 'ai')),
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_quizzes_account ON quizzes (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id             TEXT PRIMARY KEY,
  quiz_id        TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  chapter_id     TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  position       INTEGER NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'mcq'
                   CHECK (kind IN ('mcq', 'truefalse', 'short', 'cloze')),
  prompt         TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
  -- JSON array of option strings. JSON is the right call here: options are
  -- always read and written as one unit and are never queried individually.
  options_json   TEXT,
  correct_index  INTEGER CHECK (correct_index IS NULL OR correct_index >= 0),
  correct_text   TEXT,
  explanation    TEXT,
  UNIQUE (quiz_id, position),
  -- An MCQ needs options and an index; other kinds need the text answer.
  CHECK ((kind IN ('mcq', 'truefalse') AND options_json IS NOT NULL AND correct_index IS NOT NULL)
      OR (kind IN ('short', 'cloze') AND correct_text IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_questions_quiz ON quiz_questions (quiz_id, position);

-- One sitting of a quiz.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT REFERENCES quizzes(id) ON DELETE SET NULL,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  day           TEXT NOT NULL,
  score         INTEGER NOT NULL CHECK (score >= 0),
  total         INTEGER NOT NULL CHECK (total > 0),
  seconds       INTEGER CHECK (seconds IS NULL OR seconds >= 0),
  finished_at   TEXT NOT NULL,
  CHECK (score <= total)
);

CREATE INDEX IF NOT EXISTS ix_attempts_day ON quiz_attempts (account_id, day);
CREATE INDEX IF NOT EXISTS ix_attempts_chapter ON quiz_attempts (chapter_id, finished_at DESC);

-- Per-question outcome. This is what makes weakness tracking specific:
-- "you miss factor-theorem questions", not "you're bad at maths".
CREATE TABLE IF NOT EXISTS quiz_answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id    TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id   TEXT REFERENCES quiz_questions(id) ON DELETE SET NULL,
  -- Snapshot of the prompt, so a deleted quiz doesn't blank out history.
  prompt        TEXT NOT NULL,
  chosen_index  INTEGER,
  chosen_text   TEXT,
  is_correct    INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  seconds       INTEGER,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS ix_answers_attempt ON quiz_answers (attempt_id);
CREATE INDEX IF NOT EXISTS ix_answers_wrong ON quiz_answers (question_id, is_correct);

-- ------------------------------------------------------------
--  Study planner
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plan_blocks (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id   TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  day          TEXT NOT NULL,            -- 'YYYY-MM-DD'
  start_time   TEXT NOT NULL,            -- 'HH:MM'
  minutes      INTEGER NOT NULL CHECK (minutes BETWEEN 5 AND 600),
  kind         TEXT NOT NULL DEFAULT 'study'
                 CHECK (kind IN ('study', 'revise', 'practice', 'homework', 'break')),
  note         TEXT,
  done         INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  -- 1 when Smart Planner generated it, 0 when the student added it.
  auto         INTEGER NOT NULL DEFAULT 0 CHECK (auto IN (0, 1)),
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_plan_day ON plan_blocks (account_id, day, start_time);

-- ------------------------------------------------------------
--  Goals
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS study_goals (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  period       TEXT NOT NULL DEFAULT 'daily'
                 CHECK (period IN ('daily', 'weekly', 'monthly', 'once')),
  metric       TEXT NOT NULL DEFAULT 'minutes'
                 CHECK (metric IN ('minutes', 'sessions', 'questions', 'cards', 'chapters', 'tasks')),
  target       INTEGER NOT NULL CHECK (target > 0),
  starts_on    TEXT NOT NULL,
  ends_on      TEXT,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at   TEXT NOT NULL,
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS ix_goals_active ON study_goals (account_id, active, period);

-- ------------------------------------------------------------
--  Streaks, XP and achievements
-- ------------------------------------------------------------

-- One row per account. Kept as a table rather than derived on the fly so
-- the grace-period rule lives in one place.
CREATE TABLE IF NOT EXISTS streaks (
  account_id       TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  current_count    INTEGER NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  best_count       INTEGER NOT NULL DEFAULT 0 CHECK (best_count >= 0),
  last_study_day   TEXT,
  -- Days of slack before a streak resets. 1 by design: consistency over guilt.
  grace_days       INTEGER NOT NULL DEFAULT 1 CHECK (grace_days >= 0),
  updated_at       TEXT NOT NULL,
  CHECK (best_count >= current_count)
);

-- Catalogue of every badge the app knows about. Seeded by migration.
CREATE TABLE IF NOT EXISTS achievements (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🏅',
  category     TEXT NOT NULL DEFAULT 'general',
  xp_reward    INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Which badges this account has unlocked, and when.
CREATE TABLE IF NOT EXISTS account_achievements (
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  achievement_id  TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at     TEXT NOT NULL,
  PRIMARY KEY (account_id, achievement_id)
);

-- Append-only XP ledger. The profile's xp total is the sum of this, which
-- means the Achievements page can show where the XP actually came from.
CREATE TABLE IF NOT EXISTS xp_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  ref_type    TEXT,   -- 'session' | 'task' | 'quiz' | 'deck' | 'note' | 'scan'
  ref_id      TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_xp_day ON xp_events (account_id, day);

-- ------------------------------------------------------------
--  Progress statistics
-- ------------------------------------------------------------

-- Rolled-up per-day totals. Everything here is derivable from the raw
-- tables; it exists so the Progress page stays fast as history grows.
-- Safe to DELETE and rebuild at any time.
CREATE TABLE IF NOT EXISTS daily_stats (
  account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day               TEXT NOT NULL,
  study_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (study_minutes >= 0),
  sessions          INTEGER NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  tasks_completed   INTEGER NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  questions_asked   INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  cards_reviewed    INTEGER NOT NULL DEFAULT 0,
  xp_earned         INTEGER NOT NULL DEFAULT 0,
  goal_met          INTEGER NOT NULL DEFAULT 0 CHECK (goal_met IN (0, 1)),
  avg_confidence    REAL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (account_id, day),
  CHECK (questions_correct <= questions_asked)
);

CREATE INDEX IF NOT EXISTS ix_daily_stats_day ON daily_stats (day);

-- Per-chapter mastery snapshot: the Knowledge & Weakness tracker.
CREATE TABLE IF NOT EXISTS chapter_stats (
  chapter_id        TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  total_minutes     INTEGER NOT NULL DEFAULT 0,
  quiz_asked        INTEGER NOT NULL DEFAULT 0,
  quiz_correct      INTEGER NOT NULL DEFAULT 0,
  cards_total       INTEGER NOT NULL DEFAULT 0,
  cards_mastered    INTEGER NOT NULL DEFAULT 0,   -- box >= 4
  -- 0-100 blend of self-rating, quiz accuracy and card box levels.
  mastery_pct       INTEGER CHECK (mastery_pct IS NULL OR mastery_pct BETWEEN 0 AND 100),
  -- Higher = revise sooner. Recomputed by the revision scheduler.
  weakness_score    REAL,
  last_activity     TEXT,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_chapter_stats_weak
  ON chapter_stats (account_id, weakness_score DESC);

-- ------------------------------------------------------------
--  Revision scheduling
-- ------------------------------------------------------------

-- The queue the Smart Revision page reads. One row per chapter that is
-- currently scheduled; recomputed rather than accumulated.
CREATE TABLE IF NOT EXISTS revision_items (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  chapter_id    TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  due_date      TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days > 0),
  ease          REAL NOT NULL DEFAULT 2.5 CHECK (ease >= 1.3),
  reps          INTEGER NOT NULL DEFAULT 0,
  lapses        INTEGER NOT NULL DEFAULT 0,
  -- (100 - progress) + min(gap, 30) * 2.2 + (difficulty - 1) * 12
  priority      REAL NOT NULL DEFAULT 0,
  last_revised  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (account_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS ix_revision_due
  ON revision_items (account_id, due_date, priority DESC);

CREATE TABLE IF NOT EXISTS revision_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  chapter_id    TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  minutes       INTEGER,
  outcome       TEXT CHECK (outcome IS NULL OR outcome IN ('again', 'hard', 'good', 'easy')),
  revised_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_revision_log_day ON revision_log (account_id, day);

-- ------------------------------------------------------------
--  Scan & Learn
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scans (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  note_id       TEXT REFERENCES notes(id) ON DELETE SET NULL,
  title         TEXT NOT NULL DEFAULT 'Scan',
  raw_text      TEXT NOT NULL DEFAULT '',
  summary       TEXT,
  keywords_json TEXT,
  -- Path or object-store key, never the image bytes. Keeping blobs out of
  -- the DB keeps backup files small enough to email to yourself.
  image_ref     TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_scans_account ON scans (account_id, created_at DESC);

-- ------------------------------------------------------------
--  Tutor conversations
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tutor_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id   TEXT NOT NULL DEFAULT 'default',
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  body        TEXT NOT NULL,
  subject_id  TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  -- 'local' for the offline rule-based tutor. Only ever anything else if
  -- the user explicitly enables an online model in Settings.
  engine      TEXT NOT NULL DEFAULT 'local',
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_tutor_thread ON tutor_messages (account_id, thread_id, id);

-- ------------------------------------------------------------
--  Social layer (local placeholders today, sync-ready later)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS friends (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  avatar         TEXT NOT NULL DEFAULT '🙂',
  -- NULL while the friend is a local placeholder. Filled in only if the
  -- user turns on the optional online friends feature.
  remote_user_id TEXT,
  xp             INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  minutes        INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  is_local       INTEGER NOT NULL DEFAULT 1 CHECK (is_local IN (0, 1)),
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_friends_account ON friends (account_id, xp DESC);

CREATE TABLE IF NOT EXISTS challenges (
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

CREATE INDEX IF NOT EXISTS ix_challenges_active ON challenges (account_id, status, ends_on);

CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id  TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  friend_id     TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  progress      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (challenge_id, friend_id)
);

-- ------------------------------------------------------------
--  Forward compatibility (empty until the user opts in)
-- ------------------------------------------------------------

-- Outbox for optional cloud sync. Local writes append here; a future sync
-- worker drains it. With sync off the table simply stays empty, so adding
-- sync later needs no schema rebuild.
CREATE TABLE IF NOT EXISTS sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  table_name  TEXT NOT NULL,
  row_id      TEXT NOT NULL,
  op          TEXT NOT NULL CHECK (op IN ('insert', 'update', 'delete')),
  payload     TEXT,
  -- Lamport-style counter for last-write-wins conflict resolution.
  local_rev   INTEGER NOT NULL DEFAULT 1,
  synced_at   TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sync_pending ON sync_queue (account_id, synced_at);

-- Record of every export/import, so a student can see when they last
-- backed up. This is what the Settings page reads.
CREATE TABLE IF NOT EXISTS backups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('export', 'import')),
  format      TEXT NOT NULL CHECK (format IN ('json', 'sqlite')),
  bytes       INTEGER,
  filename    TEXT,
  created_at  TEXT NOT NULL
);

-- ------------------------------------------------------------
--  Views the app reads from
-- ------------------------------------------------------------

-- Everything still open, ordered the way the dashboard shows it.
CREATE VIEW IF NOT EXISTS v_open_tasks AS
SELECT t.*, s.name AS subject_name, s.emoji AS subject_emoji,
       CAST(julianday(t.due_date) - julianday(date('now', 'localtime')) AS INTEGER) AS days_left
FROM tasks t
LEFT JOIN subjects s ON s.id = t.subject_id
WHERE t.status = 'pending'
ORDER BY (t.due_date IS NULL), t.due_date,
         CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END;

-- Chapters ranked by how much they need attention. Deliberately a view:
-- the formula stays in one place and the app can't drift from it.
CREATE VIEW IF NOT EXISTS v_revision_queue AS
SELECT c.id AS chapter_id, c.name AS chapter_name, c.progress_pct, c.difficulty,
       c.last_revised, s.id AS subject_id, s.name AS subject_name, s.emoji,
       c.account_id,
       CAST(julianday(date('now', 'localtime')) - julianday(COALESCE(c.last_revised, c.created_at)) AS INTEGER) AS gap_days,
       (100 - c.progress_pct)
         + MIN(CAST(julianday(date('now', 'localtime')) - julianday(COALESCE(c.last_revised, c.created_at)) AS INTEGER), 30) * 2.2
         + (c.difficulty - 1) * 12 AS priority
FROM chapters c
JOIN subjects s ON s.id = c.subject_id
WHERE s.archived = 0
ORDER BY priority DESC;

-- Per-subject averages for the standings list.
CREATE VIEW IF NOT EXISTS v_subject_progress AS
SELECT s.id AS subject_id, s.account_id, s.name, s.emoji, s.target_pct,
       COUNT(c.id) AS chapter_count,
       COALESCE(ROUND(AVG(c.progress_pct)), 0) AS avg_progress,
       COALESCE(SUM(CASE WHEN c.progress_pct >= 80 THEN 1 ELSE 0 END), 0) AS strong_chapters
FROM subjects s
LEFT JOIN chapters c ON c.subject_id = s.id
WHERE s.archived = 0
GROUP BY s.id;

-- Flashcards due today or earlier.
CREATE VIEW IF NOT EXISTS v_due_cards AS
SELECT f.*, c.name AS chapter_name, s.name AS subject_name, s.emoji
FROM flashcards f
LEFT JOIN chapters c ON c.id = f.chapter_id
LEFT JOIN subjects s ON s.id = f.subject_id
WHERE f.due_date <= date('now', 'localtime')
ORDER BY f.box, f.due_date;
