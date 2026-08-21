/* Logo Maker — proof-sheet gallery.
 *
 * Loaded after app.js so it can reuse app.js's globals (generateLogoSVG,
 * slugifyFilename, PRESET_COLORS, STYLES, SHAPES — all declared with `var`
 * or `function` at top level of a classic, non-module script, so they hang
 * off `window`). This file never touches the logo-generation logic itself;
 * it only adds a live multi-variant gallery, a preset color swatch strip,
 * and a caption for the primary proof — all driven by the same #brandName /
 * #styleSelect / #shapeSelect / #colorInput controls app.js already wires.
 */
(function () {
  if (typeof document === 'undefined') return;

  var nameInput = document.getElementById('brandName');
  var styleSelect = document.getElementById('styleSelect');
  var shapeSelect = document.getElementById('shapeSelect');
  var colorInput = document.getElementById('colorInput');
  var regenerateBtn = document.getElementById('regenerateBtn');
  var swatchStrip = document.getElementById('swatchStrip');
  var variantGrid = document.getElementById('variantGrid');
  var primaryCaption = document.getElementById('primaryCaption');

  if (!nameInput || !styleSelect || !shapeSelect || !colorInput || !variantGrid) return;

  var paletteOffset = 0;

  function styleLabel(style, short) {
    if (style === 'wordmark') return short ? 'Wordmark' : 'Wordmark with icon';
    if (style === 'badge') return short ? 'Badge' : 'Badge / emblem';
    return short ? 'Monogram' : 'Monogram in shape';
  }

  function shapeLabel(shape) {
    if (shape === 'hexagon') return 'Hexagon';
    if (shape === 'square') return 'Rounded square';
    return 'Circle';
  }

  function buildSwatches() {
    if (!swatchStrip) return;
    swatchStrip.innerHTML = '';
    window.PRESET_COLORS.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = hex;
      b.setAttribute('aria-label', 'Set ink color ' + hex);
      b.addEventListener('click', function () {
        colorInput.value = hex;
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      swatchStrip.appendChild(b);
    });
  }

  function updateCaption() {
    if (!primaryCaption) return;
    primaryCaption.textContent = styleLabel(styleSelect.value) + ' · ' + shapeLabel(shapeSelect.value);
  }

  function downloadSVG(svg, filename) {
    var blob = new Blob([svg], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderVariants() {
    var name = nameInput.value;
    variantGrid.innerHTML = '';
    var i = 0;
    window.STYLES.forEach(function (style) {
      window.SHAPES.forEach(function (shape) {
        var color = window.PRESET_COLORS[(i + paletteOffset) % window.PRESET_COLORS.length];
        var opts = { name: name, style: style, shape: shape, color: color };
        var svg = window.generateLogoSVG(opts);

        var tile = document.createElement('div');
        tile.className = 'variant-tile';
        tile.tabIndex = 0;
        tile.setAttribute('role', 'button');
        tile.setAttribute('aria-label', 'Use ' + styleLabel(style) + ', ' + shapeLabel(shape) + ' variant');

        var frame = document.createElement('div');
        frame.className = 'proof-frame';
        frame.innerHTML = svg;
        tile.appendChild(frame);

        var caption = document.createElement('div');
        caption.className = 'variant-caption';

        var label = document.createElement('span');
        label.className = 'mono';
        label.textContent = styleLabel(style, true) + ' · ' + shapeLabel(shape);
        caption.appendChild(label);

        var dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'variant-download';
        dl.setAttribute('aria-label', 'Download this variant as SVG');
        dl.textContent = '↓';
        dl.addEventListener('click', function (evt) {
          evt.stopPropagation();
          downloadSVG(window.generateLogoSVG(opts), window.slugifyFilename((name || 'logo') + '-' + style + '-' + shape));
        });
        caption.appendChild(dl);
        tile.appendChild(caption);

        function promote() {
          styleSelect.value = style;
          shapeSelect.value = shape;
          colorInput.value = color;
          colorInput.dispatchEvent(new Event('input', { bubbles: true }));
          styleSelect.dispatchEvent(new Event('change', { bubbles: true }));
          shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        tile.addEventListener('click', promote);
        tile.addEventListener('keydown', function (evt) {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            promote();
          }
        });

        variantGrid.appendChild(tile);
        i++;
      });
    });
  }

  function refreshAll() {
    updateCaption();
    renderVariants();
  }

  buildSwatches();
  nameInput.addEventListener('input', refreshAll);
  styleSelect.addEventListener('change', updateCaption);
  shapeSelect.addEventListener('change', updateCaption);
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', function () {
      paletteOffset = (paletteOffset + 3) % window.PRESET_COLORS.length;
      refreshAll();
    });
  }

  refreshAll();
})();
