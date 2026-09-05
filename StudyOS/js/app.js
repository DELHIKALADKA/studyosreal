/* ============================================================
   StudyOS — app.js
   Application shell: router, chrome, event delegation, modals.
   ============================================================ */
(function (global) {
  "use strict";

  const NAV = [
    { group: "Plan", items: [
      { id: "dashboard", label: "Dashboard", ic: "🏠" },
      { id: "planner", label: "Study Planner", ic: "🗓️" },
      { id: "homework", label: "Homework", ic: "📋", dot: () => Store.pendingHomework().length },
      { id: "exams", label: "Exams", ic: "🎯" },
    ]},
    { group: "Study", items: [
      { id: "subjects", label: "Subjects", ic: "📚" },
      { id: "timer", label: "Study Timer", ic: "⏱️" },
      { id: "tutor", label: "Study Tutor", ic: "🤖" },
      { id: "scan", label: "Scan & Learn", ic: "📷" },
    ]},
    { group: "Practice", items: [
      { id: "quiz", label: "Quizzes", ic: "❓" },
      { id: "flashcards", label: "Flashcards", ic: "🃏" },
      { id: "revision", label: "Smart Revision", ic: "🔄", dot: () => Store.revisionQueue().length },
    ]},
    { group: "Progress", items: [
      { id: "progress", label: "Progress", ic: "📈" },
      { id: "achievements", label: "Achievements", ic: "🏆" },
      { id: "friends", label: "Friends", ic: "🧑‍🤝‍🧑" },
    ]},
  ];

  const MOBILE_NAV = [
    { id: "dashboard", label: "Home", ic: "🏠" },
    { id: "timer", label: "Timer", ic: "⏱️" },
    { id: "tutor", label: "Tutor", ic: "🤖" },
    { id: "subjects", label: "Study", ic: "📚" },
    { id: "progress", label: "Progress", ic: "📈" },
  ];

  const PAGES = {
    dashboard:    () => PagesCore.dashboard(),
    subjects:     () => PagesCore.subjects(),
    subject:      () => PagesCore.subjectDetail(),
    chapter:      () => PagesCore.chapter(),
    homework:     () => PagesCore.homework(),
    exams:        () => PagesCore.exams(),
    timer:        () => PagesStudy.timer(),
    planner:      () => PagesStudy.planner(),
    quiz:         () => PagesStudy.quiz(),
    flashcards:   () => PagesStudy.flashcards(),
    revision:     () => PagesStudy.revision(),
    tutor:        () => PagesStudy.tutor(),
    scan:         () => PagesStudy.scan(),
    progress:     () => PagesMeta.progress(),
    achievements: () => PagesMeta.achievements(),
    friends:      () => PagesMeta.friends(),
    notifications:() => PagesMeta.notifications(),
    settings:     () => PagesMeta.settings(),
  };

  /** Pages that appear under a different nav item when active. */
  const NAV_ALIAS = { subject: "subjects", chapter: "subjects" };

  const App = {
    route: { page: "dashboard" },
    obDraft: { subjects: [] },

    // ---------- boot ----------
    boot(opts) {
      const o = opts || {};
      Store.load();
      // localStorage cleared but the .sqlite file survived: rebuild from SQL.
      if (Store.state && !Store.state.subjects.length && !Store.state.sessions.length) {
        Store.hydrateFromDb();
      }
      App.applyTheme();
      document.getElementById("authRoot").style.display = "none";
      document.getElementById("appRoot").style.display = "";
      if (!Store.state.profile.onboarded) {
        App.obDraft = { subjects: [], name: Store.state.profile.name };
        App.route = { page: "onboard", obStep: 1 };
      } else {
        App.route = { page: o.page || "dashboard" };
      }
      App.render();
      if (o.welcome) UI.toast(o.welcome);
    },

    signOut() {
      Store.signOut();
      document.getElementById("appRoot").style.display = "none";
      document.getElementById("authRoot").style.display = "";
      Auth.render();
    },

    applyTheme() {
      document.documentElement.setAttribute("data-theme", Store.state.profile.theme || "dark");
    },

    // ---------- navigation ----------
    go(page, extra) {
      PagesStudy.stopTimerIfRunning && PagesStudy.stopTimerIfRunning(page);
      App.route = Object.assign({ page }, extra || {});
      window.scrollTo({ top: 0 });
      App.render();
    },

    render() {
      const page = App.route.page;
      const chrome = ["sidebar", "mobileTop", "mobileNav"];
      if (page === "onboard") {
        chrome.forEach((id) => document.getElementById(id).style.display = "none");
        document.getElementById("main").className = "main plain";
        document.getElementById("main").innerHTML = PagesMeta.onboard();
        return;
      }
      chrome.forEach((id) => document.getElementById(id).style.display = "");
      document.getElementById("main").className = "main";
      App.renderChrome();
      const fn = PAGES[page] || PAGES.dashboard;
      let html;
      try { html = fn(); }
      catch (err) {
        console.error("[StudyOS] render failed:", err);
        html = `<div class="card"><h3>⚠️ Something broke on this page</h3>
          <p class="muted f13 mt8">${U.esc(err.message)}</p>
          <button class="btn mt16" data-nav="dashboard">Back to dashboard</button></div>`;
      }
      document.getElementById("main").innerHTML = html;
      if (page === "tutor") PagesStudy.scrollChat();
    },

    renderChrome() {
      const active = NAV_ALIAS[App.route.page] || App.route.page;
      const p = Store.state.profile;
      const li = Store.levelInfo();
      const notifCount = Store.notifications().length;

      document.getElementById("sidebar").innerHTML = `
        ${Logo.lockup(34, { nav: true })}
        <nav class="nav">
          ${NAV.map((g) => `
            <div class="nav-group">${U.esc(g.group)}</div>
            ${g.items.map((it) => {
              const n = it.dot ? it.dot() : 0;
              return `<button class="nav-item ${active === it.id ? "active" : ""}" data-nav="${it.id}">
                <span class="ni-ic">${it.ic}</span><span class="grow">${U.esc(it.label)}</span>
                ${n ? `<span class="badge-dot">${n > 9 ? "9+" : n}</span>` : ""}
              </button>`;
            }).join("")}`).join("")}
        </nav>
        <div class="side-foot">
          <button class="nav-item ${active === "notifications" ? "active" : ""}" data-nav="notifications">
            <span class="ni-ic">🔔</span><span class="grow">Notifications</span>
            ${notifCount ? `<span class="badge-dot">${notifCount}</span>` : ""}
          </button>
          <button class="nav-item ${active === "settings" ? "active" : ""}" data-nav="settings">
            <span class="ni-ic">⚙️</span><span class="grow">Settings</span>
          </button>
          <div class="side-user" data-nav="settings">
            <div class="avatar">${U.esc(p.avatar || "🎓")}</div>
            <div class="grow" style="min-width:0">
              <div class="su-name">${U.esc(p.name || "Student")}</div>
              <div class="su-sub">${li.emoji} Lv ${li.level} · ${p.xp} XP</div>
            </div>
          </div>
        </div>`;

      document.getElementById("mobileTop").innerHTML = `
        ${Logo.lockup(30, { nav: true })}
        <div class="flex center gap8">
          <span class="pill grey">🔥 ${Store.currentStreak()}</span>
          <button class="icon-btn" data-nav="notifications">🔔${notifCount ? `<span class="dot-mini"></span>` : ""}</button>
          <button class="icon-btn" data-nav="settings">${U.esc(p.avatar || "🎓")}</button>
        </div>`;

      document.getElementById("mobileNav").innerHTML = MOBILE_NAV.map((it) =>
        `<button class="mn-item ${active === it.id ? "active" : ""}" data-nav="${it.id}">
          <span class="mn-ic">${it.ic}</span><span>${U.esc(it.label)}</span>
        </button>`).join("");
    },

    // ---------- gamification ----------
    award(xp, reason) {
      const before = Store.levelInfo().level;
      Store.addXP(xp);
      const after = Store.levelInfo().level;
      const fresh = Store.checkBadges();
      if (after > before) {
        const li = Store.levelInfo();
        UI.open(`
          <div class="center-txt">
            <div style="font-size:52px">${li.emoji}</div>
            <h2 style="margin:10px 0 4px">Level ${li.level}</h2>
            <p class="muted f13">You reached <b style="color:var(--text)">${U.esc(li.name)}</b>. ${li.next ? `Next up: ${li.next.emoji} ${U.esc(li.next.name)} at ${li.next.min} XP.` : "That's the top tier."}</p>
            <div class="modal-actions" style="justify-content:center"><button class="btn primary" data-close>Nice</button></div>
          </div>`);
      } else if (fresh.length) {
        const b = fresh[0];
        UI.open(`
          <div class="center-txt">
            <div style="font-size:52px">${b.emoji}</div>
            <h2 style="margin:10px 0 4px">Badge unlocked</h2>
            <p class="b7 f14">${U.esc(b.name)}</p>
            <p class="muted f13 mt4">${U.esc(b.desc)}</p>
            <div class="modal-actions" style="justify-content:center">
              <button class="btn" data-close>Close</button>
              <button class="btn primary" data-nav="achievements" data-close-first>See all badges</button>
            </div>
          </div>`);
      } else if (reason) {
        UI.toast(`+${xp} XP · ${reason}`);
      }
    },

    // ============================================================
    //  EVENT WIRING — one delegated click handler for the whole app
    // ============================================================
    wire() {
      document.addEventListener("click", (e) => {
        const t = (name) => { const el = e.target.closest(`[${name}]`); return el ? el.getAttribute(name) : null; };
        let v;

        // -------- navigation --------
        if ((v = t("data-nav")) !== null) {
          if (e.target.closest("[data-close-first]")) UI.close();
          return App.go(v);
        }
        if ((v = t("data-range")) !== null) { App.route.range = parseInt(v, 10); return App.render(); }

        // -------- subjects & chapters --------
        if (e.target.closest("[data-add-subject]")) return App.modalSubject();
        if ((v = t("data-open-subject")) !== null) return App.go("subject", { sid: v });
        if ((v = t("data-edit-subject")) !== null) return App.modalSubject(v);
        if ((v = t("data-del-subject")) !== null) {
          const s = Store.findSubject(v);
          return UI.confirm("Delete subject?", `<b>${U.esc(s.name)}</b> and its ${s.chapters.length} chapter(s), notes and flashcards will be removed. This can't be undone — export a backup first if you're unsure.`,
            () => { Store.set((st) => { st.subjects = st.subjects.filter((x) => x.id !== v); }); UI.toast("Subject deleted"); App.go("subjects"); }, { danger: true, ok: "Delete" });
        }
        if ((v = t("data-add-chapter")) !== null) return App.modalChapter(v);
        if ((v = t("data-open-chapter")) !== null) { const [sid, cid] = v.split("|"); return App.go("chapter", { sid, cid }); }
        if ((v = t("data-edit-chapter")) !== null) { const [sid, cid] = v.split("|"); return App.modalChapter(sid, cid); }
        if ((v = t("data-del-chapter")) !== null) {
          const [sid, cid] = v.split("|");
          const { chapter } = Store.findChapter(sid, cid);
          return UI.confirm("Delete chapter?", `<b>${U.esc(chapter.name)}</b> plus its notes and flashcards will be removed.`,
            () => { Store.set(() => { const s = Store.findSubject(sid); s.chapters = s.chapters.filter((c) => c.id !== cid); }); UI.toast("Chapter deleted"); App.go("subject", { sid }); }, { danger: true, ok: "Delete" });
        }
        if ((v = t("data-set-progress")) !== null) {
          const [sid, cid, val] = v.split("|");
          Store.set(() => { Store.findChapter(sid, cid).chapter.progress = U.clamp(parseInt(val, 10), 0, 100); });
          return App.render();
        }
        if ((v = t("data-set-difficulty")) !== null) {
          const [sid, cid, val] = v.split("|");
          Store.set(() => { Store.findChapter(sid, cid).chapter.difficulty = parseInt(val, 10); });
          return App.render();
        }
        if ((v = t("data-mark-revised")) !== null) {
          const [sid, cid] = v.split("|");
          Store.set(() => {
            const { chapter } = Store.findChapter(sid, cid);
            chapter.lastRevised = U.todayISO();
            chapter.progress = U.clamp(chapter.progress + 4, 0, 100);
          });
          UI.toast("Marked as revised · +4% understanding");
          return App.render();
        }

        // -------- notes --------
        if ((v = t("data-add-note")) !== null) { const [sid, cid] = v.split("|"); return App.modalNote(sid, cid); }
        if ((v = t("data-edit-note")) !== null) { const [sid, cid, nid] = v.split("|"); return App.modalNote(sid, cid, nid); }
        if ((v = t("data-del-note")) !== null) {
          const [sid, cid, nid] = v.split("|");
          Store.set(() => { const { chapter } = Store.findChapter(sid, cid); chapter.notes = chapter.notes.filter((n) => n.id !== nid); });
          UI.toast("Note deleted");
          return App.render();
        }
        if ((v = t("data-view-note")) !== null) {
          const [sid, cid, nid] = v.split("|");
          const { chapter } = Store.findChapter(sid, cid);
          const n = chapter.notes.find((x) => x.id === nid);
          return UI.open(`<h2>${U.esc(n.title)}</h2>
            <div class="muted f12 mb16">${U.fmtDateLong(n.dateISO)}</div>
            <div class="note-body">${U.mini(n.body)}</div>
            <div class="modal-actions">
              <button class="btn" data-close>Close</button>
              <button class="btn" data-gen-cards="${sid}|${cid}|${nid}" data-close-first>🃏 Make flashcards</button>
            </div>`, { wide: true });
        }

        // -------- flashcards --------
        if ((v = t("data-add-card")) !== null) { const [sid, cid] = v.split("|"); return App.modalCard(sid, cid); }
        if ((v = t("data-del-card")) !== null) {
          const [sid, cid, fid] = v.split("|");
          Store.set(() => { const { chapter } = Store.findChapter(sid, cid); chapter.cards = chapter.cards.filter((c) => c.id !== fid); });
          return App.render();
        }
        if ((v = t("data-gen-cards")) !== null) {
          if (e.target.closest("[data-close-first]")) UI.close();
          const [sid, cid, nid] = v.split("|");
          const { chapter } = Store.findChapter(sid, cid);
          const src = nid ? (chapter.notes.find((x) => x.id === nid) || {}).body : chapter.notes.map((n) => n.body).join("\n");
          const made = Tutor.cardsFromText(src || "");
          if (!made.length) return UI.toast("Not enough note text to build cards from");
          Store.set(() => {
            const { chapter: ch } = Store.findChapter(sid, cid);
            made.forEach((m) => ch.cards.push({ id: U.uid(), front: m.front, back: m.back, box: 1, due: U.todayISO(), reps: 0 }));
          });
          UI.toast(`${made.length} flashcard${made.length > 1 ? "s" : ""} created`);
          return App.render();
        }

        // -------- homework --------
        if (e.target.closest("[data-add-hw]")) return App.modalHomework();
        if ((v = t("data-edit-hw")) !== null) return App.modalHomework(v);
        if ((v = t("data-hw-toggle")) !== null) {
          const h = Store.state.homework.find((x) => x.id === v);
          const wasDone = h.status === "done";
          Store.set(() => { const x = Store.state.homework.find((y) => y.id === v); x.status = wasDone ? "pending" : "done"; x.doneAt = wasDone ? null : U.todayISO(); });
          if (!wasDone) App.award(25, "Homework done"); else App.render();
          if (!wasDone) App.render();
          return;
        }
        if ((v = t("data-del-hw")) !== null) {
          Store.set((st) => { st.homework = st.homework.filter((x) => x.id !== v); });
          UI.toast("Task removed");
          return App.render();
        }
        if ((v = t("data-hw-filter")) !== null) { App.route.hwFilter = v; return App.render(); }

        // -------- exams --------
        if (e.target.closest("[data-add-exam]")) return App.modalExam();
        if ((v = t("data-edit-exam")) !== null) return App.modalExam(v);
        if ((v = t("data-del-exam")) !== null) {
          Store.set((st) => { st.exams = st.exams.filter((x) => x.id !== v); });
          UI.toast("Exam removed");
          return App.render();
        }
        if ((v = t("data-syl-toggle")) !== null) {
          const [eid, idx] = v.split("|");
          Store.set(() => { const ex = Store.state.exams.find((x) => x.id === eid); ex.syllabus[+idx].done = !ex.syllabus[+idx].done; });
          return App.render();
        }
        if ((v = t("data-add-syl")) !== null) {
          return UI.prompt("Add syllabus item", "Topic name", "", (val) => {
            Store.set(() => { Store.state.exams.find((x) => x.id === v).syllabus.push({ name: val, done: false }); });
            App.render();
          }, { ok: "Add" });
        }

        // -------- timer --------
        if ((v = t("data-timer-mode")) !== null) return PagesStudy.setMode(v);
        if (e.target.closest("[data-timer-start]")) return PagesStudy.startTimer();
        if (e.target.closest("[data-timer-pause]")) return PagesStudy.pauseTimer();
        if (e.target.closest("[data-timer-reset]")) return PagesStudy.resetTimer();
        if (e.target.closest("[data-timer-skip]")) return PagesStudy.skipPhase();
        if ((v = t("data-quick-min")) !== null) return PagesStudy.quickLog(parseInt(v, 10));
        if ((v = t("data-confidence")) !== null) return PagesStudy.setConfidence(parseInt(v, 10));

        // -------- planner --------
        if ((v = t("data-plan-week")) !== null) { App.route.weekOffset = (App.route.weekOffset || 0) + parseInt(v, 10); return App.render(); }
        if ((v = t("data-add-block")) !== null) return App.modalBlock(v);
        if ((v = t("data-del-block")) !== null) {
          Store.set((st) => { st.plan = st.plan.filter((b) => b.id !== v); });
          return App.render();
        }
        if ((v = t("data-block-done")) !== null) {
          Store.set((st) => { const b = st.plan.find((x) => x.id === v); b.done = !b.done; });
          return App.render();
        }
        if ((v = t("data-auto-plan")) !== null) return App.autoPlan(v);

        // -------- quiz --------
        if (e.target.closest("[data-quiz-setup]")) return App.render();
        if (e.target.closest("[data-quiz-start]")) return PagesStudy.startQuiz({
          subject: UI.val("qz-subject"), chapter: UI.val("qz-chapter"),
          count: UI.num("qz-count", 10), difficulty: UI.val("qz-diff"),
        });
        if ((v = t("data-quiz-answer")) !== null) return PagesStudy.answerQuiz(parseInt(v, 10));
        if (e.target.closest("[data-quiz-next]")) return PagesStudy.nextQuiz();
        if (e.target.closest("[data-quiz-exit]")) return PagesStudy.exitQuiz();
        if ((v = t("data-quiz-retry")) !== null) return PagesStudy.retryQuiz(v);
        if ((v = t("data-wrong-to-cards")) !== null) return PagesStudy.wrongToCards();

        // -------- flashcard deck --------
        if ((v = t("data-start-deck")) !== null) return PagesStudy.startDeck(v);
        if (e.target.closest("[data-flip-card]")) return PagesStudy.flipCard();
        if ((v = t("data-rate-card")) !== null) return PagesStudy.rateCard(parseInt(v, 10));
        if (e.target.closest("[data-exit-deck]")) return PagesStudy.exitDeck();

        // -------- tutor --------
        if (e.target.closest("[data-send-chat]")) return PagesStudy.sendChat();
        if ((v = t("data-suggest")) !== null) return PagesStudy.sendChat(v);
        if (e.target.closest("[data-clear-chat]")) {
          return UI.confirm("Clear conversation?", "Your chat history with the tutor will be erased. Notes and flashcards you created from it stay.",
            () => { Store.set((st) => { st.chats = []; }); App.render(); }, { ok: "Clear" });
        }

        // -------- scan --------
        if (e.target.closest("[data-run-scan]")) return PagesStudy.runScan();
        if (e.target.closest("[data-reset-scan]")) return PagesStudy.resetScan();
        if ((v = t("data-scan-save")) !== null) return PagesStudy.saveScan(v);
        if (e.target.closest("[data-pick-image]")) return document.getElementById("scanFile").click();

        // -------- revision --------
        if ((v = t("data-revise-now")) !== null) { const [sid, cid] = v.split("|"); return App.go("chapter", { sid, cid }); }
        if (e.target.closest("[data-revise-session]")) return App.go("timer");

        // -------- friends & challenges --------
        if (e.target.closest("[data-add-friend]")) return App.modalFriend();
        if ((v = t("data-del-friend")) !== null) {
          Store.set((st) => { st.friends = st.friends.filter((f) => f.id !== v); });
          return App.render();
        }
        if (e.target.closest("[data-add-challenge]")) return App.modalChallenge();
        if ((v = t("data-preset-challenge")) !== null) {
          const [title, goal, unit] = v.split("|");
          return App.modalChallenge({ title, goal: +goal, unit });
        }
        if ((v = t("data-del-challenge")) !== null) {
          Store.set((st) => { st.challenges = st.challenges.filter((c) => c.id !== v); });
          return App.render();
        }
        if ((v = t("data-bump-challenge")) !== null) {
          Store.set((st) => { const c = st.challenges.find((x) => x.id === v); c.progress = Math.min(c.goal, c.progress + 1); });
          const c = Store.state.challenges.find((x) => x.id === v);
          if (c.progress >= c.goal) UI.toast("🎉 Challenge complete!");
          return App.render();
        }

        // -------- settings --------
        if (e.target.closest("[data-save-profile]")) {
          Store.set((st) => {
            st.profile.name = UI.val("st-name") || st.profile.name;
            st.profile.className = UI.val("st-class");
            st.profile.dailyGoalMin = U.clamp(UI.num("st-goal", 120), 15, 720);
          });
          const a = Store.account; if (a) { a.name = Store.state.profile.name; Store.saveAccounts(); }
          UI.toast("Profile saved");
          return App.render();
        }
        if ((v = t("data-set-avatar")) !== null) {
          Store.set((st) => { st.profile.avatar = v; });
          const a = Store.account; if (a) { a.avatar = v; Store.saveAccounts(); }
          return App.render();
        }
        if ((v = t("data-set-theme")) !== null) {
          Store.set((st) => { st.profile.theme = v; });
          App.applyTheme();
          return App.render();
        }
        if (e.target.closest("[data-export]")) {
          U.download(`studyos-backup-${U.todayISO()}.json`, Store.export());
          return UI.toast("Backup downloaded");
        }
        if (e.target.closest("[data-import]")) return document.getElementById("importFile").click();
        if (e.target.closest("[data-export-sqlite]")) return App.exportSqlite();
        if (e.target.closest("[data-import-sqlite]")) return document.getElementById("importSqlite").click();
        if (e.target.closest("[data-seed-demo]")) {
          return UI.confirm("Load sample data?", "This replaces your current data with an example set-up so you can explore the features. Export a backup first if you want to keep what you have.",
            () => { Store.seedDemo(); UI.toast("Sample data loaded"); App.go("dashboard"); }, { ok: "Load sample data" });
        }
        if (e.target.closest("[data-reset-data]")) {
          return UI.confirm("Reset all data?", "Every subject, note, task, session and flashcard in this profile will be deleted. This can't be undone.",
            () => { Store.reset(); UI.toast("Data reset"); App.boot({ page: "dashboard" }); }, { danger: true, ok: "Delete everything" });
        }
        if (e.target.closest("[data-sign-out]")) {
          return UI.confirm("Sign out?", "Your data stays on this device. You can sign back in from the start screen.",
            () => App.signOut(), { ok: "Sign out" });
        }
        if (e.target.closest("[data-delete-account]")) {
          return UI.confirm("Delete this account?", "The profile and all of its data will be removed from this device permanently.",
            () => { Store.deleteActiveAccount(); App.signOut(); UI.toast("Account deleted"); }, { danger: true, ok: "Delete account" });
        }
        if (e.target.closest("[data-upgrade-guest]")) return App.modalUpgrade();

        // -------- onboarding --------
        if ((v = t("data-ob-next")) !== null) {
          if (App.route.obStep === 1) {
            App.obDraft.name = UI.val("ob-name") || "Student";
            App.obDraft.className = UI.val("ob-class");
            App.obDraft.goal = UI.num("ob-goal", 120);
          }
          App.route.obStep = parseInt(v, 10);
          return App.render();
        }
        if ((v = t("data-ob-subject")) !== null) {
          const i = App.obDraft.subjects.indexOf(v);
          if (i >= 0) App.obDraft.subjects.splice(i, 1); else App.obDraft.subjects.push(v);
          return App.render();
        }
        if ((v = t("data-ob-finish")) !== null) return App.finishOnboarding(v);
      });

      // -------- change / input / submit handlers --------
      document.addEventListener("change", (e) => {
        const el = e.target;
        if (el.id === "importFile" && el.files[0]) return App.doImport(el.files[0]);
        if (el.id === "importSqlite" && el.files[0]) return App.doImportSqlite(el.files[0]);
        if (el.id === "scanFile" && el.files[0]) return PagesStudy.readImage(el.files[0]);
        if (el.hasAttribute("data-notif")) {
          const k = el.getAttribute("data-notif");
          Store.set((st) => { st.profile.notif[k] = el.checked; });
          return;
        }
        if (el.hasAttribute("data-toggle-pro")) {
          Store.set((st) => { st.profile.pro = el.checked; });
          UI.toast(el.checked ? "Pro preview on" : "Pro preview off");
          return;
        }
        if (el.id === "qz-subject") {
          document.getElementById("qz-chapter").outerHTML = UI.chapterSelect("qz-chapter", el.value, "");
          return;
        }
        if (el.id === "hw-subject" && document.getElementById("hw-chapter")) {
          document.getElementById("hw-chapter").outerHTML = UI.chapterSelect("hw-chapter", el.value, "");
          return;
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.id === "chatInput" && !e.shiftKey) { e.preventDefault(); PagesStudy.sendChat(); }
        if (document.querySelector("[data-overlay]")) return;
        if (App.route.page === "quiz" && /^[1-4]$/.test(e.key)) {
          const btn = document.querySelector(`[data-quiz-answer="${+e.key - 1}"]`);
          if (btn) btn.click();
        }
        if (App.route.page === "flashcards" && e.code === "Space" && document.querySelector("[data-flip-card]")) {
          e.preventDefault(); PagesStudy.flipCard();
        }
      });

      // -------- drag & drop for Scan & Learn --------
      document.addEventListener("dragover", (e) => {
        if (e.target.closest(".drop")) { e.preventDefault(); e.target.closest(".drop").classList.add("over"); }
      });
      document.addEventListener("dragleave", (e) => {
        const d = e.target.closest(".drop"); if (d) d.classList.remove("over");
      });
      document.addEventListener("drop", (e) => {
        const d = e.target.closest(".drop");
        if (!d) return;
        e.preventDefault(); d.classList.remove("over");
        const f = e.dataTransfer.files[0];
        if (f) PagesStudy.readImage(f);
      });
    },

    // ============================================================
    //  MODALS
    // ============================================================
    modalSubject(sid) {
      const s = sid ? Store.findSubject(sid) : null;
      const emojis = ["📐", "🧪", "🌍", "📖", "📕", "💻", "🎨", "🎵", "⚗️", "🔬", "📊", "🧠", "⚽", "🗺️"];
      UI.open(`
        <h2>${s ? "Edit subject" : "Add a subject"}</h2>
        <div class="field"><label>Subject name</label>
          <input id="sb-name" value="${U.esc(s ? s.name : "")}" placeholder="e.g. Mathematics" /></div>
        <div class="field"><label>Icon</label>
          <div class="flex gap6 wrap">${emojis.map((x, i) =>
            `<button class="av-pick ${(s ? s.emoji === x : i === 0) ? "on" : ""}" data-emoji="${x}">${x}</button>`).join("")}</div></div>
        <div class="row">
          <div class="field"><label>Teacher (optional)</label><input id="sb-teacher" value="${U.esc(s ? s.teacher || "" : "")}" /></div>
          <div class="field"><label>Target grade %</label><input id="sb-target" type="number" min="0" max="100" value="${s ? s.target || 85 : 85}" /></div>
        </div>
        ${!s ? `<div class="field"><label>Chapters (one per line, optional)</label>
          <textarea id="sb-chapters" rows="4" placeholder="Number Systems&#10;Polynomials&#10;Coordinate Geometry"></textarea></div>` : ""}
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="sb-save">${s ? "Save" : "Add subject"}</button>
        </div>`, {
        onOpen() {
          let emoji = s ? s.emoji : emojis[0];
          document.querySelectorAll("[data-emoji]").forEach((b) => b.onclick = () => {
            emoji = b.getAttribute("data-emoji");
            document.querySelectorAll("[data-emoji]").forEach((x) => x.classList.remove("on"));
            b.classList.add("on");
          });
          document.getElementById("sb-save").onclick = () => {
            const name = UI.val("sb-name");
            if (!name) return UI.toast("Give the subject a name");
            const teacher = UI.val("sb-teacher"), target = U.clamp(UI.num("sb-target", 85), 0, 100);
            if (s) {
              Store.set(() => { const x = Store.findSubject(sid); x.name = name; x.emoji = emoji; x.teacher = teacher; x.target = target; });
            } else {
              const chs = UI.val("sb-chapters").split("\n").map((x) => x.trim()).filter(Boolean);
              Store.set((st) => {
                st.subjects.push({
                  id: U.uid(), name, emoji, teacher, target,
                  chapters: chs.map((c) => ({ id: U.uid(), name: c, progress: 0, difficulty: 2, lastRevised: null, notes: [], cards: [] })),
                });
              });
            }
            UI.close(); UI.toast(s ? "Subject updated" : "Subject added"); App.render();
          };
        },
      });
    },

    modalChapter(sid, cid) {
      const ch = cid ? Store.findChapter(sid, cid).chapter : null;
      UI.open(`
        <h2>${ch ? "Edit chapter" : "Add a chapter"}</h2>
        <div class="field"><label>Chapter name</label>
          <input id="ch-name" value="${U.esc(ch ? ch.name : "")}" placeholder="e.g. Polynomials" /></div>
        <div class="row">
          <div class="field"><label>Understanding %</label>
            <input id="ch-prog" type="number" min="0" max="100" value="${ch ? ch.progress : 0}" /></div>
          <div class="field"><label>Difficulty</label>
            <select id="ch-diff">${[1, 2, 3].map((d) =>
              `<option value="${d}" ${(ch ? ch.difficulty : 2) === d ? "selected" : ""}>${U.diffLabel(d)}</option>`).join("")}</select></div>
        </div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="ch-save">${ch ? "Save" : "Add chapter"}</button>
        </div>`, {
        onOpen() {
          document.getElementById("ch-save").onclick = () => {
            const name = UI.val("ch-name");
            if (!name) return UI.toast("Give the chapter a name");
            const progress = U.clamp(UI.num("ch-prog", 0), 0, 100);
            const difficulty = UI.num("ch-diff", 2);
            Store.set(() => {
              if (ch) { const c = Store.findChapter(sid, cid).chapter; c.name = name; c.progress = progress; c.difficulty = difficulty; }
              else Store.findSubject(sid).chapters.push({ id: U.uid(), name, progress, difficulty, lastRevised: null, notes: [], cards: [] });
            });
            UI.close(); App.render();
          };
        },
      });
    },

    modalNote(sid, cid, nid) {
      const { chapter } = Store.findChapter(sid, cid);
      const n = nid ? chapter.notes.find((x) => x.id === nid) : null;
      UI.open(`
        <h2>${n ? "Edit note" : "New note"}</h2>
        <div class="field"><label>Title</label>
          <input id="nt-title" value="${U.esc(n ? n.title : "")}" placeholder="e.g. Factor theorem" /></div>
        <div class="field"><label>Note <span class="faint">— **bold**, *italic*, - bullets, \`code\`</span></label>
          <textarea id="nt-body" rows="10" placeholder="Write what you understood, in your own words.">${U.esc(n ? n.body : "")}</textarea></div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="nt-save">${n ? "Save" : "Save note"}</button>
        </div>`, { wide: true, onOpen() {
          document.getElementById("nt-save").onclick = () => {
            const title = UI.val("nt-title"), body = document.getElementById("nt-body").value.trim();
            if (!title) return UI.toast("Give the note a title");
            Store.set(() => {
              const { chapter: ch } = Store.findChapter(sid, cid);
              if (n) { const x = ch.notes.find((y) => y.id === nid); x.title = title; x.body = body; }
              else ch.notes.unshift({ id: U.uid(), title, body, dateISO: U.todayISO() });
            });
            UI.close();
            if (!n) App.award(10, "Note written"); else App.render();
            if (!n) App.render();
          };
        }});
    },

    modalCard(sid, cid) {
      UI.open(`
        <h2>New flashcard</h2>
        <div class="field"><label>Front — the question or term</label>
          <textarea id="fc-front" rows="3" placeholder="What is the factor theorem?"></textarea></div>
        <div class="field"><label>Back — the answer</label>
          <textarea id="fc-back" rows="3" placeholder="If p(a) = 0 then (x − a) is a factor of p(x)."></textarea></div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="fc-save">Add card</button>
        </div>`, { onOpen() {
          document.getElementById("fc-save").onclick = () => {
            const front = document.getElementById("fc-front").value.trim();
            const back = document.getElementById("fc-back").value.trim();
            if (!front || !back) return UI.toast("Both sides are needed");
            Store.set(() => {
              Store.findChapter(sid, cid).chapter.cards.push({ id: U.uid(), front, back, box: 1, due: U.todayISO(), reps: 0 });
            });
            UI.close(); UI.toast("Flashcard added"); App.render();
          };
        }});
    },

    modalHomework(hid) {
      const h = hid ? Store.state.homework.find((x) => x.id === hid) : null;
      UI.open(`
        <h2>${h ? "Edit task" : "Add homework"}</h2>
        <div class="field"><label>What needs doing?</label>
          <input id="hw-title" value="${U.esc(h ? h.title : "")}" placeholder="e.g. Exercise 2.4, questions 1–8" /></div>
        <div class="row">
          <div class="field"><label>Subject</label>${UI.subjectSelect("hw-subject", h ? h.subject : "")}</div>
          <div class="field"><label>Due date</label>
            <input id="hw-due" type="date" value="${h ? h.dueISO : U.addDays(U.todayISO(), 1)}" /></div>
        </div>
        <div class="row">
          <div class="field"><label>Priority</label>
            <select id="hw-prio">${["low", "medium", "high"].map((p) =>
              `<option value="${p}" ${(h ? h.priority : "medium") === p ? "selected" : ""}>${p[0].toUpperCase() + p.slice(1)}</option>`).join("")}</select></div>
          <div class="field"><label>Estimated minutes</label>
            <input id="hw-est" type="number" min="5" max="480" value="${h ? h.estMin || 30 : 30}" /></div>
        </div>
        <div class="field"><label>Notes (optional)</label>
          <textarea id="hw-notes" rows="3">${U.esc(h ? h.notes || "" : "")}</textarea></div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="hw-save">${h ? "Save" : "Add task"}</button>
        </div>`, { onOpen() {
          document.getElementById("hw-save").onclick = () => {
            const title = UI.val("hw-title");
            if (!title) return UI.toast("Describe the task first");
            const rec = {
              title, subject: UI.val("hw-subject"), dueISO: UI.val("hw-due") || U.todayISO(),
              priority: UI.val("hw-prio"), estMin: U.clamp(UI.num("hw-est", 30), 5, 480),
              notes: document.getElementById("hw-notes").value.trim(),
            };
            Store.set((st) => {
              if (h) Object.assign(st.homework.find((x) => x.id === hid), rec);
              else st.homework.push(Object.assign({ id: U.uid(), status: "pending", doneAt: null, createdAt: U.todayISO() }, rec));
            });
            UI.close(); UI.toast(h ? "Task updated" : "Task added"); App.render();
          };
        }});
    },

    modalExam(eid) {
      const ex = eid ? Store.state.exams.find((x) => x.id === eid) : null;
      UI.open(`
        <h2>${ex ? "Edit exam" : "Add an exam"}</h2>
        <div class="field"><label>Exam name</label>
          <input id="ex-title" value="${U.esc(ex ? ex.title : "")}" placeholder="e.g. Mid-Term Mathematics" /></div>
        <div class="row">
          <div class="field"><label>Subject</label>${UI.subjectSelect("ex-subject", ex ? ex.subject : "")}</div>
          <div class="field"><label>Date</label>
            <input id="ex-date" type="date" value="${ex ? ex.dateISO : U.addDays(U.todayISO(), 14)}" /></div>
        </div>
        <div class="row">
          <div class="field"><label>Total marks</label>
            <input id="ex-marks" type="number" min="1" value="${ex ? ex.totalMarks || 100 : 100}" /></div>
          <div class="field"><label>Target %</label>
            <input id="ex-target" type="number" min="0" max="100" value="${ex ? ex.target || 85 : 85}" /></div>
        </div>
        ${!ex ? `<div class="field"><label>Syllabus (one topic per line)</label>
          <textarea id="ex-syl" rows="4" placeholder="Polynomials&#10;Linear Equations&#10;Statistics"></textarea></div>` : ""}
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="ex-save">${ex ? "Save" : "Add exam"}</button>
        </div>`, { onOpen() {
          document.getElementById("ex-save").onclick = () => {
            const title = UI.val("ex-title");
            if (!title) return UI.toast("Name the exam");
            const rec = {
              title, subject: UI.val("ex-subject"), dateISO: UI.val("ex-date") || U.addDays(U.todayISO(), 7),
              totalMarks: UI.num("ex-marks", 100), target: U.clamp(UI.num("ex-target", 85), 0, 100),
            };
            Store.set((st) => {
              if (ex) Object.assign(st.exams.find((x) => x.id === eid), rec);
              else {
                const syl = UI.val("ex-syl").split("\n").map((x) => x.trim()).filter(Boolean);
                st.exams.push(Object.assign({ id: U.uid(), syllabus: syl.map((n) => ({ name: n, done: false })) }, rec));
              }
            });
            UI.close(); UI.toast(ex ? "Exam updated" : "Exam added"); App.render();
          };
        }});
    },

    modalBlock(dateISO) {
      UI.open(`
        <h2>Add a study block</h2>
        <div class="field"><label>Date</label><input id="bl-date" type="date" value="${dateISO || U.todayISO()}" /></div>
        <div class="row">
          <div class="field"><label>Subject</label>${UI.subjectSelect("bl-subject", "")}</div>
          <div class="field"><label>Start time</label><input id="bl-start" type="time" value="16:00" /></div>
        </div>
        <div class="row">
          <div class="field"><label>Minutes</label><input id="bl-min" type="number" min="10" max="240" value="45" /></div>
          <div class="field"><label>Focus</label>
            <select id="bl-kind">
              <option value="study">📖 Study new material</option>
              <option value="revise">🔄 Revise</option>
              <option value="practice">✏️ Practice questions</option>
              <option value="homework">📋 Homework</option>
            </select></div>
        </div>
        <div class="field"><label>Note (optional)</label><input id="bl-note" placeholder="e.g. Focus on word problems" /></div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="bl-save">Add block</button>
        </div>`, { onOpen() {
          document.getElementById("bl-save").onclick = () => {
            Store.set((st) => {
              st.plan.push({
                id: U.uid(), dateISO: UI.val("bl-date"), subject: UI.val("bl-subject"),
                start: UI.val("bl-start") || "16:00", minutes: U.clamp(UI.num("bl-min", 45), 10, 240),
                kind: UI.val("bl-kind"), note: UI.val("bl-note"), done: false,
              });
            });
            UI.close(); UI.toast("Block added"); App.render();
          };
        }});
    },

    modalFriend() {
      const av = ["🦊", "🐼", "🐨", "🦉", "🐧", "🐯", "🐸", "🦁"];
      UI.open(`
        <h2>Add a friend</h2>
        <p class="muted f13 mb16" style="line-height:1.6">Friends here are local placeholders — StudyOS has no server, so this is a way to set yourself a benchmark, not a real connection.</p>
        <div class="field"><label>Name</label><input id="fr-name" placeholder="e.g. Priya" /></div>
        <div class="row">
          <div class="field"><label>Their XP</label><input id="fr-xp" type="number" min="0" value="500" /></div>
          <div class="field"><label>Minutes studied</label><input id="fr-min" type="number" min="0" value="600" /></div>
        </div>
        <div class="field"><label>Avatar</label>
          <div class="flex gap6 wrap">${av.map((a, i) =>
            `<button class="av-pick ${i === 0 ? "on" : ""}" data-fav="${a}">${a}</button>`).join("")}</div></div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="fr-save">Add friend</button>
        </div>`, { onOpen() {
          let avatar = av[0];
          document.querySelectorAll("[data-fav]").forEach((b) => b.onclick = () => {
            avatar = b.getAttribute("data-fav");
            document.querySelectorAll("[data-fav]").forEach((x) => x.classList.remove("on"));
            b.classList.add("on");
          });
          document.getElementById("fr-save").onclick = () => {
            const name = UI.val("fr-name");
            if (!name) return UI.toast("Enter a name");
            Store.set((st) => st.friends.push({ id: U.uid(), name, avatar, xp: UI.num("fr-xp", 0), minutes: UI.num("fr-min", 0) }));
            UI.close(); App.render();
          };
        }});
    },

    modalChallenge(preset) {
      const p = preset || {};
      UI.open(`
        <h2>New challenge</h2>
        <div class="field"><label>Title</label>
          <input id="cl-title" value="${U.esc(p.title || "")}" placeholder="e.g. 7-Day Study Challenge" /></div>
        <div class="row">
          <div class="field"><label>Goal</label><input id="cl-goal" type="number" min="1" value="${p.goal || 7}" /></div>
          <div class="field"><label>Unit</label>
            <select id="cl-unit">${["days", "minutes", "questions", "chapters", "cards"].map((u) =>
              `<option ${((p.unit) || "days") === u ? "selected" : ""}>${u}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>Ends on</label><input id="cl-end" type="date" value="${U.addDays(U.todayISO(), 7)}" /></div>
        ${Store.state.friends.length ? `<div class="field"><label>Compete with</label>
          <div class="flex gap6 wrap">${Store.state.friends.map((f) =>
            `<button class="pick" data-cfriend="${U.esc(f.name)}"><span>${f.avatar}</span><span>${U.esc(f.name)}</span></button>`).join("")}</div></div>` : ""}
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="cl-save">Start challenge</button>
        </div>`, { onOpen() {
          const chosen = [];
          document.querySelectorAll("[data-cfriend]").forEach((b) => b.onclick = () => {
            const n = b.getAttribute("data-cfriend");
            const i = chosen.indexOf(n);
            if (i >= 0) { chosen.splice(i, 1); b.classList.remove("on"); } else { chosen.push(n); b.classList.add("on"); }
          });
          document.getElementById("cl-save").onclick = () => {
            const title = UI.val("cl-title");
            if (!title) return UI.toast("Name your challenge");
            Store.set((st) => st.challenges.push({
              id: U.uid(), title, goal: UI.num("cl-goal", 7), unit: UI.val("cl-unit"),
              progress: 0, endsOn: UI.val("cl-end") || U.addDays(U.todayISO(), 7), friends: chosen.slice(),
            }));
            UI.close(); UI.toast("Challenge started 🎯"); App.render();
          };
        }});
    },

    modalUpgrade() {
      UI.open(`
        <h2>Keep your progress</h2>
        <p class="muted f13 mb16" style="line-height:1.6">Add an email and password to turn this guest profile into a named account. Everything you've already done stays exactly as it is.</p>
        <div class="field"><label>Your name</label><input id="up-name" value="${U.esc(Store.state.profile.name || "")}" /></div>
        <div class="field"><label>Email</label><input id="up-email" type="email" placeholder="you@example.com" /></div>
        <div class="field"><label>Password <span class="faint">— at least 6 characters</span></label>
          <input id="up-pass" type="password" placeholder="••••••••" /></div>
        <div class="modal-actions">
          <button class="btn" data-close>Not now</button>
          <button class="btn primary" id="up-save">Upgrade account</button>
        </div>`, { onOpen() {
          document.getElementById("up-save").onclick = async () => {
            const name = UI.val("up-name"), email = UI.val("up-email"), pass = UI.val("up-pass");
            if (!U.validEmail(email)) return UI.toast("That email doesn't look right");
            if (pass.length < 6) return UI.toast("Password needs 6+ characters");
            if (Store.findAccount(email)) return UI.toast("An account with that email already exists here");
            await Store.upgradeGuest({ name: name || "Student", email, passHash: await U.hash(pass) });
            UI.close(); UI.toast("Account upgraded — your data is intact"); App.render();
          };
        }});
    },

    // ============================================================
    //  ACTIONS
    // ============================================================
    autoPlan(dateISO) {
      const blocks = Tutor.suggestPlan(dateISO, Store.state.profile.dailyGoalMin);
      if (!blocks.length) return UI.toast("Add a subject first and I'll build a plan");
      UI.open(`
        <h2>Suggested plan for ${U.fmtDate(dateISO)}</h2>
        <p class="muted f13 mb16">Built from what's weakest, what's due, and which exams are close. Breaks are included because they're part of the method, not a reward.</p>
        ${blocks.map((b) => `<div class="item">
          <div class="blk-time">${b.start}</div>
          <div class="grow"><div class="t">${b.kind === "break" ? "☕ Break" : U.esc(b.subject)}</div>
            <div class="s">${b.minutes} min${b.note ? ` · ${U.esc(b.note)}` : ""}</div></div>
        </div>`).join("")}
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="ap-apply">Add ${blocks.filter((b) => b.kind !== "break").length} blocks</button>
        </div>`, { onOpen() {
          document.getElementById("ap-apply").onclick = () => {
            Store.set((st) => {
              st.plan = st.plan.filter((b) => b.dateISO !== dateISO);
              blocks.filter((b) => b.kind !== "break").forEach((b) =>
                st.plan.push(Object.assign({ id: U.uid(), dateISO, done: false }, b)));
            });
            UI.close(); UI.toast("Plan added to your week"); App.render();
          };
        }});
    },

    /** Save the live database as a real .sqlite file. */
    async exportSqlite() {
      if (!DB.available) return UI.toast("SQLite isn't running in this browser");
      // Push any pending state through first, so the file is current.
      Bridge.project(Store.account, Store.state);
      await DB.flush();
      const bytes = DB.exportFile();
      const name = `studyos-${U.todayISO()}.sqlite`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.sqlite3" }));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      DB.logBackup(Store.account?.id || null, "export", "sqlite", bytes.length, name);
      UI.toast("Database exported");
    },

    /** Replace the database from a .sqlite file, then rebuild the UI state. */
    doImportSqlite(file) {
      const input = document.getElementById("importSqlite");
      const r = new FileReader();
      r.onload = () => {
        UI.confirm(
          "Restore this database?",
          "Your current profiles and data will be replaced by the contents of this file. Export what you have now if you might want it back.",
          async () => {
            try {
              await DB.importFile(r.result);
              // The restored file is authoritative — rebuild JS state from it.
              const acc = DB.one("SELECT * FROM accounts ORDER BY last_seen_at DESC LIMIT 1");
              if (!acc) throw new Error("That database has no profiles in it.");
              Store.adoptFromDb(acc);
              UI.toast("Database restored");
              App.applyTheme();
              App.boot({ page: "dashboard" });
            } catch (err) {
              UI.toast(err.message || "That file couldn't be read");
            } finally {
              if (input) input.value = "";
            }
          },
          { ok: "Replace my data", danger: true }
        );
      };
      r.readAsArrayBuffer(file);
    },

    doImport(file) {
      const r = new FileReader();
      r.onload = () => {
        UI.confirm("Import this backup?", "Your current data will be replaced by the contents of this file. Export what you have now if you might want it back.", () => {
          const ok = Store.import(r.result);
          document.getElementById("importFile").value = "";
          if (!ok) return UI.toast("That file isn't a valid StudyOS backup");
          UI.toast("Backup restored");
          App.applyTheme();
          App.go("dashboard");
        }, { ok: "Replace my data" });
      };
      r.readAsText(file);
    },

    finishOnboarding(mode) {
      const d = App.obDraft;
      if (mode === "demo") Store.seedDemo();
      Store.set((st) => {
        st.profile.name = d.name || st.profile.name || "Student";
        st.profile.className = d.className || "";
        st.profile.dailyGoalMin = d.goal || 120;
        st.profile.onboarded = true;
        if (mode !== "demo") {
          st.subjects = d.subjects.map((name) => {
            const p = PagesMeta.SUBJECT_PRESETS.find((x) => x.name === name) || { emoji: "📘", chapters: [] };
            return {
              id: U.uid(), name, emoji: p.emoji, teacher: "", target: 85,
              chapters: p.chapters.map((c) => ({ id: U.uid(), name: c, progress: 0, difficulty: 2, lastRevised: null, notes: [], cards: [] })),
            };
          });
        } else if (d.subjects.length) {
          d.subjects.forEach((name) => {
            if (st.subjects.some((s) => s.name === name)) return;
            const p = PagesMeta.SUBJECT_PRESETS.find((x) => x.name === name) || { emoji: "📘", chapters: [] };
            st.subjects.push({
              id: U.uid(), name, emoji: p.emoji, teacher: "", target: 85,
              chapters: p.chapters.map((c) => ({ id: U.uid(), name: c, progress: 0, difficulty: 2, lastRevised: null, notes: [], cards: [] })),
            });
          });
        }
      });
      const a = Store.account;
      if (a) { a.name = Store.state.profile.name; Store.saveAccounts(); }
      App.go("dashboard");
      UI.toast(`Welcome to StudyOS, ${Store.state.profile.name} 👋`);
    },
  };

  global.App = App;

  // ---------- start ----------
  document.addEventListener("DOMContentLoaded", async () => {
    App.wire();
    // Bring SQLite up before the first render. It never blocks the app:
    // if the wasm is missing, DB.init() resolves false and Store falls
    // back to the localStorage engine.
    try {
      await DB.init();
      Bridge.attach();
    } catch (e) {
      console.warn("[StudyOS] SQLite init failed:", e);
    }
    Auth.mount();
    // Flush the database file when the tab goes away, so the last write
    // inside the 400 ms batch window is never lost.
    window.addEventListener("pagehide", () => DB.flush());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") DB.flush();
    });
  });
})(window);
