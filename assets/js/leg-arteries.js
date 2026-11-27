(function () {
  "use strict";

  const { groups, vessels, statuses, fieldOptions, locations, lesionFields, numericFields, numericValue,
    statusOf, visualState, createAssessment } = window.RH_LEG_ARTERIES;
  window.createLegArteriesDiagram = function (root, state, onChange = () => {}) {
    root.classList.add("leg-arteries");
    root.innerHTML = `
      <div class="diagram-layout">
        <figure class="card diagram-card">
          <figcaption id="vessel-caption">Справа и слева указаны стороны пациента</figcaption>
          <svg id="artery-diagram" viewBox="0 0 360 524" role="group"
            aria-label="Интерактивная схема артерий нижних конечностей, вид спереди"></svg>
        </figure>
        <aside class="card controls" aria-labelledby="legend-title">
          <h2 id="legend-title">Условные обозначения</h2>
          <ul class="legend">
            ${state.integrated ? '<li><span class="swatch" data-visual="template-normal"></span>Норма по шаблону, не подтверждена</li>' : ""}
            <li><span class="swatch" data-visual="normal"></span>${state.integrated ? state.label("normal") : "Без патологии"}</li>
            <li><span class="swatch" data-visual="stenosis-low"></span>Стеноз менее 50%</li>
            <li><span class="swatch" data-visual="stenosis-middle"></span>${state.integrated ? "Стеноз от 50%, менее 70%" : "Стеноз 50–69%"}</li>
            <li><span class="swatch" data-visual="stenosis-high"></span>${state.integrated ? "Стеноз от 70%, менее 100%" : "Стеноз 70–99%"}</li>
            <li><span class="swatch" data-visual="stenosis-pending"></span>Стеноз, процент не указан</li>
            <li><span class="swatch" data-visual="occlusion"></span>Окклюзия</li>
            <li><span class="swatch" data-visual="aneurysm"></span>Аневризматическое расширение</li>
            <li><span class="swatch" data-visual="unassessed"></span>${state.integrated ? "Нет оценки на схеме" : "Не отмечен или не оценивался"}</li>
            <li><span class="swatch" data-visual="limited"></span>Оценка ограничена</li>
          </ul>
          <p class="muted">Цветовые диапазоны стеноза служат для визуальной индикации.</p>
          ${state.integrated ? '<p class="muted artery-template-note">Норма по шаблону уже входит в копируемый текст. Кнопка подтверждает её для всех бледно-красных сосудов.</p>' : ""}
          <div class="diagram-actions">
            <p id="progress" role="status"></p>
            <button type="button" id="confirm-unmarked">${state.integrated ? "Подтвердить норму по шаблону" : "Подтвердить норму для неотмеченных"}</button>
            <button type="button" id="reset-diagram" disabled>Сбросить схему</button>
          </div>
        </aside>
      </div>
    <dialog id="vessel-editor" aria-labelledby="editor-title">
      <h2 id="editor-title"></h2>
      <label class="field">
        <span>Состояние</span>
        <select id="vessel-status" autofocus></select>
      </label>
      <div class="fields" id="lesion-fields"></div>
      <div class="editor-actions">
        <button type="button" id="reset-vessel">Сбросить сосуд</button>
        <button type="button" class="primary" id="close-editor">Готово</button>
      </div>
    </dialog>
    `;
    const byId = id => root.querySelector("#" + id);
    const svg = byId("artery-diagram");
    const caption = byId("vessel-caption");
    const captionDefault = caption.textContent;
    const dialog = byId("vessel-editor");
    const statusSelect = byId("vessel-status");
    const fields = byId("lesion-fields");
    const confirm = byId("confirm-unmarked");
    const reset = byId("reset-diagram");
    const progress = byId("progress");
    const resetVessel = byId("reset-vessel");
    const nodes = new Map();
    const canReset = id => state.canReset ? state.canReset(id) : !!state.get(id);
    let editing = null;
    let hovered = null;
    let focused = null;

    // Вид спереди. Координаты артерий слева получаются отражением правой стороны пациента.
    // Типичное ветвление ниже колена показано на КТА: https://pubmed.ncbi.nlm.nih.gov/28219004/
    const anatomy = {
      aorta: ["M180 40 V80", 215, 56, "Аорта"],
      "common-iliac": ["M180 80 C169 88 144 94 124 122", 130, 87, "ОПА"],
      "internal-iliac": ["M124 122 Q145 139 145 169", 155, 124, "ВПА"],
      "external-iliac": ["M124 122 Q110 145 107 180", 82, 147, "НПА"],
      "common-femoral": ["M107 180 Q103 195 102 220", 72, 194, "ОБА"],
      "deep-femoral": ["M102 220 Q131 230 138 283", 151, 244, "ГБА"],
      "superficial-femoral": ["M102 220 Q95 254 100 307", 70, 268, "ПБА"],
      popliteal: ["M100 307 Q103 326 97 355", 72, 328, "ПодкА"],
      "anterior-tibial": ["M97 355 Q60 376 55 421 L53 505", 31, 407, "ПБбА"],
      tibioperoneal: ["M97 355 Q111 371 112 396", 137, 370, "ТПС"],
      fibular: ["M112 396 Q96 435 94 488", 88, 500, "МБА"],
      "posterior-tibial": ["M112 396 Q130 428 127 507", 153, 452, "ЗБбА"]
    };
    const fieldLabels = {
      percent: "Стеноз, %",
      length: "Протяжённость, мм",
      plaque: "Характер бляшки",
      reconstitution: "Восстановление контрастирования дистальнее окклюзии",
      diameter: "Максимальный диаметр, мм",
      thrombus: "Пристеночные тромботические массы"
    };

    function createSvg(tag, attributes, text) {
      const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      if (text) element.textContent = text;
      return element;
    }

    function updateCaption() {
      const node = nodes.get(hovered || focused);
      caption.textContent = node ? node.group.getAttribute("aria-label") : captionDefault;
    }

    function drawDiagram() {
      svg.append(createSvg("path", { d: "M15 177 H345 M15 303 H345 M15 351 H345",
        class: "region-lines", "aria-hidden": "true" }));
      for (const { side, label, vessels } of groups) {
        const mirrored = side === "left";
        const xSide = mirrored ? 270 : 90;
        const width = 360;
        if (side !== "central") svg.append(createSvg("text", { x: xSide, y: 25, class: "side-label" }, label));
        for (const { id, segment, name } of vessels) {
          const [d, x, y, abbreviation] = anatomy[segment];
          const labelX = mirrored ? width - x : x;
          const labelWidth = abbreviation.length > 4 ? 42 : 37;
          const transform = mirrored ? "translate(360 0) scale(-1 1)" : "";
          const fullName = side === "central" ? name : name + " · " + label.toLowerCase();
          const group = createSvg("g", { role: "button", tabindex: 0, class: "artery-segment",
            "data-vessel": id, "aria-haspopup": "dialog" });
          const tooltip = createSvg("title", {}, fullName);
          const strokeWidth = id === "aorta" ? 8 : 6;
          group.append(tooltip,
            createSvg("path", { d, transform, class: "vessel-hit" }),
            createSvg("path", { d, transform, class: "vessel-highlight", "stroke-width": strokeWidth + 6 }),
            createSvg("path", { d, transform, class: "vessel-keyline", "stroke-width": strokeWidth + 3 }),
            createSvg("path", { d, transform, class: "vessel-line", "stroke-width": strokeWidth }),
            createSvg("rect", { x: labelX - labelWidth / 2, y: y - 15, width: labelWidth, height: 28, rx: 6, class: "vessel-chip" }),
            createSvg("text", { x: labelX, y: y + 3, class: "vessel-label", "aria-hidden": "true" }, abbreviation));
          group.addEventListener("pointerenter", event => {
            if (event.pointerType === "touch") return;
            hovered = id;
            updateCaption();
          });
          group.addEventListener("pointerleave", () => {
            if (hovered === id) hovered = null;
            updateCaption();
          });
          group.addEventListener("focus", () => { focused = id; updateCaption(); });
          group.addEventListener("blur", () => { focused = null; updateCaption(); });
          group.addEventListener("click", () => openEditor(id));
          group.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            openEditor(id);
          });
          nodes.set(id, { group, fullName, tooltip });
          svg.append(group);
        }
      }
    }

    function renderVessel(id) {
      const { group, tooltip, fullName } = nodes.get(id);
      const entry = state.get(id);
      const status = statusOf(entry);
      const rawDegree = status === "stenosis" ? entry.lesions[0].percent : "";
      const value = Number(rawDegree?.trim().replace(",", "."));
      const degree = state.integrated ? (value > 0 && value < 100 ? value : null) : numericValue("percent", rawDegree);
      group.dataset.visual = visualState(entry, degree);
      const mode = entry?.mode || status;
      const statusLabel = (entry?.label || state.label?.(mode) || statuses[status] || (state.options?.(id).length === 0 ?
        "Поля в шаблоне нет" : "Не отмечен")) + (degree === null ? "" : " " + degree + "%");
      const label = fullName + " — " + statusLabel;
      group.setAttribute("aria-label", label);
      tooltip.textContent = label;
      if (editing === id) resetVessel.disabled = !canReset(id);
      updateCaption();
    }

    function renderReport() {
      const marked = state.count();
      const progressText = "Отмечено " + marked + " из " + vessels.length + " сосудов";
      if (progress.textContent !== progressText) progress.textContent = progressText;
      confirm.disabled = state.canConfirm ? !state.canConfirm() : marked === vessels.length;
      reset.disabled = !vessels.some(({ id }) => canReset(id));
      onChange();
    }

    function renderAll() {
      for (const { id } of vessels) renderVessel(id);
      renderReport();
    }

    function locationButtons(location = [], editor) {
      const group = document.createElement("fieldset");
      group.className = "location-field";
      const legend = document.createElement("legend");
      legend.textContent = "Локализация в сосуде";
      group.append(legend);
      const choices = document.createElement("div");
      choices.className = "location-choices";
      group.append(choices);
      const selected = new Set(location);
      const buttons = new Map();
      function updatePressed() {
        for (const [value, button] of buttons) {
          button.setAttribute("aria-pressed", String(value ? selected.has(value) : selected.size === 0));
        }
      }
      const keys = editor?.location || Object.keys(locations);
      const labels = keys.map(value => [value, editor?.locationLabels?.[value] ||
        (value === "all" ? "На всём протяжении" : locations[value] + " треть")]);
      if (!editor || editor.optionalLocation) labels.unshift(["", "Без уточнения"]);
      for (const [value, label] of labels) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          if (!value) selected.clear();
          else if (editor) { selected.clear(); selected.add(value); }
          else if (selected.has(value)) selected.delete(value);
          else selected.add(value);
          state.setDetail(editing, "location", [...selected]);
          if (editor?.optionalLocation) fields.querySelector(".artery-editor-note")?.remove();
          updatePressed();
          renderReport();
        });
        buttons.set(value, button);
        choices.append(button);
      }
      updatePressed();
      return group;
    }

    function showFields() {
      const entry = state.get(editing);
      const options = state.options?.(editing) || Object.keys(statuses);
      const pending = entry?.mode === "template-normal";
      statusSelect.replaceChildren(pending
        ? new Option(state.label(entry.mode), entry.mode, true, true)
        : new Option("Выберите состояние", "", true, true));
      statusSelect.options[0].disabled = true;
      for (const mode of options) statusSelect.add(new Option(state.label?.(mode) || statuses[mode], mode));
      if (entry?.label) {
        const option = new Option(entry.label, entry.mode);
        option.disabled = true;
        statusSelect.add(option);
      }
      statusSelect.disabled = !options.length;
      statusSelect.value = entry?.mode || statusOf(entry);
      const lesion = entry?.lesions[0];
      const editor = state.editor?.(editing);
      fields.replaceChildren();
      if (!options.length || entry?.label || lesion?.origin) {
        const note = document.createElement("p");
        note.className = "muted artery-editor-note";
        note.textContent = !options.length ? "В шаблоне нет отдельного поля для этого сосуда." :
          entry?.label ? "Это состояние редактируется в полях шаблона." : "Начало окклюзии по шаблону — от " + lesion.origin + ".";
        fields.append(note);
      }
      for (const key of editor?.fields || lesionFields[lesion?.type] || []) {
        if (key === "location") {
          fields.append(locationButtons(lesion.location, editor));
          continue;
        }
        const options = state.integrated && key === "plaque" ?
          { soft: "Мягкая", mixed: "Комбинированная", calcified: "Кальцинированная" } : fieldOptions[key];
        const rules = numericFields[key];
        const label = document.createElement("label");
        label.className = "field";
        const title = document.createElement("span");
        title.id = "artery-label-" + key;
        title.textContent = fieldLabels[key];
        const control = document.createElement(options ? "select" : "input");
        if (options) {
          control.add(new Option("Не указано", ""));
          for (const [value, text] of Object.entries(options)) control.add(new Option(text, value));
        } else if (rules) {
          control.type = state.integrated ? "text" : "number";
          control.inputMode = !state.integrated && rules.step === 1 ? "numeric" : "decimal";
          control.min = rules.min;
          control.step = rules.step;
          if (rules.max !== undefined) control.max = rules.max;
        }
        control.setAttribute("aria-labelledby", title.id);
        control.value = lesion[key] ?? "";
        label.append(title, control);
        let showError = () => {};
        if (rules && !state.integrated) {
          const error = document.createElement("small");
          error.id = "artery-error-" + key;
          error.textContent = rules.error;
          error.className = "field-error";
          label.append(error);
          showError = () => {
            const invalid = control.validity.badInput || (control.value !== "" && numericValue(key, control.value) === null);
            control.setAttribute("aria-invalid", String(invalid));
            if (invalid) control.setAttribute("aria-describedby", error.id);
            else control.removeAttribute("aria-describedby");
            error.hidden = !invalid;
          };
          showError();
        }
        control.addEventListener(options ? "change" : "input", () => {
          state.setDetail(editing, key, control.value);
          showError();
          renderVessel(editing);
          renderReport();
        });
        fields.append(label);
      }
      resetVessel.disabled = !canReset(editing);
    }

    function openEditor(id) {
      if (dialog.open) return;
      finishEditor();
      editing = id;
      const { group, fullName } = nodes.get(id);
      group.dataset.editing = "true";
      byId("editor-title").textContent = fullName;
      showFields();
      dialog.showModal();
    }

    statusSelect.addEventListener("change", () => {
      state.setStatus(editing, statusSelect.value);
      showFields();
      renderVessel(editing);
      renderReport();
    });
    resetVessel.addEventListener("click", () => {
      state.reset(editing);
      showFields();
      renderVessel(editing);
      renderReport();
      statusSelect.focus();
    });
    function finishEditor() {
      if (editing === null || dialog.open) return;
      const { group } = nodes.get(editing);
      delete group.dataset.editing;
      editing = null;
      group.focus({ preventScroll: true });
    }
    byId("close-editor").addEventListener("click", () => {
      dialog.close();
      finishEditor();
    });
    dialog.addEventListener("close", finishEditor);
    confirm.addEventListener("click", () => {
      state.confirmUnmarked();
      renderAll();
      reset.focus();
    });
    reset.addEventListener("click", () => {
      state.clear();
      renderAll();
      confirm.focus();
    });
    drawDiagram();
    renderAll();
    return renderAll;
  };

  const standalone = document.getElementById("standalone-arteries");
  if (!standalone) return;
  const state = createAssessment();
  const byId = id => document.getElementById(id);
  const copyStatus = byId("copy-status");
  const copyButtons = [...document.querySelectorAll("[data-copy]")];
  let report;
  let noticeTimeout;
  window.createLegArteriesDiagram(standalone, state, () => {
    report = state.report();
    for (const button of copyButtons) {
      const key = button.dataset.copy;
      byId(key).textContent = report[key] || "Нет отмеченных сосудов.";
      button.disabled = !report[key];
    }
    copyStatus.textContent = "";
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const field = document.createElement("textarea");
      const previous = document.activeElement;
      field.value = text;
      field.readOnly = true;
      field.className = "clipboard-buffer";
      document.body.append(field);
      field.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } finally {
        field.remove();
        previous?.focus({ preventScroll: true });
      }
      return copied;
    }
  }

  for (const button of copyButtons) {
    button.addEventListener("click", async () => {
      const copied = await copyText(report[button.dataset.copy]).catch(() => false);
      copyStatus.textContent = copied ? "Скопировано" : "Выделите текст и скопируйте вручную";
      clearTimeout(noticeTimeout);
      noticeTimeout = setTimeout(() => { copyStatus.textContent = ""; }, 2500);
    });
  }

})();
