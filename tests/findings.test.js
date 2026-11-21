/* Находки (tools/*.md через assets/js/findings.js): какой вывод получит врач при заданных признаках.
   Пороги — по источникам из самих файлов: ACR/ESE (надпочечник), LI-RADS v2018 / ACR (печень), Fleischner 2017 (лёгкое). */
const test = require("node:test");
const assert = require("node:assert/strict");
const { openSite, read } = require("./env");

let F;
test.before(async () => { F = (await openSite()).RH_FINDINGS; });

// как в интерфейсе: кнопки — первый вариант по умолчанию, поля — пусто; дальше — что «нажал» тест
function verdict(file, set) {
  const tool = F.parse(read("tools/" + file).replace(/\r/g, "").split("\n---\n").slice(1).join("\n---\n"));
  const state = {};
  tool.params.forEach(p => { state[p.id] = p.kind === "pick" ? p.options[0] : ""; });
  for (const [k, v] of Object.entries(set)) {
    const p = tool.params.find(x => x.id === k);
    assert.ok(p, file + ": нет параметра " + k);
    if (p.kind === "pick") assert.ok(p.options.includes(v), file + ": у " + k + " нет варианта «" + v + "»");
    state[k] = String(v);
  }
  const v = F.values(tool, state, F.visible(tool, state));
  const rule = tool.rules.find(r => F.test(r.cond, v));
  return { text: rule ? rule.text : "", v };
}

/* ---------- Надпочечник ---------- */
const adr = s => verdict("adrenal-mass.md", s).text;

test("надпочечник: ≤ 10 HU однородное — аденома", () => {
  assert.match(adr({ size: 25, hu: 10 }), /Аденома, богатая липидами/);
  assert.match(adr({ size: 25, hu: 10, look: "неоднородное" }), /≤ 10 HU, но неоднородное/);
});

test("надпочечник: вымывание — абсолютное ≥ 60% или относительное ≥ 40%", () => {
  const r = verdict("adrenal-mass.md", { size: 25, hu: 20, pv: 120, del: 60 });
  assert.equal(Math.round(r.v.apw), 60);                             // (120 − 60) / (120 − 20)
  assert.match(r.text, /Аденома по вымыванию/);
  assert.match(adr({ size: 25, hu: 30, pv: 100, del: 60 }), /Аденома по вымыванию/);      // абс. 57%, отн. 40%
  assert.match(adr({ size: 25, hu: 30, pv: 100, del: 61 }), /Не аденома по вымыванию/);   // абс. 56%, отн. 39%
});

test("надпочечник: без вымывания — по плотности и размеру", () => {
  assert.match(adr({ size: 25, hu: 25 }), /> 20 HU — неопределённое/);
  assert.match(adr({ size: 25, hu: 15 }), /11–20 HU, однородное/);
  assert.match(adr({ size: 8, hu: 30 }), /< 1 см/);
  assert.match(adr({ size: 45, hu: 30 }), /≥ 4 см\./);
  assert.match(adr({ size: 45, hu: 30, onco: "есть" }), /≥ 4 см, есть онкоанамнез/);
  assert.match(adr({}), /Введите размер и нативную плотность/);
});

test("надпочечник: жир, киста, кровоизлияние, рост — раньше цифр", () => {
  assert.match(adr({ size: 50, hu: 40, inside: "макроскопический жир" }), /Миелолипома/);
  assert.match(adr({ size: 30, hu: 30, prior: "растёт", onco: "есть" }), /Растёт, есть онкоанамнез/);
  assert.match(adr({ size: 30, hu: 30, prior: "стабильно ≥ 1 года" }), /Стабильно ≥ 1 года/);
});

/* ---------- Печень, LI-RADS v2018 (группа риска) ---------- */
const lr = s => verdict("liver-mass.md", { risk: "да", ...s }).text;
const HYPER = "гиперваскуляризация", NO = "нет гиперваскуляризации";

test("LI-RADS: диагностическая таблица, без APHE", () => {
  assert.match(lr({ aphe: NO, size: 15 }), /^\*\*LR-3/);
  assert.match(lr({ aphe: NO, size: 15, wash: "есть" }), /^\*\*LR-3/);
  assert.match(lr({ aphe: NO, size: 15, wash: "есть", caps: "есть" }), /^\*\*LR-4/);
  assert.match(lr({ aphe: NO, size: 25 }), /^\*\*LR-3/);
  assert.match(lr({ aphe: NO, size: 25, caps: "есть" }), /^\*\*LR-4/);
  assert.match(lr({ aphe: NO, size: 25, wash: "есть", caps: "есть" }), /^\*\*LR-4/);
});

test("LI-RADS: диагностическая таблица, APHE", () => {
  assert.match(lr({ aphe: HYPER, size: 8 }), /^\*\*LR-3/);
  assert.match(lr({ aphe: HYPER, size: 8, wash: "есть" }), /^\*\*LR-4/);
  assert.match(lr({ aphe: HYPER, size: 8, wash: "есть", caps: "есть" }), /^\*\*LR-4/);
  assert.match(lr({ aphe: HYPER, size: 15 }), /^\*\*LR-3/);
  assert.match(lr({ aphe: HYPER, size: 15, caps: "есть" }), /^\*\*LR-4/);       // одна «капсула» — LR-4
  assert.match(lr({ aphe: HYPER, size: 15, wash: "есть" }), /^\*\*LR-5/);       // «вымывание» — LR-5
  assert.match(lr({ aphe: HYPER, size: 15, growth: "есть" }), /^\*\*LR-5/);     // пороговый рост — LR-5
  assert.match(lr({ aphe: HYPER, size: 15, caps: "есть", growth: "есть" }), /^\*\*LR-5/);
  assert.match(lr({ aphe: HYPER, size: 25 }), /^\*\*LR-4/);
  assert.match(lr({ aphe: HYPER, size: 25, caps: "есть" }), /^\*\*LR-5/);
});

test("LI-RADS: вспомогательные признаки — ±1, но не выше LR-4", () => {
  assert.match(lr({ aphe: HYPER, size: 15, af: "за злокачественность" }), /^\*\*LR-4/);
  assert.match(lr({ aphe: HYPER, size: 25, af: "за злокачественность" }), /^\*\*LR-4/);  // с LR-4 до LR-5 не поднимают
  assert.match(lr({ aphe: HYPER, size: 25, caps: "есть", af: "за доброкачественность" }), /^\*\*LR-4/);
  assert.match(lr({ aphe: HYPER, size: 15, af: "в обе стороны" }), /^\*\*LR-3/);
});

test("LI-RADS: LR-M, LR-TIV, LR-NC, доброкачественные", () => {
  assert.match(lr({ aphe: "ободковая (rim)", size: 25 }), /^\*\*LR-M/);
  assert.match(lr({ lrm: "мишеневидное", aphe: HYPER, size: 25, caps: "есть" }), /^\*\*LR-M/);
  assert.match(lr({ tiv: "да", size: 25 }), /^\*\*LR-TIV/);
  assert.match(lr({ nc: "нет (артефакты, нет фаз)" }), /^\*\*LR-NC/);
  assert.match(lr({ benign: "киста", sure: "определённо" }), /^\*\*LR-1/);
  assert.match(lr({ benign: "гемангиома", sure: "вероятно" }), /^\*\*LR-2/);
  assert.match(lr({ benign: "ФНГ (типичная)" }), /^\*\*LR-3/);
});

/* ---------- Печень, ACR (не группа риска) ---------- */
const acr = s => verdict("liver-mass.md", { risk: "нет", ...s }).text;

test("печень ACR: < 1 см по риску, ≥ 1 см по признакам", () => {
  assert.match(acr({ size: 8 }), /< 1 см, низкий риск — доброкачественное/);
  assert.match(acr({ size: 8, onco: "есть" }), /< 1 см, высокий риск/);
  assert.match(acr({ size: 20, feat: "подозрительные" }), /≥ 1 см, подозрительное/);
  assert.match(acr({ size: 20, feat: "подозрительные", liv: "есть" }), /> 1,5 см, подозрительное, высокий риск/);
  assert.match(acr({ size: 20, excl: "есть" }), /Вне алгоритма ACR/);
});

/* ---------- Лёгкое, Fleischner 2017 ---------- */
const fl = s => verdict("lung-nodule.md", s).text;

test("Fleischner: солидный узел — < 6, 6–8, > 8 мм", () => {
  assert.match(fl({ size: 5 }), /Солидный < 6 мм, низкий риск/);
  assert.match(fl({ size: 5, risk: "высокий" }), /Солидный < 6 мм, высокий риск/);
  assert.match(fl({ size: 6 }), /Солидный 6–8 мм, одиночный, низкий риск/);
  assert.match(fl({ size: 8 }), /Солидный 6–8 мм, одиночный, низкий риск/);
  assert.match(fl({ size: 9 }), /Солидный > 8 мм/);
  assert.match(fl({ size: 7, num: "множественные", risk: "высокий" }), /Солидные 6–8 мм, множественные, высокий риск/);
});

test("Fleischner: субсолидные", () => {
  assert.match(fl({ type: "«матовое стекло»", size: 5 }), /«Матовое стекло» < 6 мм/);
  assert.match(fl({ type: "«матовое стекло»", size: 6 }), /«Матовое стекло» ≥ 6 мм/);
  assert.match(fl({ type: "частично солидный", size: 8, solid: 6 }), /высоко подозрителен/);
  assert.match(fl({ type: "частично солидный", size: 8, solid: 4 }), /Частично солидный ≥ 6 мм\./);
});

test("надпочечник: портальная не выше нативной — подсказка «накопления нет» (раньше не срабатывала)", () => {
  const tool = F.parse(read("tools/adrenal-mass.md").replace(/\r/g, "").split("\n---\n").slice(1).join("\n---\n"));
  const notes = s => {
    const state = {};
    tool.params.forEach(p => { state[p.id] = p.kind === "pick" ? p.options[0] : ""; });
    Object.assign(state, s);
    const v = F.values(tool, state, F.visible(tool, state));
    return tool.notes.filter(r => F.test(r.cond, v)).map(r => r.text).join(" | ");
  };
  assert.match(notes({ size: "30", hu: "30", pv: "25" }), /накопления нет/);
  assert.match(notes({ size: "30", hu: "30", pv: "30" }), /накопления нет/);
  assert.doesNotMatch(notes({ size: "30", hu: "30", pv: "80" }), /накопления нет/);
  assert.doesNotMatch(notes({ size: "30", pv: "25" }), /накопления нет/);       // нативной нет — не знаем
});

test("Fleischner: не применяется при скрининге и у онкобольных, доброкачественные признаки важнее размера", () => {
  assert.match(fl({ excl: "скрининг рака лёгкого", size: 12 }), /Lung-RADS/);
  assert.match(fl({ excl: "известный онкопроцесс", size: 12 }), /Fleischner не применяется/);
  assert.match(fl({ benign: "перифиссуральный (внутрилёгочный лимфоузел)", size: 12 }), /Перифиссуральный/);
});
