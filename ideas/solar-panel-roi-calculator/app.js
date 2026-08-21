/* Solar Panel ROI Calculator
 * Pure math functions (no DOM) so the estimate logic can be sanity-checked
 * with plain `node`. All numbers are ballpark planning estimates — see the
 * comment block at the top of data.js for sourcing/caveats.
 */

function systemSizeFromRoofArea(roofM2, areaPerKw) {
  var kw = roofM2 / areaPerKw;
  return Math.round(kw * 10) / 10;
}

function estimateSystemCost(systemSizeKw, costPerKwEUR) {
  return systemSizeKw * costPerKwEUR;
}

function estimateAnnualProductionKwh(systemSizeKw, annualYieldKwhPerKw) {
  return systemSizeKw * annualYieldKwhPerKw;
}

function estimateAnnualConsumptionKwh(monthlyBillEUR, pricePerKwhEUR) {
  if (pricePerKwhEUR <= 0) return 0;
  return (monthlyBillEUR / pricePerKwhEUR) * 12;
}

// Serbia's residential "prosumer" scheme nets surplus solar production
// against consumption within a billing/annual cycle rather than paying out
// full retail value for everything exported, so we conservatively cap the
// financially useful production at the household's own estimated annual
// consumption (self-consumption + same-year netting), not raw production.
function estimateAnnualSavingsEUR(annualProductionKwh, annualConsumptionKwh, pricePerKwhEUR) {
  var usefulKwh = Math.min(annualProductionKwh, annualConsumptionKwh);
  return usefulKwh * pricePerKwhEUR;
}

function estimatePaybackYears(systemCostEUR, annualSavingsEUR) {
  if (annualSavingsEUR <= 0) return Infinity;
  return systemCostEUR / annualSavingsEUR;
}

function calculateSolarROI(input, constants) {
  var city = constants.cities.find(function (c) { return c.key === input.cityKey; }) || constants.cities[0];

  var systemSizeKw = input.mode === 'roof'
    ? systemSizeFromRoofArea(input.roofM2, constants.usableRoofAreaPerKwM2)
    : Math.round(input.systemSizeKw * 10) / 10;

  var systemCostEUR = estimateSystemCost(systemSizeKw, constants.costPerKwEUR);
  var annualProductionKwh = estimateAnnualProductionKwh(systemSizeKw, city.annualYieldKwhPerKw);
  var annualConsumptionKwh = estimateAnnualConsumptionKwh(input.monthlyBillEUR, constants.avgResidentialPriceEURPerKWh);
  var annualSavingsEUR = estimateAnnualSavingsEUR(annualProductionKwh, annualConsumptionKwh, constants.avgResidentialPriceEURPerKWh);
  var paybackYears = estimatePaybackYears(systemCostEUR, annualSavingsEUR);

  return {
    city: city,
    systemSizeKw: systemSizeKw,
    systemCostEUR: Math.round(systemCostEUR),
    annualProductionKwh: Math.round(annualProductionKwh),
    annualConsumptionKwh: Math.round(annualConsumptionKwh),
    annualSavingsEUR: Math.round(annualSavingsEUR),
    paybackYears: paybackYears,
    oversized: annualProductionKwh > annualConsumptionKwh * 1.15
  };
}

/* ---- SVG payback-timeline chart ----
 * Renders the projected cumulative cash flow (install cost paid upfront,
 * then annual savings compounding linearly, matching the no-degradation
 * scope call in SPEC.md) across the system's assumed lifetime, shading the
 * pre-payback deficit and post-payback profit differently and marking the
 * break-even point. Pure string-building from already-computed result
 * fields — does not alter or duplicate the ROI math above.
 */
function buildPaybackChartSVG(result, constants) {
  var cost = result.systemCostEUR;
  var savings = result.annualSavingsEUR;
  var lifetime = constants.systemLifetimeYears;
  var payback = result.paybackYears;

  var cf0 = -cost;
  var cfT = -cost + savings * lifetime;
  var crossing = (isFinite(payback) && payback > 0 && payback <= lifetime) ? payback : null;

  var W = 600, H = 200, padL = 54, padR = 14, padT = 16, padB = 26;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;

  var rangeMin = Math.min(cf0, cfT, 0);
  var rangeMax = Math.max(cf0, cfT, 0);
  if (rangeMax - rangeMin < 1) { rangeMax += 1; rangeMin -= 1; }

  function xAt(year) { return padL + (year / lifetime) * plotW; }
  function yAt(v) { return padT + plotH - ((v - rangeMin) / (rangeMax - rangeMin)) * plotH; }
  function fmtSigned(n) {
    var abs = Math.round(Math.abs(n)).toLocaleString('en-US');
    return (n < 0 ? '−€' : '€') + abs;
  }

  var x0 = xAt(0), y0 = yAt(cf0);
  var xT = xAt(lifetime), yT = yAt(cfT);
  var zeroY = yAt(0);

  var belowFill, aboveFill, belowLine, aboveLine;
  if (crossing !== null) {
    var xc = xAt(crossing);
    belowFill = 'M' + x0 + ',' + zeroY + ' L' + x0 + ',' + y0 + ' L' + xc + ',' + zeroY + ' Z';
    aboveFill = 'M' + xc + ',' + zeroY + ' L' + xT + ',' + yT + ' L' + xT + ',' + zeroY + ' Z';
    belowLine = 'M' + x0 + ',' + y0 + ' L' + xc + ',' + zeroY;
    aboveLine = 'M' + xc + ',' + zeroY + ' L' + xT + ',' + yT;
  } else {
    belowFill = 'M' + x0 + ',' + zeroY + ' L' + x0 + ',' + y0 + ' L' + xT + ',' + yT + ' L' + xT + ',' + zeroY + ' Z';
    aboveFill = '';
    belowLine = 'M' + x0 + ',' + y0 + ' L' + xT + ',' + yT;
    aboveLine = '';
  }

  var tickCount = 5;
  var xTicks = '';
  for (var i = 0; i <= tickCount; i++) {
    var yr = Math.round((lifetime / tickCount) * i);
    var tx = xAt(yr);
    var anchor = i === 0 ? 'start' : (i === tickCount ? 'end' : 'middle');
    xTicks += '<line x1="' + tx + '" y1="' + (padT + plotH) + '" x2="' + tx + '" y2="' + (padT + plotH + 4) + '" class="chart-zero-line"/>';
    xTicks += '<text x="' + tx + '" y="' + (padT + plotH + 17) + '" class="chart-tick" text-anchor="' + anchor + '">' + yr + 'y</text>';
  }

  var marker = '';
  if (crossing !== null) {
    var mx = xAt(crossing);
    var labelAnchor = crossing > lifetime * 0.7 ? 'end' : (crossing < lifetime * 0.15 ? 'start' : 'middle');
    marker =
      '<line x1="' + mx + '" y1="' + padT + '" x2="' + mx + '" y2="' + zeroY + '" class="chart-guide"/>' +
      '<circle cx="' + mx + '" cy="' + zeroY + '" r="5" class="chart-marker-dot"/>' +
      '<text x="' + mx + '" y="' + (padT - 4) + '" class="chart-marker-label" text-anchor="' + labelAnchor + '">Payback ' + payback.toFixed(1) + 'y</text>';
  }

  return (
    '<svg viewBox="0 0 ' + W + ' ' + H + '" class="payback-chart" role="img" aria-label="Projected cumulative cash flow over ' + lifetime + ' years' +
    (crossing !== null ? ', paying back at ' + payback.toFixed(1) + ' years' : '') + '">' +
      '<line x1="' + padL + '" y1="' + zeroY + '" x2="' + (padL + plotW) + '" y2="' + zeroY + '" class="chart-zero-line"/>' +
      '<path d="' + belowFill + '" class="chart-loss-fill"/>' +
      (aboveFill ? '<path d="' + aboveFill + '" class="chart-gain-fill"/>' : '') +
      '<path d="' + belowLine + '" class="chart-loss-line"/>' +
      (aboveLine ? '<path d="' + aboveLine + '" class="chart-gain-line"/>' : '') +
      marker +
      xTicks +
      '<text x="' + (padL - 8) + '" y="' + (yAt(rangeMax) + 4) + '" class="chart-tick" text-anchor="end">' + fmtSigned(rangeMax) + '</text>' +
      '<text x="' + (padL - 8) + '" y="' + (zeroY + 4) + '" class="chart-tick" text-anchor="end">€0</text>' +
      '<text x="' + (padL - 8) + '" y="' + (yAt(rangeMin) + 4) + '" class="chart-tick" text-anchor="end">' + fmtSigned(rangeMin) + '</text>' +
    '</svg>'
  );
}

/* ---- DOM wiring ---- */
if (typeof document !== 'undefined') {
  (function () {
    var sizeMode = document.getElementById('sizeMode');
    var kwField = document.getElementById('kwField');
    var roofField = document.getElementById('roofField');
    var systemSizeKwInput = document.getElementById('systemSizeKw');
    var roofAreaInput = document.getElementById('roofArea');
    var monthlyBillInput = document.getElementById('monthlyBill');
    var systemSizeKwSlider = document.getElementById('systemSizeKwSlider');
    var roofAreaSlider = document.getElementById('roofAreaSlider');
    var monthlyBillSlider = document.getElementById('monthlyBillSlider');
    var citySelect = document.getElementById('citySelect');
    var calculateBtn = document.getElementById('calculateBtn');
    var resultsCard = document.getElementById('resultsCard');

    SOLAR_CONSTANTS.cities.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = c.name + ' (' + c.region + ')';
      citySelect.appendChild(opt);
    });
    citySelect.value = 'beograd';

    function updateFieldVisibility() {
      var isRoof = sizeMode.value === 'roof';
      roofField.style.display = isRoof ? '' : 'none';
      kwField.style.display = isRoof ? 'none' : '';
    }

    function formatNumber(n) {
      return n.toLocaleString('en-US');
    }

    // Keep each number input's paired range slider in sync both ways, and
    // reflect the slider's position as a CSS custom property so the fill
    // color tracks the thumb (see .param-slider in theme.css). Purely
    // presentational — does not touch the calculation inputs/outputs.
    function bindSlider(numberEl, sliderEl) {
      function updateFillVar() {
        var min = parseFloat(sliderEl.min), max = parseFloat(sliderEl.max);
        var v = parseFloat(sliderEl.value);
        var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
        sliderEl.style.setProperty('--fill', pct + '%');
      }
      sliderEl.value = numberEl.value;
      updateFillVar();
      sliderEl.addEventListener('input', function () {
        numberEl.value = sliderEl.value;
        updateFillVar();
        numberEl.dispatchEvent(new Event('input', { bubbles: true }));
      });
      numberEl.addEventListener('input', function () {
        var v = parseFloat(numberEl.value);
        if (!isNaN(v)) {
          var min = parseFloat(sliderEl.min), max = parseFloat(sliderEl.max);
          sliderEl.value = Math.min(Math.max(v, min), max);
          updateFillVar();
        }
      });
    }
    bindSlider(systemSizeKwInput, systemSizeKwSlider);
    bindSlider(roofAreaInput, roofAreaSlider);
    bindSlider(monthlyBillInput, monthlyBillSlider);

    function render() {
      var input = {
        mode: sizeMode.value,
        systemSizeKw: Math.max(0.5, parseFloat(systemSizeKwInput.value) || 0.5),
        roofM2: Math.max(1, parseFloat(roofAreaInput.value) || 1),
        monthlyBillEUR: Math.max(0, parseFloat(monthlyBillInput.value) || 0),
        cityKey: citySelect.value
      };

      var result = calculateSolarROI(input, SOLAR_CONSTANTS);

      resultsCard.style.display = '';
      var paybackText = isFinite(result.paybackYears)
        ? result.paybackYears.toFixed(1)
        : '—';
      var paybackUnit = isFinite(result.paybackYears)
        ? 'years to break even'
        : 'not reachable at this bill amount';

      var oversizedNote = result.oversized
        ? '<div class="note">Estimated production is noticeably higher than your estimated annual consumption &mdash; a smaller system may pay back faster, since Serbia\'s prosumer scheme nets surplus against your own consumption rather than paying full retail for it.</div>'
        : '';

      var utilization = result.annualProductionKwh > 0
        ? Math.min(result.annualConsumptionKwh / result.annualProductionKwh, 1) * 100
        : 0;
      var meterBlock =
        '<div class="meter-block">' +
          '<div class="meter-head"><span>Self-consumption coverage</span><strong>' + Math.round(utilization) + '%</strong></div>' +
          '<div class="meter-track"><div class="meter-fill" style="width:' + utilization + '%;"></div></div>' +
        '</div>';

      resultsCard.innerHTML =
        '<div class="result-hero">' +
          '<p class="result-hero-label">Estimated payback period</p>' +
          '<div class="result-stat"><span class="result-stat-value">' + paybackText + '</span><span class="result-stat-unit">' + paybackUnit + '</span></div>' +
          '<p class="result-hero-city">for a ' + result.systemSizeKw + ' kW system in ' + result.city.name + ', ' + result.city.region + '</p>' +
        '</div>' +
        '<div class="chart-card">' +
          '<p class="chart-card-title">Cumulative cash flow over ' + SOLAR_CONSTANTS.systemLifetimeYears + ' assumed system years</p>' +
          buildPaybackChartSVG(result, SOLAR_CONSTANTS) +
        '</div>' +
        '<div class="kpi-grid">' +
          '<div class="kpi"><p class="kpi-label">Install cost</p><p class="kpi-value">&euro;' + formatNumber(result.systemCostEUR) + '</p></div>' +
          '<div class="kpi"><p class="kpi-label">Annual savings</p><p class="kpi-value green">&euro;' + formatNumber(result.annualSavingsEUR) + '</p></div>' +
          '<div class="kpi"><p class="kpi-label">Annual production</p><p class="kpi-value gold">' + formatNumber(result.annualProductionKwh) + ' kWh</p></div>' +
          '<div class="kpi"><p class="kpi-label">Annual consumption</p><p class="kpi-value">' + formatNumber(result.annualConsumptionKwh) + ' kWh</p></div>' +
        '</div>' +
        meterBlock +
        oversizedNote;
    }

    sizeMode.addEventListener('change', function () { updateFieldVisibility(); render(); });
    [systemSizeKwInput, roofAreaInput, monthlyBillInput, citySelect].forEach(function (el) {
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });
    calculateBtn.addEventListener('click', render);

    updateFieldVisibility();
    render();
  })();
}
