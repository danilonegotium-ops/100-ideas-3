// Hobby Finder Quiz — pure scoring logic first (testable from Node via the
// module.exports guard at the bottom), DOM wiring after.

var DIMENSIONS = ["budget", "setting", "social", "physicality", "time", "style"];

var DIMENSION_LABELS = {
  budget: { low: "low-budget", medium: "a moderate budget", high: "investing in good gear" },
  setting: { indoor: "indoor", outdoor: "outdoor", both: "flexible indoor/outdoor" },
  social: { solo: "solo", social: "social", both: "flexible solo-or-social" },
  physicality: { physical: "hands-on and physical", mental: "mentally-focused", both: "a mix of physical and mental" },
  time: { low: "a light time commitment", medium: "a moderate time commitment", high: "a serious time commitment" },
  style: { creative: "creative", analytical: "analytical", both: "both creative and analytical" },
};

/** True if every question in `questions` has an answer in `answers`. */
function allAnswered(answers, questions) {
  return questions.every((q) => Boolean(answers[q.dim]));
}

/**
 * Score one hobby against the user's answers. Exact dimension match = 2 pts.
 * A "both"/flexible tag on either side (hobby or user) counts as a partial
 * match = 1 pt, since it's compatible without being a perfect fit.
 */
function scoreHobby(answers, hobby) {
  var score = 0;
  DIMENSIONS.forEach(function (dim) {
    var userVal = answers[dim];
    var hobbyVal = hobby.tags[dim];
    if (!userVal || !hobbyVal) return;
    if (hobbyVal === userVal) {
      score += 2;
    } else if (hobbyVal === "both" || userVal === "both") {
      score += 1;
    }
  });
  return score;
}

/** Rank all hobbies by score, descending, stable on ties (original order). */
function rankHobbies(answers, hobbies) {
  return hobbies
    .map(function (hobby, i) {
      return { hobby: hobby, score: scoreHobby(answers, hobby), i: i };
    })
    .sort(function (a, b) {
      return b.score - a.score || a.i - b.i;
    })
    .map(function (entry) {
      return { hobby: entry.hobby, score: entry.score };
    });
}

/** One-line "why this fits you" built from the dimensions that matched exactly. */
function generateWhy(answers, hobby) {
  var matched = DIMENSIONS.filter(function (dim) {
    return answers[dim] && hobby.tags[dim] === answers[dim];
  }).map(function (dim) {
    return DIMENSION_LABELS[dim][answers[dim]];
  });

  if (matched.length === 0) {
    return hobby.blurb + " Its flexible style adapts well to your answers.";
  }
  var picked = matched.slice(0, 2).join(" and ");
  return hobby.blurb + " A solid fit if you want something " + picked + ".";
}

// ---------------------------------------------------------------------------
// DOM wiring — one-question-at-a-time quiz flow with a step progress trail,
// colored answer chips, and a confetti + match-ring result reveal.
// ---------------------------------------------------------------------------

// Six hues cycled across the six questions for the progress trail — same
// palette used for the result-reveal confetti burst, so the whole quiz reads
// as one continuous color story from first question to final reveal.
var STEP_COLORS = ["#FFD23F", "#FF6B4A", "#FF3E8E", "#3EC6FF", "#8CE05A", "#9D6BFF"];
// Each question always has exactly 3 options; option position (not content)
// gets a consistent color across all six questions so the choice-chip colors
// form a predictable rhythm instead of flickering randomly per question.
var OPTION_CLASSES = ["choice-a", "choice-b", "choice-c"];

function initApp() {
  var form = document.getElementById("quiz-form");
  var errorEl = document.getElementById("quiz-error");
  var quizView = document.getElementById("quiz-view");
  var resultsView = document.getElementById("results-view");
  var resultsList = document.getElementById("results-list");
  var retakeBtn = document.getElementById("quiz-retake");
  var backBtn = document.getElementById("quiz-back");
  var nextBtn = document.getElementById("quiz-next");
  var progressEl = document.getElementById("quiz-progress");
  var questionsEl = document.getElementById("quiz-questions");

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var answers = {};
  var currentIndex = 0;

  function renderProgress() {
    progressEl.innerHTML = "";
    QUESTIONS.forEach(function (q, i) {
      var li = document.createElement("li");
      li.className = "progress-dot";
      li.style.setProperty("--dot-color", STEP_COLORS[i % STEP_COLORS.length]);
      var state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
      li.setAttribute("data-state", state);
      li.setAttribute("aria-current", state === "current" ? "step" : "false");
      var inner = document.createElement("span");
      inner.className = "progress-dot-inner";
      inner.textContent = state === "done" ? "✓" : String(i + 1);
      li.appendChild(inner);
      progressEl.appendChild(li);
    });
  }

  function markSelected(list, selectedLabel) {
    Array.prototype.forEach.call(list.querySelectorAll(".choice"), function (label) {
      label.classList.toggle("is-selected", label === selectedLabel);
    });
  }

  function renderQuestion() {
    var q = QUESTIONS[currentIndex];
    questionsEl.innerHTML = "";

    var fieldset = document.createElement("fieldset");
    fieldset.className = "question";

    var legend = document.createElement("legend");
    legend.className = "question-prompt";
    legend.textContent = q.prompt;
    fieldset.appendChild(legend);

    var list = document.createElement("div");
    list.className = "choice-list";

    q.options.forEach(function (opt, i) {
      var label = document.createElement("label");
      label.className = "choice " + OPTION_CLASSES[i % OPTION_CLASSES.length];

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "q-" + q.dim;
      input.value = opt.value;
      input.className = "choice-input";
      if (answers[q.dim] === opt.value) {
        input.checked = true;
        label.classList.add("is-selected");
      }

      var mark = document.createElement("span");
      mark.className = "choice-mark";
      mark.setAttribute("aria-hidden", "true");

      var text = document.createElement("span");
      text.className = "choice-label";
      text.textContent = opt.label;

      label.appendChild(input);
      label.appendChild(mark);
      label.appendChild(text);
      list.appendChild(label);
    });

    list.addEventListener("change", function (e) {
      if (e.target && e.target.classList.contains("choice-input")) {
        markSelected(list, e.target.closest(".choice"));
        errorEl.hidden = true;
      }
    });

    fieldset.appendChild(list);
    questionsEl.appendChild(fieldset);

    errorEl.hidden = true;
    backBtn.disabled = currentIndex === 0;
    nextBtn.textContent = currentIndex === QUESTIONS.length - 1 ? "See my results →" : "Next →";

    renderProgress();
  }

  function collectCurrentAnswer() {
    var q = QUESTIONS[currentIndex];
    var checked = form.querySelector('input[name="q-' + q.dim + '"]:checked');
    return checked ? checked.value : null;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = collectCurrentAnswer();
    if (!value) {
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    answers[QUESTIONS[currentIndex].dim] = value;

    if (currentIndex < QUESTIONS.length - 1) {
      currentIndex += 1;
      renderQuestion();
      return;
    }

    // Belt-and-suspenders: every step already validated its own answer on
    // the way in, so this should always be true by the last question — but
    // fail safe rather than rendering results off an incomplete answer set.
    if (allAnswered(answers, QUESTIONS)) {
      renderResults(answers);
    } else {
      errorEl.hidden = false;
    }
  });

  backBtn.addEventListener("click", function () {
    if (currentIndex === 0) return;
    currentIndex -= 1;
    renderQuestion();
  });

  function buildMatchRing(pct, rank) {
    var svgNS = "http://www.w3.org/2000/svg";
    var size = rank === 0 ? 108 : 76;
    var stroke = rank === 0 ? 10 : 8;
    var radius = (size - stroke) / 2;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference * (1 - pct / 100);
    var fillClass = rank === 0 ? "gold" : rank === 1 ? "sky" : "lime";

    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "match-ring");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", pct + " percent match");

    var track = document.createElementNS(svgNS, "circle");
    track.setAttribute("class", "match-ring-track");
    track.setAttribute("cx", String(size / 2));
    track.setAttribute("cy", String(size / 2));
    track.setAttribute("r", String(radius));
    track.setAttribute("stroke-width", String(stroke));
    svg.appendChild(track);

    var fill = document.createElementNS(svgNS, "circle");
    fill.setAttribute("class", "match-ring-fill match-ring-fill--" + fillClass);
    fill.setAttribute("cx", String(size / 2));
    fill.setAttribute("cy", String(size / 2));
    fill.setAttribute("r", String(radius));
    fill.setAttribute("stroke-width", String(stroke));
    fill.setAttribute("stroke-dasharray", circumference.toFixed(2));
    fill.setAttribute("stroke-dashoffset", (prefersReducedMotion ? offset : circumference).toFixed(2));
    fill.setAttribute("transform", "rotate(-90 " + size / 2 + " " + size / 2 + ")");
    svg.appendChild(fill);

    var label = document.createElementNS(svgNS, "text");
    label.setAttribute("class", "match-ring-label");
    label.setAttribute("x", "50%");
    label.setAttribute("y", "50%");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "central");
    label.textContent = pct + "%";
    svg.appendChild(label);

    if (!prefersReducedMotion) {
      // Animate the ring filling in on the next paint rather than jumping
      // straight to its final offset.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          fill.setAttribute("stroke-dashoffset", offset.toFixed(2));
        });
      });
    }

    return svg;
  }

  function renderResults(finalAnswers) {
    var ranked = rankHobbies(finalAnswers, HOBBIES).slice(0, 3);
    var maxScore = DIMENSIONS.length * 2;
    resultsList.innerHTML = "";

    ranked.forEach(function (entry, i) {
      var pct = Math.round((entry.score / maxScore) * 100);
      var card = document.createElement("article");
      card.className = "result-card " + (i === 0 ? "result-card--featured" : "result-card--runner-up");

      card.appendChild(buildMatchRing(pct, i));

      var body = document.createElement("div");
      body.className = "result-body";

      var rank = document.createElement("span");
      rank.className = "result-rank";
      rank.textContent = i === 0 ? "Best match" : "#" + (i + 1) + " match";

      var title = document.createElement("h3");
      title.className = "result-name";
      title.textContent = entry.hobby.name;

      var why = document.createElement("p");
      why.className = "result-why";
      why.textContent = generateWhy(finalAnswers, entry.hobby);

      body.appendChild(rank);
      body.appendChild(title);
      body.appendChild(why);
      card.appendChild(body);

      resultsList.appendChild(card);
    });

    quizView.hidden = true;
    resultsView.hidden = false;

    if (!prefersReducedMotion) {
      launchConfetti();
    }
  }

  function launchConfetti() {
    var canvas = document.getElementById("confetti-canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var width = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 320;
    var height = 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    var pieces = [];
    var count = 70;
    for (var i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * width,
        y: -20 - Math.random() * height,
        size: 4 + Math.random() * 5,
        color: STEP_COLORS[i % STEP_COLORS.length],
        speed: 1.5 + Math.random() * 2.5,
        drift: (Math.random() - 0.5) * 1.5,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    var start = null;
    var duration = 2200;

    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      ctx.clearRect(0, 0, width, height);
      pieces.forEach(function (p) {
        p.y += p.speed;
        p.x += p.drift;
        p.spin += p.spinSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (elapsed < duration) {
        window.requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }
    window.requestAnimationFrame(frame);
  }

  retakeBtn.addEventListener("click", function () {
    answers = {};
    currentIndex = 0;
    form.reset();
    quizView.hidden = false;
    resultsView.hidden = true;
    renderQuestion();
  });

  renderQuestion();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    allAnswered,
    scoreHobby,
    rankHobbies,
    generateWhy,
    DIMENSIONS,
  };
}
