const assert = require("node:assert/strict");
const test = require("node:test");
const { lobes, segments, fields, normalize, isSelected, toggle, format } = require("../assets/js/lung-location-model.js");

test("справочник различает доли, язычковые сегменты и поля правого и левого лёгких", () => {
  assert.deepEqual(lobes.map(lobe => [lobe.id, lobe.segments.map(segment => segment.code)]), [
    ["right-upper", ["S1", "S2", "S3"]],
    ["right-middle", ["S4", "S5"]],
    ["right-lower", ["S6", "S7", "S8", "S9", "S10"]],
    ["left-upper", ["S1+2", "S3", "S4", "S5"]],
    ["left-lower", ["S6", "S7+8", "S9", "S10"]]
  ]);
  assert.match(segments.find(segment => segment.id === "left-s4").name, /язычковый/);
  assert.equal(fields.find(field => field.id === "left-middle").name, "Среднее поле");
});

test("локализация склоняется и сортируется по стороне, доле и номеру сегмента", () => {
  assert.equal(format(), "");
  assert.equal(format({ segments: ["left-s1+2"] }), "в сегменте S1+2 верхней доли левого лёгкого");
  assert.equal(format({ segments: ["right-s3", "right-s1", "right-s2"], lobes: ["left-lower"] }),
    "в сегментах S1, S2 и S3 верхней доли правого лёгкого и в нижней доле левого лёгкого");
  assert.equal(format({ lobes: ["right-middle", "right-upper"] }), "в верхней и средней долях правого лёгкого");
  assert.equal(format({ fields: ["left-middle"] }), "в проекции среднего поля левого лёгкого");
  assert.equal(format({ fields: ["right-lower", "right-upper", "left-upper"] }),
    "в проекции верхнего и нижнего полей правого лёгкого и в проекции верхнего поля левого лёгкого");
});

test("краткая локализация использует коды сегментов и сохраняет доли, поля и стороны", () => {
  const concise = { concise: true };
  assert.equal(format({ segments: ["right-s8"] }, concise), "S8 правого лёгкого");
  assert.equal(format({ segments: ["left-s7+8", "right-s8", "right-s3"] }, concise),
    "S3 и S8 правого лёгкого и S7+8 левого лёгкого");
  assert.equal(format({ segments: ["right-s8"], lobes: ["left-lower"] }, concise),
    "в S8 правого лёгкого и в нижней доле левого лёгкого");
  assert.equal(format({ fields: ["left-middle"] }, concise), "в проекции среднего поля левого лёгкого");
});

test("доля поглощает свои сегменты, а снятие одной отметки сохраняет прочие сегменты и стороны", () => {
  const initial = normalize({ segments: ["right-s1", "left-s3", "right-s1", "left-s2"] });
  const whole = toggle(initial, "lobes", "right-upper");
  assert.deepEqual(initial.segments, ["right-s1", "left-s3"]);
  assert.deepEqual(whole, { segments: ["left-s3"], lobes: ["right-upper"], fields: [] });
  assert.equal(isSelected(whole, "segments", "right-s2"), true);
  const partial = toggle(whole, "segments", "right-s2");
  assert.deepEqual(partial, { segments: ["right-s1", "right-s3", "left-s3"], lobes: [], fields: [] });
  assert.equal(isSelected(partial, "segments", "right-s2"), false);
});

test("поля и анатомическая локализация переключаются без смешивания и не меняют исходное значение", () => {
  const anatomical = normalize({ lobes: ["left-upper"] });
  const projected = toggle(anatomical, "fields", "left-middle");
  assert.deepEqual(projected, { segments: [], lobes: [], fields: ["left-middle"] });
  assert.deepEqual(anatomical.lobes, ["left-upper"]);
  assert.deepEqual(toggle(projected, "lobes", "right-middle"), { segments: [], lobes: ["right-middle"], fields: [] });
});
