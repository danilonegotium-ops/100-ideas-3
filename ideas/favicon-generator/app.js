// Favicon Generator — the crop/resize math is a pure function so it can be
// sanity-checked from Node. The actual pixel work happens on a real
// <canvas> in the browser; nothing is uploaded to a server.

const SIZES = [
  { size: 16, filename: "favicon-16x16.png", label: "16×16" },
  { size: 32, filename: "favicon-32x32.png", label: "32×32" },
  { size: 48, filename: "favicon-48x48.png", label: "48×48" },
  { size: 180, filename: "apple-touch-icon.png", label: "180×180 (Apple touch)" },
  { size: 192, filename: "android-chrome-192x192.png", label: "192×192" },
  { size: 512, filename: "android-chrome-512x512.png", label: "512×512" },
];

/**
 * Pure: given a source image's width/height, compute the centered square
 * crop rectangle (an "object-fit: cover" style crop) to feed into
 * drawImage(img, sx, sy, sw, sh, 0, 0, targetSize, targetSize).
 */
function computeCoverCrop(srcW, srcH) {
  const side = Math.min(srcW, srcH);
  const sx = (srcW - side) / 2;
  const sy = (srcH - side) / 2;
  return { sx, sy, sw: side, sh: side };
}

/**
 * Draw `img` (any object with the shape { naturalWidth/width, naturalHeight/height }
 * that a canvas 2D context's drawImage accepts) into `canvas` at the given
 * square size, using a centered cover-crop, and return a PNG data URL.
 */
function renderFaviconDataUrl(img, canvas, size) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const { sx, sy, sw, sh } = computeCoverCrop(srcW, srcH);

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

  return canvas.toDataURL("image/png");
}

function generateAllFavicons(img, canvas) {
  return SIZES.map((cfg) => ({
    ...cfg,
    dataUrl: renderFaviconDataUrl(img, canvas, cfg.size),
  }));
}

// Display tuning for the "true relative scale" strip: every generated
// size renders proportionally against the largest one (capped so a
// 512px icon doesn't blow out the layout), so a 16x16 is honestly,
// dramatically tiny next to a 512x512 rather than normalized into
// equal-size cards. A per-item --hover-scale custom property lets you
// hover/tap a tiny swatch to "loupe" it up to a comparable inspection
// size, since some of these render at just a few real pixels.
const SCALE_STRIP_MAX_DISPLAY_PX = 128;
const SCALE_STRIP_MIN_DISPLAY_PX = 3;
const SCALE_STRIP_HOVER_TARGET_PX = 64;
const SCALE_STRIP_HOVER_SCALE_MAX = 16;

function renderResults(favicons) {
  const resultsSection = document.getElementById("results-section");
  const scaleStrip = document.getElementById("scale-strip");
  const manifest = document.getElementById("manifest");
  const downloadAllBtn = document.getElementById("download-all-btn");

  scaleStrip.innerHTML = "";
  manifest.innerHTML = "";

  if (!favicons.length) {
    resultsSection.hidden = true;
    downloadAllBtn.hidden = true;
    return;
  }

  const largest = Math.max(...favicons.map((fav) => fav.size));
  const scale = SCALE_STRIP_MAX_DISPLAY_PX / largest;

  favicons.forEach((fav) => {
    const displayPx = Math.max(Math.round(fav.size * scale), SCALE_STRIP_MIN_DISPLAY_PX);
    const hoverScale = Math.min(
      Math.max(SCALE_STRIP_HOVER_TARGET_PX / displayPx, 1),
      SCALE_STRIP_HOVER_SCALE_MAX
    );

    const item = document.createElement("div");
    item.className = "scale-item";

    const swatch = document.createElement("img");
    swatch.src = fav.dataUrl;
    swatch.width = displayPx;
    swatch.height = displayPx;
    swatch.alt = `${fav.label} preview, rendered at true relative scale`;
    swatch.className = "scale-swatch";
    swatch.style.setProperty("--hover-scale", hoverScale.toFixed(2));

    const tick = document.createElement("div");
    tick.className = "scale-tick";

    const label = document.createElement("div");
    label.className = "scale-label";
    label.textContent = `${fav.size}×${fav.size}`;

    item.appendChild(swatch);
    item.appendChild(tick);
    item.appendChild(label);
    scaleStrip.appendChild(item);

    const row = document.createElement("div");
    row.className = "manifest-row";

    const name = document.createElement("span");
    name.className = "manifest-name";
    name.textContent = fav.filename;

    const dims = document.createElement("span");
    dims.className = "manifest-dims";
    dims.textContent = fav.label;

    const link = document.createElement("a");
    link.className = "btn btn-sm";
    link.href = fav.dataUrl;
    link.download = fav.filename;
    link.textContent = "↓ save";

    row.appendChild(name);
    row.appendChild(dims);
    row.appendChild(link);
    manifest.appendChild(row);
  });

  resultsSection.hidden = false;
  downloadAllBtn.hidden = false;
  downloadAllBtn.onclick = () => {
    favicons.forEach((fav, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = fav.dataUrl;
        a.download = fav.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 200);
    });
  };
}

if (typeof document !== "undefined") {
  const input = document.getElementById("image-input");
  const dropzone = document.getElementById("dropzone");
  const canvas = document.getElementById("work-canvas");
  const statusLine = document.getElementById("status-msg");
  const statusText = document.getElementById("status-text");

  function setStatus(text, state) {
    statusText.textContent = text;
    statusLine.classList.remove("is-busy", "is-done", "is-error");
    if (state) statusLine.classList.add(state);
  }

  function processFile(file) {
    if (!file) return;

    setStatus(`processing ${file.name}...`, "is-busy");
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const favicons = generateAllFavicons(img, canvas);
        renderResults(favicons);
        setStatus(`${favicons.length} sizes generated from ${file.name} — click any "save" to download`, "is-done");
      } catch (err) {
        setStatus("could not process this image (it may be an unsupported format)", "is-error");
      }
      URL.revokeObjectURL(objectUrl);
    };

    img.onerror = () => {
      setStatus("that file couldn't be loaded as an image", "is-error");
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;
  }

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    processFile(file);
  });

  // Drag-and-drop onto the dropzone, matching the dashed-dropzone pattern
  // researched on 21st.dev — dragover highlights the border, drop hands
  // the file to the same processFile() path the <input> change uses.
  if (dropzone) {
    ["dragenter", "dragover"].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "dragend"].forEach((evt) => {
      dropzone.addEventListener(evt, () => {
        dropzone.classList.remove("is-dragover");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      processFile(file);
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SIZES, computeCoverCrop, renderFaviconDataUrl };
}
