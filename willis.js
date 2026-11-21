// CTA view from below. The patient's right side is on the left of the diagram.
window.createWillisDiagram = function (panel, updateReport) {
  const segments = [
    ["a1r", "A1 правой ПМА", "M92 104 Q113 86 141 58", 111, 69, "A1"],
    ["a1l", "A1 левой ПМА", "M228 104 Q207 86 179 58", 209, 69, "A1"],
    ["acom", "Передняя соединительная артерия", "M141 58 Q160 53 179 58", 160, 40, "ПСоА"],
    ["pcomr", "Правая задняя соединительная артерия", "M92 104 Q97 151 106 183", 67, 150, "ЗСоА"],
    ["pcoml", "Левая задняя соединительная артерия", "M228 104 Q223 151 214 183", 253, 150, "ЗСоА"],
    ["p1r", "P1 правой ЗМА", "M160 195 Q139 174 106 183", 132, 208, "P1"],
    ["p1l", "P1 левой ЗМА", "M160 195 Q181 174 214 183", 188, 208, "P1"]
  ];
  const absent = new Set();
  let assessed = false;
  const svgNS = "http://www.w3.org/2000/svg";
  function svgElement(tag, attributes, content) {
    const element = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (content) element.textContent = content;
    return element;
  }
  panel.className = "willis-panel";
  panel.innerHTML = '<h3>Виллизиев круг</h3><p>Нажмите на сегмент, который не визуализируется. Повторное нажатие на его подпись вернёт сосуд.</p><div class="willis-layout"><svg viewBox="0 0 320 250" role="group" aria-label="Артерии основания мозга, вид снизу"></svg><div class="willis-controls"></div></div><div class="willis-actions"><button type="button" class="willis-apply">Подтвердить схему</button><button type="button" class="willis-clear">Снять оценку</button></div>';
  const svg = panel.querySelector("svg");
  const controls = panel.querySelector(".willis-controls");
  controls.innerHTML = '<details><summary>Особенности ветвления</summary><label>Передний отдел<select></select></label><fieldset><legend>Фетальный тип ЗМА подтверждён</legend><label><input type="checkbox" value="r"> Справа</label><label><input type="checkbox" value="l"> Слева</label></fieldset></details>';
  const anterior = controls.querySelector("select");
  const fetalChecks = [...controls.querySelectorAll("input")];
  for (const [value, label] of Object.entries({
    a: "Обычное ветвление", b: "Две и более передние соединительные артерии",
    c: "Срединная артерия мозолистого тела от ПСоА", d: "Короткое слияние ПМА",
    e: "Общий ствол ПМА с разделением на два A2", f: "Два отдельных ствола СМА от ВСА",
    i: "Обе ПМА и обе СМА из одной ВСА при гипоплазии или отсутствии второй ВСА"
  })) anterior.add(new Option(label, value));
  controls.addEventListener("change", () => { assessed = true; render(); });
  const hint = document.createElement("p");
  controls.prepend(hint);
  svg.append(svgElement("path", {class:"willis-context", d:"M141 58 Q145 40 141 17 M179 58 Q175 40 179 17 M92 104 Q60 100 24 79 M228 104 Q260 100 296 79 M106 183 Q71 195 54 218 M214 183 Q249 195 266 218 M160 195 L160 235"}));
  for (const [x, label] of [[32, "Справа"], [288, "Слева"]]) {
    svg.append(svgElement("text", {x, y:28, class:"willis-side"}, label));
  }
  const groups = new Map();
  for (const [id, name, d, x, y, label] of segments) {
    const group = svgElement("g", {role:"button", tabindex:0, "aria-label":name, class:"willis-segment"});
    group.append(svgElement("title", {}, name), svgElement("path", {d, class:"willis-hit"}),
      svgElement("path", {d, class:"willis-vessel"}), svgElement("text", {x, y}, label));
    const toggle = () => {
      if (absent.has(id)) absent.delete(id);
      else absent.add(id);
      assessed = true;
      render();
    };
    group.addEventListener("click", toggle);
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
    });
    groups.set(id, group);
    svg.append(group);
  }
  for (const cx of [92, 228]) svg.append(svgElement("circle", {cx, cy:104, r:5, class:"willis-ica"}));
  const summary = document.createElement("p");
  summary.className = "willis-summary";
  summary.setAttribute("aria-live", "polite");
  controls.append(summary);
  const apply = panel.querySelector(".willis-apply");
  const clear = panel.querySelector(".willis-clear");
  function render() {
    for (const [id, group] of groups) group.setAttribute("aria-pressed", String(!absent.has(id)));
    apply.hidden = assessed;
    clear.hidden = !assessed;
    for (const box of fetalChecks) {
      box.disabled = absent.has("pcom" + box.value);
      if (box.disabled) box.checked = false;
    }
    const needsFetal = fetalChecks.some(box => absent.has("p1" + box.value) && !box.disabled && !box.checked);
    hint.hidden = !needsFetal;
    hint.textContent = needsFetal ? "Если подтверждено отхождение ЗМА от ВСА, отметьте сторону в особенностях ветвления." : "";
    if (needsFetal) controls.querySelector("details").open = true;
    const result = window.classifyWillis(absent, options());
    summary.hidden = !assessed;
    summary.textContent = assessed ? result.conclusion : "";
    updateReport(assessed ? result : null);
  }
  function options() {
    return { anteriorVariant: anterior.value, fetal: new Set(fetalChecks.filter(box => box.checked).map(box => box.value)) };
  }
  apply.onclick = () => { assessed = true; render(); clear.focus(); };
  clear.onclick = () => { assessed = false; absent.clear(); anterior.value = "a";
    fetalChecks.forEach(box => { box.checked = false; });
    controls.querySelector("details").open = false;
    render(); apply.focus(); };
  render();
};
