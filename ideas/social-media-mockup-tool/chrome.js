/*
 * Mockup Studio — chrome interactions (bespoke, additive).
 *
 * This file only decorates the surrounding UI: it moves the segmented
 * control's sliding pill, tints the stage's ambient glow per platform,
 * runs the caption character counter, and previews the uploaded image
 * inside the dropzone. It never touches mockup rendering (name/caption/
 * image propagation into the frames, or which frame is .active) — that
 * logic stays in app.js untouched.
 */
(function () {
  "use strict";
  if (typeof document === "undefined") return;

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Sliding pill indicator for the platform switch ---- */
  var switchEl = document.querySelector("[data-switch]");
  var pill = document.querySelector("[data-switch-pill]");
  var switchButtons = document.querySelectorAll(".switch-btn");
  var stage = document.querySelector("[data-stage]");

  function movePill(btn) {
    if (!pill || !switchEl || !btn) return;
    var switchRect = switchEl.getBoundingClientRect();
    var btnRect = btn.getBoundingClientRect();
    pill.style.width = btnRect.width + "px";
    pill.style.transform = "translateX(" + (btnRect.left - switchRect.left) + "px)";
  }

  function activeSwitchButton() {
    return document.querySelector(".switch-btn.active") || switchButtons[0];
  }

  switchButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      movePill(btn);
      if (stage) stage.setAttribute("data-active-platform", btn.getAttribute("data-platform"));
    });
  });

  window.addEventListener("resize", function () {
    movePill(activeSwitchButton());
  });

  // Position the pill once the switch has real layout dimensions.
  if (switchButtons.length) {
    requestAnimationFrame(function () {
      movePill(activeSwitchButton());
    });
  }

  /* ---- Live caption character counter ---- */
  var caption = document.getElementById("caption");
  var charCount = document.querySelector("[data-char-count]");

  function updateCharCount() {
    if (!caption || !charCount) return;
    var max = parseInt(caption.getAttribute("maxlength"), 10) || 0;
    var len = caption.value.length;
    charCount.textContent = len + " / " + max;
    charCount.classList.toggle("is-near-limit", max > 0 && len >= max * 0.9);
  }

  if (caption) {
    caption.addEventListener("input", updateCharCount);
    updateCharCount();
  }

  /* ---- Dropzone thumbnail preview ---- */
  var imageInput = document.getElementById("image-input");
  var dropzone = document.querySelector("[data-dropzone]");
  var dropzonePreview = document.querySelector("[data-dropzone-preview]");

  if (imageInput && dropzone && dropzonePreview) {
    imageInput.addEventListener("change", function () {
      var file = imageInput.files && imageInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        dropzonePreview.src = reader.result;
        dropzonePreview.hidden = false;
        dropzone.classList.add("has-image");
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---- Subtle hover tilt on the active mockup frame (bespoke, no
     dependency on any shared design-system script) ---- */
  if (!reduceMotion) {
    document.querySelectorAll(".mockup-frame").forEach(function (frame) {
      var rectCache = null;
      frame.addEventListener("pointerenter", function () {
        rectCache = frame.getBoundingClientRect();
      });
      frame.addEventListener("pointermove", function (e) {
        if (!rectCache) rectCache = frame.getBoundingClientRect();
        var px = (e.clientX - rectCache.left) / rectCache.width;
        var py = (e.clientY - rectCache.top) / rectCache.height;
        var rotX = (0.5 - py) * 4;
        var rotY = (px - 0.5) * 4;
        frame.style.transform =
          "translateY(-4px) rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg)";
      });
      frame.addEventListener("pointerleave", function () {
        rectCache = null;
        frame.style.transform = "";
      });
    });
  }
})();
