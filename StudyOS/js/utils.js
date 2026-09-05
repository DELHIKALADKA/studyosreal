/* ============================================================
   StudyOS — utils.js
   Pure helpers: ids, dates, formatting, escaping, math.
   ============================================================ */
(function (global) {
  "use strict";

  const U = {};

  // ---------- ids ----------
  U.uid = function () {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  };

  // ---------- escaping ----------
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  U.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]); };

  /** Very small inline markdown: **bold**, *italic*, `code`, line breaks preserved by CSS. */
  U.mini = function (s) {
    return U.esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|\s)\*([^*\n]+)\*/g, "$1<i>$2</i>")
      .replace(/`([^`]+)`/g, '<code style="background:var(--card-3);padding:1px 5px;border-radius:5px;font-size:12.5px">$1</code>');
  };

  // ---------- dates ----------
  U.todayISO = function () { return U.toISO(new Date()); };
  U.toISO = function (d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  U.addDays = function (iso, n) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return U.toISO(d);
  };
  U.daysBetween = function (a, b) {
    return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
  };
  U.lastNDays = function (n, endISO) {
    const end = endISO || U.todayISO();
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(U.addDays(end, -i));
    return out;
  };
  U.fmtDate = function (iso) {
    if (!iso) return "—";
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  U.fmtDateLong = function (iso) {
    if (!iso) return "—";
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" });
  };
  U.dayName = function (iso, long) {
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: long ? "long" : "short" });
  };
  U.relDate = function (iso) {
    if (!iso) return "no date";
    const d = U.daysBetween(U.todayISO(), iso);
    if (d === 0) return "today";
    if (d === 1) return "tomorrow";
    if (d === -1) return "yesterday";
    return d < 0 ? `${-d}d ago` : `in ${d}d`;
  };
  U.weekStart = function (iso) {
    const base = iso || U.todayISO();
    const d = new Date(base + "T12:00:00");
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    return U.addDays(base, -dow);
  };
  U.greeting = function () {
    const h = new Date().getHours();
    return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  // ---------- numbers ----------
  U.fmtMin = function (m) {
    m = Math.max(0, Math.round(m || 0));
    const h = Math.floor(m / 60), mm = m % 60;
    if (!h) return `${mm}m`;
    return mm ? `${h}h ${mm}m` : `${h}h`;
  };
  U.clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  U.pct = function (a, b) { return b ? Math.round((a / b) * 100) : 0; };
  U.avg = function (arr) { return arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : 0; };
  U.sum = function (arr, key) { return arr.reduce((a, b) => a + (key ? (b[key] || 0) : b), 0); };
  U.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.groupBy = function (arr, fn) {
    return arr.reduce((acc, x) => { const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});
  };

  // ---------- classification ----------
  U.gradeBand = function (p) { return p >= 80 ? "green" : p >= 60 ? "yellow" : "red"; };
  U.gradeDot = function (p) { return p >= 80 ? "🟢" : p >= 60 ? "🟡" : "🔴"; };
  U.gradeColor = function (p) { return p >= 80 ? "var(--green)" : p >= 60 ? "var(--yellow)" : "var(--red)"; };
  U.diffLabel = function (d) { return d >= 3 ? "🔴 Hard" : d === 2 ? "🟡 Medium" : "🟢 Easy"; };
  U.diffPill = function (d) {
    const cls = d >= 3 ? "red" : d === 2 ? "yellow" : "green";
    return `<span class="pill ${cls}">${U.diffLabel(d)}</span>`;
  };

  // ---------- crypto-ish ----------
  U.hash = async function (str) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("studyos$" + str));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback for non-secure contexts: not cryptographic, but this is a local-only demo store.
      let h = 0;
      for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
      return "fb" + (h >>> 0).toString(16);
    }
  };

  U.initials = function (name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  };

  U.validEmail = function (e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim()); };

  U.download = function (filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  U.sleep = function (ms) { return new Promise((r) => setTimeout(r, ms)); };

  global.U = U;
})(window);
