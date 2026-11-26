const test = require("node:test");
const assert = require("node:assert/strict");
const { openSite } = require("./env");

async function protocol(t, id) {
  const w = await openSite({query: "?protocol=xr-" + id});
  t.after(() => w.close());
  const form = w.document.querySelector(".tpl");
  function copy(selector = "button.copy") {
    let result;
    w.document.execCommand = () => {
      result = w.document.querySelector("textarea[readonly]").value;
      return true;
    };
    const button = w.document.querySelector(selector);
    button.click();
    if (!result) button.click();
    assert.deepEqual(w.__errors, []);
    return result;
  }
  function input(field, value) {
    field.value = value;
    field.dispatchEvent(new w.Event("input", {bubbles: true}));
  }
  return {form, copy, copyConclusion: () => copy("button.copy-conclusion"), input};
}

test("стопа: сочетаемые операции и их параметры попадают в копию только при выборе", async t => {
  const {form, copy, copyConclusion, input} = await protocol(t, "foot-postop");
  input(form.querySelector('input[placeholder="дд.мм.гггг"]'), "11.11.2026");
  const choices = form.querySelectorAll(".ctl .ms-chip");
  choices[1].click();
  choices[2].click();
  const description = copy();
  assert.match(description, /Scarf-остеотомия I плюсневой кости, фиксация двумя винтами/);
  assert.match(description, /по Akin, без винтовой фиксации/);
  assert.match(description, /лучей: II\./);
  assert.match(copyConclusion(), /\(Scarf-остеотомия, остеотомия по Akin, подголовчатая остеотомия\) от 11.11.2026/);
  choices[1].click();
  choices[2].click();
  assert.doesNotMatch(copy(), /Akin|подголовчат|лучей|\?Вмешательства/);
  assert.doesNotMatch(copyConclusion(), /Akin|подголовчат|лучей|\?Вмешательства/);
});

test("рентгеноскопия желудка копирует описание и заключение для каждого типа ГПОД", async t => {
  const {form, copy, copyConclusion, input} = await protocol(t, "stomach");
  const select = form.querySelector('select[aria-label="гпод"]');
  const w = select.ownerDocument.defaultView;
  const cases = [
    [/грыжевого выпячивания .* не выявлено/i, /признаков грыжи .* не выявлено/i],
    [/переход смещён выше пищеводного отверстия/i, /Скользящая грыжа .*\(тип I\)/],
    [/Дно желудка смещено .* рядом с пищеводом\. Пищеводно-желудочный переход сохраняет обычное положение\./, /Параэзофагеальная грыжа .*\(тип II\)/],
    [/переход и дно желудка смещены выше/i, /Смешанная грыжа .*\(тип III\)/],
    [/в грудную полость смещены часть желудка и поперечная ободочная кишка/i, /Грыжа .* перемещением желудка и дополнительного органа \(тип IV\)/],
  ];
  assert.equal(select.selectedIndex, 0);
  assert.equal(select.options.length, cases.length);
  cases.forEach(([description, conclusion], i) => {
    select.selectedIndex = i;
    select.dispatchEvent(new w.Event("change", {bubbles: true}));
    const organ = [...form.querySelectorAll('input[placeholder="__"]')].find(field => !field.closest("[hidden]"));
    if (i === 4) input(organ, "поперечная ободочная кишка");
    else assert.equal(organ, undefined);
    const report = copy();
    assert.match(report, description);
    assert.match(copyConclusion(), conclusion);
    assert.doesNotMatch(report, /заключение:|Тип грыжи пищеводного отверстия|\[__\]/i);
  });
  const hints = w.document.querySelector(".study-hints");
  assert.equal(hints.open, false);
  assert.match(hints.querySelector('a[href*="sages.org"]').textContent, /SAGES/);
});

test("угол Кобба передаётся из описания в заключение", async t => {
  const {form, copy, copyConclusion, input} = await protocol(t, "spine-thoracic");
  const toggle = [...form.querySelectorAll(".tg")].find(e => e.textContent.startsWith("Ось позвоночника"));
  toggle.click();
  input(toggle.querySelectorAll("input")[1], "23");
  assert.match(copy(), /угол Кобба 23°/);
  assert.match(copyConclusion(), /угол Кобба 23°/);
});

test("Meyerding: границы степеней и сброс результата при очистке", async t => {
  const {form, copyConclusion, input} = await protocol(t, "spine-lumbar");
  const field = form.querySelector('[data-name="Смещение"]');
  field.closest(".tg").click();
  for (const [value, grade] of [["25","I"], ["25,1","II"], ["50","II"], ["75","III"], ["100","IV"], ["101","V"]]) {
    input(field, value);
    assert.ok(copyConclusion().includes(", " + grade + " степень по Meyerding"));
  }
  input(field, "");
  assert.doesNotMatch(copyConclusion(), /V степень по Meyerding/);
});

test("второй перелом в кратком шаблоне скрывается при возврате к норме", async t => {
  const {form, copy, copyConclusion} = await protocol(t, "spine-thoracic-short");
  const first = form.querySelector(".tg");
  first.click();
  const second = [...form.querySelectorAll(".opt-empty")].find(e => e.textContent === "+ ещё один перелом");
  second.click();
  assert.match(copy(), /Th11/);
  assert.match(copyConclusion(), /Th11/);
  first.click();
  assert.doesNotMatch(copy(), /Th11|Th12|\?перелом/);
  assert.doesNotMatch(copyConclusion(), /Th11|Th12|\?перелом/);
});
