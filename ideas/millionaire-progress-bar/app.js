// Millionaire Progress Bar — the math is a pure function of the savings
// number so it can be unit-tested without a browser.

const GOAL = 1000000;
const STORAGE_KEY = "millionaire-progress-bar:savings";

/**
 * Pure: turn a raw savings number into everything the UI needs.
 */
function computeProgress(savingsInput) {
  const savings = Number.isFinite(savingsInput) && savingsInput > 0 ? savingsInput : 0;
  const rawPercent = (savings / GOAL) * 100;
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  const remaining = Math.max(0, GOAL - savings);
  const reached = savings >= GOAL;
  return { savings, rawPercent, clampedPercent, remaining, reached };
}

/** Pure: pick an encouragement message for the current percent. */
function milestoneMessage({ clampedPercent, reached }) {
  if (reached) return "You did it. Certified millionaire.";
  if (clampedPercent >= 75) return "Final stretch — under a quarter to go.";
  if (clampedPercent >= 50) return "Past the halfway point. Keep stacking.";
  if (clampedPercent >= 25) return "A quarter of the way there.";
  if (clampedPercent >= 10) return "Double digits. Momentum is building.";
  if (clampedPercent > 0) return "Every bit counts. You're on the board.";
  return "Enter your current savings to start tracking.";
}

/** Pure: format a plain number with thousands separators, no currency symbol. */
function formatNumber(n) {
  return Math.round(n * 100) / 100 === Math.round(n)
    ? Math.round(n).toLocaleString("en-US")
    : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// ---- Ring geometry + wealth-barometer color ramp (browser-only, presentation
// concerns — deliberately kept separate from the pure math functions above so
// computeProgress/milestoneMessage/formatNumber stay trivially unit-testable). ----
const RING_RADIUS = 96;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Ring goes steel (just starting) -> emerald (making progress) -> gold
// (closing in), so the visual literally warms up as net worth grows.
const RING_STEEL = [91, 107, 122]; // #5b6b7a
const RING_EMERALD = [31, 138, 95]; // #1f8a5f
const RING_GOLD = [212, 175, 55]; // #d4af37
const RING_GOLD_BRIGHT = [240, 199, 94]; // #f0c75e — goal-reached glow

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgb(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function ringColorFor(clampedPercent) {
  if (clampedPercent >= 100) return RING_GOLD_BRIGHT;
  if (clampedPercent <= 50) return mixRgb(RING_STEEL, RING_EMERALD, clampedPercent / 50);
  return mixRgb(RING_EMERALD, RING_GOLD, (clampedPercent - 50) / 50);
}

function render(savingsInput) {
  const progress = computeProgress(savingsInput);
  const ringArc = document.getElementById("ring-arc");
  const heroAmountEl = document.getElementById("hero-amount");
  const heroCaptionEl = document.getElementById("hero-caption");
  const remainingEl = document.getElementById("remaining-label");
  const messageEl = document.getElementById("milestone-message");
  const medallionWrap = document.getElementById("medallion-wrap");
  const dialPills = document.querySelectorAll(".dial-pill");

  const offset = RING_CIRCUMFERENCE * (1 - progress.clampedPercent / 100);
  ringArc.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ringArc.style.strokeDashoffset = `${offset}`;

  const [r, g, b] = ringColorFor(progress.clampedPercent).map(Math.round);
  const glowOpacity = 0.12 + (progress.clampedPercent / 100) * 0.5;
  const glowBlur = 10 + (progress.clampedPercent / 100) * 26;
  ringArc.style.stroke = `rgb(${r}, ${g}, ${b})`;
  ringArc.style.filter = `drop-shadow(0 0 ${glowBlur}px rgba(${r}, ${g}, ${b}, ${glowOpacity}))`;

  heroAmountEl.textContent = formatNumber(progress.savings);
  heroCaptionEl.textContent = progress.reached
    ? "goal reached"
    : `${progress.rawPercent.toFixed(progress.rawPercent < 1 ? 2 : 1)}% of 1,000,000`;
  remainingEl.textContent = progress.reached
    ? `+${formatNumber(progress.savings - GOAL)} over the goal`
    : `${formatNumber(progress.remaining)} to go`;
  messageEl.textContent = milestoneMessage(progress);

  if (medallionWrap) medallionWrap.classList.toggle("is-reached", progress.reached);

  dialPills.forEach((pill) => {
    const threshold = Number(pill.dataset.threshold);
    const isReached = progress.clampedPercent >= threshold;
    const wasReached = pill.classList.contains("reached");
    pill.classList.toggle("reached", isReached);
    if (isReached && !wasReached) {
      pill.classList.remove("pop");
      // Force reflow so the animation restarts if it's re-triggered quickly.
      void pill.offsetWidth;
      pill.classList.add("pop");
    }
  });

  return progress;
}

if (typeof document !== "undefined") {
  const input = document.getElementById("savings");
  const saveBtn = document.getElementById("save-btn");

  function persistAndRender() {
    const value = parseFloat(input.value);
    const safeValue = Number.isFinite(value) ? value : 0;
    try {
      localStorage.setItem(STORAGE_KEY, String(safeValue));
    } catch (err) {
      // localStorage can throw in private-browsing/blocked-storage contexts;
      // the app still works for the current session, it just won't persist.
    }
    render(safeValue);
  }

  // Load any previously saved value on page load.
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    stored = null;
  }
  const initial = stored !== null ? parseFloat(stored) : NaN;
  if (Number.isFinite(initial)) {
    input.value = initial;
  }
  render(Number.isFinite(initial) ? initial : 0);

  saveBtn.addEventListener("click", persistAndRender);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") persistAndRender();
  });
  // Live-update the bar as the user types, without waiting for Update.
  input.addEventListener("input", () => {
    const value = parseFloat(input.value);
    render(Number.isFinite(value) ? value : 0);
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeProgress, milestoneMessage, formatNumber, GOAL };
}
