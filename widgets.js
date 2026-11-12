/* Виджеты — маленькие интерактивные калькуляторы внутри карточек ru/*.md.
   В карточке пишется отдельной строкой:  Виджет: имя
   Движок (index.html) ставит на это место пустой блок и вызывает RH_WIDGETS[имя](блок). */
window.RH_WIDGETS = window.RH_WIDGETS || {};

/* Объём контраста для лаборанта.
   Не ангиография: 300 — вес × 1,6; 320 — × 1,5; 350 — × 1,4; 370 — × 1,3; 400 — × 1,2 (≈ 480 мг йода/кг);
     до целого мл; не больше 150 мл.
   Ангиография: зоны и их правила — в таблице ZONES ниже. Физраствор всегда 50 мл с той же скоростью. */
RH_WIDGETS["contrast-volume"] = function (el) {
  const MAX = 150;                                   // мл, потолок для любого веса
  const K = { 300: 1.6, 320: 1.5, 350: 1.4, 370: 1.3, 400: 1.2 };  // ≈ 480 мг йода на кг для любой концентрации

  /* ---------- Ангиография: правила по зонам (правьте цифры здесь) ----------
     lin(x, x1, x2, y1, y2): прямая через точки (x1; y1) и (x2; y2), за краями — крайние значения.
     ml / flow — функции от {kg, cm}; need — какие поля нужны: "kg", "cm", "kg|cm" (хотя бы одно), "" (ничего). */
  const SALINE = 50;      // мл физраствора после контраста
  const FLOW_MAX = 4.5;   // мл/с, больше вены пожилых не держат
  const ZONES = [
    { id: "bca",   name: "БЦА",  need: "kg",
      ml: p => lin(p.kg, 60, 100, 50, 70),                 // 60 кг → 50 мл, 100 кг → 70 мл
      flow: () => FLOW_MAX,
      conc: "Концентрация 320–370." },
    { id: "pe",    name: "ТЭЛА", need: "",
      ml: () => 50, mlText: "1 флакон 50 мл", mlHint: "в шприце 47–48 мл — это нормально",
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
    '<div class="tabs w-mode" role="tablist">' +
      '<button type="button" class="tab" role="tab" data-mode="plain" aria-selected="true">Не ангиография</button>' +
      '<button type="button" class="tab" role="tab" data-mode="angio" aria-selected="false">Ангиография</button>' +
    "</div>" +
    // --- не ангиография ---
    '<div class="w-pane" data-pane="plain">' +
      '<div class="w-label">Концентрация контраста, мг йода/мл</div>' +
      '<div class="picks w-conc">' +
        Object.keys(K).map(c => '<button type="button" class="pick" data-c="' + c + '" aria-pressed="false">' + c + "</button>").join("") +
      "</div>" +
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
    if (!z) return empty(outA, "выберите, что исследуем");

    const kg = needKg ? num(wA) : null, cm = needCm ? num(hA) : null;
    if (Number.isNaN(kg) || (kg !== null && !okKg(kg))) return bad(outA, "Проверьте вес: нужно число от 20 до 300 кг");
    if (Number.isNaN(cm) || (cm !== null && !okCm(cm))) return bad(outA, "Проверьте рост: нужно число от 120 до 220 см");
    if (either ? (kg === null && cm === null) : (needKg && kg === null)) return empty(outA, either ? "введите рост или вес" : "введите вес");

    const p = { kg, cm };
    const ml = Math.min(MAX, Math.round(z.ml(p)));
    const flow = Math.min(FLOW_MAX, z.flow(p));
    outA.innerHTML = '<span class="w-num">' + (z.mlText || ml + " мл") + "</span>" +
      (z.mlHint ? '<span class="w-hint">' + z.mlHint + "</span>" : "");
    moreA.innerHTML =
      '<div class="w-line"><b>Скорость: ' + fmt(flow) + " мл/с</b></div>" +
      '<div class="w-line">Физраствор: ' + SALINE + " мл, " + fmt(flow) + " мл/с</div>" +
      (z.warn ? '<div class="w-warn">' + z.warn + "</div>" : "") +
      '<div class="w-rule">' + (z.conc || "Концентрация 350 и выше.") +
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
