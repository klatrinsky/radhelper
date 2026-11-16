/* Калькуляторы лаборанта из widgets.js — проверяем так, как ими пользуются: нажали кнопку, ввели число, прочитали ответ.
   Ожидаемые цифры посчитаны руками по правилам из комментариев widgets.js, а не скопированы из кода. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { widget } = require("./env");

/* ---------- Объём контраста ---------- */
function contrast() {
  const w = widget("contrast-volume");
  return {
    ...w,
    conc: c => w.click('.w-conc [data-c="' + c + '"]'),
    angio: () => w.click('.w-mode [data-mode="angio"]'),
    zone: z => w.click('.w-zone [data-z="' + z + '"]'),
    plain: () => w.text('[data-pane="plain"] .w-out'),
    out: () => w.text(".w-a-out"),
    more: () => w.text(".w-a-more"),
  };
}

test("контраст: без концентрации ничего не считает", () => {
  const c = contrast();
  c.type("#w-weight", "70");
  assert.match(c.plain(), /выберите концентрацию/);
});

test("контраст, не ангио: вес × коэффициент, округление до мл", () => {
  const cases = [  // [концентрация, вес, мл]
    [350, "70", "98 мл"], [300, "70", "112 мл"], [320, "70", "105 мл"], [370, "70", "91 мл"], [400, "70", "84 мл"],
    [350, "70,5", "99 мл"],      // 98,7 → 99, запятая как разделитель
    [350, "70.5", "99 мл"],
  ];
  for (const [conc, kg, ml] of cases) {
    const c = contrast(); c.conc(conc); c.type("#w-weight", kg);
    assert.equal(c.plain(), ml, conc + " мг/мл, " + kg + " кг");
  }
});

test("контраст, не ангио: потолок 150 мл", () => {
  const c = contrast(); c.conc(300); c.type("#w-weight", "120");     // 192 → 150
  assert.match(c.plain(), /^150 мл\s*максимум$/);
  c.conc(350); c.type("#w-weight", "107");                           // 149,8 → 150 — ровно на потолке, без «максимум»
  assert.equal(c.plain(), "150 мл");
});

test("контраст, не ангио: мусор и нереальный вес — ошибка, а не число", () => {
  for (const kg of ["15", "301", "7o", "70 кг", "-70"]) {
    const c = contrast(); c.conc(350); c.type("#w-weight", kg);
    assert.match(c.plain(), /Проверьте вес/, "вес «" + kg + "»");
  }
});

test("контраст: коэффициенты дают одну и ту же дозу йода (≈480 мг/кг)", () => {
  for (const conc of [300, 320, 350, 370, 400]) {
    const c = contrast(); c.conc(conc); c.type("#w-weight", "50");   // 50 кг — без потолка
    const mgPerKg = parseInt(c.plain(), 10) * conc / 50;
    assert.ok(mgPerKg >= 470 && mgPerKg <= 500, conc + ": " + mgPerKg + " мг йода/кг");
  }
});

test("контраст, ангио БЦА: 60–100 кг → 50–70 мл при 350, пересчёт на другую концентрацию", () => {
  let c = contrast(); c.conc(350); c.angio(); c.zone("bca"); c.type("#w-a-weight", "80");
  assert.equal(c.out(), "60 мл");
  assert.match(c.more(), /Скорость: 4,5 мл\/с/);
  assert.doesNotMatch(c.more(), /нужна концентрация/);

  c = contrast(); c.conc(320); c.angio(); c.zone("bca"); c.type("#w-a-weight", "80");
  assert.equal(c.out(), "66 мл");                                    // 60 × 350 / 320 = 65,6
  assert.doesNotMatch(c.more(), /нужна концентрация/);               // 320 для БЦА допустима

  c = contrast(); c.conc(300); c.angio(); c.zone("bca"); c.type("#w-a-weight", "80");
  assert.equal(c.out(), "70 мл");                                    // 60 × 350 / 300
  assert.match(c.more(), /нужна концентрация от 320/);
});

test("контраст, ангио ТЭЛА: флакон 50 мл при 350+, ниже — пересчёт и предупреждение", () => {
  for (const conc of [350, 370, 400]) {
    const c = contrast(); c.conc(conc); c.angio(); c.zone("pe");
    assert.match(c.out(), /1 флакон 50 мл/, String(conc));
  }
  const c = contrast(); c.conc(320); c.angio(); c.zone("pe");
  assert.equal(c.out(), "55 мл");                                    // 50 × 350 / 320 = 54,7
  assert.match(c.more(), /нужна концентрация от 350/);
  assert.ok(c.$('[data-f="w-a-weight"]').hidden, "вес для ТЭЛА не нужен");
});

test("контраст, ангио ноги: объём и скорость растут с весом, за краями — крайние значения", () => {
  const cases = [["55", "80 мл", "3,0"], ["92,5", "110 мл", "3,6"], ["130", "140 мл", "4,2"], ["40", "80 мл", "3,0"], ["160", "140 мл", "4,2"]];
  for (const [kg, ml, flow] of cases) {
    const c = contrast(); c.conc(350); c.angio(); c.zone("legs"); c.type("#w-a-weight", kg);
    assert.equal(c.out(), ml, kg + " кг");
    assert.match(c.more(), new RegExp("Скорость: " + flow + " мл/с"), kg + " кг");
  }
});

test("контраст, ангио вся аорта: по росту, по весу или среднее", () => {
  let c = contrast(); c.conc(350); c.angio(); c.zone("aorta-full");
  assert.match(c.out(), /введите рост или вес/);
  c.type("#w-a-height", "175");
  assert.equal(c.out(), "125 мл");                                   // 160→100, 190→150
  c.type("#w-a-weight", "60");                                       // по весу 100, среднее (125 + 100) / 2
  assert.equal(c.out(), "113 мл");                                   // 112,5 → 113

  c = contrast(); c.conc(300); c.angio(); c.zone("aorta-full"); c.type("#w-a-height", "190");
  assert.match(c.out(), /^150 мл\s*максимум$/);                          // 150 × 350/300 = 175 → потолок
});

test("контраст, ангио: ни одна зона ни при какой концентрации не превышает 150 мл и 4,5 мл/с", () => {
  for (const conc of [300, 320, 350, 370, 400])
    for (const z of ["bca", "pe", "aorta-part", "aorta-full", "arms", "legs"])
      for (const kg of ["20", "60", "100", "300"]) {
        const c = contrast(); c.conc(conc); c.angio(); c.zone(z);
        c.type("#w-a-weight", kg); c.type("#w-a-height", "220");
        const ml = parseInt(c.out(), 10), flow = parseFloat(c.more().match(/Скорость: ([\d,]+)/)[1].replace(",", "."));
        if (!isNaN(ml)) assert.ok(ml <= 150, z + " " + conc + " " + kg + ": " + ml);
        assert.ok(flow <= 4.5, z + " " + conc + " " + kg + ": " + flow);
      }
});

/* ---------- Доза по DLP ---------- */
test("доза: одно сканирование, DLP × коэффициент области", () => {
  const w = widget("dose-dlp");
  w.select(".w-sel", "Грудь|ОГК (лёгкие)");
  w.type(".w-dlp", "400");
  assert.equal(w.text(".w-out"), "4,80 мЗв");                        // 400 × 0,012
});

test("доза: несколько сканирований складываются", () => {
  const w = widget("dose-dlp");
  w.select(".w-row:nth-child(1) .w-sel", "Голова и шея|Головной мозг");
  w.type(".w-row:nth-child(1) .w-dlp", "1000");                      // 1,40
  w.click(".w-add");
  w.select(".w-row:nth-child(2) .w-sel", "Голова и шея|КТА БЦА");
  w.type(".w-row:nth-child(2) .w-dlp", "500,5");                     // 3,003
  assert.equal(w.text(".w-out"), "4,40 мЗв");
});

test("доза: КТА БЦА и позвоночник берут коэффициент области скана, а не головы", () => {
  const cases = [["Голова и шея|КТА БЦА", 0.006], ["Позвоночник|Поясничный отдел", 0.014], ["Позвоночник|Шейный отдел", 0.006],
    ["Несколько областей одним сканом|Вся аорта (грудная + брюшная)", 0.014]];
  for (const [study, k] of cases) {
    const w = widget("dose-dlp"); w.select(".w-sel", study); w.type(".w-dlp", "1000");
    assert.equal(w.text(".w-out"), (1000 * k).toFixed(2).replace(".", ",") + " мЗв", study);
  }
});

test("доза: ошибки ввода", () => {
  let w = widget("dose-dlp");
  assert.match(w.text(".w-out"), /—/);
  w.type(".w-dlp", "300");
  assert.match(w.text(".w-out"), /выберите исследование/);
  for (const bad of ["0", "abc", "25000"]) {
    w = widget("dose-dlp"); w.select(".w-sel", "Грудь|ОГК (лёгкие)"); w.type(".w-dlp", bad);
    assert.match(w.text(".w-out"), /Проверьте DLP/, bad);
  }
});

/* ---------- Получилось ли исследование ---------- */
function quality(zone, phase) {
  const w = widget("quality-check");
  w.click('.w-zone [data-z="' + zone + '"]');
  if (phase) w.click('.w-ph [data-p="' + phase + '"]');
  return { ...w, hu: (k, v) => w.type('[data-k="' + k + '"]', v), verdict: () => w.text(".w-out .w-num"), more: () => w.text(".w-qmore") };
}

test("качество, артерии: ≥ 250 отлично, 200–249 годится, < 200 слабо", () => {
  for (const zone of ["aorta", "arms", "bca"])
    for (const [hu, v] of [["250", "Отлично"], ["249", "Годится"], ["200", "Годится"], ["199", "Слабо"], ["-5", "Слабо"]]) {
      const q = quality(zone); q.hu("a", hu);
      assert.equal(q.verdict(), v, zone + " " + hu);
    }
  const q = quality("aorta"); q.hu("a", "150");
  assert.match(q.more(), /Что проверить/);
});

test("качество, ТЭЛА: порог ствола 210, аорта ярче ствола — поздно", () => {
  let q = quality("pe"); q.hu("a", "210"); assert.equal(q.verdict(), "Годится");
  q = quality("pe"); q.hu("a", "209"); assert.equal(q.verdict(), "Слабо");
  q = quality("pe"); q.hu("a", "300"); q.hu("b", "350");
  assert.equal(q.verdict(), "Отлично");
  assert.match(q.more(), /Аорта ярче ствола/);
  q = quality("pe"); q.hu("a", "300"); q.hu("b", "");
  assert.doesNotMatch(q.more(), /Аорта ярче/);
});

test("качество, ноги: пустые голени при хорошей аорте — обогнали болюс", () => {
  const q = quality("legs"); q.hu("a", "320"); q.check('[data-k="shin"]');
  assert.equal(q.verdict(), "Обогнали болюс");
  assert.match(q.more(), /нужен ещё скан голеней/);
});

test("качество, живот: артериальная ≥ 280, венозная — печень ≥ 110 / ≥ 92, пёстрая селезёнка — рано", () => {
  for (const [hu, v] of [["280", "Отлично"], ["279", "Годится"], ["199", "Слабо"]]) {
    const q = quality("abd", "art"); q.hu("a", hu); assert.equal(q.verdict(), v, "арт " + hu);
  }
  for (const [hu, v] of [["110", "Отлично"], ["109", "Годится"], ["92", "Годится"], ["91", "Слабо"]]) {
    const q = quality("abd", "ven"); q.hu("a", hu); assert.equal(q.verdict(), v, "вен " + hu);
  }
  const q = quality("abd", "ven"); q.hu("a", "120"); q.check('[data-k="spleen"]');
  assert.equal(q.verdict(), "Рано");
  assert.match(q.more(), /Скан — через 60–75 с/);
});

test("качество: > 1000 HU и мусор — не оценка, а ошибка", () => {
  let q = quality("aorta"); q.hu("a", "1001"); assert.equal(q.verdict(), "?");
  q = quality("aorta"); q.hu("a", "2o0"); assert.equal(q.verdict(), "?");
  q = quality("aorta"); q.hu("a", "−50"); assert.equal(q.verdict(), "Слабо");   // типографский минус
});

test("качество, чек-листы: ничего не отмечено — хорошо, отмечено — плохо и что исправить", () => {
  let q = quality("kid", "par"); assert.equal(q.verdict(), "Хорошо");
  q.check('[data-k="two"]');
  assert.equal(q.verdict(), "Плохо");
  assert.match(q.more(), /Скан — через 80–120 с/);
  q = quality("chest", "cont"); q.check('[data-k="apex"]');
  assert.match(q.more(), /2–3 см выше ключиц/);
});
