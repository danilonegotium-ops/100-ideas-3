// Color Palette from Image — the quantization logic is a pure function over
// a plain array of [r,g,b] pixels, so it can be unit-tested from Node with
// synthetic pixel data (no Image/Canvas decoding needed for the math itself).
// All actual image reading happens client-side via <canvas>; nothing is
// ever uploaded to a server.

const MAX_SAMPLE_DIMENSION = 100; // downscale before sampling, for speed
const PALETTE_SIZE = 6;
const BUCKET_STEP = 24; // channel quantization step for binning similar colors

/** Pure: snap an RGB triple to a coarser grid so near-identical colors bucket together. */
function quantizeColor(r, g, b, step = BUCKET_STEP) {
  return [
    Math.round(r / step) * step,
    Math.round(g / step) * step,
    Math.round(b / step) * step,
  ];
}

/** Pure: clamp+format an RGB triple as a #rrggbb hex string. */
function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

/**
 * Pure: given a flat array of [r, g, b] pixel triples, bucket them into
 * coarse color bins, average the true color within each bin, and return the
 * top `count` bins by pixel frequency as { r, g, b, hex, count }.
 */
function extractPalette(pixels, count = PALETTE_SIZE) {
  const buckets = new Map();
  for (const [r, g, b] of pixels) {
    const key = quantizeColor(r, g, b).join(",");
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { sum: [0, 0, 0], n: 0 };
      buckets.set(key, bucket);
    }
    bucket.sum[0] += r;
    bucket.sum[1] += g;
    bucket.sum[2] += b;
    bucket.n += 1;
  }

  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  return sorted.slice(0, count).map((bucket) => {
    const r = bucket.sum[0] / bucket.n;
    const g = bucket.sum[1] / bucket.n;
    const b = bucket.sum[2] / bucket.n;
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), hex: rgbToHex(r, g, b), count: bucket.n };
  });
}

/** Pure: compute a downscaled width/height that fits within maxDim, preserving aspect ratio. */
function computeSampleSize(srcW, srcH, maxDim = MAX_SAMPLE_DIMENSION) {
  if (srcW <= maxDim && srcH <= maxDim) return { width: srcW, height: srcH };
  const scale = maxDim / Math.max(srcW, srcH);
  return { width: Math.max(1, Math.round(srcW * scale)), height: Math.max(1, Math.round(srcH * scale)) };
}

/** Pure: convert a canvas ImageData-like {data, width, height} into an array of [r,g,b], skipping mostly-transparent pixels. */
function pixelsFromImageData(imageData) {
  const { data } = imageData;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixels;
}

/** Pure: RGB (0-255 each) -> HSL as {h: 0-360, s: 0-1, l: 0-1}. */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

/** Pure: HSL ({h: 0-360, s: 0-1, l: 0-1}) -> RGB as [r, g, b] (0-255 each). */
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const r = hue2rgb(p, q, hk + 1 / 3);
  const g = hue2rgb(p, q, hk);
  const b = hue2rgb(p, q, hk - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Pure: clamp a number between lo and hi. */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Pure: derive a usable UI accent color from an extracted swatch's RGB.
 * Keeps the swatch's hue but pulls saturation up (so a near-gray dominant
 * color still reads as a confident accent) and clamps lightness into a
 * range appropriate for the color scheme so a single fixed "on-accent" text
 * color (light text in light mode, dark text in dark mode) stays legible.
 */
function deriveAccentFromRgb(r, g, b, isDark) {
  const { h, s } = rgbToHsl(r, g, b);
  const targetS = clamp(Math.max(s, 0.45), 0, 0.9);
  const targetL = isDark ? 0.63 : 0.4;
  const [ar, ag, ab] = hslToRgb(h, targetS, targetL);
  return { r: ar, g: ag, b: ab, hex: rgbToHex(ar, ag, ab) };
}

if (typeof document !== "undefined") {
  const input = document.getElementById("image-input");
  const dropzone = document.getElementById("dropzone");
  const preview = document.getElementById("preview");
  const canvas = document.getElementById("work-canvas");
  const statusMsg = document.getElementById("status-msg");
  const sourceRow = document.getElementById("source-row");
  const sourceName = document.getElementById("source-name");
  const sourceDims = document.getElementById("source-dims");
  const statsRow = document.getElementById("stats-row");
  const swatchesEl = document.getElementById("swatches");
  const resetBtn = document.getElementById("btn-reset");

  const darkModeQuery = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  let lastDominant = null; // {r,g,b} of the current palette's top swatch, for re-deriving accent on scheme change

  function statChip(label, value) {
    const chip = document.createElement("span");
    chip.className = "stat-chip";
    const l = document.createElement("span");
    l.className = "stat-chip-label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "stat-chip-value";
    v.textContent = value;
    chip.appendChild(l);
    chip.appendChild(v);
    return chip;
  }

  function renderStats({ fileName, srcW, srcH, sampleW, sampleH, colorCount }) {
    statsRow.innerHTML = "";
    statsRow.appendChild(statChip("File", fileName));
    statsRow.appendChild(statChip("Dimensions", `${srcW}×${srcH}`));
    statsRow.appendChild(statChip("Sampled at", `${sampleW}×${sampleH}`));
    statsRow.appendChild(statChip("Colors", String(colorCount)));
    statsRow.hidden = false;
  }

  function applyDynamicAccent(dominant) {
    lastDominant = dominant;
    const isDark = !!(darkModeQuery && darkModeQuery.matches);
    const accent = deriveAccentFromRgb(dominant.r, dominant.g, dominant.b, isDark);
    const root = document.documentElement.style;
    root.setProperty("--accent", accent.hex);
    root.setProperty("--accent-rgb", `${accent.r}, ${accent.g}, ${accent.b}`);
    root.setProperty("--accent-on", isDark ? "#131210" : "#fffdf9");
  }

  function resetDynamicAccent() {
    lastDominant = null;
    const root = document.documentElement.style;
    root.removeProperty("--accent");
    root.removeProperty("--accent-rgb");
    root.removeProperty("--accent-on");
  }

  if (darkModeQuery) {
    darkModeQuery.addEventListener("change", () => {
      if (lastDominant) applyDynamicAccent(lastDominant);
    });
  }

  function renderSwatches(palette) {
    swatchesEl.innerHTML = "";
    palette.forEach((color) => {
      const btn = document.createElement("button");
      btn.className = "palette-swatch";
      btn.type = "button";
      btn.setAttribute("role", "listitem");
      btn.title = "Click to copy hex code";

      const colorBlock = document.createElement("span");
      colorBlock.className = "palette-swatch-color";
      colorBlock.style.background = color.hex;
      colorBlock.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "palette-swatch-label";
      label.textContent = color.hex;

      btn.appendChild(colorBlock);
      btn.appendChild(label);

      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(color.hex);
        } catch (err) {
          // Clipboard API can be blocked (permissions/non-HTTPS); fall back
          // to a visible selection the user can copy manually.
          const range = document.createRange();
          range.selectNodeContents(label);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        const original = label.textContent;
        label.textContent = "Copied!";
        label.classList.add("copied");
        setTimeout(() => {
          label.textContent = original;
          label.classList.remove("copied");
        }, 1000);
      });

      swatchesEl.appendChild(btn);
    });
    swatchesEl.hidden = palette.length === 0;
  }

  function resetUI() {
    input.value = "";
    statusMsg.textContent = "";
    statusMsg.classList.remove("is-error");
    sourceRow.hidden = true;
    statsRow.hidden = true;
    statsRow.innerHTML = "";
    swatchesEl.hidden = true;
    swatchesEl.innerHTML = "";
    preview.removeAttribute("src");
    preview.hidden = true;
    resetDynamicAccent();
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      statusMsg.textContent = "That file isn't an image.";
      statusMsg.classList.add("is-error");
      return;
    }

    statusMsg.classList.remove("is-error");
    statusMsg.textContent = "Reading image...";
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      preview.src = objectUrl;
      preview.hidden = false;
      sourceName.textContent = file.name || "image";
      sourceDims.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
      sourceRow.hidden = false;

      const { width, height } = computeSampleSize(img.naturalWidth, img.naturalHeight);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, width, height);
      } catch (err) {
        statusMsg.textContent = "Could not read pixel data from this image (it may be cross-origin).";
        statusMsg.classList.add("is-error");
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const pixels = pixelsFromImageData(imageData);
      const palette = extractPalette(pixels, PALETTE_SIZE);
      renderSwatches(palette);
      renderStats({
        fileName: file.name || "image",
        srcW: img.naturalWidth,
        srcH: img.naturalHeight,
        sampleW: width,
        sampleH: height,
        colorCount: palette.length,
      });

      if (palette.length > 0) {
        // Palette is sorted by pixel frequency, so [0] is the dominant color.
        applyDynamicAccent(palette[0]);
      }

      statusMsg.textContent = `Extracted ${palette.length} colors from ${file.name}. Click a swatch to copy its hex code.`;

      URL.revokeObjectURL(objectUrl);
    };

    img.onerror = () => {
      statusMsg.textContent = "That file couldn't be loaded as an image.";
      statusMsg.classList.add("is-error");
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;
  }

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    handleFile(file);
  });

  // Drag-and-drop wiring around the file input. The input itself covers the
  // whole dropzone (see theme.css) so a plain click already opens the native
  // picker; these listeners only add the visual drag state and handle the
  // actual dropped file (we read the file straight from the DataTransfer
  // rather than relying on the browser's own drop-into-input behavior, which
  // isn't consistent once preventDefault() is called on the drop event).
  let dragDepth = 0;
  dropzone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth += 1;
    dropzone.classList.add("is-dragover");
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  dropzone.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropzone.classList.remove("is-dragover");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove("is-dragover");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(file);
  });

  resetBtn.addEventListener("click", resetUI);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    quantizeColor,
    rgbToHex,
    extractPalette,
    computeSampleSize,
    pixelsFromImageData,
    rgbToHsl,
    hslToRgb,
    deriveAccentFromRgb,
  };
}
