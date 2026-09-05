/* ============================================================
   StudyOS — pages-study.js
   Timer, Planner, Quiz, Flashcards, Revision, Tutor, Scan.
   ============================================================ */
(function (global) {
  "use strict";

  const P = {};

  // ============================================================
  //  STUDY TIMER
  // ============================================================
  const MODES = {
    pomodoro: { study: 25, brk: 5, label: "Pomodoro", desc: "25 min focus · 5 min break" },
    deep:     { study: 50, brk: 10, label: "Deep Work", desc: "50 min focus · 10 min break" },
    custom:   { study: 30, brk: 5, label: "Custom", desc: "Your own durations" },
  };
  const T = {
    mode: "pomodoro", running: false, onBreak: false,
    total: 25 * 60, remaining: 25 * 60, interval: null,
    subject: "", chapter: "", sessionsToday: 0,
  };
  P.T = T; P.MODES = MODES;

  P.timer = function () {
    const m = MODES[T.mode];
    const mm = String(Math.floor(T.remaining / 60)).padStart(2, "0");
    const ss = String(T.remaining % 60).padStart(2, "0");
    const pct = T.total ? Math.round(((T.total - T.remaining) / T.total) * 100) : 0;
    const today = Store.state.sessions.filter((x) => x.dateISO === U.todayISO());

    return `
    <div class="page-head">
      <div><div class="page-title">Study Timer</div>
        <div class="page-sub">${T.onBreak ? "Break time — step away from the screen 🌿" : T.running ? "Focus mode. You've got this." : "Pick a mode and what you're studying."}</div></div>
      <span class="pill ${T.running ? "green" : "grey"}">${T.running ? (T.onBreak ? "● break" : "● running") : "paused"}</span>
    </div>

    <div class="grid g-14-1">
      <div class="card center-txt">
        <div class="mode-tabs">
          ${Object.keys(MODES).map((k) => `<button class="mode-tab ${T.mode === k ? "active" : ""}" data-timer-mode="${k}" ${T.running ? "disabled" : ""}>${MODES[k].label}</button>`).join("")}
        </div>

        ${T.mode === "custom" && !T.running ? `
          <div class="row" style="max-width:260px;margin:0 auto 16px">
            <div><label>Focus min</label><input type="number" id="c-study" min="5" max="180" value="${MODES.custom.study}" /></div>
            <div><label>Break min</label><input type="number" id="c-break" min="1" max="60" value="${MODES.custom.brk}" /></div>
          </div>` : ""}

        <div class="timer-display" style="color:${T.onBreak ? "var(--green)" : "var(--text)"}">${mm}:${ss}</div>
        <div style="max-width:320px;margin:16px auto">${UI.bar(pct, { color: T.onBreak ? "var(--green)" : null })}</div>

        <div style="max-width:340px;margin:0 auto 16px;text-align:left">
          <div class="field"><label>What are you studying?</label>
            ${UI.subjectSelect("t-subject", T.subject, { extra: ["General"] })}</div>
          <div class="field" style="margin:0"><label>Chapter (optional)</label>
            <div id="t-chapter-wrap">${UI.chapterSelect("t-chapter", T.subject || (Store.state.subjects[0] || {}).name, T.chapter)}</div></div>
        </div>

        <div class="flex gap12" style="justify-content:center">
          <button class="btn primary lg" data-timer-toggle>${T.running ? "⏸ Pause" : "▶ Start"}</button>
          <button class="btn lg" data-timer-reset>↺ Reset</button>
          ${!T.onBreak && T.running === false && T.remaining < T.total ? `<button class="btn lg" data-timer-finish>✓ Log ${Math.round((T.total - T.remaining) / 60)}m</button>` : ""}
        </div>
        <p class="faint f12 mt16">${m.desc} · +50 XP per completed session</p>
      </div>

      <div>
        <div class="card mb16">
          <h3>📋 Today's sessions</h3>
          <div class="b8" style="font-size:27px">${U.fmtMin(Store.todayMinutes())}</div>
          <div class="muted f12 mb12">${today.length} session${today.length !== 1 ? "s" : ""} logged</div>
          ${today.length ? today.slice().reverse().map((x) => `
            <div class="item" style="padding:8px 11px">
              <div class="grow"><div class="t f13">${U.esc(x.subject || "General")}</div>
                <div class="s">${U.fmtMin(x.minutes)}${x.chapter ? ` · ${U.esc(x.chapter)}` : ""}</div></div>
              <span class="pill grey">${["", "😕", "😐", "🙂", "🔥"][x.confidence || 3]}</span>
            </div>`).join("") : UI.emptyMini("⏱️", "No sessions yet today")}
        </div>
        <div class="card">
          <h3>💡 Focus tips</h3>
          <ul class="muted f13" style="padding-left:18px;line-height:1.85">
            <li>Put your phone in another room, not just face down.</li>
            <li>Write the single question you want answered by the end.</li>
            <li>When stuck, note the sticking point and move on — come back.</li>
            <li>Take the break. Skipping it costs you the next session.</li>
          </ul>
        </div>
      </div>
    </div>`;
  };

  P.timerTick = function () {
    if (T.remaining > 0) {
      T.remaining--;
      const el = document.querySelector(".timer-display");
      if (!el) { clearInterval(T.interval); T.interval = null; return; }
      el.textContent = `${String(Math.floor(T.remaining / 60)).padStart(2, "0")}:${String(T.remaining % 60).padStart(2, "0")}`;
      const bar = document.querySelector(".timer-display + div .bar > span");
      if (bar) bar.style.width = Math.round(((T.total - T.remaining) / T.total) * 100) + "%";
      return;
    }
    clearInterval(T.interval); T.interval = null; T.running = false;
    if (!T.onBreak) {
      const mins = Math.round(T.total / 60);
      P.logSession(T.subject, T.chapter, mins);
      P.askConfidence(mins);
      T.onBreak = true; T.total = MODES[T.mode].brk * 60; T.remaining = T.total;
      P.chime();
    } else {
      T.onBreak = false; T.total = MODES[T.mode].study * 60; T.remaining = T.total;
      UI.toast("Break over — ready for another round?");
      P.chime();
    }
    App.render();
  };

  P.chime = function () {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 660; o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      o.start(); o.stop(ctx.currentTime + 0.95);
    } catch { /* audio blocked — no problem */ }
  };

  P.logSession = function (subject, chapter, minutes) {
    Store.set((s) => s.sessions.push({
      id: U.uid(), dateISO: U.todayISO(), minutes,
      subject: subject || "General", chapter: chapter || "", confidence: 3, mode: T.mode,
    }));
    Store.bumpStreak();
    App.award(50, "Study session");
    // nudge chapter progress + revision date
    if (subject && chapter) {
      const subj = Store.state.subjects.find((x) => x.name === subject);
      const ch = subj && subj.chapters.find((c) => c.name === chapter);
      if (ch) Store.set(() => { ch.progress = U.clamp(ch.progress + 3, 0, 100); ch.lastRevised = U.todayISO(); });
    }
  };

  P.askConfidence = function (mins) {
    UI.open(`
      <h2>How confident are you?</h2>
      <p class="muted f13 mb16">You studied ${U.esc(T.subject || "General")}${T.chapter ? ` — ${U.esc(T.chapter)}` : ""} for ${mins} minutes. This tunes your revision queue.</p>
      <div class="flex gap8">
        ${[["😕", 1, "Low"], ["😐", 2, "Okay"], ["🙂", 3, "Good"], ["🔥", 4, "Excellent"]].map(([e, v, l]) =>
          `<button class="btn" style="flex:1;flex-direction:column;font-size:23px;padding:13px 4px" data-confidence="${v}">${e}<span class="f11 b7">${l}</span></button>`).join("")}
      </div>`);
    document.querySelectorAll("[data-confidence]").forEach((el) => el.onclick = () => {
      const v = parseInt(el.dataset.confidence, 10);
      Store.set((s) => {
        const last = s.sessions[s.sessions.length - 1];
        if (last) last.confidence = v;
        if (last && last.subject && last.chapter) {
          const subj = s.subjects.find((x) => x.name === last.subject);
          const ch = subj && subj.chapters.find((c) => c.name === last.chapter);
          if (ch) ch.progress = U.clamp(ch.progress + (v - 2) * 3, 0, 100);
        }
      });
      UI.close();
      UI.toast(v >= 3 ? "Logged. Nice session." : "Logged — I'll queue this topic sooner.");
      App.render();
    });
  };

  // ============================================================
  //  PLANNER
  // ============================================================
  P.planner = function () {
    const weekStart = App.route.weekStart || U.weekStart();
    const days = Array.from({ length: 7 }, (_, i) => U.addDays(weekStart, i));
    const today = U.todayISO();
    const weekBlocks = Store.state.plan.filter((p) => days.includes(p.dateISO));
    const totalMin = weekBlocks.reduce((a, b) => a + blockMinutes(b), 0);
    const doneMin = weekBlocks.filter((b) => b.done).reduce((a, b) => a + blockMinutes(b), 0);

    return `
    <div class="page-head">
      <div><div class="page-title">Study Planner</div>
        <div class="page-sub">${U.fmtDate(days[0])} – ${U.fmtDate(days[6])} · ${U.fmtMin(totalMin)} planned · ${U.fmtMin(doneMin)} done</div></div>
      <div class="flex gap8">
        <button class="btn sm" data-week-shift="-1">←</button>
        <button class="btn sm" data-week-shift="0">This week</button>
        <button class="btn sm" data-week-shift="1">→</button>
        <button class="btn" data-auto-plan>✨ Auto-plan today</button>
        <button class="btn primary" data-add-block>+ Add block</button>
      </div>
    </div>

    ${UI.insight(planAdvice(), "", "🧭")}
    <div class="mb16"></div>

    <div class="week-grid">
      ${days.map((d) => {
        const blocks = Store.planFor(d);
        return `<div class="day-col ${d === today ? "today" : ""}">
          <div class="day-name">${U.dayName(d)} ${new Date(d + "T12:00:00").getDate()}</div>
          ${blocks.map((b) => `
            <div class="block ${b.done ? "done" : ""}">
              <button class="icon-btn x" data-del-block="${b.id}">✕</button>
              <div class="bt">${U.esc(b.subject)}</div>
              ${b.chapter ? `<div class="bs">${U.esc(b.chapter)}</div>` : ""}
              <div class="bs">${U.esc(b.start)}–${U.esc(b.end)}</div>
              ${b.note ? `<div class="bs" style="color:var(--brand)">${U.esc(b.note)}</div>` : ""}
              <button class="btn sm mt8" style="width:100%;padding:3px" data-plan-toggle="${b.id}">${b.done ? "✓ Done" : "Mark done"}</button>
            </div>`).join("")}
          <button class="btn sm block" style="border-style:dashed;padding:5px" data-add-block-on="${d}">+</button>
        </div>`;
      }).join("")}
    </div>`;
  };
  function blockMinutes(b) {
    const [h1, m1] = String(b.start || "0:0").split(":").map(Number);
    const [h2, m2] = String(b.end || "0:0").split(":").map(Number);
    return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
  }
  P.blockMinutes = blockMinutes;

  function planAdvice() {
    const exams = Store.upcomingExams();
    const soon = exams.filter((e) => U.daysBetween(U.todayISO(), e.date) <= 7);
    if (soon.length) {
      const e = soon[0];
      const left = e.syllabus.filter((x) => !x.done).length;
      return `<b>${e.subject} exam in ${U.daysBetween(U.todayISO(), e.date)} days.</b> ${left ? `Front-load ${e.subject} — ${left} topic${left !== 1 ? "s" : ""} still uncovered.` : "Syllabus is covered; schedule quiz and flashcard blocks rather than fresh reading."}`;
    }
    const q = Store.revisionQueue(1)[0];
    if (q) return `Your weakest topic is <b>${U.esc(q.subject.name)} — ${U.esc(q.chapter.name)}</b> at ${q.chapter.progress}%. Give it two blocks this week rather than one long one; spacing beats cramming.`;
    return "Add subjects and chapters, then use Auto-plan to have StudyOS build blocks around your weak topics and exams.";
  }

  // ============================================================
  //  QUIZ
  // ============================================================
  let quiz = null;
  P.getQuiz = () => quiz;
  P.setQuiz = (q) => { quiz = q; };

  P.quiz = function () {
    if (quiz) return quiz.finished ? quizResults() : quizRunner();
    const s = Store.state;
    const subjects = Store.state.subjects.map((x) => x.name);
    const banks = Tutor.subjectsWithBank();
    const all = Array.from(new Set(subjects.concat(banks)));

    return `
    <div class="page-head">
      <div><div class="page-title">Quizzes</div>
        <div class="page-sub">Test yourself — results feed straight into your weak-topic tracking</div></div>
    </div>

    <div class="card mb16">
      <div class="card-hd"><h3>❓ Generate a quiz</h3></div>
      <div class="row mb12" style="flex-wrap:wrap">
        <div class="field" style="margin:0"><label>Subject</label>
          <select id="q-subject">${all.map((n) => `<option>${U.esc(n)}</option>`).join("")}</select></div>
        <div class="field" style="margin:0"><label>Chapter (optional)</label>
          <div id="q-chapter-wrap">${UI.chapterSelect("q-chapter", all[0], "")}</div></div>
        <div class="field" style="margin:0"><label>Questions</label>
          <select id="q-count"><option>5</option><option>10</option><option>12</option></select></div>
        <div class="field" style="margin:0"><label>Difficulty</label>
          <select id="q-diff"><option value="easy">🟢 Easy</option><option value="medium" selected>🟡 Medium</option><option value="hard">🔴 Hard</option></select></div>
      </div>
      <button class="btn primary" data-gen-quiz>Start quiz →</button>
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>⚡ Quick start</h3>
        <div class="chip-grid">
          ${banks.slice(0, 4).map((sub) => `
            <div class="subject-card" data-quick-quiz="${U.esc(sub)}">
              <div class="subject-emoji">${sub === "Mathematics" ? "📐" : sub === "Science" ? "🧪" : sub === "English" ? "📖" : sub === "Social Science" ? "🌍" : "🎯"}</div>
              <div class="subject-name" style="font-size:14px">${U.esc(sub)}</div>
              <div class="muted f12 mt4">${Tutor.bankFor(sub).length} questions</div>
            </div>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>📊 Recent results</h3>
          ${s.quizResults.length ? `<span class="pill brand">${U.pct(U.sum(s.quizResults, "score"), U.sum(s.quizResults, "total"))}% overall</span>` : ""}</div>
        ${s.quizResults.length ? s.quizResults.slice().reverse().slice(0, 6).map((r) => `
          <div class="item" style="padding:9px 11px">
            <div class="grow"><div class="t f13">${U.esc(r.subject)}${r.chapter ? ` — ${U.esc(r.chapter)}` : ""}</div>
              <div class="s">${U.fmtDate(r.dateISO)}</div></div>
            <span class="pill ${U.gradeBand(U.pct(r.score, r.total))}">${r.score}/${r.total}</span>
          </div>`).join("") : UI.emptyMini("📊", "No quiz results yet")}
      </div>
    </div>`;
  };

  function quizRunner() {
    const total = quiz.questions.length;
    const cur = quiz.questions[quiz.idx];
    return `
    <div class="page-head">
      <div><div class="page-title">${U.esc(quiz.subject)}${quiz.chapter ? ` — ${U.esc(quiz.chapter)}` : ""}</div>
        <div class="page-sub">Question ${quiz.idx + 1} of ${total} · score ${quiz.score}</div></div>
      <button class="btn ghost" data-quiz-exit>Exit</button>
    </div>
    <div style="max-width:620px">${UI.bar(Math.round((quiz.idx / total) * 100))}</div>
    <div class="card mt16" style="max-width:620px">
      <h3 style="font-size:17.5px;line-height:1.5;margin-bottom:18px">${U.esc(cur.q)}</h3>
      ${cur.opts.map((o, i) => {
        let cls = "quiz-opt";
        if (quiz.answered != null) { if (i === cur.a) cls += " correct"; else if (i === quiz.answered) cls += " wrong"; }
        return `<button class="${cls}" ${quiz.answered != null ? "disabled" : ""} data-quiz-answer="${i}">
          <b style="color:var(--muted);margin-right:8px">${String.fromCharCode(65 + i)}</b>${U.esc(o)}</button>`;
      }).join("")}
      ${quiz.answered != null ? `
        <div class="mt16">${UI.insight(
          `${quiz.answered === cur.a ? "<b>Correct.</b>" : `<b>Not quite</b> — the answer is <b>${U.esc(cur.opts[cur.a])}</b>.`} ${U.esc(cur.why || "")}`,
          quiz.answered === cur.a ? "good" : "warn", quiz.answered === cur.a ? "✅" : "💡")}</div>
        <button class="btn primary mt16" data-quiz-next>${quiz.idx + 1 >= total ? "See results →" : "Next question →"}</button>` : ""}
    </div>`;
  }

  function quizResults() {
    const total = quiz.questions.length;
    const pct = U.pct(quiz.score, total);
    return `
    <div class="page-head"><div><div class="page-title">Quiz complete</div>
      <div class="page-sub">${U.esc(quiz.subject)}${quiz.chapter ? ` — ${U.esc(quiz.chapter)}` : ""}</div></div></div>
    <div class="card" style="max-width:560px">
      <div class="center-txt">
        <div style="font-size:46px">${pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚"}</div>
        <div class="b8" style="font-size:34px;margin:6px 0">${quiz.score} / ${total}</div>
        <div class="muted f14">${pct}% correct</div>
      </div>
      <div class="mt16">${UI.insight(
        pct >= 80 ? "<b>Strong recall.</b> Space your next review a few days out rather than repeating this now."
          : pct >= 50 ? "<b>Halfway there.</b> Review the questions you missed, then retake this in two days."
          : "<b>This topic needs revising, not more testing.</b> Reread your notes, rewrite the key ideas from memory, then come back.",
        pct >= 80 ? "good" : "warn", pct >= 80 ? "✅" : "🎯")}</div>

      ${quiz.wrong.length ? `<div class="mt16"><h3>Questions to review</h3>
        ${quiz.wrong.map((w) => `<div class="item" style="align-items:flex-start">
          <div class="grow"><div class="t f13">${U.esc(w.q)}</div>
            <div class="s mt4">Answer: <b style="color:var(--green)">${U.esc(w.answer)}</b>${w.why ? ` · ${U.esc(w.why)}` : ""}</div></div>
        </div>`).join("")}
        <button class="btn sm block mt12" data-cards-from-wrong>✨ Turn these into flashcards</button></div>` : ""}

      <div class="flex gap8 mt16">
        <button class="btn primary grow" data-retake-quiz>Retake</button>
        <button class="btn grow" data-quiz-exit>Done</button>
      </div>
    </div>`;
  }

  P.startQuiz = function (opts) {
    const q = Tutor.makeQuiz(opts);
    quiz = { subject: q.subject, chapter: q.chapter, difficulty: q.difficulty, questions: q.questions, idx: 0, score: 0, answered: null, wrong: [], finished: false };
    App.go("quiz");
  };
  P.answerQuiz = function (i) {
    if (!quiz || quiz.answered != null) return;
    quiz.answered = i;
    const cur = quiz.questions[quiz.idx];
    if (i === cur.a) quiz.score++;
    else quiz.wrong.push({ q: cur.q, answer: cur.opts[cur.a], why: cur.why });
    App.render();
  };
  P.nextQuiz = function () {
    if (!quiz) return;
    quiz.idx++; quiz.answered = null;
    if (quiz.idx >= quiz.questions.length) {
      quiz.finished = true;
      Store.set((s) => s.quizResults.push({
        id: U.uid(), dateISO: U.todayISO(), subject: quiz.subject, chapter: quiz.chapter,
        score: quiz.score, total: quiz.questions.length,
        wrong: quiz.wrong.map((w) => w.q),
      }));
      // feed the chapter's progress from the score
      if (quiz.chapter) {
        const subj = Store.state.subjects.find((x) => x.name === quiz.subject);
        const ch = subj && subj.chapters.find((c) => c.name === quiz.chapter);
        if (ch) Store.set(() => {
          const scorePct = U.pct(quiz.score, quiz.questions.length);
          ch.progress = U.clamp(Math.round(ch.progress * 0.7 + scorePct * 0.3), 0, 100);
          ch.lastRevised = U.todayISO();
        });
      }
      App.award(40, "Quiz finished");
    }
    App.render();
  };

  // ============================================================
  //  FLASHCARDS
  // ============================================================
  let deck = null; // { items:[{subject,chapter,card}], idx, revealed, stats:{} }
  P.getDeck = () => deck;

  P.flashcards = function () {
    if (deck) return deckRunner();
    const due = Store.dueCards();
    const all = Store.allCards();
    const bySubject = U.groupBy(all, (x) => x.subject.name);

    return `
    <div class="page-head">
      <div><div class="page-title">Flashcards</div>
        <div class="page-sub">${all.length} card${all.length !== 1 ? "s" : ""} total · ${due.length} due for review</div></div>
      <div class="flex gap8">
        ${all.length ? `<button class="btn" data-review-all>Review all</button>` : ""}
        ${due.length ? `<button class="btn primary" data-review-due>Review ${due.length} due →</button>` : ""}
      </div>
    </div>

    ${!all.length ? UI.empty("🧠", "No flashcards yet",
        "Create cards by hand, or let StudyOS generate them from any note. Cards use spaced repetition — the ones you find hard come back sooner.",
        `<button class="btn primary" data-nav="subjects">Go to a chapter</button>`)
      : `
      ${due.length ? UI.insight(`<b>${due.length} card${due.length !== 1 ? "s are" : " is"} due today.</b> Cards you rate as "didn't know" return tomorrow; ones you know get pushed further out.`, "", "🔁") + '<div class="mb16"></div>' : ""}
      <div class="grid g2">
        ${Object.keys(bySubject).map((name) => {
          const items = bySubject[name];
          const dueN = items.filter((x) => !x.card.due || U.daysBetween(U.todayISO(), x.card.due) <= 0).length;
          return `<div class="card">
            <div class="card-hd"><h3>${U.esc(items[0].subject.emoji)} ${U.esc(name)}</h3>
              <span class="pill ${dueN ? "brand" : "grey"}">${dueN} due</span></div>
            <div class="muted f13 mb12">${items.length} card${items.length !== 1 ? "s" : ""} across ${new Set(items.map((x) => x.chapter.name)).size} chapter${new Set(items.map((x) => x.chapter.name)).size !== 1 ? "s" : ""}</div>
            <button class="btn sm block" data-review-subject="${U.esc(name)}">Review ${name}</button>
          </div>`;
        }).join("")}
      </div>`}`;
  };

  function deckRunner() {
    if (deck.idx >= deck.items.length) {
      const s = deck.stats;
      const tot = s.hard + s.ok + s.easy;
      return `
      <div class="page-head"><div><div class="page-title">Deck complete</div>
        <div class="page-sub">${tot} card${tot !== 1 ? "s" : ""} reviewed</div></div></div>
      <div class="card" style="max-width:480px">
        <div class="center-txt"><div style="font-size:44px">🎉</div>
          <div class="b8 mt8" style="font-size:22px">Nice work</div></div>
        <div class="stat-row mt16" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat" style="box-shadow:none"><div class="k">😵 Didn't know</div><div class="v">${s.hard}</div></div>
          <div class="stat" style="box-shadow:none"><div class="k">😐 Almost</div><div class="v">${s.ok}</div></div>
          <div class="stat" style="box-shadow:none"><div class="k">🔥 Knew it</div><div class="v">${s.easy}</div></div>
        </div>
        <div class="mt16">${UI.insight(
          s.hard > tot / 2
            ? "<b>More than half were hard.</b> Read the source notes again before your next review — cards can't teach what you haven't learned yet."
            : "<b>Good session.</b> The cards you struggled with are scheduled for tomorrow; the rest are pushed further out.",
          s.hard > tot / 2 ? "warn" : "good", s.hard > tot / 2 ? "📚" : "✅")}</div>
        <button class="btn primary block mt16" data-deck-exit>Done</button>
      </div>`;
    }
    const it = deck.items[deck.idx];
    return `
    <div class="page-head">
      <div><div class="page-title">${U.esc(it.subject.name)}</div>
        <div class="page-sub">${U.esc(it.chapter.name)} · card ${deck.idx + 1} of ${deck.items.length}</div></div>
      <button class="btn ghost" data-deck-exit>Exit</button>
    </div>
    <div class="fc-stage">
      ${UI.bar(Math.round((deck.idx / deck.items.length) * 100))}
      <div class="fc-card mt16" data-fc-flip>
        <div>
          <div class="fc-side-label">${deck.revealed ? "Answer" : "Question"}</div>
          <div class="fc-text">${U.esc(deck.revealed ? it.card.back : it.card.front)}</div>
          ${!deck.revealed ? `<div class="faint f12 mt16">Tap the card to reveal</div>` : ""}
        </div>
      </div>
      ${deck.revealed ? `
        <div class="fc-rate">
          <button class="btn" data-fc-rate="hard">😵<span>Didn't know</span></button>
          <button class="btn" data-fc-rate="ok">😐<span>Almost</span></button>
          <button class="btn" data-fc-rate="easy">🔥<span>Knew it</span></button>
        </div>`
        : `<button class="btn primary block lg mt16" data-fc-flip>Reveal answer</button>`}
    </div>`;
  }

  P.startDeck = function (items) {
    if (!items.length) return UI.toast("No cards to review");
    deck = { items: U.shuffle(items), idx: 0, revealed: false, stats: { hard: 0, ok: 0, easy: 0 } };
    App.go("flashcards");
  };
  P.flipCard = function () { if (deck) { deck.revealed = !deck.revealed; App.render(); } };
  P.rateCard = function (rating) {
    if (!deck) return;
    const it = deck.items[deck.idx];
    const boxes = { hard: 1, ok: 2, easy: 3 };
    const intervals = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };
    Store.set(() => {
      const card = it.card;
      card.box = rating === "hard" ? 1 : U.clamp((card.box || 1) + (rating === "easy" ? 2 : 1), 1, 5);
      card.due = U.addDays(U.todayISO(), intervals[card.box] || 1);
      card.lastSeen = U.todayISO();
    });
    deck.stats[rating]++;
    deck.idx++; deck.revealed = false;
    if (deck.idx >= deck.items.length) App.award(20, "Deck reviewed");
    App.render();
    void boxes;
  };
  P.exitDeck = function () { deck = null; App.render(); };

  // ============================================================
  //  SMART REVISION
  // ============================================================
  P.revision = function () {
    const queue = Store.revisionQueue(10);
    const due = Store.dueCards();
    return `
    <div class="page-head">
      <div><div class="page-title">Smart Revision</div>
        <div class="page-sub">Ranked by weakness, time since last review, and difficulty</div></div>
      ${due.length ? `<button class="btn primary" data-review-due>🧠 ${due.length} cards due</button>` : ""}
    </div>

    ${UI.insight(
      "StudyOS doesn't ask you to revise everything. Priority rises when understanding is low, the gap since your last review is long, or you marked the chapter hard. Revise the top two or three — that's the whole point.",
      "", "🔁")}
    <div class="mb16"></div>

    ${queue.length ? `<div class="card">
      <div class="card-hd"><h3>📋 Today's revision queue</h3></div>
      ${queue.map((r, i) => `
        <div class="item">
          <div class="lb-rank">${i + 1}</div>
          <div class="grow">
            <div class="t">${U.gradeDot(r.chapter.progress)} ${U.esc(r.subject.name)} — ${U.esc(r.chapter.name)}</div>
            <div class="s">${r.chapter.progress}% understanding · ${r.gap >= 21 ? "never revised" : `last revised ${r.gap} day${r.gap !== 1 ? "s" : ""} ago`} · ${U.diffLabel(r.chapter.difficulty)}</div>
          </div>
          <span class="pill ${i < 2 ? "red" : i < 5 ? "yellow" : "grey"}">${i < 2 ? "high" : i < 5 ? "medium" : "low"}</span>
          <button class="btn sm" data-study-chapter="${r.subject.id}|${r.chapter.id}">Study</button>
          <button class="btn sm" data-quiz-chapter="${r.subject.id}|${r.chapter.id}">Quiz</button>
        </div>`).join("")}
    </div>` : UI.empty("🔁", "Nothing to revise yet", "Add chapters and study a few sessions — StudyOS then builds your revision order automatically.")}

    ${queue.length ? `<div class="card mt16">
      <h3>🎯 Suggested 60-minute revision block</h3>
      <div class="muted f13" style="line-height:1.9">
        <b>0–20 min</b> · ${U.esc(queue[0].subject.name)} — ${U.esc(queue[0].chapter.name)}: reread notes, then write the key ideas from memory<br>
        <b>20–35 min</b> · 5 practice questions on the same topic<br>
        <b>35–45 min</b> · quiz yourself in StudyOS to check it stuck<br>
        ${queue[1] ? `<b>45–60 min</b> · quick pass over ${U.esc(queue[1].chapter.name)} flashcards` : ""}
      </div>
      <div class="flex gap8 mt16">
        <button class="btn primary" data-study-chapter="${queue[0].subject.id}|${queue[0].chapter.id}">⏱️ Start block</button>
        <button class="btn" data-auto-plan>📅 Add to planner</button>
      </div>
    </div>` : ""}`;
  };

  // ============================================================
  //  AI TUTOR (offline)
  // ============================================================
  P.tutor = function () {
    const chats = Store.state.chats;
    return `
    <div class="page-head">
      <div><div class="page-title">Study Tutor</div>
        <div class="page-sub">Runs offline on this device · explains, hints, and quizzes you</div></div>
      <div class="flex gap8">
        ${chats.length ? `<button class="btn sm ghost" data-clear-chat>Clear</button>` : ""}
      </div>
    </div>

    <div class="card chat-wrap">
      <div class="chat-log" id="chatLog">
        ${!chats.length ? `
          <div class="msg bot">
            <div class="msg-hd">StudyOS Tutor</div>
            Hey${Store.state.profile.name ? " " + U.esc(Store.state.profile.name) : ""}. I'm your offline study tutor — no internet needed, so nothing you type leaves this device.

I'm best at four things:
• <b>Explaining a topic</b> at whatever level you ask for
• <b>Giving hints instead of answers</b>, so you actually learn it
• <b>Setting quizzes</b> that feed into your weak-topic tracking
• <b>Telling you what to study next</b> based on your own data

Try one of the prompts below.
          </div>` : chats.map((m) => `
          <div class="msg ${m.role}">
            ${m.role === "bot" ? '<div class="msg-hd">StudyOS Tutor</div>' : ""}
            ${m.role === "bot" ? U.mini(m.text) : U.esc(m.text)}
          </div>`).join("")}
      </div>
      <div>
        <div class="suggest-row">
          ${Tutor.starterPrompts().map((p) => `<button class="suggest" data-suggest="${U.esc(p)}">${U.esc(p)}</button>`).join("")}
        </div>
        <div class="chat-input">
          <textarea id="chatInput" rows="1" placeholder="Ask anything — a topic, a problem, or what to study next..."></textarea>
          <button class="btn primary" data-chat-send>Send</button>
        </div>
      </div>
    </div>`;
  };

  P.sendChat = async function (text) {
    const msg = String(text || "").trim();
    if (!msg) return;
    Store.set((s) => s.chats.push({ id: U.uid(), role: "user", text: msg, ts: Date.now() }));
    App.render();
    P.scrollChat();

    const log = document.getElementById("chatLog");
    if (log) {
      const t = document.createElement("div");
      t.className = "msg bot typing";
      t.innerHTML = '<div class="msg-hd">StudyOS Tutor</div><span></span><span></span><span></span>';
      log.appendChild(t);
      log.scrollTop = log.scrollHeight;
    }

    await U.sleep(420);
    const res = Tutor.reply(msg);
    Store.set((s) => s.chats.push({ id: U.uid(), role: "bot", text: res.text, ts: Date.now() }));
    App.render();
    P.scrollChat();

    if (res.quiz) {
      UI.toast("Setting up your quiz…");
      await U.sleep(600);
      P.startQuiz(res.quiz);
    }
  };
  P.scrollChat = function () {
    const log = document.getElementById("chatLog");
    if (log) log.scrollTop = log.scrollHeight;
  };

  // ============================================================
  //  SCAN & LEARN
  // ============================================================
  let scanResult = null;
  P.scan = function () {
    return `
    <div class="page-head">
      <div><div class="page-title">Scan &amp; Learn</div>
        <div class="page-sub">Turn a page of text into a summary, key points, quiz and flashcards</div></div>
      ${scanResult ? `<button class="btn ghost" data-scan-reset>Start over</button>` : ""}
    </div>

    ${!scanResult ? `
      <div class="grid g2">
        <div class="card">
          <h3>📷 Add an image</h3>
          <div class="drop" id="dropZone">
            <div class="d-emoji">🖼️</div>
            <div class="b7 f14" style="color:var(--text)">Drop a photo, or click to choose</div>
            <div class="faint f12 mt8">Textbook page, worksheet, diagram or your own notes</div>
          </div>
          <input type="file" id="scanFile" accept="image/*" hidden />
          <div id="scanPreview" class="mt16"></div>
          ${UI.insight("StudyOS runs entirely offline, so it can't read text out of an image on its own. Attach the photo for reference, then paste or type the text and it will do the analysis.", "", "ℹ️")}
        </div>
        <div class="card">
          <h3>⌨️ Paste the text</h3>
          <div class="field"><label>Page title (optional)</label><input id="scanName" placeholder="e.g. Science p.42 — Photosynthesis" /></div>
          <div class="field"><label>Text from the page</label>
            <textarea id="scanText" rows="9" placeholder="Paste or type the content here...&#10;&#10;Tip: lines written as 'Term: definition' become flashcards automatically."></textarea></div>
          <button class="btn primary block" data-scan-run>Analyse →</button>
          <button class="btn ghost block mt8" data-scan-demo>Use a sample page</button>
        </div>
      </div>` : `
      <div class="grid g2 mb16">
        <div class="card">
          <div class="card-hd"><h3>📄 Summary</h3>
            ${scanResult.topicTitle ? `<span class="pill brand">${U.esc(scanResult.topicTitle)}</span>` : ""}</div>
          <p class="f14" style="line-height:1.75">${U.esc(scanResult.summary)}</p>
          ${scanResult.keywords.length ? `<div class="flex gap6 wrap mt16">
            ${scanResult.keywords.map((k) => `<span class="pill grey">${U.esc(k)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="card">
          <h3>🔑 Key points</h3>
          <ul class="f13" style="padding-left:18px;line-height:1.9;color:var(--muted)">
            ${scanResult.points.map((p) => `<li>${U.esc(p)}</li>`).join("")}
          </ul>
        </div>
      </div>

      <div class="card mb16">
        <div class="card-hd"><h3>🧠 Generated flashcards <span class="muted b7">(${scanResult.cards.length})</span></h3>
          ${scanResult.cards.length ? `<button class="btn sm primary" data-save-scan-cards>Save to a chapter</button>` : ""}</div>
        ${scanResult.cards.length ? scanResult.cards.map((c) => `
          <div class="item" style="align-items:flex-start">
            <div class="grow"><div class="t f13">${U.esc(c.front)}</div>
              <div class="s mt4">${U.esc(c.back)}</div></div>
          </div>`).join("") : UI.emptyMini("🧠", "Not enough structured text to build cards. Try lines like 'Term: definition'.")}
      </div>

      <div class="flex gap8 wrap">
        <button class="btn primary" data-scan-quiz>❓ Quiz me on this</button>
        <button class="btn" data-scan-note>📝 Save as a note</button>
        <button class="btn" data-nav="tutor">🧠 Ask the tutor about it</button>
      </div>`}

    ${Store.state.scans.length && !scanResult ? `<div class="card mt16">
      <h3>🕘 Recent scans</h3>
      ${Store.state.scans.slice().reverse().slice(0, 5).map((s) => `
        <div class="item" style="padding:9px 11px">
          <div class="grow"><div class="t f13">${U.esc(s.name)}</div>
            <div class="s ellip">${U.esc(s.summary)}</div></div>
        </div>`).join("")}
    </div>` : ""}`;
  };
  P.runScan = function (text, name) {
    scanResult = Tutor.analyseText(text, name);
    Store.set((s) => s.scans.push({ id: U.uid(), ts: Date.now(), name: scanResult.name, summary: scanResult.summary, points: scanResult.points }));
    App.award(15, "Page analysed");
    App.render();
  };
  P.resetScan = function () { scanResult = null; App.render(); };
  P.getScan = () => scanResult;

  global.PagesStudy = P;
})(window);
