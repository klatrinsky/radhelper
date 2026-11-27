(function () {
  "use strict";

  const { format, formatConclusion } = window.RH_DISC_LOCATION;
  const regions = {
    cervical: { vertebrae: ["C2", "C3", "C4", "C5", "C6", "C7", "Th1"], initial: "C5–C6" },
    thoracic: { vertebrae: ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12", "L1"], initial: "Th7–Th8" },
    lumbar: { vertebrae: ["L1", "L2", "L3", "L4", "L5", "S1"], initial: "L4–L5" }
  };

  window.createDiscLocationTemplate = function (details, region, onChange) {
    const { vertebrae, initial } = regions[region];
    const levels = vertebrae.slice(0, -1).map((name, i) => name + "–" + vertebrae[i + 1]);
    const results = new Map();
    let showLevel;
    details.className = "disc-scheme";
    details.innerHTML = `<summary>Схема дисков</summary>
      <div class="disc-picker">
        <label class="disc-level">Межпозвонковый уровень <select></select></label>
        <div data-disc-levels></div>
      </div>`;

    function mount() {
      if (!details.open) return;
      details.removeEventListener("toggle", mount);
      const select = details.querySelector("select");
      for (const level of levels) select.add(new Option(level, level));
      select.value = initial;
      showLevel = window.createDiscLevelPicker(select, details.querySelector("[data-disc-levels]"), (result, level) => {
        results.set(level, result);
        onChange();
      });
    }
    details.addEventListener("toggle", mount);

    function descriptionAt(level, inline) {
      const result = results.get(level);
      if (!result) return "";
      const { value, sizeError, canalAreaError } = result;
      return format({ ...value, size: sizeError ? "" : value.size, canalArea: canalAreaError ? "" : value.canalArea }, level, { inline });
    }

    return {
      description: level => level ? descriptionAt(level, true) : levels.map(name => descriptionAt(name, false)).filter(Boolean).join(" "),
      conclusion: () => levels.map(level => formatConclusion(results.get(level)?.value, level)).filter(Boolean).join(" "),
      replaces(name) {
        if (region === "cervical" && name === "грыжа") return levels.some(level => results.get(level)?.value.zones.length);
        return region === "lumbar" && Boolean(results.get(name)?.value.zones.length);
      },
      firstInvalid() {
        for (const level of levels) {
          const result = results.get(level);
          if (!result?.sizeError && !result?.canalAreaError) continue;
          details.open = true;
          const panel = showLevel(level);
          const el = panel.querySelector('input[aria-invalid="true"]');
          return { el, label: el.labels[0].textContent.trim() + " (" + level + ")" };
        }
      }
    };
  };
})();
