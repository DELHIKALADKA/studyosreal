/* ============================================================
   StudyOS — auth.js
   Local account screen: Google, Apple, email, or guest.

   IMPORTANT: this is local-only authentication. There is no
   server, so "Continue with Google/Apple" simulates the OAuth
   handshake and creates a local profile. Nothing leaves the
   device. Swap `mockOAuth` for a real OAuth flow when you add
   a backend — the rest of the app already works per-account.
   ============================================================ */
(function (global) {
  "use strict";

  const Auth = {
    mode: "landing", // landing | email-signin | email-signup | oauth
    pendingProvider: null,
    error: "",

    isSignedIn() { return !!Store.activeAccountId(); },

    /** Entry point on page load: resume the last profile, or show the sign-in screen. */
    mount() {
      const id = Store.activeAccountId();
      if (id && Store.findAccountById(id)) return App.boot();
      Auth.mode = "landing";
      Auth.render();
    },

    render() {
      const root = document.getElementById("authRoot");
      root.style.display = "";
      document.getElementById("appRoot").style.display = "none";
      root.innerHTML = this.view();
      this.wire();
    },

    view() {
      if (this.mode === "oauth") return this.viewOAuth();
      if (this.mode === "email-signin") return this.viewEmail(false);
      if (this.mode === "email-signup") return this.viewEmail(true);
      return this.viewLanding();
    },

    viewLanding() {
      const existing = Store.accounts();
      return `
      <div class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">
            ${Logo.svg(46)}
            <div>
              <div class="logo-text" style="font-size:23px">Study<span>OS</span></div>
              <div class="faint f12">Your personal study operating system</div>
            </div>
          </div>

          <p class="auth-tag">Plan. Study. Practice. Improve.</p>

          <button class="oauth-btn" data-oauth="google">
            <span class="oauth-ic">${GOOGLE_SVG}</span>
            <span>Continue with Google</span>
          </button>
          <button class="oauth-btn apple" data-oauth="apple">
            <span class="oauth-ic">${APPLE_SVG}</span>
            <span>Continue with Apple</span>
          </button>

          <div class="auth-div"><span>or</span></div>

          <button class="btn block" data-mode="email-signup">✉️ Sign up with email</button>
          <button class="btn ghost block mt8" data-mode="email-signin">I already have an account</button>

          <div class="auth-div"><span>or</span></div>

          <button class="btn block guest-btn" data-guest>
            👤 Continue as guest
          </button>
          <p class="faint f11 center-txt mt8" style="line-height:1.55">
            Guest mode keeps everything on this device. No email, no account.<br>You can upgrade later without losing your data.
          </p>

          ${existing.length ? `
            <div class="auth-div"><span>saved on this device</span></div>
            ${existing.map((u) => `
              <button class="acct-row" data-use-account="${u.id}">
                <span class="avatar">${U.esc(u.avatar || "🎓")}</span>
                <span class="grow" style="text-align:left">
                  <span class="t f13 b7" style="display:block">${U.esc(u.name)}</span>
                  <span class="faint f11">${u.provider === "guest" ? "Guest profile" : U.esc(u.email || u.provider)}</span>
                </span>
                <span class="pill grey">${providerLabel(u.provider)}</span>
              </button>`).join("")}
          ` : ""}

          <p class="faint f11 center-txt mt16" style="line-height:1.6">
            🔒 StudyOS stores your data in this browser only. Sign-in creates a local profile —
            no data is sent anywhere.
          </p>
        </div>

        <div class="auth-side">
          ${[
            ["🏠", "Smart dashboard", "Everything due today in one place"],
            ["🧠", "Offline study tutor", "Explanations, hints and quizzes without internet"],
            ["🔁", "Smart revision", "Tells you what to revise, and when"],
            ["📊", "Real analytics", "Not just numbers — what they mean"],
          ].map(([e, t, s]) => `
            <div class="auth-feat">
              <div class="af-ic">${e}</div>
              <div><div class="b7 f14">${t}</div><div class="faint f12 mt4">${s}</div></div>
            </div>`).join("")}
        </div>
      </div>`;
    },

    viewOAuth() {
      const p = this.pendingProvider;
      const label = p === "google" ? "Google" : "Apple";
      return `
      <div class="auth-shell single">
        <div class="auth-card center-txt">
          <div class="oauth-ic big">${p === "google" ? GOOGLE_SVG : APPLE_SVG}</div>
          <h2 class="mt16" style="font-size:19px">Continue with ${label}</h2>
          <p class="muted f13 mt8" style="line-height:1.6">
            This is a local demo of the ${label} sign-in flow. StudyOS has no server, so no
            request is made to ${label} and nothing leaves your device.
          </p>
          <div class="card tight mt16" style="text-align:left;background:var(--card-2)">
            <div class="field"><label>Name</label><input id="oa-name" placeholder="Your name" /></div>
            <div class="field" style="margin:0"><label>${label} email</label>
              <input id="oa-email" placeholder="you@${p === "google" ? "gmail.com" : "icloud.com"}" /></div>
          </div>
          ${this.error ? `<p class="f12 mt8" style="color:var(--red)">${U.esc(this.error)}</p>` : ""}
          <button class="btn primary block lg mt16" data-oauth-confirm>Continue as this account</button>
          <button class="btn ghost block mt8" data-mode="landing">← Back</button>
        </div>
      </div>`;
    },

    viewEmail(isSignup) {
      return `
      <div class="auth-shell single">
        <div class="auth-card">
          <div class="auth-brand" style="justify-content:center">
            ${Logo.svg(32)}
            <div class="logo-text" style="font-size:19px">Study<span>OS</span></div>
          </div>
          <h2 class="center-txt" style="font-size:19px;margin:6px 0 4px">${isSignup ? "Create your account" : "Welcome back"}</h2>
          <p class="muted f12 center-txt mb16">${isSignup ? "Stored locally on this device." : "Sign in to your local profile."}</p>

          ${isSignup ? `<div class="field"><label>Name</label><input id="em-name" placeholder="e.g. Aarav" /></div>` : ""}
          <div class="field"><label>Email</label><input id="em-email" type="email" placeholder="you@example.com" /></div>
          <div class="field"><label>Password</label><input id="em-pass" type="password" placeholder="At least 6 characters" /></div>
          ${isSignup ? `<div class="field"><label>Pick an avatar</label>
            <div class="flex gap6 wrap" id="av-row">
              ${["🎓","🦊","🐼","🐨","🦉","🚀","🌟","🐧"].map((a, i) => `<button class="av-pick ${i === 0 ? "on" : ""}" data-av="${a}">${a}</button>`).join("")}
            </div></div>` : ""}

          ${this.error ? `<p class="f12 mb12" style="color:var(--red)">${U.esc(this.error)}</p>` : ""}

          <button class="btn primary block lg" data-email-submit="${isSignup ? "signup" : "signin"}">
            ${isSignup ? "Create account" : "Sign in"}
          </button>
          <button class="btn ghost block mt8" data-mode="${isSignup ? "email-signin" : "email-signup"}">
            ${isSignup ? "I already have an account" : "Create a new account"}
          </button>
          <button class="btn ghost block mt8" data-mode="landing">← All sign-in options</button>
          <p class="faint f11 center-txt mt16">Passwords are hashed and stored locally. This is not a substitute for real server-side auth.</p>
        </div>
      </div>`;
    },

    wire() {
      const root = document.getElementById("authRoot");
      root.querySelectorAll("[data-mode]").forEach((el) => el.onclick = () => {
        this.mode = el.dataset.mode; this.error = ""; this.render();
      });
      root.querySelectorAll("[data-oauth]").forEach((el) => el.onclick = () => {
        this.pendingProvider = el.dataset.oauth; this.mode = "oauth"; this.error = ""; this.render();
      });
      const oc = root.querySelector("[data-oauth-confirm]");
      if (oc) oc.onclick = () => this.confirmOAuth();

      root.querySelectorAll("[data-av]").forEach((el) => el.onclick = () => {
        root.querySelectorAll("[data-av]").forEach((x) => x.classList.remove("on"));
        el.classList.add("on");
      });
      const es = root.querySelector("[data-email-submit]");
      if (es) es.onclick = () => this.submitEmail(es.dataset.emailSubmit === "signup");
      root.querySelectorAll("input").forEach((inp) => inp.onkeydown = (e) => {
        if (e.key === "Enter") { const b = root.querySelector("[data-email-submit], [data-oauth-confirm]"); if (b) b.click(); }
      });

      const g = root.querySelector("[data-guest]");
      if (g) g.onclick = () => this.guest();
      root.querySelectorAll("[data-use-account]").forEach((el) => el.onclick = () => {
        Store.signIn(el.dataset.useAccount);
        App.boot();
      });
    },

    confirmOAuth() {
      const name = (document.getElementById("oa-name").value || "").trim();
      const email = (document.getElementById("oa-email").value || "").trim();
      if (!name) { this.error = "Enter a name to continue."; return this.render(); }
      if (!U.validEmail(email)) { this.error = "That doesn't look like a valid email."; return this.render(); }

      const existing = Store.findAccount(email, this.pendingProvider);
      if (existing) { Store.signIn(existing.id); return App.boot(); }

      const acc = Store.createAccount({ name, email, provider: this.pendingProvider, avatar: this.pendingProvider === "apple" ? "🍎" : "🎓" });
      Store.signIn(acc.id);
      App.boot({ fresh: true });
    },

    async submitEmail(isSignup) {
      const email = (document.getElementById("em-email").value || "").trim();
      const pass = document.getElementById("em-pass").value || "";
      if (!U.validEmail(email)) { this.error = "Enter a valid email address."; return this.render(); }
      if (pass.length < 6) { this.error = "Password must be at least 6 characters."; return this.render(); }

      const hash = await U.hash(pass);

      if (isSignup) {
        const name = (document.getElementById("em-name").value || "").trim();
        if (!name) { this.error = "What should we call you?"; return this.render(); }
        if (Store.findAccount(email)) { this.error = "An account with that email already exists on this device."; return this.render(); }
        const av = document.querySelector("[data-av].on");
        const acc = Store.createAccount({ name, email, provider: "email", passHash: hash, avatar: av ? av.dataset.av : "🎓" });
        Store.signIn(acc.id);
        App.boot({ fresh: true });
      } else {
        const acc = Store.findAccount(email);
        if (!acc) { this.error = "No account found with that email on this device."; return this.render(); }
        if (acc.provider !== "email") { this.error = `That email is registered via ${providerLabel(acc.provider)}. Use that option instead.`; return this.render(); }
        if (acc.passHash !== hash) { this.error = "Incorrect password."; return this.render(); }
        Store.signIn(acc.id);
        App.boot();
      }
    },

    guest() {
      const existing = Store.findGuest();
      if (existing) { Store.signIn(existing.id); return App.boot(); }
      const acc = Store.createAccount({ name: "Guest", provider: "guest", avatar: "👤" });
      Store.signIn(acc.id);
      App.boot({ fresh: true });
    },
  };

  function providerLabel(p) {
    return p === "google" ? "Google" : p === "apple" ? "Apple" : p === "guest" ? "Guest" : "Email";
  }

  const GOOGLE_SVG = `<svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg>`;
  const APPLE_SVG = `<svg viewBox="0 0 384 512" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-36.8-2.8-77 21.3-91.7 21.3-15.6 0-51.2-20.3-79.4-20.3C61.7 141.2 8 184.5 8 271.6c0 25.8 4.7 52.4 14.1 79.9 12.6 36.1 61.6 124.6 112.7 123 26.7-.6 45.6-18.9 80.4-18.9 33.7 0 51.2 18.9 80.4 18.9 51.5-.7 95.8-81.1 107.8-117.3-68.9-32.5-84.7-95.2-84.7-88.5zM255.2 105.9c25.4-30.1 23.1-57.5 22.3-67.3-22.4 1.3-48.3 15.3-63.1 32.5-16.3 18.5-25.9 41.3-23.8 66.9 24.2 1.9 46.3-10.5 64.6-32.1z"/></svg>`;

  global.Auth = Auth;
})(window);
