// Markdown to PDF Resume — app logic.
// Small markdown-to-HTML parser covering the common subset needed for a
// resume: headers (#..######), bold (**/__), italic (*/_), unordered and
// ordered lists, links, and horizontal rules. Not a full CommonMark
// implementation by design (see SPEC.md).

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Applies inline-level formatting (bold, italic, links, inline code) to a single line of text. */
function renderInline(text) {
  let out = escapeHtml(text);
  // links: [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  // bold: **text** or __text__
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // italic: *text* or _text_ (after bold, so single markers left over are italics)
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/_(.+?)_/g, "<em>$1</em>");
  // inline code: `code`
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

/**
 * Converts a Markdown string into an HTML string.
 * Supports: headers (1-6 hashes), bold (** or __), italic (single star or
 * underscore), inline code, [text](url) links, unordered/ordered lists,
 * horizontal rules (three+ dashes, stars, or underscores on their own
 * line), and paragraphs (blank-line separated; single newlines within a
 * paragraph become <br>).
 * Pure function, no DOM dependency, safe to sanity-check with node.
 * @param {string} markdown
 * @returns {string}
 */
function markdownToHtml(markdown) {
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let paragraphBuffer = [];
  let i = 0;

  function flushParagraph() {
    if (paragraphBuffer.length) {
      out.push("<p>" + paragraphBuffer.map(renderInline).join("<br>") + "</p>");
      paragraphBuffer = [];
    }
  }

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") {
      flushParagraph();
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      out.push("<hr>");
      i++;
      continue;
    }

    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      flushParagraph();
      const level = headerMatch[1].length;
      out.push("<h" + level + ">" + renderInline(headerMatch[2]) + "</h" + level + ">");
      i++;
      continue;
    }

    if (/^[-*]\s+(.*)$/.test(trimmed)) {
      flushParagraph();
      const items = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^[-*]\s+(.*)$/);
        if (!m) break;
        items.push("<li>" + renderInline(m[1]) + "</li>");
        i++;
      }
      out.push("<ul>" + items.join("") + "</ul>");
      continue;
    }

    if (/^\d+\.\s+(.*)$/.test(trimmed)) {
      flushParagraph();
      const items = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\d+\.\s+(.*)$/);
        if (!m) break;
        items.push("<li>" + renderInline(m[1]) + "</li>");
        i++;
      }
      out.push("<ol>" + items.join("") + "</ol>");
      continue;
    }

    // Standalone italic paragraph marker line (e.g. a closing note) is just
    // regular text handled by the inline renderer below.
    paragraphBuffer.push(trimmed);
    i++;
  }
  flushParagraph();
  return out.join("\n");
}

/**
 * Counts words in a raw Markdown string (whitespace-delimited, ignoring
 * Markdown syntax characters). Pure function, used to drive the toolbar's
 * live word count in the editor chrome.
 * @param {string} markdown
 * @returns {number}
 */
function countWords(markdown) {
  const text = (markdown || "").trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { escapeHtml, renderInline, markdownToHtml, countWords };
}

(function initApp() {
  if (typeof document === "undefined") return;

  const input = document.getElementById("markdown-input");
  const preview = document.getElementById("preview");
  const downloadBtn = document.getElementById("download-btn");
  const resetBtn = document.getElementById("reset-btn");
  const stats = document.getElementById("stats");

  function updateStats() {
    if (!stats) return;
    const words = countWords(input.value);
    stats.textContent = words === 1 ? "1 word" : words + " words";
  }

  function render() {
    preview.innerHTML = markdownToHtml(input.value);
    updateStats();
  }

  input.value = STARTER_RESUME_MARKDOWN;
  render();

  input.addEventListener("input", render);

  downloadBtn.addEventListener("click", () => {
    window.print();
  });

  resetBtn.addEventListener("click", () => {
    if (input.value.trim() && !confirm("Replace your current text with the starter template?")) {
      return;
    }
    input.value = STARTER_RESUME_MARKDOWN;
    render();
  });
})();
