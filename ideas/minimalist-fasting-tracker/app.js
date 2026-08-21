/* Minimalist Fasting Tracker
 * Timer math and state transitions are pure functions (no DOM, no Date.now()
 * calls baked in — current time is always passed as an argument) so they
 * can be sanity-checked with plain `node`. DOM + localStorage + the
 * once-a-second tick live in the guarded block below.
 */

var STORAGE_KEY = 'minimalist-fasting-tracker-v1';
var MAX_HISTORY = 50;

function getProtocolHours(protocol, customHours) {
  if (protocol === '16:8') return 16;
  if (protocol === '18:6') return 18;
  if (protocol === '20:4') return 20;
  if (protocol === 'custom') return Math.max(1, Math.min(72, Number(customHours) || 16));
  return 16;
}

function computeElapsedMs(startMs, nowMs) {
  return Math.max(0, nowMs - startMs);
}

function computeRemainingMs(startMs, fastHours, nowMs) {
  var goalMs = fastHours * 3600000;
  return goalMs - computeElapsedMs(startMs, nowMs);
}

/* Progress toward the fast's goal length, 0-100, clamped at 100 once the
 * goal is reached (the caller decides how to represent "overtime" beyond
 * that — this function never reports more than a full runway). */
function computeProgressPercent(startMs, fastHours, nowMs) {
  var goalMs = fastHours * 3600000;
  if (goalMs <= 0) return 100;
  var elapsed = computeElapsedMs(startMs, nowMs);
  return Math.min(100, (elapsed / goalMs) * 100);
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function pad3(n) {
  n = Math.max(0, Math.min(999, Math.round(n)));
  if (n < 10) return '00' + n;
  if (n < 100) return '0' + n;
  return String(n);
}

function formatHMS(ms) {
  var totalSeconds = Math.floor(Math.abs(ms) / 1000);
  var h = Math.floor(totalSeconds / 3600);
  var m = Math.floor((totalSeconds % 3600) / 60);
  var s = totalSeconds % 60;
  return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
}

function formatShort(ms) {
  var totalMinutes = Math.round(Math.abs(ms) / 60000);
  var h = Math.floor(totalMinutes / 60);
  var m = totalMinutes % 60;
  if (h <= 0) return m + 'm';
  return h + 'h ' + m + 'm';
}

function getDefaultState() {
  return { active: null, history: [] };
}

function startFast(state, protocol, fastHours, nowMs) {
  return Object.assign({}, state, {
    active: { protocol: protocol, fastHours: fastHours, startedAt: nowMs }
  });
}

function endFast(state, nowMs, maxHistory) {
  maxHistory = maxHistory || MAX_HISTORY;
  if (!state.active) return state;
  var durationMs = Math.max(0, nowMs - state.active.startedAt);
  var entry = {
    protocol: state.active.protocol,
    fastHours: state.active.fastHours,
    startedAt: state.active.startedAt,
    endedAt: nowMs,
    durationMs: durationMs,
    goalMet: durationMs >= state.active.fastHours * 3600000
  };
  var newHistory = [entry].concat(state.history || []).slice(0, maxHistory);
  return Object.assign({}, state, { active: null, history: newHistory });
}

/* ---- DOM + localStorage wiring ---- */
if (typeof document !== 'undefined') {
  (function () {
    var setupView = document.getElementById('setupView');
    var activeView = document.getElementById('activeView');
    var protocolSelect = document.getElementById('protocolSelect');
    var customField = document.getElementById('customField');
    var customHoursInput = document.getElementById('customHours');
    var startBtn = document.getElementById('startBtn');
    var endBtn = document.getElementById('endBtn');
    var flapPlate = document.getElementById('flapPlate');
    var timerDigits = document.getElementById('timerDigits');
    var timerLabel = document.getElementById('timerLabel');
    var runwayFill = document.getElementById('runwayFill');
    var percentReadout = document.getElementById('percentReadout');
    var statusText = document.getElementById('statusText');
    var historyList = document.getElementById('historyList');

    var tickHandle = null;

    function loadState() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultState();
        var parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.history)) return getDefaultState();
        return parsed;
      } catch (e) {
        return getDefaultState();
      }
    }

    function saveState(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        /* localStorage unavailable — state just won't persist */
      }
    }

    var state = loadState();

    function renderHistory() {
      historyList.innerHTML = '';
      if (!state.history.length) {
        historyList.innerHTML = '<p class="manifest-empty">No past fasts yet.</p>';
        return;
      }
      state.history.forEach(function (entry) {
        var row = document.createElement('div');
        row.className = 'history-row';
        var startedDate = new Date(entry.startedAt);
        var dateLabel = startedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        var dotClass = entry.goalMet ? 'met' : 'early';
        var dotGlyph = entry.goalMet ? '●' : '○';
        var label = entry.goalMet ? 'goal met' : 'ended early';
        row.innerHTML =
          '<span class="history-when">' + dateLabel + ' &middot; ' + entry.protocol + '</span>' +
          '<span class="history-meta"><span class="history-dot ' + dotClass + '">' + dotGlyph + '</span>' +
          formatShort(entry.durationMs) + ' &middot; ' + label + '</span>';
        historyList.appendChild(row);
      });
    }

    function renderActive() {
      if (!state.active) {
        setupView.style.display = '';
        activeView.style.display = 'none';
        runwayFill.style.width = '0%';
        runwayFill.classList.remove('overtime');
        flapPlate.classList.remove('overtime');
        if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
        return;
      }
      setupView.style.display = 'none';
      activeView.style.display = '';

      function tick() {
        var now = Date.now();
        var elapsed = computeElapsedMs(state.active.startedAt, now);
        var remaining = computeRemainingMs(state.active.startedAt, state.active.fastHours, now);
        var percent = computeProgressPercent(state.active.startedAt, state.active.fastHours, now);

        timerDigits.textContent = formatHMS(elapsed);
        timerLabel.textContent = 'elapsed';
        runwayFill.style.width = percent + '%';
        percentReadout.textContent = pad3(percent) + '%';

        if (remaining > 0) {
          flapPlate.classList.remove('overtime');
          runwayFill.classList.remove('overtime');
          statusText.textContent = formatHMS(remaining) + ' until eating window opens';
        } else {
          flapPlate.classList.add('overtime');
          runwayFill.classList.add('overtime');
          statusText.textContent = 'Eating window open — fasted ' + formatShort(elapsed) + ' so far';
        }
      }

      tick();
      if (tickHandle) clearInterval(tickHandle);
      tickHandle = setInterval(tick, 1000);
    }

    function render() {
      renderActive();
      renderHistory();
    }

    protocolSelect.addEventListener('change', function () {
      customField.style.display = protocolSelect.value === 'custom' ? '' : 'none';
    });

    startBtn.addEventListener('click', function () {
      var protocol = protocolSelect.value;
      var fastHours = getProtocolHours(protocol, customHoursInput.value);
      state = startFast(state, protocol, fastHours, Date.now());
      saveState(state);
      render();
    });

    endBtn.addEventListener('click', function () {
      state = endFast(state, Date.now());
      saveState(state);
      render();
    });

    render();
  })();
}
