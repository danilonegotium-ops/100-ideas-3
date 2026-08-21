/* Board Game Night Organizer
 * Recommends games from the curated GAMES list (data.js) based on player
 * count and available time. The scoring/ranking functions below are pure
 * (no DOM) so they can be sanity-checked with plain `node`.
 */

function computePlayerScore(game, players) {
  if (players < game.minPlayers) return (game.minPlayers - players) * 2;
  if (players > game.maxPlayers) return (players - game.maxPlayers) * 2;
  var mid = (game.minPlayers + game.maxPlayers) / 2;
  return Math.abs(players - mid) * 0.3;
}

function computeTimeScore(game, minutes) {
  if (minutes >= game.maxTime) return (minutes - game.maxTime) * 0.15;
  if (minutes >= game.minTime) return 0;
  return (game.minTime - minutes) * 1.5;
}

function playerFitLabel(game, players) {
  if (players < game.minPlayers) return 'needs at least ' + game.minPlayers + ' players';
  if (players > game.maxPlayers) return 'best up to ' + game.maxPlayers + ' players';
  return 'fits your group size';
}

function timeFitLabel(game, minutes) {
  if (minutes >= game.maxTime) return 'comfortably fits your time';
  if (minutes >= game.minTime) return 'good time fit';
  return 'may run over your available time';
}

function rankGames(games, players, minutes, topN) {
  topN = topN || 5;
  players = Number(players);
  minutes = Number(minutes);
  var scored = games.map(function (g) {
    var playerScore = computePlayerScore(g, players);
    var timeScore = computeTimeScore(g, minutes);
    var fitsPlayers = players >= g.minPlayers && players <= g.maxPlayers;
    var fitsTime = minutes >= g.minTime;
    return Object.assign({}, g, {
      score: playerScore + timeScore,
      fitsPlayers: fitsPlayers,
      fitsTime: fitsTime,
      playerLabel: playerFitLabel(g, players),
      timeLabel: timeFitLabel(g, minutes)
    });
  });
  scored.sort(function (a, b) { return a.score - b.score; });
  return scored.slice(0, topN);
}

/* ---- Decorative helpers (pure, DOM-independent — same testability as above) ---- */

var SPINE_COLORS = ['#d1483a', '#e7ab3f', '#2f8f78', '#3f7ea3', '#8a5cb3', '#c9702c'];

/* Deterministic "game box spine" color per name, so the same game always
   gets the same color across a session (and across re-deals). */
function spineColorForName(name) {
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return SPINE_COLORS[hash % SPINE_COLORS.length];
}

var DICE_LABELS = ['', 'Risky fit', 'Tight fit', 'Decent fit', 'Good fit', 'Great fit', 'Perfect fit'];

/* Builds a tiny CSS-drawn six-sided-die pip face for a 1-6 rating,
   rather than relying on Unicode die-face glyphs (⚀-⚅), which render
   as blank boxes on systems without that symbol block in their font. */
function diePipsMarkup(rating) {
  var pips = '';
  for (var i = 0; i < 9; i++) pips += '<i></i>';
  return '<span class="die-mini die-mini--r' + rating + '">' + pips + '</span>';
}

/* Turns a raw ranking score (lower = better) into a 1–6 "dice rating" for
   a quick, glanceable, game-themed fit indicator. Thresholds are tuned to
   the score scale produced by computePlayerScore/computeTimeScore above. */
function diceRatingForScore(score) {
  if (score <= 0.5) return 6;
  if (score <= 2) return 5;
  if (score <= 5) return 4;
  if (score <= 10) return 3;
  if (score <= 20) return 2;
  return 1;
}

/* ---- DOM wiring ---- */
if (typeof document !== 'undefined') {
  (function () {
    var playerInput = document.getElementById('playerCount');
    var minutesInput = document.getElementById('minutesAvailable');
    var findBtn = document.getElementById('findBtn');
    var results = document.getElementById('results');

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function timeRangeLabel(game) {
      return game.minTime + (game.minTime !== game.maxTime ? '–' + game.maxTime : '') + ' min';
    }

    function caveatText(game) {
      var parts = [];
      if (!game.fitsPlayers) parts.push(game.playerLabel);
      if (!game.fitsTime) parts.push(game.timeLabel);
      return parts.join(' · ');
    }

    function fitMarkup(game, className) {
      var rating = diceRatingForScore(game.score);
      var tightClass = rating <= 2 ? ' is-tight' : '';
      return '<span class="' + className + tightClass + '">' +
        diePipsMarkup(rating) + DICE_LABELS[rating] + '</span>';
    }

    function renderTopCard(game) {
      var spine = spineColorForName(game.name);
      var caveat = (!game.fitsPlayers || !game.fitsTime)
        ? '<p class="reveal-caveat">⚠ ' + escapeHtml(caveatText(game)) + '</p>'
        : '';
      return (
        '<div class="reveal-card" id="revealCard">' +
          '<div class="reveal-card-inner">' +
            '<div class="reveal-face reveal-face--back">' +
              '<div class="reveal-back-mark">🎲</div>' +
              '<div class="reveal-back-text">Shuffling&hellip;</div>' +
            '</div>' +
            '<div class="reveal-face reveal-face--front" style="--spine:' + spine + '">' +
              '<div class="reveal-spine"></div>' +
              '<div class="reveal-body">' +
                '<span class="reveal-pick-tag">Top pick</span>' +
                '<h2 class="reveal-title">' + escapeHtml(game.name) + '</h2>' +
                '<div class="reveal-meta-row">' +
                  '<span class="meta-chip">' + game.minPlayers + '–' + game.maxPlayers + ' players</span>' +
                  '<span class="meta-chip">' + timeRangeLabel(game) + '</span>' +
                  fitMarkup(game, 'dice-rating') +
                '</div>' +
                '<p class="reveal-desc">' + escapeHtml(game.description) + '</p>' +
                caveat +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    function renderMiniCard(game, rank) {
      var spine = spineColorForName(game.name);
      return (
        '<div class="mini-card" style="--spine:' + spine + '">' +
          '<div class="mini-spine"></div>' +
          '<div class="mini-body">' +
            '<h3><span class="mini-rank">' + rank + '.</span>' + escapeHtml(game.name) + '</h3>' +
            '<p class="mini-meta">' + game.minPlayers + '–' + game.maxPlayers + ' players · ' + timeRangeLabel(game) + '</p>' +
            fitMarkup(game, 'mini-fit') +
          '</div>' +
        '</div>'
      );
    }

    function renderResults() {
      var players = Math.max(1, parseInt(playerInput.value, 10) || 1);
      var minutes = Math.max(5, parseInt(minutesInput.value, 10) || 5);
      var matches = rankGames(GAMES, players, minutes, 5);

      if (!matches.length) {
        results.innerHTML = '<p class="empty-note">No games in the list — try different numbers.</p>';
        return;
      }

      var top = matches[0];
      var rest = matches.slice(1);

      var html = '<p class="deck-kicker">Dealt for <strong>' + players + ' players</strong>, <strong>' +
        minutes + ' minutes</strong></p>';
      html += renderTopCard(top);
      if (rest.length) {
        html += '<div class="fan-row">' +
          rest.map(function (game, i) { return renderMiniCard(game, i + 2); }).join('') +
          '</div>';
      }
      results.innerHTML = html;

      // Trigger the flip on the next frame so the card always animates
      // from "back" to "front", even on repeat deals.
      var revealCard = document.getElementById('revealCard');
      if (revealCard) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            revealCard.classList.add('is-revealed');
          });
        });
      }
    }

    function stepValue(input, delta, min, max) {
      var current = parseInt(input.value, 10);
      if (isNaN(current)) current = min;
      var next = Math.min(max, Math.max(min, current + delta));
      input.value = next;
    }

    document.querySelectorAll('.stepper-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('data-target'));
        var delta = parseInt(btn.getAttribute('data-delta'), 10);
        var min = parseInt(target.min, 10) || 1;
        var max = parseInt(target.max, 10) || 999;
        stepValue(target, delta, min, max);
      });
    });

    findBtn.addEventListener('click', renderResults);
    playerInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') renderResults(); });
    minutesInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') renderResults(); });

    renderResults();
  })();
}
