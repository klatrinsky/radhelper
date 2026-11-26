(function () {
  "use strict";

  const { vessels, statuses } = window.RH_LEG_ARTERIES;
  const thirds = ["upper", "middle", "lower"];
  const calfOrigins = ["верхней трети голени", "средней трети голени", "нижней трети голени"];
  const plaque = ["calcified", "soft", "mixed"];
  const yesNo = ["no", "yes"];
  const labels = { ...statuses, normal: "Норма по шаблону", "multiple-stenosis": "Множественные стенозы" };
  const modeLists = {
    aorta: ["normal", "aneurysm", "stenosis", "occlusion"],
    commonIliac: ["normal", "stenosis", "aneurysm", "occlusion"],
    proximal: ["normal", "stenosis", "occlusion"],
    superficial: ["normal", "stenosis", "multiple-stenosis", "occlusion"],
    popliteal: ["normal", "stenosis", "occlusion", "aneurysm"],
    calf: [null, null, "occlusion"]
  };
  const calfLabels = ["Прослеживается до стопы", "Прослеживается фрагментарно", "", "Не контрастируется", "Гипоплазирована"];
  const segments = {
    "common-iliac": ["ОПА", "commonIliac"],
    "internal-iliac": ["ВПА", "proximal"],
    "external-iliac": ["НПА", "proximal"],
    "common-femoral": ["ОБА", "proximal"],
    "deep-femoral": ["ГБА", "proximal"],
    "superficial-femoral": ["ПБА", "superficial"],
    popliteal: ["ПкА", "popliteal"],
    "anterior-tibial": ["ПББА", "calf"],
    fibular: ["МБА", "calf"],
    "posterior-tibial": ["ЗББА", "calf"]
  };

  function bindings(name, kind, mode) {
    const text = field => ({ field });
    const choice = (group, options) => ({ group, options });
    if (mode === "multiple-stenosis") {
      return { percent: text(name + " %"), location: choice("протяжение " + name, ["all", ...thirds]) };
    }
    if (mode === "stenosis") {
      const fields = { percent: text(name + " %") };
      if (kind !== "popliteal") fields.plaque = choice("бляшка " + name, plaque);
      if (!["aorta", "popliteal"].includes(kind)) fields.length = text(name + " стеноз мм");
      if (kind === "superficial") fields.location = choice("треть " + name, thirds);
      return fields;
    }
    if (mode === "occlusion") {
      if (kind === "calf") return { location: { field: name + " от", origins: calfOrigins } };
      const fields = { length: text(name + " мм") };
      if (kind === "superficial") fields.location = choice("уровень " + name, [...thirds, "all"]);
      return fields;
    }
    if (mode === "aneurysm") {
      if (kind === "aorta") return { diameter: text("ААА D"), length: text("ААА L"), thrombus: choice("тромб ААА", yesNo) };
      if (kind === "popliteal") return { diameter: text(name + " D"), thrombus: choice("тромб " + name, yesNo) };
      return { diameter: text(name + " D") };
    }
    return {};
  }

  const rows = new Map([["aorta", { name: "аорта", kind: "aorta" }]]);
  for (const { id, segment } of vessels) {
    if (!segments[segment]) continue;
    const [name, kind] = segments[segment];
    rows.set(id, { name: name + (id.startsWith("right-") ? " П" : " Л"), kind });
  }

  window.bindLegArteriesTemplate = function (form) {
    const options = id => (modeLists[rows.get(id)?.kind] || []).filter(Boolean);
    function get(id) {
      const row = rows.get(id);
      if (!row) return undefined;
      const { name, kind } = row;
      const { i, edited } = form.group(name);
      if (!i && !edited) return undefined;
      const mode = modeLists[kind][i];
      const aneurysmSite = kind === "aorta" && mode === "aneurysm" ? form.group("локализация ААА").i : 0;
      if (!mode || aneurysmSite) {
        return { assessment: "unassessed", mode: "template-only", lesions: [],
          label: aneurysmSite ? ["", "Юкстаренальная аневризма", "Параренальная аневризма"][aneurysmSite] : calfLabels[i] };
      }
      if (mode === "normal") return { assessment: mode, mode, lesions: [] };
      const lesion = { type: mode === "multiple-stenosis" ? "stenosis" : mode };
      for (const [key, binding] of Object.entries(bindings(name, kind, mode))) {
        if (binding.group) {
          const value = binding.options[form.group(binding.group).i];
          lesion[key] = key === "location" ? [value] : value;
        } else {
          const value = form.field(binding.field);
          if (binding.origins) {
            const index = binding.origins.indexOf(value.trim().toLowerCase());
            lesion.location = index < 0 ? [] : [thirds[index]];
            if (index < 0 && value) lesion.origin = value;
          } else lesion[key] = value;
        }
      }
      return { assessment: null, mode, lesions: [lesion] };
    }
    function setStatus(id, mode) {
      const row = rows.get(id);
      if (!row || !options(id).includes(mode) || get(id)?.mode === mode) return;
      if (row.kind === "aorta" && mode === "aneurysm") form.setGroup("локализация ААА", 0);
      if (row.kind === "calf" && mode === "occlusion" && !form.group(row.name).edited) {
        form.setField(row.name + " от", "");
      }
      form.setGroup(row.name, modeLists[row.kind].indexOf(mode));
    }
    function reset(id) {
      const row = rows.get(id);
      if (!row || get(id)?.mode === "template-only") return;
      for (const mode of options(id)) {
        for (const binding of Object.values(bindings(row.name, row.kind, mode))) {
          if (binding.group) form.setGroup(binding.group, 0, false);
          else form.setField(binding.field, binding.origins ? calfOrigins[0] : "");
        }
      }
      form.setGroup(row.name, 0, false);
    }
    return {
      integrated: true,
      options,
      label: mode => labels[mode],
      get,
      canReset: id => !!get(id) && get(id).mode !== "template-only",
      count: () => [...rows.keys()].filter(id => get(id)).length,
      canConfirm: () => [...rows.keys()].some(id => !get(id) && options(id).includes("normal")),
      setStatus,
      setDetail(id, key, value) {
        const row = rows.get(id);
        if (!row) return;
        const binding = bindings(row.name, row.kind, get(id)?.mode)[key];
        if (!binding) return;
        const selected = key === "location" ? value[0] : value;
        if (binding.group) {
          const index = binding.options.indexOf(selected);
          if (index >= 0) form.setGroup(binding.group, index);
        } else if (binding.origins) {
          form.setField(binding.field, binding.origins[thirds.indexOf(selected)] || "");
        } else form.setField(binding.field, value);
      },
      editor(id) {
        const row = rows.get(id);
        if (!row) return {};
        const mode = get(id)?.mode;
        const fields = bindings(row.name, row.kind, mode);
        return { fields: Object.keys(fields), location: fields.location?.options || (fields.location?.origins && thirds),
          optionalLocation: !!fields.location?.origins,
          locationLabels: row.kind === "superficial" && mode === "occlusion" ? { lower: "Нижняя треть (гунтеров канал)" } : {} };
      },
      reset,
      clear() { for (const id of rows.keys()) reset(id); },
      confirmUnmarked() {
        for (const id of rows.keys()) if (!get(id) && options(id).includes("normal")) setStatus(id, "normal");
      }
    };
  };
})();
