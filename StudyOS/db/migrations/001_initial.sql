-- ============================================================
--  Migration 001 — initial schema
--  Accounts, subjects, chapters, notes, tasks, exams, sessions,
--  flashcards, quizzes, planner, goals, streaks, achievements,
--  stats, revision, scans, tutor.
--
--  Applied inside a transaction by db.js. Do not add BEGIN/COMMIT.
-- ============================================================

CREATE TABLE schema_meta (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version  INTEGER NOT NULL,
  app_version     TEXT    NOT NULL,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE TABLE migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL
);

-- ---------- accounts ----------
CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  email         TEXT,
  provider      TEXT NOT NULL DEFAULT 'guest'
                  CHECK (provider IN ('guest', 'email', 'google', 'apple')),
  pass_hash     TEXT,
  avatar        TEXT NOT NULL DEFAULT '🎓',
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT,
  is_active     INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  CHECK ((provider = 'guest' AND email IS NULL) OR (provider <> 'guest' AND email IS NOT NULL))
);
CREATE UNIQUE INDEX ux_accounts_email_provider
  ON accounts (lower(email), provider) WHERE email IS NOT NULL;

CREATE TABLE profiles (
  account_id       TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  class_name       TEXT    NOT NULL DEFAULT '',
  xp               INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  daily_goal_min   INTEGER NOT NULL DEFAULT 120 CHECK (daily_goal_min BETWEEN 5 AND 1440),
  theme            TEXT    NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  onboarded        INTEGER NOT NULL DEFAULT 0 CHECK (onboarded IN (0, 1)),
  is_pro           INTEGER NOT NULL DEFAULT 0 CHECK (is_pro IN (0, 1)),
  updated_at       TEXT    NOT NULL
);

CREATE TABLE settings (
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (account_id, key)
);

-- ---------- subjects & chapters ----------
CREATE TABLE subjects (
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
CREATE UNIQUE INDEX ux_subjects_account_name ON subjects (account_id, lower(name));
CREATE INDEX ix_subjects_account ON subjects (account_id, sort_order);

CREATE TABLE chapters (
  id             TEXT PRIMARY KEY,
  subject_id     TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  progress_pct   INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  difficulty     INTEGER NOT NULL DEFAULT 2 CHECK (difficulty IN (1, 2, 3)),
  last_revised   TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX ix_chapters_subject ON chapters (subject_id, sort_order);
CREATE INDEX ix_chapters_revision ON chapters (account_id, last_revised, progress_pct);

-- ---------- notes ----------
CREATE TABLE notes (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id  TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body        TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'scan', 'tutor')),
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX ix_notes_chapter ON notes (chapter_id, created_at DESC);
CREATE INDEX ix_notes_account ON notes (account_id, created_at DESC);

-- ---------- tasks ----------
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  title         TEXT NOT NULL CHECK (length(trim(title)) > 0),
  notes         TEXT,
  due_date      TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'archived')),
  est_minutes   INTEGER CHECK (est_minutes IS NULL OR est_minutes BETWEEN 1 AND 1440),
  completed_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  CHECK ((status = 'done' AND completed_at IS NOT NULL)
      OR (status <> 'done' AND completed_at IS NULL))
);
CREATE INDEX ix_tasks_due ON tasks (account_id, status, due_date);
CREATE INDEX ix_tasks_subject ON tasks (subject_id, status);

-- ---------- exams ----------
CREATE TABLE exams (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL CHECK (length(trim(title)) > 0),
  exam_date     TEXT NOT NULL,
  exam_time     TEXT,
  total_marks   INTEGER CHECK (total_marks IS NULL OR total_marks > 0),
  target_pct    INTEGER NOT NULL DEFAULT 85 CHECK (target_pct BETWEEN 0 AND 100),
  scored_marks  INTEGER CHECK (scored_marks IS NULL OR scored_marks >= 0),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX ix_exams_date ON exams (account_id, exam_date);

CREATE TABLE exam_syllabus (
  id          TEXT PRIMARY KEY,
  exam_id     TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  topic       TEXT NOT NULL CHECK (length(trim(topic)) > 0),
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_exam_syllabus_exam ON exam_syllabus (exam_id, sort_order);

-- ---------- sessions ----------
CREATE TABLE study_sessions (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  day           TEXT NOT NULL,
  started_at    TEXT,
  ended_at      TEXT,
  minutes       INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  mode          TEXT NOT NULL DEFAULT 'pomodoro'
                  CHECK (mode IN ('pomodoro', 'deep', 'custom', 'manual')),
  confidence    INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 4),
  interrupted   INTEGER NOT NULL DEFAULT 0 CHECK (interrupted IN (0, 1)),
  note          TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_sessions_day ON study_sessions (account_id, day);
CREATE INDEX ix_sessions_subject ON study_sessions (subject_id, day);

-- ---------- flashcards ----------
CREATE TABLE flashcards (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id   TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  note_id      TEXT REFERENCES notes(id) ON DELETE SET NULL,
  front        TEXT NOT NULL CHECK (length(trim(front)) > 0),
  back         TEXT NOT NULL CHECK (length(trim(back)) > 0),
  box          INTEGER NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  due_date     TEXT NOT NULL,
  reps         INTEGER NOT NULL DEFAULT 0 CHECK (reps >= 0),
  lapses       INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  last_seen    TEXT,
  source       TEXT NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual', 'note', 'scan', 'quiz', 'tutor')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX ix_cards_due ON flashcards (account_id, due_date, box);
CREATE INDEX ix_cards_chapter ON flashcards (chapter_id, due_date);

CREATE TABLE flashcard_reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id      TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day          TEXT NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 3),
  box_before   INTEGER NOT NULL,
  box_after    INTEGER NOT NULL,
  reviewed_at  TEXT NOT NULL
);
CREATE INDEX ix_reviews_day ON flashcard_reviews (account_id, day);

-- ---------- quizzes ----------
CREATE TABLE quizzes (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id   TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  title        TEXT NOT NULL DEFAULT 'Practice quiz',
  difficulty   TEXT NOT NULL DEFAULT 'mixed'
                 CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  source       TEXT NOT NULL DEFAULT 'bank'
                 CHECK (source IN ('bank', 'generated', 'manual', 'ai')),
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_quizzes_account ON quizzes (account_id, created_at DESC);

CREATE TABLE quiz_questions (
  id             TEXT PRIMARY KEY,
  quiz_id        TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  chapter_id     TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  position       INTEGER NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'mcq'
                   CHECK (kind IN ('mcq', 'truefalse', 'short', 'cloze')),
  prompt         TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
  options_json   TEXT,
  correct_index  INTEGER CHECK (correct_index IS NULL OR correct_index >= 0),
  correct_text   TEXT,
  explanation    TEXT,
  UNIQUE (quiz_id, position),
  CHECK ((kind IN ('mcq', 'truefalse') AND options_json IS NOT NULL AND correct_index IS NOT NULL)
      OR (kind IN ('short', 'cloze') AND correct_text IS NOT NULL))
);
CREATE INDEX ix_questions_quiz ON quiz_questions (quiz_id, position);

CREATE TABLE quiz_attempts (
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
CREATE INDEX ix_attempts_day ON quiz_attempts (account_id, day);
CREATE INDEX ix_attempts_chapter ON quiz_attempts (chapter_id, finished_at DESC);

CREATE TABLE quiz_answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id    TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id   TEXT REFERENCES quiz_questions(id) ON DELETE SET NULL,
  prompt        TEXT NOT NULL,
  chosen_index  INTEGER,
  chosen_text   TEXT,
  is_correct    INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  seconds       INTEGER,
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX ix_answers_attempt ON quiz_answers (attempt_id);
CREATE INDEX ix_answers_wrong ON quiz_answers (question_id, is_correct);

-- ---------- planner & goals ----------
CREATE TABLE plan_blocks (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id   TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  day          TEXT NOT NULL,
  start_time   TEXT NOT NULL,
  minutes      INTEGER NOT NULL CHECK (minutes BETWEEN 5 AND 600),
  kind         TEXT NOT NULL DEFAULT 'study'
                 CHECK (kind IN ('study', 'revise', 'practice', 'homework', 'break')),
  note         TEXT,
  done         INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  auto         INTEGER NOT NULL DEFAULT 0 CHECK (auto IN (0, 1)),
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_plan_day ON plan_blocks (account_id, day, start_time);

CREATE TABLE study_goals (
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
CREATE INDEX ix_goals_active ON study_goals (account_id, active, period);

-- ---------- streaks, achievements, xp ----------
CREATE TABLE streaks (
  account_id       TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  current_count    INTEGER NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  best_count       INTEGER NOT NULL DEFAULT 0 CHECK (best_count >= 0),
  last_study_day   TEXT,
  grace_days       INTEGER NOT NULL DEFAULT 1 CHECK (grace_days >= 0),
  updated_at       TEXT NOT NULL,
  CHECK (best_count >= current_count)
);

CREATE TABLE achievements (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🏅',
  category     TEXT NOT NULL DEFAULT 'general',
  xp_reward    INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE account_achievements (
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  achievement_id  TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at     TEXT NOT NULL,
  PRIMARY KEY (account_id, achievement_id)
);

CREATE TABLE xp_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  ref_type    TEXT,
  ref_id      TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_xp_day ON xp_events (account_id, day);

-- ---------- statistics ----------
CREATE TABLE daily_stats (
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
CREATE INDEX ix_daily_stats_day ON daily_stats (day);

CREATE TABLE chapter_stats (
  chapter_id        TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  total_minutes     INTEGER NOT NULL DEFAULT 0,
  quiz_asked        INTEGER NOT NULL DEFAULT 0,
  quiz_correct      INTEGER NOT NULL DEFAULT 0,
  cards_total       INTEGER NOT NULL DEFAULT 0,
  cards_mastered    INTEGER NOT NULL DEFAULT 0,
  mastery_pct       INTEGER CHECK (mastery_pct IS NULL OR mastery_pct BETWEEN 0 AND 100),
  weakness_score    REAL,
  last_activity     TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX ix_chapter_stats_weak ON chapter_stats (account_id, weakness_score DESC);

-- ---------- revision ----------
CREATE TABLE revision_items (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  chapter_id    TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  due_date      TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days > 0),
  ease          REAL NOT NULL DEFAULT 2.5 CHECK (ease >= 1.3),
  reps          INTEGER NOT NULL DEFAULT 0,
  lapses        INTEGER NOT NULL DEFAULT 0,
  priority      REAL NOT NULL DEFAULT 0,
  last_revised  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (account_id, chapter_id)
);
CREATE INDEX ix_revision_due ON revision_items (account_id, due_date, priority DESC);

CREATE TABLE revision_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  chapter_id    TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  minutes       INTEGER,
  outcome       TEXT CHECK (outcome IS NULL OR outcome IN ('again', 'hard', 'good', 'easy')),
  revised_at    TEXT NOT NULL
);
CREATE INDEX ix_revision_log_day ON revision_log (account_id, day);

-- ---------- scan & tutor ----------
CREATE TABLE scans (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  note_id       TEXT REFERENCES notes(id) ON DELETE SET NULL,
  title         TEXT NOT NULL DEFAULT 'Scan',
  raw_text      TEXT NOT NULL DEFAULT '',
  summary       TEXT,
  keywords_json TEXT,
  image_ref     TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_scans_account ON scans (account_id, created_at DESC);

CREATE TABLE tutor_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id   TEXT NOT NULL DEFAULT 'default',
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  body        TEXT NOT NULL,
  subject_id  TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  engine      TEXT NOT NULL DEFAULT 'local',
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_tutor_thread ON tutor_messages (account_id, thread_id, id);

-- ---------- seed the badge catalogue ----------
INSERT INTO achievements (id, name, description, emoji, category, xp_reward, sort_order) VALUES
  ('first_session',  'First Steps',       'Finish your first study session',              '👣', 'sessions',  25,  1),
  ('streak_3',       'Getting Going',     'Study three days in a row',                    '🔥', 'streak',    50,  2),
  ('streak_7',       'Week Warrior',      'Keep a seven-day streak',                      '🗓️', 'streak',   100, 3),
  ('streak_30',      'Unstoppable',       'Keep a thirty-day streak',                     '🚀', 'streak',   400, 4),
  ('hours_10',       'Ten Hour Club',     'Study for ten hours in total',                 '⏱️', 'sessions', 100, 5),
  ('hours_50',       'Deep Diver',        'Study for fifty hours in total',               '🌊', 'sessions', 300, 6),
  ('quiz_first',     'Quiz Curious',      'Complete your first quiz',                     '❓', 'practice',  25,  7),
  ('quiz_perfect',   'Full Marks',        'Score 100% on a quiz',                         '💯', 'practice', 150, 8),
  ('cards_100',      'Card Shark',        'Review one hundred flashcards',                '🃏', 'practice', 150, 9),
  ('chapter_master', 'Chapter Master',    'Take a chapter to 100% understanding',         '🎯', 'progress', 200, 10),
  ('all_homework',   'Clean Slate',       'Clear every pending homework task',            '✅', 'tasks',    100, 11),
  ('night_owl',      'Night Owl',         'Study after 11pm',                             '🦉', 'fun',       25, 12);
