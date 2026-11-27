const assert = require("node:assert/strict");
const test = require("node:test");
const { zones, normalize, parseSize, format } = require("../assets/js/disc-location-model.js");

test("семь зон содержат центральную и три пары с обозначением стороны", () => {
  assert.deepEqual(zones.map(zone => zone.id), [
    "central", "right-subarticular", "left-subarticular", "right-foraminal", "left-foraminal",
    "right-extraforaminal", "left-extraforaminal"
  ]);
  assert.deepEqual(normalize({ zones: ["left-foraminal", "unknown", "central", "central"] }).zones,
    ["central", "left-foraminal"]);
});

test("размер сохраняет точность, принимает точку и запятую и отклоняет некорректный ввод", () => {
  for (const [value, expected] of [["", ""], [" 3,20 ", "3,20"], ["3.20", "3,20"], [".5", "0,5"]]) {
    assert.equal(parseSize(value), expected);
  }
  for (const value of ["0", "0,00", "-1", "2e1", "3,2.5", "5 мм", "3 4"]) {
    assert.equal(parseSize(value), null, value);
  }
});

test("описание согласует одну или несколько зон и переносит только выбранные признаки", () => {
  assert.equal(format({ size: "5", migration: "caudal" }, "L4–L5"), "");
  assert.equal(format({ zones: ["central"], size: "-1" }, "L4–L5"), "");
  assert.equal(format({ zones: ["central"] }),
    "Определяется выпячивание диска в центральной зоне.");
  assert.equal(format({ zones: ["left-foraminal"], type: "protrusion", size: "3.5", migration: "caudal" }, "C5–C6"),
    "На уровне C5–C6 определяется протрузия диска размером 3,5 мм в левой фораминальной зоне с каудальной миграцией.");
  assert.equal(format({ zones: ["left-extraforaminal", "right-subarticular", "central"], type: "hernia", migration: "cranial" }, "Th7–Th8"),
    "На уровне Th7–Th8 определяется грыжа диска в центральной, правой субартикулярной и левой экстрафораминальной зонах с краниальной миграцией.");
  assert.equal(format({ zones: ["right-subarticular"], size: "15", type: "extrusion" }, "L5–S1"),
    "На уровне L5–S1 определяется выпячивание диска размером 15 мм в правой субартикулярной зоне.");
});
