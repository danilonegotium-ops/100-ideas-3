// CSS Animation Library — app logic.
// Depends on ANIMATIONS + CATEGORIES from data.js (loaded first via
// <script src="data.js">).

/**
 * Pure filter helper — kept standalone so it can be sanity-checked with a
 * plain node script without touching the DOM.
 * @param {{id:string,name:string}[]} list
 * @param {string} query
 * @returns {{id:string,name:string}[]}
 */
function filterAnimations(list, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return list.slice();
  return list.filter((a) => a.name.toLowerCase().includes(q) || a.id.includes(q));
}

/**
 * Pure category filter — "all" (or falsy) returns every item untouched.
 * @param {{id:string,category:string}[]} list
 * @param {string} categoryId
 * @returns {{id:string,category:string}[]}
 */
function filterByCategory(list, categoryId) {
  if (!categoryId || categoryId === "all") return list.slice();
  return list.filter((a) => a.category === categoryId);
}

/**
 * Reads the duration + timing-function straight out of an animation's own
 * CSS text, so the meta line shown on each card can never drift from the
 * code that actually gets copied.
 * @param {string} css
 * @returns {string}
 */
function describeAnimationMeta(css) {
  const m = css.match(/animation:\s*[\w-]+\s+([\d.]+s)\s+([^\s;]+)/);
  if (!m) return "";
  const duration = m[1];
  const timing = m[2].startsWith("cubic-bezier") ? "custom ease" : m[2];
  return duration + " · " + timing;
}

// Export for the node sanity-check script; harmless in the browser.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { filterAnimations, filterByCategory, describeAnimationMeta };
}

(function initCssAnimationLibrary() {
  // Guard: this IIFE only runs in a browser context (has `document`).
  if (typeof document === "undefined") return;

  const grid = document.getElementById("grid");
  const search = document.getElementById("search");
  const count = document.getElementById("count");
  const catNav = document.getElementById("catNav");
  const catChips = document.getElementById("catChips");
  const emptyState = document.getElementById("emptyState");
  const emptyQuery = document.getElementById("emptyQuery");

  const state = { query: "", category: "all" };

  // 1. Inject every animation's CSS (class + @keyframes) into one live
  //    stylesheet so the demo boxes actually animate on the page. This is
  //    the exact same text the user copies, so demo and clipboard never drift.
  const styleTag = document.createElement("style");
  styleTag.id = "lib-styles";
  styleTag.textContent = ANIMATIONS.map((a) => a.css).join("\n\n");
  document.head.appendChild(styleTag);

  // 2. Category sidebar (desktop) + chip row (mobile) — built from the same
  //    data so their "active" state always stays in sync.
  function countForCategory(categoryId) {
    return categoryId === "all"
      ? ANIMATIONS.length
      : ANIMATIONS.filter((a) => a.category === categoryId).length;
  }

  function makeCategoryButton(id, label, accent) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-btn";
    btn.dataset.cat = id;
    if (accent) btn.style.setProperty("--cat-accent", accent);

    const dot = document.createElement("span");
    dot.className = "cat-dot";
    btn.appendChild(dot);

    const label_ = document.createElement("span");
    label_.className = "cat-label";
    label_.textContent = label;
    btn.appendChild(label_);

    const countEl = document.createElement("span");
    countEl.className = "cat-count mono";
    countEl.textContent = String(countForCategory(id));
    btn.appendChild(countEl);

    btn.addEventListener("click", () => setCategory(id));
    return btn;
  }

  function renderCategoryControls() {
    if (!catNav || !catChips) return;
    catNav.innerHTML = "";
    catChips.innerHTML = "";

    const entries = [{ id: "all", label: "All animations", accent: null }].concat(
      CATEGORIES.map((c) => ({ id: c.id, label: c.label, accent: c.accent }))
    );

    entries.forEach((cat) => {
      catNav.appendChild(makeCategoryButton(cat.id, cat.label, cat.accent));
      catChips.appendChild(makeCategoryButton(cat.id, cat.label, cat.accent));
    });

    syncCategoryButtons();
  }

  function syncCategoryButtons() {
    const buttons = document.querySelectorAll(".cat-btn");
    buttons.forEach((btn) => {
      const active = btn.dataset.cat === state.category;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function setCategory(id) {
    state.category = id;
    syncCategoryButtons();
    refresh();
  }

  // 3. Render the grid.
  function render(list) {
    grid.innerHTML = "";
    list.forEach((a) => {
      const catMeta = CATEGORIES.find((c) => c.id === a.category);

      const card = document.createElement("div");
      card.className = "anim-card";
      card.dataset.cat = a.category;

      const stage = document.createElement("div");
      stage.className = "anim-demo-stage";
      const box = document.createElement("div");
      box.className = "anim-demo-box " + a.demoClass;
      stage.appendChild(box);

      const body = document.createElement("div");
      body.className = "anim-card-body";

      const title = document.createElement("h3");
      title.textContent = a.name;
      body.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "anim-card-meta";
      const tag = document.createElement("span");
      tag.className = "cat-tag";
      tag.textContent = catMeta ? catMeta.label : a.category;
      meta.appendChild(tag);
      const timing = document.createElement("span");
      timing.className = "anim-timing mono";
      timing.textContent = describeAnimationMeta(a.css);
      meta.appendChild(timing);
      body.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "anim-card-actions";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copy CSS";
      copyBtn.addEventListener("click", () => copyToClipboard(a.css, copyBtn));
      actions.appendChild(copyBtn);

      const codeBtn = document.createElement("button");
      codeBtn.type = "button";
      codeBtn.className = "code-toggle-btn";
      codeBtn.textContent = "View code";
      codeBtn.setAttribute("aria-expanded", "false");
      actions.appendChild(codeBtn);

      body.appendChild(actions);

      const codePanel = document.createElement("pre");
      codePanel.className = "anim-code-panel";
      const codeEl = document.createElement("code");
      codeEl.textContent = a.css;
      codePanel.appendChild(codeEl);
      body.appendChild(codePanel);

      codeBtn.addEventListener("click", () => {
        const isOpen = codePanel.classList.toggle("is-open");
        codeBtn.setAttribute("aria-expanded", String(isOpen));
        codeBtn.textContent = isOpen ? "Hide code" : "View code";
      });

      card.appendChild(stage);
      card.appendChild(body);
      grid.appendChild(card);
    });

    count.textContent = list.length + " / " + ANIMATIONS.length;

    if (emptyState) {
      if (list.length === 0) {
        if (emptyQuery) emptyQuery.textContent = search.value;
        emptyState.hidden = false;
        grid.hidden = true;
      } else {
        emptyState.hidden = true;
        grid.hidden = false;
      }
    }
  }

  function refresh() {
    render(filterAnimations(filterByCategory(ANIMATIONS, state.category), state.query));
  }

  function copyToClipboard(text, btn) {
    const done = () => {
      const original = btn.textContent;
      btn.textContent = "Copied!";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 1400);
    };
    const fail = () => {
      const original = btn.textContent;
      btn.textContent = "Copy failed";
      setTimeout(() => (btn.textContent = original), 1400);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => legacyCopy(text) ? done() : fail());
    } else {
      legacyCopy(text) ? done() : fail();
    }
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // 4. Search/filter.
  search.addEventListener("input", () => {
    state.query = search.value;
    refresh();
  });

  // Press "/" anywhere (outside a text field) to jump into search — a small
  // nod to the command-palette muscle memory of component-gallery sites.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const activeTag = document.activeElement && document.activeElement.tagName;
    if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
    e.preventDefault();
    search.focus();
  });

  // 5. Restart every demo animation periodically so visitors see the effect
  //    on a loop without needing to hover/click, even for one-shot entrance
  //    animations (fade-in, slide-in, zoom-in, etc.).
  function restartDemos() {
    const boxes = grid.querySelectorAll(".anim-demo-box");
    boxes.forEach((box) => {
      box.style.animation = "none";
      // Force reflow so the browser "notices" the animation was removed.
      void box.offsetWidth;
      box.style.animation = "";
    });
  }
  setInterval(restartDemos, 2600);

  renderCategoryControls();
  refresh();
})();
