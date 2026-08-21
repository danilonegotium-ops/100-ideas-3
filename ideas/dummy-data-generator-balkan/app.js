// Dummy Data Generator (Balkan) — app logic.
// Depends on FIRST_NAMES / LAST_NAMES / CITIES / EMAIL_DOMAINS from data.js.

const DIACRITIC_MAP = {
  š: "s", Š: "S", č: "c", Č: "C", ć: "c", Ć: "C",
  ž: "z", Ž: "Z", đ: "dj", Đ: "Dj"
};

/** Strips Serbian diacritics down to plain ASCII (đ -> dj). */
function stripDiacritics(str) {
  return str.replace(/[šŠčČćĆžŽđĐ]/g, (ch) => DIACRITIC_MAP[ch]);
}

/** Lowercases + strips diacritics + keeps only a-z, for email local-parts. */
function toEmailSlug(str) {
  return stripDiacritics(str).toLowerCase().replace(/[^a-z]/g, "");
}

function randomItem(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function randomDigits(count, rng) {
  let out = "";
  for (let i = 0; i < count; i++) out += Math.floor(rng() * 10);
  return out;
}

/** Serbian mobile numbers start +381 6X. */
function generatePhone(rng) {
  const prefix = "6" + Math.floor(rng() * 10); // 60-69
  return "+381 " + prefix + " " + randomDigits(3, rng) + " " + randomDigits(4, rng);
}

function generateEmail(firstName, lastName, rng, domains) {
  const num = Math.floor(rng() * 100); // 0-99, no leading-zero padding needed for uniqueness aid
  return toEmailSlug(firstName) + "." + toEmailSlug(lastName) + num + "@" + randomItem(domains, rng);
}

/**
 * Generates a single fake profile. Pure aside from the injected rng, so it
 * is deterministic-per-call-sequence and easy to sanity-check with node.
 */
function generateProfile(rng, seed) {
  const firstName = randomItem(seed.FIRST_NAMES, rng);
  const lastName = randomItem(seed.LAST_NAMES, rng);
  const city = randomItem(seed.CITIES, rng);
  return {
    firstName,
    lastName,
    city,
    phone: generatePhone(rng),
    email: generateEmail(firstName, lastName, rng, seed.EMAIL_DOMAINS)
  };
}

/** Generates N profiles, clamped to [1, 100]. */
function generateProfiles(count, rng, seed) {
  const n = Math.max(1, Math.min(100, Math.floor(count) || 0));
  const profiles = [];
  for (let i = 0; i < n; i++) profiles.push(generateProfile(rng, seed));
  return profiles;
}

function csvEscape(value) {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function profilesToCSV(profiles) {
  const headers = ["firstName", "lastName", "city", "phone", "email"];
  const lines = [headers.join(",")];
  profiles.forEach((p) => {
    lines.push(headers.map((h) => csvEscape(p[h])).join(","));
  });
  return lines.join("\n");
}

function profilesToJSON(profiles) {
  return JSON.stringify(profiles, null, 2);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    stripDiacritics,
    toEmailSlug,
    generatePhone,
    generateEmail,
    generateProfile,
    generateProfiles,
    csvEscape,
    profilesToCSV,
    profilesToJSON
  };
}

/** Escapes &, <, > so generated text is safe to drop into innerHTML. */
function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
}

/**
 * Minimal JSON syntax highlighter (regex-based, no dependency) — wraps
 * keys/strings/numbers/booleans/null in classed spans for the code-block view.
 */
function highlightJSON(jsonString) {
  const escaped = escapeHtml(jsonString);
  return escaped.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "jt-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "jt-key" : "jt-string";
      } else if (/true|false/.test(match)) {
        cls = "jt-boolean";
      } else if (/null/.test(match)) {
        cls = "jt-null";
      }
      return '<span class="' + cls + '">' + match + "</span>";
    }
  );
}

(function initApp() {
  if (typeof document === "undefined") return;

  const seed = { FIRST_NAMES, LAST_NAMES, CITIES, EMAIL_DOMAINS };
  const countInput = document.getElementById("count");
  const generateBtn = document.getElementById("generate-btn");
  const copyJsonBtn = document.getElementById("copy-json-btn");
  const copyCsvBtn = document.getElementById("copy-csv-btn");
  const tableBody = document.querySelector("#result-table tbody");
  const tableWrap = document.getElementById("table-wrap");
  const summary = document.getElementById("summary");
  const jsonOutput = document.getElementById("json-output");
  const csvOutput = document.getElementById("csv-output");
  const requestLine = document.getElementById("request-line");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const views = {
    table: document.getElementById("view-table"),
    json: document.getElementById("view-json"),
    csv: document.getElementById("view-csv")
  };

  let currentProfiles = [];

  function setActiveTab(name) {
    tabs.forEach((tab) => {
      const active = tab.dataset.view === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    Object.keys(views).forEach((key) => {
      views[key].hidden = key !== name;
    });
  }

  function render(profiles) {
    currentProfiles = profiles;
    tableBody.innerHTML = "";
    profiles.forEach((p) => {
      const tr = document.createElement("tr");
      ["firstName", "lastName", "city", "phone", "email"].forEach((key) => {
        const td = document.createElement("td");
        td.textContent = p[key];
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
    tableWrap.hidden = profiles.length === 0;
    summary.textContent = profiles.length + " profile" + (profiles.length === 1 ? "" : "s") + " generated";
    copyJsonBtn.disabled = profiles.length === 0;
    copyCsvBtn.disabled = profiles.length === 0;
    jsonOutput.innerHTML = highlightJSON(profilesToJSON(profiles));
    csvOutput.textContent = profilesToCSV(profiles);
  }

  function updateRequestLine(count, ms) {
    requestLine.innerHTML =
      '<span class="req-method">GET</span> ' +
      '<span class="req-path">/profiles?locale=rs-Latn&amp;count=' + count + "</span> " +
      '<span class="req-arrow">&rarr;</span> ' +
      '<span class="req-status">200 OK</span> ' +
      '<span class="req-time">' + ms.toFixed(1) + "ms</span>";
  }

  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function doGenerate() {
    const requested = parseInt(countInput.value, 10);
    const n = Math.max(1, Math.min(100, isNaN(requested) ? 10 : requested));
    countInput.value = n;
    const t0 = now();
    const profiles = generateProfiles(n, Math.random, seed);
    const elapsed = now() - t0;
    render(profiles);
    updateRequestLine(profiles.length, elapsed);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.view));
  });

  function copy(text, btn) {
    const done = () => {
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = original), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => legacyCopy(text) && done());
    } else {
      legacyCopy(text) && done();
    }
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  generateBtn.addEventListener("click", doGenerate);
  copyJsonBtn.addEventListener("click", () => copy(profilesToJSON(currentProfiles), copyJsonBtn));
  copyCsvBtn.addEventListener("click", () => copy(profilesToCSV(currentProfiles), copyCsvBtn));

  doGenerate();
})();
