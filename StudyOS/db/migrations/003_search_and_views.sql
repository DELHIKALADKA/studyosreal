-- ============================================================
--  Migration 003 — note search and reporting views
--
--  FTS5 is compiled into the standard sql.js build. db.js probes for
--  it and skips this block if the build lacks it, so a missing FTS5
--  degrades note search to LIKE rather than breaking the install.
-- ============================================================

-- External-content FTS index: no duplicate copy of the note text.
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, content='notes', content_rowid='rowid'
);

-- Backfill anything already stored.
INSERT INTO notes_fts(rowid, title, body) SELECT rowid, title, body FROM notes;

CREATE TRIGGER trg_notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
END;

CREATE TRIGGER trg_notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
END;

CREATE TRIGGER trg_notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
END;

-- ---------- views ----------

CREATE VIEW v_open_tasks AS
SELECT t.*, s.name AS subject_name, s.emoji AS subject_emoji,
       CAST(julianday(t.due_date) - julianday(date('now', 'localtime')) AS INTEGER) AS days_left
FROM tasks t
LEFT JOIN subjects s ON s.id = t.subject_id
WHERE t.status = 'pending'
ORDER BY (t.due_date IS NULL), t.due_date,
         CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END;

CREATE VIEW v_revision_queue AS
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

CREATE VIEW v_subject_progress AS
SELECT s.id AS subject_id, s.account_id, s.name, s.emoji, s.target_pct,
       COUNT(c.id) AS chapter_count,
       COALESCE(ROUND(AVG(c.progress_pct)), 0) AS avg_progress,
       COALESCE(SUM(CASE WHEN c.progress_pct >= 80 THEN 1 ELSE 0 END), 0) AS strong_chapters
FROM subjects s
LEFT JOIN chapters c ON c.subject_id = s.id
WHERE s.archived = 0
GROUP BY s.id;

CREATE VIEW v_due_cards AS
SELECT f.*, c.name AS chapter_name, s.name AS subject_name, s.emoji
FROM flashcards f
LEFT JOIN chapters c ON c.id = f.chapter_id
LEFT JOIN subjects s ON s.id = f.subject_id
WHERE f.due_date <= date('now', 'localtime')
ORDER BY f.box, f.due_date;
