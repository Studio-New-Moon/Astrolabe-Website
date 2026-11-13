// Google Analytics, only with permission.
//
// Each page's <head> sets up dataLayer and gtag() but does NOT load Google's
// tag. This file loads it only once the visitor has tapped Allow, and asks with
// a small bar at the foot of the page until they have answered either way.
// The answer lives in localStorage on this device and nowhere else.
//
// Cloudflare's visit counter is separate, sets no cookies, and is not gated.
// Pages whose URLs carry a private code (/account/unlock/, /order/thank-you/)
// and the internal /studio/ never include this file.
//
// The privacy policy has a button (#analytics-choice) to change the answer;
// see "Counting visits" in /privacy/.
(function () {
  "use strict";
  var KEY = "astrolabe-analytics";
  var TAG = "GTM-N5783V5G";

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* private window: ask again next page */ }
  }

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + TAG;
    document.head.appendChild(s);
  }

  // Turning it off: stop loading it, and clear the cookies it set on this site.
  function forget() {
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name === "_ga" || name.indexOf("_ga_") === 0) {
        var host = location.hostname;
        var parts = host.split(".");
        var domains = ["", host];
        for (var i = 1; i < parts.length - 1; i++) domains.push("." + parts.slice(i).join("."));
        domains.forEach(function (d) {
          document.cookie = name + "=; Max-Age=0; path=/" + (d ? "; domain=" + d : "");
        });
      }
    });
  }

  var STYLE =
    "#ga-consent{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;" +
    "padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));" +
    "background:#221a10;border-top:1px solid rgba(200,153,63,.3);color:#ede0c4;" +
    "font:15px/1.45 Spectral,Georgia,'Times New Roman',serif;box-shadow:0 -6px 24px rgba(0,0,0,.45)}" +
    "#ga-consent .in{max-width:760px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between}" +
    "#ga-consent p{margin:0;flex:1 1 320px}" +
    "#ga-consent a{color:#d9b56a}" +
    "#ga-consent .b{display:flex;gap:10px;flex:0 0 auto}" +
    "#ga-consent button{font:inherit;font-weight:600;padding:8px 18px;border-radius:8px;cursor:pointer;" +
    "border:1px solid rgba(200,153,63,.55);background:transparent;color:#ede0c4}" +
    "#ga-consent button.yes{background:#d4af5e;border-color:#d4af5e;color:#17110a}";

  function ask() {
    if (document.getElementById("ga-consent")) return;
    var st = document.createElement("style");
    st.textContent = STYLE;
    document.head.appendChild(st);
    var bar = document.createElement("div");
    bar.id = "ga-consent";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Analytics choice");
    bar.innerHTML =
      '<div class="in"><p>May we use Google Analytics to see how this site is used? It sets cookies. ' +
      'It never sees your birth details. <a href="/privacy/#visits">More in the privacy policy</a>.</p>' +
      '<div class="b"><button type="button" class="no">No thanks</button>' +
      '<button type="button" class="yes">Allow</button></div></div>';
    bar.querySelector(".yes").addEventListener("click", function () {
      write("granted"); bar.remove(); load(); sync();
    });
    bar.querySelector(".no").addEventListener("click", function () {
      write("denied"); bar.remove(); sync();
    });
    document.body.appendChild(bar);
  }

  // The privacy policy's own control, if this page has one.
  function sync() {
    var el = document.getElementById("analytics-choice");
    if (!el) return;
    var on = read() === "granted";
    el.textContent = on ? "Turn off Google Analytics" : "Allow Google Analytics";
    var note = document.getElementById("analytics-state");
    if (note) note.textContent = on
      ? "Google Analytics is on for this browser."
      : read() === "denied" ? "Google Analytics is off for this browser." : "You haven't chosen yet.";
  }

  // The installed web app opens on its welcome screen (html.welcoming, see
  // app/index.html) with everything behind it inert until ENTER. Asked then,
  // the bar showed for a moment on iPhone and vanished behind the welcome
  // screen once its canvases painted, and was untappable even where it showed.
  // So the question waits for ENTER, which removes the class.
  function askWhenWelcomed() {
    var root = document.documentElement;
    if (!root.classList.contains("welcoming")) { ask(); return; }
    var watch = new MutationObserver(function () {
      if (root.classList.contains("welcoming")) return;
      watch.disconnect();
      ask();
    });
    watch.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  function start() {
    var choice = read();
    if (choice === "granted") load();
    else if (choice !== "denied") askWhenWelcomed();

    var el = document.getElementById("analytics-choice");
    if (el) {
      el.addEventListener("click", function () {
        if (read() === "granted") {
          write("denied");
          forget();
          // gtm.js can't be unloaded from a running page; reloading drops it.
          location.reload();
        } else {
          write("granted");
          var bar = document.getElementById("ga-consent");
          if (bar) bar.remove();
          load();
          sync();
        }
      });
      sync();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
