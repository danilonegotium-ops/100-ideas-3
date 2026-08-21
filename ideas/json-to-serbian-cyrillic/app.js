// JSON to Serbian Cyrillic — app logic.
// Depends on LATIN_TO_CYRILLIC_PAIRS / MAPPING_TABLE_DISPLAY from data.js.

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a single regex (digraphs before single letters, longest match
 * first) plus a lookup map, from a list of [latin, cyrillic] pairs.
 */
function buildTransliterationMatcher(pairs) {
  const sorted = pairs.slice().sort((a, b) => b[0].length - a[0].length);
  const pattern = sorted.map(([latin]) => escapeRegExp(latin)).join("|");
  const regex = new RegExp(pattern, "g");
  const map = new Map(sorted);
  return { regex, map };
}

/**
 * Transliterates a plain string of Serbian Latin text into Serbian Cyrillic.
 * Pure function — no DOM dependency — so it can be sanity-checked with node.
 * @param {string} text
 * @param {[string,string][]} pairs
 * @returns {string}
 */
function transliterateText(text, pairs) {
  if (!text) return text;
  const { regex, map } = buildTransliterationMatcher(pairs);
  return text.replace(regex, (match) => map.get(match));
}

/**
 * Recursively walks a parsed JSON value, transliterating string values
 * (and, optionally, object keys) while leaving numbers/booleans/null and
 * the overall structure untouched.
 * @param {*} value
 * @param {[string,string][]} pairs
 * @param {boolean} transliterateKeys
 * @returns {*}
 */
function transliterateJsonValue(value, pairs, transliterateKeys) {
  if (typeof value === "string") {
    return transliterateText(value, pairs);
  }
  if (Array.isArray(value)) {
    return value.map((v) => transliterateJsonValue(v, pairs, transliterateKeys));
  }
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value)) {
      const newKey = transliterateKeys ? transliterateText(key, pairs) : key;
      result[newKey] = transliterateJsonValue(value[key], pairs, transliterateKeys);
    }
    return result;
  }
  // numbers, booleans, null pass through unchanged
  return value;
}

/**
 * High-level conversion used by both the UI and the tests.
 * @param {string} input
 * @param {{mode: "json"|"text", transliterateKeys: boolean, pairs: [string,string][]}} opts
 * @returns {{ok: true, output: string} | {ok: false, error: string}}
 */
function convert(input, opts) {
  const pairs = opts.pairs;
  if (opts.mode === "text") {
    return { ok: true, output: transliterateText(input, pairs) };
  }
  // JSON mode
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return { ok: false, error: "Invalid JSON: " + e.message };
  }
  const converted = transliterateJsonValue(parsed, pairs, !!opts.transliterateKeys);
  return { ok: true, output: JSON.stringify(converted, null, 2) };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    escapeRegExp,
    buildTransliterationMatcher,
    transliterateText,
    transliterateJsonValue,
    convert
  };
}

(function initApp() {
  if (typeof document === "undefined") return;

  const input = document.getElementById("input");
  const output = document.getElementById("output");
  const errorBox = document.getElementById("error");
  const convertBtn = document.getElementById("convert-btn");
  const copyBtn = document.getElementById("copy-btn");
  const clearBtn = document.getElementById("clear-btn");
  const modeJson = document.getElementById("mode-json");
  const modeText = document.getElementById("mode-text");
  const keysToggleWrap = document.getElementById("keys-toggle-wrap");
  const keysToggle = document.getElementById("transliterate-keys");
  const mappingTableEl = document.getElementById("mapping-table");
  const charCount = document.getElementById("char-count");

  function currentMode() {
    return modeJson.checked ? "json" : "text";
  }

  function updateKeysToggleVisibility() {
    keysToggleWrap.style.display = currentMode() === "json" ? "" : "none";
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    output.value = "";
  }

  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function runConvert() {
    const value = input.value;
    if (!value.trim()) {
      hideError();
      output.value = "";
      return;
    }
    const result = convert(value, {
      mode: currentMode(),
      transliterateKeys: keysToggle.checked,
      pairs: LATIN_TO_CYRILLIC_PAIRS
    });
    if (result.ok) {
      hideError();
      output.value = result.output;
    } else {
      showError(result.error);
    }
  }

  convertBtn.addEventListener("click", runConvert);
  modeJson.addEventListener("change", () => {
    updateKeysToggleVisibility();
  });
  modeText.addEventListener("change", () => {
    updateKeysToggleVisibility();
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    hideError();
    updateCharCount();
    input.focus();
  });

  // --- Purely cosmetic UI sugar below; none of it touches convert/transliterate logic. ---

  function updateCharCount() {
    if (!charCount) return;
    const n = input.value.length;
    charCount.textContent = n + (n === 1 ? " char" : " chars");
  }
  if (charCount) {
    input.addEventListener("input", updateCharCount);
    updateCharCount();
  }

  // Cmd/Ctrl+Enter in the input textarea runs the conversion, echoing the
  // "run" shortcut of real code-editor/console tools.
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runConvert();
    }
  });

  copyBtn.addEventListener("click", () => {
    if (!output.value) return;
    const done = () => {
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = original), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(output.value).then(done, () => legacyCopy(output.value) && done());
    } else {
      legacyCopy(output.value) && done();
    }
  });

  function legacyCopy(text) {
    try {
      output.select();
      const ok = document.execCommand("copy");
      return ok;
    } catch (e) {
      return false;
    }
  }

  function renderMappingTable() {
    const table = document.createElement("table");
    table.className = "mapping-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Latin</th><th>Cyrillic</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    MAPPING_TABLE_DISPLAY.forEach(([latin, cyrillic]) => {
      const tr = document.createElement("tr");
      const tdLatin = document.createElement("td");
      tdLatin.textContent = latin;
      const tdCyr = document.createElement("td");
      tdCyr.textContent = cyrillic;
      tr.appendChild(tdLatin);
      tr.appendChild(tdCyr);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    mappingTableEl.appendChild(table);
  }

  updateKeysToggleVisibility();
  renderMappingTable();
})();
