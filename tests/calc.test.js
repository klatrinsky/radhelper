/* Калькуляторы шаблонов (CALC в index.html): формулы, пороги переключателей, и сквозная проверка —
   ввёл поля в шаблон → какой текст уйдёт в заключение. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { openSite, read } = require("./env");

let W, C;
test.before(async () => { W = await openSite(); C = W.RH_CALC; });

const f = (name, ...a) => C[name].f(...a);
const pick = (name, x) => C[name].pick(x);

test("стеноз ВСА: NASCET и ECST", () => {
  assert.equal(Math.round(f("NASCET П", 1.5, 5)), 70);             // (1 − 1,5/5) × 100
  assert.equal(Math.round(f("ECST Л", 1.5, 7.5)), 80);
  assert.equal(f("NASCET", 5, 5), 0);
});

test("стеноз ВСА: градация < 50 / 50–69 / ≥ 70", () => {
  for (const [x, i] of [[49, 0], [50, 1], [69, 1], [70, 2], [99, 2]]) assert.equal(pick("NASCET П", x), i, String(x));
});

test("объём эллипсоида, КТИ, индекс Эванса", () => {
  assert.ok(Math.abs(f("ОБЪЁМ", 10, 20, 30) - 3.138) < 1e-9);       // 0,523 × 6000 мм³ → мл
  assert.equal(f("КТИ", 15, 30), 50);
  assert.equal(f("ЭВАНС", 30, 100), 0.3);
  assert.equal(pick("ЭВАНС", 0.3), 0);                               // > 0,3 — расширены, 0,30 — ещё норма
  assert.equal(pick("ЭВАНС", 0.31), 1);
});

test("L1 HU ≤ 110 — остеопороз; ADI > 2 мм — расширен", () => {
  assert.equal(pick("L1 HU", 110), 1);
  assert.equal(pick("L1 HU", 111), 0);
  assert.equal(pick("ADI", 2), 0);
  assert.equal(pick("ADI", 2.1), 1);
});

test("площадь канала (Schönström): > 100 норма, 75–100 относительный, < 75 абсолютный", () => {
  for (const [x, i] of [[101, 0], [100, 1], [75, 1], [74, 2]]) assert.equal(pick("S L4–L5", x), i, String(x));
});

test("компрессионный перелом: снижение высоты и Genant", () => {
  const g = (h, H) => C["GENANT 1"].text(h, H);
  assert.equal(Math.round(f("ВЫСОТА 1", 16, 20)), 20);              // без округления 19,999… — поэтому сайт сравнивает округлённое
  assert.equal(g(16.2, 20), "0");                                    // 19%
  assert.equal(g(16, 20), "1");                                      // 20%
  assert.equal(g(15, 20), "1");                                      // 25%
  assert.equal(g(14.9, 20), "2");                                    // 25,5 → 26%
  assert.equal(g(12, 20), "2");                                      // 40%
  assert.equal(g(11.8, 20), "3");                                    // 41%
  assert.equal(g(21, 20), "");                                       // снижённая выше должной — не считаем
  assert.equal(pick("ВЫСОТА 1", 19), 1);                             // < 20% — «нельзя исключить грыжу Шморля»
  assert.equal(pick("ВЫСОТА 1", 20), 0);
});

test("КТ-перфузия: отношения и словесная картина, порог ± 10%", () => {
  // [CBF П, CBV П, MTT П, CBF Л, CBV Л, MTT Л]
  const v = [39, 4, 7.7, 50, 4, 6];
  assert.equal(C["СМА КАРТИНА П/Л"].text(...v), "снижение CBF (0,78), удлинение MTT (1,28) без значимого изменения CBV");
  assert.equal(C["СМА КАРТИНА П/Л"].text(45, 4, 6, 50, 4, 6), "");  // 0,90 — ещё в норме
  assert.match(C["СМА КАРТИНА П/Л"].text(44.5, 4, 6, 50, 4, 6), /снижение CBF \(0,89\)/);
  assert.equal(C["СМА ВЫВОД"].set(v, () => 0)["СМА"], 2);
  assert.equal(C["СМА ВЫВОД"].set([50, 4, 6, 50, 4, 6], () => 0)["СМА"], 1);
  assert.equal(C["СМА ВЫВОД"].set([NaN, 4, 6, 50, 4, 6], () => 0)["СМА"], 0);
});

/* ---------- Денситометрия ---------- */
const D = C_ => C_["ДЕНСИТОМЕТРИЯ"];
// поля по именам → массив в порядке inputs; переключатели по именам → функция tg
function dxa(fields, toggles = {}) {
  const def = D(C);
  const v = def.inputs.map(n => (n in fields ? fields[n] : NaN));
  const tg = n => (n in toggles ? toggles[n] : 0);
  return { set: def.set(v, tg), crit: C["КРИТЕРИЙ"].text(v, tg), dyn: C["ДИНАМИКА"].text(v, tg) };
}
const WOMAN_POST = { "пол": 0, "менопауза": 0 }, WOMAN_PRE = { "пол": 0, "менопауза": 1 }, MAN = { "пол": 1 };

test("DXA: критерий — T у женщин в менопаузе и мужчин ≥ 50, иначе Z", () => {
  assert.equal(dxa({ "Возраст": 45 }, WOMAN_POST).crit, "T-критерий");
  assert.equal(dxa({ "Возраст": 55 }, WOMAN_PRE).crit, "Z-критерий");
  assert.equal(dxa({ "Возраст": 50 }, MAN).crit, "T-критерий");
  assert.equal(dxa({ "Возраст": 49 }, MAN).crit, "Z-критерий");
  assert.equal(dxa({}, MAN).crit, "введите возраст");
});

test("DXA: диагноз по T — норма ≥ −1, остеопения, остеопороз ≤ −2,5", () => {
  const mpk = t => dxa({ "Возраст": 68, "T позв": t }, WOMAN_POST).set["МПК"];
  assert.equal(mpk(-1.0), 1);
  assert.equal(mpk(-1.1), 2);
  assert.equal(mpk(-2.4), 2);
  assert.equal(mpk(-2.5), 3);
});

test("DXA: диагноз по Z — ниже ожидаемого при ≤ −2,0", () => {
  const mpk = z => dxa({ "Возраст": 40, "Z позв": z }, WOMAN_PRE).set["МПК"];
  assert.equal(mpk(-1.9), 4);
  assert.equal(mpk(-2.0), 5);
});

test("DXA: берётся худшая из видимых областей, скрытые не считаются", () => {
  assert.equal(dxa({ "Возраст": 68, "T позв": -1.2, "T шейка 1": -2.6 }, WOMAN_POST).set["МПК"], 3);
  // предплечье по умолчанию скрыто (переключатель «предплечье» = 0)
  assert.equal(dxa({ "Возраст": 68, "T позв": -0.5, "T предпл": -3.0 }, WOMAN_POST).set["МПК"], 1);
  assert.equal(dxa({ "Возраст": 68, "T позв": -0.5, "T предпл": -3.0 }, { ...WOMAN_POST, "предплечье": 1 }).set["МПК"], 3);
});

test("DXA: консультация и срок контроля", () => {
  let s = dxa({ "Возраст": 80, "T позв": -2.0 }, WOMAN_POST).set;
  assert.equal(s["консультация"], 1);                                // ≥ 75 — гериатр
  assert.equal(s["контроль через"], 0);                              // не норма — через 1 год
  s = dxa({ "Возраст": 60, "T позв": -2.0 }, WOMAN_POST).set;
  assert.equal(s["консультация"], 2);                                // эндокринолог
  s = dxa({ "Возраст": 60, "T позв": 0.5 }, WOMAN_POST).set;
  assert.equal(s["консультация"], 3);                                // норма — без консультации
  assert.equal(s["контроль через"], 1);                              // 2 года
});

test("DXA: динамика T% по каждой области в процентных пунктах", () => {
  const fields = { "Возраст": 68, "T% позв": 82.9, "было позв": 80, "T% шейка 1": 76.5, "было шейка 1": 80 };
  const result = dxa(fields, WOMAN_POST);
  assert.equal(result.dyn, "T% в поясничном отделе позвоночника +2,9 п. п., в шейке левой бедренной кости −3,5 п. п.");
  assert.equal(Object.hasOwn(result.set, "динамика"), false);
});

test("TBS: > 1,35 норма, 1,20–1,35 частичное нарушение, ≤ 1,20 полное", () => {
  const t = x => C["TBS ВЫВОД"].set([x])["TBS вывод"];
  assert.equal(t(1.36), 1);
  assert.equal(t(1.35), 2);   // ⚠ граница: по ISCD (Silva 2014) 1,350 — уже норма. Сверить с источником, поправить код и этот тест вместе
  assert.equal(t(1.21), 2);
  assert.equal(t(1.20), 3);
  assert.equal(t(NaN), 0);
});

test("FRAX: сравнение с порогом вмешательства для возраста, склонение «года/лет»", () => {
  const fx = (age, x) => C["FRAX ВЫВОД"].text([age, x]);
  assert.equal(fx(74, 25), "выше точки терапевтического вмешательства для возраста 74 лет");
  assert.equal(fx(71, 19.7), "на уровне точки терапевтического вмешательства для возраста 71 года");
  assert.equal(fx(81, 10), "ниже точки терапевтического вмешательства для возраста 81 года");
  assert.equal(fx(39, 10), "");
  assert.equal(fx(91, 10), "");
  assert.equal(fx(NaN, 10), "введите возраст");
  for (let a = 40; a <= 90; a++) assert.notEqual(fx(a, 15), "", "нет порога для " + a + " лет");   // таблица без дыр
  // копия таблицы порогов (округлено до 0,1, как сравнивает сайт). Меняете таблицу в index.html — меняйте и здесь,
  // сверив с КР «Остеопороз»: так случайная правка одной цифры не пройдёт незамеченной
  const IT = [10.8, 11.1, 11.3, 11.6, 11.9, 12.2, 12.5, 12.8, 13.1, 13.4, 13.6, 13.9, 14.1, 14.4, 14.7, 15, 15.3, 15.7, 16, 16.4,
    16.8, 17, 17.3, 17.6, 17.8, 18, 18.3, 18.6, 18.8, 19.1, 19.3, 19.7, 20.2, 20.7, 21.2, 21.7, 22.1, 22.4, 22.7, 22.8,
    22.9, 22.9, 22.7, 22.4, 21.8, 21.1, 20.4, 19.3, 18.1, 16.8, 15.7];
  IT.forEach((it, i) => assert.match(fx(40 + i, it), /^на уровне/, "порог для " + (40 + i) + " лет: " + it));
  const out = a => C["FRAX ВОЗРАСТ"].set([a])["FRAX вне 40–90 лет"];
  assert.deepEqual([39, 40, 90, 90.9, 91].map(out), [1, 0, 0, 0, 1]);
});

/* ---------- Сквозная проверка: шаблон целиком ---------- */
function template(file) {
  const text = read("templates/" + file).replace(/\r/g, "").split("\n---\n").slice(1).join("\n---\n");
  const el = W.document.createElement("div");
  W.document.body.appendChild(el);
  const tpl = W.RH_TEMPLATE(text, el);
  const input = n => el.querySelector('input[data-name="' + n + '"]');
  return {
    el, tpl,
    type(n, v) { const i = input(n); i.value = v; i.dispatchEvent(new W.Event("input", { bubbles: true })); },
    // нажать на переключатель, в котором лежит поле n, k раз
    cycle(n, k = 1) { const t = input(n).closest(".tg"); for (let j = 0; j < k; j++) t.dispatchEvent(new W.MouseEvent("click", { bubbles: true })); },
  };
}

test("шаблон КТА БЦА: стеноз попадает в заключение с правильной градацией", () => {
  const t = template("cta-bca-stenosis.md");
  t.cycle("Dмин П");                                                 // «без стенозов» → «стеноз устья …»
  t.type("Dмин П", "1,5"); t.type("Dдист П", "5"); t.type("Dлук П", "7,5");
  const out = t.tpl.text();
  assert.match(out, /стеноз устья 70% по NASCET и 80% по ECST/);
  assert.match(out, /Выраженный стеноз устья правой ВСА — 70% по NASCET \(80% по ECST\)\./);
  assert.doesNotMatch(out, /левой ВСА/);
});

test("шаблон КТА БЦА: градация считается по округлённому значению (49,6% → 50% → умеренный)", () => {
  const t = template("cta-bca-stenosis.md");
  t.cycle("Dмин П");
  t.type("Dмин П", "2,52"); t.type("Dдист П", "5");
  assert.match(t.tpl.text(), /Умеренный стеноз устья правой ВСА — 50% по NASCET/);
});

test("шаблоны КТА БЦА: схема Виллизиева круга заполняет описание и заключение", () => {
  for (const file of ["cta-bca.md", "cta-bca-stenosis.md"]) {
    const { el, tpl } = template(file);
    assert.doesNotMatch(tpl.text(), /\{\{ВИЛЛИЗИЕВ|Виллизиев круг/i, file);
    const segment = el.querySelector('.willis-segment[aria-label="Передняя соединительная артерия"]');
    assert.ok(segment, file);
    segment.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
    const [description, conclusion] = tpl.text().split("ЗАКЛЮЧЕНИЕ:");
    assert.match(description, /Не визуализируется передняя соединительная артерия\./, file);
    assert.match(conclusion, /Виллизиев круг частично полный по Krabbe-Hartkamp/, file);
    el.querySelector(".willis-clear").click();
    assert.doesNotMatch(tpl.text(), /Виллизиев круг|Не визуализируется передняя соединительная артерия/i, file);
  }
});

test("КТ ОГК: фраза о свежих изменениях исчезает при находке и возвращается после сброса", () => {
  const fresh = /свежих (?:очаговых и )?инфильтративных изменений/gi;
  for (const [file, option, count] of [
    ["ct-chest.md", "+ консолидация", 2],
    ["ct-chest-short.md", "Подозрительных очагов нет.", 2],
    ["ct-cap.md", "+ очаги лёгких", 1],
  ]) {
    const { el, tpl } = template(file);
    const toggle = [...el.querySelectorAll(".tg")].find(node => node.firstElementChild.textContent === option);
    assert.ok(toggle, file);
    assert.equal(tpl.text().match(fresh)?.length, count, file);
    toggle.click();
    assert.equal(tpl.text().match(fresh), null, file);
    for (let i = 1; i < toggle.children.length; i++) toggle.click();
    assert.equal(tpl.text().match(fresh)?.length, count, file);
  }

  const { tpl, cycle, type } = template("ct-chest.md");
  cycle("Сердце");
  assert.equal(tpl.text().match(fresh), null);
  cycle("Сердце");
  assert.equal(tpl.text().match(fresh)?.length, 2);
  type("L1 HU", "100");
  assert.equal(tpl.text().match(fresh), null);
  type("L1 HU", "130");
  assert.equal(tpl.text().match(fresh)?.length, 2);

  const screening = template("ct-chest-ldct.md");
  const findings = screening.el.querySelector(".tg");
  assert.match(screening.tpl.text(), /Инфильтративных изменений нет\.[\s\S]*Lung-RADS 1/);
  findings.click();
  assert.doesNotMatch(screening.tpl.text(), /Инфильтративных изменений нет|Lung-RADS 1/);
  assert.equal(screening.tpl.missing().length, 2);
  findings.click();
  assert.match(screening.tpl.text(), /Lung-RADS 1/);
});

test("конструктор переломов: формулировка диагноза объединяет суставное вовлечение и вколочение", () => {
  const dom = new JSDOM(read("fractures.html"), { runScripts: "dangerously" });
  try {
    const { document, Event } = dom.window;
    const output = id => document.getElementById(id).textContent;
    const choose = (key, value) => {
      const field = document.querySelector(`[data-key="${key}"]`);
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    };
    assert.match(output("conclusion"), /^Перелом /);
    choose("morph", "oblique");
    choose("joint", "yes");
    choose("stepMm", "2");
    assert.match(output("conclusion"), /^Внутрисуставной косой перелом /);
    document.querySelector('[data-key="impacted"]').click();
    assert.match(output("description"), /Определяется вколочение костных отломков\./);
    assert.match(output("description"), /ступенька суставной поверхности до 2 мм/);
    assert.match(output("conclusion"), /^Внутрисуставной вколоченный косой перелом /);
    assert.doesNotMatch(output("conclusion"), /ступенька|суставная поверхность/i);
    choose("joint", "no");
    assert.match(output("conclusion"), /^Вколоченный косой перелом /);
    document.getElementById("resetBtn").click();
    assert.match(output("conclusion"), /^Перелом /);
  } finally { dom.window.close(); }
});
