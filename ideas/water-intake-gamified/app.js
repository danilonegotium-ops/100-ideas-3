/* Water Intake Gamified — "Hydration Grove"
 * Core date/streak/state logic and tree-svg rendering are pure functions
 * (no DOM, no localStorage inside them) so they can be sanity-checked with
 * plain `node`. DOM + localStorage wiring lives in the guarded block below.
 */

var STORAGE_KEY = 'water-intake-gamified-v1';
var STAGE_META = [
  { key: 'seed', label: 'Seed planted' },
  { key: 'sprout', label: 'Sprouting' },
  { key: 'sapling', label: 'Sapling' },
  { key: 'young-tree', label: 'Young tree' },
  { key: 'full-tree', label: 'Full tree' },
  { key: 'blooming', label: 'Blooming — goal reached!' }
];

function round(n) {
  return Math.round(n * 100) / 100;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function formatDateKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function addDays(dateKey, days) {
  var parts = dateKey.split('-').map(Number);
  var dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + days);
  return formatDateKey(dt);
}

function isConsecutiveDay(prevDateKey, currentDateKey) {
  if (!prevDateKey) return false;
  return addDays(prevDateKey, 1) === currentDateKey;
}

function getDefaultState(todayKey) {
  return { goal: 8, today: todayKey, countToday: 0, streak: 0, lastCompletedDate: null };
}

function rolloverIfNewDay(state, todayKey) {
  if (state.today === todayKey) return state;
  return Object.assign({}, state, { today: todayKey, countToday: 0 });
}

function applyDrink(state, todayKey) {
  var rolled = rolloverIfNewDay(state, todayKey);
  var newCount = rolled.countToday + 1;
  var newState = Object.assign({}, rolled, { countToday: newCount });
  var alreadyCompletedToday = rolled.lastCompletedDate === todayKey;
  if (newCount >= rolled.goal && !alreadyCompletedToday) {
    var continuesStreak = isConsecutiveDay(rolled.lastCompletedDate, todayKey);
    newState.streak = continuesStreak ? rolled.streak + 1 : 1;
    newState.lastCompletedDate = todayKey;
  }
  return newState;
}

function applyUndo(state, todayKey) {
  var rolled = rolloverIfNewDay(state, todayKey);
  var newCount = Math.max(0, rolled.countToday - 1);
  return Object.assign({}, rolled, { countToday: newCount });
}

function resetToday(state, todayKey) {
  var rolled = rolloverIfNewDay(state, todayKey);
  var resetState = Object.assign({}, rolled, { countToday: 0 });
  if (rolled.lastCompletedDate === todayKey) {
    resetState.lastCompletedDate = null;
    resetState.streak = Math.max(0, rolled.streak - 1);
  }
  return resetState;
}

function setGoal(state, todayKey, newGoal) {
  var rolled = rolloverIfNewDay(state, todayKey);
  return Object.assign({}, rolled, { goal: Math.max(1, Math.round(newGoal) || 1) });
}

function getPercent(state) {
  if (state.goal <= 0) return 0;
  return (state.countToday / state.goal) * 100;
}

function getStageIndex(state) {
  var percent = getPercent(state);
  if (percent <= 0) return 0;
  if (percent < 25) return 1;
  if (percent < 50) return 2;
  if (percent < 75) return 3;
  if (percent < 100) return 4;
  return 5;
}

/* ---- Tree rendering ----
 * Bespoke procedural SVG: a small fixed-angle fractal branch structure
 * (inspired by 21st.dev's "Fractal Bloom Tree" card — thin branching
 * linework fanning out from a base point) topped with hand-built organic
 * "blob" leaf clusters (a jittered-radius polygon smoothed with quadratic
 * curves, not plain circles). Everything below is deterministic (no
 * Math.random) so the same stageIndex always produces the same markup —
 * that keeps it snapshot-testable with plain `node`.
 */

var BLOB_JITTER = [1, 0.86, 1.1, 0.9, 1.14, 0.84, 1.06, 0.94];

function blobPath(cx, cy, r, seed) {
  var n = BLOB_JITTER.length;
  var pts = [];
  var i;
  for (i = 0; i < n; i++) {
    var angle = (Math.PI * 2 * i) / n;
    var jitter = BLOB_JITTER[(i + seed) % n];
    var rad = r * jitter;
    pts.push([cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad * 0.9]);
  }
  var start = [(pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2];
  var d = 'M ' + round(start[0]) + ' ' + round(start[1]) + ' ';
  for (i = 0; i < n; i++) {
    var p = pts[i];
    var next = pts[(i + 1) % n];
    var mid = [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2];
    d += 'Q ' + round(p[0]) + ' ' + round(p[1]) + ' ' + round(mid[0]) + ' ' + round(mid[1]) + ' ';
  }
  return d + 'Z';
}

function wrapSvg(size, parts) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
    '" width="' + size + '" height="' + size + '" class="grove-tree-svg">' + parts.join('') + '</svg>';
}

var LEAF_COLORS = ['#34d17a', '#22b06a', '#0d7a4a', '#1c9a5c', '#3fce85', '#178f52'];

function addBranch(parts, tips, x, y, angleDeg, len, width, depth, maxDepth) {
  var rad = (angleDeg * Math.PI) / 180;
  var x2 = round(x + Math.sin(rad) * len);
  var y2 = round(y - Math.cos(rad) * len);
  parts.push(
    '<path d="M ' + round(x) + ' ' + round(y) + ' L ' + x2 + ' ' + y2 +
      '" stroke="url(#trunkGrad)" stroke-width="' + round(Math.max(1.2, width)) +
      '" stroke-linecap="round" fill="none" />'
  );
  if (depth >= maxDepth) {
    tips.push({ x: x2, y: y2, r: Math.max(6, width * 2.8) });
    return;
  }
  var spread = 20 + depth * 6;
  addBranch(parts, tips, x2, y2, angleDeg - spread, len * 0.72, width * 0.66, depth + 1, maxDepth);
  addBranch(parts, tips, x2, y2, angleDeg + spread, len * 0.72, width * 0.66, depth + 1, maxDepth);
  if (depth === 0 && maxDepth >= 2) {
    addBranch(parts, tips, x2, y2, angleDeg, len * 0.62, width * 0.6, depth + 1, maxDepth);
  }
}

function buildTreeSVG(stageIndex) {
  var size = 240;
  var groundY = 200;
  var parts = [];

  parts.push(
    '<defs>' +
      '<radialGradient id="groundGlow" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#34d17a" stop-opacity="' + round(0.05 + stageIndex * 0.045) + '" />' +
        '<stop offset="100%" stop-color="#34d17a" stop-opacity="0" />' +
      '</radialGradient>' +
      '<linearGradient id="trunkGrad" x1="0" y1="1" x2="0" y2="0">' +
        '<stop offset="0%" stop-color="#3d2a1a" />' +
        '<stop offset="100%" stop-color="#7a5636" />' +
      '</linearGradient>' +
      '<linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#4ee08c" />' +
        '<stop offset="100%" stop-color="#0f8a4c" />' +
      '</linearGradient>' +
      '<filter id="softEdge" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feGaussianBlur stdDeviation="0.6" />' +
      '</filter>' +
      '<filter id="glow" x="-80%" y="-80%" width="260%" height="260%">' +
        '<feGaussianBlur stdDeviation="3" result="blur" />' +
        '<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>' +
      '</filter>' +
    '</defs>'
  );

  parts.push('<ellipse cx="120" cy="' + groundY + '" rx="86" ry="16" fill="url(#groundGlow)" />');
  parts.push('<ellipse cx="120" cy="' + (groundY + 4) + '" rx="46" ry="10" fill="#241c14" opacity="0.55" />');

  if (stageIndex <= 0) {
    parts.push('<ellipse cx="120" cy="' + (groundY - 1) + '" rx="7" ry="4" fill="#5b4632" />');
    parts.push('<circle cx="120" cy="' + (groundY - 4) + '" r="3.2" fill="#8ee6ac" filter="url(#glow)" />');
    return wrapSvg(size, parts);
  }

  var maxDepth = stageIndex <= 1 ? 1 : stageIndex === 2 ? 2 : 3;
  var initialLen = 22 + stageIndex * 11;
  var initialWidth = 3 + stageIndex * 1.4;
  var tips = [];
  addBranch(parts, tips, 120, groundY, 0, initialLen, initialWidth, 0, maxDepth);

  parts.push(
    '<path d="M 100 ' + groundY + ' q 3 -10 7 -1" stroke="#2f7a45" stroke-width="2" fill="none" stroke-linecap="round" />' +
    '<path d="M 138 ' + groundY + ' q -3 -9 -7 -1" stroke="#2f7a45" stroke-width="2" fill="none" stroke-linecap="round" />'
  );

  if (stageIndex === 1) {
    tips.forEach(function (t, i) {
      parts.push(
        '<ellipse cx="' + round(t.x) + '" cy="' + round(t.y) + '" rx="6" ry="3" fill="' + LEAF_COLORS[i % LEAF_COLORS.length] +
          '" transform="rotate(' + (i % 2 === 0 ? -30 : 30) + ' ' + round(t.x) + ' ' + round(t.y) + ')" />'
      );
    });
  } else {
    var cx = 0, cy = 0;
    tips.forEach(function (t) { cx += t.x; cy += t.y; });
    cx = round(cx / tips.length);
    cy = round(cy / tips.length);
    var canopyR = 12 + (stageIndex - 1) * 13;
    parts.push('<path d="' + blobPath(cx, cy, canopyR, 1) + '" fill="url(#leafGrad)" filter="url(#softEdge)" opacity="0.92" />');
    var foliageScale = stageIndex >= 4 ? 1.05 : 0.85;
    tips.forEach(function (t, i) {
      var r = t.r * foliageScale;
      parts.push('<path d="' + blobPath(t.x, t.y, r, i) + '" fill="' + LEAF_COLORS[i % LEAF_COLORS.length] +
        '" opacity="0.85" filter="url(#softEdge)" />');
    });
  }

  if (stageIndex >= 5) {
    var bloomSpots = tips.filter(function (_, i) { return i % 2 === 0; });
    bloomSpots.forEach(function (t, i) {
      var petalColors = ['#ff8fb3', '#ffd166'];
      var color = petalColors[i % petalColors.length];
      var fx = t.x + (i % 2 === 0 ? -4 : 4);
      var fy = t.y - 4;
      var petalMarkup = '';
      for (var p = 0; p < 5; p++) {
        var pa = (Math.PI * 2 * p) / 5;
        petalMarkup += '<circle cx="' + round(fx + Math.cos(pa) * 3.4) + '" cy="' + round(fy + Math.sin(pa) * 3.4) +
          '" r="2.6" fill="' + color + '" />';
      }
      petalMarkup += '<circle cx="' + round(fx) + '" cy="' + round(fy) + '" r="1.6" fill="#fff6d9" />';
      parts.push('<g opacity="0.95">' + petalMarkup + '</g>');
    });
    parts.push(
      '<circle class="tree-spark" cx="80" cy="' + round(groundY - 150) + '" r="2.4" fill="#ffe38a" filter="url(#glow)" />' +
      '<circle class="tree-spark tree-spark--slow" cx="154" cy="' + round(groundY - 130) + '" r="2" fill="#8ee6ac" filter="url(#glow)" />'
    );
  }

  return wrapSvg(size, parts);
}

/* ---- DOM + localStorage wiring ---- */
if (typeof document !== 'undefined') {
  (function () {
    var treeStage = document.getElementById('treeStage');
    var dropletRow = document.getElementById('dropletRow');
    var progressText = document.getElementById('progressText');
    var streakText = document.getElementById('streakText');
    var drinkBtn = document.getElementById('drinkBtn');
    var undoBtn = document.getElementById('undoBtn');
    var resetBtn = document.getElementById('resetBtn');
    var goalGlasses = document.getElementById('goalGlasses');
    var saveGoalBtn = document.getElementById('saveGoalBtn');

    function todayKey() {
      return formatDateKey(new Date());
    }

    function loadState() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultState(todayKey());
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.goal !== 'number') return getDefaultState(todayKey());
        return parsed;
      } catch (e) {
        return getDefaultState(todayKey());
      }
    }

    function saveState(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        /* localStorage unavailable (private mode / disabled) — state just won't persist */
      }
    }

    var state = rolloverIfNewDay(loadState(), todayKey());
    saveState(state);

    function pulseTree() {
      treeStage.classList.remove('is-growing');
      // eslint-disable-next-line no-unused-expressions
      void treeStage.offsetWidth; // force reflow so the animation restarts every time
      treeStage.classList.add('is-growing');
    }

    function renderDroplets() {
      var total = Math.max(1, Math.min(20, state.goal));
      var filled = Math.min(state.countToday, total);
      var html = '';
      for (var i = 0; i < total; i++) {
        var cls = 'droplet' + (i < filled ? ' is-filled' : '');
        if (i === filled - 1) cls += ' is-newest';
        html += '<span class="' + cls + '"></span>';
      }
      dropletRow.innerHTML = html;
    }

    function celebrateBloom() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var layer = document.createElement('div');
      layer.className = 'petal-burst';
      layer.setAttribute('aria-hidden', 'true');
      var colors = ['#ff8fb3', '#ffd166', '#8ee6ac', '#8fd6ff'];
      for (var i = 0; i < 16; i++) {
        var petal = document.createElement('span');
        petal.className = 'petal';
        petal.style.left = (Math.random() * 100) + '%';
        petal.style.background = colors[i % colors.length];
        petal.style.animationDelay = (Math.random() * 0.5) + 's';
        petal.style.animationDuration = (1.6 + Math.random() * 1) + 's';
        layer.appendChild(petal);
      }
      document.body.appendChild(layer);
      setTimeout(function () { layer.remove(); }, 3000);
    }

    function render() {
      var stageIndex = getStageIndex(state);
      var meta = STAGE_META[stageIndex];
      treeStage.innerHTML = buildTreeSVG(stageIndex);
      pulseTree();
      renderDroplets();
      var percent = Math.min(100, Math.round(getPercent(state)));
      progressText.textContent = state.countToday + ' of ' + state.goal + ' glasses today (' + percent + '%) — ' + meta.label;
      streakText.textContent = state.streak > 0
        ? '🔥 ' + state.streak + ' day' + (state.streak === 1 ? '' : 's') + ' streak'
        : 'Hit your goal today to start a streak.';
      streakText.classList.toggle('is-active', state.streak > 0);
      goalGlasses.value = state.goal;
    }

    drinkBtn.addEventListener('click', function () {
      var prevStage = getStageIndex(state);
      state = applyDrink(state, todayKey());
      saveState(state);
      render();
      if (prevStage < 5 && getStageIndex(state) === 5) celebrateBloom();
    });

    undoBtn.addEventListener('click', function () {
      state = applyUndo(state, todayKey());
      saveState(state);
      render();
    });

    resetBtn.addEventListener('click', function () {
      if (typeof window.confirm === 'function' && !window.confirm('Reset today\'s progress?')) return;
      state = resetToday(state, todayKey());
      saveState(state);
      render();
    });

    saveGoalBtn.addEventListener('click', function () {
      var newGoal = parseInt(goalGlasses.value, 10);
      state = setGoal(state, todayKey(), newGoal);
      saveState(state);
      render();
    });

    render();
  })();
}
