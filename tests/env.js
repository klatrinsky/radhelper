/* Поднимает сайт целиком в jsdom: index.html + скрипты + fetch читают файлы с диска.
   Ничего в сети не трогает. Используется всеми тестами. */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");
const BASE = "https://radhelper.test/";

const fromUrl = url => path.join(ROOT, decodeURIComponent(new URL(url, BASE).pathname));

// <script src="x.js"> — подставляем содержимое файла прямо в страницу (картинки и стили не нужны)
const inlineScripts = html => html.replace(/<script src="([^"]+)"><\/script>/g,
  (_, src) => "<script>" + fs.readFileSync(fromUrl(src), "utf8").replace(/<\/script/gi, "<\\/script") + "</script>");

// Минимальный fetch: только то, что использует сайт (r.ok, r.status, r.text()).
function diskFetch(url) {
  const file = fromUrl(String(url));
  if (!fs.existsSync(file)) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
  const text = fs.readFileSync(file, "utf8");
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
}

/* lab: true — вход лаборанта (/?lab). Возвращает window, когда всё прочитано и отрисовано. */
async function openSite({ lab = false, query = "" } = {}) {
  const url = new URL(BASE + query);
  if (lab) url.searchParams.set("lab", "");
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e.message));
  vc.on("error", e => errors.push(String(e)));
  const dom = new JSDOM(inlineScripts(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")), {
    url: url.href,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = diskFetch;
      w.scrollTo = () => {};
      w.print = () => {};
      w.HTMLElement.prototype.scrollIntoView = () => {};
      if (!w.CSS) w.CSS = {};
      if (!w.CSS.escape) w.CSS.escape = s => String(s).replace(/["\\]/g, "\\$&");
    },
  });
  const w = dom.window;
  // сайт дочитывает файлы асинхронно — ждём, пока разделы появятся и всё успокоится
  for (let i = 0; i < 100 && !w.document.querySelector("details.sec"); i++) await new Promise(r => setTimeout(r, 20));
  await new Promise(r => setTimeout(r, 200));
  w.__errors = errors;
  return w;
}

/* Виджет отдельно, без всего сайта: пустая страница + assets/js/widgets.js */
function widget(name) {
  const dom = new JSDOM("<!doctype html><div id=w></div>", { runScripts: "outside-only", url: BASE });
  dom.window.eval(fs.readFileSync(path.join(ROOT, "assets/js/widgets.js"), "utf8"));
  const el = dom.window.document.getElementById("w");
  dom.window.RH_WIDGETS[name](el);
  const $ = s => el.querySelector(s);
  return {
    el, $,
    click(sel) { $(sel).dispatchEvent(new dom.window.Event("click", { bubbles: true })); },
    type(sel, value) {
      const i = $(sel); i.value = value;
      i.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    },
    select(sel, value) {
      const s = $(sel); s.value = value;
      s.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    },
    check(sel, on = true) {
      const c = $(sel); c.checked = on;
      c.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    },
    text: sel => ($(sel) ? $(sel).textContent.replace(/\s+/g, " ").trim() : ""),
  };
}

const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const list = dir => fs.readdirSync(path.join(ROOT, dir));

module.exports = { openSite, widget, read, list, ROOT };
