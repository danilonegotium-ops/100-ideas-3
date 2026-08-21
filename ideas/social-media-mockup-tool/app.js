// Social Media Mockup Tool — app logic.
// Depends on ICONS / DEFAULTS from data.js.

/**
 * Turns a free-typed display name into a TikTok-style handle: lowercase,
 * no spaces, only [a-z0-9._] kept, "@" prefixed. Pure function so it can be
 * sanity-checked with node.
 * @param {string} name
 * @returns {string}
 */
function toHandle(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "@yourhandle";
  const slug = trimmed
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
  return "@" + (slug || "yourhandle");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { toHandle };
}

(function initApp() {
  if (typeof document === "undefined") return;

  const nameInput = document.getElementById("display-name");
  const captionInput = document.getElementById("caption");
  const imageInput = document.getElementById("image-input");
  const tabButtons = document.querySelectorAll(".switch-btn");
  const frames = document.querySelectorAll(".mockup-frame");

  // 1. Inject icons (data-driven, from data.js) into every icon slot.
  document.querySelectorAll(".icon-slot").forEach((el) => {
    const iconName = el.getAttribute("data-icon");
    if (ICONS[iconName]) el.innerHTML = ICONS[iconName];
  });

  // 2. Text fields: name/caption/handle propagate to every frame.
  function renderText() {
    const name = nameInput.value.trim() || DEFAULTS.displayName;
    const caption = captionInput.value || "";
    const handle = toHandle(name);

    document.querySelectorAll('[data-field="name"]').forEach((el) => (el.textContent = name));
    document.querySelectorAll('[data-field="caption"]').forEach((el) => (el.textContent = caption));
    document.querySelectorAll('[data-field="handle"]').forEach((el) => (el.textContent = handle));
    document.querySelectorAll('[data-field="handle-inline"]').forEach((el) => (el.textContent = handle));
  }

  nameInput.addEventListener("input", renderText);
  captionInput.addEventListener("input", renderText);

  // 3. Image upload: read as a data URL and apply to every preview frame.
  imageInput.addEventListener("change", () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyImage(reader.result);
    reader.readAsDataURL(file);
  });

  function applyImage(dataUrl) {
    document.querySelectorAll('.mockup-photo-wrap').forEach((wrap) => {
      const img = wrap.querySelector('[data-role="image"]');
      const placeholder = wrap.querySelector('[data-role="placeholder"]');
      img.src = dataUrl;
      img.hidden = false;
      if (placeholder) placeholder.hidden = true;
    });
  }

  // 4. Platform tabs.
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const platform = btn.getAttribute("data-platform");
      tabButtons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
      });
      frames.forEach((frame) => {
        frame.classList.toggle("active", frame.getAttribute("data-frame") === platform);
      });
    });
  });

  // 5. Initial state.
  nameInput.value = DEFAULTS.displayName;
  captionInput.value = DEFAULTS.caption;
  renderText();
})();
