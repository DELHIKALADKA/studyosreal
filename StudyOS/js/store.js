/* ============================================================
   StudyOS — store.js
   Persistence, per-account state, schema, XP/streak/gamification.
   ============================================================ */
(function (global) {
  "use strict";

  const ACCOUNTS_KEY = "studyos.accounts.v2";  // { users: [...], activeId }
  const DATA_PREFIX  = "studyos.data.v2.";     // + accountId

  // ---------- schema ----------
  function blankState() {
    return {
      profile: {
        name: "", className: "Class 9", avatar: "🎓",
        xp: 0, theme: "dark", dailyGoalMin: 120, onboarded: false,
        pro: false,
        notif: { homework: true, revision: true, goal: true, streak: true },
      },
      subjects: [],      // { id, name, emoji, chapters: [{ id, name, difficulty, progress, lastRevised, notes[], cards[] }] }
      homework: [],      // { id, subject, task, due, priority, status, createdAt }
      exams: [],         // { id, subject, date, syllabus: [{topic, done}] }
      sessions: [],      // { id, dateISO, minutes, subject, chapter, confidence, mode }
      quizResults: [],   // { id, dateISO, subject, chapter, score, total, wrong: [q...] }
      plan: [],          // { id, dateISO, start, end, subject, chapter, note, done }
      chats: [],         // { id, role, text, ts }
      scans: [],         // { id, ts, name, summary, points[], subject }
      streak: { lastStudyDate: null, count: 0, best: 0 },
      badges: [],        // ids of earned badges
      friends: [],       // { id, name, avatar, xp, minutes }
      challenges: [],    // { id, title, goal, unit, progress, endsOn, friends[] }
      createdAt: new Date().toISOString(),
    };
  }

  // ---------- accounts ----------
  function readAccounts() {
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      if (!raw) return { users: [], activeId: null };
      const p = JSON.parse(raw);
      return { users: Array.isArray(p.users) ? p.users : [], activeId: p.activeId || null };
    } catch { return { users: [], activeId: null }; }
  }
  function writeAccounts(a) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)); }

  const Store = {
    state: null,
    account: null,

    // ---- account API ----
    accounts() { return readAccounts().users; },
    activeAccountId() { return readAccounts().activeId; },

    findAccount(email, provider) {
      return readAccounts().users.find(
        (u) => u.email && u.email.toLowerCase() === String(email).toLowerCase() && (!provider || u.provider === provider)
      );
    },
    findAccountById(id) { return readAccounts().users.find((u) => u.id === id) || null; },
    findGuest() { return readAccounts().users.find((u) => u.provider === "guest"); },

    /** Persist edits made directly to Store.account (name / avatar changes). */
    saveAccounts() {
      if (!this.account) return;
      const a = readAccounts();
      const i = a.users.findIndex((u) => u.id === this.account.id);
      if (i >= 0) a.users[i] = this.account;
      writeAccounts(a);
    },

    createAccount({ name, email, provider, avatar, passHash }) {
      const a = readAccounts();
      const acc = {
        id: U.uid(), name: name || "Student", email: email || null, provider,
        avatar: avatar || "🎓", passHash: passHash || null, createdAt: new Date().toISOString(),
      };
      a.users.push(acc);
      writeAccounts(a);
      const st = blankState();
      st.profile.name = acc.name;
      st.profile.avatar = acc.avatar;
      localStorage.setItem(DATA_PREFIX + acc.id, JSON.stringify(st));
      return acc;
    },

    signIn(accountId) {
      const a = readAccounts();
      if (!a.users.some((u) => u.id === accountId)) return false;
      a.activeId = accountId;
      writeAccounts(a);
      this.load();
      return true;
    },

    signOut() {
      const a = readAccounts();
      a.activeId = null;
      writeAccounts(a);
      this.state = null;
      this.account = null;
    },

    deleteActiveAccount() {
      const a = readAccounts();
      if (!a.activeId) return;
      localStorage.removeItem(DATA_PREFIX + a.activeId);
      a.users = a.users.filter((u) => u.id !== a.activeId);
      a.activeId = null;
      writeAccounts(a);
      this.state = null; this.account = null;
    },

    /** Promote a guest account to a real one (keeps all data). */
    upgradeGuest({ name, email, provider, passHash }) {
      const a = readAccounts();
      const acc = a.users.find((u) => u.id === a.activeId);
      if (!acc) return null;
      acc.provider = provider || "email";
      acc.email = email;
      acc.name = name || acc.name;
      if (passHash) acc.passHash = passHash;
      writeAccounts(a);
      this.account = acc;
      this.set((s) => { s.profile.name = acc.name; });
      return acc;
    },

    // ---- data API ----
    load() {
      const a = readAccounts();
      this.account = a.users.find((u) => u.id === a.activeId) || null;
      if (!this.account) { this.state = null; return null; }
      try {
        const raw = localStorage.getItem(DATA_PREFIX + this.account.id);
        this.state = raw ? Object.assign(blankState(), JSON.parse(raw)) : blankState();
      } catch { this.state = blankState(); }
      // heal nested defaults
      const d = blankState();
      this.state.profile = Object.assign(d.profile, this.state.profile || {});
      this.state.profile.notif = Object.assign(d.profile.notif, this.state.profile.notif || {});
      this.state.streak = Object.assign(d.streak, this.state.streak || {});
      ["subjects","homework","exams","sessions","quizResults","plan","chats","scans","badges","friends","challenges"]
        .forEach((k) => { if (!Array.isArray(this.state[k])) this.state[k] = []; });
      return this.state;
    },

    save() {
      if (!this.account || !this.state) return;
      try {
        localStorage.setItem(DATA_PREFIX + this.account.id, JSON.stringify(this.state));
      } catch (e) {
        console.warn("StudyOS: save failed", e);
      }
      // Write through to SQLite when it is available. Batched: a burst of
      // saves during one interaction costs a single projection.
      if (global.Bridge && Bridge.enabled) {
        clearTimeout(this._projectTimer);
        this._projectTimer = setTimeout(() => {
          Bridge.project(this.account, this.state);
        }, 250);
      }
    },

    /**
     * Take over from a restored .sqlite file: register its account rows in
     * the local account list and make one of them active. Used after a
     * database import, where SQLite is the source of truth and localStorage
     * knows nothing about these profiles yet.
     */
    adoptFromDb(row) {
      const a = readAccounts();
      DB.all("SELECT * FROM accounts").forEach((r) => {
        const acc = {
          id: r.id, name: r.display_name, email: r.email, provider: r.provider,
          avatar: r.avatar, passHash: r.pass_hash, createdAt: r.created_at,
        };
        const i = a.users.findIndex((u) => u.id === acc.id);
        if (i >= 0) a.users[i] = acc; else a.users.push(acc);
      });
      a.activeId = row.id;
      writeAccounts(a);
      this.account = a.users.find((u) => u.id === row.id) || null;
      const s = Bridge.hydrate(row.id);
      this.state = s || blankState();
      localStorage.setItem(DATA_PREFIX + row.id, JSON.stringify(this.state));
      return this.state;
    },

    /** Recover state from the SQLite file when localStorage is empty. */
    hydrateFromDb() {
      if (!this.account || !global.Bridge || !Bridge.enabled) return false;
      const s = Bridge.hydrate(this.account.id);
      if (!s) return false;
      this.state = s;
      localStorage.setItem(DATA_PREFIX + this.account.id, JSON.stringify(s));
      return true;
    },

    /** Mutate + persist. Returns whatever fn returns. */
    set(fn) {
      const r = fn(this.state);
      this.save();
      return r;
    },

    export() { return JSON.stringify({ account: this.account, data: this.state }, null, 2); },

    /** Restore a .json backup. Returns false rather than throwing on junk. */
    import(json) {
      let parsed;
      try { parsed = JSON.parse(json); } catch { return false; }
      const data = parsed && (parsed.data || parsed);
      if (!data || typeof data !== "object" || !data.profile) return false;
      this.state = Object.assign(blankState(), data);
      // Heal nested defaults the same way load() does, so an old backup
      // missing newer keys can't leave the UI reading undefined.
      const d = blankState();
      this.state.profile = Object.assign(d.profile, this.state.profile || {});
      this.state.profile.notif = Object.assign(d.profile.notif, this.state.profile.notif || {});
      this.state.streak = Object.assign(d.streak, this.state.streak || {});
      ["subjects","homework","exams","sessions","quizResults","plan","chats","scans","badges","friends","challenges"]
        .forEach((k) => { if (!Array.isArray(this.state[k])) this.state[k] = []; });
      this.save();
      return true;
    },

    reset() {
      const keepName = this.state?.profile?.name;
      this.state = blankState();
      if (keepName) this.state.profile.name = keepName;
      this.state.profile.onboarded = true;
      this.save();
    },

    // ============================================================
    //  Derived data / domain logic
    // ============================================================
    todayMinutes() {
      const t = U.todayISO();
      return U.sum(this.state.sessions.filter((s) => s.dateISO === t), "minutes");
    },
    minutesOn(iso) { return U.sum(this.state.sessions.filter((s) => s.dateISO === iso), "minutes"); },
    goalPct() { return U.clamp(U.pct(this.todayMinutes(), this.state.profile.dailyGoalMin || 1), 0, 100); },

    allChapters() {
      const out = [];
      this.state.subjects.forEach((s) => s.chapters.forEach((c) => out.push({ subject: s, chapter: c })));
      return out;
    },
    findSubject(id) { return this.state.subjects.find((s) => s.id === id) || null; },
    findChapter(sid, cid) {
      const s = this.findSubject(sid);
      return s ? s.chapters.find((c) => c.id === cid) || null : null;
    },
    subjectAvg(s) { return U.avg(s.chapters.map((c) => c.progress)); },

    subjectRanking() {
      return this.state.subjects
        .map((s) => ({ id: s.id, name: s.name, emoji: s.emoji, avg: this.subjectAvg(s), chapters: s.chapters.length }))
        .sort((a, b) => b.avg - a.avg);
    },
    weakestChapters(n) {
      return this.allChapters().sort((a, b) => a.chapter.progress - b.chapter.progress).slice(0, n || 5);
    },

    /** Spaced-revision priority score: low progress + long gap + high difficulty ⇒ higher. */
    revisionQueue(n) {
      const today = U.todayISO();
      return this.allChapters()
        .map(({ subject, chapter }) => {
          const gap = chapter.lastRevised ? U.daysBetween(chapter.lastRevised, today) : 21;
          const score = (100 - chapter.progress) * 1.0 + Math.min(gap, 30) * 2.2 + (chapter.difficulty - 1) * 12;
          return { subject, chapter, gap, score: Math.round(score) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, n || 6);
    },

    pendingHomework() { return this.state.homework.filter((h) => h.status !== "done"); },
    overdueHomework() {
      const t = U.todayISO();
      return this.pendingHomework().filter((h) => h.due && U.daysBetween(t, h.due) < 0);
    },
    upcomingExams() {
      const t = U.todayISO();
      return this.state.exams
        .filter((e) => U.daysBetween(t, e.date) >= 0)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    planFor(iso) {
      return this.state.plan.filter((p) => p.dateISO === iso).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    },
    dueCards() {
      const t = U.todayISO();
      const out = [];
      this.allChapters().forEach(({ subject, chapter }) => {
        (chapter.cards || []).forEach((card) => {
          if (!card.due || U.daysBetween(t, card.due) <= 0) out.push({ subject, chapter, card });
        });
      });
      return out;
    },
    allCards() {
      const out = [];
      this.allChapters().forEach(({ subject, chapter }) => {
        (chapter.cards || []).forEach((card) => out.push({ subject, chapter, card }));
      });
      return out;
    },

    // ---- streaks ----
    currentStreak() {
      const last = this.state.streak.lastStudyDate;
      if (!last) return 0;
      const gap = U.daysBetween(last, U.todayISO());
      return gap <= 1 ? this.state.streak.count : 0;
    },
    bumpStreak() {
      const today = U.todayISO();
      this.set((s) => {
        const last = s.streak.lastStudyDate;
        if (last === today) return;
        if (last && U.daysBetween(last, today) === 1) s.streak.count += 1;
        else s.streak.count = 1;
        s.streak.lastStudyDate = today;
        s.streak.best = Math.max(s.streak.best || 0, s.streak.count);
      });
    },

    // ---- XP / levels ----
    LEVELS: [
      { name: "Beginner", min: 0, emoji: "🌱" },
      { name: "Learner", min: 250, emoji: "📖" },
      { name: "Scholar", min: 800, emoji: "🎓" },
      { name: "Expert", min: 2000, emoji: "🧠" },
      { name: "Master", min: 4500, emoji: "🏆" },
    ],
    levelInfo(xp) {
      xp = xp == null ? this.state.profile.xp : xp;
      let idx = 0;
      for (let i = 0; i < this.LEVELS.length; i++) if (xp >= this.LEVELS[i].min) idx = i;
      const cur = this.LEVELS[idx], next = this.LEVELS[idx + 1];
      const pct = next ? U.pct(xp - cur.min, next.min - cur.min) : 100;
      return { level: idx + 1, name: cur.name, emoji: cur.emoji, next, pct, toNext: next ? next.min - xp : 0 };
    },
    addXP(n) { this.set((s) => { s.profile.xp += n; }); return n; },

    // ---- badges ----
    BADGES: [
      { id: "first-session", emoji: "🎬", name: "First Session", desc: "Complete a study session", test: (s) => s.sessions.length >= 1 },
      { id: "streak-3",   emoji: "🔥", name: "On a Roll",     desc: "3-day streak",              test: (s) => (s.streak.best || 0) >= 3 },
      { id: "streak-7",   emoji: "⚡", name: "Week Warrior",  desc: "7-day streak",              test: (s) => (s.streak.best || 0) >= 7 },
      { id: "streak-30",  emoji: "💎", name: "Unstoppable",   desc: "30-day streak",             test: (s) => (s.streak.best || 0) >= 30 },
      { id: "hw-10",      emoji: "✅", name: "Task Crusher",  desc: "Finish 10 homework tasks",  test: (s) => s.homework.filter((h) => h.status === "done").length >= 10 },
      { id: "quiz-5",     emoji: "❓", name: "Quiz Curious",  desc: "Complete 5 quizzes",        test: (s) => s.quizResults.length >= 5 },
      { id: "perfect",    emoji: "🎯", name: "Flawless",      desc: "Score 100% on a quiz",      test: (s) => s.quizResults.some((r) => r.total && r.score === r.total) },
      { id: "notes-10",   emoji: "📝", name: "Note Taker",    desc: "Write 10 notes",            test: (s) => s.subjects.reduce((a, x) => a + x.chapters.reduce((b, c) => b + (c.notes || []).length, 0), 0) >= 10 },
      { id: "cards-25",   emoji: "🧠", name: "Card Shark",    desc: "Create 25 flashcards",      test: (s) => s.subjects.reduce((a, x) => a + x.chapters.reduce((b, c) => b + (c.cards || []).length, 0), 0) >= 25 },
      { id: "hours-10",   emoji: "⏳", name: "10 Hour Club",  desc: "Study 10 total hours",      test: (s) => U.sum(s.sessions, "minutes") >= 600 },
      { id: "mastery",    emoji: "🌟", name: "Topic Master",  desc: "Get a chapter to 100%",     test: (s) => s.subjects.some((x) => x.chapters.some((c) => c.progress >= 100)) },
      { id: "planner",    emoji: "📅", name: "Planner",       desc: "Schedule 5 study blocks",   test: (s) => s.plan.length >= 5 },
    ],
    /** Returns array of newly earned badge objects. */
    checkBadges() {
      const earned = [];
      this.BADGES.forEach((b) => {
        if (this.state.badges.includes(b.id)) return;
        let ok = false;
        try { ok = b.test(this.state); } catch { ok = false; }
        if (ok) { this.state.badges.push(b.id); earned.push(b); }
      });
      if (earned.length) this.save();
      return earned;
    },

    // ---- notifications (derived, not stored) ----
    notifications() {
      const s = this.state, out = [], t = U.todayISO();
      const n = s.profile.notif || {};
      if (n.homework) {
        this.overdueHomework().forEach((h) =>
          out.push({ ic: "⚠️", t: `${h.subject}: ${h.task}`, s: `Overdue — was due ${U.relDate(h.due)}.`, tone: "red", go: "homework" }));
        this.pendingHomework().filter((h) => h.due && U.daysBetween(t, h.due) === 1).forEach((h) =>
          out.push({ ic: "🔔", t: `${h.subject} due tomorrow`, s: h.task, tone: "yellow", go: "homework" }));
      }
      if (n.revision) {
        this.revisionQueue(2).forEach((r) => {
          if (r.gap >= 5) out.push({ ic: "🧠", t: `Revise ${r.chapter.name}`, s: `You haven't revised this in ${r.gap} days. ${r.chapter.progress}% understanding.`, tone: "brand", go: "revision" });
        });
      }
      if (n.goal) {
        const left = (s.profile.dailyGoalMin || 0) - this.todayMinutes();
        if (left > 0) out.push({ ic: "🎯", t: `${U.fmtMin(left)} left on today's goal`, s: "One focused session would close the gap.", tone: "brand", go: "timer" });
        else if (s.sessions.length) out.push({ ic: "🎉", t: "Daily goal complete", s: "Nice work. Anything more today is a bonus.", tone: "green", go: "progress" });
      }
      if (n.streak) {
        const st = this.currentStreak();
        if (st >= 2 && this.todayMinutes() === 0)
          out.push({ ic: "🔥", t: `Keep your ${st}-day streak alive`, s: "A short session today is enough.", tone: "yellow", go: "timer" });
      }
      this.upcomingExams().slice(0, 2).forEach((e) => {
        const d = U.daysBetween(t, e.date);
        if (d <= 7) {
          const left = e.syllabus.filter((x) => !x.done).length;
          out.push({ ic: "🧪", t: `${e.subject} test in ${d} day${d !== 1 ? "s" : ""}`, s: left ? `${left} syllabus topic${left !== 1 ? "s" : ""} still to cover.` : "Syllabus fully covered. Revise and relax.", tone: d <= 3 ? "red" : "yellow", go: "exams" });
        }
      });
      return out;
    },

    // ---- seeding ----
    seedDemo() {
      const mk = (name, difficulty, progress, revDaysAgo) => ({
        id: U.uid(), name, difficulty, progress,
        lastRevised: revDaysAgo == null ? null : U.addDays(U.todayISO(), -revDaysAgo),
        notes: [], cards: [],
      });
      const s = this.state;
      s.subjects = [
        { id: U.uid(), name: "Mathematics", emoji: "📐", chapters: [
          mk("Number Systems", 2, 86, 4), mk("Polynomials", 2, 92, 1),
          mk("Coordinate Geometry", 3, 41, 9), mk("Linear Equations", 3, 68, 6),
          mk("Statistics", 1, 55, 12) ] },
        { id: U.uid(), name: "Science", emoji: "🧪", chapters: [
          mk("Atoms & Molecules", 2, 74, 3), mk("Cell Structure", 1, 90, 1),
          mk("Chemical Reactions", 2, 63, 5), mk("Motion & Force", 3, 48, 8) ] },
        { id: U.uid(), name: "Social Science", emoji: "🌍", chapters: [
          mk("French Revolution", 2, 70, 7), mk("Physical Features of India", 1, 80, 2) ] },
        { id: U.uid(), name: "English", emoji: "📖", chapters: [
          mk("Grammar", 1, 88, 3), mk("Comprehension", 2, 72, 6) ] },
      ];
      // a couple of notes + cards so features aren't empty
      const math = s.subjects[0], sci = s.subjects[1];
      math.chapters[1].notes.push({ id: U.uid(), title: "Degree of a polynomial", body: "The degree is the highest power of the variable.\n\n3x² + 2x + 1 → degree 2.", pinned: true, ts: Date.now() });
      sci.chapters[1].notes.push({ id: U.uid(), title: "Cell basics", body: "The cell is the basic structural and functional unit of life.\nProkaryotic: no true nucleus.\nEukaryotic: true nucleus.", pinned: false, ts: Date.now() });
      sci.chapters[1].cards.push(
        { id: U.uid(), front: "What is the basic unit of life?", back: "The cell.", box: 1, due: U.todayISO() },
        { id: U.uid(), front: "Which organelle is the powerhouse of the cell?", back: "The mitochondrion.", box: 1, due: U.todayISO() }
      );
      math.chapters[1].cards.push(
        { id: U.uid(), front: "Degree of 3x² + 2x + 1?", back: "2", box: 1, due: U.todayISO() }
      );

      const t = U.todayISO();
      s.homework = [
        { id: U.uid(), subject: "Mathematics", task: "10 problems — Linear Equations", due: t, priority: "High", status: "todo", createdAt: Date.now() },
        { id: U.uid(), subject: "Science", task: "Complete worksheet on Atoms", due: U.addDays(t, 1), priority: "High", status: "todo", createdAt: Date.now() },
        { id: U.uid(), subject: "Social Science", task: "Revise French Revolution timeline", due: U.addDays(t, 2), priority: "Medium", status: "progress", createdAt: Date.now() },
        { id: U.uid(), subject: "English", task: "Write a 200-word paragraph", due: U.addDays(t, -1), priority: "Low", status: "todo", createdAt: Date.now() },
      ];
      s.exams = [
        { id: U.uid(), subject: "Science", date: U.addDays(t, 3), syllabus: [
          { topic: "Atoms & Molecules", done: true }, { topic: "Cell Structure", done: true },
          { topic: "Chemical Reactions", done: false }, { topic: "Motion & Force", done: false } ] },
        { id: U.uid(), subject: "Mathematics", date: U.addDays(t, 13), syllabus: [
          { topic: "Number Systems", done: true }, { topic: "Polynomials", done: true },
          { topic: "Coordinate Geometry", done: false }, { topic: "Statistics", done: false } ] },
      ];
      // session history for streak + charts
      const hist = [1, 2, 4, 5, 6, 8, 9, 11, 12, 13];
      hist.forEach((d, i) => {
        s.sessions.push({ id: U.uid(), dateISO: U.addDays(t, -d), minutes: [25, 50, 25, 75, 45][i % 5],
          subject: ["Mathematics", "Science", "English", "Mathematics", "Social Science"][i % 5],
          chapter: "", confidence: (i % 4) + 1, mode: "pomodoro" });
      });
      s.quizResults = [
        { id: U.uid(), dateISO: U.addDays(t, -2), subject: "Science", score: 4, total: 5, wrong: [] },
        { id: U.uid(), dateISO: U.addDays(t, -5), subject: "Mathematics", score: 2, total: 5, wrong: [] },
      ];
      s.plan = [
        { id: U.uid(), dateISO: t, start: "16:00", end: "16:45", subject: "Mathematics", chapter: "Coordinate Geometry", note: "", done: false },
        { id: U.uid(), dateISO: t, start: "17:00", end: "17:45", subject: "Science", chapter: "Chemical Reactions", note: "", done: false },
        { id: U.uid(), dateISO: U.addDays(t, 1), start: "16:30", end: "17:15", subject: "English", chapter: "Comprehension", note: "", done: false },
      ];
      s.friends = [
        { id: U.uid(), name: "Meera", avatar: "🦊", xp: 1420, minutes: 640 },
        { id: U.uid(), name: "Rohan", avatar: "🐼", xp: 980, minutes: 410 },
        { id: U.uid(), name: "Ishita", avatar: "🐨", xp: 2310, minutes: 880 },
      ];
      s.challenges = [
        { id: U.uid(), title: "7-Day Study Challenge", goal: 7, unit: "days", progress: 4, endsOn: U.addDays(t, 3), friends: ["Meera", "Rohan"] },
        { id: U.uid(), title: "100 Questions Challenge", goal: 100, unit: "questions", progress: 38, endsOn: U.addDays(t, 10), friends: ["Ishita"] },
      ];
      s.streak = { lastStudyDate: U.addDays(t, -1), count: 4, best: 9 };
      s.profile.xp = 640;
      this.save();
    },
  };

  global.Store = Store;
  global.blankState = blankState;
})(window);
