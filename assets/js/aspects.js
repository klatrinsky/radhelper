(function () {
  "use strict";

  // The right hemisphere is on the viewer's left in axial CT orientation.
  const sides = { right: "справа", left: "слева" };
  const levels = [
    {
      title: "На уровне базальных ядер",
      outline: "M146 37 C119 30 94 46 79 65 C62 82 52 107 51 134 C47 152 51 174 60 194 C71 218 91 236 115 244 C127 248 140 248 146 241 C148 220 145 203 147 187 C142 171 147 160 147 145 C151 124 145 107 147 91 C142 74 150 57 146 37 Z",
      grooves: "M127 41 C131 53 116 55 113 64 S113 79 103 79 S94 91 100 98 M90 58 C92 66 85 74 85 82 M141 64 C131 65 126 75 129 84 M65 98 C72 96 80 95 86 101 M53 132 C63 132 71 138 76 130 M83 146 C85 156 74 166 64 163 M60 184 Q70 177 82 182 T95 176 M77 211 C86 205 92 217 100 215 M92 196 Q106 184 117 197 T134 201 M110 239 Q109 221 120 218 T137 222",
      landmarks: "M146 99 C138 91 131 87 123 89 C119 90 120 96 123 106 C126 116 134 124 138 128 L143 131 C143 120 145 109 146 99 Z M145 176 C134 179 126 190 122 204 C132 196 139 196 146 199 Z",
      zones: [
        ["M1", "Передняя корковая зона", "M81 64 Q98 45 121 39 L116 68 Q104 80 101 93 Q91 98 86 113 L59 108 Q66 82 81 64 Z", 85, 83, "frontal"],
        ["M2", "Латеральная корковая зона", "M59 108 L86 113 C79 120 76 135 84 146 Q77 157 79 168 L52 177 Q46 153 51 133 Z", 64, 145, "lateral"],
        ["M3", "Задняя корковая зона", "M52 177 L79 168 Q82 173 90 175 C82 192 101 205 106 214 L112 242 Q85 231 67 208 Q56 196 52 177 Z", 82, 201, "posterior"],
        ["I", "Островковая кора", "M86 113 Q91 105 97 104 Q93 113 95 123 Q95 137 105 146 L98 155 Q88 154 84 146 Q76 130 86 113 Z", 88, 130, "insula"],
        ["C", "Головка хвостатого ядра", "M117 83 Q116 73 128 75 Q141 78 145 92 L145 99 Q134 89 125 89 L123 106 Q115 99 117 83 Z", 126, 85, "caudate"],
        ["L", "Чечевицеобразное ядро", "M105 111 Q113 110 120 116 L129 134 Q124 145 114 147 Q103 142 100 126 Q99 116 105 111 Z", 111, 126, "lentiform"],
        ["IC", "Внутренняя капсула", "M128 120 Q135 129 140 133 L145 152 L139 166 L130 154 L127 144 L130 134 Z", 136, 146, "capsule"]
      ]
    },
    {
      title: "Выше базальных ядер",
      outline: "M146 40 C120 35 96 46 79 65 C61 84 52 108 52 131 C48 158 54 188 70 209 C87 232 117 250 145 242 C149 229 146 213 147 197 C144 183 147 162 146 145 C149 126 143 109 146 93 C145 77 149 59 146 40 Z",
      grooves: "M124 43 Q128 53 117 59 T115 73 Q115 81 103 84 M92 54 C99 67 83 72 84 87 M139 75 C126 79 128 89 121 96 M57 117 C68 110 76 122 86 116 T98 108 M55 148 Q68 143 72 153 T87 157 M63 185 Q76 172 83 180 T97 183 M92 214 Q93 204 102 207 T123 204 M114 235 C109 226 124 222 130 225 T144 224",
      landmarks: "M144 96 C137 101 132 111 132 123 C132 139 135 152 141 160 C145 145 144 119 144 96 Z",
      zones: [
        ["M4", "Передняя корковая зона выше базальных ядер", "M80 64 Q97 46 120 41 L112 67 Q106 78 94 88 Q89 98 89 111 L55 113 Q62 83 80 64 Z", 84, 79, "frontal"],
        ["M5", "Латеральная корковая зона выше базальных ядер", "M55 113 L89 111 C84 128 85 149 92 162 L57 178 Q48 151 52 132 Z", 69, 141, "lateral"],
        ["M6", "Задняя корковая зона выше базальных ядер", "M57 178 L92 162 Q94 174 100 183 L110 211 L120 242 Q89 233 70 209 Q61 196 57 178 Z", 84, 199, "posterior"]
      ]
    }
  ];
  const codes = levels.flatMap(({ zones }) => zones.map(([code]) => code));
  const stateNames = {
    affected: "Ранние ишемические изменения",
    doubtful: "Сомнительно",
    normal: "Без ранних ишемических изменений"
  };

  function scoreGuidance(score, bleeding) {
    if (bleeding === "yes") return "Срочная консультация невролога в связи с внутричерепным кровоизлиянием.";
    const consultation = score === 10
      ? "При сохраняющемся подозрении на ОНМК — срочная консультация невролога."
      : "Срочная консультация невролога.";
    const mri = "При диагностической неопределённости — МРТ головного мозга с DWI, если исследование не задержит неотложную помощь.";
    return bleeding === "no" ? consultation + " " + mri : consultation;
  }

  function interpretScore({ score, side }) {
    if (score === 10) return `Ранние изменения в оценённых зонах СМА ${side} не видны.`;
    return `Зоны бассейна СМА с ранними ишемическими изменениями ${side} — ${10 - score} из 10.`;
  }

  function drawLevel({ title, outline, grooves, landmarks, zones }) {
    return `<figure>
      <figcaption>${title}</figcaption>
      <svg viewBox="0 0 300 273" aria-label="${title}">
        <path class="aspects-skull" d="M150 26 C89 21 53 60 41 110 C24 183 63 241 122 252 Q150 258 178 252 C237 241 276 183 259 110 C247 60 211 21 150 26 Z"/>
        <path class="aspects-skull-inner" d="M150 31 C93 26 58 63 46 111 C31 178 66 236 124 247 Q150 254 176 247 C234 236 269 178 254 111 C242 63 207 26 150 31 Z"/>
        ${Object.entries(sides).map(([side, name], index) => {
          const transform = index ? ' transform="translate(300 0) scale(-1 1)"' : "";
          return `<path class="aspects-brain"${transform} d="${outline}"/>
            <path class="aspects-landmarks"${transform} d="${landmarks}"/>
            <path class="aspects-grooves"${transform} d="${grooves}"/>
            <text class="aspects-orientation" x="${index ? 222 : 78}" y="14">${index ? "Левая сторона" : "Правая сторона"}</text>
            ${zones.map(([code, label, path, x, y, color]) => `<g class="aspects-zone" role="button" tabindex="0"
                data-side="${side}" data-zone="${code}" data-color="${color}" data-label="${code} — ${label}, ${name}">
              <title>${code} — ${label}, ${name}</title>
              <path${transform} d="${path}"/>
              <circle cx="${index ? 300 - x : x}" cy="${y}" r="12"/>
              <text x="${index ? 300 - x : x}" y="${y}">${code}</text>
            </g>`).join("")}`;
        }).join("")}
      </svg>
    </figure>`;
  }

  window.createAspectsPicker = function (root, onChange) {
    const marks = { right: new Map(), left: new Map() };
    root.className = "aspects-picker";
    root.innerHTML = `<summary>Схема ASPECTS</summary>
      <div class="aspects-body">
        <p>Выберите режим и нажмите на зону. Повторное нажатие снимает отметку.</p>
        <div class="stroke-fields">
          <label>Отметка зоны
            <select data-aspects-mode>
              <option value="affected">Ишемические изменения</option>
              <option value="doubtful">Сомнительно</option>
              <option value="normal">Без изменений</option>
            </select>
          </label>
          <label>Сторона для подтверждения
            <select data-aspects-side>
              <option value="">Выберите сторону</option>
              <option value="right">Правая</option>
              <option value="left">Левая</option>
            </select>
          </label>
        </div>
        <div class="aspects-diagrams">${levels.map(drawLevel).join("")}</div>
        <p class="aspects-key">C — головка хвостатого ядра · L — чечевицеобразное ядро · IC — внутренняя капсула · I — островковая кора</p>
        <div class="aspects-actions">
          <button type="button" data-aspects-confirm>Подтвердить отсутствие изменений в остальных зонах</button>
          <button type="button" data-aspects-clear>Очистить сторону</button>
        </div>
        <div role="status" class="aspects-status"></div>
        <aside class="aspects-guidance" hidden>
          <strong>Рекомендации с учётом ASPECTS</strong>
          <div data-aspects-guidance></div>
          <label><input type="checkbox" data-aspects-copy> Добавить рекомендацию в протокол</label>
          <a href="https://doi.org/10.1161/STR.0000000000000513" target="_blank" rel="noopener">Руководство AHA/ASA, 2026</a>
        </aside>
      </div>`;

    const mode = root.querySelector("[data-aspects-mode]");
    const sideField = root.querySelector("[data-aspects-side]");
    const confirm = root.querySelector("[data-aspects-confirm]");
    const clear = root.querySelector("[data-aspects-clear]");
    const status = root.querySelector(".aspects-status");
    const guidance = root.querySelector(".aspects-guidance");
    const guidanceText = root.querySelector("[data-aspects-guidance]");
    const copyGuidance = root.querySelector("[data-aspects-copy]");
    const zones = [...root.querySelectorAll(".aspects-zone")];

    function scores() {
      return Object.entries(marks).flatMap(([side, values]) => {
        if (values.size !== codes.length || [...values.values()].includes("doubtful")) return [];
        const affected = codes.filter(code => values.get(code) === "affected");
        return [{ side: sides[side], score: codes.length - affected.length, affected }];
      });
    }

    function update() {
      for (const zone of zones) {
        const { side, zone: code, label } = zone.dataset;
        const value = marks[side].get(code);
        zone.dataset.state = value || "";
        zone.setAttribute("aria-label", label + ". " + (stateNames[value] || "Не оценена"));
        zone.setAttribute("aria-pressed", String(value === mode.value));
      }
      const selected = marks[sideField.value];
      confirm.disabled = !selected || selected.size === codes.length;
      clear.disabled = !selected?.size;
      const results = scores();
      status.textContent = Object.entries(marks).map(([side, values]) => {
        const result = results.find(item => item.side === sides[side]);
        if (result) return `ASPECTS ${result.side} — ${result.score}/10`;
        const resolved = [...values.values()].filter(value => value !== "doubtful").length;
        return `${side === "right" ? "Справа" : "Слева"} — оценено ${resolved} из 10`;
      }).join("\n");
    }

    function setZone(zone) {
      const { side, zone: code } = zone.dataset;
      const values = marks[side];
      const value = mode.value;
      const remove = values.get(code) === value;
      if (remove) values.delete(code);
      else values.set(code, value);
      sideField.value = side;
      update();
      onChange(remove ? "" : value);
    }

    for (const zone of zones) {
      zone.addEventListener("click", () => setZone(zone));
      zone.addEventListener("keydown", event => {
        if (event.repeat || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        setZone(zone);
      });
    }
    mode.addEventListener("change", update);
    sideField.addEventListener("change", update);
    copyGuidance.addEventListener("change", () => onChange());
    confirm.addEventListener("click", () => {
      const values = marks[sideField.value];
      for (const code of codes) {
        if (!values.has(code)) values.set(code, "normal");
      }
      update();
      onChange();
    });
    clear.addEventListener("click", () => {
      marks[sideField.value].clear();
      update();
      onChange();
    });
    update();

    return {
      scores,
      updateGuidance(bleeding) {
        const results = scores();
        guidance.hidden = !results.length;
        if (!results.length) {
          copyGuidance.checked = false;
          return "";
        }
        const score = Math.min(...results.map(result => result.score));
        const recommendation = scoreGuidance(score, bleeding);
        guidanceText.textContent = [...results.map(interpretScore), recommendation].join(" ");
        return copyGuidance.checked ? "Рекомендации: " + recommendation : "";
      },
      clearAbnormal() {
        for (const values of Object.values(marks)) {
          for (const [code, value] of values) {
            if (value !== "normal") values.delete(code);
          }
        }
        update();
      }
    };
  };
})();
