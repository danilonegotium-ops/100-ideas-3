/* Logo Maker for Side Projects
 * All logo generation is pure client-side SVG string building — no canvas,
 * no external fonts/images, no network calls. The functions below are kept
 * free of DOM references so they can be sanity-checked with plain `node`.
 */

/* Curated "studio ink" palette — used by Randomize, the swatch strip, and
 * the proof-sheet gallery, so every generated mark stays on-brand with the
 * app's own type-specimen identity instead of generic bright pastels. */
var PRESET_COLORS = [
  '#2247d6', '#c1502a', '#3f6b3a', '#c08a28', '#7a3b69',
  '#1e7f7a', '#a23b3b', '#3d3a8c', '#6b7a2e', '#4a6fa5'
];
var STYLES = ['monogram', 'wordmark', 'badge'];
var SHAPES = ['circle', 'hexagon', 'square'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, function (c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c];
  });
}

function getInitials(name) {
  var trimmed = (name || '').trim();
  if (!trimmed) return '?';
  var words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0].slice(0, 1).toUpperCase();
}

function hexToRgb(hex) {
  var clean = String(hex || '').replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(function (c) { return c + c; }).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) clean = '34d399';
  var num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance(rgb) {
  var a = [rgb.r, rgb.g, rgb.b].map(function (v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastTextColor(hex) {
  var lum = relativeLuminance(hexToRgb(hex));
  return lum > 0.45 ? '#0b0d10' : '#ffffff';
}

function isValidHexColor(color) {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(color || ''));
}

function hexagonPoints(cx, cy, r) {
  var pts = [];
  for (var i = 0; i < 6; i++) {
    var angle = (Math.PI / 180) * (60 * i - 30);
    var x = cx + r * Math.cos(angle);
    var y = cy + r * Math.sin(angle);
    pts.push(round(x) + ',' + round(y));
  }
  return pts.join(' ');
}

function shapeMarkup(shape, cx, cy, r, color) {
  if (shape === 'hexagon') {
    return '<polygon points="' + hexagonPoints(cx, cy, r) + '" fill="' + color + '" />';
  }
  if (shape === 'square') {
    var size = r * 1.7;
    var x = cx - size / 2;
    var y = cy - size / 2;
    var rx = size * 0.22;
    return '<rect x="' + round(x) + '" y="' + round(y) + '" width="' + round(size) +
      '" height="' + round(size) + '" rx="' + round(rx) + '" fill="' + color + '" />';
  }
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '" />';
}

function buildMonogramSVG(opts) {
  var size = 240;
  var cx = size / 2;
  var cy = size / 2;
  var r = 100;
  var initials = getInitials(opts.name);
  var textColor = contrastTextColor(opts.color);
  var fontSize = initials.length > 1 ? 84 : 96;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
    '" width="' + size + '" height="' + size + '">\n  ' +
    shapeMarkup(opts.shape, cx, cy, r, opts.color) + '\n  ' +
    '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="' + fontSize +
    '" fill="' + textColor + '">' + escapeXml(initials) + '</text>\n</svg>';
}

function buildBadgeSVG(opts) {
  var size = 240;
  var cx = size / 2;
  var cy = size / 2;
  var outerR = 112;
  var innerR = 92;
  var initials = getInitials(opts.name);
  var textColor = contrastTextColor(opts.color);
  var fontSize = initials.length > 1 ? 78 : 88;
  var dots = [0, 72, 144, 216, 288].map(function (deg) {
    var rad = (Math.PI / 180) * (deg - 90);
    var x = cx + outerR * Math.cos(rad);
    var y = cy + outerR * Math.sin(rad);
    return '<circle cx="' + round(x) + '" cy="' + round(y) + '" r="4" fill="' + opts.color + '" />';
  }).join('\n  ');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
    '" width="' + size + '" height="' + size + '">\n  ' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + outerR + '" fill="none" stroke="' + opts.color + '" stroke-width="4" />\n  ' +
    dots + '\n  ' +
    shapeMarkup(opts.shape, cx, cy, innerR, opts.color) + '\n  ' +
    '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="' + fontSize +
    '" fill="' + textColor + '">' + escapeXml(initials) + '</text>\n</svg>';
}

function buildWordmarkSVG(opts) {
  var displayName = (opts.name || 'Brand').trim() || 'Brand';
  var fontSize = 42;
  var charWidthEstimate = fontSize * 0.62;
  var textWidth = Math.max(displayName.length * charWidthEstimate, fontSize * 2);
  var iconSize = 64;
  var gap = 18;
  var padX = 24;
  var padY = 28;
  var width = round(padX * 2 + iconSize + gap + textWidth);
  var height = round(iconSize + padY * 2);
  var iconCx = padX + iconSize / 2;
  var iconCy = height / 2;
  var iconR = iconSize / 2;
  var textX = padX + iconSize + gap;
  var textY = height / 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height +
    '" width="' + width + '" height="' + height + '">\n  ' +
    shapeMarkup(opts.shape, iconCx, iconCy, iconR, opts.color) + '\n  ' +
    '<text x="' + textX + '" y="' + textY + '" dominant-baseline="central" ' +
    'font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="' + fontSize +
    '" fill="#111827" textLength="' + round(textWidth) + '" lengthAdjust="spacingAndGlyphs">' +
    escapeXml(displayName) + '</text>\n</svg>';
}

function generateLogoSVG(options) {
  var color = isValidHexColor(options.color) ? options.color : '#34d399';
  var shape = SHAPES.indexOf(options.shape) === -1 ? 'circle' : options.shape;
  var opts = { name: options.name, color: color, shape: shape };
  if (options.style === 'wordmark') return buildWordmarkSVG(opts);
  if (options.style === 'badge') return buildBadgeSVG(opts);
  return buildMonogramSVG(opts);
}

function slugifyFilename(name) {
  var slug = (name || 'logo').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return (slug || 'logo') + '-logo.svg';
}

/* ---- DOM wiring (skipped entirely under node, so pure functions above stay testable) ---- */
if (typeof document !== 'undefined') {
  (function () {
    var nameInput = document.getElementById('brandName');
    var styleSelect = document.getElementById('styleSelect');
    var shapeSelect = document.getElementById('shapeSelect');
    var colorInput = document.getElementById('colorInput');
    var colorHex = document.getElementById('colorHex');
    var preview = document.getElementById('logoPreview');
    var regenerateBtn = document.getElementById('regenerateBtn');
    var downloadBtn = document.getElementById('downloadBtn');

    function currentOptions() {
      return {
        name: nameInput.value,
        style: styleSelect.value,
        shape: shapeSelect.value,
        color: colorInput.value
      };
    }

    function render() {
      colorHex.textContent = colorInput.value;
      var svg = generateLogoSVG(currentOptions());
      preview.innerHTML = svg;
    }

    function randomize() {
      styleSelect.value = STYLES[Math.floor(Math.random() * STYLES.length)];
      shapeSelect.value = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      colorInput.value = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      render();
    }

    function download() {
      var svg = generateLogoSVG(currentOptions());
      var blob = new Blob([svg], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = slugifyFilename(nameInput.value);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    nameInput.addEventListener('input', render);
    styleSelect.addEventListener('change', render);
    shapeSelect.addEventListener('change', render);
    colorInput.addEventListener('input', render);
    regenerateBtn.addEventListener('click', randomize);
    downloadBtn.addEventListener('click', download);

    render();
  })();
}
