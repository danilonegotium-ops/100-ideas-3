// Is It Friday Yet — all logic is pure and driven off a Date so it's easy to
// unit-test without a browser (see the day-of-week math in getFridayStatus).
//
// The visual is a "split-flap departure board" (the mechanical airport-style
// character flippers) — see flap rendering helpers below. The Friday-detection
// logic itself never touches the DOM, so it stays trivially testable.

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Given a JS Date, return everything the UI needs: whether it's Friday,
 * how many days until the next Friday, a mood bucket, and dramatic copy.
 * Pure function of `date` — no DOM, no globals — so it's trivially testable.
 */
function getFridayStatus(date) {
  const day = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const isFriday = day === 5;
  // Days remaining until the next Friday (0 when today IS Friday).
  const daysUntil = (5 - day + 7) % 7;

  let mood;
  let message;

  if (isFriday) {
    mood = "yes";
    message = "IT'S FRIDAY. GO LIVE YOUR LIFE.";
  } else if (day === 6) {
    // Saturday — just missed it, furthest point in the week from Friday.
    mood = "far";
    message = "Nope. You literally just missed it. 6 more days.";
  } else if (daysUntil === 1) {
    mood = "close";
    message = "Not yet, but TOMORROW. Hang in there.";
  } else if (daysUntil === 2) {
    mood = "close";
    message = `Still no. But it's only ${daysUntil} days away — you can smell it.`;
  } else if (daysUntil <= 4) {
    mood = "mid";
    message = `No. ${daysUntil} days left. The week is far from over.`;
  } else {
    mood = "far";
    message = `Absolutely not. ${daysUntil} days to go. It's basically Monday forever.`;
  }

  return {
    isFriday,
    dayOfWeek: day,
    dayName: DAY_NAMES[day],
    daysUntil,
    mood,
    message,
  };
}

function formatToday(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Short board-row copy for the "next Friday" readout. Pure + testable. */
function formatCountdown(status) {
  if (status.isFriday) return "Today";
  if (status.daysUntil === 1) return "1 day";
  return `${status.daysUntil} days`;
}

// ---------------------------------------------------------------------------
// DOM rendering — split-flap board + scramble/cipher-decode readouts.
// Everything below only runs in a real browser (guarded at the bottom of the
// file), so the pure functions above stay `require`-able from Node.
// ---------------------------------------------------------------------------

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Renders `text` into a split-flap character row inside `container`,
 * mechanically "flipping" any flap whose character actually changed.
 * Builds its flap DOM once and reuses it on subsequent calls.
 */
function playFlap(container, text) {
  const reduceMotion = prefersReducedMotion();
  const chars = text.toUpperCase().padEnd(3, " ").slice(0, 3).split("");

  let cells = container._flapCells;
  if (!cells) {
    container.innerHTML = "";
    cells = chars.map(() => {
      const flap = document.createElement("div");
      flap.className = "flap";
      flap.innerHTML =
        '<div class="flap-inner">' +
        '<div class="flap-face front"><span></span></div>' +
        '<div class="flap-face back"><span></span></div>' +
        "</div>";
      container.appendChild(flap);
      return flap;
    });
    container._flapCells = cells;
    container._flapValues = chars.map(() => null);
  }

  const prevValues = container._flapValues;
  chars.forEach((ch, i) => {
    flipFlapTo(cells[i], ch, prevValues[i], reduceMotion);
  });
  container._flapValues = chars;
}

function flipFlapTo(flapEl, targetChar, prevChar, reduceMotion) {
  const front = flapEl.querySelector(".flap-face.front span");
  const back = flapEl.querySelector(".flap-face.back span");

  if (prevChar === targetChar) {
    front.textContent = targetChar;
    return;
  }

  if (reduceMotion) {
    front.textContent = targetChar;
    back.textContent = targetChar;
    return;
  }

  back.textContent = targetChar;
  const inner = flapEl.querySelector(".flap-inner");
  flapEl.classList.add("is-flipping");

  const onEnd = (event) => {
    if (event.propertyName !== "transform") return;
    inner.removeEventListener("transitionend", onEnd);
    flapEl.classList.remove("is-flipping");
    front.textContent = targetChar;
    // Snap the inner element back to its resting rotation with no
    // transition, so the flip is ready to play again on the next change.
    inner.style.transition = "none";
    void inner.offsetWidth; // force reflow before re-enabling the transition
    inner.style.transition = "";
  };
  inner.addEventListener("transitionend", onEnd);
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Cipher-decode style reveal: scrambles through random characters before
 * settling on `newText`, left to right. Falls back to an instant swap when
 * the visitor prefers reduced motion.
 */
function scrambleText(el, newText) {
  if (prefersReducedMotion()) {
    el.textContent = newText;
    return;
  }

  const frameMs = 32;
  const stagger = 2; // ticks between each character starting to lock in
  const oldText = el.textContent || "";
  const length = Math.max(oldText.length, newText.length);
  const queue = [];
  for (let i = 0; i < length; i++) {
    const from = oldText[i] || "";
    const to = newText[i] || "";
    const start = Math.floor(i * stagger + Math.random() * stagger);
    const end = start + Math.floor(Math.random() * stagger) + stagger;
    queue.push({ from, to, start, end });
  }

  clearInterval(el._scrambleTimer);
  let frame = 0;
  el._scrambleTimer = setInterval(() => {
    let output = "";
    let settled = 0;
    for (const q of queue) {
      if (frame >= q.end) {
        settled++;
        output += q.to;
      } else if (frame >= q.start) {
        output += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      } else {
        output += q.from;
      }
    }
    el.textContent = output;
    if (settled === queue.length) clearInterval(el._scrambleTimer);
    frame++;
  }, frameMs);
}

function render(date) {
  const status = getFridayStatus(date);

  const boardEl = document.getElementById("board");
  const answerEl = document.getElementById("answer");
  const answerSrEl = document.getElementById("answer-sr");
  const messageEl = document.getElementById("message");
  const dayEl = document.getElementById("row-day");
  const dateEl = document.getElementById("row-date");
  const countdownEl = document.getElementById("row-countdown");

  playFlap(answerEl, status.isFriday ? "YES" : "NO");
  answerEl.classList.toggle("is-yes", status.isFriday);
  answerEl.classList.toggle("is-no", !status.isFriday);
  answerSrEl.textContent = status.isFriday ? "Yes." : "No.";

  scrambleText(messageEl, status.message);
  scrambleText(dayEl, status.dayName);
  scrambleText(dateEl, formatToday(date));
  scrambleText(countdownEl, formatCountdown(status));

  boardEl.classList.remove("mood-yes", "mood-close", "mood-mid", "mood-far");
  boardEl.classList.add(`mood-${status.mood}`);
}

// Only run DOM code in a real browser/document context, so this file can
// still be `require`d / syntax-checked from Node for the pure functions.
if (typeof document !== "undefined") {
  render(new Date());
  // Re-check at local midnight-ish cadence so a tab left open flips over.
  setInterval(() => render(new Date()), 60 * 1000);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getFridayStatus, formatToday, formatCountdown };
}
