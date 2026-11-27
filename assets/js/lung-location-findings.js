(function () {
  "use strict";

  window.createLungFindings = function (root, onChange) {
    const document = root.ownerDocument;
    root.classList.add("lung-findings");
    root.innerHTML = `
    <section class="lung-demo-card" aria-label="Схема бронхолёгочных сегментов">
      <div data-lung-picker></div>
      <p class="lung-projection-note">Если сегмент определить нельзя, выберите долю или лёгочное поле.</p>
    </section>
    <div class="lung-findings-grid">
      <section class="lung-demo-card" aria-label="Находки">
        <h2>Находки</h2>
        <p data-lung-empty>Выберите сегмент, долю или лёгочное поле.</p>
        <form data-lung-finding hidden>
          <p class="lung-selection" data-lung-selection role="status"></p>
          <label class="lung-control">Находка
            <select data-lung-kind required>
              <option value="">Выберите находку</option>
              <option value="opacity">Затемнение</option>
              <option value="focus">Очаговая тень</option>
              <option value="mass">Образование</option>
              <option value="atelectasis">Ателектаз</option>
              <option value="crowding">Сближение лёгочного рисунка</option>
              <option value="markings">Усиление лёгочного рисунка</option>
              <option value="other">Другая находка</option>
            </select>
          </label>
          <label class="lung-control" data-lung-other-label hidden>Описание находки
            <input data-lung-other type="text" disabled>
          </label>
          <fieldset data-lung-descriptors class="lung-descriptors" hidden>
            <legend>Характеристики</legend>
          </fieldset>
          <div class="lung-button-group">
            <button type="submit" class="lung-primary" data-lung-save disabled>Добавить находку</button>
            <button type="button" data-lung-clear>Снять выбор</button>
          </div>
        </form>
        <ul data-lung-findings aria-label="Добавленные находки" hidden></ul>
      </section>
    </div>
    `;
    const { format } = window.RH_LUNG_LOCATION;
    const find = name => root.querySelector("[data-lung-" + name + "]");
    const saved = find("findings");
    const form = find("finding");
    const selection = find("selection");
    const empty = find("empty");
    const kind = find("kind");
    const other = find("other");
    const otherLabel = find("other-label");
    const descriptors = find("descriptors");
    const save = find("save");
    const clear = find("clear");
    const shadowFields = ["intensity", "size", "shape", "margins", "uniformity", "structure"];
    const findings = {
      opacity: { name: "затемнение", genitive: "затемнения", fields: shadowFields },
      focus: { name: "очаговая тень", genitive: "очаговой тени", fields: shadowFields },
      mass: { name: "образование", genitive: "образования", fields: shadowFields },
      atelectasis: { name: "ателектаз", genitive: "ателектаза", fields: ["volume", "structure"] },
      crowding: { name: "сближение легочного рисунка", genitive: "сближения легочного рисунка", fields: ["severity"] },
      markings: { name: "усиление легочного рисунка", genitive: "усиления легочного рисунка", fields: ["severity"] },
      other: { fields: [] }
    };
    const structures = {
      hilum: ["Корень лёгкого", "корню лёгкого", "корнем лёгкого", "корень лёгкого"],
      pleura: ["Плевра", "плевре", "плеврой", "плевру"],
      fissure: ["Междолевая щель", "междолевой щели", "междолевой щелью", "междолевую щель"],
      diaphragm: ["Диафрагма", "диафрагме", "диафрагмой", "купол диафрагмы"],
      mediastinum: ["Средостение", "средостению", "средостением", "средостение"],
      chestWall: ["Грудная стенка", "грудной стенке", "грудной стенкой", "грудную стенку"]
    };
    const severityAdjectives = {
      "незначительная": { nominative: "незначительное", genitive: "незначительного" },
      "умеренная": { nominative: "умеренное", genitive: "умеренного" },
      "выраженная": { nominative: "выраженное", genitive: "выраженного" }
    };
    const descriptorDefinitions = {
      intensity: { label: "Интенсивность тени", options: ["Слабая", "Умеренная", "Высокая"] },
      size: { label: "Максимальный размер, мм", type: "number", step: "any", min: 0 },
      shape: { label: "Форма тени", options: ["Округлая", "Овальная", "Неправильная"] },
      margins: { label: "Контуры", options: ["Чёткие, ровные", "Чёткие, неровные", "Нечёткие"] },
      uniformity: { label: "Структура тени", options: ["Однородная", "Неоднородная"] },
      volume: { label: "Уменьшение объёма", options: ["Незначительное", "Умеренное", "Выраженное"] },
      severity: { label: "Степень выраженности", options: ["Незначительная", "Умеренная", "Выраженная"] },
      structure: { label: "Соседняя структура", options: Object.fromEntries(
        Object.entries(structures).map(([key, [label]]) => [key, label])) },
      relation: { label: "Отношение к структуре", options: {
        adjacent: "Прилежит",
        overlaps: "Проекционно накладывается",
        linked: "Связь прослеживается",
        noLink: "Связь не прослеживается",
        uncertain: "Связь оценить затруднительно"
      } },
      notes: { label: "Дополнительное описание", type: "text" }
    };
    const controls = Object.fromEntries(Object.entries(descriptorDefinitions).map(([key, definition]) => {
      const label = document.createElement("label");
      label.className = "lung-control";
      label.textContent = definition.label;
      const control = document.createElement(definition.options ? "select" : "input");
      if (definition.options) {
        control.add(new Option("Не указано", ""));
        for (const [value, text] of Object.entries(definition.options)) {
          control.add(new Option(text, Array.isArray(definition.options) ? text.toLowerCase() : value));
        }
      } else {
        control.type = definition.type;
        if (definition.type === "number") {
          control.min = definition.min;
          control.step = definition.step;
          control.inputMode = "decimal";
        }
      }
      label.append(control);
      descriptors.append(label);
      return [key, control];
    }));
    const entries = new Map();
    let nextId = 0;
    let editing;
    let current;

    const picker = window.createLungLocationPicker(find("picker"), setDraft);

    function setDraft(value, text) {
      current = value;
      selection.textContent = text ? text[0].toUpperCase() + text.slice(1) : "";
      form.hidden = !text && editing === undefined;
      if (form.hidden) form.reset();
      empty.hidden = !form.hidden || entries.size > 0;
      updateForm();
    }

    function customText() {
      return other.value.trim().replace(/[.!?]+$/, "").trimEnd();
    }

    function updateForm() {
      const custom = kind.value === "other";
      otherLabel.hidden = !custom;
      other.disabled = !custom;
      other.required = custom;
      const finding = findings[kind.value];
      descriptors.hidden = !finding;
      for (const [key, control] of Object.entries(controls)) {
        const visible = finding && (finding.fields.includes(key) ||
          (key === "relation" && finding.fields.includes("structure") && !!controls.structure.value) || key === "notes");
        control.parentElement.hidden = !visible;
        control.disabled = !visible;
        if (!visible) control.value = "";
      }
      controls.relation.required = !controls.relation.disabled;
      const size = controls.size;
      size.setCustomValidity(size.value && size.valueAsNumber <= 0 ? "Укажите размер больше 0 мм." : "");
      save.disabled = !selection.textContent || !finding || (custom && !customText()) ||
        (controls.relation.required && !controls.relation.value);
      save.textContent = editing === undefined ? "Добавить находку" : "Сохранить находку";
      clear.textContent = editing === undefined ? "Снять выбор" : "Отменить правку";
    }

    function resetDraft() {
      editing = undefined;
      picker.setSelection();
      setDraft(undefined, "");
    }

    function customClause(text) {
      return text.replace(/^[А-ЯЁ](?=[а-яё])/u, initial => initial.toLowerCase());
    }

    function reportLead(entry) {
      const location = format(entry.location).replaceAll("лёгкого", "легкого");
      const severity = severityAdjectives[entry.descriptors.severity]?.nominative;
      const finding = entry.kind === "other"
        ? customClause(entry.other)
        : "определяется " + (severity ? severity + " " : "") + findings[entry.kind].name;
      return location[0].toUpperCase() + location.slice(1) + " " + finding + ".";
    }

    function reportConclusion(entry) {
      if (entry.kind === "other") {
        const location = format(entry.location).replaceAll("лёгкого", "легкого");
        return "Рентгенологическая находка " + location + " — " + customClause(entry.other) + ".";
      }
      const location = format(entry.location, { concise: true }).replaceAll("лёгкого", "легкого");
      const severity = severityAdjectives[entry.descriptors.severity]?.genitive;
      const finding = (severity ? severity + " " : "") + findings[entry.kind].genitive;
      return "Рентгенологические признаки " + finding + " " + location + ".";
    }

    function reportLine(entry) {
      const { intensity, size, shape, margins, uniformity, volume, structure, relation, notes } = entry.descriptors;
      const parts = [reportLead(entry)];
      if (intensity) parts.push("Интенсивность тени " + intensity + ".");
      if (size) parts.push("Максимальный размер " + size.replace(".", ",") + " мм.");
      if (shape) parts.push("Форма тени " + shape + ".");
      if (margins) parts.push("Контуры " + margins + ".");
      if (uniformity) parts.push("Структура тени " + uniformity + ".");
      if (volume) parts.push("Уменьшение объёма " + volume + ".");
      if (structure && relation) {
        const [, dative, instrumental, accusative] = structures[structure];
        parts.push({
          adjacent: "Прилежит к " + dative + ".",
          overlaps: "Проекционно накладывается на " + accusative + ".",
          linked: "Связь с " + instrumental + " прослеживается.",
          noLink: "Связь с " + instrumental + " не прослеживается.",
          uncertain: "Оценка связи с " + instrumental + " затруднена."
        }[relation]);
      }
      if (notes) parts.push(/[.!?]$/.test(notes) ? notes : notes + ".");
      return parts.join(" ");
    }

    function action(label, accessibleLabel, run) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-label", accessibleLabel);
      button.addEventListener("click", run);
      return button;
    }

    function render() {
      const values = [...entries.values()];
      const description = values.map(reportLine);
      onChange({
        description: description.join("\n"),
        conclusion: values.map(reportConclusion).join("\n"),
        hideNegative: values.some(({ kind }) => kind !== "crowding" && kind !== "markings")
      });
      empty.hidden = !form.hidden || entries.size > 0;
      saved.hidden = entries.size === 0;
      picker.setRecorded(values.map(entry => entry.location));
      saved.replaceChildren();
      for (const [id, entry] of entries) {
        const item = document.createElement("li");
        const sentence = document.createElement("p");
        sentence.textContent = reportLine(entry);
        const actions = document.createElement("div");
        actions.className = "lung-button-group";
        actions.append(action("Изменить", "Изменить находку «" + sentence.textContent + "»", () => {
          editing = id;
          form.reset();
          kind.value = entry.kind;
          other.value = entry.other;
          for (const [key, control] of Object.entries(controls)) control.value = entry.descriptors[key] || "";
          picker.setSelection(entry.location);
          setDraft(entry.location, format(entry.location));
          kind.focus();
        }), action("Удалить", "Удалить находку «" + sentence.textContent + "»", () => {
          entries.delete(id);
          if (editing === id) resetDraft();
          render();
        }));
        item.append(sentence, actions);
        saved.append(item);
      }
    }

    controls.structure.addEventListener("input", () => { controls.relation.value = ""; });
    form.addEventListener("input", updateForm);
    clear.addEventListener("click", resetDraft);
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (save.disabled) return;
      entries.set(editing ?? ++nextId, {
        location: current,
        kind: kind.value,
        other: customText(),
        descriptors: Object.fromEntries(Object.entries(controls)
          .filter(([, control]) => !control.disabled && control.value.trim())
          .map(([key, control]) => [key, control.value.trim()]))
      });
      resetDraft();
      render();
    });
    render();
  };
})();
