/* ============================================================
   StudyOS — pages-core.js
   Dashboard, Subjects, Chapters, Notes, Homework, Exams.
   ============================================================ */
(function (global) {
  "use strict";

  const P = {};

  // ============================================================
  //  DASHBOARD
  // ============================================================
  P.dashboard = function () {
    const s = Store.state, p = s.profile;
    const done = Store.todayMinutes(), goal = p.dailyGoalMin || 1;
    const pct = Store.goalPct();
    const streak = Store.currentStreak();
    const pending = Store.pendingHomework();
    const overdue = Store.overdueHomework();
    const exams = Store.upcomingExams();
    const queue = Store.revisionQueue(3);
    const todayPlan = Store.planFor(U.todayISO());
    const li = Store.levelInfo();
    const cards = Store.dueCards();

    return `
    <div class="page-head">
      <div>
        <div class="page-title">${U.greeting()}, ${U.esc(p.name || "there")} 👋</div>
        <div class="page-sub">${U.fmtDateLong(U.todayISO())} · ${p.className || "Student"}</div>
      </div>
      <div class="flex gap8">
        <button class="btn" data-nav="tutor">🧠 Ask tutor</button>
        <button class="btn primary" data-nav="timer">⏱️ Start studying</button>
      </div>
    </div>

    <div class="stat-row mb16">
      <div class="stat"><div class="k">🔥 Streak</div><div class="v">${streak}<small> day${streak !== 1 ? "s" : ""}</small></div></div>
      <div class="stat"><div class="k">⏱️ Studied today</div><div class="v">${U.fmtMin(done)}<small> / ${U.fmtMin(goal)}</small></div></div>
      <div class="stat"><div class="k">📝 Pending tasks</div><div class="v">${pending.length}${overdue.length ? `<small style="color:var(--red)"> · ${overdue.length} late</small>` : ""}</div></div>
      <div class="stat"><div class="k">${li.emoji} Level ${li.level}</div><div class="v">${s.profile.xp}<small> XP</small></div></div>
    </div>

    <div class="grid g-14-1 mb16">
      <div class="card">
        <div class="card-hd"><h3>🎯 Today's goal</h3>
          <span class="pill ${pct >= 100 ? "green" : "brand"}">${pct}%</span></div>
        <div class="flex center" style="gap:26px;flex-wrap:wrap">
          ${UI.ring(pct)}
          <div class="grow">
            <div class="muted f13">Studied today</div>
            <div class="b8" style="font-size:27px;letter-spacing:-.5px">${U.fmtMin(done)}</div>
            <div class="faint f12 mt8">${pct >= 100
              ? "Goal complete. Anything more today is a bonus. 🎉"
              : `${U.fmtMin(goal - done)} to go — about ${Math.max(1, Math.ceil((goal - done) / 25))} Pomodoro session${Math.ceil((goal - done) / 25) !== 1 ? "s" : ""}.`}</div>
            <div class="flex gap8 mt16 wrap">
              <button class="btn sm" data-quick-min="25">+25 min</button>
              <button class="btn sm" data-quick-min="50">+50 min</button>
              <button class="btn sm ghost" data-edit-goal>Change goal</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>⏭️ Next up</h3></div>
        ${queue.length ? `
          <div class="flex center gap12">
            <div style="font-size:27px">${queue[0].subject.emoji}</div>
            <div class="grow">
              <div class="b7 f14">${U.esc(queue[0].subject.name)}</div>
              <div class="muted f12">${U.esc(queue[0].chapter.name)}</div>
            </div>
          </div>
          <div class="mt12">${UI.bar(queue[0].chapter.progress, { color: U.gradeColor(queue[0].chapter.progress) })}</div>
          <div class="flex between mt8">
            <span class="faint f11">${queue[0].chapter.progress}% understanding</span>
            <span class="faint f11">${queue[0].gap >= 21 ? "never revised" : `${queue[0].gap}d since revision`}</span>
          </div>
          <p class="faint f12 mt12" style="line-height:1.55">Suggested: 20 min revision → 5 questions → mini quiz.</p>
          <div class="flex gap8 mt12">
            <button class="btn sm primary grow" data-study-chapter="${queue[0].subject.id}|${queue[0].chapter.id}">Study now</button>
            <button class="btn sm" data-nav="revision">Queue</button>
          </div>
        ` : `<p class="muted f13">Add a subject and chapters, and StudyOS will tell you what to study next.</p>
             <button class="btn sm primary mt12" data-nav="subjects">+ Add subject</button>`}
      </div>
    </div>

    <div class="grid g2 mb16">
      <div class="card">
        <div class="card-hd"><h3>📝 Homework</h3><button class="btn sm" data-nav="homework">View all</button></div>
        ${pending.length
          ? pending.sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).slice(0, 4).map((h) => hwRow(h, true)).join("")
          : UI.emptyMini("🎉", "Nothing pending. Enjoy it.")}
      </div>

      <div class="card">
        <div class="card-hd"><h3>🧪 Upcoming tests</h3><button class="btn sm" data-nav="exams">View all</button></div>
        ${exams.length ? exams.slice(0, 3).map((e) => {
          const d = U.daysBetween(U.todayISO(), e.date);
          const left = e.syllabus.filter((x) => !x.done).length;
          return `<div class="item clickable" data-nav="exams">
            <div class="grow"><div class="t">${U.esc(e.subject)}</div>
              <div class="s">${U.fmtDate(e.date)} · ${left ? `${left} topic${left !== 1 ? "s" : ""} left` : "syllabus covered"}</div></div>
            <span class="pill ${d <= 3 ? "red" : d <= 7 ? "yellow" : "brand"}">${d}d</span>
          </div>`;
        }).join("") : UI.emptyMini("📅", "No exams scheduled")}
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <div class="card-hd"><h3>📅 Today's plan</h3><button class="btn sm" data-nav="planner">Planner</button></div>
        ${todayPlan.length ? todayPlan.map((b) => `
          <div class="item">
            <button class="check ${b.done ? "done" : ""}" data-plan-toggle="${b.id}">${b.done ? "✓" : ""}</button>
            <div class="grow ${b.done ? "" : ""}"><div class="t" style="${b.done ? "opacity:.55;text-decoration:line-through" : ""}">${U.esc(b.subject)}${b.chapter ? ` — ${U.esc(b.chapter)}` : ""}</div>
              <div class="s">${U.esc(b.start)}–${U.esc(b.end)}${b.note ? ` · ${U.esc(b.note)}` : ""}</div></div>
          </div>`).join("")
          : `${UI.emptyMini("🗓️", "No blocks planned for today")}
             <button class="btn sm block" data-auto-plan>✨ Build me a plan</button>`}
      </div>

      <div class="card">
        <div class="card-hd"><h3>🔔 What needs attention</h3><button class="btn sm" data-nav="notifications">All</button></div>
        ${(() => {
          const n = Store.notifications().slice(0, 3);
          return n.length ? n.map((x) => `
            <div class="item clickable" data-nav="${x.go}">
              <div style="font-size:17px">${x.ic}</div>
              <div class="grow"><div class="t">${U.esc(x.t)}</div><div class="s">${U.esc(x.s)}</div></div>
            </div>`).join("") : UI.emptyMini("✨", "All clear right now");
        })()}
        ${cards.length ? `<button class="btn sm block mt12" data-nav="flashcards">🧠 ${cards.length} flashcard${cards.length !== 1 ? "s" : ""} due</button>` : ""}
      </div>
    </div>`;
  };

  // ============================================================
  //  SUBJECTS
  // ============================================================
  P.subjects = function () {
    const s = Store.state;
    if (App.route.subjectId) {
      const subj = Store.findSubject(App.route.subjectId);
      if (subj && App.route.chapterId) return P.chapter(subj);
      if (subj) return P.subjectDetail(subj);
    }
    const totalCh = s.subjects.reduce((a, x) => a + x.chapters.length, 0);
    return `
    <div class="page-head">
      <div><div class="page-title">Subjects</div>
        <div class="page-sub">${s.subjects.length} subject${s.subjects.length !== 1 ? "s" : ""} · ${totalCh} chapter${totalCh !== 1 ? "s" : ""}</div></div>
      <button class="btn primary" data-add-subject>+ Add subject</button>
    </div>
    ${s.subjects.length ? `<div class="chip-grid">
      ${s.subjects.map((x) => {
        const avg = Store.subjectAvg(x);
        const notes = x.chapters.reduce((a, c) => a + (c.notes || []).length, 0);
        return `<div class="subject-card" data-open-subject="${x.id}">
          <button class="icon-btn del" data-del-subject="${x.id}" title="Delete">🗑️</button>
          <div class="subject-emoji">${U.esc(x.emoji)}</div>
          <div class="subject-name">${U.esc(x.name)}</div>
          <div class="muted f12" style="margin:5px 0 10px">${x.chapters.length} chapters · ${notes} notes</div>
          ${UI.bar(avg, { thin: true, color: U.gradeColor(avg) })}
          <div class="faint f11 mt8">${avg}% average understanding</div>
        </div>`;
      }).join("")}
    </div>` : UI.empty("📚", "No subjects yet",
        "Add your subjects, then break each one into chapters. Everything else in StudyOS builds on this.",
        `<button class="btn primary" data-add-subject>+ Add your first subject</button>`)}`;
  };

  P.subjectDetail = function (subj) {
    const avg = Store.subjectAvg(subj);
    return `
    <div class="breadcrumb"><span class="crumb" data-nav="subjects">Subjects</span> / <b>${U.esc(subj.name)}</b></div>
    <div class="page-head">
      <div><div class="page-title">${U.esc(subj.emoji)} ${U.esc(subj.name)}</div>
        <div class="page-sub">${subj.chapters.length} chapters · ${avg}% average understanding</div></div>
      <div class="flex gap8">
        <button class="btn" data-rename-subject="${subj.id}">Rename</button>
        <button class="btn primary" data-add-chapter="${subj.id}">+ Add chapter</button>
      </div>
    </div>
    ${subj.chapters.length ? subj.chapters.map((c) => `
      <div class="item clickable" data-open-chapter="${subj.id}|${c.id}">
        <div class="grow">
          <div class="t">${U.gradeDot(c.progress)} ${U.esc(c.name)}</div>
          <div class="s">${(c.notes || []).length} notes · ${(c.cards || []).length} cards · ${c.lastRevised ? `revised ${U.relDate(c.lastRevised)}` : "never revised"}</div>
        </div>
        ${U.diffPill(c.difficulty)}
        <div style="width:140px">${UI.bar(c.progress, { thin: true, color: U.gradeColor(c.progress) })}
          <div class="faint f11 mt4" style="text-align:right">${c.progress}%</div></div>
        <button class="icon-btn" data-del-chapter="${subj.id}|${c.id}">🗑️</button>
      </div>`).join("")
      : UI.empty("📖", "No chapters yet", `Break ${subj.name} into chapters so you can track progress topic by topic.`,
        `<button class="btn primary" data-add-chapter="${subj.id}">+ Add chapter</button>`)}`;
  };

  P.chapter = function (subj) {
    const c = Store.findChapter(subj.id, App.route.chapterId);
    if (!c) return P.subjectDetail(subj);
    const notes = (c.notes || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
    return `
    <div class="breadcrumb"><span class="crumb" data-nav="subjects">Subjects</span> /
      <span class="crumb" data-open-subject="${subj.id}">${U.esc(subj.name)}</span> / <b>${U.esc(c.name)}</b></div>
    <div class="page-head">
      <div><div class="page-title">${U.esc(c.name)}</div>
        <div class="page-sub">${U.esc(subj.name)} · ${c.lastRevised ? `last revised ${U.relDate(c.lastRevised)}` : "never revised"}</div></div>
      <div class="flex gap8 wrap">
        <button class="btn" data-study-chapter="${subj.id}|${c.id}">⏱️ Study</button>
        <button class="btn" data-quiz-chapter="${subj.id}|${c.id}">❓ Quiz</button>
        <button class="btn primary" data-add-note="${subj.id}|${c.id}">+ Note</button>
      </div>
    </div>

    <div class="grid g2 mb16">
      <div class="card">
        <h3>📊 Understanding</h3>
        <div class="flex center gap16">
          ${UI.ring(c.progress, { sm: true })}
          <div class="grow">
            <input type="range" min="0" max="100" step="5" value="${c.progress}" data-set-progress="${subj.id}|${c.id}" />
            <div class="faint f11 mt4">Drag to update. Quizzes update this automatically too.</div>
          </div>
        </div>
        <div class="flex gap8 mt16 wrap">
          <span class="muted f12 b7" style="align-self:center">Difficulty:</span>
          ${[1, 2, 3].map((d) => `<button class="btn sm ${c.difficulty === d ? "primary" : ""}" data-set-diff="${subj.id}|${c.id}|${d}">${U.diffLabel(d)}</button>`).join("")}
        </div>
        <button class="btn sm block mt16" data-mark-revised="${subj.id}|${c.id}">✓ Mark revised today</button>
      </div>

      <div class="card">
        <h3>🧠 Flashcards</h3>
        <div class="b8" style="font-size:26px">${(c.cards || []).length}</div>
        <div class="muted f12">card${(c.cards || []).length !== 1 ? "s" : ""} in this chapter</div>
        <div class="flex gap8 mt16 wrap">
          <button class="btn sm" data-add-card="${subj.id}|${c.id}">+ Add card</button>
          <button class="btn sm" data-gen-cards="${subj.id}|${c.id}">✨ From notes</button>
          ${(c.cards || []).length ? `<button class="btn sm primary" data-review-chapter="${subj.id}|${c.id}">Review</button>` : ""}
        </div>
        ${(c.cards || []).length ? `<div class="mt16">${(c.cards || []).slice(0, 3).map((cd) => `
          <div class="item" style="padding:9px 11px">
            <div class="grow"><div class="t f13 ellip">${U.esc(cd.front)}</div>
              <div class="s ellip">${U.esc(cd.back)}</div></div>
            <button class="icon-btn" data-del-card="${subj.id}|${c.id}|${cd.id}">🗑️</button>
          </div>`).join("")}${(c.cards || []).length > 3 ? `<div class="faint f11 mt8">+${c.cards.length - 3} more</div>` : ""}</div>` : ""}
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><h3>📖 Notes</h3>
        <button class="btn sm" data-add-note="${subj.id}|${c.id}">+ Add note</button></div>
      ${notes.length ? notes.map((n) => `
        <div class="item" style="align-items:flex-start">
          <div class="grow">
            <div class="t">${n.pinned ? "📌 " : ""}${U.esc(n.title)}</div>
            <div class="s mt8" style="white-space:pre-wrap;line-height:1.65">${U.mini(n.body)}</div>
          </div>
          <div class="flex gap6" style="flex-shrink:0">
            <button class="icon-btn" data-cards-from-note="${subj.id}|${c.id}|${n.id}" title="Make flashcards">✨</button>
            <button class="icon-btn" data-pin-note="${subj.id}|${c.id}|${n.id}" title="${n.pinned ? "Unpin" : "Pin"}">${n.pinned ? "📌" : "📍"}</button>
            <button class="icon-btn" data-edit-note="${subj.id}|${c.id}|${n.id}" title="Edit">✏️</button>
            <button class="icon-btn" data-del-note="${subj.id}|${c.id}|${n.id}" title="Delete">🗑️</button>
          </div>
        </div>`).join("") : UI.emptyMini("📝", "No notes in this chapter yet")}
    </div>`;
  };

  // ============================================================
  //  HOMEWORK
  // ============================================================
  P.homework = function () {
    const s = Store.state;
    const filter = App.route.hwFilter || "active";
    let list = s.homework.slice();
    if (filter === "active") list = list.filter((h) => h.status !== "done");
    if (filter === "done") list = list.filter((h) => h.status === "done");
    list.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));

    const overdue = Store.overdueHomework();
    const groups = filter === "active"
      ? [["todo", "☐ Not started"], ["progress", "◐ In progress"]]
      : filter === "done" ? [["done", "✅ Completed"]]
      : [["todo", "☐ Not started"], ["progress", "◐ In progress"], ["done", "✅ Completed"]];

    return `
    <div class="page-head">
      <div><div class="page-title">Homework</div>
        <div class="page-sub">${Store.pendingHomework().length} active${overdue.length ? ` · ${overdue.length} overdue` : ""} · ${s.homework.filter((h) => h.status === "done").length} done</div></div>
      <div class="flex gap8">
        <div class="seg">
          ${[["active", "Active"], ["done", "Done"], ["all", "All"]].map(([k, l]) =>
            `<button class="${filter === k ? "active" : ""}" data-hw-filter="${k}">${l}</button>`).join("")}
        </div>
        <button class="btn primary" data-add-hw>+ Add task</button>
      </div>
    </div>

    ${overdue.length && filter !== "done" ? UI.insight(
      `<b>${overdue.length} task${overdue.length !== 1 ? "s are" : " is"} overdue.</b> Clearing the oldest one first usually feels the best — it's the one weighing on you.`,
      "warn", "⚠️") + '<div class="mb16"></div>' : ""}

    ${!s.homework.length ? UI.empty("📝", "No homework yet",
      "Add assignments with a due date and priority. Your dashboard and notifications update automatically.",
      `<button class="btn primary" data-add-hw>+ Add your first task</button>`)
      : groups.map(([k, label]) => {
        const items = list.filter((h) => h.status === k);
        return `<div class="card mb16">
          <div class="card-hd"><h3>${label} <span class="muted b7">(${items.length})</span></h3></div>
          ${items.length ? items.map((h) => hwRow(h)).join("") : `<p class="faint f13">Nothing here.</p>`}
        </div>`;
      }).join("")}`;
  };

  function hwRow(h, compact) {
    const overdue = h.status !== "done" && h.due && U.daysBetween(U.todayISO(), h.due) < 0;
    return `<div class="item ${h.status === "done" ? "done" : ""}">
      <button class="check ${h.status === "done" ? "done" : ""}" data-hw-toggle="${h.id}">${h.status === "done" ? "✓" : ""}</button>
      <div class="grow">
        <div class="t">${U.esc(h.task)}</div>
        <div class="s">${U.esc(h.subject)} · ${h.due ? `due ${U.relDate(h.due)}` : "no due date"}${overdue ? ' · <span style="color:var(--red)">overdue</span>' : ""}</div>
      </div>
      <span class="pill ${h.priority === "High" ? "red" : h.priority === "Medium" ? "yellow" : "grey"}">${U.esc(h.priority)}</span>
      ${!compact ? `${h.status === "todo" ? `<button class="btn sm" data-hw-start="${h.id}">Start</button>` : ""}
      <button class="icon-btn" data-edit-hw="${h.id}">✏️</button>
      <button class="icon-btn" data-del-hw="${h.id}">🗑️</button>` : ""}
    </div>`;
  }
  P.hwRow = hwRow;

  // ============================================================
  //  EXAMS
  // ============================================================
  P.exams = function () {
    const s = Store.state;
    const list = s.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = list.filter((e) => U.daysBetween(U.todayISO(), e.date) >= 0);

    return `
    <div class="page-head">
      <div><div class="page-title">Exams</div>
        <div class="page-sub">${upcoming.length} upcoming${list.length - upcoming.length ? ` · ${list.length - upcoming.length} past` : ""}</div></div>
      <button class="btn primary" data-add-exam>+ Add exam</button>
    </div>

    ${!list.length ? UI.empty("🧪", "No exams scheduled",
        "Add an exam with its syllabus. StudyOS counts down, tracks what's covered, and can build a prep plan.",
        `<button class="btn primary" data-add-exam>+ Add exam</button>`)
      : list.map((e) => {
        const d = U.daysBetween(U.todayISO(), e.date);
        const doneN = e.syllabus.filter((x) => x.done).length;
        const pct = U.pct(doneN, e.syllabus.length);
        const past = d < 0;
        return `<div class="card mb16" style="${past ? "opacity:.6" : ""}">
          <div class="card-hd">
            <h3>🧪 ${U.esc(e.subject)}</h3>
            <div class="flex gap8 center">
              <span class="pill ${past ? "grey" : d <= 3 ? "red" : d <= 7 ? "yellow" : "brand"}">
                ${past ? "past" : d === 0 ? "today!" : `${d} day${d !== 1 ? "s" : ""} left`}</span>
              <button class="icon-btn" data-add-syllabus="${e.id}" title="Add topic">➕</button>
              <button class="icon-btn" data-del-exam="${e.id}">🗑️</button>
            </div>
          </div>
          <div class="muted f13 mb12">📅 ${U.fmtDateLong(e.date)} · syllabus ${pct}% covered</div>
          ${UI.bar(pct, { color: pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)" })}
          <div class="mt16">
            ${e.syllabus.length ? e.syllabus.map((t, i) => `
              <div class="item" style="padding:8px 11px">
                <button class="check ${t.done ? "done" : ""}" data-syl-toggle="${e.id}|${i}">${t.done ? "✓" : ""}</button>
                <div class="grow"><div class="t f13" style="${t.done ? "opacity:.55" : ""}">${U.esc(t.topic)}</div></div>
                <button class="icon-btn" data-del-syllabus="${e.id}|${i}">✕</button>
              </div>`).join("") : `<p class="faint f13">No syllabus topics added.</p>`}
          </div>
          ${!past && d <= 14 ? `<div class="mt16">${UI.insight(
            e.syllabus.length && doneN < e.syllabus.length
              ? `<b>${e.syllabus.length - doneN} topic${e.syllabus.length - doneN !== 1 ? "s" : ""} left in ${d} day${d !== 1 ? "s" : ""}.</b> That's about ${Math.max(1, Math.ceil((e.syllabus.length - doneN) / Math.max(1, d)))} topic per day — very doable if you start today.`
              : `<b>Syllabus is fully covered.</b> Switch from learning to testing: quizzes and flashcards over rereading.`,
            doneN < e.syllabus.length ? "warn" : "good", doneN < e.syllabus.length ? "📌" : "✅")}
            <button class="btn sm mt12" data-exam-plan="${e.id}">✨ Build prep plan</button></div>` : ""}
        </div>`;
      }).join("")}`;
  };

  global.PagesCore = P;
})(window);
