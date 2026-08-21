// Speed Reading Trainer — RSVP (rapid serial visual presentation) reader.
//
// Pure logic lives at the top so it can be unit-tested from Node via the
// `module.exports` guard at the bottom (a no-op in the browser, since
// `module` is never defined there — there's no bundler/CommonJS on the page).

/** Split text into a flat list of non-empty word tokens. */
function tokenize(text) {
  return String(text || "")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

/**
 * How long (ms) a single word should stay on screen for a given target WPM.
 * Longer words and sentence punctuation get a small extra pause so the pace
 * still feels readable instead of mechanically constant.
 */
function computeDelayMs(word, wpm) {
  const safeWpm = Math.max(1, Number(wpm) || 0);
  const base = 60000 / safeWpm;
  let multiplier = 1;

  const letters = word.replace(/[^a-zA-Z0-9]/g, "").length;
  if (letters > 6) {
    multiplier += Math.min((letters - 6) * 0.06, 0.6);
  }
  if (/[.!?]$/.test(word)) {
    multiplier += 0.7;
  } else if (/[,;:]$/.test(word)) {
    multiplier += 0.35;
  }

  return Math.round(base * multiplier);
}

/**
 * Optimal Recognition Point: the index of the letter RSVP readers center
 * the display on, based on word length. Short words pivot near the start,
 * longer words pivot a little further in.
 */
function pivotIndex(len) {
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/** Split a word into {pre, pivot, post} around its ORP for centered display. */
function splitAtPivot(word) {
  if (!word) return { pre: "", pivot: "", post: "" };
  const idx = Math.min(pivotIndex(word.length), word.length - 1);
  return {
    pre: word.slice(0, idx),
    pivot: word[idx],
    post: word.slice(idx + 1),
  };
}

/** 0-100 progress through the word list. */
function computeProgressPct(index, total) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (index / total) * 100));
}

/** mm:ss remaining, given remaining words and current wpm (rough estimate). */
function estimateRemaining(remainingWords, wpm) {
  const safeWpm = Math.max(1, Number(wpm) || 0);
  const totalSeconds = Math.round((remainingWords / safeWpm) * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// DOM wiring — only runs in a browser.
// ---------------------------------------------------------------------------

function initApp() {
  const textEl = document.getElementById("srt-text");
  const wpmEl = document.getElementById("srt-wpm");
  const wordEl = document.getElementById("srt-word");
  const playBtn = document.getElementById("srt-play");
  const restartBtn = document.getElementById("srt-restart");
  const progressFill = document.getElementById("srt-progress-fill");
  const statusEl = document.getElementById("srt-status");
  const etaEl = document.getElementById("srt-eta");
  const emptyMsg = document.getElementById("srt-empty-msg");
  // Presentational-only additions for the bespoke "reading instrument"
  // design — none of these touch the pure timing/tokenizing logic above.
  const wpmValueEl = document.getElementById("srt-wpm-value");
  const pulseEl = document.getElementById("srt-pulse");

  textEl.value = typeof SAMPLE_TEXT !== "undefined" ? SAMPLE_TEXT : "";

  let words = tokenize(textEl.value);
  let index = 0;
  let playing = false;
  let timerId = null;

  function renderWord(word) {
    if (!word) {
      wordEl.textContent = "Ready";
      wordEl.classList.add("is-empty");
      return;
    }
    wordEl.classList.remove("is-empty");
    const { pre, pivot, post } = splitAtPivot(word);
    wordEl.innerHTML =
      '<span class="pre">' + escapeHtml(pre) + "</span>" +
      '<span class="pivot">' + escapeHtml(pivot) + "</span>" +
      '<span class="post">' + escapeHtml(post) + "</span>";
  }

  /** Update the live WPM readout + the slider's own amber fill amount. */
  function updateWpmReadout() {
    if (wpmValueEl) wpmValueEl.textContent = wpmEl.value;
    const min = Number(wpmEl.min) || 0;
    const max = Number(wpmEl.max) || 100;
    const pct = ((Number(wpmEl.value) - min) / (max - min)) * 100;
    wpmEl.style.setProperty("--_fill", pct + "%");
  }

  /** Restart the per-word rhythm-cue animation (reflow trick so repeat
   *  ticks at the same word interval still replay from the start). */
  function pulseTick() {
    if (!pulseEl) return;
    pulseEl.classList.remove("tick");
    void pulseEl.offsetWidth;
    pulseEl.classList.add("tick");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function updateStatus() {
    statusEl.textContent = `${Math.min(index, words.length)} / ${words.length} words`;
    progressFill.style.width = computeProgressPct(index, words.length) + "%";
    const remaining = Math.max(0, words.length - index);
    etaEl.textContent = remaining > 0 ? estimateRemaining(remaining, wpmEl.value) : "00:00";
  }

  function stepWord() {
    if (index >= words.length) {
      pause();
      updateStatus();
      return;
    }
    const word = words[index];
    renderWord(word);
    pulseTick();
    index += 1;
    updateStatus();
    if (playing) {
      timerId = setTimeout(stepWord, computeDelayMs(word, wpmEl.value));
    }
  }

  function play() {
    words = tokenize(textEl.value);
    if (words.length === 0) {
      emptyMsg.hidden = false;
      return;
    }
    emptyMsg.hidden = true;
    if (index >= words.length) index = 0; // finished run -> loop from start
    playing = true;
    playBtn.textContent = "Pause";
    document.body.classList.add("is-playing");
    stepWord();
  }

  function pause() {
    playing = false;
    playBtn.textContent = "Play";
    document.body.classList.remove("is-playing");
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function restart() {
    pause();
    words = tokenize(textEl.value);
    index = 0;
    renderWord(null);
    updateStatus();
  }

  playBtn.addEventListener("click", () => {
    if (playing) {
      pause();
    } else {
      play();
    }
  });

  restartBtn.addEventListener("click", restart);

  textEl.addEventListener("input", () => {
    restart();
  });

  wpmEl.addEventListener("input", updateWpmReadout);
  updateWpmReadout();

  restart();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    tokenize,
    computeDelayMs,
    pivotIndex,
    splitAtPivot,
    computeProgressPct,
    estimateRemaining,
  };
}
