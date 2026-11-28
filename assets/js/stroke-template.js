(function () {
  "use strict";

  const noBleeding = "Внутричерепное кровоизлияние не выявлено.";
  const mcaTerritories = "в бассейнах средних мозговых артерий";
  const noIschemia = "Ранние КТ-признаки ишемии " + mcaTerritories + " не выявлены.";
  const negativeConclusion = "Внутричерепное кровоизлияние и ранние КТ-признаки ишемии " + mcaTerritories + " не выявлены.";
  const sideOptions = '<option value="">Выберите сторону</option><option>справа</option><option>слева</option><option>с обеих сторон</option>';

  window.createStrokeTemplate = function (root, onChange) {
    root.className = "stroke-template";
    root.innerHTML = `
      <button class="stroke-quick" type="button">Подтвердить норму по нативной КТ</button>
      <div class="stroke-fields">
        <label>Внутричерепное кровоизлияние
          <select class="fld" name="bleeding">
            <option value="">Не оценено</option><option value="no">Не выявлено</option><option value="yes">Выявлено</option>
          </select>
        </label>
        <label>Ранние КТ-признаки ишемии
          <select class="fld" name="ischemia">
            <option value="">Не оценены</option><option value="no">Не выявлены в бассейнах СМА</option>
            <option value="doubtful">Сомнительные изменения</option><option value="yes">Убедительные признаки</option>
          </select>
        </label>
      </div>
      <fieldset data-bleeding hidden>
        <legend>Кровоизлияние</legend>
        <div class="stroke-fields">
          <label>Тип кровоизлияния
            <select class="fld" name="type">
              <option value="">Выберите тип</option>
              <option>Внутримозговое кровоизлияние</option><option>Субарахноидальное кровоизлияние</option>
              <option>Внутрижелудочковое кровоизлияние</option><option>Субдуральная гематома</option>
              <option>Эпидуральная гематома</option><option>Внутричерепное кровоизлияние</option>
            </select>
          </label>
          <label>Сторона кровоизлияния
            <select class="fld" name="bleeding-side">${sideOptions}<option value="midline">Срединное / без стороны</option></select>
          </label>
          <label>Локализация кровоизлияния
            <input class="fld" name="bleeding-location" type="text" placeholder="Например, в лобной доле">
          </label>
          <label>Размеры, мм
            <input name="size" type="text" placeholder="Например, 18 x 12 x 10">
          </label>
          <label>Дополнительные характеристики
            <input name="notes" type="text" placeholder="Например, с перифокальным отёком">
          </label>
        </div>
      </fieldset>
      <fieldset data-ischemia hidden>
        <legend>Ишемические изменения</legend>
        <div class="stroke-fields">
          <label>Сторона ишемических изменений
            <select class="fld" name="ischemia-side">${sideOptions}<option value="midline">Срединное / без стороны</option></select>
          </label>
          <label>Локализация ишемических изменений
            <input class="fld" name="ischemia-location" type="text" list="stroke-locations" placeholder="Например, в островковой коре">
          </label>
          <label>Наблюдаемые признаки
            <input name="signs" type="text" list="stroke-signs" placeholder="Например, снижение плотности">
          </label>
        </div>
        <datalist id="stroke-locations">
          <option value="в бассейне средней мозговой артерии"></option>
          <option value="в бассейне передней мозговой артерии"></option>
          <option value="в бассейне задней мозговой артерии"></option>
          <option value="в вертебробазилярном бассейне"></option>
          <option value="в островковой коре"></option>
          <option value="в области базальных ядер"></option>
        </datalist>
        <datalist id="stroke-signs">
          <option value="снижение плотности"></option>
          <option value="сглаженность границы серого и белого вещества"></option>
          <option value="сглаженность борозд"></option>
        </datalist>
      </fieldset>
      <details></details>`;

    const field = name => root.querySelector('[name="' + name + '"]');
    const value = name => field(name).value.trim().replace(/×/g, "x");
    const bleeding = field("bleeding");
    const ischemia = field("ischemia");
    const bleedingFields = root.querySelector("[data-bleeding]");
    const ischemiaFields = root.querySelector("[data-ischemia]");

    const aspects = window.createAspectsPicker(root.querySelector("details"), mark => {
      if (ischemia.value === "no" && (mark === "affected" || mark === "doubtful")) ischemia.value = "";
      refresh();
    });

    function location(kind) {
      const side = value(kind + "-side");
      return [value(kind + "-location"), side === "midline" ? "" : side].filter(Boolean).join(" ");
    }

    function refresh() {
      bleedingFields.hidden = bleeding.value !== "yes";
      ischemiaFields.hidden = !["yes", "doubtful"].includes(ischemia.value);
      const description = [];
      const conclusion = [];
      const signs = ischemiaFields.hidden ? "" : value("signs").replace(/[.]+$/, "");

      if (bleeding.value === "yes") {
        const finding = [value("type") || "Внутричерепное кровоизлияние", location("bleeding")].filter(Boolean).join(" ");
        const size = value("size");
        const notes = value("notes").replace(/[.]+$/, "");
        description.push(finding + (size ? ", размеры " + size + " мм" : "") + (notes ? ", " + notes : "") + ".");
        conclusion.push(finding + ".");
      } else if (bleeding.value === "no") {
        description.push(noBleeding);
      }

      if (ischemia.value === "no") {
        description.push("Ранние КТ-признаки ишемии " + mcaTerritories + " не определяются.");
        conclusion.push(noIschemia);
      } else if (!ischemiaFields.hidden) {
        const where = location("ischemia");
        const label = ischemia.value === "doubtful" ? "Сомнительные ранние КТ-признаки ишемии" : "Ранние КТ-признаки ишемии";
        const finding = [label, where].filter(Boolean).join(" ");
        description.push(finding + (signs ? " (" + signs + ")" : "") + ".");
        conclusion.push(finding + ".");
      }

      if (bleeding.value === "no") conclusion.push(noBleeding);
      if (bleeding.value === "no" && ischemia.value === "no") conclusion.splice(0, conclusion.length, negativeConclusion);

      for (const { side, score, affected } of aspects.scores()) {
        const unit = score === 1 ? "балл" : score >= 2 && score <= 4 ? "балла" : "баллов";
        const line = `ASPECTS ${side} — ${score} ${unit}`;
        const zones = affected.join(", ");
        description.push(zones ? `${line} (${zones}).` : `${line}.`);
        const finding = signs && !/гиподенсив|снижени[ея] плотности/i.test(signs)
          ? "ранних ишемических изменений" : "гиподенсивных изменений";
        const where = affected.length === 1 ? "в зоне" : "в зонах";
        conclusion.push(zones ? `МСКТ-признаки ${finding} ${where} ${zones} ${side} (${line}).` : `${line}.`);
      }
      const recommendations = aspects.updateGuidance(bleeding.value);
      onChange({ description: description.join("\n"), conclusion: conclusion.join("\n"), recommendations });
    }

    function setNegativeIschemia() {
      ischemia.value = "no";
      aspects.clearAbnormal();
    }

    root.querySelector(".stroke-quick").addEventListener("click", () => {
      bleeding.value = "no";
      setNegativeIschemia();
      for (const select of [bleeding, ischemia]) select.classList.remove("miss");
      refresh();
    });
    root.addEventListener("input", event => {
      if (event.target === ischemia && ischemia.value === "no") setNegativeIschemia();
      if (!event.target.closest(".aspects-picker")) refresh();
    });
    refresh();

    return () => {
      const required = ["bleeding", "ischemia"];
      if (!bleedingFields.hidden) required.push("type", "bleeding-side", "bleeding-location");
      if (!ischemiaFields.hidden) required.push("ischemia-side", "ischemia-location");
      return required.filter(name => !value(name)).map(name => {
        const el = field(name);
        return { el, label: el.labels[0].firstChild.textContent.trim() };
      });
    };
  };
})();
