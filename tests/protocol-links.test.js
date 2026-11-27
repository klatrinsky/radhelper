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
  assert.equal($("#study").dataset.src, "content/templates/ct-brain-short.md");
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
  assert.equal($("#study").dataset.src, "content/templates/dxa.md");
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
  assert.equal(app.getAttribute("href"), "pages/fractures.html");
  w.document.execCommand = () => {
    assert.equal($("textarea[readonly]").value, app.href);
    return true;
  };
  $("#study .share-protocol").click();
  assert.equal($("#toast").textContent, "Скопировано");
});

test("сброс очищает текущий вариант, а переходы между вкладками сохраняют данные", async t => {
  const w = await openSite({ query: "?protocol=ct-brain-short" });
  t.after(() => w.close());
  const $ = selector => w.document.querySelector(selector);
  const field = () => $('.tpl input[data-name="Рога"]');
  const notes = () => $(".additional-findings textarea");
  const fill = (horns, findings) => {
    field().value = horns;
    field().dispatchEvent(new w.Event("input", { bubbles: true }));
    notes().value = findings;
  };
  const switchTab = () => $(".tab:not([aria-selected=true])").click();

  fill("23", "Краткий вариант");
  switchTab();
  fill("28", "Подробный вариант");
  switchTab();
  assert.equal(field().value, "23");
  assert.equal(notes().value, "Краткий вариант");

  $(".reset").click();
  assert.equal(field().value, "");
  assert.equal(notes().value, "");
  assert.deepEqual([...w.document.querySelectorAll(".sheet-bar button")].map(button => button.textContent),
    ["Сбросить", "Скопировать протокол"]);
  assert.equal(w.location.search, "?protocol=ct-brain-short");
  switchTab();
  assert.equal(field().value, "28");
  assert.equal(notes().value, "Подробный вариант");
  switchTab();
  assert.equal(field().value, "");
  assert.equal(notes().value, "");
});

test("кнопки маммографии раздельно копируют протокол и заключение", async t => {
  const w = await openSite({ query: "?protocol=mmg-ds" });
  t.after(() => w.close());
  const $ = selector => w.document.querySelector(selector);
  let clipboard;
  w.document.execCommand = command => {
    assert.equal(command, "copy");
    clipboard = $("textarea[readonly]").value;
    return true;
  };

  $(".copy").click();
  assert.match(clipboard, /^Обзорные снимки обеих молочных желёз выполнены в стандартных косых и прямых проекциях\./);
  assert.doesNotMatch(clipboard, /заключение:/i);
  assert.equal(clipboard.match(/BI-RADS 1/g).length, 2);
  assert.match(clipboard, /Рекомендации: контрольная маммография через 12 месяцев\.$/);
  const protocol = clipboard;
  const findings = $(".additional-findings textarea");
  assert.equal(findings.value, "");
  assert.ok(findings.closest("label").nextElementSibling.matches(".tpl-conclusion"));

  findings.value = " \n \t ";
  $(".copy").click();
  assert.equal(clipboard, protocol);
  findings.value = " \nПервая дополнительная находка.\nВторая дополнительная находка. \n";
  $(".copy").click();
  assert.equal(clipboard, protocol.replace(/\n+Рекомендации:/,
    "\n\nПервая дополнительная находка.\nВторая дополнительная находка.\n\nРекомендации:"));

  $(".copy-conclusion").click();
  assert.equal(clipboard, "Левая молочная железа: BI-RADS 1.\nПравая молочная железа: BI-RADS 1.");
});

test("КТ почек: можно вернуться к автоматическому заключению и сохранить ручной текст", async t => {
  for (const [id, normal] of [
    ["ct-kidneys", "Конкременты в почках не выявлены.\nКонкременты в мочеточниках не выявлены.\nЧЛС не расширены.\nМочеточники не расширены."],
    ["ct-kidneys-contrast", "Объёмные образования почек не выявлены.\nЧЛС не расширены.\nМочеточники не расширены."],
  ]) {
    const w = await openSite({ query: "?protocol=" + id });
    t.after(() => w.close());
    const $ = selector => w.document.querySelector(selector);
    const mode = $(".tpl-conclusion select");
    const field = $(".tpl-conclusion input");
    const conclusion = $(".copy-conclusion");
    let clipboard;
    w.document.execCommand = () => {
      clipboard = $("textarea[readonly]").value;
      return true;
    };
    const choose = index => {
      mode.selectedIndex = index;
      mode.dispatchEvent(new w.Event("change", { bubbles: true }));
    };
    assert.equal($("#study").dataset.src, "content/templates/" + id + ".md");
    assert.equal(mode.selectedIndex, 0);
    assert.ok(field.closest(".ln").hidden);
    conclusion.click();
    assert.equal(clipboard, normal);

    const filling = [...w.document.querySelectorAll(".tpl .tg")]
      .find(toggle => toggle.firstElementChild?.textContent.startsWith("удовлетворительно."));
    $(".copy").click();
    assert.match(clipboard, /Мочевой пузырь наполнен удовлетворительно\. Стенка не утолщена, объёмные образования и конкременты не определяются\./);
    filling.click();
    $(".copy").click();
    assert.match(clipboard, /Мочевой пузырь наполнен неудовлетворительно\./);
    assert.doesNotMatch(clipboard, /Мочевой пузырь наполнен неудовлетворительно\. Стенка|Стенка не утолщена, объёмные образования и конкременты/);
    conclusion.click();
    assert.equal(clipboard, normal);
    filling.click();
    $(".copy").click();
    assert.match(clipboard, /Мочевой пузырь наполнен удовлетворительно\. Стенка не утолщена, объёмные образования и конкременты не определяются\./);

    choose(1);
    assert.equal(field.closest(".ln").hidden, false);
    conclusion.click();
    assert.equal(conclusion.textContent, "Всё равно скопировать");
    field.value = "Текст заключения врача.";
    field.dispatchEvent(new w.Event("input", { bubbles: true }));
    conclusion.click();
    assert.equal(clipboard, field.value);

    choose(0);
    conclusion.click();
    assert.equal(clipboard, normal);
    choose(1);
    conclusion.click();
    assert.equal(clipboard, "Текст заключения врача.");
    $(".copy").click();
    assert.match(clipboard, id === "ct-kidneys"
      ? /^Исследование выполнено без внутривенного контрастирования\./
      : /^Применено внутривенное болюсное контрастирование \(нативная, кортикомедуллярная, нефрографическая и экскреторная фазы\)\./);
    assert.doesNotMatch(clipboard, /заключение|вручную/i);

    choose(0);
    const kidneys = [...w.document.querySelectorAll(".tpl .tg")]
      .find(toggle => toggle.firstElementChild?.textContent.startsWith("Почки обычных размеров"));
    kidneys.click();
    conclusion.click();
    assert.equal(clipboard, normal);
    choose(1);
    conclusion.click();
    assert.equal(clipboard, "Текст заключения врача.");
  }
});

test("КТ поясничного отдела синхронизирует угол Кобба в описании и заключении", async t => {
  const w = await openSite({ query: "?protocol=ct-spine-lumbar" });
  t.after(() => w.close());
  const $ = selector => w.document.querySelector(selector);
  const scoliosis = [...w.document.querySelectorAll(".tpl .tg")]
    .find(toggle => toggle.firstElementChild?.textContent.startsWith("Ось позвоночника"));
  let clipboard;
  w.document.execCommand = () => {
    clipboard = $("textarea[readonly]").value;
    return true;
  };
  $(".copy-conclusion").click();
  assert.doesNotMatch(clipboard, /угол Кобба/);

  scoliosis.click();
  const angle = scoliosis.querySelector('input[placeholder="__"]');
  const reflected = [...w.document.querySelectorAll(".tpl-conclusion .tg")]
    .find(toggle => toggle.textContent.includes("угол Кобба")).querySelector("input");
  const fill = value => {
    angle.value = value;
    angle.dispatchEvent(new w.Event("input", { bubbles: true }));
    assert.equal(reflected.value, value);
  };
  for (const value of ["23", "18,5"]) {
    fill(value);
    for (const selector of [".copy", ".copy-conclusion"]) {
      $(selector).click();
      assert.ok(clipboard.includes("угол Кобба " + value + "°"));
    }
  }

  fill("");
  clipboard = undefined;
  $(".copy-conclusion").click();
  assert.equal(clipboard, undefined);
  assert.equal($(".copy-conclusion").textContent, "Всё равно скопировать");
  $(".copy-conclusion").click();
  assert.match(clipboard, /угол Кобба \[__\]°/);
  assert.doesNotMatch(clipboard, /18,5|23°/);
});

test("каждый вариант из каталога имеет уникальный идентификатор ссылки", () => {
  const files = read("content/templates/order.txt").split("\n").map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  const ids = files.map(file => file.replace(/\.md$/i, ""));
  assert.equal(new Set(ids).size, ids.length);
});

test("заголовок новостей открывает архив, условия использования находятся в подвале", async t => {
  const w = await openSite();
  t.after(() => w.close());
  const $ = selector => w.document.querySelector(selector);
  const link = $("#news h2 a");
  assert.equal(link.textContent, "Что нового");
  assert.equal(link.hash, "#newsArchive");
  assert.equal(w.document.querySelectorAll("#news ul").length, 1);
  assert.equal(w.document.querySelectorAll("#news li").length, 7);
  assert.equal($("footer #newsArchiveBtn"), null);
  assert.equal($("footer p:nth-child(2) a").getAttribute("href"), "pages/terms.html");
  assert.match($("footer #lastUpdate").textContent, /^Последнее обновление: \d{2}\.\d{2}\.\d{4}$/);
  assert.match(read("LICENSE"), /CC BY-NC 4\.0/);

  link.click();
  assert.ok($("#newsArchive").open);
  assert.ok(w.document.querySelectorAll("#newsArchiveBody h2").length > 3);
  $(".news-arch-x").click();
  assert.equal($("#newsArchive").open, false);
});

test("КТ височных костей: галерея открывает локальные снимки поверх шаблона", async t => {
  const w = await openSite({ query: "?protocol=ct-temporal" });
  t.after(() => w.close());
  const guide = w.document.querySelector(".tpl .kl-guide");
  const dialog = guide.querySelector("dialog");
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; };
  assert.equal(guide.open, false);
  assert.equal(guide.querySelectorAll(".kl-zoom").length, 3);
  const images = guide.querySelectorAll(".kl-zoom img");
  images.forEach(image => assert.equal(image.hasAttribute("src"), false));
  const opened = new Promise(resolve => guide.addEventListener("toggle", resolve, { once: true }));
  guide.open = true;
  await opened;
  for (const image of images) {
    const src = image.getAttribute("src");
    assert.match(src, /^assets\/img\/temporal\//);
    image.closest("button").click();
    assert.ok(dialog.open);
    assert.equal(dialog.querySelector("img").getAttribute("src"), src);
    dialog.querySelector("button").click();
    assert.equal(dialog.open, false);
  }
  assert.equal(w.location.search, "?protocol=ct-temporal");
});

test("КТ височных костей: описание хирургических ориентиров сохраняет нормальное заключение", async t => {
  const w = await openSite({ query: "?protocol=ct-temporal" });
  t.after(() => w.close());
  const $ = selector => w.document.querySelector(selector);
  const toggles = [...w.document.querySelectorAll("#study .tpl .tg")];
  const find = prefix => toggles.find(toggle => toggle.firstElementChild?.textContent.startsWith(prefix));
  let clipboard;
  w.document.execCommand = () => {
    clipboard = $("textarea[readonly]").value;
    return true;
  };
  const copyConclusion = $(".copy-conclusion");
  const normal = "МСКТ-признаков патологических изменений височных костей не выявлено.";
  copyConclusion.click();
  assert.equal(clipboard, normal);
  for (const side of ["справа", "слева"]) {
    const landmarks = find("+ хирургические ориентиры " + side);
    landmarks.click();
    landmarks.querySelector("input").value = "без особенностей";
  }
  $(".copy").click();
  assert.equal((clipboard.match(/Канал лицевого нерва и сосудистые ориентиры: без особенностей/g) || []).length, 2);
  copyConclusion.click();
  assert.equal(clipboard, normal);
  find("Наружный слуховой проход свободен").click();
  copyConclusion.click();
  assert.equal(clipboard, "");
});
