const test = require("node:test");
const assert = require("node:assert/strict");
const { openSite, read } = require("./env");

function search(w, text) {
  const q = w.document.getElementById("q");
  q.value = text;
  q.dispatchEvent(new w.Event("input"));
}

test("прямая ссылка выбирает вкладку, а кнопка копирует адрес активного варианта", async t => {
  const w = await openSite({ query: "?protocol=ct-brain-short" });
  t.after(() => w.close());
  const $ = selector => w.document.querySelector(selector);
  assert.deepEqual(w.__errors, []);
  assert.equal($("#study").dataset.src, "templates/ct-brain-short.md");
  assert.equal($(".tab[aria-selected=true]").textContent, "Кратко");
  assert.ok($(".hints details"));

  let clipboard;
  w.document.execCommand = command => {
    assert.equal(command, "copy");
    clipboard = $("textarea[readonly]").value;
    return true;
  };
  $(".share-protocol").click();
  assert.equal(clipboard, "https://radhelper.test/?protocol=ct-brain-short");
  $(".tab:not([aria-selected=true])").click();
  $(".share-protocol").click();
  assert.equal(clipboard, "https://radhelper.test/?protocol=ct-brain");
  assert.equal(w.location.search, "?protocol=ct-brain");

  search(w, "денситометрия");
  assert.equal(w.location.search, "");
  assert.equal($("#study").dataset.src, "templates/dxa.md");
  $("#homeBtn").click();
  assert.equal($("#study").hidden, true);
  assert.ok(w.document.body.classList.contains("home"));
});

test("неизвестная ссылка оставляет доступ к поиску и каталогу переломов", async t => {
  const w = await openSite({ query: "?protocol=unknown" });
  t.after(() => w.close());
  const $ = selector => w.document.querySelector(selector);
  assert.match($("#study [role=status]").textContent, /не найден/);
  search(w, "переломы");
  const app = $("#study .app-entry a");
  assert.equal(app.getAttribute("href"), "fractures.html");
  w.document.execCommand = () => {
    assert.equal($("textarea[readonly]").value, app.href);
    return true;
  };
  $("#study .share-protocol").click();
  assert.equal($("#toast").textContent, "Скопировано");
});

test("каждый вариант из каталога имеет уникальный идентификатор ссылки", () => {
  const files = read("templates/order.txt").split("\n").map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  const ids = files.map(file => file.replace(/\.md$/i, ""));
  assert.equal(new Set(ids).size, ids.length);
});
