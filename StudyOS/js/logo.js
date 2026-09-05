/* ============================================================
   StudyOS — logo.js
   The brand mark: graduation cap over an open book.
   One geometry, two palettes. The ink and tile colours come from
   CSS custom properties (--logo-ink / --logo-tile), so the light
   theme renders navy-on-white and the dark theme white-on-charcoal
   without a second asset.
   ============================================================ */
(function (global) {
  "use strict";

  let seq = 0;

  const Logo = {
    /**
     * Inline SVG brand mark.
     * @param {number} size  px (square)
     * @param {object} opts  { tile:false } to drop the rounded background
     */
    svg(size, opts) {
      const o = opts || {};
      const id = "lg" + (++seq);
      const s = size || 40;
      return `
<svg class="logo-svg" width="${s}" height="${s}" viewBox="0 0 64 64" fill="none"
     role="img" aria-label="StudyOS">
  <defs>
    <linearGradient id="${id}a" x1="14" y1="30" x2="32" y2="50" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2f7cf6"/><stop offset="1" stop-color="#6aa8ff"/>
    </linearGradient>
    <linearGradient id="${id}b" x1="50" y1="30" x2="32" y2="50" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2fc39a"/><stop offset="1" stop-color="#57d9b0"/>
    </linearGradient>
  </defs>

  ${o.tile === false ? "" : `<rect x="1.5" y="1.5" width="61" height="61" rx="15"
      fill="var(--logo-tile)" stroke="var(--logo-edge)" stroke-width="1"/>`}

  <!-- book cover -->
  <path d="M32 32.5C26.2 26.9 19.4 24.8 11.5 24.8V47.4C19.4 47.4 26.2 49.5 32 55.1
           C37.8 49.5 44.6 47.4 52.5 47.4V24.8C44.6 24.8 37.8 26.9 32 32.5Z"
        fill="var(--logo-ink)"/>

  <!-- pages -->
  <path d="M31 35.8C26.4 31.4 21.2 29.6 15.3 29.5V43.6C21.2 43.7 26.4 45.5 31 49.6Z"
        fill="url(#${id}a)" stroke="var(--logo-tile)" stroke-width="2.1" stroke-linejoin="round"/>
  <path d="M33 35.8C37.6 31.4 42.8 29.6 48.7 29.5V43.6C42.8 43.7 37.6 45.5 33 49.6Z"
        fill="url(#${id}b)" stroke="var(--logo-tile)" stroke-width="2.1" stroke-linejoin="round"/>

  <!-- mortarboard -->
  <path d="M22.5 19.5V27.2C22.5 30.4 41.5 30.4 41.5 27.2V19.5Z" fill="var(--logo-ink)"/>
  <path d="M32 6.4 55.6 16.1 32 25.8 8.4 16.1Z" fill="var(--logo-ink)"
        stroke="var(--logo-tile)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M48.4 20.2V27.4" stroke="var(--logo-ink)" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="48.4" cy="29.4" r="2.4" fill="var(--logo-ink)"/>
</svg>`;
    },

    /** Full lockup: mark + wordmark. */
    lockup(size, opts) {
      const o = opts || {};
      return `<div class="logo ${o.lg ? "lg" : ""}" ${o.nav ? 'data-nav="dashboard"' : ""}>
        ${Logo.svg(size || 34)}
        <div class="logo-text">Study<span>OS</span></div>
      </div>`;
    },
  };

  global.Logo = Logo;
})(window);
