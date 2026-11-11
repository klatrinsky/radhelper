/* Виджеты — маленькие интерактивные калькуляторы внутри карточек ru/*.md.
   В карточке пишется отдельной строкой:  Виджет: имя
   Движок (index.html) ставит на это место пустой блок и вызывает RH_WIDGETS[имя](блок). */
window.RH_WIDGETS = window.RH_WIDGETS || {};

/* Объём контраста для лаборанта.
   Не ангиография: 300 — вес × 1,6; 320 — × 1,5; 350 — × 1,4; 370 — × 1,3; 400 — × 1,2 (≈ 480 мг йода/кг); до целого мл; не больше 150 мл.
   Ангиография: пока заглушка. */
RH_WIDGETS["contrast-volume"] = function (el) {
  const MAX = 150;                                   // мл, потолок для любого веса
  const K = { 300: 1.6, 320: 1.5, 350: 1.4, 370: 1.3, 400: 1.2 };  // ≈ 480 мг йода на кг для любой концентрации
  let mode = "plain", conc = null;

  el.innerHTML =
    '<div class="tabs w-mode" role="tablist">' +
      '<button type="button" class="tab" role="tab" data-mode="plain" aria-selected="true">Не ангиография</button>' +
      '<button type="button" class="tab" role="tab" data-mode="angio" aria-selected="false">Ангиография</button>' +
    "</div>" +
    '<div class="w-pane" data-pane="plain">' +
      '<div class="w-label">Концентрация контраста, мг йода/мл</div>' +
      '<div class="picks w-conc">' +
        Object.keys(K).map(c => '<button type="button" class="pick" data-c="' + c + '" aria-pressed="false">' + c + "</button>").join("") +
      "</div>" +
      '<label class="w-label" for="w-weight">Вес пациента, кг</label>' +
      '<input id="w-weight" class="w-input" type="text" inputmode="decimal" autocomplete="off" placeholder="например, 70">' +
      '<div class="w-out" aria-live="polite"><span class="w-num">—</span></div>' +
      '<div class="w-rule">Вес × коэффициент: 300 → 1,6 · 320 → 1,5 · 350 → 1,4 · 370 → 1,3 · 400 → 1,2. Не больше ' + MAX + " мл</div>" +
    "</div>" +
    '<div class="w-pane" data-pane="angio" hidden>' +
      '<p class="w-stub">Калькулятор для ангиографии в разработке. Пока объём контраста уточняйте у врача.</p>' +
    "</div>";

  const out = el.querySelector(".w-out"), w = el.querySelector(".w-input");

  function show() {
    const raw = w.value.trim().replace(",", ".");
    const kg = /^\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : NaN;   // «70», «70,5», «70.5»
    out.className = "w-out";
    if (!conc || !raw) {
      out.innerHTML = '<span class="w-num">—</span><span class="w-hint">' +
        (!conc ? "выберите концентрацию" : "введите вес") + "</span>";
      return;
    }
    if (!(kg >= 20 && kg <= 300)) {
      out.classList.add("bad");
      out.innerHTML = '<span class="w-hint">Проверьте вес: нужно число от 20 до 300 кг</span>';
      return;
    }
    const ml = Math.round(kg * K[conc]);
    out.innerHTML = ml > MAX
      ? '<span class="w-num">' + MAX + ' мл</span><span class="w-hint">максимум</span>'
      : '<span class="w-num">' + ml + " мл</span>";
  }

  el.querySelectorAll(".w-mode .tab").forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    el.querySelectorAll(".w-mode .tab").forEach(x => x.setAttribute("aria-selected", x === b));
    el.querySelectorAll(".w-pane").forEach(p => { p.hidden = p.dataset.pane !== mode; });
  }));
  el.querySelectorAll(".w-conc .pick").forEach(b => b.addEventListener("click", () => {
    conc = b.dataset.c;
    el.querySelectorAll(".w-conc .pick").forEach(x => x.setAttribute("aria-pressed", x === b));
    show();
  }));
  w.addEventListener("input", show);
  show();
};
