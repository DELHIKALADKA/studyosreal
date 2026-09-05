/* ============================================================
   StudyOS — pages-meta.js
   Progress, Achievements, Friends & Challenges,
   Notifications, Settings, Onboarding.
   ============================================================ */
(function (global) {
  "use strict";

  const P = {};

  // ============================================================
  //  PROGRESS / ANALYTICS
  // ============================================================
  P.progress = function () {
    const s = Store.state;
    const range = App.route.range || 7;
    const days = U.lastNDays(range);
    const mins = days.map((d) => Store.minutesOn(d));
    const total = U.sum(mins);
    const quizzes = s.quizResults.filter((r) => days.includes(r.dateISO));
    const acc = quizzes.length ? U.pct(U.sum(quizzes, "score"), U.sum(quizzes, "total")) : null;
    const hwDone = s.homework.filter((h) => h.status === "done").length;
    const ranking = Store.subjectRanking();
    const insights = Tutor.weeklyInsight();
    const bySubject = subjectMinutes(days);
    const chapters = Store.allChapters().slice().sort((a, b) => a.chapter.progress - b.chapter.progress);

    return `
    <div class="page-head">
      <div><div class="page-title">Progress</div>
        <div class="page-sub">What the numbers actually mean</div></div>
      <div class="seg">
        ${[[7, "7 days"], [14, "14 days"], [30, "30 days"]].map(([k, l]) =>
          `<button class="${range === k ? "active" : ""}" data-range="${k}">${l}</button>`).join("")}
      </div>
    </div>

    <div class="stat-row mb16">
      <div class="stat"><div class="k">⏱️ Study time</div><div class="v">${U.fmtMin(total)}</div></div>
      <div class="stat"><div class="k">📅 Daily average</div><div class="v">${U.fmtMin(total / range)}</div></div>
      <div class="stat"><div class="k">❓ Quiz accuracy</div><div class="v">${acc == null ? "—" : acc + "%"}<small>${quizzes.length ? ` · ${quizzes.length}` : ""}</small></div></div>
      <div class="stat"><div class="k">✅ Homework done</div><div class="v">${hwDone}<small>/${s.homework.length}</small></div></div>
    </div>

    <div class="card mb16">
      <div class="card-hd"><h3>📈 Study time</h3>
        <span class="faint f12">${U.fmtDate(days[0])} – ${U.fmtDate(days[days.length - 1])}</span></div>
      ${range <= 14
        ? UI.chart(mins, days.map((d) => U.dayName(d)), { fmt: (v) => v + "m" })
        : heatmap(days, mins)}
    </div>

    <div class="card mb16">
      <div class="card-hd"><h3>🧭 What this means</h3></div>
      ${insights.map((i) => `<div class="mb8">${UI.insight(U.mini(i.text), i.tone, i.ic)}</div>`).join("")}
    </div>

    <div class="grid g2 mb16">
      <div class="card">
        <h3>📚 Time by subject</h3>
        ${Object.keys(bySubject).length ? Object.entries(bySubject).sort((a, b) => b[1] - a[1]).map(([name, m]) => `
          <div class="flex center gap12 mb12">
            <div style="width:130px" class="f13 b7 ellip">${U.esc(name)}</div>
            <div class="grow">${UI.bar(U.pct(m, Math.max(...Object.values(bySubject))), { thin: true })}</div>
            <div style="width:56px;text-align:right" class="f12 b7">${U.fmtMin(m)}</div>
          </div>`).join("") : UI.emptyMini("📚", "No sessions in this range")}
      </div>
      <div class="card">
        <h3>🏅 Subject standings</h3>
        ${ranking.length ? ranking.map((r, i) => `
          <div class="flex center gap12 mb12">
            <div class="lb-rank">${i + 1}</div>
            <div style="width:22px;font-size:16px">${U.esc(r.emoji)}</div>
            <div class="grow f13 b7 ellip">${U.esc(r.name)}</div>
            <div style="width:90px">${UI.bar(r.avg, { thin: true, color: U.gradeColor(r.avg) })}</div>
            <div style="width:38px;text-align:right" class="f12 b7">${r.avg}%</div>
          </div>`).join("") : UI.emptyMini("🏅", "Add subjects to see standings")}
      </div>
    </div>

    <div class="card mb16">
      <div class="card-hd"><h3>🧠 Topic understanding</h3>
        <span class="faint f12">weakest first</span></div>
      ${chapters.length ? `<table class="tbl">
        <thead><tr><th>Topic</th><th>Subject</th><th style="width:34%">Understanding</th><th>Last revised</th></tr></thead>
        <tbody>
          ${chapters.slice(0, 12).map(({ subject, chapter }) => `
            <tr>
              <td class="b7">${U.gradeDot(chapter.progress)} ${U.esc(chapter.name)}</td>
              <td class="muted">${U.esc(subject.name)}</td>
              <td><div class="flex center gap8">${UI.bar(chapter.progress, { thin: true, color: U.gradeColor(chapter.progress) })}
                <span class="f12 b7" style="width:34px;text-align:right">${chapter.progress}%</span></div></td>
              <td class="muted f12">${chapter.lastRevised ? U.relDate(chapter.lastRevised) : "never"}</td>
            </tr>`).join("")}
        </tbody></table>` : UI.emptyMini("🧠", "No chapters yet")}
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>😀 Session confidence</h3>
        ${(() => {
          const sess = s.sessions.filter((x) => days.includes(x.dateISO));
          if (!sess.length) return UI.emptyMini("😐", "No sessions in this range");
          const buckets = [1, 2, 3, 4].map((v) => sess.filter((x) => (x.confidence || 3) === v).length);
          return UI.chart(buckets, ["😕 Low", "😐 Okay", "🙂 Good", "🔥 Great"], { fmt: (v) => v, min: 1 }) +
            `<p class="faint f12 mt8">How you rated yourself right after studying. A cluster on the left usually means the material needs a different approach, not more hours.</p>`;
        })()}
      </div>
      <div class="card">
        <h3>🔥 Streak history</h3>
        <div class="flex center gap16">
          <div>
            <div class="b8" style="font-size:32px">${Store.currentStreak()}</div>
            <div class="muted f12">current streak</div>
          </div>
          <div>
            <div class="b8" style="font-size:32px">${s.streak.best || 0}</div>
            <div class="muted f12">personal best</div>
          </div>
        </div>
        <div class="mt16">${heatmap(U.lastNDays(28), U.lastNDays(28).map((d) => Store.minutesOn(d)), true)}</div>
        <p class="faint f12 mt12">Missing a day doesn't erase your progress. StudyOS keeps a one-day grace period — consistency matters more than perfection.</p>
      </div>
    </div>`;
  };

  function subjectMinutes(days) {
    const out = {};
    Store.state.sessions.filter((x) => days.includes(x.dateISO)).forEach((x) => {
      const k = x.subject || "General";
      out[k] = (out[k] || 0) + x.minutes;
    });
    return out;
  }
  function heatmap(days, mins, compact) {
    const lvl = (m) => m === 0 ? 0 : m < 25 ? 1 : m < 50 ? 2 : m < 90 ? 3 : 4;
    return `<div class="heat">${days.map((d, i) => `<i data-l="${lvl(mins[i])}" title="${U.fmtDate(d)} · ${U.fmtMin(mins[i])}"></i>`).join("")}</div>
      ${compact ? "" : `<div class="flex between mt8">
        <span class="faint f11">${U.fmtDate(days[0])}</span>
        <span class="legend">less ${[0, 1, 2, 3, 4].map((l) => `<i data-l="${l}" style="background:${l === 0 ? "var(--card-3)" : `rgba(108,140,255,${[0, .32, .55, .78, 1][l]})`}"></i>`).join("")} more</span>
        <span class="faint f11">${U.fmtDate(days[days.length - 1])}</span>
      </div>`}`;
  }

  // ============================================================
  //  ACHIEVEMENTS
  // ============================================================
  P.achievements = function () {
    const s = Store.state;
    const li = Store.levelInfo();
    const earned = Store.BADGES.filter((b) => s.badges.includes(b.id));
    const locked = Store.BADGES.filter((b) => !s.badges.includes(b.id));

    return `
    <div class="page-head">
      <div><div class="page-title">Achievements</div>
        <div class="page-sub">${earned.length} of ${Store.BADGES.length} badges · Level ${li.level} ${li.name}</div></div>
    </div>

    <div class="card mb16">
      <div class="flex center gap16 wrap">
        ${UI.ring(li.pct, { label: li.level })}
        <div class="grow">
          <div class="flex center gap8"><span style="font-size:21px">${li.emoji}</span>
            <span class="b8" style="font-size:21px">Level ${li.level} · ${li.name}</span></div>
          <div class="muted f13 mt4">${s.profile.xp} XP total</div>
          <div class="mt12">${UI.bar(li.pct)}</div>
          <div class="faint f12 mt8">${li.next ? `${li.toNext} XP to reach ${li.next.emoji} ${li.next.name}` : "Maximum level reached 🏆"}</div>
        </div>
      </div>
      <div class="mt16">${UI.insight(
        "XP is a nudge, not a scoreboard. It rewards finishing things: a session, a task, a quiz, a deck. If a day goes badly, the XP you already earned stays.",
        "", "⭐")}</div>
    </div>

    <div class="grid g3 mb16">
      ${[["+50 XP", "Study session"], ["+25 XP", "Homework done"], ["+40 XP", "Quiz finished"],
         ["+20 XP", "Flashcard deck"], ["+10 XP", "Note written"], ["+15 XP", "Page analysed"]].map(([x, l]) => `
        <div class="card tight center-txt"><div class="b8" style="font-size:18px;color:var(--brand)">${x}</div>
          <div class="muted f12 mt4">${l}</div></div>`).join("")}
    </div>

    <div class="card mb16">
      <div class="card-hd"><h3>🏆 Earned <span class="muted b7">(${earned.length})</span></h3></div>
      ${earned.length ? `<div class="badge-grid">
        ${earned.map((b) => `<div class="badge"><div class="b-emoji">${b.emoji}</div>
          <div class="b-name">${U.esc(b.name)}</div><div class="b-desc">${U.esc(b.desc)}</div></div>`).join("")}
      </div>` : UI.emptyMini("🔓", "No badges yet — finish a study session to unlock your first")}
    </div>

    <div class="card">
      <div class="card-hd"><h3>🔒 Still locked <span class="muted b7">(${locked.length})</span></h3></div>
      <div class="badge-grid">
        ${locked.map((b) => `<div class="badge locked"><div class="b-emoji">${b.emoji}</div>
          <div class="b-name">${U.esc(b.name)}</div><div class="b-desc">${U.esc(b.desc)}</div></div>`).join("")}
      </div>
    </div>`;
  };

  // ============================================================
  //  FRIENDS & CHALLENGES
  // ============================================================
  P.friends = function () {
    const s = Store.state;
    const me = { name: s.profile.name || "You", avatar: s.profile.avatar || "🎓", xp: s.profile.xp, minutes: U.sum(s.sessions, "minutes"), me: true };
    const board = s.friends.concat([me]).sort((a, b) => b.xp - a.xp);

    return `
    <div class="page-head">
      <div><div class="page-title">Friends &amp; Challenges</div>
        <div class="page-sub">Optional, friendly, and entirely local to this device</div></div>
      <div class="flex gap8">
        <button class="btn" data-add-friend>+ Add friend</button>
        <button class="btn primary" data-add-challenge>+ New challenge</button>
      </div>
    </div>

    ${UI.insight(
      "This is a local social layer — friends you add here are placeholders you control, so nothing is shared and no account is needed. The point is friendly momentum, not academic pressure.",
      "", "🧑‍🤝‍🧑")}
    <div class="mb16"></div>

    <div class="grid g2 mb16">
      <div class="card">
        <div class="card-hd"><h3>🏆 XP leaderboard</h3><span class="faint f12">this device</span></div>
        ${board.map((f, i) => `
          <div class="lb-row ${f.me ? "me" : ""}">
            <div class="lb-rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</div>
            <div class="avatar">${U.esc(f.avatar)}</div>
            <div class="grow">
              <div class="t f13">${U.esc(f.name)}${f.me ? " (you)" : ""}</div>
              <div class="s">${U.fmtMin(f.minutes)} studied</div>
            </div>
            <span class="pill ${f.me ? "brand" : "grey"}">${f.xp} XP</span>
            ${!f.me ? `<button class="icon-btn" data-del-friend="${f.id}">🗑️</button>` : ""}
          </div>`).join("")}
      </div>

      <div class="card">
        <div class="card-hd"><h3>🎯 Active challenges</h3></div>
        ${s.challenges.length ? s.challenges.map((c) => {
          const pct = U.pct(c.progress, c.goal);
          const daysLeft = U.daysBetween(U.todayISO(), c.endsOn);
          return `<div class="item" style="flex-direction:column;align-items:stretch">
            <div class="flex between center">
              <div class="grow"><div class="t">${U.esc(c.title)}</div>
                <div class="s">${c.progress} / ${c.goal} ${U.esc(c.unit)}${c.friends.length ? ` · with ${c.friends.map(U.esc).join(", ")}` : ""}</div></div>
              <span class="pill ${daysLeft <= 1 ? "red" : daysLeft <= 3 ? "yellow" : "brand"}">${daysLeft >= 0 ? `${daysLeft}d left` : "ended"}</span>
              <button class="icon-btn" data-del-challenge="${c.id}">🗑️</button>
            </div>
            <div class="mt12">${UI.bar(pct)}</div>
            <div class="flex between mt8">
              <span class="faint f11">${pct}% complete</span>
              <button class="btn sm" data-bump-challenge="${c.id}">+1 ${U.esc(c.unit.replace(/s$/, ""))}</button>
            </div>
          </div>`;
        }).join("") : UI.emptyMini("🎯", "No challenges running")}
        ${!s.challenges.length ? `<button class="btn sm block mt12" data-add-challenge>+ Start a challenge</button>` : ""}
      </div>
    </div>

    <div class="card">
      <h3>💡 Challenge ideas</h3>
      <div class="chip-grid">
        ${[["7-Day Study Challenge", 7, "days", "🔥"], ["5-Day Math Challenge", 5, "days", "📐"],
           ["100 Questions Challenge", 100, "questions", "❓"], ["10 Hour Week", 600, "minutes", "⏱️"]].map(([title, goal, unit, e]) => `
          <div class="subject-card" data-preset-challenge="${U.esc(title)}|${goal}|${unit}">
            <div class="subject-emoji">${e}</div>
            <div class="subject-name" style="font-size:13.5px;line-height:1.35">${U.esc(title)}</div>
            <div class="muted f12 mt4">${goal} ${unit}</div>
          </div>`).join("")}
      </div>
    </div>`;
  };

  // ============================================================
  //  NOTIFICATIONS
  // ============================================================
  P.notifications = function () {
    const list = Store.notifications();
    const n = Store.state.profile.notif;
    return `
    <div class="page-head">
      <div><div class="page-title">Notifications</div>
        <div class="page-sub">${list.length} thing${list.length !== 1 ? "s" : ""} worth your attention</div></div>
    </div>

    <div class="card mb16">
      <div class="card-hd"><h3>🔔 Right now</h3></div>
      ${list.length ? list.map((x) => `
        <div class="notif">
          <div class="n-ic">${x.ic}</div>
          <div class="n-body"><div class="n-t">${U.esc(x.t)}</div><div class="n-s">${U.esc(x.s)}</div></div>
          <button class="btn sm" data-nav="${x.go}">Open</button>
        </div>`).join("") : UI.emptyMini("✨", "Nothing needs your attention. That's a good sign.")}
    </div>

    <div class="card">
      <div class="card-hd"><h3>⚙️ What you get notified about</h3></div>
      ${[["homework", "Homework and deadlines", "Due tomorrow and overdue tasks"],
         ["revision", "Revision reminders", "Topics you haven't reviewed in a while"],
         ["goal", "Daily goal", "Progress towards today's study target"],
         ["streak", "Streak", "A nudge when your streak is at risk"]].map(([k, t, d]) => `
        <div class="item">
          <div class="grow"><div class="t">${t}</div><div class="s">${d}</div></div>
          <label class="switch"><input type="checkbox" data-notif="${k}" ${n[k] ? "checked" : ""} />
            <span class="track"></span><span class="knob"></span></label>
        </div>`).join("")}
      <p class="faint f12 mt16" style="line-height:1.6">StudyOS doesn't send push notifications or emails — these are in-app only. Nothing is transmitted off this device.</p>
    </div>`;
  };

  // ============================================================
  //  SETTINGS
  // ============================================================
  P.settings = function () {
    const s = Store.state, p = s.profile;
    const acc = Store.account || {};
    const bytes = new Blob([Store.export()]).size;
    const counts = {
      subjects: s.subjects.length,
      chapters: s.subjects.reduce((a, x) => a + x.chapters.length, 0),
      notes: s.subjects.reduce((a, x) => a + x.chapters.reduce((b, c) => b + (c.notes || []).length, 0), 0),
      cards: Store.allCards().length,
      sessions: s.sessions.length,
      tasks: s.homework.length,
    };

    return `
    <div class="page-head">
      <div><div class="page-title">Settings</div>
        <div class="page-sub">Profile, appearance, data and privacy</div></div>
    </div>

    <div class="grid g2 mb16">
      <div class="card">
        <h3>👤 Profile</h3>
        <div class="flex center gap12 mb16">
          <div class="avatar" style="width:48px;height:48px;font-size:24px">${U.esc(p.avatar || "🎓")}</div>
          <div class="grow">
            <div class="b7 f14">${U.esc(p.name || "Student")}</div>
            <div class="muted f12">${acc.provider === "guest" ? "Guest profile" : U.esc(acc.email || "Local account")}</div>
          </div>
          <span class="pill grey">${acc.provider === "google" ? "Google" : acc.provider === "apple" ? "Apple" : acc.provider === "guest" ? "Guest" : "Email"}</span>
        </div>
        <div class="field"><label>Display name</label><input id="st-name" value="${U.esc(p.name)}" /></div>
        <div class="row">
          <div class="field"><label>Class / grade</label><input id="st-class" value="${U.esc(p.className)}" /></div>
          <div class="field"><label>Daily goal (minutes)</label><input id="st-goal" type="number" min="15" max="720" value="${p.dailyGoalMin}" /></div>
        </div>
        <div class="field"><label>Avatar</label>
          <div class="flex gap6 wrap">
            ${["🎓", "🦊", "🐼", "🐨", "🦉", "🚀", "🌟", "🐧", "🍎", "👤"].map((a) =>
              `<button class="av-pick ${p.avatar === a ? "on" : ""}" data-set-avatar="${a}">${a}</button>`).join("")}
          </div></div>
        <button class="btn primary" data-save-profile>Save profile</button>
      </div>

      <div class="card">
        <h3>🎨 Appearance</h3>
        <div class="item">
          <div class="grow"><div class="t">Theme</div><div class="s">Dark is easier at night; light is better in sun</div></div>
          <div class="seg">
            <button class="${p.theme === "dark" ? "active" : ""}" data-set-theme="dark">🌙 Dark</button>
            <button class="${p.theme === "light" ? "active" : ""}" data-set-theme="light">☀️ Light</button>
          </div>
        </div>
        <h3 class="mt24">💎 StudyOS Pro</h3>
        <div class="item">
          <div class="grow"><div class="t">Pro features preview</div>
            <div class="s">Unlocks the advanced tutor prompts, unlimited quiz generation and deeper analytics. In this build it's a local toggle — nothing is charged.</div></div>
          <label class="switch"><input type="checkbox" data-toggle-pro ${p.pro ? "checked" : ""} />
            <span class="track"></span><span class="knob"></span></label>
        </div>
      </div>
    </div>

    <div class="card mb16">
      <div class="card-hd"><h3>💾 Your data</h3><span class="pill grey">${(bytes / 1024).toFixed(1)} KB</span></div>
      <div class="stat-row mb16" style="grid-template-columns:repeat(6,1fr)">
        ${Object.entries(counts).map(([k, v]) => `
          <div class="stat" style="box-shadow:none;padding:12px"><div class="k" style="font-size:11px">${k}</div>
            <div class="v" style="font-size:20px">${v}</div></div>`).join("")}
      </div>
      <div class="flex gap8 wrap">
        <button class="btn" data-export>⬇️ Export backup (.json)</button>
        <button class="btn" data-import>⬆️ Import backup</button>
        <button class="btn" data-seed-demo>🌱 Load sample data</button>
        <button class="btn danger" data-reset-data>Reset all data</button>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden />
    </div>

    ${dbCard()}

    <div class="card mb16">
      <h3>🔒 Privacy</h3>
      <div class="muted f13" style="line-height:1.8">
        <p><b style="color:var(--text)">Everything is stored in this browser.</b> Your notes, tasks, sessions, quiz results and flashcards live in this device's local storage. There is no server and no account database.</p>
        <p class="mt8"><b style="color:var(--text)">The tutor runs offline.</b> Explanations, hints and quiz generation are rule-based and computed locally, so nothing you type is transmitted anywhere.</p>
        <p class="mt8"><b style="color:var(--text)">Sign-in is local.</b> "Continue with Google/Apple" creates a profile on this device only — it does not contact those providers. Email passwords are hashed locally, which is fine for separating profiles on one device but is not real server-side authentication.</p>
        <p class="mt8"><b style="color:var(--text)">Clearing your browser data deletes everything.</b> Export a backup regularly if the data matters to you.</p>
      </div>
    </div>

    <div class="card">
      <h3>🔑 Account</h3>
      ${acc.provider === "guest" ? `
        <div class="item">
          <div class="grow"><div class="t">You're using a guest profile</div>
            <div class="s">Upgrade to a named account and keep everything you've done so far.</div></div>
          <button class="btn primary sm" data-upgrade-guest>Upgrade</button>
        </div>` : ""}
      <div class="flex gap8 wrap mt12">
        <button class="btn" data-sign-out>Sign out</button>
        <button class="btn danger" data-delete-account>Delete this account</button>
      </div>
      <p class="faint f12 mt12">Signing out keeps your data on this device — you can sign back into the same profile from the start screen.</p>
    </div>`;
  };

  // ============================================================
  //  ONBOARDING
  // ============================================================
  P.onboard = function () {
    const step = App.route.obStep || 1;
    const draft = App.obDraft;
    return `
    <div class="ob-wrap">
      <div class="logo lg" style="justify-content:center;padding-bottom:8px">
        ${Logo.svg(40)}<div class="logo-text">Study<span>OS</span></div>
      </div>
      <div class="ob-steps">${[1, 2, 3].map((i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>

      ${step === 1 ? `
        <div class="card">
          <h2 style="font-size:19px;margin-bottom:6px">Let's set up your profile</h2>
          <p class="muted f13 mb16">Takes about 30 seconds. You can change all of it later.</p>
          <div class="field"><label>What should we call you?</label>
            <input id="ob-name" value="${U.esc(draft.name || Store.state.profile.name || "")}" placeholder="e.g. Aarav" /></div>
          <div class="row">
            <div class="field"><label>Class / grade</label>
              <input id="ob-class" value="${U.esc(draft.className || "Class 9")}" /></div>
            <div class="field"><label>Daily study goal</label>
              <select id="ob-goal">
                ${[60, 90, 120, 150, 180, 240].map((m) => `<option value="${m}" ${(draft.goal || 120) === m ? "selected" : ""}>${U.fmtMin(m)}</option>`).join("")}
              </select></div>
          </div>
          <button class="btn primary block lg" data-ob-next="2">Continue →</button>
        </div>` : ""}

      ${step === 2 ? `
        <div class="card">
          <h2 style="font-size:19px;margin-bottom:6px">Which subjects are you taking?</h2>
          <p class="muted f13 mb16">Pick as many as you like — you can add your own later.</p>
          <div class="pick-grid mb16">
            ${SUBJECT_PRESETS.map((s) => `
              <button class="pick ${draft.subjects.includes(s.name) ? "on" : ""}" data-ob-subject="${U.esc(s.name)}">
                <span style="font-size:17px">${s.emoji}</span><span>${U.esc(s.name)}</span>
              </button>`).join("")}
          </div>
          <div class="flex gap8">
            <button class="btn" data-ob-next="1">← Back</button>
            <button class="btn primary grow" data-ob-next="3">Continue →</button>
          </div>
        </div>` : ""}

      ${step === 3 ? `
        <div class="card">
          <h2 style="font-size:19px;margin-bottom:6px">How do you want to start?</h2>
          <p class="muted f13 mb16">Sample data fills StudyOS with example chapters, tasks and history so you can see how everything works.</p>
          <button class="btn block" style="justify-content:flex-start;padding:15px;text-align:left" data-ob-finish="demo">
            <span style="font-size:21px;margin-right:11px">🌱</span>
            <span><span class="b7 f14" style="display:block">Start with sample data</span>
              <span class="faint f12">Recommended for your first look around</span></span>
          </button>
          <button class="btn block mt8" style="justify-content:flex-start;padding:15px;text-align:left" data-ob-finish="clean">
            <span style="font-size:21px;margin-right:11px">📄</span>
            <span><span class="b7 f14" style="display:block">Start clean</span>
              <span class="faint f12">Just my subjects, nothing else</span></span>
          </button>
          <button class="btn ghost block mt12" data-ob-next="2">← Back</button>
        </div>` : ""}

      <p class="faint f11 center-txt mt16">🔒 Everything stays on this device.</p>
    </div>`;
  };

  /**
   * The SQLite panel. Shows which engine won, the schema version, an
   * integrity check and the real .sqlite/.json export buttons. Hidden
   * entirely when SQLite could not start — there is nothing to say.
   */
  function dbCard() {
    if (!global.DB || !DB.available) {
      const why = global.DB && DB.lastError ? U.esc(DB.lastError) : "the SQLite engine did not start";
      return `
      <div class="card mb16">
        <div class="card-hd"><h3>🗄️ Database</h3><span class="pill grey">localStorage</span></div>
        <p class="muted f13">Running on the browser storage engine because ${why}. Everything still works and stays on this device; you just don't get the SQL file. Reload with <code>vendor/sql-wasm.js</code> present to switch on SQLite.</p>
      </div>`;
    }

    const h = DB.health();
    const ok = /^ok$/i.test(h.integrity);
    return `
    <div class="card mb16">
      <div class="card-hd"><h3>🗄️ Database</h3>
        <span class="pill ${ok ? "green" : "yellow"}">SQLite · schema v${h.schemaVersion}</span></div>
      <div class="stat-row mb16" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat" style="box-shadow:none;padding:12px"><div class="k" style="font-size:11px">file size</div>
          <div class="v" style="font-size:20px">${(h.bytes / 1024).toFixed(0)} KB</div></div>
        <div class="stat" style="box-shadow:none;padding:12px"><div class="k" style="font-size:11px">integrity</div>
          <div class="v" style="font-size:20px">${ok ? "ok" : U.esc(String(h.integrity))}</div></div>
        <div class="stat" style="box-shadow:none;padding:12px"><div class="k" style="font-size:11px">chapters</div>
          <div class="v" style="font-size:20px">${h.counts.chapters}</div></div>
        <div class="stat" style="box-shadow:none;padding:12px"><div class="k" style="font-size:11px">sessions</div>
          <div class="v" style="font-size:20px">${h.counts.sessions}</div></div>
      </div>
      <div class="flex gap8 wrap">
        <button class="btn primary" data-export-sqlite>⬇️ Export database (.sqlite)</button>
        <button class="btn" data-import-sqlite>⬆️ Restore from .sqlite</button>
      </div>
      <input type="file" id="importSqlite" accept=".sqlite,.db,application/octet-stream" hidden />
      <p class="faint f12 mt12" style="line-height:1.6">The exported file is a real SQLite database — open it in DB Browser for SQLite or any SQL tool. Schema, migrations and views live in <code>db/</code>.</p>
    </div>`;
  }

  const SUBJECT_PRESETS = [
    { name: "Mathematics", emoji: "📐", chapters: ["Number Systems", "Polynomials", "Coordinate Geometry", "Linear Equations", "Statistics"] },
    { name: "Science", emoji: "🧪", chapters: ["Atoms & Molecules", "Cell Structure", "Chemical Reactions", "Motion & Force"] },
    { name: "Social Science", emoji: "🌍", chapters: ["French Revolution", "Physical Features of India", "Democracy"] },
    { name: "English", emoji: "📖", chapters: ["Grammar", "Comprehension", "Writing Skills"] },
    { name: "Hindi", emoji: "📕", chapters: ["व्याकरण", "गद्य", "काव्य"] },
    { name: "Computer Science", emoji: "💻", chapters: ["Basics", "Programming", "Networks"] },
  ];
  P.SUBJECT_PRESETS = SUBJECT_PRESETS;

  global.PagesMeta = P;
})(window);
