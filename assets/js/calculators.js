(function () {
  "use strict";

  const num = v => parseFloat(String(v).replace(/[−–—]/g, "-").replace(",", "."));
  const fmt = (x, d) => x.toFixed(d).replace(".", ",");

  const PH_MM = [];                                   // поля, где в пустом поле вместо имени подсказка «мм»

  function parseAgatston(value) {
    const decimal = value.trim().replace(",", ".");
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(decimal)) return undefined;
    const [whole, fraction = ""] = decimal.split(".");
    return { units: BigInt(whole + fraction), precision: fraction.length };
  }

  function agatstonReport(scores) {
    if (scores.some(score => score === undefined)) return "";
    // Суммируем десятичные значения точно, чтобы ошибка округления не меняла категорию у порога.
    const precision = Math.max(...scores.map(score => score.precision));
    const scale = 10n ** BigInt(precision);
    const sum = scores.reduce((total, score) => total + score.units * 10n ** BigInt(precision - score.precision), 0n);
    const category = sum === 0n ? 0 : sum < 100n * scale ? 1 : sum < 300n * scale ? 2 : 3;
    const fraction = (sum % scale).toString().padStart(precision, "0").replace(/0+$/, "");
    const total = (sum / scale).toString() + (fraction ? "," + fraction : "");
    const vessels = scores.filter(score => score.units > 0n).length;
    const modifier = vessels ? "/N" + vessels : "";
    const finding = ["Коронарный кальциноз не выявлен", "Незначительный коронарный кальциноз",
      "Умеренный коронарный кальциноз", "Выраженный коронарный кальциноз"][category];
    return "Суммарный индекс Агатстона — " + total + ". " + finding + " (CAC-DRS A" + category + modifier + ").";
  }

  // Калькуляторы. Чтобы добавить свой: имя, какие поля нужны, формула и сколько знаков после запятой.
  const CALC = {
    "CAC-DRS": { inputs: ["CAC LM", "CAC LAD", "CAC LCx", "CAC RCA"], raw: true, parseInput: parseAgatston, text: agatstonReport },
    "MEYERDING": { inputs: ["Смещение"], text: percent =>
      percent <= 25 ? "I" : percent <= 50 ? "II" : percent <= 75 ? "III" : percent <= 100 ? "IV" : "V" },
    "NASCET": { inputs: ["Dмин", "Dдист"], digits: 0,
      f: (dmin, ddist) => (1 - dmin / ddist) * 100 },
    "ECST":   { inputs: ["Dмин", "Dлук"],  digits: 0,
      f: (dmin, dbulb) => (1 - dmin / dbulb) * 100 },
    "ОБЪЁМ":  { inputs: ["Длина", "Ширина", "Высота"], digits: 1,      // эллипсоид, мм → мл
      f: (a, b, c) => 0.523 * a * b * c / 1000 },
    "КТИ":    { inputs: ["Сердце", "Грудь"], digits: 0,               // кардиоторакальный индекс, %
      f: (heart, chest) => heart / chest * 100 },
    "ВЫВОД АОРТА": { inputs: ["Диаметр восходящей аорты"], uses: ["аорта"], raw: true, optional: true,
      text: ([d], tg) => tg("аорта") === 1 && Number.isFinite(d) && d > 40 ? "Расширение восходящей аорты." : "" },
    "ВЫВОД ЛЁГОЧНЫЙ СТВОЛ": { inputs: ["Диаметр лёгочного ствола"], uses: ["лёгочный ствол"], raw: true, optional: true,
      text: ([d], tg) => tg("лёгочный ствол") === 1 && Number.isFinite(d) && d > 30 ? "Косвенные признаки лёгочной гипертензии." : "" },
    "ЭВАНС":  { inputs: ["Рога", "Череп"], digits: 2,                 // индекс Эванса: передние рога / внутренний поперечник черепа
      f: (horns, skull) => horns / skull,
      // сам ставит переключатель {#желудочки: норма|расширены}: > 0,3 — второй вариант
      toggle: "желудочки", pick: x => x > 0.3 ? 1 : 0 },
    // поле называется «L1 HU», а не «L1»: иначе [L1] в «Снижение высоты тела [L1] позвонка» становилось полем плотности
    "L1 HU":  { inputs: ["L1 HU"], digits: 0,                         // плотность тела L1, HU (Pickhardt 2013)
      f: hu => hu,
      pick: x => x <= 110 ? 1 : 0,
      // Переключатель зависит от поля, даже если шаблон нигде не выводит {{L1 HU}}.
      set([hu]) { return { остеопороз: Number.isFinite(hu) && hu >= 0 ? this.pick(Math.round(hu)) : 0 }; } },
    "ADI":    { inputs: ["ADI"], digits: 1,                           // атлантодентальный интервал на КТ, мм (норма у взрослых ≤ 2 мм, Rojas 2007)
      f: adi => adi,
      toggle: "ADI", pick: x => x > 2 ? 1 : 0 }
  };

  // Планиметрическая площадь дурального мешка на уровне диска, мм² (Schönström 1985): > 100 — норма, 75–100 — относительный стеноз, < 75 — абсолютный.
  // Для каждого уровня — поле [S L4–L5] и калькулятор {{S L4–L5}}; он сам ставит {#стеноз L4–L5: |относительный|абсолютный}.
  // Стеноз ВСА по сторонам: поля [Dмин П] [Dдист П] [Dлук П] (и Л), калькуляторы {{NASCET П}}, {{ECST П}}.
  // NASCET сам ставит {#градация П: незначимый|умеренный|выраженный}: < 50% — 0, 50–69% — 1, ≥ 70% — 2.
  ["П", "Л"].forEach(side => {
    CALC["NASCET " + side] = { inputs: ["Dмин " + side, "Dдист " + side], digits: 0,
      f: (dmin, ddist) => dmin > 0 && ddist > 0 ? Math.max(0, 1 - dmin / ddist) * 100 : NaN,
      toggle: "градация " + side, pick: x => x < 50 ? 0 : x < 70 ? 1 : 2, reset: true };
    CALC["ECST " + side] = { inputs: ["Dмин " + side, "Dлук " + side], digits: 0,
      f: (dmin, dbulb) => dmin > 0 && dbulb >= dmin ? (1 - dmin / dbulb) * 100 : NaN };
  });

  // Компрессионный перелом: снижение высоты тела позвонка, % = (1 − снижённая / должная) × 100, и степень по Genant (1993):
  // < 20% — 0 (не перелом: в тексте «нельзя исключить грыжу Шморля»), 20–25% — 1, 25–40% — 2, > 40% — 3. Поля [h 1] (снижённая, мм) и [H 1] (должная: задний отдел
  // того же тела или соседний неизменённый позвонок, мм); калькуляторы {{ВЫСОТА 1}} и {{GENANT 1}}. В сборном протоколе номера 4–6 отведены поясничному отделу.
  const genant = x => x < 20 ? "0" : x <= 25 ? "1" : x <= 40 ? "2" : "3";
  const loss = (h, H) => (1 - h / H) * 100;
  [1, 2, 3, 4, 5, 6].forEach(i => {
    // < 20% — по Genant не перелом: сам ставит {#Шморль 1: перелом|нельзя исключить грыжу Шморля}
    CALC["ВЫСОТА " + i] = { inputs: ["h " + i, "H " + i], digits: 0, f: loss,
      toggle: "Шморль " + i, pick: x => x < 20 ? 1 : 0, reset: true };
    CALC["GENANT " + i] = { inputs: ["h " + i, "H " + i], text: (h, H) => h <= H ? genant(Math.round(loss(h, H))) : "" };
    PH_MM.push("h " + i, "H " + i);
  });

  ["L1–L2", "L2–L3", "L3–L4", "L4–L5", "L5–S1"].forEach(lvl => {
    CALC["S " + lvl] = { inputs: ["S " + lvl], digits: 0, f: s => s,
      toggle: "стеноз " + lvl, pick: x => x < 75 ? 2 : x <= 100 ? 1 : 0, reset: true, pickRaw: true };
  });

  // КТ-перфузия: межполушарные отношения по бассейнам. Поля [СМА CBF П] и [СМА CBF Л] (и ПМА, ЗМА; CBF, CBV, MTT),
  // калькуляторы {{СМА CBF П/Л}} и {{СМА CBF Л/П}} — в шаблоне стоят внутри переключателя {#сторона: …}, копируется видимый.
  ["ПМА", "СМА", "ЗМА"].forEach(t => ["CBF", "CBV", "MTT"].forEach(m => {
    const r = t + " " + m + " П", l = t + " " + m + " Л";
    CALC[t + " " + m + " П/Л"] = { inputs: [r, l], digits: 2, f: (a, b) => a / b };
    CALC[t + " " + m + " Л/П"] = { inputs: [l, r], digits: 2, f: (a, b) => a / b };
  }));

  // КТ-перфузия, бассейн СМА: вывод «асимметрия есть / нет» и её описание — по отношениям сторона стеноза / противоположная.
  // Порог: отношение вне 0,90–1,10 хотя бы по одному параметру (Waaijer 2007: нормальная разница право/лево ± 10%).
  const r2 = (a, b) => Math.round(a / b * 100) / 100;
  const off = x => x < 0.9 || x > 1.1;
  function perfText(cbf, cbv, mtt) {                       // отношения → «снижение CBF (0,78), удлинение MTT (1,29) без значимого изменения CBV»
    const ch = [], same = [];
    [["CBF", cbf, "снижение", "повышение"], ["CBV", cbv, "снижение", "повышение"], ["MTT", mtt, "укорочение", "удлинение"]]
      .forEach(([n, x, down, up]) => off(x) ? ch.push((x < 1 ? down : up) + " " + n + " (" + fmt(x, 2) + ")") : same.push(n));
    if (!ch.length) return "";
    return ch.join(", ") + (same.length ? " без значимого изменения " + same.join(" и ") : "");
  }
  const SMA = ["СМА CBF П", "СМА CBV П", "СМА MTT П", "СМА CBF Л", "СМА CBV Л", "СМА MTT Л"];
  const smaRatios = (v, side) => side === 0                 // 0 — стеноз справа (П/Л), 1 — слева (Л/П)
    ? [r2(v[0], v[3]), r2(v[1], v[4]), r2(v[2], v[5])]
    : [r2(v[3], v[0]), r2(v[4], v[1]), r2(v[5], v[2])];
  CALC["СМА КАРТИНА П/Л"] = { inputs: SMA, text: (...v) => perfText(...smaRatios(v, 0)) };
  CALC["СМА КАРТИНА Л/П"] = { inputs: SMA, text: (...v) => perfText(...smaRatios(v, 1)) };
  // Невидимый: сам ставит {#СМА: не введено|асимметрии нет|асимметрия}. Пересчитывается и при смене {#сторона: …}.
  CALC["СМА ВЫВОД"] = { inputs: SMA, hidden: true, uses: ["сторона"],
    set: (v, tg) => {
      if (!v.every(x => isFinite(x) && x > 0)) return { "СМА": 0 };
      return { "СМА": smaRatios(v, tg("сторона")).some(off) ? 2 : 1 };
    } };

  /* Денситометрия (DXA). Поля по областям: [T позв] [T% позв] [Z позв] [Z% позв] — и так же «шейка 1», «шейка 2», «предпл».
     «шейка 2» — контралатеральная шейка; [было …] — прошлое значение в % T- или Z-критерия (по пациенту).
     Критерий: женщина после менопаузы или мужчина ≥ 50 лет — T; женщина до менопаузы или мужчина < 50 — Z.
     Диагноз — по худшему значению среди видимых областей (Total Body не участвует):
       T ≥ −1,0 — норма; −2,5 < T < −1,0 — остеопения; T ≤ −2,5 — остеопороз; Z > −2,0 — в пределах ожидаемых, Z ≤ −2,0 — ниже.
     Сравнение с прошлым исследованием: разница T% или Z% в процентных пунктах либо изменение МПК в процентах. */
  const DXA = [   // область: поля, переключатель «есть / нет области», как назвать в тексте
    { k: "позв",    show: "поясничный отдел", where: tg => "в поясничном отделе позвоночника" },
    { k: "шейка 1", show: "шейка бедра",      where: tg => "в шейке " + (tg("бедро") ? "правой" : "левой") + " бедренной кости" },
    { k: "шейка 2", show: "контралатеральная шейка", hiddenFirst: true,
      where: tg => "в шейке " + (tg("бедро") ? "левой" : "правой") + " бедренной кости" },
    { k: "предпл",  show: "предплечье", hiddenFirst: true, where: tg => "в области " + (tg("рука") ? "правого" : "левого") + " предплечья" }
  ];
  const DXA_IN = ["Возраст"].concat(DXA.flatMap(r => ["T " + r.k, "T% " + r.k, "Z " + r.k, "Z% " + r.k, "было " + r.k, "BMD " + r.k, "BMD было " + r.k]));
  const DXA_USES = ["пол", "менопауза", "TBS", "бедро", "рука", "режим динамики", "контроль"].concat(DXA.map(r => r.show));
  const PH = { "Смещение": "__", "Возраст": "__", "FRAX осн": "%", "L1 HU": "HU", "Диаметр восходящей аорты": "__", "Диаметр лёгочного ствола": "__" };                    // подсказка в пустом поле вместо имени
  PH_MM.forEach(n => { PH[n] = "мм"; });
  DXA.forEach(r => Object.assign(PH, { ["T " + r.k]: "T", ["T% " + r.k]: "%", ["Z " + r.k]: "Z", ["Z% " + r.k]: "%", ["было " + r.k]: "%", ["BMD " + r.k]: "г/см²", ["BMD было " + r.k]: "г/см²" }));
  const r1 = x => Math.round(x * 10) / 10;                         // сравниваем с порогами по одному знаку, как в протоколе
  function dxa(v, tg) {                                             // v — значения полей в порядке DXA_IN
    const get = n => v[DXA_IN.indexOf(n)];
    const woman = tg("пол") === 0, age = get("Возраст");
    const crit = woman ? (tg("менопауза") === 0 ? "T" : "Z") : isFinite(age) ? (age >= 50 ? "T" : "Z") : null;
    const regions = DXA.filter(r => tg(r.show) === (r.hiddenFirst ? 1 : 0));   // видимые области
    return { crit, age, regions, get };
  }
  function dxaChanges({ crit, regions, get }, tg, bmdMode) {
    if (!bmdMode && !crit) return [];
    const res = [];
    regions.forEach(r => {
      let d;
      if (bmdMode) {
        const now = get("BMD " + r.k), was = get("BMD было " + r.k);
        if (!(Number.isFinite(now) && Number.isFinite(was) && now > 0 && was > 0)) return;
        d = (now - was) / was * 100;
      } else {
        const now = get(crit + "% " + r.k), was = get("было " + r.k);
        if (!Number.isFinite(now) || !Number.isFinite(was)) return;
        d = now - was;
      }
      if (Number.isFinite(d)) res.push({ d, where: r.where(tg) });
    });
    return res;
  }
  const MONTHS = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
  const inYears = n => () => { const d = new Date(); return MONTHS[d.getMonth()] + " " + (d.getFullYear() + n); };
  Object.assign(CALC, {
    // текстовые калькуляторы с raw: получают все значения (и пустые, и отрицательные) и состояние переключателей
    "КРИТЕРИЙ": { inputs: DXA_IN, raw: true, text: (v, tg) => {
      const c = dxa(v, tg).crit;
      return c ? c + "-критерий" : "введите возраст"; } },
    "ДИНАМИКА": { inputs: DXA_IN, raw: true, text: (v, tg) => {
      const research = dxa(v, tg);
      const bmdMode = tg("режим динамики") === 1;
      const changes = dxaChanges(research, tg, bmdMode);
      if (!changes.length) return "";
      const metric = bmdMode ? "МПК (BMD)" : research.crit + "%";
      const unit = bmdMode ? "%" : " п. п.";
      const amounts = changes.map(({ d, where }) => {
        const magnitude = fmt(Math.abs(d), 1).replace(/,0$/, "");
        const sign = magnitude === "0" ? "" : d < 0 ? "−" : "+";
        return where + " " + sign + magnitude + unit;
      }).join(", ");
      return metric + " " + amounts + (bmdMode ? "." : "");
    } },
    "TOTAL BMD": { inputs: ["BMC total", "Area total"], digits: 3,
      f: (bmc, area) => bmc > 0 && area > 0 ? bmc / area : NaN },
    "МИОПЕНИЯ": { inputs: ["RSMI"], hidden: true, uses: ["пол"], set: (v, tg) => {
      const rsmi = v[0];
      if (!(Number.isFinite(rsmi) && rsmi > 0)) return { "миопения": 0 };
      return { "миопения": rsmi < (tg("пол") === 0 ? 5.5 : 7.0) ? 2 : 1 };
    } },
    "ЧЕРЕЗ 1 ГОД":  { inputs: [], raw: true, text: inYears(1) },
    "ЧЕРЕЗ 2 ГОДА": { inputs: [], raw: true, text: inYears(2) },
    // невидимый: ставит {#МПК: не введено|норма|остеопения|остеопороз|в пределах ожидаемых|ниже ожидаемых},
    // {#контроль через: 1 год|2 года}, {#консультация: не введено|гериатр|эндокринолог|нет}
    "ДЕНСИТОМЕТРИЯ": { inputs: DXA_IN, hidden: true, uses: DXA_USES, set: (v, tg) => {
      const { crit, age, regions, get } = dxa(v, tg);
      const out = { "консультация": !isFinite(age) ? 0 : age >= 75 ? 1 : 2 };
      const vals = crit ? regions.map(r => get(crit + " " + r.k)).filter(isFinite).map(r1) : [];
      if (!vals.length) Object.assign(out, { "МПК": 0, "контроль через": 0 });
      else {
        const w = Math.min(...vals);
        const dx = crit === "T" ? (w >= -1 ? 1 : w > -2.5 ? 2 : 3) : (w > -2 ? 4 : 5);
        Object.assign(out, { "МПК": dx, "контроль через": dx === 1 || dx === 4 ? 1 : 0 });
        if (dx === 1 || dx === 4) out["консультация"] = 3;          // норма — консультацию не пишем
      }
      return out;
    } },
    // TBS у всех в протоколе; интерпретация в заключении — женщины после менопаузы и мужчины > 50 лет,
    // только если значение TBS введено. Критерий T/Z для МПК определяется независимо (мужчины ≥ 50 лет).
    "TBS ИНТЕРПРЕТАЦИЯ": { inputs: ["TBS", "Возраст"], hidden: true, uses: ["пол", "менопауза"], set: (v, tg) => {
      const [tbs, age] = v;
      const eligible = tg("пол") === 0 ? tg("менопауза") === 0 : Number.isFinite(age) && age > 50;
      return { "TBS интерпретация": eligible && Number.isFinite(tbs) && tbs > 0 ? 1 : 0 };
    } },
    // TBS L1–L4: > 1,35 — норма; 1,20 < TBS ≤ 1,35 — частичное нарушение; ≤ 1,20 — полное. Ставит {#TBS вывод: не введено|…}
    "TBS ВЫВОД": { inputs: ["TBS"], hidden: true, set: v => {
      const x = v[0];
      return { "TBS вывод": !(isFinite(x) && x > 0) ? 0 : x > 1.35 ? 1 : x > 1.2 ? 2 : 3 };
    } },
    // FRAX: 10-летняя вероятность основных остеопоротических переломов против российского возрастного порога.
    // Пишет «ниже точки терапевтического вмешательства для возраста 74 лет» (сам порог в заключение не идёт). Для бедра порога в КР нет — не интерпретируем.
    "FRAX ВЫВОД": { inputs: ["Возраст", "FRAX осн"], raw: true, text: v => fraxText(v[0], v[1]) },
    // невидимый: вне 40–90 лет таблицы КР нет — строку FRAX из заключения убираем: {#FRAX возраст: строка|}
    "FRAX ВОЗРАСТ": { inputs: ["Возраст"], hidden: true, set: v => {
      const a = Math.floor(v[0]);
      return { "FRAX вне 40–90 лет": isFinite(a) && (a < 40 || a > 90) ? 1 : 0 };
    } }
  });

  /* Точка терапевтического вмешательства FRAX для РФ, % (основные остеопоротические переломы), по возрасту 40–90 лет.
     КР «Остеопороз» МЗ РФ, таблица точек вмешательства (Лесняк О.М. и др., модель FRAX для России).
     Порог = вероятность у женщины того же возраста с низкотравматичным переломом в анамнезе, ИМТ 24, без других факторов риска.
     После 81 года порог снижается: конкурирующая смертность. Младше 40 и старше 90 — в заключении строки нет. */
  const FRAX_IT = [10.75, 11.05, 11.34, 11.61, 11.9, 12.2, 12.5, 12.79, 13.07, 13.35,       // 40–49
    13.61, 13.89, 14.14, 14.43, 14.73, 15.03, 15.34, 15.69, 16.02, 16.39,                    // 50–59
    16.77, 17.03, 17.32, 17.56, 17.79, 18.04, 18.28, 18.55, 18.81, 19.09,                    // 60–69
    19.3, 19.69, 20.16, 20.69, 21.2, 21.71, 22.07, 22.4, 22.73, 22.84,                       // 70–79
    22.85, 22.9, 22.74, 22.37, 21.84, 21.11, 20.36, 19.32, 18.08, 16.84,                     // 80–89
    15.73];                                                                                  // 90
  const yearsGen = n => n % 10 === 1 && n % 100 !== 11 ? "года" : "лет";   // «для возраста 71 года», «74 лет»
  function fraxText(age, x) {
    if (!isFinite(x) || x < 0) return "";
    if (!isFinite(age)) return "введите возраст";
    const a = Math.floor(age);
    if (a < 40 || a > 90) return "";
    const it = r1(FRAX_IT[a - 40]), ages = a + " " + yearsGen(a);
    const xr = r1(x), where = xr > it ? "выше" : xr < it ? "ниже" : "на уровне";
    return where + " точки терапевтического вмешательства для возраста " + ages;
  }

  window.RH_CALCULATORS = { CALC, DXA, PH, num, fmt };
})();
