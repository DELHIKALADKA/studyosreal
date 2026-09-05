/* ============================================================
   StudyOS — ui.js
   Shared UI primitives: toast, modal, confirm, small builders.
   ============================================================ */
(function (global) {
  "use strict";

  const UI = {
    // ---------- toast ----------
    toast(msg, ms) {
      const stack = document.getElementById("toastRoot");
      const el = document.createElement("div");
      el.className = "toast";
      el.innerHTML = U.esc(msg);
      stack.appendChild(el);
      setTimeout(() => { el.style.transition = "opacity .25s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 260); }, ms || 2400);
    },

    // ---------- modal ----------
    open(html, opts) {
      const o = opts || {};
      document.getElementById("modalRoot").innerHTML =
        `<div class="overlay" data-overlay><div class="modal ${o.wide ? "wide" : ""}">${html}</div></div>`;
      const ov = document.querySelector("[data-overlay]");
      ov.onclick = (e) => { if (e.target === ov) UI.close(); };
      document.querySelectorAll("[data-close]").forEach((el) => el.onclick = () => UI.close());
      const first = document.querySelector(".modal input, .modal textarea, .modal select");
      if (first) setTimeout(() => first.focus(), 40);
      if (o.onOpen) o.onOpen();
      UI._esc = (e) => { if (e.key === "Escape") UI.close(); };
      document.addEventListener("keydown", UI._esc);
    },
    close() {
      document.getElementById("modalRoot").innerHTML = "";
      if (UI._esc) { document.removeEventListener("keydown", UI._esc); UI._esc = null; }
    },
    /** Simple confirm dialog. cb(true) on confirm. */
    confirm(title, body, cb, opts) {
      const o = opts || {};
      UI.open(`
        <h2>${U.esc(title)}</h2>
        <p class="muted f13 mb16" style="line-height:1.6">${body}</p>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn ${o.danger ? "danger" : "primary"}" id="ui-confirm">${U.esc(o.ok || "Confirm")}</button>
        </div>`);
      document.getElementById("ui-confirm").onclick = () => { UI.close(); cb(true); };
    },
    /** Single-field prompt. cb(value) */
    prompt(title, label, value, cb, opts) {
      const o = opts || {};
      UI.open(`
        <h2>${U.esc(title)}</h2>
        <div class="field"><label>${U.esc(label)}</label>
          ${o.textarea
            ? `<textarea id="ui-input" rows="5">${U.esc(value || "")}</textarea>`
            : `<input id="ui-input" value="${U.esc(value || "")}" placeholder="${U.esc(o.placeholder || "")}" />`}</div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn primary" id="ui-ok">${U.esc(o.ok || "Save")}</button>
        </div>`);
      const go = () => { const v = document.getElementById("ui-input").value.trim(); if (!v) return; UI.close(); cb(v); };
      document.getElementById("ui-ok").onclick = go;
      const inp = document.getElementById("ui-input");
      if (!o.textarea) inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
    },

    // ---------- small builders ----------
    val(id) { const el = document.getElementById(id); return el ? String(el.value).trim() : ""; },
    num(id, dflt) { const v = parseInt(UI.val(id), 10); return isNaN(v) ? (dflt || 0) : v; },

    bar(pct, opts) {
      const o = opts || {};
      return `<div class="bar ${o.thin ? "thin" : ""}"><span style="width:${U.clamp(pct, 0, 100)}%${o.color ? `;background:${o.color}` : ""}"></span></div>`;
    },
    ring(pct, opts) {
      const o = opts || {};
      return `<div class="ring ${o.sm ? "sm" : ""}" style="--p:${U.clamp(pct, 0, 100)}"><div class="ring-val">${o.label != null ? o.label : pct + "%"}</div></div>`;
    },
    empty(emoji, title, sub, action) {
      return `<div class="card"><div class="empty">
        <div class="e-emoji">${emoji}</div>
        <div class="b7" style="color:var(--text);font-size:15.5px">${U.esc(title)}</div>
        <div class="mt8 f13" style="max-width:340px;margin:8px auto 0;line-height:1.6">${U.esc(sub || "")}</div>
        ${action ? `<div class="mt16">${action}</div>` : ""}
      </div></div>`;
    },
    emptyMini(emoji, text) {
      return `<div class="empty-mini"><div class="e-emoji">${emoji}</div>${U.esc(text)}</div>`;
    },
    insight(text, tone, ic) {
      return `<div class="insight ${tone || ""}"><div class="i-ic">${ic || "💡"}</div><div>${text}</div></div>`;
    },
    chart(values, labels, opts) {
      const o = opts || {};
      const max = Math.max(o.min || 30, ...values);
      return `<div class="chart">${values.map((v, i) => {
        const h = Math.round((v / max) * 132);
        return `<div class="col">
          <div class="track"><div class="fill ${v === 0 ? "dim" : ""}" style="height:${Math.max(3, h)}px" title="${U.esc(o.fmt ? o.fmt(v) : v)}"></div></div>
          <div class="faint f11 mt8">${U.esc(labels[i])}</div>
          <div class="faint f11">${U.esc(o.fmt ? o.fmt(v) : v)}</div>
        </div>`;
      }).join("")}</div>`;
    },
    subjectSelect(id, selected, opts) {
      const o = opts || {};
      const names = Store.state.subjects.map((s) => s.name);
      const extra = o.extra || [];
      const all = names.concat(extra.filter((e) => !names.includes(e)));
      const list = all.length ? all : ["General"];
      return `<select id="${id}">${o.blank ? `<option value="">${U.esc(o.blank)}</option>` : ""}${
        list.map((n) => `<option ${n === selected ? "selected" : ""}>${U.esc(n)}</option>`).join("")}</select>`;
    },
    chapterSelect(id, subjectName, selected) {
      const s = Store.state.subjects.find((x) => x.name === subjectName);
      const chs = s ? s.chapters : [];
      return `<select id="${id}"><option value="">— none —</option>${
        chs.map((c) => `<option ${c.name === selected ? "selected" : ""}>${U.esc(c.name)}</option>`).join("")}</select>`;
    },
  };

  global.UI = UI;
})(window);
