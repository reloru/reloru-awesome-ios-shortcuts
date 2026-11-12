// ==UserScript==
// @name         Desktop Layout
// @namespace    https://github.com/reloru/reloru-awesome-ios-shortcuts
// @version      1.0.0
// @description  One tap switches a site to a real desktop page width (1024, 1280, or 1440) and remembers it. For the Userscripts extension on iPhone and iPad.
// @author       reloru
// @match        *://*/*
// @noframes
// @run-at       document-start
// @inject-into  content
// @weight       999
// @grant        GM.getValue
// @grant        GM.setValue
// @homepageURL  https://github.com/reloru/reloru-awesome-ios-shortcuts
// @updateURL    https://raw.githubusercontent.com/reloru/reloru-awesome-ios-shortcuts/main/userscripts/desktop-layout.meta.js
// @downloadURL  https://raw.githubusercontent.com/reloru/reloru-awesome-ios-shortcuts/main/userscripts/desktop-layout.user.js
// ==/UserScript==

(function () {
  "use strict";

  if (window.__reloruDesktopLayout) return;
  window.__reloruDesktopLayout = 1;

  var WIDTHS = [1024, 1280, 1440];
  var HOST = String(location.hostname || "");
  var LS_KEY = "reloru.desktopLayout.v1";
  var INTENT_KEY = "reloru.desktopLayout.intent";
  var RELOAD_KEY = "reloru.desktopLayout.reload";
  var GM_PREFS = "pcview.prefs";
  var GM_SITES = "pcview.sites";
  var DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

  var prefs = { width: 1280, corner: "br" };
  var sites = {};
  var hostOn = false;
  var ready = false;
  var spoofedFor = 0;
  var viewportObserver = null;
  var ui = null;

  function validWidth(value) {
    var n = Number(value);
    return WIDTHS.indexOf(n) >= 0 ? n : 1280;
  }

  function validCorner(value) {
    return value === "tl" || value === "tr" || value === "bl" || value === "br" ? value : "br";
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return {
        on: !!data.on,
        width: validWidth(data.width),
        corner: validCorner(data.corner)
      };
    } catch (err) {
      return null;
    }
  }

  function writeCache(state) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        on: !!state.on,
        width: validWidth(state.width),
        corner: validCorner(state.corner)
      }));
    } catch (err) {}
  }

  function markIntent(on) {
    try {
      sessionStorage.setItem(INTENT_KEY, JSON.stringify({
        on: !!on,
        width: prefs.width,
        corner: prefs.corner,
        t: Date.now()
      }));
    } catch (err) {}
  }

  function readIntent() {
    try {
      var raw = sessionStorage.getItem(INTENT_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      if (Date.now() - Number(data.t || 0) > 15000) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function clearIntent() {
    try { sessionStorage.removeItem(INTENT_KEY); } catch (err) {}
  }

  function reloadOnce() {
    try {
      var prev = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - prev < 4000) return false;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch (err) {}
    location.reload();
    return true;
  }

  function gmGet(key, fallback) {
    if (typeof GM === "undefined" || !GM || typeof GM.getValue !== "function") {
      return Promise.resolve(fallback);
    }
    return GM.getValue(key, fallback).then(function (value) {
      return value === undefined ? fallback : value;
    }).catch(function () {
      return fallback;
    });
  }

  function gmSet(key, value) {
    if (typeof GM === "undefined" || !GM || typeof GM.setValue !== "function") {
      return Promise.resolve(false);
    }
    return GM.setValue(key, value).then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  function cleanSites(input) {
    var out = {};
    if (!input || typeof input !== "object" || Array.isArray(input)) return out;
    Object.keys(input).forEach(function (key) {
      if (!input[key]) return;
      if (typeof key !== "string" || key.length < 1 || key.length > 253) return;
      if (!/^[a-z0-9.-]+$/i.test(key)) return;
      out[key] = true;
    });
    return out;
  }

  function viewportMetas() {
    var found = [];
    var metas = document.getElementsByTagName("meta");
    var i;
    for (i = 0; i < metas.length; i++) {
      if (String(metas[i].getAttribute("name") || "").toLowerCase() === "viewport") found.push(metas[i]);
    }
    return found;
  }

  function ensureViewport(width) {
    var desired = "width=" + validWidth(width);
    var parent = document.head || document.documentElement;
    if (!parent) return;
    var metas = viewportMetas();
    if (!metas.length) {
      var created = document.createElement("meta");
      created.setAttribute("name", "viewport");
      created.setAttribute("content", desired);
      parent.insertBefore(created, parent.firstChild);
      return;
    }
    metas.forEach(function (meta) {
      if (meta.getAttribute("content") !== desired) meta.setAttribute("content", desired);
      if (document.head && meta.parentNode !== document.head) document.head.insertBefore(meta, document.head.firstChild);
    });
  }

  function watchViewport(width) {
    if (viewportObserver) viewportObserver.disconnect();
    if (typeof MutationObserver !== "function") {
      ensureViewport(width);
      return;
    }
    var headWatched = null;
    var scheduled = false;
    function apply() {
      if (!hostOn) return;
      ensureViewport(width);
      var head = document.head;
      if (head && head !== headWatched && viewportObserver) {
        headWatched = head;
        viewportObserver.observe(head, {
          childList: true,
          attributes: true,
          attributeFilter: ["content", "name"]
        });
      }
    }
    viewportObserver = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () {
        scheduled = false;
        apply();
      });
    });
    var root = document.documentElement;
    if (root) viewportObserver.observe(root, { childList: true });
    apply();
  }

  function stopViewport() {
    if (viewportObserver) {
      viewportObserver.disconnect();
      viewportObserver = null;
    }
  }

  function installPageSpoof(width) {
    var w = validWidth(width);
    if (spoofedFor === w) return;
    spoofedFor = w;
    var code = "(function(){try{if(window.__reloruDesktopSpoof)return;window.__reloruDesktopSpoof=1;var W=" + w + ";var UA=" + JSON.stringify(DESKTOP_UA) + ";function def(obj,prop,getter){try{var desc=Object.getOwnPropertyDescriptor(obj,prop);if(desc&&desc.configurable===false)return;Object.defineProperty(obj,prop,{configurable:true,get:getter});}catch(err){}}def(Navigator.prototype,'userAgent',function(){return UA;});def(Navigator.prototype,'appVersion',function(){return UA.replace(/^Mozilla\\//,'');});def(Navigator.prototype,'platform',function(){return 'MacIntel';});def(Navigator.prototype,'vendor',function(){return 'Apple Computer, Inc.';});def(Navigator.prototype,'maxTouchPoints',function(){return 0;});def(Screen.prototype,'width',function(){return W;});def(Screen.prototype,'availWidth',function(){return W;});def(Screen.prototype,'height',function(){return 900;});def(Screen.prototype,'availHeight',function(){return 860;});}catch(err){}})();";
    try {
      var holder = document.createElement("div");
      holder.setAttribute("data-reloru", "desktop-spoof");
      holder.style.display = "none";
      var shadow = holder.attachShadow({ mode: "closed" });
      var tag = document.createElement("script");
      tag.textContent = code;
      shadow.appendChild(tag);
      (document.documentElement || document.head || document.body).appendChild(holder);
    } catch (err) {}
  }

  function applyDesktop(on, width) {
    hostOn = !!on;
    if (hostOn) {
      watchViewport(width);
      installPageSpoof(width);
    } else {
      stopViewport();
    }
    if (ui) render();
  }

  function metrics() {
    var vv = window.visualViewport;
    var screenW = Math.min(window.screen.width || 0, window.screen.height || 0) || 390;
    var layoutW = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || screenW;
    var vvW = vv ? vv.width : layoutW;
    var vvH = vv ? vv.height : (window.innerHeight || screenW);
    var basis = Math.max(layoutW, vvW);
    var unit = basis > screenW * 1.25 ? basis / screenW : 1;
    return {
      unit: unit,
      left: vv ? vv.offsetLeft : 0,
      top: vv ? vv.offsetTop : 0,
      width: vvW,
      height: vvH,
      gap: Math.round(12 * unit),
      main: Math.round(48 * unit),
      mini: Math.round(34 * unit)
    };
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function siteNames() {
    return Object.keys(sites).sort(function (a, b) {
      if (a === HOST) return -1;
      if (b === HOST) return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }

  function cssText() {
    return [
      ":host { color-scheme: light dark; }",
      "* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }",
      "button { font-family: -apple-system, BlinkMacSystemFont, sans-serif; touch-action: manipulation; }",
      ".main, .mini { position: fixed; margin: 0; padding: 0; border-radius: 999px; font-weight: 700; letter-spacing: 0.01em; pointer-events: auto; }",
      ".main { color: #111113; background: rgba(255,255,255,0.94); border: 1px solid rgba(0,0,0,0.16); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }",
      ".main.on { color: #fff; background: #0a84ff; border-color: transparent; }",
      ".mini { color: #111113; background: rgba(255,255,255,0.94); border: 1px solid rgba(0,0,0,0.16); box-shadow: 0 6px 16px rgba(0,0,0,0.18); }",
      ".main:active, .mini:active { transform: scale(0.96); }",
      ".scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.28); pointer-events: auto; }",
      ".panel { position: fixed; display: none; overflow: auto; -webkit-overflow-scrolling: touch; pointer-events: auto; color: #111113; background: rgba(255,255,255,0.96); border: 1px solid rgba(0,0,0,0.12); border-radius: 18px; box-shadow: 0 16px 48px rgba(0,0,0,0.28); padding: 0.9em 1em 1em; }",
      ".panel.open { display: block; }",
      "h2 { margin: 0; font-size: 1.05em; line-height: 1.2; }",
      ".host { margin: 0.2em 0 0; color: #6e6e73; font-size: 0.78em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".label { margin: 0.95em 0 0.35em; color: #6e6e73; font-size: 0.72em; font-weight: 600; }",
      ".seg { display: flex; gap: 2px; padding: 2px; border-radius: 12px; background: rgba(120,120,128,0.16); }",
      ".seg button { flex: 1; min-height: 2.35em; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; font-weight: 600; }",
      ".seg button.on { background: #0a84ff; color: #fff; }",
      ".corners { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }",
      ".corners button { min-height: 2.2em; border-radius: 10px; border: 1px solid rgba(0,0,0,0.12); background: transparent; color: inherit; font: inherit; font-weight: 600; }",
      ".corners button.on { background: #0a84ff; color: #fff; border-color: transparent; }",
      ".sites { margin: 0; padding: 0; list-style: none; }",
      ".sites li { display: flex; align-items: center; gap: 0.6em; min-height: 2.4em; border-top: 1px solid rgba(0,0,0,0.08); }",
      ".sites li span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".sites li.here span { font-weight: 700; }",
      ".sites button { border: 0; background: transparent; color: #ff3b30; font: inherit; font-weight: 600; padding: 0.35em 0; }",
      ".empty { margin: 0.2em 0 0; color: #6e6e73; font-size: 0.86em; }",
      ".note { margin: 0.95em 0 0; color: #6e6e73; font-size: 0.75em; line-height: 1.35; }",
      "@media (prefers-color-scheme: dark) {",
      "  .main, .mini { color: #f2f2f7; background: rgba(44,44,46,0.94); border-color: rgba(255,255,255,0.14); }",
      "  .main.on { color: #fff; background: #0a84ff; border-color: transparent; }",
      "  .panel { color: #f2f2f7; background: rgba(28,28,30,0.96); border-color: rgba(255,255,255,0.12); }",
      "  .host, .label, .empty, .note { color: #aeaeb2; }",
      "  .corners button { border-color: rgba(255,255,255,0.14); }",
      "  .sites li { border-top-color: rgba(255,255,255,0.1); }",
      "}"
    ].join("\n");
  }

  function buildUI() {
    var host = document.createElement("div");
    host.setAttribute("data-reloru", "desktop-layout");
    host.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483646;pointer-events:none;";
    var shadow = host.attachShadow({ mode: "closed" });
    var style = document.createElement("style");
    style.textContent = cssText();
    var mainBtn = el("button", "main", "PC");
    mainBtn.type = "button";
    mainBtn.setAttribute("aria-label", "Toggle desktop layout");
    var miniBtn = el("button", "mini", "\u2026");
    miniBtn.type = "button";
    miniBtn.setAttribute("aria-label", "Desktop layout settings");
    var scrim = el("div", "scrim");
    scrim.hidden = true;
    var panel = el("div", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Desktop layout settings");
    var title = el("h2", "", "Desktop layout");
    var hostLine = el("p", "host", HOST || "This page");
    var modeLabel = el("div", "label", "This site");
    var modeSeg = el("div", "seg");
    var mobileBtn = el("button", "", "Mobile");
    var desktopBtn = el("button", "", "Desktop");
    mobileBtn.type = "button";
    desktopBtn.type = "button";
    modeSeg.appendChild(mobileBtn);
    modeSeg.appendChild(desktopBtn);
    var widthLabel = el("div", "label", "Page width");
    var widthSeg = el("div", "seg");
    var widthBtns = {};
    WIDTHS.forEach(function (width) {
      var button = el("button", "", String(width));
      button.type = "button";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        setWidth(width);
      });
      widthBtns[width] = button;
      widthSeg.appendChild(button);
    });
    var cornerLabel = el("div", "label", "Button corner");
    var corners = el("div", "corners");
    var cornerBtns = {};
    [["tl", "Top left"], ["tr", "Top right"], ["bl", "Bottom left"], ["br", "Bottom right"]].forEach(function (item) {
      var button = el("button", "", item[1]);
      button.type = "button";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        setCorner(item[0]);
      });
      cornerBtns[item[0]] = button;
      corners.appendChild(button);
    });
    var savedLabel = el("div", "label", "Remembered sites");
    var list = el("ul", "sites");
    var empty = el("p", "empty", "None yet. Tap PC and this site is remembered.");
    var note = el("p", "note", "Request Desktop Website only changes the User-Agent. This changes the page width, which is what responsive sites use. If a site still serves a separate mobile page, turn that Safari switch on too, then tap PC.");
    panel.appendChild(title);
    panel.appendChild(hostLine);
    panel.appendChild(modeLabel);
    panel.appendChild(modeSeg);
    panel.appendChild(widthLabel);
    panel.appendChild(widthSeg);
    panel.appendChild(cornerLabel);
    panel.appendChild(corners);
    panel.appendChild(savedLabel);
    panel.appendChild(list);
    panel.appendChild(empty);
    panel.appendChild(note);
    shadow.appendChild(style);
    shadow.appendChild(scrim);
    shadow.appendChild(panel);
    shadow.appendChild(mainBtn);
    shadow.appendChild(miniBtn);

    function stop(event) { event.stopPropagation(); }
    [mainBtn, miniBtn, panel].forEach(function (node) {
      node.addEventListener("pointerdown", stop);
      node.addEventListener("touchstart", stop, { passive: true });
      node.addEventListener("click", stop);
    });

    mainBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (!ready) return;
      setHost(!hostOn);
    });
    miniBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (!ready) return;
      setPanelOpen(!panel.classList.contains("open"));
    });
    scrim.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setPanelOpen(false);
    });
    mobileBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (hostOn) setHost(false);
    });
    desktopBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!hostOn) setHost(true);
    });

    ui = {
      host: host,
      mainBtn: mainBtn,
      miniBtn: miniBtn,
      scrim: scrim,
      panel: panel,
      mobileBtn: mobileBtn,
      desktopBtn: desktopBtn,
      widthBtns: widthBtns,
      cornerBtns: cornerBtns,
      list: list,
      empty: empty
    };

    function mount() {
      var parent = document.documentElement;
      if (parent && ui.host.parentNode !== parent) parent.appendChild(ui.host);
      layout();
    }
    ui.mount = mount;
    mount();
    document.addEventListener("DOMContentLoaded", mount);
    window.addEventListener("pageshow", function () {
      if (hostOn) ensureViewport(prefs.width);
      layout();
    });
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", layout);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", layout);
      window.visualViewport.addEventListener("scroll", layout);
    }
    render();
  }

  function setPanelOpen(open) {
    if (!ui) return;
    ui.panel.classList.toggle("open", !!open);
    ui.scrim.hidden = !open;
    if (open) layout();
  }

  function layout() {
    if (!ui) return;
    var m = metrics();
    var stackGap = Math.round(m.main * 0.16);
    var groupW = m.main;
    var groupH = m.main + stackGap + m.mini;
    var x = m.left + m.gap;
    var y = m.top + m.gap;
    if (prefs.corner === "tr" || prefs.corner === "br") x = m.left + m.width - m.gap - groupW;
    if (prefs.corner === "bl" || prefs.corner === "br") y = m.top + m.height - m.gap - groupH;
    var minX = m.left + 4;
    var minY = m.top + 4;
    var maxX = m.left + m.width - groupW - 4;
    var maxY = m.top + m.height - groupH - 4;
    if (x < minX) x = minX;
    if (y < minY) y = minY;
    if (x > maxX) x = Math.max(minX, maxX);
    if (y > maxY) y = Math.max(minY, maxY);

    ui.mainBtn.style.width = m.main + "px";
    ui.mainBtn.style.height = m.main + "px";
    ui.mainBtn.style.left = Math.round(x) + "px";
    ui.mainBtn.style.top = Math.round(y) + "px";
    ui.mainBtn.style.fontSize = Math.round(m.main * 0.32) + "px";
    ui.miniBtn.style.width = m.mini + "px";
    ui.miniBtn.style.height = m.mini + "px";
    ui.miniBtn.style.left = Math.round(x + (m.main - m.mini) / 2) + "px";
    ui.miniBtn.style.top = Math.round(y + m.main + stackGap) + "px";
    ui.miniBtn.style.fontSize = Math.round(m.mini * 0.46) + "px";

    var panelW = Math.min(Math.max(0, m.width - m.gap * 2), Math.round(300 * m.unit));
    ui.panel.style.width = panelW + "px";
    ui.panel.style.fontSize = Math.max(13, Math.round(15 * m.unit)) + "px";
    ui.panel.style.maxHeight = Math.max(120, m.height - m.gap * 2) + "px";
    if (!ui.panel.classList.contains("open")) return;
    var panelLeft = (prefs.corner === "tl" || prefs.corner === "bl") ? x : x + groupW - panelW;
    if (panelLeft < m.left + 4) panelLeft = m.left + 4;
    if (panelLeft + panelW > m.left + m.width - 4) panelLeft = Math.max(m.left + 4, m.left + m.width - 4 - panelW);
    ui.panel.style.left = Math.round(panelLeft) + "px";
    var below = y + groupH + m.gap;
    var openUp = prefs.corner === "bl" || prefs.corner === "br";
    ui.panel.style.top = Math.round(openUp ? y : below) + "px";
    var ph = ui.panel.offsetHeight || 0;
    var panelTop = openUp ? y - m.gap - ph : below;
    var limit = m.top + m.height - m.gap;
    if (panelTop + ph > limit) panelTop = limit - ph;
    if (panelTop < m.top + 4) panelTop = m.top + 4;
    ui.panel.style.top = Math.round(panelTop) + "px";
  }

  function render() {
    if (!ui) return;
    ui.mainBtn.classList.toggle("on", hostOn);
    ui.mainBtn.setAttribute("aria-pressed", hostOn ? "true" : "false");
    ui.mainBtn.setAttribute("aria-label", hostOn ? "Desktop layout on. Switch to mobile." : "Desktop layout off. Switch to desktop.");
    ui.mobileBtn.classList.toggle("on", !hostOn);
    ui.desktopBtn.classList.toggle("on", hostOn);
    WIDTHS.forEach(function (width) {
      ui.widthBtns[width].classList.toggle("on", width === prefs.width);
    });
    ["tl", "tr", "bl", "br"].forEach(function (corner) {
      ui.cornerBtns[corner].classList.toggle("on", corner === prefs.corner);
    });
    clearNode(ui.list);
    var names = siteNames();
    ui.empty.hidden = names.length > 0;
    ui.list.hidden = names.length === 0;
    names.forEach(function (name) {
      var item = el("li", name === HOST ? "here" : "");
      item.appendChild(el("span", "", name));
      var remove = el("button", "", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", "Forget " + name);
      remove.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        forget(name);
      });
      item.appendChild(remove);
      ui.list.appendChild(item);
    });
    layout();
  }

  function persistAndReload(on) {
    hostOn = !!on;
    if (HOST) {
      if (hostOn) sites[HOST] = true;
      else delete sites[HOST];
    }
    markIntent(hostOn);
    writeCache({ on: hostOn, width: prefs.width, corner: prefs.corner });
    return Promise.all([
      gmSet(GM_PREFS, { width: prefs.width, corner: prefs.corner }),
      gmSet(GM_SITES, sites)
    ]).then(function () {
      reloadOnce();
    });
  }

  function setHost(on) {
    if (!ready || !HOST) return;
    setPanelOpen(false);
    persistAndReload(on);
  }

  function setWidth(width) {
    if (!ready) return;
    prefs.width = validWidth(width);
    render();
    if (hostOn) persistAndReload(true);
    else {
      markIntent(false);
      writeCache({ on: false, width: prefs.width, corner: prefs.corner });
      gmSet(GM_PREFS, { width: prefs.width, corner: prefs.corner });
    }
  }

  function setCorner(corner) {
    if (!ready) return;
    prefs.corner = validCorner(corner);
    markIntent(hostOn);
    writeCache({ on: hostOn, width: prefs.width, corner: prefs.corner });
    gmSet(GM_PREFS, { width: prefs.width, corner: prefs.corner });
    render();
  }

  function forget(name) {
    if (!ready) return;
    delete sites[name];
    gmSet(GM_SITES, sites);
    if (name === HOST) persistAndReload(false);
    else render();
  }

  function bootEarly() {
    var cache = readCache();
    if (!cache) return;
    prefs.width = cache.width;
    prefs.corner = cache.corner;
    if (cache.on) applyDesktop(true, cache.width);
  }

  function reconcile(wantOn) {
    var cache = readCache();
    var earlyOn = !!(cache && cache.on);
    var earlyWidth = cache ? cache.width : prefs.width;
    if (wantOn || cache) writeCache({ on: !!wantOn, width: prefs.width, corner: prefs.corner });
    var mismatch = earlyOn !== !!wantOn || (!!wantOn && earlyWidth !== prefs.width);
    if (!mismatch) {
      hostOn = !!wantOn;
      if (hostOn) applyDesktop(true, prefs.width);
      render();
      return;
    }
    if (reloadOnce()) return;
    applyDesktop(!!wantOn, prefs.width);
    render();
  }

  function start() {
    bootEarly();
    try { buildUI(); } catch (err) {}
    var intent = readIntent();
    if (intent) {
      prefs.width = validWidth(intent.width || prefs.width);
      prefs.corner = validCorner(intent.corner || prefs.corner);
    }
    Promise.all([
      gmGet(GM_PREFS, null),
      gmGet(GM_SITES, {})
    ]).then(function (results) {
      var storedPrefs = results[0];
      sites = cleanSites(results[1]);
      if (storedPrefs && typeof storedPrefs === "object" && !Array.isArray(storedPrefs)) {
        prefs.width = validWidth(storedPrefs.width);
        prefs.corner = validCorner(storedPrefs.corner || prefs.corner);
      }
      if (intent) {
        prefs.width = validWidth(intent.width || prefs.width);
        prefs.corner = validCorner(intent.corner || prefs.corner);
        if (HOST) {
          if (intent.on) sites[HOST] = true;
          else delete sites[HOST];
        }
        clearIntent();
        return Promise.all([
          gmSet(GM_PREFS, { width: prefs.width, corner: prefs.corner }),
          gmSet(GM_SITES, sites)
        ]);
      }
    }).then(function () {
      ready = true;
      reconcile(!!(HOST && sites[HOST]));
    }).catch(function () {
      ready = true;
      var cache = readCache();
      hostOn = !!(cache && cache.on);
      render();
    });
  }

  start();
})();
