/* Виджеты — маленькие интерактивные калькуляторы внутри карточек ru/*.md.
   В карточке пишется отдельной строкой:  Виджет: имя
   Движок (index.html) ставит на это место пустой блок и вызывает RH_WIDGETS[имя](блок). */
window.RH_WIDGETS = window.RH_WIDGETS || {};

/* Объём контраста для лаборанта.
   Не ангиография: 300 — вес × 1,6; 320 — × 1,5; 350 — × 1,4; 370 — × 1,3; 400 — × 1,2 (≈ 480 мг йода/кг);
     до целого мл; не больше 150 мл.
   Ангиография: зоны и их правила — в таблице ZONES ниже. Физраствор всегда 50 мл с той же скоростью.
     Объёмы в ZONES — для концентрации REF (350). Другая концентрация — объём × REF / концентрация
     (та же доза йода). Ниже минимума зоны (minC) — предупреждение: скорость упирается в потолок, йода в секунду меньше.
   Концентрация выбирается один раз над вкладками и действует на обе. */
RH_WIDGETS["contrast-volume"] = function (el) {
  const MAX = 150;                                   // мл, потолок для любого веса
  const K = { 300: 1.6, 320: 1.5, 350: 1.4, 370: 1.3, 400: 1.2 };  // ≈ 480 мг йода на кг для любой концентрации

  /* ---------- Ангиография: правила по зонам (правьте цифры здесь) ----------
     lin(x, x1, x2, y1, y2): прямая через точки (x1; y1) и (x2; y2), за краями — крайние значения.
     ml / flow — функции от {kg, cm}; need — какие поля нужны: "kg", "cm", "kg|cm" (хотя бы одно), "" (ничего). */
  const SALINE = 50;      // мл физраствора после контраста
  const FLOW_MAX = 4.5;   // мл/с, больше вены пожилых не держат
  const REF = 350;        // мг йода/мл — для этой концентрации записаны объёмы в ZONES
  const ZONES = [
    { id: "bca",   name: "БЦА",  need: "kg",
      ml: p => lin(p.kg, 60, 100, 50, 70),                 // 60 кг → 50 мл, 100 кг → 70 мл
      flow: () => FLOW_MAX, minC: 320 },
    { id: "pe",    name: "ТЭЛА", need: "",
      ml: () => 50, mlText: "1 флакон 50 мл", mlHint: "в шприце 47–48 мл — это нормально",
      fixed: true,                                         // флакон 50 мл при 350 и выше — не пересчитываем
      flow: () => FLOW_MAX },
    { id: "aorta-part", name: "Грудная или брюшная аорта", need: "kg",
      ml: p => lin(p.kg, 60, 100, 80, 100),                // 60 кг → 80 мл, 100 кг → 100 мл
      flow: () => FLOW_MAX },
    { id: "aorta-full", name: "Вся аорта", need: "kg|cm",
      // рост — длина скана, вес — сколько нужно йода; есть оба — среднее
      ml: p => {
        const v = [];
        if (p.cm) v.push(lin(p.cm, 160, 190, 100, 150));   // 160 см → 100 мл, 190 см → 150 мл
        if (p.kg) v.push(lin(p.kg, 60, 100, 100, 150));    // 60 кг → 100 мл, 100 кг → 150 мл
        return v.reduce((a, b) => a + b, 0) / v.length;
      },
      flow: () => FLOW_MAX },
    { id: "arms",  name: "Руки", need: "",
      ml: () => 80, flow: () => FLOW_MAX,
      warn: "Катетер — в руку, которую НЕ исследуют." },
    { id: "legs",  name: "Ноги", need: "kg",
      ml: p => lin(p.kg, 55, 130, 80, 140),                // 55 кг → 80 мл, 130 кг → 140 мл
      flow: p => lin(p.kg, 55, 130, 3.0, 4.2) },           // 55 кг → 3,0 мл/с, 130 кг → 4,2 мл/с
  ];
  function lin(x, x1, x2, y1, y2) {
    const t = Math.min(1, Math.max(0, (x - x1) / (x2 - x1)));
    return y1 + t * (y2 - y1);
  }
  const fmt = n => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");   // 4.5 → «4,5», 3 → «3,0»

  let mode = "plain", conc = null, zone = null;

  const field = (id, label, ph) =>
    '<div class="w-field" data-f="' + id + '">' +
      '<label class="w-label" for="' + id + '">' + label + "</label>" +
      '<input id="' + id + '" class="w-input" type="text" inputmode="decimal" autocomplete="off" placeholder="' + ph + '">' +
    "</div>";

  el.innerHTML =
    '<div class="w-label">Концентрация контраста, мг йода/мл</div>' +
    '<div class="picks w-conc">' +
      Object.keys(K).map(c => '<button type="button" class="pick" data-c="' + c + '" aria-pressed="false">' + c + "</button>").join("") +
    "</div>" +
    '<div class="tabs w-mode" role="tablist">' +
      '<button type="button" class="tab" role="tab" data-mode="plain" aria-selected="true">Не ангиография</button>' +
      '<button type="button" class="tab" role="tab" data-mode="angio" aria-selected="false">Ангиография</button>' +
    "</div>" +
    // --- не ангиография ---
    '<div class="w-pane" data-pane="plain">' +
      field("w-weight", "Вес пациента, кг", "например, 70") +
      '<div class="w-out" aria-live="polite"></div>' +
      '<div class="w-rule">Вес × коэффициент: 300 → 1,6 · 320 → 1,5 · 350 → 1,4 · 370 → 1,3 · 400 → 1,2. Не больше ' + MAX + " мл</div>" +
    "</div>" +
    // --- ангиография ---
    '<div class="w-pane" data-pane="angio" hidden>' +
      '<div class="w-label">Что исследуем</div>' +
      '<div class="picks w-zone">' +
        ZONES.map(z => '<button type="button" class="pick" data-z="' + z.id + '" aria-pressed="false">' + z.name + "</button>").join("") +
      "</div>" +
      field("w-a-weight", "Вес пациента, кг", "например, 70") +
      field("w-a-height", "Рост пациента, см", "например, 170") +
      '<div class="w-field-note" hidden>Можно ввести только рост или только вес — посчитаем по тому, что есть.</div>' +
      '<div class="w-out w-a-out" aria-live="polite"></div>' +
      '<div class="w-a-more"></div>' +
    "</div>";

  const $ = s => el.querySelector(s);
  const wPlain = $("#w-weight"), wA = $("#w-a-weight"), hA = $("#w-a-height");
  const outPlain = $('[data-pane="plain"] .w-out'), outA = $(".w-a-out"), moreA = $(".w-a-more");

  // «70», «70,5», «70.5» → число; пусто → null; мусор → NaN
  function num(input) {
    const raw = input.value.trim().replace(",", ".");
    if (!raw) return null;
    return /^\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : NaN;
  }
  const okKg = kg => kg >= 20 && kg <= 300;
  const okCm = cm => cm >= 120 && cm <= 220;
  const empty = (out, hint) => { out.className = out.className.replace(/\s*bad/g, ""); out.innerHTML = '<span class="w-num">—</span><span class="w-hint">' + hint + "</span>"; };
  const bad = (out, msg) => { out.classList.add("bad"); out.innerHTML = '<span class="w-hint">' + msg + "</span>"; };

  /* ---------- не ангиография ---------- */
  function showPlain() {
    outPlain.classList.remove("bad");
    const kg = num(wPlain);
    if (!conc) return empty(outPlain, "выберите концентрацию");
    if (kg === null) return empty(outPlain, "введите вес");
    if (!okKg(kg)) return bad(outPlain, "Проверьте вес: нужно число от 20 до 300 кг");
    const ml = Math.round(kg * K[conc]);
    outPlain.innerHTML = ml > MAX
      ? '<span class="w-num">' + MAX + ' мл</span><span class="w-hint">максимум</span>'
      : '<span class="w-num">' + ml + " мл</span>";
  }

  /* ---------- ангиография ---------- */
  function showAngio() {
    const z = ZONES.find(x => x.id === zone);
    const needKg = z && /kg/.test(z.need), needCm = z && /cm/.test(z.need), either = z && z.need === "kg|cm";
    el.querySelector('[data-f="w-a-weight"]').hidden = !needKg;
    el.querySelector('[data-f="w-a-height"]').hidden = !needCm;
    $(".w-field-note").hidden = !either;
    outA.classList.remove("bad");
    moreA.innerHTML = "";
    if (!conc) return empty(outA, "выберите концентрацию");
    if (!z) return empty(outA, "выберите, что исследуем");

    const kg = needKg ? num(wA) : null, cm = needCm ? num(hA) : null;
    if (Number.isNaN(kg) || (kg !== null && !okKg(kg))) return bad(outA, "Проверьте вес: нужно число от 20 до 300 кг");
    if (Number.isNaN(cm) || (cm !== null && !okCm(cm))) return bad(outA, "Проверьте рост: нужно число от 120 до 220 см");
    if (either ? (kg === null && cm === null) : (needKg && kg === null)) return empty(outA, either ? "введите рост или вес" : "введите вес");

    const p = { kg, cm };
    const c = +conc, minC = z.minC || REF;
    const keep = z.fixed && c >= REF;                       // ТЭЛА: флакон 50 мл при 350+
    const raw = keep ? z.ml(p) : z.ml(p) * REF / c;         // та же доза йода, что при 350
    const ml = Math.min(MAX, Math.round(raw));
    const capped = Math.round(raw) > MAX;
    const flow = Math.min(FLOW_MAX, z.flow(p));
    outA.innerHTML = '<span class="w-num">' + (keep && z.mlText ? z.mlText : ml + " мл") + "</span>" +
      (keep && z.mlHint ? '<span class="w-hint">' + z.mlHint + "</span>"
        : capped ? '<span class="w-hint">максимум</span>' : "");
    moreA.innerHTML =
      '<div class="w-line"><b>Скорость: ' + fmt(flow) + " мл/с</b></div>" +
      '<div class="w-line">Физраствор: ' + SALINE + " мл, " + fmt(flow) + " мл/с</div>" +
      (c < minC ? '<div class="w-warn">Для «' + z.name + '» нужна концентрация от ' + minC +
        ". С " + c + " контраст будет слабее даже с пересчитанным объёмом — сообщите врачу до введения.</div>" : "") +
      (z.warn ? '<div class="w-warn">' + z.warn + "</div>" : "") +
      '<div class="w-rule">Подходит: ' + (z.minC ? z.minC + "–370" : "350 и выше") +
        (keep ? "." : ". Объём пересчитан на " + c + " (база — " + REF + ").") +
        " Катетер в кисти или вена сомнительная — сообщите врачу до введения.</div>";
  }

  /* ---------- переключатели ---------- */
  el.querySelectorAll(".w-mode .tab").forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    el.querySelectorAll(".w-mode .tab").forEach(x => x.setAttribute("aria-selected", x === b));
    el.querySelectorAll(".w-pane").forEach(p => { p.hidden = p.dataset.pane !== mode; });
  }));
  el.querySelectorAll(".w-conc .pick").forEach(b => b.addEventListener("click", () => {
    conc = b.dataset.c;
    el.querySelectorAll(".w-conc .pick").forEach(x => x.setAttribute("aria-pressed", x === b));
    showPlain();
    showAngio();
  }));
  el.querySelectorAll(".w-zone .pick").forEach(b => b.addEventListener("click", () => {
    zone = b.dataset.z;
    el.querySelectorAll(".w-zone .pick").forEach(x => x.setAttribute("aria-pressed", x === b));
    showAngio();
  }));
  wPlain.addEventListener("input", showPlain);
  wA.addEventListener("input", showAngio);
  hA.addEventListener("input", showAngio);
  showPlain();
  showAngio();
};

/* Доза КТ по DLP — МУ 2.6.1.3584-19 (изменения в МУ 2.6.1.2944-11), таблица 6.1, взрослые.
   E = Σ DLPᵢ × kᵢ (формула 6.7): каждое сканирование — своя строка.
   Лаборант выбирает не анатомическую область, а исследование (STUDIES) — сайт сам берёт область из таблицы МУ (REGIONS).
   Позвоночника в таблице МУ нет — отдел позвоночника считается по области, которую покрывает скан:
   шейный — шея, грудной — грудная клетка, поясничный — брюшная полость, грудной + поясничный — грудь + живот.
   Фантом (Head 16 / Body 32) указан в протоколе дозы аппарата и должен совпадать с подписью области.
   Для КТА ног с захватом аорты и таза в таблице МУ готового коэффициента нет:
   используем ориентировочный k=0,0062 из Saltybaeva et al., Radiology 2014 (PMID 24937693).
   Для КТ кисти k=0,00022 по Radiation Exposure in Patients with Isolated Limb Trauma, 2020 (PMCID 7696613).
   Эти два коэффициента являются литературной оценкой, не нормативным расчётом по таблице 6.1 МУ. */
RH_WIDGETS["dose-dlp"] = function (el) {
  const REGIONS = {                                    // таблица 6.1 МУ: область → коэффициент, мЗв/(мГр·см)
    head:       { name: "голова",                  ph: "Head 16", k: 0.0014,  t: "0,0014" },
    neck:       { name: "шея",                     ph: "Head 16", k: 0.0060,  t: "0,0060" },
    headneck:   { name: "голова + шея",            ph: "Head 16", k: 0.0025,  t: "0,0025" },
    chest:      { name: "грудная клетка",          ph: "Body 32", k: 0.012,   t: "0,012" },
    abd:        { name: "брюшная полость",         ph: "Body 32", k: 0.014,   t: "0,014" },
    pelvis:     { name: "таз",                     ph: "Body 32", k: 0.015,   t: "0,015" },
    chabd:      { name: "грудь + живот",           ph: "Body 32", k: 0.013,   t: "0,013" },
    abdpel:     { name: "живот + таз",             ph: "Body 32", k: 0.015,   t: "0,015" },
    chabdpel:   { name: "грудь + живот + таз",     ph: "Body 32", k: 0.014,   t: "0,014" },
    // Коэффициент МУ применим только при облучении собственно нижних конечностей.
    legs:       { name: "нижние конечности",       ph: "Body 32", k: 0.00020, t: "0,00020",
                  note: "Коэффициент 0,00020 относится ТОЛЬКО к нижним конечностям без захвата живота и таза." },
    // В МУ 2.6.1.2944-11 (табл. 6.1) нет k для протяжённой КТА «аорта + таз + ноги».
    ctaLegs:    { name: "аорта + таз + ноги",       ph: "Body 32", k: 0.0062,  t: "0,0062",
                  note: "Ориентировочная оценка для КТА нижних конечностей с захватом аорты и таза (Saltybaeva et al., 2014). Это НЕ коэффициент таблицы 6.1 МУ. При ином охвате сканирования число может быть неверным." },
    hand:       { name: "кисть / запястье",        ph: "Body 32", k: 0.00022, t: "0,00022",
                  note: "Для кисти/запястья k=0,00022 взят из клинической литературы (2020), в таблице 6.1 МУ верхние конечности отсутствуют. Это ориентировочная оценка." },
    whole:      { name: "всё тело",                ph: "Body 32", k: 0.017,   t: "0,017" },
  };
  const STUDIES = [                                    // [группа, [исследование, область]]
    ["Голова и шея", [
      ["Головной мозг", "head"], ["КТ-перфузия головного мозга", "head"], ["Пазухи носа", "head"],
      ["Височные кости", "head"], ["Шея", "neck"], ["КТА БЦА", "neck"], ["Голова + шея одним сканом", "headneck"]]],
    ["Позвоночник", [
      ["Шейный отдел", "neck"], ["Грудной отдел", "chest"], ["Поясничный отдел", "abd"],
      ["Грудной + поясничный", "chabd"]]],
    ["Грудь", [
      ["ОГК (лёгкие)", "chest"], ["КТА ТЭЛА", "chest"], ["КТА грудной аорты", "chest"]]],
    ["Живот и таз", [
      ["Брюшная полость", "abd"], ["Почки, в т. ч. нативно", "abd"], ["Почки + мочевой пузырь, писография", "abdpel"],
      ["КТА брюшной аорты", "abd"], ["Таз", "pelvis"], ["Живот + таз", "abdpel"]]],
    ["КТА нижних конечностей", [
      ["МСКТ АГ нижних конечностей (от аорты до стоп)", "ctaLegs"],
      ["МСКТ АГ нижних конечностей (только ноги)", "legs"]]],
    ["КТ суставов конечностей", [
      ["КТ кисти / запястья", "hand"],
      ["КТ голеностопного сустава", "legs"],
      ["КТ стопы", "legs"]]],
    ["Несколько областей одним сканом", [
      ["Грудь + живот", "chabd"], ["Грудь + живот + таз", "chabdpel"], ["Вся аорта (грудная + брюшная)", "chabdpel"],
      ["Всё тело", "whole"]]],
  ];
  const ALL = STUDIES.flatMap(([g, list]) => list.map(([name, r]) => ({ id: g + "|" + name, name, r: REGIONS[r] })));
  const SRC = "https://sudact.ru/law/mu-2612944-11-261-ioniziruiushchee-izluchenie-radiatsionnaia-bezopasnost/metodicheskie-ukazaniia/6/tablitsa-6.1/";
  const SRC_CTA = "https://pubmed.ncbi.nlm.nih.gov/24937693/";
  const SRC_HAND = "https://www.mdpi.com/2077-0383/9/11/3609";
  const dec = (n, d) => n.toFixed(d).replace(".", ",");
  // Для дистальных конечностей 0,00 мЗв было бы ложным нулём.
  const decDose = n => dec(n, n < 0.001 ? 4 : n < 0.1 ? 3 : 2);
  const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  el.innerHTML =
    '<div class="w-label">Каждое сканирование из протокола дозы — отдельной строкой: исследование и его DLP</div>' +
    '<div class="w-rows"></div>' +
    '<button type="button" class="pick w-add">+ ещё сканирование</button>' +
    '<div class="w-out" aria-live="polite"></div>' +
    '<div class="w-a-more w-sum"></div>' +
    '<div class="w-rule">Фантом в скобках должен совпадать с протоколом дозы на аппарате (Head 16 / Body 32). ' +
      'Не совпадает — эта таблица не подходит, сообщите врачу. ' +
      'Позвоночника в таблице МУ нет — отдел считается по области, которую захватывает скан.<br>' +
      'Основной источник: <a href="' + SRC + '" target="_blank" rel="noopener">МУ 2.6.1.2944-11 (ред. 2019), таблица 6.1, взрослые</a>. ' +
      'Для КТА ног с захватом аорты и таза и для кисти в МУ нет отдельного коэффициента: ' +
      '<a href="' + SRC_CTA + '" target="_blank" rel="noopener">КТА ног (Radiology, 2014)</a>, ' +
      '<a href="' + SRC_HAND + '" target="_blank" rel="noopener">КТ кисти (J. Clin. Med., 2020)</a>. ' +
      'Эти значения — ориентировочная оценка эффективной дозы, а не нормативный коэффициент МУ.</div>';

  const rows = el.querySelector(".w-rows"), out = el.querySelector(".w-out"), sum = el.querySelector(".w-sum");
  let n = 0;

  function addRow() {
    const id = "w-dlp-" + (++n);
    const r = document.createElement("div");
    r.className = "w-row";
    r.innerHTML =
      '<select class="w-input w-sel" aria-label="Исследование">' +
        '<option value="">Что сканировали…</option>' +
        STUDIES.map(([g, list]) => '<optgroup label="' + esc(g) + '">' +
          list.map(([name, r]) => '<option value="' + esc(g + "|" + name) + '">' + esc(name) + " (" + REGIONS[r].ph + ")</option>").join("") +
          "</optgroup>").join("") +
      "</select>" +
      '<input id="' + id + '" class="w-input w-dlp" type="text" inputmode="decimal" autocomplete="off" placeholder="DLP" aria-label="DLP, мГр·см">' +
      '<span class="w-unit">мГр·см</span>' +
      '<button type="button" class="w-del" aria-label="Убрать строку">×</button>';
    r.querySelector(".w-sel").addEventListener("change", show);
    r.querySelector(".w-dlp").addEventListener("input", show);
    r.querySelector(".w-del").addEventListener("click", () => { r.remove(); show(); });
    rows.appendChild(r);
    show();
  }

  function show() {
    const list = Array.from(rows.querySelectorAll(".w-row"));
    list.forEach(r => { r.querySelector(".w-del").hidden = list.length < 2; });
    out.classList.remove("bad");
    sum.innerHTML = "";
    let total = 0, used = [], notices = new Set(), err = "";
    list.forEach(r => {
      const st = ALL.find(x => x.id === r.querySelector(".w-sel").value), reg = st && st.r;
      const raw = r.querySelector(".w-dlp").value.trim().replace(",", ".");
      if (!reg && !raw) return;                                        // пустая строка — пропускаем
      if (!reg) { err = err || "выберите исследование"; return; }
      if (!raw) { err = err || "введите DLP"; return; }
      if (!/^\d+(\.\d+)?$/.test(raw) || +raw <= 0 || +raw > 20000) { err = "Проверьте DLP: нужно число в мГр·см"; return; }
      const e = +raw * reg.k;
      total += e;
      used.push(st.name + " → " + reg.name + ": " + dec(+raw, raw.includes(".") ? 1 : 0) + " × " + reg.t + " = " + decDose(e) + " мЗв");
      if (reg.note) notices.add(reg.note);
    });
    if (err === "Проверьте DLP: нужно число в мГр·см") { out.classList.add("bad"); out.innerHTML = '<span class="w-hint">' + err + "</span>"; return; }
    if (!used.length || err) { out.innerHTML = '<span class="w-num">—</span><span class="w-hint">' + (err || "выберите исследование и введите DLP") + "</span>"; return; }
    out.innerHTML = '<span class="w-num">' + decDose(total) + " мЗв</span>";
    sum.innerHTML = used.map(t => '<div class="w-line w-small">' + t + "</div>").join("") +
      Array.from(notices).map(t => '<div class="w-rule"><strong>Важно:</strong> ' + t + "</div>").join("");
  }

  el.querySelector(".w-add").addEventListener("click", addRow);
  addRow();
};

/* Разбор исследования: получилось ли исследование.
   Пороги — из литературы, источники в карточке ru/quality.md:
   артерии: > 200 HU диагностично (Horehledova 2018), 250 HU — общепринятый «хороший» уровень (Radiopaedia, КТ-ангиография лёгочных артерий);
   ТЭЛА: лёгочный ствол 210–300 HU по разным работам, 250 — общепринятый; аорта ярче ствола — поздно;
   ноги: аорта > 200 HU (Horehledova 2018); артерии голеней не видны — болюс обогнали;
   БЦА: меряют дугу аорты (крупный сосуд, там же стоит триггер), пороги — как для любой артерии;
   живот, артериальная: аорта 290–360 HU типично (Radiopaedia, late arterial phase), > 280 HU — оптимально; < 200 — слабо;
   живот, венозная: печень > 110 HU (Radiopaedia, portal venous phase), приемлемо от 92 HU (опрос радиологов, цит. по Duke); пёстрая селезёнка — ещё артериальная (LI-RADS);
   почки: паренхиматозная — почка однородная, «двухцветная» = рано (Radiopaedia, CT renal mass);
   грудная клетка: HU-порога для рутинной КТ в литературе нет — чек-лист ошибок.
   MAX_HU 1000 — не порог качества, а защита от опечатки / ROI на кальцинате.
   Поле: { k, label, opt — необязательное, check — галочка «вижу проблему», fix — что делать }. */
RH_WIDGETS["quality-check"] = function (el) {
  const hu = (k, label, opt) => ({ k, label, opt });
  const chk = (k, label, fix, plan) => ({ k, label, check: true, fix, plan });
  const CHEST = [
    chk("apex", "Верхушки лёгких обрезаны", "Начинать на 2–3 см выше ключиц."),
    chk("base", "Задние синусы обрезаны", "Заканчивать ниже задних синусов. Смотреть на боковой топограмме."),
    chk("breath", "Лёгкие «смазаны» дыханием", "«Вдохнуть и не дышать». Убедиться, что понял."),
    chk("arms", "Полосы от рук", "Руки за голову."),
  ];
  const ZONES = [
    { id: "bca",   name: "БЦА",   fields: [hu("a", "Дуга аорты, HU")], rule: "bca" },
    { id: "pe",    name: "ТЭЛА",  fields: [hu("a", "Лёгочный ствол, HU"), hu("b", "Аорта, HU (можно не мерить)", true)], rule: "pe" },
    { id: "aorta", name: "Аорта", fields: [hu("a", "Аорта, HU")], rule: "artery" },
    { id: "arms",  name: "Руки",  fields: [hu("a", "Плечевая артерия, HU")], rule: "artery" },
    { id: "legs",  name: "Ноги",  fields: [hu("a", "Брюшная аорта, HU"), { k: "shin", label: "Артерии голеней видны?", yesno: true }], rule: "legs" },
    { id: "abd",   name: "Живот", phases: [
      { id: "art", name: "Артериальная", fields: [hu("a", "Аорта на уровне чревного ствола, HU")], rule: "abdArt" },
      { id: "ven", name: "Венозная", when: "60–75 с", fields: [hu("a", "Печень, HU"), chk("spleen", "Селезёнка пёстрая")], rule: "abdVen" },
    ] },
    { id: "kid",   name: "Почки", phases: [
      { id: "par", name: "Паренхиматозная", when: "80–120 с", fields: [
        chk("two", "Почка «двухцветная»: край ярче середины", "Рано.", "early"),
      ], rule: "check" },
      { id: "exc", name: "Экскреторная", when: "5–10 минут", fields: [
        chk("pelvis", "В лоханках нет контраста", "Рано.", "early"),
      ], rule: "check" },
    ] },
    { id: "chest", name: "Грудная клетка", phases: [
      { id: "plain", name: "Без контраста", fields: CHEST, rule: "check" },
      { id: "cont",  name: "С контрастом", when: "60–70 с", fields: CHEST.concat([
        chk("vein", "Полосы от вен", "Рано.", "early"),
      ]), rule: "check" },
    ] },
  ];
  const GOOD = 250, OK = 200, PE_OK = 210, ABD_GOOD = 280, LIVER_GOOD = 110, LIVER_OK = 92, MAX_HU = 1000;

  el.innerHTML =
    '<div class="w-label">Что разбираем</div>' +
    '<div class="picks w-zone">' +
      ZONES.map(z => '<button type="button" class="pick" data-z="' + z.id + '" aria-pressed="false">' + z.name + "</button>").join("") +
    "</div>" +
    '<div class="w-qphase"></div>' +
    '<div class="w-qfields"></div>' +
    '<div class="w-out" aria-live="polite"></div>' +
    '<div class="w-a-more w-qmore"></div>' +
    '<div class="w-rule">Кружок — на полпросвета, не на стенке, не на кальцинате.</div>';

  const phaseBox = el.querySelector(".w-qphase"), box = el.querySelector(".w-qfields"),
        out = el.querySelector(".w-out"), more = el.querySelector(".w-qmore");
  let zone = null, step = null; // step — зона без фаз или выбранная фаза
  const num = i => { const r = i.value.trim().replace(",", ".").replace(/[−–]/, "-"); if (!r) return null; return /^-?\d+(\.\d+)?$/.test(r) ? +r : NaN; };
  const verdict = (cls, big, hint) => { out.className = "w-out q-" + cls; out.innerHTML = '<span class="w-num">' + big + "</span>" + (hint ? '<span class="w-hint">' + hint + "</span>" : ""); };
  const lines = arr => { more.innerHTML = arr.map(t => '<div class="w-line">' + t + "</div>").join(""); };
  const press = (sel, attr, id) => el.querySelectorAll(sel).forEach(x => x.setAttribute("aria-pressed", x.dataset[attr] === id));

  function pickZone(id) {
    zone = ZONES.find(z => z.id === id); step = null;
    press(".w-zone .pick", "z", id);
    box.innerHTML = "";
    if (zone.phases) {
      phaseBox.innerHTML = '<div class="w-label">Фаза</div><div class="picks w-ph">' +
        zone.phases.map(p => '<button type="button" class="pick" data-p="' + p.id + '" aria-pressed="false">' + p.name + "</button>").join("") + "</div>";
      phaseBox.querySelectorAll(".pick").forEach(b => b.addEventListener("click", () => pickStep(zone.phases.find(p => p.id === b.dataset.p))));
      if (zone.phases.length === 1) return pickStep(zone.phases[0]);
      return show();
    }
    phaseBox.innerHTML = "";
    pickStep(zone);
  }

  function pickStep(s) {
    step = s;
    if (zone.phases) press(".w-ph .pick", "p", s.id);
    box.innerHTML = s.fields.map(f => f.yesno
      ? '<fieldset class="w-field"><legend class="w-label">' + f.label + '</legend><label><input type="radio" name="q-' + f.k + '" value="yes"> Да</label> &nbsp; <label><input type="radio" name="q-' + f.k + '" data-k="' + f.k + '" value="no"> Нет</label></fieldset>'
      : f.check
      ? '<label class="w-chk"><input type="checkbox" data-k="' + f.k + '"> ' + f.label + "</label>"
      : '<div class="w-field"><label class="w-label" for="q-' + f.k + '">' + f.label + "</label>" +
        '<input id="q-' + f.k + '" data-k="' + f.k + '" class="w-input" type="text" inputmode="decimal" autocomplete="off" placeholder="HU"></div>').join("");
    if (s.rule === "check") box.insertAdjacentHTML("afterbegin", '<div class="w-label">Отметьте, что видите</div>');
    box.querySelectorAll("input").forEach(i => i.addEventListener(["checkbox", "radio"].includes(i.type) ? "change" : "input", show));
    show();
  }

  /* Работа над ошибками: что проверить по порядку, от частого к редкому */
  const ROI = "«Куда ставить триггер»", CATH = "«Частые вопросы о катетерах»", VOL = "«Расчёт объёма контраста»";
  const MON = "Где стоял кружок? Нужно в аорте (ТЭЛА — в лёгочном стволе), не в вене, не на кальцинате. → " + ROI;
  const DOC = "Всё было правильно? Покажите врачу — это может быть не ваша ошибка.";
  const PLANS = {
    pale: () => [
      MON,
      "Катетер синий или в кисти? Нужен зелёный или розовый, в локте. → " + CATH,
      "Объём совпал с калькулятором? → " + VOL,
      "Инжектор останавливался по давлению?",
      "Был отёк в месте укола?",
    ],
    late: () => [
      MON,
      "Запускали вручную? Жмите сразу, как пришёл контраст.",
      "Была пауза перед сканом?",
    ],
    early: w => [
      "Скан — через " + w + ".",
      "Время считать от начала введения, не от конца.",
    ],
    overtook: () => [
      "Сразу скажите врачу: нужен ещё скан голеней.",
      "Это не ваша ошибка.",
    ],
  };
  let plan = [];
  const todo = (key, arg) => { if (!plan.some(p => p[0] === key)) plan.push([key, arg]); };

  function artery(v, what) {
    if (v >= GOOD) return verdict("good", "Отлично", what + " " + v + " HU");
    if (v >= OK)   return verdict("ok", "Годится", what + " " + v + " HU — на грани");
    todo("pale");
    return verdict("bad", "Слабо", what + " " + v + " HU — мало");
  }

  function show() {
    plan = [];
    evaluate();
    if (!plan.length) return;
    const steps = [];
    plan.flatMap(([k, a]) => PLANS[k](a)).forEach(t => {
      if (t.startsWith(MON)) { if (steps.some(x => x.startsWith(MON))) return; }
      if (!steps.includes(t)) steps.push(t);
    });
    if (plan.some(([k]) => k !== "overtook")) steps.push(DOC);
    more.insertAdjacentHTML("beforeend",
      '<div class="w-steps"><div class="w-label">Что проверить</div><ol>' +
      steps.map(t => "<li>" + t + "</li>").join("") + "</ol></div>");
  }

  function evaluate() {
    more.innerHTML = "";
    if (!zone) return verdict("none", "—", "выберите, что разбираем");
    if (!step) return verdict("none", "—", "выберите фазу");

    if (step.rule === "check") {
      const bad = step.fields.filter(f => box.querySelector('[data-k="' + f.k + '"]').checked);
      if (!bad.length) return verdict("good", "Хорошо", "");
      verdict("bad", "Плохо", "");
      bad.forEach(f => f.plan && todo(f.plan, step.when));
      return lines(bad.map(f => "<b>" + f.label + ".</b> " + f.fix));
    }

    const v = {}, c = {};
    if (step.rule === "legs" && !box.querySelector('input[name="q-shin"]:checked')) return verdict("none", "—", "Укажите, видны ли артерии голеней");
    c.shin = !!box.querySelector('input[name="q-shin"][value="no"]:checked');
    box.querySelectorAll('input[type="checkbox"]').forEach(i => { c[i.dataset.k] = i.checked; });
    for (const i of box.querySelectorAll('input[type="text"]')) {
      v[i.dataset.k] = num(i);
      if (Number.isNaN(v[i.dataset.k])) return verdict("bad", "?", "Нужно число, например 280");
    }
    if (step.fields.some(f => !f.opt && !f.check && v[f.k] === null)) return verdict("none", "—", "введите HU");
    if (Object.values(v).some(x => x !== null && x > MAX_HU)) return verdict("bad", "?", "Больше 1000 HU — опечатка или кальцинат");

    switch (step.rule) {
      case "artery": return artery(v.a, "Артерия");

      case "bca": return artery(v.a, "Дуга аорты");          // мерим в дуге, а не в сонной: крупнее, проще попасть

      case "pe":
        if (v.a >= GOOD) verdict("good", "Отлично", "Лёгочный ствол " + v.a + " HU");
        else if (v.a >= PE_OK) verdict("ok", "Годится", "Лёгочный ствол " + v.a + " HU — на грани");
        else { verdict("bad", "Слабо", "Лёгочный ствол " + v.a + " HU — мало"); todo("pale"); }
        if (v.b !== null && v.b > v.a) { lines(["<b>Аорта ярче ствола — запуск поздно.</b>"]); todo("late"); }
        return;

      case "legs":
        if (v.a < OK) { todo("pale"); return verdict("bad", "Слабо", "Аорта " + v.a + " HU — мало"); }
        if (c.shin) {
          todo("overtook");
          verdict("bad", "Обогнали болюс", "Голени пустые");
          return;
        }
        return v.a >= GOOD ? verdict("good", "Отлично", "Аорта " + v.a + " HU")
                           : verdict("ok", "Годится", "Аорта " + v.a + " HU — на грани");

      case "abdArt":
        if (v.a >= ABD_GOOD) return verdict("good", "Отлично", "Аорта " + v.a + " HU");
        if (v.a >= OK) return verdict("ok", "Годится", "Аорта " + v.a + " HU — на грани");
        todo("pale");
        return verdict("bad", "Слабо", "Аорта " + v.a + " HU — мало");

      case "abdVen": {
        const tips = [];
        if (v.a < LIVER_OK) tips.push("Печень жирная (тёмная и без контраста)? Тогда это не ошибка.");
        if (c.spleen) todo("early", step.when);
        else if (v.a < LIVER_OK) todo("pale");
        if (c.spleen) verdict("bad", "Рано", "Ещё артериальная фаза");
        else if (v.a >= LIVER_GOOD) verdict("good", "Отлично", "Печень " + v.a + " HU");
        else if (v.a >= LIVER_OK) verdict("ok", "Годится", "Печень " + v.a + " HU — на грани");
        else verdict("bad", "Слабо", "Печень " + v.a + " HU — мало");
        return lines(tips);
      }

    }
  }

  el.querySelectorAll(".w-zone .pick").forEach(b => b.addEventListener("click", () => pickZone(b.dataset.z)));
  show();
};
