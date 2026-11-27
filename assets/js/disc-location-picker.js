(function () {
  "use strict";

  const { zones, types, migrations, normalize, parseSize, format } = window.RH_DISC_LOCATION;
  let nextId = 0;

  // Границы зон идут по проекции медиальных краёв фасеток и краёв ножек дуг.
  // Зоны служат для выбора локализации, их размер на схеме условный.
  const rightAreas = {
    subarticular: ["M174 178 Q194 177 218 174 L218 235 Q199 230 174 214Z", 196, 203],
    foraminal: ["M120 169 Q146 175 174 178 L174 214 Q146 230 120 209Z", 147, 195],
    extraforaminal: ["M62 145 Q88 160 120 169 L120 209 Q87 202 62 180Z", 93, 178]
  };

  const svgMarkup = `
    <svg viewBox="0 0 560 376" role="group" aria-label="Аксиальная схема диска и позвоночного канала">
      <text class="disc-orientation" x="280" y="21">Спереди</text>
      <text class="disc-side" x="18" y="42" text-anchor="start">Справа</text>
      <text class="disc-side" x="542" y="42" text-anchor="end">Слева</text>

      <path class="disc-bone" d="M170 157 Q153 195 171 231 L185 245 Q200 282 239 294
        Q258 301 271 325 Q280 341 289 325 Q302 301 321 294 Q360 282 375 245
        L389 231 Q407 195 390 157 L362 170 Q374 209 352 233
        Q322 259 280 262 Q238 259 208 233 Q186 209 198 170Z"/>
      <path class="disc-canal" d="M177 179 Q228 163 280 164 Q332 163 383 179
        Q366 206 348 232 Q322 259 280 265 Q238 259 212 232 Q194 206 177 179Z"/>
      <path class="disc-foramen" d="M116 164 Q143 164 176 174 Q183 192 168 214 Q140 225 118 205 Q105 192 116 164Z"/>
      <path class="disc-foramen" transform="translate(560 0) scale(-1 1)" d="M116 164 Q143 164 176 174 Q183 192 168 214 Q140 225 118 205 Q105 192 116 164Z"/>
      <path class="disc-annulus" d="M119 122 C121 75 189 51 280 51 C371 51 439 75 441 122
        Q441 164 387 175 Q342 184 310 174 Q280 164 250 174 Q218 184 173 175 Q119 164 119 122Z"/>
      <path class="disc-body-outline" d="M137 122 C138 86 194 64 280 64 C366 64 422 86 423 122
        Q424 151 379 161 Q329 166 280 156 Q231 166 181 161 Q136 151 137 122Z"/>
      <path class="disc-midline" d="M280 54 V318"/>

      <g class="disc-callout">
        <path d="M280 97 V81"/>
        <text x="280" y="114">Тело позвонка</text>
        <text class="disc-callout-small" x="280" y="136">проекция контура</text>
        <path d="M436 114 L458 117 H542"/>
        <text class="disc-disc-label" x="542" y="87" text-anchor="end">Межпозвонковый<tspan x="542" y="106"> диск</tspan></text>
        <path d="M264 243 V257"/>
        <text x="264" y="280">Позвоночный канал</text>
        <path d="M144 212 L111 253 H27 M416 212 L449 253 H533"/>
        <text x="27" y="271" text-anchor="start">Межпозвонковое</text>
        <text x="27" y="292" text-anchor="start">отверстие</text>
        <text x="533" y="271" text-anchor="end">Межпозвонковое</text>
        <text x="533" y="292" text-anchor="end">отверстие</text>
      </g>
      <g data-disc-areas></g>
      <text class="disc-orientation" x="280" y="358">Сзади</text>
    </svg>`;

  // Один экземпляр на уровень. onChange получает снимок настроек, текст и признаки ошибок ввода.
  window.createDiscLocationPicker = function (root, { level = "", value, onChange = () => {} } = {}) {
    const doc = root.ownerDocument;
    const uid = "disc-location-" + ++nextId;
    root.classList.add("disc-picker");
    root.innerHTML = `
      <div class="disc-picker-layout">
        <div class="disc-diagram-card">${svgMarkup}</div>
        <div class="disc-editor">
          <fieldset class="disc-zone-field">
            <legend>Зоны</legend>
            <div class="disc-zone-list" data-disc-zones></div>
          </fieldset>
          <div class="disc-fields">
            <label>Характер выпячивания
              <select data-disc-type></select>
            </label>
            <label>Размер, мм
              <input data-disc-size type="text" inputmode="decimal" aria-describedby="${uid}-size-error">
            </label>
            <p class="disc-error" id="${uid}-size-error" hidden>Введите положительный размер в мм.</p>
            <label class="disc-field-wide">Миграция
              <select data-disc-migration></select>
            </label>
            <label class="disc-field-wide">Планиметрическая площадь позвоночного канала, мм²
              <input data-disc-canal-area type="text" inputmode="decimal" aria-describedby="${uid}-canal-area-error">
            </label>
            <p class="disc-error" id="${uid}-canal-area-error" hidden>Введите положительную площадь в мм².</p>
          </div>
          <button type="button" data-disc-reset>Сбросить уровень</button>
        </div>
      </div>`;
    const find = name => root.querySelector("[data-disc-" + name + "]");
    const type = find("type");
    const size = find("size");
    const canalArea = find("canal-area");
    const migration = find("migration");
    const reset = find("reset");
    const sizeMessage = root.querySelector("#" + uid + "-size-error");
    const canalAreaMessage = root.querySelector("#" + uid + "-canal-area-error");
    const targets = new Map();
    let state = normalize(value);

    function svgNode(name, attrs, text) {
      const node = doc.createElementNS("http://www.w3.org/2000/svg", name);
      for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
      if (text) node.textContent = text;
      return node;
    }

    function choose(id) {
      state.zones = state.zones.includes(id) ? state.zones.filter(zone => zone !== id) : [...state.zones, id];
      publish();
    }

    function drawZone(zone) {
      const central = zone.id === "central";
      const left = zone.id.startsWith("left-");
      const [d, x, y] = central ? ["M218 174 Q280 155 342 174 L342 235 Q280 249 218 235Z", 280, 202]
        : rightAreas[zone.id.slice(zone.id.indexOf("-") + 1)];
      const path = svgNode("path", { d, class: "disc-zone-path" });
      if (left) path.setAttribute("transform", "translate(560 0) scale(-1 1)");
      const group = svgNode("g", { role: "button", tabindex: "0", "data-disc-zone": zone.id, "aria-label": zone.label + " зона" });
      group.append(svgNode("title", {}, zone.label + " зона"), path,
        svgNode("text", { x: left ? 560 - x : x, y, class: "disc-zone-code", "aria-hidden": "true" }, zone.code));
      group.addEventListener("click", () => choose(zone.id));
      group.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        choose(zone.id);
      });
      find("areas").append(group);
      const control = doc.createElement("button");
      control.type = "button";
      control.dataset.discZone = zone.id;
      control.textContent = zone.label;
      control.addEventListener("click", () => choose(zone.id));
      find("zones").append(control);
      targets.set(zone.id, [group, control]);
    }

    function publish() {
      state = normalize(state);
      for (const [id, controls] of targets) {
        const selected = String(state.zones.includes(id));
        for (const control of controls) control.setAttribute("aria-pressed", selected);
      }
      const sizeError = parseSize(state.size) === null;
      const canalAreaError = parseSize(state.canalArea) === null;
      size.setAttribute("aria-invalid", String(sizeError));
      sizeMessage.hidden = !sizeError;
      canalArea.setAttribute("aria-invalid", String(canalAreaError));
      canalAreaMessage.hidden = !canalAreaError;
      reset.disabled = !state.zones.length && state.type === "unspecified" && !state.size && !state.migration && !state.canalArea;
      onChange({ value: normalize(state), text: format(state, level), sizeError, canalAreaError });
    }

    function setValue(value) {
      state = normalize(value);
      type.value = state.type;
      size.value = state.size;
      canalArea.value = state.canalArea;
      migration.value = state.migration;
      publish();
    }

    for (const [key, { label }] of Object.entries(types)) type.add(new Option(label, key));
    for (const [key, { label }] of Object.entries(migrations)) migration.add(new Option(label, key));
    zones.forEach(drawZone);
    size.addEventListener("input", () => { state.size = size.value; publish(); });
    canalArea.addEventListener("input", () => { state.canalArea = canalArea.value; publish(); });
    type.addEventListener("change", () => { state.type = type.value; publish(); });
    migration.addEventListener("change", () => { state.migration = migration.value; publish(); });
    reset.addEventListener("click", () => { setValue(); targets.get("central")[1].focus(); });
    setValue(state);

    return { setValue, getValue: () => normalize(state) };
  };

  window.createDiscLevelPicker = function (select, container, onChange) {
    const panels = new Map();

    function showLevel(selected) {
      select.value = selected;
      for (const [level, panel] of panels) panel.root.hidden = level !== selected;
      if (panels.has(selected)) {
        const { result, root } = panels.get(selected);
        onChange(result, selected);
        return root;
      }
      const root = container.ownerDocument.createElement("section");
      root.dataset.discLevel = selected;
      root.setAttribute("aria-label", "Параметры уровня " + selected);
      container.append(root);
      const panel = { root };
      panels.set(selected, panel);
      window.createDiscLocationPicker(root, {
        level: selected,
        onChange(result) {
          panel.result = result;
          onChange(result, selected);
        }
      });
      return root;
    }

    select.addEventListener("change", () => showLevel(select.value));
    showLevel(select.value);
    return showLevel;
  };
})();
