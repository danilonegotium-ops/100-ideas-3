// Recipe Scaler — parsing and scaling are pure functions so the math can be
// sanity-checked from Node without a browser.

const KNOWN_UNITS = [
  "g", "gram", "grams", "kg", "kilogram", "kilograms", "mg",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
  "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "pinch", "pinches", "clove", "cloves", "slice", "slices",
  "can", "cans", "package", "packages", "pkg", "stick", "sticks",
  "piece", "pieces", "dash", "handful", "handfuls", "bunch", "bunches",
];

/** Pure: parse a fraction string like "1/2" into a number. */
function parseFraction(str) {
  const [n, d] = str.split("/").map(Number);
  if (!d) return n;
  return n / d;
}

/** Pure: parse a leading quantity token — mixed number, fraction, or decimal. */
function parseQuantityToken(str) {
  const trimmed = str.trim();
  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, frac] = trimmed.split(/\s+/);
    return parseInt(whole, 10) + parseFraction(frac);
  }
  if (/^\d+\/\d+$/.test(trimmed)) {
    return parseFraction(trimmed);
  }
  return parseFloat(trimmed);
}

/**
 * Pure: parse one recipe line into { qty, unit, name, raw }.
 * qty is `null` when no leading number is found (e.g. "salt to taste"),
 * in which case the line is passed through unscaled.
 */
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const qtyMatch = trimmed.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)/);
  if (!qtyMatch) {
    return { qty: null, unit: "", name: trimmed, raw: trimmed };
  }

  const qtyStr = qtyMatch[0];
  const qty = parseQuantityToken(qtyStr);
  let rest = trimmed.slice(qtyStr.length).trim();

  let unit = "";
  const unitMatch = rest.match(/^([a-zA-Z]+)\.?\s*(.*)$/);
  if (unitMatch) {
    const token = unitMatch[1].toLowerCase();
    const singular = token.endsWith("s") ? token.slice(0, -1) : token;
    if (KNOWN_UNITS.includes(token) || KNOWN_UNITS.includes(singular)) {
      unit = unitMatch[1];
      rest = unitMatch[2].trim();
    }
  }

  return { qty, unit, name: rest, raw: trimmed };
}

/** Pure: round to 1 decimal place, dropping a trailing ".0". */
function formatQty(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Pure: parse a full recipe textarea (multi-line string) and scale every
 * quantity by targetServings/originalServings, rounded to 1 decimal.
 * Returns { lines, factor, unparsedCount } where each line has the scaled
 * display string plus the parsed pieces.
 */
function scaleRecipe(recipeText, originalServings, targetServings) {
  const original = Number(originalServings);
  const target = Number(targetServings);
  const factor = original > 0 ? target / original : 1;

  const rawLines = recipeText.split("\n");
  let unparsedCount = 0;

  const lines = rawLines
    .map((line) => parseLine(line))
    .filter(Boolean)
    .map((parsed) => {
      if (parsed.qty === null) {
        unparsedCount += 1;
        return { ...parsed, scaledQty: null, display: parsed.raw };
      }
      const scaledQty = parsed.qty * factor;
      const unitPart = parsed.unit ? `${parsed.unit} ` : "";
      const display = `${formatQty(scaledQty)} ${unitPart}${parsed.name}`.replace(/\s+/g, " ").trim();
      return { ...parsed, scaledQty, display };
    });

  return { lines, factor, unparsedCount };
}

if (typeof document !== "undefined") {
  const recipeInput = document.getElementById("recipe-input");
  const originalInput = document.getElementById("original-servings");
  const targetInput = document.getElementById("target-servings");
  const scaleBtn = document.getElementById("scale-btn");
  const resultWrap = document.getElementById("result-wrap");
  const resultList = document.getElementById("result-list");
  const factorLabel = document.getElementById("factor-label");
  const warningsEl = document.getElementById("parse-warnings");

  function runScale() {
    const text = recipeInput.value;
    if (!text.trim()) return;

    const original = parseFloat(originalInput.value) || 1;
    const target = parseFloat(targetInput.value) || 1;
    const { lines, factor, unparsedCount } = scaleRecipe(text, original, target);

    factorLabel.textContent = formatQty(factor);
    resultList.innerHTML = "";
    lines.forEach((line) => {
      const li = document.createElement("li");
      li.className = "rs-row";
      if (line.scaledQty !== null) {
        const unitPart = line.unit ? `${line.unit} ` : "";

        const origSpan = document.createElement("span");
        origSpan.className = "rs-orig";
        origSpan.textContent = `${formatQty(line.qty)} ${unitPart}`.trim();

        const arrowSpan = document.createElement("span");
        arrowSpan.className = "rs-row-arrow";
        arrowSpan.setAttribute("aria-hidden", "true");
        arrowSpan.textContent = "→";

        const qtySpan = document.createElement("span");
        qtySpan.className = "rs-qty";
        qtySpan.textContent = `${formatQty(line.scaledQty)} ${unitPart}`.trim();

        const nameSpan = document.createElement("span");
        nameSpan.className = "rs-name";
        nameSpan.textContent = line.name;

        li.appendChild(origSpan);
        li.appendChild(arrowSpan);
        li.appendChild(qtySpan);
        li.appendChild(nameSpan);
      } else {
        li.classList.add("rs-row--plain");
        const nameSpan = document.createElement("span");
        nameSpan.className = "rs-name";
        nameSpan.textContent = line.raw;
        li.appendChild(nameSpan);
      }
      resultList.appendChild(li);
    });

    warningsEl.textContent = unparsedCount > 0
      ? `${unparsedCount} line(s) had no leading quantity and were left as-is.`
      : "";

    resultWrap.hidden = false;
  }

  scaleBtn.addEventListener("click", runScale);

  // Servings steppers — tactile +/- controls; re-run the scale live if a
  // result is already showing so nudging servings feels instant.
  document.querySelectorAll(".rs-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetInput = document.getElementById(btn.getAttribute("data-target"));
      const dir = Number(btn.getAttribute("data-dir"));
      const current = parseFloat(targetInput.value) || 0;
      const next = Math.max(1, current + dir);
      targetInput.value = next;
      if (!resultWrap.hidden) runScale();
    });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseLine, parseQuantityToken, parseFraction, formatQty, scaleRecipe };
}
