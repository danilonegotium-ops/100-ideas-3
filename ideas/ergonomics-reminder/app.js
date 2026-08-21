// Ergonomics Reminder — pure timing/formatting logic first (testable from
// Node via the module.exports guard at the bottom), DOM wiring after.

/** Convert whole minutes to milliseconds. */
function minutesToMs(minutes) {
  return Math.max(0, Math.round(Number(minutes) || 0) * 60000);
}

/** Format a millisecond duration as mm:ss for the countdown display. */
function formatCountdown(ms) {
  var totalSeconds = Math.max(0, Math.round(ms / 1000));
  var m = Math.floor(totalSeconds / 60);
  var s = totalSeconds % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

/**
 * Pick a random tip index, avoiding an immediate repeat of `lastIndex` when
 * there's more than one tip available. `rng` is injectable for deterministic
 * testing (defaults to Math.random).
 */
function randomTipIndexAvoidingRepeat(length, lastIndex, rng) {
  var random = typeof rng === "function" ? rng : Math.random;
  if (length <= 1) return 0;
  var idx = Math.floor(random() * length);
  if (idx === lastIndex) idx = (idx + 1) % length;
  return idx;
}

/** Human-readable notification permission status message. */
function permissionStatusMessage(supported, permission) {
  if (!supported) {
    return "Notifications: not supported in this browser — this tab will flash a reminder instead while it's open.";
  }
  if (permission === "granted") {
    return "Notifications: allowed — you'll get a system notification each interval (plus an in-tab flash as backup).";
  }
  if (permission === "denied") {
    return "Notifications: blocked — this tab will flash a reminder instead while it's open.";
  }
  return "Notifications: not yet requested — click Start to allow them (or dismiss the prompt and rely on the in-tab flash).";
}

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

function initApp() {
  var intervalSelect = document.getElementById("erg-interval");
  var startBtn = document.getElementById("erg-start");
  var stopBtn = document.getElementById("erg-stop");
  var countdownEl = document.getElementById("erg-countdown");
  var permissionStatusEl = document.getElementById("erg-permission-status");
  var flashEl = document.getElementById("erg-flash");
  var flashTipEl = document.getElementById("erg-flash-tip");
  var flashDismissBtn = document.getElementById("erg-flash-dismiss");

  // Bespoke-theme elements: the breathing ring is a manufactured visual
  // centerpiece (this app otherwise has none) that mirrors the countdown,
  // and the segmented control is a styled front-end for the real <select>
  // (kept in the DOM, visually hidden) so all existing .value reads below
  // continue to work unmodified.
  var stageEl = document.getElementById("erg-stage");
  var ringProgressEl = document.getElementById("erg-ring-progress");
  var statusChipEl = document.getElementById("erg-status-chip");
  var statusChipLabelEl = document.getElementById("erg-status-chip-label");
  var intervalGroupEl = document.getElementById("erg-interval-group");
  var segmentButtons = intervalGroupEl
    ? Array.prototype.slice.call(intervalGroupEl.querySelectorAll(".segment"))
    : [];
  var RING_CIRCUMFERENCE = 2 * Math.PI * 90;

  var running = false;
  var intervalMs = minutesToMs(intervalSelect.value);
  var nextFireAt = null;
  var tickTimerId = null;
  var fireTimerId = null;
  var lastTipIndex = -1;

  var notificationsSupported = "Notification" in window;

  function setRingProgress(fraction) {
    if (!ringProgressEl) return;
    var clamped = Math.max(0, Math.min(1, fraction));
    ringProgressEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - clamped));
  }

  function syncSegmentedControl() {
    segmentButtons.forEach(function (btn) {
      var isSelected = btn.dataset.value === intervalSelect.value;
      btn.setAttribute("aria-checked", isSelected ? "true" : "false");
    });
  }

  function setSegmentedDisabled(disabled) {
    segmentButtons.forEach(function (btn) {
      btn.disabled = disabled;
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    });
  }

  segmentButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (intervalSelect.disabled) return;
      intervalSelect.value = btn.dataset.value;
      syncSegmentedControl();
    });
  });

  function currentPermission() {
    return notificationsSupported ? Notification.permission : "unsupported";
  }

  function updatePermissionStatus() {
    permissionStatusEl.textContent = permissionStatusMessage(notificationsSupported, currentPermission());
  }

  function updateCountdownDisplay() {
    if (!running || nextFireAt === null) {
      countdownEl.textContent = "--:--";
      setRingProgress(0);
      return;
    }
    var remaining = nextFireAt - Date.now();
    countdownEl.textContent = formatCountdown(remaining);
    setRingProgress(1 - remaining / intervalMs);
  }

  function showFlash(tip) {
    flashTipEl.textContent = tip;
    flashEl.hidden = false;
    if (stageEl) stageEl.classList.add("is-flashing");
  }

  function hideFlash() {
    flashEl.hidden = true;
    if (stageEl) stageEl.classList.remove("is-flashing");
  }

  function fireReminder() {
    var idx = randomTipIndexAvoidingRepeat(TIPS.length, lastTipIndex);
    lastTipIndex = idx;
    var tip = TIPS[idx];

    // Always show the in-page flash: it doubles as the primary UI cue and as
    // the fallback when notifications are blocked or unsupported.
    showFlash(tip);

    if (notificationsSupported && Notification.permission === "granted") {
      try {
        new Notification("Time to reset your posture", { body: tip });
      } catch (err) {
        // Some browsers throw if notifications are used from certain contexts;
        // the in-page flash above already covers the user either way.
      }
    }

    if (running) scheduleNext();
  }

  function scheduleNext() {
    nextFireAt = Date.now() + intervalMs;
    fireTimerId = setTimeout(fireReminder, intervalMs);
  }

  function start() {
    intervalMs = minutesToMs(intervalSelect.value);
    running = true;
    hideFlash();
    scheduleNext();
    tickTimerId = setInterval(updateCountdownDisplay, 1000);
    updateCountdownDisplay();

    startBtn.disabled = true;
    stopBtn.disabled = false;
    intervalSelect.disabled = true;
    setSegmentedDisabled(true);
    if (stageEl) stageEl.classList.add("is-running");
    if (statusChipEl) statusChipEl.classList.add("is-active");
    if (statusChipLabelEl) statusChipLabelEl.textContent = "Active";

    if (notificationsSupported && Notification.permission === "default") {
      Notification.requestPermission().then(updatePermissionStatus);
    } else {
      updatePermissionStatus();
    }
  }

  function stop() {
    running = false;
    if (fireTimerId) clearTimeout(fireTimerId);
    if (tickTimerId) clearInterval(tickTimerId);
    fireTimerId = null;
    tickTimerId = null;
    nextFireAt = null;
    updateCountdownDisplay();

    startBtn.disabled = false;
    stopBtn.disabled = true;
    intervalSelect.disabled = false;
    setSegmentedDisabled(false);
    if (stageEl) stageEl.classList.remove("is-running", "is-flashing");
    if (statusChipEl) statusChipEl.classList.remove("is-active");
    if (statusChipLabelEl) statusChipLabelEl.textContent = "Paused";
  }

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
  flashDismissBtn.addEventListener("click", hideFlash);

  syncSegmentedControl();
  setRingProgress(0);
  updatePermissionStatus();
  updateCountdownDisplay();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    minutesToMs,
    formatCountdown,
    randomTipIndexAvoidingRepeat,
    permissionStatusMessage,
  };
}
