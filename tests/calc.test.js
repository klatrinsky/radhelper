/* Калькуляторы шаблонов (CALC в index.html): формулы, пороги переключателей, и сквозная проверка —
   ввёл поля в шаблон → какой текст уйдёт в заключение. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { openSite, read } = require("./env");

let W, C;
test.before(async () => { W = await openSite(); C = W.RH_CALC; });
test.after(() => W?.close());

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

function templateToggle(el, prefix) {
  const toggle = [...el.querySelectorAll(".tg")].find(node => node.firstElementChild?.textContent.startsWith(prefix));
  assert.ok(toggle, prefix);
  return toggle;
}

test("вступление протокола сохраняет методику исследования и переходит к описанию", () => {
  const protocol = file => template(file).tpl.text("protocol");
  assert.match(protocol("ct-spine-lumbar.md"), /^Поясничный лордоз сохранён\./);
  assert.match(protocol("ct-pelvis-f.md"), /размеры \[__\] x \[__\] x \[__\] мм/);
  assert.match(protocol("ct-perfusion.md"), /^Применено внутривенное болюсное контрастирование\. Зона сканирования — 20 мм на уровне базальных ядер\. Постобработка syngo\.via/);
  assert.match(protocol("ct-voiding-urethrography.md"), /Отсроченное сканирование выполнено на 10-й минуте, микционная фаза — в положении на правом боку/);
  assert.match(protocol("xr-chest-supine.md"), /^Снимки выполнены в прямой и боковой проекциях в горизонтальном положении пациента\. Лёгочные поля/);
  const combined = protocol("xr-spine-thoracolumbar.md");
  assert.equal((combined.match(/в прямой и боковой проекциях/g) || []).length, 1);
  assert.match(combined, /Грудной отдел позвоночника\.\nГрудной кифоз сохранён/);
  assert.match(combined, /Поясничный отдел позвоночника\.\nПоясничный лордоз сохранён/);
});

test("КТ почек: нативные находки, Bosniak и фазовая оценка копируются в нужном варианте", () => {
  const native = template("ct-kidneys.md");
  const nativeProtocol = () => native.tpl.text("protocol");
  assert.match(nativeProtocol(), /Утолщения стенок ЧЛС более 3 мм не выявлено/);
  assert.match(nativeProtocol(), /Кальциноз стенок почечных артерий не выявлен/);
  assert.doesNotMatch(nativeProtocol(), /Bosniak|кортикомедуллярн|вымывание/i);
  const stone = templateToggle(native.el, "Конкременты в чашечно-лоханочных системах");
  stone.click();
  const inputs = stone.querySelectorAll("input");
  ["правой почки (нижняя чашечка)", "7", "610"].forEach((value, i) => { inputs[i].value = value; });
  assert.match(nativeProtocol(), /Конкремент в чашечно-лоханочной системе правой почки \(нижняя чашечка\) размером 7 мм, плотностью 610 HU/);
  assert.doesNotMatch(nativeProtocol(), /Конкременты в чашечно-лоханочных системах не определяются/);
  assert.equal(native.tpl.text("conclusion"), "Конкременты в мочеточниках не выявлены.\nЧЛС не расширены.\nМочеточники не расширены.");

  const contrast = template("ct-kidneys-contrast.md");
  const contrastProtocol = () => contrast.tpl.text("protocol");
  assert.match(contrastProtocol(), /В кортикомедуллярную фазу паренхима почек накапливает контрастное вещество симметрично/);
  assert.match(contrastProtocol(), /Контрастное вещество появляется в ЧЛС своевременно/);
  assert.match(contrastProtocol(), /На отсроченных изображениях вымывание контрастного вещества симметричное/);
  assert.doesNotMatch(contrastProtocol(), /в артериальную фазу/i);
  const arterial = contrast.el.querySelector('select[aria-label="артериальная фаза"]');
  arterial.selectedIndex = 1;
  arterial.dispatchEvent(new W.Event("change"));
  assert.match(contrastProtocol(), /В артериальную фазу дефектов накопления контрастного вещества не выявлено/);

  const cyst = templateToggle(contrast.el, "Сложные кисты почек");
  cyst.click();
  const category = cyst.querySelector("select");
  category.value = "IIF";
  category.dispatchEvent(new W.Event("change"));
  const cystInputs = cyst.querySelectorAll("input");
  ["слева в верхнем сегменте", "18", "указана в заключении"].forEach((value, i) => { cystInputs[i].value = value; });
  assert.match(contrastProtocol(), /Сложная киста почки слева в верхнем сегменте размером 18 мм, Bosniak IIF, оценка риска указана в заключении/);
  assert.equal(contrast.tpl.text("conclusion"), "ЧЛС не расширены.\nМочеточники не расширены.");

  const short = template("ct-kidneys-short.md").tpl.text("protocol");
  assert.match(short, /Кисты и объёмные образования почек не выявлены/);
  assert.match(short, /Костной деструкции в телах позвонков в зоне исследования не выявлено/);
  assert.doesNotMatch(short, /кортикомедуллярн|HU|вымывание/i);
});

test("КТ почек: автоматическое заключение сохраняет норму по остальным участкам", () => {
  for (const [file, adrenal, ureter] of [
    ["ct-kidneys.md", "Объёмных образований надпочечников", "Мочеточники не расширены."],
    ["ct-kidneys-contrast.md", "Объёмных образований надпочечников", "Мочеточники не расширены."],
    ["ct-kidneys-short.md", "Надпочечники без особенностей.", "Мочеточники не расширены."],
  ]) {
    const { el, tpl } = template(file);
    const normal = tpl.text("conclusion");
    assert.match(normal, /ЧЛС не расширены/);
    templateToggle(el, adrenal).click();
    assert.equal(tpl.text("conclusion"), normal, file);
    templateToggle(el, ureter).click();
    assert.equal(tpl.text("conclusion"), normal.split("\n").filter(line => line !== ureter).join("\n"), file);
  }
});

test("Агатстон: сумма, границы CAC-DRS и число артерий в описании и заключении", () => {
  const { tpl, type } = template("ct-coronary-calcium.md");
  const names = ["CAC LM", "CAC LAD", "CAC LCx", "CAC RCA"];
  const set = values => values.forEach((value, i) => type(names[i], value));
  const cases = [
    [["0", "0", "0", "0"], "0", "A0"],
    [["0", "0,1", "0", "0"], "0,1", "A1/N1"],
    [["0", "99,999", "0", "0"], "99,999", "A1/N1"],
    [["99,8", "0,1", "0.1", "0"], "100", "A2/N3"],
    [["150", "149,99", "0", "0"], "299,99", "A2/N2"],
    [["299,7", "0,1", "0.1", "0,1"], "300", "A3/N4"],
  ];
  assert.equal(tpl.missing("conclusion")[0].label, "CAC LM");
  for (const [values, sum, category] of cases) {
    set(values);
    for (const section of ["protocol", "conclusion"]) {
      const text = tpl.text(section);
      assert.ok(text.includes("Суммарный индекс Агатстона — " + sum + "."));
      assert.ok(text.includes("(CAC-DRS " + category + ")."));
      assert.equal(tpl.missing(section).length, 0);
    }
  }
  for (const value of ["", "-1", "25x", "1,2.3"]) {
    type("CAC RCA", value);
    assert.doesNotMatch(tpl.text("conclusion"), /CAC-DRS A/);
    assert.equal(tpl.missing("conclusion")[0].label, "CAC RCA");
  }
});

test("шаблон КТА БЦА: стеноз попадает в заключение с правильной градацией", () => {
  const t = template("cta-bca-stenosis.md");
  t.cycle("Dмин П");                                                 // «без стенозов» → «стеноз устья …»
  t.type("Dмин П", "1,5"); t.type("Dдист П", "5"); t.type("Dлук П", "7,5");
  const out = t.tpl.text();
  assert.match(out, /стеноз устья 80% по ECST и 70% по NASCET/);
  assert.match(out, /Выраженный стеноз устья правой ВСА — 70% по NASCET \(80% по ECST\)\./);
  assert.match(out, /Слева:\nСтеноза устья левой ВСА нет\./);
  t.cycle("Dмин Л");
  t.type("Dмин Л", "3"); t.type("Dдист Л", "5"); t.type("Dлук Л", "6");
  assert.match(t.tpl.text().split("ЗАКЛЮЧЕНИЕ:")[1],
    /Справа:\nВыраженный стеноз[^\n]+70% по NASCET \(80% по ECST\)\.[\s\S]*Слева:\nНезначительный стеноз[^\n]+40% по NASCET \(50% по ECST\)\./);
  t.cycle("Dмин Л");
  assert.match(t.tpl.text().split("Слева:").at(-1), /Почти полная окклюзия левой ВСА с частичным спадением/);
  assert.doesNotMatch(t.tpl.text().split("Слева:").at(-1), /NASCET|ECST/);
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
    if (file === "cta-bca-stenosis.md") {
      const panel = segment.closest("section");
      assert.ok(panel.hidden);
      [...el.querySelectorAll(".ctl .tg")].find(node =>
        node.firstElementChild.textContent === "+ Интракраниальный сегмент").click();
      assert.equal(panel.hidden, false);
    }
    segment.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
    const [description, conclusion] = tpl.text().split("ЗАКЛЮЧЕНИЕ:");
    assert.match(description, /Не визуализируется передняя соединительная артерия\./, file);
    assert.match(conclusion, /Виллизиев круг частично полный по Krabbe-Hartkamp/, file);
    el.querySelector(".willis-clear").click();
    assert.doesNotMatch(tpl.text(), /Виллизиев круг|Не визуализируется передняя соединительная артерия/i, file);
  }
});

test("DXA: свёрнутые данные сравнения участвуют в расчёте и исключены из копируемого описания", () => {
  const t = template("dxa.md");
  const previous = t.el.querySelector("details.ctl");
  assert.ok(previous.hidden);
  const control = [...t.el.querySelectorAll(".ctl .tg")].find(node =>
    node.firstElementChild.textContent === "Первичное исследование");
  control.click();
  assert.equal(previous.hidden, false);
  assert.equal(previous.open, false);
  previous.open = true;
  const date = previous.querySelector('input[placeholder="дд.мм.гггг"]');
  date.value = "15.01.2026";
  date.dispatchEvent(new W.Event("input", { bubbles: true }));
  t.type("Возраст", "73");
  t.type("T% позв", "96,5");
  t.type("было позв", "92");
  const copy = t.tpl.text();
  const [description, conclusion] = copy.split("Заключение:");
  assert.doesNotMatch(description, /15\.01\.2026|92%|Данные предыдущего исследования|BMD/);
  assert.match(conclusion, /от 15\.01\.2026.*\+4,5 п\. п\./);
  previous.open = false;
  assert.equal(t.tpl.text(), copy);
});

test("КТ брюшной полости: жировую инволюцию можно исключить из описания поджелудочной", () => {
  for (const file of ["ct-abdomen.md", "ct-abdomen-contrast.md"]) {
    const { el, tpl } = template(file);
    const toggles = [...el.querySelectorAll(".tg")];
    const involution = toggles.find(node => node.firstElementChild.textContent.startsWith("Жировая инволюция"));
    const pathology = toggles.find(node => node.firstElementChild.textContent === "+ патология ПЖ");
    const description = () => tpl.text("protocol");
    assert.match(description(), /Жировая инволюция в рамках возрастных изменений\./, file);
    involution.click();
    assert.match(description(), /Выраженная жировая инволюция\./, file);
    involution.click();
    assert.match(description(), /Атрофия паренхимы\./, file);
    involution.click();
    assert.doesNotMatch(description(), /инволюци|Атрофия паренхимы/i, file);
    assert.match(description(), /Окружающая клетчатка сохранна\.\nСелезёнка обычных размеров\./, file);
    pathology.click();
    pathology.click();
    assert.match(description(), /Окружающая клетчатка сохранна\. В железе и окружающей клетчатке отмечаются изменения \(описание\)\./, file);
    involution.click();
    assert.match(description(), /Жировая инволюция в рамках возрастных изменений\./, file);
  }
});

test("КТА грудной аорты: форма просвета меняется только у выбранного уровня", () => {
  const { el, tpl } = template("cta-thoracic-aorta.md");
  const shapes = [...el.querySelectorAll("select")];
  assert.equal(shapes.length, 9);
  shapes[2].selectedIndex = 1;
  shapes[2].dispatchEvent(new W.Event("change"));
  const text = tpl.text();
  assert.match(text, /Восходящая аорта, максимально: \[__\] мм, форма просвета овальная\./);
  assert.equal((text.match(/форма просвета круглая/g) || []).length, 8);
  assert.doesNotMatch(text, /Плотность контрастирования|Периаортальной жидкости|Ветви дуги/);
});

test("КТА лёгочных артерий: дыхательные артефакты меняют описание и заключение", () => {
  const { el, tpl } = template("cta-pulmonary.md");
  assert.doesNotMatch(tpl.text(), /артефакт/i);
  const toggle = [...el.querySelectorAll(".tg")].find(node =>
    node.firstElementChild.textContent.startsWith("В сегментарных и субсегментарных"));
  toggle.click();
  const [description, conclusion] = tpl.text().split("ЗАКЛЮЧЕНИЕ:");
  assert.match(description, /На фоне артефактов от дыхательных движений/);
  assert.doesNotMatch(description, /В сегментарных и субсегментарных лёгочных артериях дефектов наполнения не выявлено/);
  assert.match(conclusion, /Оценка сегментарных и субсегментарных ветвей ограничена/);
});

test("КТА ног: правый и левый блоки отделены в описании и заключении", () => {
  for (const file of ["cta-legs-short.md", "cta-legs.md"]) {
    const { tpl } = template(file);
    for (const section of tpl.text().split("ЗАКЛЮЧЕНИЕ:")) {
      assert.match(section, /^Справа:\n[^\n]+[\s\S]*^Слева:\n[^\n]+/m, file);
    }
  }
});

test("КТА ног: норма относится к аорте и ветвям, блок аневризмы доступен после удаления эктазии", () => {
  const normal = /Аорта и её ветви: без гемодинамически значимых стенозов и окклюзий/;
  for (const [file, branches, aorta] of [
    ["cta-legs.md", "Чревный ствол, верхняя", "(инфраренальный сегмент) не расширена"],
    ["cta-legs-short.md", "без гемодинамически значимых стенозов", "проходима, аневризм нет"],
  ]) {
    const { el, tpl } = template(file);
    assert.match(tpl.text("conclusion"), normal);
    templateToggle(el, branches).click();
    assert.doesNotMatch(tpl.text("conclusion"), normal);
    assert.match(tpl.text("conclusion"), /Стеноз устья правой почечной артерии/);
    templateToggle(el, aorta).click();
    assert.match(tpl.text("protocol"), /инфраренальная веретенообразная аневризма/);
    assert.match(tpl.text("conclusion"), /Инфраренальная веретенообразная аневризма/);
    if (file === "cta-legs.md") {
      assert.match(tpl.text("protocol"), /Длина шейки[\s\S]*Диаметр ОБА/);
      assert.match(tpl.text("conclusion"), /КТ-признаков разрыва нет/);
    }
    assert.doesNotMatch(el.textContent, /эктази/i);
  }
});

test("КТА ног: все состояния схемы используют связанные поля подробного шаблона", () => {
  let assessment;
  const bind = W.bindLegArteriesTemplate;
  const { el, tpl } = template("cta-legs.md");
  const preview = tpl.text();
  const details = el.querySelector(".leg-arteries-toggle");
  try {
    W.bindLegArteriesTemplate = form => (assessment = bind(form));
    details.open = true;
    details.dispatchEvent(new W.Event("toggle"));
    assert.ok(assessment);
    assert.equal(assessment.count(), 0);
    for (const { id } of W.RH_LEG_ARTERIES.vessels) {
      for (const mode of assessment.options(id)) {
        assessment.setStatus(id, mode);
        assert.equal(assessment.get(id).mode, mode, id);
        const editor = assessment.editor(id);
        const values = { percent: "67,5", length: "21", diameter: "32", plaque: "mixed", thrombus: "yes" };
        for (const key of editor.fields) {
          const value = key === "location" ? editor.location.slice(-1) : values[key];
          assert.notEqual(value, undefined, id + " " + key);
          assessment.setDetail(id, key, value);
          assert.deepEqual(assessment.get(id).lesions[0][key], value, id + " " + key);
        }
      }
      assessment.reset(id);
      assert.equal(assessment.get(id), undefined, id);
    }
    assessment.confirmUnmarked();
    assert.equal(assessment.count(), 15);
    assert.equal(assessment.canConfirm(), false);
    assert.equal(tpl.text(), preview);
    assessment.clear();
    assert.equal(assessment.count(), 0);
    assert.equal(tpl.text(), preview);
  } finally {
    W.bindLegArteriesTemplate = bind;
    el.remove();
  }
});

test("Рентгенография ОГК: сторона релаксации синхронизируется с заключением", () => {
  const { el, tpl } = template("xr-chest-full.md");
  const toggles = () => [...el.querySelectorAll(".tg")];
  const diaphragm = toggles().find(node =>
    node.firstElementChild.textContent === "Диафрагма без особенностей.");
  assert.doesNotMatch(tpl.text(), /релаксация/i);
  diaphragm.click();
  assert.equal((tpl.text().match(/Релаксация правого купола диафрагмы\./g) || []).length, 2);
  toggles().find(node => node.firstElementChild.textContent === "правого купола").click();
  assert.equal((tpl.text().match(/Релаксация левого купола диафрагмы\./g) || []).length, 2);
});

test("КТ ОГК: фраза о свежих изменениях зависит от находок в паренхиме лёгких", () => {
  const fresh = /свежих (?:очаговых и )?инфильтративных изменений/gi;
  for (const [file, option, count] of [
    ["ct-chest.md", "+ консолидация", 2],
    ["ct-chest-short.md", "Подозрительных очагов нет.", 2],
    ["ct-cap.md", "+ очаги лёгких", 1],
  ]) {
    const { el, tpl } = template(file);
    const toggle = templateToggle(el, option);
    assert.equal(tpl.text().match(fresh)?.length, count, file);
    toggle.click();
    assert.equal(tpl.text().match(fresh), null, file);
    for (let i = 1; i < toggle.children.length; i++) toggle.click();
    assert.equal(tpl.text().match(fresh)?.length, count, file);
  }

  const { el, tpl, cycle, type } = template("ct-chest.md");
  cycle("Сердце");
  templateToggle(el, "+ бронхоэктазы").click();
  templateToggle(el, "Внутригрудные лимфатические узлы не увеличены").click();
  assert.equal(tpl.text().match(fresh)?.length, 2);
  for (const value of ["111", ""]) {
    type("L1 HU", "110");
    assert.equal(tpl.text().match(fresh)?.length, 2);
    assert.match(tpl.text("protocol"), /косвенные МСКТ-признаки остеопороза/);
    assert.doesNotMatch(tpl.text("conclusion"), /остеопороз|денситометрия/i);
    type("L1 HU", value);
    assert.equal(tpl.text().match(fresh)?.length, 2);
    assert.doesNotMatch(tpl.text(), /остеопороз/i);
  }

  const short = template("ct-chest-short.md");
  templateToggle(short.el, "Плеврального выпота нет").click();
  assert.equal(short.tpl.text().match(fresh)?.length, 2);

  const combined = template("ct-cap.md");
  templateToggle(combined.el, "Дефектов контрастирования лёгочных артерий").click();
  assert.equal(combined.tpl.text().match(fresh)?.length, 1);

  const screening = template("ct-chest-ldct.md");
  const findings = screening.el.querySelector(".tg");
  assert.match(screening.tpl.text(), /Инфильтративных изменений нет\.[\s\S]*Lung-RADS 1/);
  findings.click();
  assert.doesNotMatch(screening.tpl.text(), /Инфильтративных изменений нет|Lung-RADS 1/);
  assert.equal(screening.tpl.missing().length, 2);
  findings.click();
  assert.match(screening.tpl.text(), /Lung-RADS 1/);
});

test("Сборная КТ: общая норма исчезает при находке, ручное заключение остаётся доступно", () => {
  const normal = /КТ-признаков объёмных образований, лимфаденопатии и вторичных изменений/;
  for (const [option, finding] of [
    ["Внутригрудные, надключичные и подмышечные", /Внутригрудная лимфаденопатия/],
    ["очаговых образований нет.", /Образование .* печени/],
    ["Дефектов контрастирования лёгочных артерий", /тромбоэмболии/],
  ]) {
    const { el, tpl } = template("ct-cap.md");
    assert.match(tpl.text("conclusion"), normal);
    templateToggle(el, option).click();
    assert.doesNotMatch(tpl.text("conclusion"), normal);
    assert.match(tpl.text("conclusion"), finding);
    const manual = templateToggle(el, "+ итог");
    assert.equal(manual.closest(".ln").hidden, false);
    manual.click();
    manual.querySelector("input").value = "Заключение врача.";
    assert.match(tpl.text("conclusion"), /Заключение врача\./);
  }
});

test("КТ брюшной полости: свободные жидкость и газ выбираются независимо", () => {
  for (const file of ["ct-abdomen.md", "ct-abdomen-contrast.md"]) {
    const { el, tpl } = template(file);
    const protocol = () => tpl.text("protocol");
    const normal = /Свободные пространства брюшной полости без особенностей/;
    assert.match(protocol(), normal);
    assert.match(tpl.text("conclusion"), /острой патологии/);
    const liquid = templateToggle(el, "+ свободная жидкость");
    const gas = templateToggle(el, "+ свободный газ");
    liquid.click();
    liquid.querySelector("input").value = "в малом тазу";
    assert.match(protocol(), /Свободная жидкость в малом тазу/);
    assert.doesNotMatch(protocol(), /Свободный газ/);
    assert.doesNotMatch(protocol(), normal);
    gas.click();
    gas.querySelector("input").value = "под диафрагмой";
    assert.match(protocol(), /Свободная жидкость в малом тазу\. Свободный газ под диафрагмой\./);
    liquid.click();
    assert.match(protocol(), /Свободный газ под диафрагмой/);
    assert.doesNotMatch(protocol(), /Свободная жидкость/);
    assert.doesNotMatch(tpl.text("conclusion"), /острой патологии/);
    gas.click();
    assert.match(protocol(), normal);
    assert.match(tpl.text("conclusion"), /острой патологии/);
  }
});

test("КТ поясничного отдела: выбор оценки стеноза не зависит от находки в диске", () => {
  const { el, tpl, type } = template("ct-spine-lumbar.md");
  const level = "L4–L5";
  const measurement = el.querySelector('input[data-name="S L4–L5"]');
  const disk = [...el.querySelectorAll(".ln")].find(line => line.textContent.startsWith(level + ":")).querySelector(".tg");
  const stenosis = templateToggle(el, "+ стеноз канала " + level);
  const conclusion = () => tpl.text("conclusion");
  assert.ok(measurement.closest("[hidden]"));
  disk.click();
  assert.ok(measurement.closest("[hidden]"));
  assert.match(conclusion(), /Протрузия диска L4–L5/);
  stenosis.click();
  assert.equal(measurement.closest("[hidden]"), null);
  type("S L4–L5", "75");
  assert.match(conclusion(), /Относительный стеноз позвоночного канала на уровне L4–L5 \(площадь дурального мешка 75 мм²\)/);
  disk.click();
  assert.match(conclusion(), /Экструзия диска L4–L5/);
  type("S L4–L5", "74");
  assert.match(conclusion(), /Абсолютный стеноз позвоночного канала на уровне L4–L5/);
  assert.doesNotMatch(conclusion(), /стеноз позвоночного канала на уровне L3–L4/);
  stenosis.click();
  assert.ok(measurement.closest("[hidden]"));
  assert.doesNotMatch(conclusion(), /стеноз позвоночного канала на уровне L4–L5/);
  assert.match(conclusion(), /Экструзия диска L4–L5/);
  stenosis.click();
  assert.match(conclusion(), /Абсолютный стеноз позвоночного канала на уровне L4–L5/);
});

test("Шаблоны позвоночника описывают компрессионный перелом без блока оценки давности", () => {
  for (const [file, prefix] of [
    ["ct-spine-lumbar.md", "Высота тел позвонков сохранена"],
    ["ct-spine-thoracic.md", "Высота тел позвонков сохранена"],
    ["xr-spine-lumbar.md", "Высота тел позвонков сохранена"],
    ["xr-spine-thoracic.md", "Высота тел позвонков сохранена"],
    ["xr-spine-thoracolumbar.md", "Высота тел позвонков сохранена"],
  ]) {
    const { el, tpl, type } = template(file);
    assert.doesNotMatch(el.textContent, /давност|свежий перелом|консолидированный перелом/i, file);
    templateToggle(el, prefix).click();
    type("h 1", "15");
    type("H 1", "25");
    assert.match(tpl.text("protocol"), /компрессионный перелом/i, file);
    assert.match(tpl.text("conclusion"), /Компрессионный перелом/i, file);
    assert.doesNotMatch(tpl.text(), /давност|свежий перелом|консолидированный перелом/i, file);
  }
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
    const findings = document.getElementById("additionalFindings");
    let clipboard;
    document.execCommand = () => { clipboard = document.activeElement.value; return true; };
    const copy = section => {
      document.querySelector('[data-copy="' + section + '"]').click();
      return clipboard;
    };
    assert.equal(findings.value, "");
    assert.equal(copy("description"), output("description"));
    findings.value = " \n \t ";
    assert.equal(copy("description"), output("description"));
    findings.value = " \nДополнительная находка. \n";
    const description = output("description") + "\n\nДополнительная находка.";
    assert.equal(copy("description"), description);
    assert.equal(copy("all"), description + "\n\nЗАКЛЮЧЕНИЕ: " + output("conclusion"));
    assert.equal(copy("conclusion"), output("conclusion"));
    document.getElementById("resetBtn").click();
    assert.equal(findings.value, "");
    assert.match(output("conclusion"), /^Перелом /);
  } finally { dom.window.close(); }
});
