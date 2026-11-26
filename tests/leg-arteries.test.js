const test = require("node:test");
const assert = require("node:assert/strict");
const { createAssessment, statusOf, visualState, vessels } = require("../assets/js/leg-arteries-report.js");

function mark(assessment, id, status, details = {}) {
  assessment.setStatus(id, status);
  for (const [key, value] of Object.entries(details)) assessment.setDetail(id, key, value);
}

test("описание и заключение группируют сосуды по сторонам в анатомическом порядке", () => {
  const assessment = createAssessment();
  mark(assessment, "left-popliteal", "limited");
  mark(assessment, "right-posterior-tibial", "occlusion", {
    location: ["middle"], length: "31.5", reconstitution: "yes"
  });
  mark(assessment, "aorta", "aneurysm", { location: ["lower", "upper", "middle"], diameter: "38.2", length: "57", thrombus: "yes" });
  mark(assessment, "right-common-iliac", "stenosis", {
    percent: "58", location: ["upper"], length: "12", plaque: "mixed"
  });
  mark(assessment, "left-posterior-tibial", "unassessed");

  assert.deepEqual(assessment.report(), {
    description: [
      "Аорта:",
      "Инфраренальный отдел брюшной аорты — аневризматическое расширение, локализация — верхняя, средняя и нижняя трети, максимальный диаметр 38,2 мм, протяжённость 57 мм, с пристеночными тромботическими массами.",
      "",
      "Справа:",
      "Общая подвздошная артерия — стеноз 58%, локализация — верхняя треть, протяжённость 12 мм, смешанная бляшка.",
      "Задняя большеберцовая артерия — окклюзия, локализация — средняя треть, протяжённость 31,5 мм, дистальнее контрастирование восстанавливается.",
      "",
      "Слева:",
      "Подколенная артерия — оценка ограничена.",
      "Задняя большеберцовая артерия — оценка не проводилась."
    ].join("\n"),
    conclusion: [
      "Аорта:",
      "Инфраренальный отдел брюшной аорты — аневризматическое расширение, локализация — верхняя, средняя и нижняя трети, максимальный диаметр 38,2 мм, с пристеночными тромботическими массами.",
      "",
      "Справа:",
      "Общая подвздошная артерия — стеноз 58%, локализация — верхняя треть.",
      "Задняя большеберцовая артерия — окклюзия, локализация — средняя треть, дистальнее контрастирование восстанавливается.",
      "",
      "Слева:",
      "Подколенная артерия — оценка ограничена.",
      "Задняя большеберцовая артерия — оценка не проводилась."
    ].join("\n")
  });
});

test("изменение состояния и сброс действуют на выбранную сторону", () => {
  const assessment = createAssessment();
  const right = "right-popliteal";
  const left = "left-popliteal";
  mark(assessment, right, "stenosis", { percent: "69", plaque: "calcified" });
  mark(assessment, left, "occlusion", { length: "40", reconstitution: "no" });
  assert.equal(visualState(assessment.get(right)), "stenosis-middle");
  assert.equal(visualState(assessment.get(left)), "occlusion");
  assert.match(assessment.report().conclusion, /Слева:\nПодколенная артерия — окклюзия, дистальнее контрастирование не восстанавливается/);

  mark(assessment, right, "normal");
  assert.match(assessment.report().description, /Справа:\nПодколенная артерия — без патологических изменений/);
  assert.doesNotMatch(assessment.report().description, /69%|бляшка/);
  mark(assessment, right, "stenosis");
  assert.equal(visualState(assessment.get(right)), "stenosis-pending");
  assert.match(assessment.report().description, /стеноз \(процент не указан\)/);

  assessment.reset(right);
  assert.equal(assessment.get(right), undefined);
  assert.equal(assessment.count(), 1);
  assert.equal(visualState(assessment.get(right)), "unassessed");
  assert.match(assessment.report().description, /^Слева:/);
  assert.equal(statusOf(assessment.get(left)), "occlusion");
  assessment.clear();
  assert.deepEqual(assessment.report(), { description: "", conclusion: "" });
});

test("подтверждение нормы действует только на сосуды без отметок", () => {
  const assessment = createAssessment();
  assert.deepEqual(assessment.report(), { description: "", conclusion: "" });
  assert.ok(vessels.every(({ id }) => visualState(assessment.get(id)) === "unassessed"));
  mark(assessment, "aorta", "limited");
  mark(assessment, "left-common-femoral", "unassessed");
  mark(assessment, "right-common-femoral", "stenosis", { percent: "50" });
  assessment.confirmUnmarked();
  assert.equal(assessment.count(), 23);
  assert.equal(statusOf(assessment.get("aorta")), "limited");
  assert.equal(statusOf(assessment.get("left-common-femoral")), "unassessed");
  assert.equal(statusOf(assessment.get("right-common-femoral")), "stenosis");
  assert.equal(statusOf(assessment.get("left-posterior-tibial")), "normal");
  assert.equal(statusOf(createAssessment().get("left-posterior-tibial")), "");
  assert.ok(vessels.every(({ segment }) => !/plantar|dorsalis/.test(segment)));
});

test("визуальные границы стеноза и неполные числовые данные", () => {
  const assessment = createAssessment();
  assessment.setStatus("aorta", "stenosis");
  for (const [value, expected] of [
    ["1", "stenosis-low"], ["49", "stenosis-low"], ["50", "stenosis-middle"], ["69", "stenosis-middle"],
    ["70", "stenosis-high"], ["99", "stenosis-high"], ["0", "stenosis-pending"],
    ["100", "stenosis-pending"], ["50.5", "stenosis-pending"], ["", "stenosis-pending"]
  ]) {
    assessment.setDetail("aorta", "percent", value);
    assert.equal(visualState(assessment.get("aorta")), expected, value);
  }
  mark(assessment, "aorta", "aneurysm", { diameter: "0", length: "-20", thrombus: "no" });
  assert.equal(assessment.report().description,
    "Аорта:\nИнфраренальный отдел брюшной аорты — аневризматическое расширение, без пристеночных тромботических масс.");
});
