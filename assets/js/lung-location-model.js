(function (root) {
  "use strict";

  const sides = {
    right: { name: "Правое лёгкое", genitive: "правого лёгкого" },
    left: { name: "Левое лёгкое", genitive: "левого лёгкого" }
  };
  const lobeNames = {
    upper: ["Верхняя доля", "верхней"],
    middle: ["Средняя доля", "средней"],
    lower: ["Нижняя доля", "нижней"]
  };
  const lobeSegments = {
    right: {
      upper: [["1", "Верхушечный"], ["2", "Задний"], ["3", "Передний"]],
      middle: [["4", "Латеральный"], ["5", "Медиальный"]],
      lower: [["6", "Верхний"], ["7", "Медиальный базальный"], ["8", "Передний базальный"],
        ["9", "Латеральный базальный"], ["10", "Задний базальный"]]
    },
    left: {
      upper: [["1+2", "Верхушечно-задний"], ["3", "Передний"], ["4", "Верхний язычковый"], ["5", "Нижний язычковый"]],
      lower: [["6", "Верхний"], ["7+8", "Переднемедиальный базальный"], ["9", "Латеральный базальный"], ["10", "Задний базальный"]]
    }
  };
  const fieldNames = {
    upper: ["Верхнее поле", "верхнего"],
    middle: ["Среднее поле", "среднего"],
    lower: ["Нижнее поле", "нижнего"]
  };

  const lobes = Object.entries(lobeSegments).flatMap(([side, entries]) =>
    Object.entries(entries).map(([region, definitions]) => {
      const id = side + "-" + region;
      return {
        id, side, region, name: lobeNames[region][0], adjective: lobeNames[region][1],
        segments: definitions.map(([number, name]) => ({ id: side + "-s" + number, code: "S" + number, name, lobe: id }))
      };
    })
  );
  const segments = lobes.flatMap(lobe => lobe.segments);
  const fields = Object.keys(sides).flatMap(side =>
    Object.entries(fieldNames).map(([region, [name, adjective]]) => ({ id: side + "-" + region, side, region, name, adjective }))
  );

  function normalize(value = {}) {
    const selectedFields = fields.filter(({ id }) => value.fields?.includes(id)).map(({ id }) => id);
    if (selectedFields.length) return { segments: [], lobes: [], fields: selectedFields };
    const selectedLobes = lobes.filter(({ id }) => value.lobes?.includes(id)).map(({ id }) => id);
    return {
      segments: segments.filter(({ id, lobe }) => !selectedLobes.includes(lobe) && value.segments?.includes(id)).map(({ id }) => id),
      lobes: selectedLobes,
      fields: []
    };
  }

  function isSelected(value, type, id) {
    if (value[type].includes(id)) return true;
    return type === "segments" && value.lobes.includes(segments.find(segment => segment.id === id)?.lobe);
  }

  function toggle(value, type, id) {
    const next = normalize(value);
    if (type === "fields") {
      next.lobes = [];
      next.segments = [];
    } else {
      next.fields = [];
    }
    if (type === "segments") {
      const lobe = lobes.find(lobe => lobe.segments.some(segment => segment.id === id));
      if (lobe && next.lobes.includes(lobe.id)) {
        next.lobes = next.lobes.filter(id => id !== lobe.id);
        next.segments.push(...lobe.segments.map(segment => segment.id));
      }
    }
    next[type] = next[type].includes(id) ? next[type].filter(selected => selected !== id) : [...next[type], id];
    return normalize(next);
  }

  function joinList(items) {
    return items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " и " + items.at(-1);
  }

  function format(value, { concise = false } = {}) {
    const selection = normalize(value);
    const parts = [];
    for (const [side, { genitive }] of Object.entries(sides)) {
      const sideFields = fields.filter(field => field.side === side && selection.fields.includes(field.id));
      if (sideFields.length) {
        const names = joinList(sideFields.map(field => field.adjective));
        parts.push("в проекции " + names + (sideFields.length === 1 ? " поля " : " полей ") + genitive);
      }
      const sideLobes = lobes.filter(lobe => lobe.side === side);
      const wholeLobes = sideLobes.filter(lobe => selection.lobes.includes(lobe.id));
      if (wholeLobes.length) {
        const names = joinList(wholeLobes.map(lobe => lobe.adjective));
        parts.push("в " + names + (wholeLobes.length === 1 ? " доле " : " долях ") + genitive);
      }
      if (concise) {
        const codes = sideLobes.flatMap(lobe => lobe.segments)
          .filter(segment => selection.segments.includes(segment.id)).map(segment => segment.code);
        if (codes.length) {
          const prefix = selection.lobes.length ? "в " : "";
          parts.push(prefix + joinList(codes) + " " + genitive);
        }
        continue;
      }
      for (const lobe of sideLobes) {
        const selected = lobe.segments.filter(segment => selection.segments.includes(segment.id));
        if (!selected.length) continue;
        const codes = joinList(selected.map(segment => segment.code));
        parts.push((selected.length === 1 ? "в сегменте " : "в сегментах ") + codes +
          " " + lobe.adjective + " доли " + genitive);
      }
    }
    return joinList(parts);
  }

  const model = { sides, lobes, segments, fields, normalize, isSelected, toggle, format };
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.RH_LUNG_LOCATION = model;
})(globalThis);
