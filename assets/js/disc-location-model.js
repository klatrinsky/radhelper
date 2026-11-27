(function (root) {
  "use strict";

  const zones = [
    { id: "central", code: "Ц", label: "Центральная (медианная)", locative: "центральной" },
    { id: "right-subarticular", code: "СА", label: "Правая субартикулярная (парамедианная)", locative: "правой субартикулярной" },
    { id: "left-subarticular", code: "СА", label: "Левая субартикулярная (парамедианная)", locative: "левой субартикулярной" },
    { id: "right-foraminal", code: "Ф", label: "Правая фораминальная", locative: "правой фораминальной" },
    { id: "left-foraminal", code: "Ф", label: "Левая фораминальная", locative: "левой фораминальной" },
    { id: "right-extraforaminal", code: "ЭФ", label: "Правая экстрафораминальная", locative: "правой экстрафораминальной" },
    { id: "left-extraforaminal", code: "ЭФ", label: "Левая экстрафораминальная", locative: "левой экстрафораминальной" }
  ];

  const types = {
    unspecified: { label: "Выпячивание", phrase: "выпячивание диска" },
    protrusion: { label: "Протрузия", phrase: "протрузия диска" },
    hernia: { label: "Грыжа", phrase: "грыжа диска" }
  };

  const migrations = {
    "": { label: "Не указана", phrase: "" },
    cranial: { label: "Краниальная", phrase: "с краниальной миграцией" },
    caudal: { label: "Каудальная", phrase: "с каудальной миграцией" }
  };

  function normalize(value = {}) {
    return {
      zones: zones.filter(zone => value.zones?.includes(zone.id)).map(zone => zone.id),
      type: Object.hasOwn(types, value.type) ? value.type : "unspecified",
      size: String(value.size ?? ""),
      canalArea: String(value.canalArea ?? ""),
      migration: Object.hasOwn(migrations, value.migration) ? value.migration : ""
    };
  }

  function parseSize(value) {
    const input = String(value ?? "").trim();
    if (!input) return "";
    if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(input)) return null;
    const number = Number(input.replace(",", "."));
    if (!Number.isFinite(number) || number <= 0) return null;
    return input.replace(/^[.,]/, "0$&").replace(".", ",");
  }

  function joinList(items) {
    return items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " и " + items.at(-1);
  }

  function format(value, level = "", { inline = false } = {}) {
    const selected = normalize(value);
    const size = parseSize(selected.size);
    const canalArea = parseSize(selected.canalArea);
    if (size === null || canalArea === null) return "";
    const sentences = [];
    if (selected.zones.length) sentences.push(formatProtrusion(selected, level, size, inline));
    if (canalArea) {
      const location = level && !inline ? " на уровне " + level : "";
      sentences.push("Планиметрическая площадь позвоночного канала" + location + " — " + canalArea + " мм².");
    }
    return sentences.join(" ");
  }

  function formatLocation(selected) {
    const places = zones.filter(zone => selected.zones.includes(zone.id)).map(zone => zone.locative);
    return " в " + joinList(places) + (places.length === 1 ? " зоне" : " зонах");
  }

  function formatProtrusion(selected, level, size, inline) {
    const type = types[selected.type].phrase;
    const beginning = inline ? "" : level ? "На уровне " + level + " определяется " : "Определяется ";
    const measurement = size ? " размером " + size + " мм" : "";
    const migration = migrations[selected.migration].phrase;
    return beginning + type + measurement + formatLocation(selected) + (migration ? " " + migration : "") + ".";
  }

  function formatConclusion(value, level) {
    const selected = normalize(value);
    if (!selected.zones.length) return "";
    const type = types[selected.type].label;
    return type + " диска " + level + formatLocation(selected) + ".";
  }

  const model = { zones, types, migrations, normalize, parseSize, format, formatConclusion };
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.RH_DISC_LOCATION = model;
})(globalThis);
