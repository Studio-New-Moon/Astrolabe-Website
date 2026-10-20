// Every button's label sits on one line.
//
// Labels are held to one line in CSS (white-space: nowrap; see app.css), and
// a label that is still too long for the room its button has is lettered a
// little smaller until it fits, never below MIN. Wrapping a label onto a
// second line is what this replaces: it made the metal buttons lopsided on a
// mobile browser, and Spectral's capitals run wide.
//
// Runs on load, once the fonts are in, on resize, and on any button the page
// draws later (the web app renders most of its own).

(function () {
  "use strict";
  var SELECTOR = ".metal-button, .quiet-button, .welcome .enter, .ig-actions .ig-go, .controls .play";
  var MIN = 12;

  // The panel a button sits in: its right edge is the room the label has,
  // even where a flex or grid row would otherwise stretch to the label.
  var PANEL = ".plate, .button-plate, .sheet-body, .install, .ig-sheet, .welcome-stack, form, section, main, header, nav";
  // A framed button counts its frame: the holder is what has to fit.
  function outer(button) {
    return button.closest(".framed-button") || button;
  }
  function roomRight(button) {
    var box = outer(button);
    var panel = box.parentElement && box.parentElement.closest(PANEL);
    if (!panel) return Infinity;
    var box = panel.getBoundingClientRect();
    return box.right - (parseFloat(getComputedStyle(panel).paddingRight) || 0);
  }
  function tooLong(button, edge) {
    return button.scrollWidth > button.clientWidth + 1 || outer(button).getBoundingClientRect().right > edge + 0.5;
  }

  function fit(button) {
    if (!button.isConnected || button.offsetWidth === 0) return;
    button.style.fontSize = "";
    var size = parseFloat(getComputedStyle(button).fontSize);
    var edge = roomRight(button);
    var guard = 0;
    while (tooLong(button, edge) && size > MIN && guard++ < 24) {
      size = Math.max(MIN, size - 0.5);
      button.style.fontSize = size + "px";
    }
  }

  function fitAll(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(fit);
  }

  var queued = false;
  function soon() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; fitAll(); });
  }

  function start() {
    fitAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
    window.addEventListener("resize", soon);
    window.addEventListener("astrolabe:framed", soon);
    // Buttons drawn later, or shown when a sheet or a hidden section opens.
    new MutationObserver(soon).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "open", "class"],
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
