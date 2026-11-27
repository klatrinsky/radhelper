(function () {
  "use strict";

  const { sides, lobes, fields, normalize, isSelected, toggle, format } = window.RH_LUNG_LOCATION;
  const diagrams = window.RH_LUNG_DIAGRAM;
  const modes = { segments: "Сегменты", lobes: "Доли", fields: "Лёгочные поля" };
  const projections = { rightLateral: "Правая боковая", front: "Прямая", leftLateral: "Левая боковая" };
  const strips = { upper: [40, 123], middle: [123, 206], lower: [206, 298] };
  let nextId = 0;

  window.createLungLocationPicker = function (root, onChange) {
    const doc = root.ownerDocument;
    const uid = "lung-picker-" + ++nextId;
    root.classList.add("lung-picker");
    root.innerHTML = `
      <div class="lung-picker-tools">
        <div class="lung-button-group" role="group" aria-label="Точность локализации" data-modes></div>
        <div class="lung-button-group" role="group" aria-label="Проекция" data-views></div>
      </div>
      <div class="lung-picker-panels"></div>
      <details>
        <summary>Выбрать из списка</summary>
        <div class="lung-choice-list"></div>
      </details>
    `;
    const modeButtons = root.querySelector("[data-modes]");
    const viewButtons = root.querySelector("[data-views]");
    const panels = root.querySelector(".lung-picker-panels");
    const list = root.querySelector(".lung-choice-list");
    let view = "front";
    let mode = "segments";
    let selection = normalize();
    let recorded = [];

    function svgNode(tag, attributes, label) {
      const element = doc.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      if (label) element.textContent = label;
      return element;
    }

    function button(label, action) {
      const element = doc.createElement("button");
      element.type = "button";
      element.textContent = label;
      element.addEventListener("click", action);
      return element;
    }

    function connect(element, type, id, name) {
      element.dataset.choice = type;
      element.dataset.region = id;
      element.setAttribute("aria-label", name);
      if (element.namespaceURI === "http://www.w3.org/2000/svg") {
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.addEventListener("click", () => choose(type, id));
        element.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          choose(type, id);
        });
        element.append(svgNode("title", {}, name));
      }
    }

    function labelOf(region) {
      return region.name + " · " + sides[region.side].genitive;
    }

    function segmentLabel(segment, lobe) {
      return segment.code + " " + segment.name.toLowerCase() + " сегмент · " + lobe.adjective + " доли " + sides[lobe.side].genitive;
    }

    function chest(svg, front, transform) {
      const anatomy = svgNode("g", { class: "lung-chest", transform, "aria-hidden": "true" });
      if (front) {
        anatomy.append(svgNode("path", { d: "M26 87 Q40 47 101 44 Q156 18 209 30 M474 87 Q460 47 399 44 Q344 18 291 30 M230 36 Q225 72 237 99 L222 130 M270 36 Q275 72 263 99 L278 130 M242 30 L242 294 M258 30 L258 294 M26 293 Q112 237 207 283 M293 296 Q385 247 474 301" }));
        for (const y of [62, 92, 123, 155, 188, 223]) {
          anatomy.append(svgNode("path", { d: "M28 " + (y + 13) + " Q110 " + (y - 37) + " 230 " + y + " M270 " + y + " Q390 " + (y - 37) + " 472 " + (y + 13) }));
        }
      } else {
        anatomy.append(svgNode("path", { d: "M64 41 Q40 70 32 110 L24 277 M73 45 Q53 74 45 113 L36 284 M181 46 Q229 77 253 142 Q271 193 271 250 M75 333 Q136 224 260 263" }));
        for (const y of [79, 108, 140, 173, 208, 243]) {
          anatomy.append(svgNode("path", { d: "M37 " + y + " Q132 " + (y - 44) + " 246 " + (y + 21) }));
        }
      }
      svg.append(anatomy);
    }

    function drawPanel(projection) {
      const front = projection === "front";
      const svg = svgNode("svg", {
        viewBox: front ? "0 0 500 352" : "0 0 290 352",
        role: "group",
        "aria-label": projections[projection] + " проекция"
      });
      const figure = doc.createElement("figure");
      figure.dataset.projection = projection;
      const caption = doc.createElement("figcaption");
      caption.textContent = projections[projection];
      const mirrored = projection === "leftLateral";
      chest(svg, front, front ? "scale(1 1.13)" : mirrored ? "translate(290 0) scale(-1 1)" : "");
      for (const [side, diagram] of Object.entries(diagrams[projection])) {
        const screenLeft = side === "right";
        const xOrigin = front ? (screenLeft ? 21 : 479) : mirrored ? 290 : 0;
        const direction = front ? (screenLeft ? 1 : -1) : mirrored ? -1 : 1;
        const yScale = front ? 1.13 : 1;
        const xScreen = x => xOrigin + x * direction;
        const transform = "translate(" + xOrigin + " 0) scale(" + direction + " " + yScale + ")";
        const lung = svgNode("g", { "data-side": side });
        svg.append(lung);
        lung.append(svgNode("text", { x: front ? xScreen(100) : 145, y: 24, class: "lung-side-title" }, sides[side].name),
          svgNode("path", { d: diagram.outline, transform, class: "lung-base" }));
        if (mode === "fields") {
          const clipId = uid + "-" + side;
          const clip = svgNode("clipPath", { id: clipId });
          clip.append(svgNode("path", { d: diagram.outline, transform }));
          lung.append(clip);
          for (const field of fields.filter(field => field.side === side)) {
            const [top, bottom] = strips[field.region];
            const group = svgNode("g", { class: "lung-area" });
            connect(group, "fields", field.id, labelOf(field));
            group.append(svgNode("rect", { x: screenLeft ? 0 : 250, y: top * yScale, width: 250, height: (bottom - top) * yScale, "clip-path": "url(#" + clipId + ")" }),
              svgNode("text", { x: xScreen(109), y: (top + bottom) * yScale / 2 }, field.name.split(" ")[0]));
            lung.append(group);
          }
        } else {
          for (const lobe of lobes.filter(lobe => lobe.side === side)) {
            const group = svgNode("g", { "data-lobe": lobe.region });
            const wholeLobe = mode === "lobes";
            if (wholeLobe) connect(group, "lobes", lobe.id, labelOf(lobe));
            for (const segment of lobe.segments) {
              const shape = diagram.segments[segment.code.slice(1)];
              if (!shape) continue;
              const [d, x, y] = shape;
              const path = svgNode("path", { d, transform });
              if (wholeLobe) {
                path.dataset.segment = segment.id;
                group.append(path);
              } else {
                const area = svgNode("g", { class: "lung-area" });
                connect(area, "segments", segment.id, segmentLabel(segment, lobe));
                area.append(path, svgNode("text", { x: xScreen(x), y: y * yScale }, segment.code));
                group.append(area);
              }
            }
            if (wholeLobe) {
              const [x, y] = diagram.lobes[lobe.region];
              group.classList.add("lung-area", "lung-whole-lobe");
              group.append(svgNode("text", { x: xScreen(x), y: y * yScale }, lobe.name.split(" ")[0]));
            }
            lung.append(group);
          }
          lung.append(svgNode("path", { d: diagram.fissures, transform, class: "lung-fissures" }));
        }
        lung.append(svgNode("path", { d: diagram.outline, transform, class: "lung-outline" }));
      }
      figure.append(caption, svg);
      return figure;
    }

    function drawList() {
      list.replaceChildren();
      const type = mode;
      const entries = mode === "fields" ? fields : lobes;
      for (const [side, { name }] of Object.entries(sides)) {
        const group = doc.createElement("fieldset");
        const legend = doc.createElement("legend");
        legend.textContent = name;
        group.append(legend);
        for (const region of entries.filter(entry => entry.side === side)) {
          for (const item of type === "segments" ? region.segments : [region]) {
            const label = type === "segments" ? segmentLabel(item, region) : labelOf(item);
            const control = button(type === "segments" ? item.code + " · " + item.name : item.name, () => choose(type, item.id));
            connect(control, type, item.id, label);
            group.append(control);
          }
        }
        list.append(group);
      }
    }

    function paint() {
      for (const element of root.querySelectorAll("[data-choice]")) {
        const { choice, region } = element.dataset;
        element.setAttribute("aria-pressed", String(isSelected(selection, choice, region)));
        element.toggleAttribute("data-recorded", recorded.some(value => isSelected(value, choice, region)));
      }
      for (const path of panels.querySelectorAll("[data-segment]")) {
        const id = path.dataset.segment;
        path.toggleAttribute("data-partial-selection", selection.segments.includes(id));
        path.toggleAttribute("data-partial-recorded", recorded.some(value => value.segments.includes(id)));
      }
    }

    function showView() {
      for (const figure of panels.children) figure.toggleAttribute("data-current-view", figure.dataset.projection === view);
      for (const button of viewButtons.children) button.setAttribute("aria-pressed", String(button.dataset.view === view));
    }

    function draw() {
      viewButtons.hidden = mode === "fields";
      panels.toggleAttribute("data-fields-mode", mode === "fields");
      for (const button of modeButtons.children) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      const visible = mode === "fields" ? ["front"] : Object.keys(projections);
      panels.replaceChildren(...visible.map(drawPanel));
      drawList();
      showView();
      paint();
    }

    function choose(type, id) {
      selection = toggle(selection, type, id);
      paint();
      onChange(normalize(selection), format(selection));
    }

    for (const [key, label] of Object.entries(modes)) {
      const control = button(label, () => { mode = key; draw(); });
      control.dataset.mode = key;
      modeButtons.append(control);
    }
    for (const [key, label] of Object.entries(projections)) {
      const control = button(label, () => { view = key; showView(); });
      control.dataset.view = key;
      viewButtons.append(control);
    }
    draw();
    return {
      setSelection(value) {
        selection = normalize(value);
        if (value) {
          mode = Object.keys(modes).find(key => selection[key].length) || mode;
          draw();
        } else paint();
      },
      setRecorded(values) {
        recorded = values;
        paint();
      }
    };
  };
})();
