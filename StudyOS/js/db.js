/* ============================================================
   StudyOS — db.js
   The SQLite layer.

   ARCHITECTURE (see db/README.md for the long version)

   SQLite runs *in the browser* via sql.js — the official SQLite
   C library compiled to WebAssembly. The whole database is a single
   file held in memory while the app runs, and persisted as bytes to
   IndexedDB (or OPFS where available) after every write batch. That
   gives real SQL — foreign keys, indexes, CHECK constraints, views,
   transactions, FTS5 — with no server, no hosting bill, and no
   network access of any kind.

     app  ->  Store  ->  DB (this file)  ->  sql.js  ->  bytes in IDB
                  \
                   `-> localStorage mirror (fallback + fast reads)

   Why a mirror: sql.js is ~1.2 MB of wasm. If it is missing, blocked,
   or the device is low on memory, StudyOS must still work — the spec
   is offline-first, so a hard dependency on a wasm download would be
   the wrong trade. DB.available tells Store which engine won. The
   SQLite file stays the source of truth whenever it is present, and
   `DB.exportFile()` always produces a real .sqlite a student can open
   in any SQLite tool.

   Nothing here performs a network request. There is no fetch to any
   third party; sql-wasm.wasm is served from this app's own folder.
   ============================================================ */
(function (global) {
  "use strict";

  const SCHEMA_VERSION = 3;
  const APP_VERSION = "1.0.0";

  const IDB_NAME = "studyos-sqlite";
  const IDB_STORE = "files";
  const IDB_KEY = "main.sqlite";

  const MIGRATIONS = [
    { version: 1, name: "initial",           file: "db/migrations/001_initial.sql" },
    { version: 2, name: "social_and_sync",   file: "db/migrations/002_social_and_sync.sql" },
    { version: 3, name: "search_and_views",  file: "db/migrations/003_search_and_views.sql" },
  ];

  const DB = {
    available: false,   // true once SQLite is open and migrated
    db: null,           // sql.js Database
    lastError: null,
    _dirty: false,
    _flushTimer: null,

    // ============================================================
    //  Lifecycle
    // ============================================================

    /**
     * Open (or create) the local database and bring it up to
     * SCHEMA_VERSION. Resolves to true if SQLite is usable.
     * Never throws — a failure degrades to the localStorage engine.
     */
    async init() {
      try {
        const SQL = await loadSqlJs();
        if (!SQL) return fail("sql.js not present — using the localStorage engine");

        // Over http the .sql files are readable; from file:// they are not,
        // so that case relies on copies registered via DB.registerMigration.
        if (location.protocol !== "file:") await DB.loadFromFiles();
        if (!SQL_TEXT[MIGRATIONS[0].file]) return fail("migration SQL not reachable");

        const bytes = await idbGet(IDB_KEY);
        DB.db = bytes ? new SQL.Database(new Uint8Array(bytes)) : new SQL.Database();

        DB.exec("PRAGMA foreign_keys = ON;");
        // WAL needs a real filesystem; the in-memory VFS ignores it.
        DB.migrate();
        DB.available = true;
        return true;
      } catch (e) {
        return fail(e.message || String(e));
      }
    },

    /** Apply every migration newer than the stored schema_version. */
    migrate() {
      const from = DB.userVersion();
      if (from >= SCHEMA_VERSION) return from;

      for (const m of MIGRATIONS) {
        if (m.version <= from) continue;
        const sql = SQL_TEXT[m.file];
        if (!sql) throw new Error(`migration ${m.version} (${m.name}) not loaded`);

        DB.exec("BEGIN");
        try {
          DB.exec(sql);
          DB.run(
            "INSERT OR REPLACE INTO migrations (version, name, applied_at) VALUES (?, ?, ?)",
            [m.version, m.name, nowISO()]
          );
          DB.exec(`PRAGMA user_version = ${m.version}`);
          DB.exec("COMMIT");
        } catch (e) {
          DB.exec("ROLLBACK");
          // FTS5 is optional in some sql.js builds. Losing note search is
          // acceptable; losing the install is not.
          if (/fts5|no such module/i.test(e.message)) {
            console.warn(`[StudyOS] migration ${m.version}: FTS5 unavailable, skipping search index`);
            DB.exec("BEGIN");
            DB.exec(stripFts(sql));
            DB.run("INSERT OR REPLACE INTO migrations (version, name, applied_at) VALUES (?, ?, ?)",
              [m.version, m.name + " (no fts)", nowISO()]);
            DB.exec(`PRAGMA user_version = ${m.version}`);
            DB.exec("COMMIT");
          } else {
            throw new Error(`migration ${m.version} (${m.name}) failed: ${e.message}`);
          }
        }
      }

      DB.run(
        `INSERT INTO schema_meta (id, schema_version, app_version, created_at, updated_at)
         VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version,
                                       app_version   = excluded.app_version,
                                       updated_at    = excluded.updated_at`,
        [SCHEMA_VERSION, APP_VERSION, nowISO(), nowISO()]
      );
      DB.markDirty();
      return SCHEMA_VERSION;
    },

    userVersion() {
      try { return DB.one("PRAGMA user_version").user_version || 0; }
      catch { return 0; }
    },

    // ============================================================
    //  Query helpers
    // ============================================================

    exec(sql) { DB.db.exec(sql); },

    /** Parameterised write. Always use this — never interpolate values. */
    run(sql, params) {
      const st = DB.db.prepare(sql);
      try { st.run(params || []); } finally { st.free(); }
      DB.markDirty();
    },

    /** Parameterised read -> array of plain objects. */
    all(sql, params) {
      const st = DB.db.prepare(sql);
      const out = [];
      try {
        st.bind(params || []);
        while (st.step()) out.push(st.getAsObject());
      } finally { st.free(); }
      return out;
    },

    one(sql, params) { return DB.all(sql, params)[0] || null; },

    /** Run fn inside a transaction; rolls back and rethrows on error. */
    tx(fn) {
      DB.exec("BEGIN");
      try { const r = fn(); DB.exec("COMMIT"); DB.markDirty(); return r; }
      catch (e) { DB.exec("ROLLBACK"); throw e; }
    },

    // ============================================================
    //  Persistence
    // ============================================================

    /** Queue a flush. Batched so a burst of writes costs one save. */
    markDirty() {
      DB._dirty = true;
      if (DB._flushTimer) return;
      DB._flushTimer = setTimeout(() => { DB._flushTimer = null; DB.flush(); }, 400);
    },

    async flush() {
      if (!DB.available || !DB._dirty) return;
      DB._dirty = false;
      try { await idbPut(IDB_KEY, DB.db.export()); }
      catch (e) { console.warn("[StudyOS] could not persist the database:", e); DB._dirty = true; }
    },

    // ============================================================
    //  Backup & restore  (requirements 6, 7, 8)
    // ============================================================

    /** Raw .sqlite bytes — openable in any SQLite tool. */
    exportFile() { return DB.db.export(); },

    /** Replace the database from a .sqlite file the user picked. */
    async importFile(arrayBuffer) {
      const SQL = await loadSqlJs();
      if (!SQL) throw new Error("SQLite is not available in this browser");
      const candidate = new SQL.Database(new Uint8Array(arrayBuffer));

      // Validate before destroying anything.
      const v = candidate.exec("PRAGMA user_version")[0].values[0][0];
      if (!v || v > SCHEMA_VERSION) {
        candidate.close();
        throw new Error(
          v ? `That backup was made by a newer version of StudyOS (schema ${v}).`
            : "That file is not a StudyOS database."
        );
      }
      try { candidate.exec("SELECT 1 FROM accounts LIMIT 1"); }
      catch { candidate.close(); throw new Error("That file is not a StudyOS database."); }

      if (DB.db) DB.db.close();
      DB.db = candidate;
      DB.exec("PRAGMA foreign_keys = ON;");
      DB.migrate();               // forward-migrate an older backup
      DB.available = true;
      DB.markDirty();
      await DB.flush();
      DB.logBackup(null, "import", "sqlite", arrayBuffer.byteLength, null);
      return true;
    },

    /** Whole database as JSON — human-readable, diffable, portable. */
    exportJSON() {
      const tables = DB.all(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'
         ORDER BY name`
      ).map((r) => r.name);

      const data = {};
      tables.forEach((t) => { data[t] = DB.all(`SELECT * FROM "${t}"`); });

      return JSON.stringify({
        format: "studyos.sqlite.json",
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        exportedAt: nowISO(),
        tables: data,
      }, null, 2);
    },

    /** Restore from a JSON export. Replaces all rows, keeps the schema. */
    importJSON(text) {
      const p = JSON.parse(text);
      if (p.format !== "studyos.sqlite.json") throw new Error("Unrecognised backup format.");
      if (p.schemaVersion > SCHEMA_VERSION) {
        throw new Error(`That backup needs a newer version of StudyOS (schema ${p.schemaVersion}).`);
      }

      // Insert parents before children so foreign keys hold at every step.
      const ORDER = [
        "accounts", "profiles", "settings", "subjects", "chapters", "notes",
        "tasks", "exams", "exam_syllabus", "study_sessions", "flashcards",
        "flashcard_reviews", "quizzes", "quiz_questions", "quiz_attempts",
        "quiz_answers", "plan_blocks", "study_goals", "streaks", "achievements",
        "account_achievements", "xp_events", "daily_stats", "chapter_stats",
        "revision_items", "revision_log", "scans", "tutor_messages",
        "friends", "challenges", "challenge_participants", "sync_queue", "backups",
      ];

      return DB.tx(() => {
        DB.exec("PRAGMA defer_foreign_keys = ON");
        ORDER.slice().reverse().forEach((t) => {
          try { DB.exec(`DELETE FROM "${t}"`); } catch { /* table may not exist yet */ }
        });
        ORDER.forEach((t) => {
          const rows = p.tables[t];
          if (!Array.isArray(rows) || !rows.length) return;
          rows.forEach((row) => {
            const cols = Object.keys(row);
            const ph = cols.map(() => "?").join(", ");
            DB.run(
              `INSERT OR REPLACE INTO "${t}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${ph})`,
              cols.map((c) => row[c])
            );
          });
        });
        return true;
      });
    },

    logBackup(accountId, direction, format, bytes, filename) {
      if (!DB.available) return;
      try {
        DB.run(
          `INSERT INTO backups (account_id, direction, format, bytes, filename, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [accountId, direction, format, bytes || null, filename || null, nowISO()]
        );
      } catch { /* logging a backup must never block the backup */ }
    },

    /** Sanity report for Settings: row counts and integrity. */
    health() {
      if (!DB.available) return { engine: "localStorage", ok: true };
      const count = (t) => { try { return DB.one(`SELECT COUNT(*) n FROM "${t}"`).n; } catch { return 0; } };
      let integrity = "unknown";
      try { integrity = DB.one("PRAGMA integrity_check").integrity_check; } catch { /* ignore */ }
      return {
        engine: "sqlite",
        schemaVersion: DB.userVersion(),
        integrity,
        bytes: DB.db.export().length,
        counts: {
          accounts: count("accounts"), subjects: count("subjects"), chapters: count("chapters"),
          notes: count("notes"), tasks: count("tasks"), exams: count("exams"),
          sessions: count("study_sessions"), flashcards: count("flashcards"),
          quizzes: count("quizzes"), questions: count("quiz_questions"),
          attempts: count("quiz_attempts"), goals: count("study_goals"),
          achievements: count("account_achievements"),
        },
      };
    },
  };

  // ============================================================
  //  Internals
  // ============================================================

  function fail(msg) {
    DB.available = false;
    DB.lastError = msg;
    console.info("[StudyOS] SQLite unavailable:", msg);
    return false;
  }

  function nowISO() { return new Date().toISOString(); }

  /** Drop the FTS5 virtual table and its triggers from a migration. */
  function stripFts(sql) {
    return sql
      .replace(/CREATE VIRTUAL TABLE[\s\S]*?;/gi, "")
      .replace(/INSERT INTO notes_fts[\s\S]*?;/gi, "")
      .replace(/CREATE TRIGGER trg_notes_[\s\S]*?END;/gi, "");
  }

  /**
   * sql.js is vendored, not fetched from a CDN — a CDN would be a
   * network dependency, and the spec says offline-first.
   * Drop sql-wasm.js + sql-wasm.wasm into vendor/ to enable SQLite.
   */
  async function loadSqlJs() {
    if (global._sqlJs) return global._sqlJs;
    if (typeof global.initSqlJs !== "function") {
      const ok = await injectScript("vendor/sql-wasm.js");
      if (!ok || typeof global.initSqlJs !== "function") return null;
    }
    global._sqlJs = await global.initSqlJs({ locateFile: (f) => "vendor/" + f });
    return global._sqlJs;
  }

  function injectScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  // ---------- IndexedDB blob store (holds the .sqlite bytes) ----------
  function idbOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(key) {
    try {
      const db = await idbOpen();
      return await new Promise((res, rej) => {
        const t = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
        t.onsuccess = () => res(t.result || null);
        t.onerror = () => rej(t.error);
      });
    } catch { return null; }
  }
  async function idbPut(key, bytes) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const t = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(bytes, key);
      t.onsuccess = () => res(true);
      t.onerror = () => rej(t.error);
    });
  }

  /**
   * Migration SQL is inlined so the app works from file:// too, where
   * fetch() of a local .sql is blocked by CORS. db/migrations/*.sql are
   * the readable copies — keep both in step, or set DB.loadFromFiles()
   * when serving over http.
   */
  const SQL_TEXT = {};
  DB.registerMigration = (file, sql) => { SQL_TEXT[file] = sql; };

  /** Fetch the .sql files instead of using the inlined copies (http only). */
  DB.loadFromFiles = async function () {
    for (const m of MIGRATIONS) {
      try {
        const r = await fetch(m.file);
        if (r.ok) SQL_TEXT[m.file] = await r.text();
      } catch { /* keep the inlined copy */ }
    }
  };

  DB.SCHEMA_VERSION = SCHEMA_VERSION;
  DB.MIGRATIONS = MIGRATIONS;
  global.DB = DB;
})(window);
