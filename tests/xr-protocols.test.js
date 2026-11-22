const test = require("node:test");
const assert = require("node:assert/strict");
const { openSite } = require("./env");

async function protocol(t, id) {
  const w = await openSite({query: "?protocol=xr-" + id});
  t.after(() => w.close());
  const form = w.document.querySelector(".tpl");
  function copy() {
    let result;
    w.document.execCommand = () => {
      result = w.document.querySelector("textarea[readonly]").value;
      return true;
    };
    const button = w.document.querySelector("button.copy");
    button.click();
    if (!result) button.click();
    assert.deepEqual(w.__errors, []);
    return result;
  }
  function input(field, value) {
    field.value = value;
    field.dispatchEvent(new w.Event("input", {bubbles: true}));
  }
  return {form, copy, input};
}

test("стопа: сочетаемые операции и их параметры попадают в копию только при выборе", async t => {
  const {form, copy, input} = await protocol(t, "foot-postop");
  input(form.querySelector('input[placeholder="дд.мм.гггг"]'), "11.11.2026");
  const choices = form.querySelectorAll(".ctl .ms-chip");
  choices[1].click();
  choices[2].click();
  const all = copy();
  assert.match(all, /Scarf-остеотомия I плюсневой кости, фиксация двумя винтами/);
  assert.match(all, /по Akin, без винтовой фиксации/);
  assert.match(all, /лучей: II\./);
  assert.match(all, /\(Scarf-остеотомия, остеотомия по Akin, подголовчатая остеотомия\) от 11.11.2026/);
  choices[1].click();
  choices[2].click();
  assert.doesNotMatch(copy(), /Akin|подголовчат|лучей|\?Вмешательства/);
});

test("угол Кобба передаётся из описания в заключение", async t => {
  const {form, copy, input} = await protocol(t, "spine-thoracic");
  const toggle = [...form.querySelectorAll(".tg")].find(e => e.textContent.startsWith("Ось позвоночника"));
  toggle.click();
  input(toggle.querySelectorAll("input")[1], "23");
  assert.equal(copy().match(/угол Кобба 23°/g)?.length, 2);
});

test("Meyerding: границы степеней и сброс результата при очистке", async t => {
  const {form, copy, input} = await protocol(t, "spine-lumbar");
  const field = form.querySelector('[data-name="Смещение"]');
  field.closest(".tg").click();
  for (const [value, grade] of [["25","I"], ["25,1","II"], ["50","II"], ["75","III"], ["100","IV"], ["101","V"]]) {
    input(field, value);
    assert.ok(copy().includes(", " + grade + " степень по Meyerding"));
  }
  input(field, "");
  assert.doesNotMatch(copy(), /V степень по Meyerding/);
});

test("второй перелом в кратком шаблоне скрывается при возврате к норме", async t => {
  const {form, copy} = await protocol(t, "spine-thoracic-short");
  const first = form.querySelector(".tg");
  first.click();
  const second = [...form.querySelectorAll(".opt-empty")].find(e => e.textContent === "+ ещё один перелом");
  second.click();
  assert.equal(copy().match(/Th11/g)?.length, 2);
  first.click();
  assert.doesNotMatch(copy(), /Th11|Th12|\?перелом/);
});
