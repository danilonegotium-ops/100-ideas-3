// Font Matcher — pure scoring logic first (testable from Node via the
// module.exports guard at the bottom), DOM wiring after.
//
// This is a guided questionnaire matcher, not image recognition: the user
// describes what a font looked like and we score that description against a
// curated, tagged list of real Google Fonts.

var DIMENSIONS = ["category", "weight", "terminals", "width", "feature"];

// Category is the most visually distinctive trait, so it's weighted highest.
var WEIGHTS = { category: 3, weight: 1, terminals: 2, width: 2, feature: 2 };

var DIMENSION_LABELS = {
  category: { serif: "serif", "sans-serif": "sans-serif", monospace: "monospace", script: "handwritten/script" },
  weight: { light: "a light weight", regular: "a regular weight", bold: "a bold weight" },
  terminals: { rounded: "rounded terminals", sharp: "sharp terminals" },
  width: { condensed: "a condensed width", normal: "a normal width", wide: "a wide, expanded width" },
  feature: {
    "slab-serif": "thick slab serifs",
    geometric: "geometric, circular shapes",
    "high-contrast": "elegant high-contrast strokes",
    humanist: "a warm, humanist feel",
    none: "no strong distinctive feature",
  },
};

/** True if every question in `questions` has an answer in `answers`. */
function allAnswered(answers, questions) {
  return questions.every(function (q) {
    return Boolean(answers[q.dim]);
  });
}

/** Score one font against the user's questionnaire answers. */
function scoreFont(answers, font) {
  var score = 0;
  DIMENSIONS.forEach(function (dim) {
    if (answers[dim] && font[dim] === answers[dim]) {
      score += WEIGHTS[dim];
    }
  });
  return score;
}

/** Rank all fonts by score, descending, stable on ties (original order). */
function rankFonts(answers, fonts) {
  return fonts
    .map(function (font, i) {
      return { font: font, score: scoreFont(answers, font), i: i };
    })
    .sort(function (a, b) {
      return b.score - a.score || a.i - b.i;
    })
    .map(function (entry) {
      return { font: entry.font, score: entry.score };
    });
}

/** One-line explanation of which characteristics matched for this font. */
function generateMatchReason(answers, font) {
  var matched = DIMENSIONS.filter(function (dim) {
    return answers[dim] && font[dim] === answers[dim];
  }).map(function (dim) {
    return DIMENSION_LABELS[dim][answers[dim]];
  });

  if (matched.length === 0) {
    return "No strong matches on your answers, but this is a reasonable stylistic fallback.";
  }
  return "Matches: " + matched.join(", ") + ".";
}

/** Google Fonts specimen page URL for a given family name. */
function fontSpecimenUrl(family) {
  return "https://fonts.google.com/specimen/" + String(family).split(" ").join("+");
}

/** Build a single Google Fonts CSS2 <link> href that loads every family at once. */
function buildGoogleFontsHref(fonts) {
  var families = fonts
    .map(function (f) {
      return "family=" + String(f.family).split(" ").join("+");
    })
    .join("&");
  return "https://fonts.googleapis.com/css2?" + families + "&display=swap";
}

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

function initApp() {
  var questionsEl = document.getElementById("fm-questions");
  var form = document.getElementById("fm-form");
  var errorEl = document.getElementById("fm-error");
  var resultsView = document.getElementById("fm-results-view");
  var resultsList = document.getElementById("fm-results-list");
  var retakeBtn = document.getElementById("fm-retake");
  var eyebrowEl = document.getElementById("fm-eyebrow");
  var countEl = document.querySelector(".results-count");

  // Load every candidate font up front so results render instantly once
  // matched. This is the app's one deliberate external request; the same
  // link also covers the two families (Playfair Display, Inter) the UI
  // chrome itself uses, so no second font-loading mechanism is introduced.
  var fontsLink = document.createElement("link");
  fontsLink.rel = "stylesheet";
  fontsLink.href = buildGoogleFontsHref(FONTS);
  document.head.appendChild(fontsLink);

  if (eyebrowEl) {
    eyebrowEl.textContent = "Specimen catalog · " + FONTS.length + " typefaces";
  }

  function renderQuestions() {
    questionsEl.innerHTML = "";
    QUESTIONS.forEach(function (q, qIndex) {
      var item = document.createElement("fieldset");
      item.className = "q-item";

      var num = document.createElement("span");
      num.className = "q-num";
      num.setAttribute("aria-hidden", "true");
      num.textContent = String(qIndex + 1).padStart(2, "0");
      item.appendChild(num);

      var body = document.createElement("div");
      body.className = "q-body";

      var legend = document.createElement("legend");
      legend.className = "q-prompt";
      legend.textContent = q.prompt;
      body.appendChild(legend);

      var optionsWrap = document.createElement("div");
      optionsWrap.className = "q-options";

      q.options.forEach(function (opt) {
        var optLabel = document.createElement("label");
        optLabel.className = "stamp-option";

        var input = document.createElement("input");
        input.type = "radio";
        input.name = "q-" + q.dim;
        input.value = opt.value;

        var text = document.createElement("span");
        text.textContent = opt.label;

        optLabel.appendChild(input);
        optLabel.appendChild(text);
        optionsWrap.appendChild(optLabel);
      });

      body.appendChild(optionsWrap);
      item.appendChild(body);
      questionsEl.appendChild(item);
    });
  }

  function collectAnswers() {
    var answers = {};
    QUESTIONS.forEach(function (q) {
      var checked = form.querySelector('input[name="q-' + q.dim + '"]:checked');
      if (checked) answers[q.dim] = checked.value;
    });
    return answers;
  }

  function renderResults(answers) {
    var ranked = rankFonts(answers, FONTS).slice(0, 4);
    resultsList.innerHTML = "";
    if (countEl) countEl.textContent = "Top " + ranked.length + " of " + FONTS.length;

    ranked.forEach(function (entry, i) {
      var family = "'" + entry.font.family + "', " + entry.font.category;
      var card = document.createElement("article");
      card.className = "specimen-card";
      // Staggered reveal, matching the .fade-in cadence used elsewhere in
      // this project but authored fresh for this app's own CSS.
      card.style.animationDelay = (i * 90) + "ms";

      var head = document.createElement("div");
      head.className = "specimen-head";

      var no = document.createElement("span");
      no.className = "specimen-no";
      no.textContent = "No. " + String(i + 1).padStart(2, "0");
      head.appendChild(no);

      if (i === 0) {
        var badge = document.createElement("span");
        badge.className = "stamp-badge";
        badge.textContent = "Best match";
        head.appendChild(badge);
      }
      card.appendChild(head);

      var familyLabel = document.createElement("p");
      familyLabel.className = "specimen-family";
      familyLabel.textContent = entry.font.family + " — " + entry.font.category;
      card.appendChild(familyLabel);

      var displayLabel = document.createElement("p");
      displayLabel.className = "specimen-scale-label";
      displayLabel.textContent = "Display";
      card.appendChild(displayLabel);

      var display = document.createElement("p");
      display.className = "specimen-display";
      display.style.fontFamily = family;
      display.textContent = "The quick brown fox";
      card.appendChild(display);

      var bodyLabel = document.createElement("p");
      bodyLabel.className = "specimen-scale-label";
      bodyLabel.textContent = "Text";
      card.appendChild(bodyLabel);

      var body = document.createElement("p");
      body.className = "specimen-body";
      body.style.fontFamily = family;
      body.textContent = "The quick brown fox jumps over the lazy dog, showing how " + entry.font.family + " reads as running text.";
      card.appendChild(body);

      var reason = document.createElement("p");
      reason.className = "match-reason";
      reason.textContent = generateMatchReason(answers, entry.font);
      card.appendChild(reason);

      var specimenLink = document.createElement("a");
      specimenLink.className = "specimen-link";
      specimenLink.href = fontSpecimenUrl(entry.font.family);
      specimenLink.target = "_blank";
      specimenLink.rel = "noopener noreferrer";
      specimenLink.textContent = "View " + entry.font.family + " on Google Fonts ↗";
      card.appendChild(specimenLink);

      resultsList.appendChild(card);
    });

    form.hidden = true;
    resultsView.hidden = false;
    resultsView.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var answers = collectAnswers();
    if (!allAnswered(answers, QUESTIONS)) {
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    renderResults(answers);
  });

  retakeBtn.addEventListener("click", function () {
    form.reset();
    form.hidden = false;
    errorEl.hidden = true;
    resultsView.hidden = true;
  });

  renderQuestions();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    allAnswered,
    scoreFont,
    rankFonts,
    generateMatchReason,
    fontSpecimenUrl,
    buildGoogleFontsHref,
    DIMENSIONS,
  };
}
