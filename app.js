/* UltraLauncher for iPhone: a home-screen web app.
   Everything is kept on this device (localStorage). The TV watchlist is shared online
   through the same Supabase functions the Android app and UltraLauncher TV use. */
"use strict";

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

const SUPABASE_URL = "https://mrznthrdsniymrngjuhr.supabase.co";
const SUPABASE_KEY = "sb_publishable_015JL4GRq5nMDyEoxiTBjA_pBCZsOwn"; // publishable: safe to ship, the list needs your link code

const FONTS = {
  Outfit: "Outfit:wght@200;300;400;500;600;700",
  Inter: "Inter:wght@200;300;400;500;600;700",
  Quicksand: "Quicksand:wght@300;400;500;600;700",
  Comfortaa: "Comfortaa:wght@300;400;500;600;700",
  "Space Grotesk": "Space+Grotesk:wght@300;400;500;600;700",
  Nunito: "Nunito:wght@200;300;400;600;700;800",
};
const ACCENTS = ["#E8620A", "#E5484D", "#4F8EF7", "#2BB673", "#D4A72C", "#A06CF0"];
const CLOCKS = { classic: "Classic", stack: "Stack", line: "Line", dots: "Dots" };

const DEFAULT_SHORTCUTS = [
  { name: "Phone", url: "tel:" },
  { name: "Messages", url: "sms:" },
  { name: "WhatsApp", url: "whatsapp://" },
  { name: "Maps", url: "maps://" },
  { name: "YouTube", url: "youtube://" },
  { name: "Spotify", url: "spotify:" },
  { name: "Netflix", url: "nflx://" },
  { name: "Mail", url: "mailto:" },
];
const PRESETS = [
  ...DEFAULT_SHORTCUTS,
  { name: "Gmail", url: "googlegmail://" },
  { name: "Google Maps", url: "comgooglemaps://" },
  { name: "Instagram", url: "instagram://" },
  { name: "X", url: "twitter://" },
  { name: "Prime Video", url: "aiv://" },
  { name: "BBC iPlayer", url: "https://www.bbc.co.uk/iplayer" },
];

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("ul." + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("ul." + key, JSON.stringify(value)); } catch (e) { toast("Couldn't save: storage is full"); }
  },
};

const S = {
  name: store.get("name", ""),
  clock: store.get("clock", "classic"),
  font: store.get("font", "Outfit"),
  accent: store.get("accent", ACCENTS[0]),
  dim: store.get("dim", 35),
  place: store.get("place", null), // { lat, lon, name }
  code: store.get("code", ""),
  shortcuts: store.get("shortcuts", DEFAULT_SHORTCUTS),
};
function save(key, value) { S[key] = value; store.set(key, value); }

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
};
function toast(text) { $("#watch-status").textContent = text; }

// ---------------------------------------------------------------------------------------------
// Look: font, accent, wallpaper
// ---------------------------------------------------------------------------------------------

function applyLook() {
  const family = FONTS[S.font] ? S.font : "Outfit";
  const extra = S.clock === "dots" ? "&family=Doto:wght@800" : "";
  $("#font-link").href = `https://fonts.googleapis.com/css2?family=${FONTS[family]}${extra}&display=swap`;
  document.documentElement.style.setProperty("--font", `"${family}", system-ui, -apple-system, sans-serif`);
  document.documentElement.style.setProperty("--accent", S.accent);
  document.documentElement.style.setProperty("--dim", String(S.dim / 100));
  const wall = localStorage.getItem("ul.wallpaper");
  $("#wall").style.backgroundImage = wall ? `url(${wall})` : "";
  $("#wall").classList.toggle("photo", !!wall);
}

/** Shrinks a chosen photo so it fits in storage (about 1300 px tall, JPEG). */
function setWallpaper(file) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    try { localStorage.setItem("ul.wallpaper", c.toDataURL("image/jpeg", 0.82)); } catch { alert("That photo is too big to keep. Try a smaller one."); }
    URL.revokeObjectURL(img.src);
    applyLook();
  };
  img.src = URL.createObjectURL(file);
}

// ---------------------------------------------------------------------------------------------
// Clock, date, greeting
// ---------------------------------------------------------------------------------------------

function two(n) { return String(n).padStart(2, "0"); }

function renderClock() {
  const now = new Date();
  const h = now.getHours();
  const m = two(now.getMinutes());
  const clock = $("#clock");
  clock.className = "clock " + S.clock;
  if (S.clock === "stack") clock.innerHTML = `<span class="h">${two(h)}</span><span class="m">${m}</span>`;
  else if (S.clock === "line") clock.innerHTML = `<span class="h">${h % 12 || 12}</span><span class="m">${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}</span>`;
  else if (S.clock === "dots") clock.innerHTML = `<span class="t">${two(h)}<b>:</b>${m}</span>`;
  else clock.innerHTML = `<span class="t">${two(h)}:${m}</span>`;
  clock.setAttribute("aria-label", `${two(h)}:${m}`);

  $("#date").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const part = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  $("#greeting").textContent = S.name ? `${part}, ${S.name}` : part;
}

// Tap the clock seven times…
let clockTaps = 0, clockTimer = 0;
$("#clock").addEventListener("click", () => {
  clockTaps++;
  clearTimeout(clockTimer);
  clockTimer = setTimeout(() => (clockTaps = 0), 1500);
  if (clockTaps >= 7) { clockTaps = 0; $("#credits").showModal(); }
});

// ---------------------------------------------------------------------------------------------
// Weather (Open-Meteo, no key needed)
// ---------------------------------------------------------------------------------------------

const WMO = (code) => {
  if (code === 0) return ["☀", "Clear"];
  if (code <= 2) return ["⛅", "Partly cloudy"];
  if (code === 3) return ["☁", "Cloudy"];
  if (code <= 48) return ["🌫", "Fog"];
  if (code <= 57) return ["🌦", "Drizzle"];
  if (code <= 67) return ["🌧", "Rain"];
  if (code <= 77) return ["❄", "Snow"];
  if (code <= 82) return ["🌧", "Showers"];
  if (code <= 86) return ["❄", "Snow showers"];
  return ["⛈", "Thunderstorm"];
};
let weatherData = null;

async function loadWeather() {
  if (!S.place) return;
  const cached = store.get("weather", null);
  if (cached && Date.now() - cached.at < 20 * 60 * 1000 && cached.lat === S.place.lat) { weatherData = cached; renderWeather(); return; }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${S.place.lat}&longitude=${S.place.lon}` +
      "&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability" +
      "&daily=temperature_2m_max,temperature_2m_min&forecast_hours=12&forecast_days=1&timezone=auto";
    const r = await fetch(url);
    const j = await r.json();
    weatherData = { at: Date.now(), lat: S.place.lat, j };
    store.set("weather", weatherData);
    renderWeather();
  } catch { $("#w-desc").textContent = "Weather unavailable right now"; }
}

function renderWeather() {
  if (!weatherData) return;
  const j = weatherData.j;
  const [icon, desc] = WMO(j.current.weather_code);
  $("#w-icon").textContent = icon;
  $("#w-temp").textContent = Math.round(j.current.temperature_2m) + "°";
  $("#w-desc").textContent = `${desc}${S.place.name ? " · " + S.place.name : ""}`;
  $("#w-hilo").textContent = `${Math.round(j.daily.temperature_2m_max[0])}° / ${Math.round(j.daily.temperature_2m_min[0])}°`;
  const hours = $("#w-hours");
  hours.replaceChildren();
  for (let i = 1; i <= 10 && i < j.hourly.time.length; i += 2) {
    const t = new Date(j.hourly.time[i]);
    hours.append(el("div", {}, String(t.getHours()).padStart(2, "0"), el("span", { "aria-hidden": "true" }, WMO(j.hourly.weather_code[i])[0]), el("b", {}, Math.round(j.hourly.temperature_2m[i]) + "°")));
  }
  // Smart line: rain coming?
  const rainAt = j.hourly.precipitation_probability.findIndex((p, i) => i > 0 && i < 6 && p >= 60);
  const line = $("#smartline");
  if (rainAt > 0) {
    const t = new Date(j.hourly.time[rainAt]);
    line.textContent = `Rain likely around ${t.getHours()}:00`;
    line.hidden = false;
  } else line.hidden = true;
}

$("#weather").addEventListener("click", () => {
  if (!S.place) { askLocation(); return; }
  location.href = "https://www.google.com/search?q=" + encodeURIComponent("weather " + (S.place.name || ""));
});

function askLocation() {
  if (!navigator.geolocation) { $("#place-status").textContent = "Location isn't available; type a town instead."; return; }
  $("#w-desc").textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = +pos.coords.latitude.toFixed(3), lon = +pos.coords.longitude.toFixed(3);
    let name = "";
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      const j = await r.json();
      name = j.city || j.locality || "";
    } catch {}
    save("place", { lat, lon, name });
    $("#place-status").textContent = name ? `Using ${name}` : "Using your location";
    store.set("weather", null);
    loadWeather();
  }, () => {
    $("#w-desc").textContent = "Location was declined. Set a town in Settings.";
    $("#place-status").textContent = "Location was declined. Type a town instead.";
  }, { timeout: 10000 });
}

async function findCity(q) {
  if (q.trim().length < 2) return;
  $("#place-status").textContent = "Looking…";
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(q.trim())}`);
    const j = await r.json();
    const hit = j.results && j.results[0];
    if (!hit) { $("#place-status").textContent = "Couldn't find that town."; return; }
    save("place", { lat: hit.latitude, lon: hit.longitude, name: hit.name });
    $("#place-status").textContent = `Using ${hit.name}${hit.admin1 ? ", " + hit.admin1 : ""}`;
    store.set("weather", null);
    loadWeather();
  } catch { $("#place-status").textContent = "No connection."; }
}

// ---------------------------------------------------------------------------------------------
// Shortcuts
// ---------------------------------------------------------------------------------------------

/** "shortcut: Name" runs a Siri Shortcut; anything else is a link or app address. */
function hrefFor(url) {
  const m = /^shortcut:\s*(.+)$/i.exec(url.trim());
  return m ? "shortcuts://run-shortcut?name=" + encodeURIComponent(m[1]) : url.trim();
}

function shortcutTile(sc, index, editable) {
  const initials = sc.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const node = el("a", { class: "sc", href: hrefFor(sc.url), "aria-label": sc.name },
    el("span", { class: "ic", "aria-hidden": "true" }, initials),
    el("span", { class: "nm" }, sc.name));
  if (editable) {
    node.append(el("button", {
      class: "x", "aria-label": "Remove " + sc.name,
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); save("shortcuts", S.shortcuts.filter((_, i) => i !== index)); renderShortcuts(); },
    }, "×"));
    node.addEventListener("click", (e) => { if ($("#tab-shortcuts").classList.contains("editing")) e.preventDefault(); });
  }
  return node;
}

function renderShortcuts() {
  $("#home-shortcuts").replaceChildren(...S.shortcuts.slice(0, 8).map((sc, i) => shortcutTile(sc, i, false)));
  $("#all-shortcuts").replaceChildren(...S.shortcuts.map((sc, i) => shortcutTile(sc, i, true)));
  $("#presets").replaceChildren(...PRESETS.filter((p) => !S.shortcuts.some((s) => s.url === p.url)).map((p) =>
    el("button", { class: "chip", type: "button", onclick: () => { save("shortcuts", [...S.shortcuts, p]); renderShortcuts(); } }, "+ " + p.name)));
}

$("#edit-shortcuts").addEventListener("click", () => {
  const tab = $("#tab-shortcuts");
  const on = !tab.classList.contains("editing");
  tab.classList.toggle("editing", on);
  $("#add-shortcuts").hidden = !on;
  $("#edit-shortcuts").textContent = on ? "Done" : "Edit";
});

$("#custom-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#sc-name").value.trim();
  let url = $("#sc-url").value.trim();
  if (!name || !url) return;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = "https://" + url;
  save("shortcuts", [...S.shortcuts, { name, url }]);
  $("#sc-name").value = ""; $("#sc-url").value = "";
  renderShortcuts();
});

// ---------------------------------------------------------------------------------------------
// TV watchlist (shared with the Android app and UltraLauncher TV)
// ---------------------------------------------------------------------------------------------

function cleanCode(typed) { return typed.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function prettyCode(code) { return code.match(/.{1,4}/g)?.join("-") ?? ""; }

async function rpc(name, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

function appFor(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("netflix.com")) return "Netflix";
  if (u.includes("primevideo.com") || (u.includes("amazon.") && u.includes("/video")) || u.includes("amzn.")) return "Prime Video";
  if (u.includes("disneyplus.com")) return "Disney+";
  if (u.includes("bbc.co.uk/iplayer")) return "BBC iPlayer";
  if (u.includes("itv.com")) return "ITVX";
  if (u.includes("channel4.com")) return "Channel 4";
  if (u.includes("hotstar.com")) return "JioHotstar";
  if (u.includes("tv.apple.com")) return "Apple TV";
  if (u.includes("nowtv.com")) return "NOW";
  if (u.includes("spotify.com")) return "Spotify";
  return null;
}

/** A readable title for a link: the page's own title where a public service can give it. */
async function titleFor(url) {
  try {
    const r = await fetch("https://noembed.com/embed?url=" + encodeURIComponent(url));
    const j = await r.json();
    if (j.title) return { title: j.title, image: j.thumbnail_url || "" };
  } catch {}
  try {
    const u = new URL(url);
    const slug = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
    return { title: decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), image: "" };
  } catch { return { title: url, image: "" }; }
}

let watchItems = [];

async function loadWatchlist() {
  const linked = !!S.code;
  $("#watch-link").hidden = linked;
  $("#watch-form").hidden = !linked;
  if (!linked) { watchItems = []; renderWatch(); return; }
  $("#watch-status").textContent = "";
  try {
    watchItems = (await rpc("tv_watchlist_list", { p_key: S.code })) || [];
    if (!watchItems.length) $("#watch-status").textContent = "Nothing saved yet. Paste a link or type a title.";
  } catch (e) {
    $("#watch-status").textContent = "Couldn't reach the watchlist (" + e.message + ").";
  }
  renderWatch();
}

function watchRow(item, removable) {
  const app = item.app || appFor(item.url) || "";
  const badge = el("span", { class: "badge", "aria-hidden": "true" }, (app || item.title || "?").slice(0, 2).toUpperCase());
  const text = el("span", { class: "tx" }, el("div", { class: "tt" }, item.title), el("div", { class: "ap" }, app || (item.url ? new URL(item.url).hostname : "To watch")));
  const row = item.url ? el("a", { class: "item", href: item.url }, badge, text) : el("div", { class: "item" }, badge, text);
  if (removable) {
    row.append(el("button", {
      class: "remove", "aria-label": "Remove " + item.title,
      onclick: async (e) => {
        e.preventDefault();
        try { await rpc("tv_watchlist_remove", { p_key: S.code, p_id: item.id }); } catch { toast("Couldn't remove it. Try again."); }
        loadWatchlist();
      },
    }, "×"));
  }
  return row;
}

function renderWatch() {
  $("#watch-list").replaceChildren(...watchItems.map((it) => watchRow(it, true)));
  const peek = watchItems.slice(0, 3);
  $("#home-watch").replaceChildren(...(peek.length ? peek.map((it) => watchRow(it, false))
    : [el("div", { class: "item" }, el("span", { class: "tx muted" }, S.code ? "Nothing saved yet" : "Link your TV watchlist on the Watchlist tab"))]));
}

$("#watch-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const typed = $("#watch-input").value.trim();
  if (!typed) return;
  const isLink = /^https?:\/\//i.test(typed) || /^[\w-]+\.[a-z]{2,}\//i.test(typed);
  const url = isLink ? (/^https?:/i.test(typed) ? typed : "https://" + typed) : "";
  $("#watch-status").textContent = "Adding…";
  const meta = url ? await titleFor(url) : { title: typed, image: "" };
  try {
    await rpc("tv_watchlist_add", { p_key: S.code, p_title: meta.title, p_url: url, p_app: appFor(url) || "", p_image: meta.image });
    $("#watch-input").value = "";
    $("#watch-status").textContent = `Added “${meta.title}”`;
  } catch (err) { $("#watch-status").textContent = "Couldn't add it (" + err.message + ")."; }
  loadWatchlist();
});

function useCode(typed) {
  const code = cleanCode(typed);
  if (code.length < 10 || code.length > 32) { alert("That code doesn't look right. It's 10 letters and numbers, like ABCD-EFGH-JK."); return false; }
  save("code", code);
  $("#set-code").value = prettyCode(code);
  loadWatchlist();
  return true;
}
$("#code-form").addEventListener("submit", (e) => { e.preventDefault(); useCode($("#code-input").value); });

// ---------------------------------------------------------------------------------------------
// Tabs and settings
// ---------------------------------------------------------------------------------------------

function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  window.scrollTo({ top: 0 });
  if (name === "watch") loadWatchlist();
}
document.querySelectorAll(".tabbar button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.goto)));

function chips(container, options, current, onPick) {
  container.replaceChildren(...Object.entries(options).map(([value, label]) =>
    el("button", { type: "button", class: "chip" + (value === current ? " on" : ""), onclick: () => onPick(value) }, label)));
}

function renderSettings() {
  $("#set-name").value = S.name;
  $("#set-dim").value = S.dim;
  $("#set-code").value = prettyCode(S.code);
  chips($("#set-clock"), CLOCKS, S.clock, (v) => { save("clock", v); applyLook(); renderClock(); renderSettings(); });
  chips($("#set-font"), Object.fromEntries(Object.keys(FONTS).map((f) => [f, f])), S.font, (v) => { save("font", v); applyLook(); renderSettings(); });
  $("#set-accent").replaceChildren(...ACCENTS.map((c) => el("button", {
    type: "button", class: "swatch" + (c === S.accent ? " on" : ""), style: `background:${c}`, "aria-label": "Accent " + c,
    onclick: () => { save("accent", c); applyLook(); renderSettings(); },
  })));
  if (S.place) $("#place-status").textContent = `Using ${S.place.name || "your location"}`;
}

$("#open-settings").addEventListener("click", () => { renderSettings(); $("#settings").showModal(); });
$("#set-name").addEventListener("input", (e) => { save("name", e.target.value.trim()); renderClock(); });
$("#set-dim").addEventListener("input", (e) => { save("dim", +e.target.value); applyLook(); });
$("#set-wall").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) setWallpaper(f); });
$("#clear-wall").addEventListener("click", () => { localStorage.removeItem("ul.wallpaper"); applyLook(); });
$("#use-location").addEventListener("click", askLocation);
$("#set-city").addEventListener("change", (e) => findCity(e.target.value));
$("#save-code").addEventListener("click", () => useCode($("#set-code").value));
let versionTaps = 0;
$("#version").addEventListener("click", () => { if (++versionTaps >= 7) { versionTaps = 0; $("#credits").showModal(); } });

// ---------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------

applyLook();
renderClock();
renderShortcuts();
renderWatch();
loadWeather();
loadWatchlist();
setInterval(renderClock, 1000 * 10);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { renderClock(); loadWeather(); if (S.code) loadWatchlist(); }
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
