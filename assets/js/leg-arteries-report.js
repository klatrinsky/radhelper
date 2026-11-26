(function () {
  "use strict";

  const pairedVessels = [
    ["common-iliac", "Общая подвздошная артерия"],
    ["internal-iliac", "Внутренняя подвздошная артерия"],
    ["external-iliac", "Наружная подвздошная артерия"],
    ["common-femoral", "Общая бедренная артерия"],
    ["deep-femoral", "Глубокая бедренная артерия"],
    ["superficial-femoral", "Поверхностная бедренная артерия"],
    ["popliteal", "Подколенная артерия"],
    ["anterior-tibial", "Передняя большеберцовая артерия"],
    ["tibioperoneal", "Тибиоперонеальный ствол"],
    ["fibular", "Малоберцовая артерия"],
    ["posterior-tibial", "Задняя большеберцовая артерия"]
  ];
  const groups = [
    { side: "central", label: "Аорта", vessels: [
      { id: "aorta", segment: "aorta", name: "Инфраренальный отдел брюшной аорты" }
    ] },
    ...[["right", "Справа"], ["left", "Слева"]].map(([side, label]) => ({
      side, label, vessels: pairedVessels.map(([segment, name]) => ({ id: side + "-" + segment, segment, name }))
    }))
  ];
  const vessels = groups.flatMap(group => group.vessels);
  const ids = new Set(vessels.map(vessel => vessel.id));
  const statuses = {
    normal: "Без патологии",
    stenosis: "Стеноз",
    occlusion: "Окклюзия",
    aneurysm: "Аневризматическое расширение",
    limited: "Оценка ограничена",
    unassessed: "Не оценивался"
  };
  const fieldOptions = {
    plaque: { soft: "Некальцинированная", mixed: "Смешанная", calcified: "Кальцинированная" },
    reconstitution: { yes: "Есть", no: "Нет" },
    thrombus: { yes: "Есть", no: "Нет" }
  };
  const locations = { upper: "Верхняя", middle: "Средняя", lower: "Нижняя" };
  const lesionFields = {
    stenosis: ["location", "percent", "length", "plaque"],
    occlusion: ["location", "length", "reconstitution"],
    aneurysm: ["location", "diameter", "length", "thrombus"]
  };
  const numericFields = {
    percent: { min: 1, max: 99, step: 1, error: "Введите целое число от 1 до 99." },
    length: { min: 0, step: "any", error: "Введите число больше нуля." },
    diameter: { min: 0, step: "any", error: "Введите число больше нуля." }
  };
  function numericValue(key, raw) {
    const rules = numericFields[key];
    const text = String(raw ?? "").trim().replace(",", ".");
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || value <= 0 || value < rules.min) return null;
    if (rules.step === 1 && (!Number.isInteger(value) || value > rules.max)) return null;
    return value;
  }

  function statusOf(entry) {
    return entry?.lesions[0]?.type || entry?.assessment || "";
  }

  function visualState(entry, degree = numericValue("percent", entry?.lesions[0]?.percent)) {
    const status = statusOf(entry);
    if (status !== "stenosis") return status || "unassessed";
    if (degree === null) return "stenosis-pending";
    if (degree < 50) return "stenosis-low";
    if (degree < 70) return "stenosis-middle";
    return "stenosis-high";
  }

  function measurement(key, raw, label) {
    const value = numericValue(key, raw);
    if (value === null) return "";
    return label + " " + String(raw).trim().replace(".", ",") + " мм";
  }

  function locationText(location = []) {
    const thirds = location.map(key => locations[key].toLowerCase());
    if (!thirds.length) return "";
    if (thirds.length === 1) return "локализация — " + thirds[0] + " треть";
    return "локализация — " + thirds.slice(0, -1).join(", ") + " и " + thirds.at(-1) + " трети";
  }

  function lesionText(lesion, concise) {
    const { type, percent, location, length, plaque, reconstitution, diameter, thrombus } = lesion;
    const site = locationText(location);
    const extent = concise ? "" : measurement("length", length, "протяжённость");
    if (type === "stenosis") {
      const degree = numericValue("percent", percent);
      const stenosis = degree === null ? "стеноз (процент не указан)" : "стеноз " + degree + "%";
      const plaqueType = !concise && fieldOptions.plaque[plaque];
      return [stenosis, site, extent, plaqueType && plaqueType.toLowerCase() + " бляшка"].filter(Boolean).join(", ");
    }
    if (type === "occlusion") {
      const distal = { yes: "дистальнее контрастирование восстанавливается",
        no: "дистальнее контрастирование не восстанавливается" }[reconstitution];
      return ["окклюзия", site, extent, distal].filter(Boolean).join(", ");
    }
    const maxSize = measurement("diameter", diameter, "максимальный диаметр");
    const masses = { yes: "с пристеночными тромботическими массами",
      no: "без пристеночных тромботических масс" }[thrombus];
    return ["аневризматическое расширение", site, maxSize, extent, masses].filter(Boolean).join(", ");
  }

  function vesselText(vessel, entry, concise) {
    const findings = entry.lesions.map(lesion => lesionText(lesion, concise));
    const summary = findings.length ? findings.join("; ") : {
      normal: "без патологических изменений",
      limited: "оценка ограничена",
      unassessed: "оценка не проводилась"
    }[entry.assessment];
    return vessel.name + " — " + summary + ".";
  }

  function generateReport(entries) {
    const description = [];
    const conclusion = [];
    for (const group of groups) {
      const marked = group.vessels.filter(vessel => entries.has(vessel.id));
      if (!marked.length) continue;
      const findings = marked.filter(vessel => statusOf(entries.get(vessel.id)) !== "normal");
      const heading = group.label + ":\n";
      description.push(heading + marked.map(vessel => vesselText(vessel, entries.get(vessel.id), false)).join("\n"));
      const summary = findings.length ? findings : marked;
      const allNormal = !findings.length && marked.length === group.vessels.length && group.side !== "central";
      conclusion.push(heading + (allNormal ? "В артериях, представленных на схеме, патологических изменений не выявлено." :
        summary.map(vessel => vesselText(vessel, entries.get(vessel.id), true)).join("\n")));
    }
    return { description: description.join("\n\n"), conclusion: conclusion.join("\n\n") };
  }

  function createAssessment() {
    const entries = new Map();
    function setStatus(id, status) {
      if (!ids.has(id) || !Object.hasOwn(statuses, status)) return;
      const previous = entries.get(id);
      if (statusOf(previous) === status) return;
      const isLesion = Object.hasOwn(lesionFields, status);
      entries.set(id, {
        assessment: isLesion ? null : status,
        lesions: isLesion ? [{ type: status }] : [],
        interventions: previous?.interventions ?? []
      });
    }
    function setDetail(id, key, rawValue) {
      const lesion = entries.get(id)?.lesions[0];
      if (!lesion || !lesionFields[lesion.type].includes(key)) return;
      if (key === "location") {
        if (Array.isArray(rawValue)) lesion.location = Object.keys(locations).filter(third => rawValue.includes(third));
        return;
      }
      const value = String(rawValue).trim();
      const options = fieldOptions[key];
      lesion[key] = options && !Object.hasOwn(options, value) ? "" : value;
    }
    return {
      get: id => entries.get(id),
      count: () => entries.size,
      setStatus,
      setDetail,
      reset: id => entries.delete(id),
      clear: () => entries.clear(),
      confirmUnmarked() {
        for (const { id } of vessels) if (!entries.has(id)) setStatus(id, "normal");
      },
      report: () => generateReport(entries)
    };
  }

  const api = { groups, vessels, statuses, fieldOptions, locations, lesionFields, numericFields, numericValue,
    statusOf, visualState, createAssessment };
  if (typeof module === "object" && module.exports) module.exports = api;
  else window.RH_LEG_ARTERIES = api;
})();
