/* ============================================================
   StudyOS — db-bridge.js
   Projects the in-memory JS state into the SQLite file.

   WHY A BRIDGE

   The app layer grew up around one plain JS object per account
   (Store.state) held in localStorage. That shape is convenient for
   rendering — chapters carry their notes and cards inline — but it is
   not a database. SQLite is the durable, queryable, exportable copy.

   Rather than rewrite every page against SQL, the bridge writes the
   state *through* to SQLite on every save:

     Store.set(...) -> Store.save() -> Bridge.project(account, state)
                          |                    |
                    localStorage          SQLite (real tables)

   Reads still come from Store.state, which keeps the UI synchronous
   and fast. Writes land in both places, so:
     - `DB.exportFile()` yields a genuine .sqlite with real rows,
     - the views (v_revision_queue, v_open_tasks, ...) work,
     - note search can use FTS5,
     - and if localStorage is ever cleared, Bridge.hydrate() rebuilds
       the JS state straight out of the database.

   Projection is a full replace inside one transaction. A student's
   whole dataset is small — a few thousand rows at most — so a replace
   is cheaper to reason about than incremental diffing, and it can
   never drift from what the UI shows.

   No network calls. Nothing leaves the device.
   ============================================================ */
(function (global) {
  "use strict";

  const Bridge = {
    enabled: false,

    /** Called once after DB.init() succeeds. */
    attach() {
      Bridge.enabled = !!(global.DB && DB.available);
      return Bridge.enabled;
    },

    // ============================================================
    //  state  ->  SQLite
    // ============================================================
    project(account, state) {
      if (!Bridge.enabled || !account || !state) return false;
      try {
        DB.tx(() => {
          wipe(account.id);
          writeAccount(account, state);
          writeSubjects(account.id, state);
          writeTasks(account.id, state);
          writeExams(account.id, state);
          writeSessions(account.id, state);
          writeQuizzes(account.id, state);
          writePlan(account.id, state);
          writeGamification(account.id, state);
          writeSocial(account.id, state);
          writeScansAndChats(account.id, state);
          writeStats(account.id, state);
        });
        return true;
      } catch (e) {
        console.warn("[StudyOS] SQLite projection skipped:", e.message);
        return false;
      }
    },

    // ============================================================
    //  SQLite  ->  state   (recovery path)
    // ============================================================

    /**
     * Rebuild the JS state for an account from the database. Used when
     * localStorage has been cleared but the .sqlite file survived, and
     * after importing a .sqlite backup.
     */
    hydrate(accountId) {
      if (!Bridge.enabled) return null;
      const acc = DB.one("SELECT * FROM accounts WHERE id = ?", [accountId]);
      if (!acc) return null;

      const s = global.blankState();
      const pr = DB.one("SELECT * FROM profiles WHERE account_id = ?", [accountId]) || {};
      s.profile.name = acc.display_name || "";
      s.profile.avatar = acc.avatar || "🎓";
      s.profile.className = pr.class_name || "Class 9";
      s.profile.xp = pr.xp || 0;
      s.profile.dailyGoalMin = pr.daily_goal_min || 120;
      s.profile.theme = pr.theme || "dark";
      s.profile.onboarded = !!pr.onboarded;
      s.profile.pro = !!pr.is_pro;
      DB.all("SELECT key, value FROM settings WHERE account_id = ? AND key LIKE 'notif.%'", [accountId])
        .forEach((r) => { s.profile.notif[r.key.slice(6)] = r.value === "1"; });

      const cardsBy = groupBy(DB.all("SELECT * FROM flashcards WHERE account_id = ?", [accountId]), "chapter_id");
      const notesBy = groupBy(DB.all("SELECT * FROM notes WHERE account_id = ?", [accountId]), "chapter_id");

      s.subjects = DB.all(
        "SELECT * FROM subjects WHERE account_id = ? ORDER BY sort_order", [accountId]
      ).map((sub) => ({
        id: sub.id, name: sub.name, emoji: sub.emoji,
        chapters: DB.all(
          "SELECT * FROM chapters WHERE subject_id = ? ORDER BY sort_order", [sub.id]
        ).map((c) => ({
          id: c.id, name: c.name, difficulty: c.difficulty,
          progress: c.progress_pct, lastRevised: c.last_revised,
          notes: (notesBy[c.id] || []).map((n) => ({
            id: n.id, title: n.title, body: n.body,
            pinned: !!n.pinned, ts: Date.parse(n.created_at) || Date.now(),
          })),
          cards: (cardsBy[c.id] || []).map((k) => ({
            id: k.id, front: k.front, back: k.back, box: k.box, due: k.due_date,
          })),
        })),
      }));

      const subName = nameLookup(s.subjects);
      const chName = chapterLookup(s.subjects);

      s.homework = DB.all("SELECT * FROM tasks WHERE account_id = ? ORDER BY created_at", [accountId])
        .map((t) => ({
          id: t.id, subject: subName[t.subject_id] || "", task: t.title, due: t.due_date,
          priority: cap(t.priority), status: t.status === "done" ? "done" : "todo",
          createdAt: Date.parse(t.created_at) || Date.now(),
        }));

      s.exams = DB.all("SELECT * FROM exams WHERE account_id = ? ORDER BY exam_date", [accountId])
        .map((e) => ({
          id: e.id, subject: subName[e.subject_id] || "", date: e.exam_date,
          syllabus: DB.all("SELECT topic, done FROM exam_syllabus WHERE exam_id = ? ORDER BY sort_order", [e.id])
            .map((x) => ({ topic: x.topic, done: !!x.done })),
        }));

      s.sessions = DB.all("SELECT * FROM study_sessions WHERE account_id = ? ORDER BY day", [accountId])
        .map((x) => ({
          id: x.id, dateISO: x.day, minutes: x.minutes, subject: subName[x.subject_id] || "",
          chapter: chName[x.chapter_id] || "", confidence: x.confidence, mode: x.mode,
        }));

      s.quizResults = DB.all("SELECT * FROM quiz_attempts WHERE account_id = ? ORDER BY day", [accountId])
        .map((a) => ({
          id: a.id, dateISO: a.day, subject: subName[a.subject_id] || "",
          chapter: chName[a.chapter_id] || "", score: a.score, total: a.total, wrong: [],
        }));

      s.plan = DB.all("SELECT * FROM plan_blocks WHERE account_id = ? ORDER BY day, start_time", [accountId])
        .map((b) => ({
          id: b.id, dateISO: b.day, start: b.start_time, end: addMinutes(b.start_time, b.minutes),
          subject: subName[b.subject_id] || "", chapter: chName[b.chapter_id] || "",
          note: b.note || "", done: !!b.done,
        }));

      const st = DB.one("SELECT * FROM streaks WHERE account_id = ?", [accountId]);
      if (st) s.streak = { lastStudyDate: st.last_study_day, count: st.current_count, best: st.best_count };

      s.badges = DB.all("SELECT achievement_id FROM account_achievements WHERE account_id = ?", [accountId])
        .map((r) => r.achievement_id);

      s.friends = DB.all("SELECT * FROM friends WHERE account_id = ? ORDER BY xp DESC", [accountId])
        .map((f) => ({ id: f.id, name: f.display_name, avatar: f.avatar, xp: f.xp, minutes: f.minutes }));

      const friendName = {};
      DB.all("SELECT id, display_name FROM friends WHERE account_id = ?", [accountId])
        .forEach((f) => { friendName[f.id] = f.display_name; });

      s.challenges = DB.all("SELECT * FROM challenges WHERE account_id = ? ORDER BY ends_on", [accountId])
        .map((c) => ({
          id: c.id, title: c.title, goal: c.goal, unit: c.metric, progress: c.progress,
          endsOn: c.ends_on,
          friends: DB.all("SELECT friend_id FROM challenge_participants WHERE challenge_id = ?", [c.id])
            .map((p) => friendName[p.friend_id]).filter(Boolean),
        }));

      s.scans = DB.all("SELECT * FROM scans WHERE account_id = ? ORDER BY created_at DESC", [accountId])
        .map((x) => ({
          id: x.id, ts: Date.parse(x.created_at) || Date.now(), name: x.title,
          summary: x.summary || "", points: parseJSON(x.keywords_json, []),
          subject: subName[x.subject_id] || "",
        }));

      s.chats = DB.all("SELECT * FROM tutor_messages WHERE account_id = ? ORDER BY id", [accountId])
        .map((m) => ({ id: String(m.id), role: m.role, text: m.body, ts: Date.parse(m.created_at) || Date.now() }));

      return s;
    },

    /** Does the database hold any account rows? */
    hasData() {
      if (!Bridge.enabled) return false;
      try { return DB.one("SELECT COUNT(*) n FROM accounts").n > 0; }
      catch { return false; }
    },

    /** Full-text note search, falling back to LIKE when FTS5 is absent. */
    searchNotes(accountId, query) {
      if (!Bridge.enabled || !query.trim()) return [];
      try {
        return DB.all(
          `SELECT n.id, n.title, n.body, n.chapter_id
             FROM notes_fts f JOIN notes n ON n.rowid = f.rowid
            WHERE notes_fts MATCH ? AND n.account_id = ?
            ORDER BY rank LIMIT 40`,
          [query.trim().split(/\s+/).map((w) => w + "*").join(" "), accountId]
        );
      } catch {
        const like = "%" + query.trim() + "%";
        return DB.all(
          `SELECT id, title, body, chapter_id FROM notes
            WHERE account_id = ? AND (title LIKE ? OR body LIKE ?) LIMIT 40`,
          [accountId, like, like]
        );
      }
    },
  };

  // ============================================================
  //  writers
  // ============================================================

  /** Remove this account's rows. Cascades clear every child table. */
  function wipe(accountId) {
    DB.run("DELETE FROM accounts WHERE id = ?", [accountId]);
  }

  function writeAccount(acc, s) {
    const email = acc.provider === "guest" ? null : (acc.email || null);
    const provider = acc.provider === "guest" ? "guest" : (acc.provider || "email");
    DB.run(
      `INSERT INTO accounts (id, display_name, email, provider, pass_hash, avatar,
                             created_at, last_seen_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [acc.id, acc.name || "Student", email, provider, acc.passHash || null,
       acc.avatar || "🎓", acc.createdAt || nowISO(), nowISO()]
    );

    const p = s.profile;
    DB.run(
      `INSERT INTO profiles (account_id, class_name, xp, daily_goal_min, theme,
                             onboarded, is_pro, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [acc.id, p.className || "", clampInt(p.xp, 0, 1e9),
       clampInt(p.dailyGoalMin || 120, 5, 1440), p.theme === "light" ? "light" : "dark",
       p.onboarded ? 1 : 0, p.pro ? 1 : 0, nowISO()]
    );

    Object.keys(p.notif || {}).forEach((k) => {
      DB.run(
        "INSERT INTO settings (account_id, key, value, updated_at) VALUES (?, ?, ?, ?)",
        [acc.id, "notif." + k, p.notif[k] ? "1" : "0", nowISO()]
      );
    });
  }

  function writeSubjects(accountId, s) {
    s.subjects.forEach((sub, si) => {
      DB.run(
        `INSERT INTO subjects (id, account_id, name, emoji, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sub.id, accountId, sub.name, sub.emoji || "📘", si, nowISO(), nowISO()]
      );
      (sub.chapters || []).forEach((c, ci) => {
        DB.run(
          `INSERT INTO chapters (id, subject_id, account_id, name, progress_pct,
                                 difficulty, last_revised, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, sub.id, accountId, c.name, clampInt(c.progress, 0, 100),
           clampInt(c.difficulty || 2, 1, 3), c.lastRevised || null, ci, nowISO(), nowISO()]
        );
        (c.notes || []).forEach((n) => {
          DB.run(
            `INSERT INTO notes (id, account_id, subject_id, chapter_id, title, body,
                                source, pinned, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`,
            [n.id, accountId, sub.id, c.id, n.title || "Untitled", n.body || "",
             n.pinned ? 1 : 0, iso(n.ts), nowISO()]
          );
        });
        (c.cards || []).forEach((k) => {
          DB.run(
            `INSERT INTO flashcards (id, account_id, subject_id, chapter_id, front, back,
                                     box, due_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [k.id, accountId, sub.id, c.id, k.front || "?", k.back || "?",
             clampInt(k.box || 1, 1, 5), k.due || U.todayISO(), nowISO(), nowISO()]
          );
        });

        // The revision queue is derived, but persisting it lets SQL rank it.
        DB.run(
          `INSERT INTO revision_items (id, account_id, chapter_id, due_date, interval_days,
                                       priority, last_revised, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          ["rev_" + c.id, accountId, c.id,
           c.lastRevised ? U.addDays(c.lastRevised, 3) : U.todayISO(),
           revisionPriority(c), c.lastRevised || null, nowISO(), nowISO()]
        );
      });
    });
  }

  function writeTasks(accountId, s) {
    const byName = idLookup(s.subjects);
    s.homework.forEach((h) => {
      const done = h.status === "done";
      DB.run(
        `INSERT INTO tasks (id, account_id, subject_id, title, due_date, priority,
                            status, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [h.id, accountId, byName[h.subject] || null, h.task || "Task", h.due || null,
         (h.priority || "medium").toLowerCase(), done ? "done" : "pending",
         done ? nowISO() : null, iso(h.createdAt), nowISO()]
      );
    });
  }

  function writeExams(accountId, s) {
    const byName = idLookup(s.subjects);
    s.exams.forEach((e) => {
      DB.run(
        `INSERT INTO exams (id, account_id, subject_id, title, exam_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.id, accountId, byName[e.subject] || null,
         (e.subject || "Exam") + " test", e.date, nowISO(), nowISO()]
      );
      (e.syllabus || []).forEach((x, i) => {
        DB.run(
          `INSERT INTO exam_syllabus (id, exam_id, topic, done, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [e.id + "_" + i, e.id, x.topic || "Topic", x.done ? 1 : 0, i]
        );
      });
    });
  }

  function writeSessions(accountId, s) {
    const subj = idLookup(s.subjects);
    const chap = chapterIdLookup(s.subjects);
    s.sessions.forEach((x) => {
      if (!(x.minutes > 0)) return;
      DB.run(
        `INSERT INTO study_sessions (id, account_id, subject_id, chapter_id, day,
                                     minutes, mode, confidence, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [x.id, accountId, subj[x.subject] || null, chap[x.chapter] || null,
         x.dateISO, clampInt(x.minutes, 1, 1440),
         ["pomodoro", "deep", "custom", "manual"].includes(x.mode) ? x.mode : "custom",
         x.confidence || null, x.note || null, nowISO()]
      );
    });
  }

  function writeQuizzes(accountId, s) {
    const subj = idLookup(s.subjects);
    const chap = chapterIdLookup(s.subjects);
    s.quizResults.forEach((q) => {
      if (!(q.total > 0)) return;
      DB.run(
        `INSERT INTO quiz_attempts (id, account_id, subject_id, chapter_id, day,
                                    score, total, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [q.id, accountId, subj[q.subject] || null, chap[q.chapter] || null, q.dateISO,
         clampInt(q.score, 0, q.total), q.total, iso(q.ts) || q.dateISO + "T12:00:00.000Z"]
      );
      (q.wrong || []).forEach((w) => {
        DB.run(
          `INSERT INTO quiz_answers (attempt_id, prompt, chosen_index, is_correct)
           VALUES (?, ?, ?, 0)`,
          [q.id, typeof w === "string" ? w : (w.q || w.prompt || "Question"),
           typeof w === "object" ? (w.chosen ?? null) : null]
        );
      });
    });
  }

  function writePlan(accountId, s) {
    const subj = idLookup(s.subjects);
    const chap = chapterIdLookup(s.subjects);
    s.plan.forEach((b) => {
      DB.run(
        `INSERT INTO plan_blocks (id, account_id, subject_id, chapter_id, day,
                                  start_time, minutes, note, done, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, accountId, subj[b.subject] || null, chap[b.chapter] || null, b.dateISO,
         b.start || "16:00", clampInt(spanMinutes(b.start, b.end), 5, 600),
         b.note || null, b.done ? 1 : 0, nowISO()]
      );
    });
  }

  function writeGamification(accountId, s) {
    const st = s.streak || {};
    const cur = clampInt(st.count, 0, 1e6);
    DB.run(
      `INSERT INTO streaks (account_id, current_count, best_count, last_study_day, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [accountId, cur, Math.max(cur, clampInt(st.best, 0, 1e6)), st.lastStudyDate || null, nowISO()]
    );

    (s.badges || []).forEach((id) => {
      // Ignore ids the catalogue does not know — the FK would reject them.
      try {
        DB.run(
          "INSERT INTO account_achievements (account_id, achievement_id, unlocked_at) VALUES (?, ?, ?)",
          [accountId, id, nowISO()]
        );
      } catch { /* unknown badge id */ }
    });

    if (s.profile.xp > 0) {
      DB.run(
        `INSERT INTO xp_events (account_id, day, amount, reason, created_at)
         VALUES (?, ?, ?, 'carried total', ?)`,
        [accountId, U.todayISO(), s.profile.xp, nowISO()]
      );
    }
  }

  function writeSocial(accountId, s) {
    const fid = {};
    (s.friends || []).forEach((f) => {
      fid[f.name] = f.id;
      DB.run(
        `INSERT INTO friends (id, account_id, display_name, avatar, xp, minutes, is_local, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [f.id, accountId, f.name, f.avatar || "🙂",
         clampInt(f.xp, 0, 1e9), clampInt(f.minutes, 0, 1e9), nowISO()]
      );
    });

    (s.challenges || []).forEach((c) => {
      const metric = ["days", "minutes", "questions", "chapters", "cards"].includes(c.unit) ? c.unit : "days";
      const ends = c.endsOn || U.addDays(U.todayISO(), 7);
      const starts = ends < U.todayISO() ? ends : U.todayISO();
      DB.run(
        `INSERT INTO challenges (id, account_id, title, metric, goal, progress,
                                 starts_on, ends_on, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, accountId, c.title || "Challenge", metric, Math.max(1, c.goal || 1),
         clampInt(c.progress, 0, 1e9), starts, ends,
         c.progress >= c.goal ? "won" : "active", nowISO()]
      );
      (c.friends || []).forEach((name) => {
        if (!fid[name]) return;
        try {
          DB.run(
            "INSERT INTO challenge_participants (challenge_id, friend_id, progress) VALUES (?, ?, 0)",
            [c.id, fid[name]]
          );
        } catch { /* duplicate participant */ }
      });
    });
  }

  function writeScansAndChats(accountId, s) {
    const subj = idLookup(s.subjects);
    (s.scans || []).forEach((x) => {
      DB.run(
        `INSERT INTO scans (id, account_id, subject_id, title, raw_text, summary,
                            keywords_json, created_at)
         VALUES (?, ?, ?, ?, '', ?, ?, ?)`,
        [x.id, accountId, subj[x.subject] || null, x.name || "Scan",
         x.summary || null, JSON.stringify(x.points || []), iso(x.ts)]
      );
    });

    (s.chats || []).forEach((m) => {
      DB.run(
        `INSERT INTO tutor_messages (account_id, role, body, engine, created_at)
         VALUES (?, ?, ?, 'local', ?)`,
        [accountId, m.role === "user" ? "user" : "assistant", m.text || "", iso(m.ts)]
      );
    });
  }

  /** Roll sessions/tasks/quizzes into the per-day and per-chapter rollups. */
  function writeStats(accountId, s) {
    const days = {};
    const bump = (day) => (days[day] = days[day] || { min: 0, sess: 0, conf: [], q: 0, qc: 0, tasks: 0 });

    s.sessions.forEach((x) => {
      const d = bump(x.dateISO);
      d.min += x.minutes || 0; d.sess += 1;
      if (x.confidence) d.conf.push(x.confidence);
    });
    s.quizResults.forEach((q) => {
      const d = bump(q.dateISO);
      d.q += q.total || 0; d.qc += q.score || 0;
    });
    s.homework.filter((h) => h.status === "done").forEach((h) => {
      if (h.due) bump(h.due).tasks += 1;
    });

    const goal = s.profile.dailyGoalMin || 120;
    Object.keys(days).forEach((day) => {
      const d = days[day];
      DB.run(
        `INSERT INTO daily_stats (account_id, day, study_minutes, sessions, tasks_completed,
                                  questions_asked, questions_correct, goal_met,
                                  avg_confidence, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accountId, day, d.min, d.sess, d.tasks, d.q, d.qc,
         d.min >= goal ? 1 : 0,
         d.conf.length ? d.conf.reduce((a, b) => a + b, 0) / d.conf.length : null, nowISO()]
      );
    });

    // Per-chapter mastery, so the weakness list can be a plain ORDER BY.
    const minutesByChapter = {};
    const chap = chapterIdLookup(s.subjects);
    s.sessions.forEach((x) => {
      const id = chap[x.chapter];
      if (id) minutesByChapter[id] = (minutesByChapter[id] || 0) + (x.minutes || 0);
    });

    s.subjects.forEach((sub) => (sub.chapters || []).forEach((c) => {
      const cards = c.cards || [];
      DB.run(
        `INSERT INTO chapter_stats (chapter_id, account_id, total_minutes, cards_total,
                                    cards_mastered, mastery_pct, weakness_score,
                                    last_activity, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, accountId, minutesByChapter[c.id] || 0, cards.length,
         cards.filter((k) => (k.box || 1) >= 4).length,
         clampInt(c.progress, 0, 100), revisionPriority(c),
         c.lastRevised || null, nowISO()]
      );
    }));
  }

  // ============================================================
  //  helpers
  // ============================================================

  /** Mirrors v_revision_queue so JS and SQL rank chapters identically. */
  function revisionPriority(c) {
    const gap = c.lastRevised ? Math.min(U.daysBetween(c.lastRevised, U.todayISO()), 30) : 30;
    return (100 - (c.progress || 0)) + gap * 2.2 + ((c.difficulty || 2) - 1) * 12;
  }

  function idLookup(subjects) {
    const m = {};
    subjects.forEach((s) => { m[s.name] = s.id; });
    return m;
  }
  function nameLookup(subjects) {
    const m = {};
    subjects.forEach((s) => { m[s.id] = s.name; });
    return m;
  }
  function chapterIdLookup(subjects) {
    const m = {};
    subjects.forEach((s) => (s.chapters || []).forEach((c) => { m[c.name] = c.id; }));
    return m;
  }
  function chapterLookup(subjects) {
    const m = {};
    subjects.forEach((s) => (s.chapters || []).forEach((c) => { m[c.id] = c.name; }));
    return m;
  }
  function groupBy(rows, key) {
    const m = {};
    rows.forEach((r) => { (m[r[key]] = m[r[key]] || []).push(r); });
    return m;
  }

  function spanMinutes(start, end) {
    const a = toMin(start), b = toMin(end);
    return b > a ? b - a : 45;
  }
  function toMin(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
    return m ? +m[1] * 60 + +m[2] : 0;
  }
  function addMinutes(hhmm, mins) {
    const t = toMin(hhmm) + (mins || 0);
    return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  }

  function clampInt(v, lo, hi) {
    const n = Math.round(Number(v) || 0);
    return Math.min(hi, Math.max(lo, n));
  }
  function cap(s) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); }
  function iso(ts) { return ts ? new Date(ts).toISOString() : nowISO(); }
  function nowISO() { return new Date().toISOString(); }
  function parseJSON(t, dflt) { try { return JSON.parse(t); } catch { return dflt; } }

  global.Bridge = Bridge;
})(window);
