'use strict';

// Проверки шаблона DXA. Запуск из корня репозитория: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const template = fs.readFileSync(path.join(root, 'content', 'templates', 'dxa.md'), 'utf8');

const calculatorsPath = path.join(root, 'assets', 'js', 'calculators.js');
const window = {};
vm.runInNewContext(fs.readFileSync(calculatorsPath, 'utf8'), { window }, { filename: calculatorsPath });
const { CALC } = window.RH_CALCULATORS;

function inputs(fields = {}) {
  return CALC['КРИТЕРИЙ'].inputs.map(name => Object.hasOwn(fields, name) ? fields[name] : NaN);
}

function toggles(overrides = {}) {
  const current = {
    'пол': 0, 'менопауза': 0, 'режим динамики': 0,
    'поясничный отдел': 0, 'шейка бедра': 0,
    'контралатеральная шейка': 0, 'предплечье': 0,
    'бедро': 0, 'рука': 0,
    ...overrides,
  };
  return name => current[name] ?? 0;
}

const description = template.split(/^Заключение:/m)[0];
const conclusion = template.split(/^Заключение:/m)[1]?.split(/^Рекомендации:/m)[0] || '';

test('Критерий для женщин определяется менопаузой, для мужчин границей 50 лет', () => {
  const criterion = (age, state) => CALC['КРИТЕРИЙ'].text(inputs({ Возраст: age }), toggles(state));
  assert.equal(criterion(42), 'T-критерий');
  assert.equal(criterion(42, { менопауза: 1 }), 'Z-критерий');
  assert.equal(criterion(49, { пол: 1 }), 'Z-критерий');
  assert.equal(criterion(50, { пол: 1 }), 'T-критерий');
});

test('Разность T% и Z% выводится в процентных пунктах, включая малые изменения', () => {
  const v = inputs({ Возраст: 45, 'T% позв': 91, 'Z% позв': 88, 'было позв': 90 });
  assert.equal(CALC['ДИНАМИКА'].text(v, toggles()), 'T% в поясничном отделе позвоночника +1 п. п.');
  assert.equal(CALC['ДИНАМИКА'].text(v, toggles({ менопауза: 1 })), 'Z% в поясничном отделе позвоночника −2 п. п.');
});

test('Режим BMD остаётся независимым от T/Z', () => {
  const v = inputs({
    Возраст: 45, 'T% позв': 91, 'Z% позв': 107, 'было позв': 90,
    'BMD позв': 0.92, 'BMD было позв': 0.80,
  });
  const result = 'МПК (BMD) в поясничном отделе позвоночника +15%.';
  assert.equal(CALC['ДИНАМИКА'].text(v, toggles({ 'режим динамики': 1 })), result);
  assert.equal(CALC['ДИНАМИКА'].text(v, toggles({ 'режим динамики': 1, менопауза: 1 })), result);
  const withoutAge = inputs({ 'BMD позв': 0.92, 'BMD было позв': 0.80 });
  assert.equal(CALC['ДИНАМИКА'].text(withoutAge, toggles({ 'режим динамики': 1, пол: 1 })), result);
  const zeroBaseline = inputs({ 'BMD позв': 0.92, 'BMD было позв': 0 });
  assert.equal(CALC['ДИНАМИКА'].text(zeroBaseline, toggles({ 'режим динамики': 1 })), '');
});

test('Служебный переключатель не копируется; контроль расположен первой строкой заключения', () => {
  assert.match(description, /^> Тип исследования: \{#контроль: Первичное исследование\|Контрольное исследование\./m);
  const copyableDescription = description.split('\n').filter(line => !/^(?:\?[^>]+> )?>/.test(line)).join('\n');
  assert.doesNotMatch(copyableDescription, /Контрольное исследование/);
  assert.doesNotMatch(copyableDescription, /\[было (?:позв|шейка 1|шейка 2|предпл)\]/);
  const previous = description.split('\n').find(line =>
    line.startsWith('?контроль=2> > [Данные предыдущего исследования] Дата: [#дата предыдущего исследования]'));
  assert.ok(previous, 'Исходные данные сравнения находятся в сворачиваемом блоке ввода');
  assert.ok(previous.includes('% ({{КРИТЕРИЙ}})'), 'Критерий сравнения выбирается динамически');
  for (const region of ['позв', 'шейка 1', 'шейка 2', 'предпл']) {
    assert.ok(previous.includes(`[было ${region}]%`), `Нет предыдущего процента: ${region}`);
  }
  assert.match(conclusion.trimStart(), /^\{#контроль: \|Контрольное исследование\.\}/);
  assert.match(conclusion, /от \[#дата предыдущего исследования\]/);
  assert.doesNotMatch(conclusion, /\[было (?:позв|шейка 1|шейка 2|предпл)\]/);
});

test('При смене критерия ранее введённые T/Z проценты не смешиваются', () => {
  assert.match(index, /const dxaPrevious = \{ T: \{\}, Z: \{\} \}/);
  assert.match(index, /dxaPrevious\[dxaPreviousCrit\]\[r\.k\] = fields\[0\]\.value/);
  assert.match(index, /dxaPrevious\[crit\]\[r\.k\]/);
});

test('Сравнение включает нулевую разность и только видимые области с парой значений', () => {
  const v = inputs({
    Возраст: 70, 'T% позв': 96.5, 'было позв': 92, 'T% шейка 1': 88, 'было шейка 1': 88,
    'T% шейка 2': 83, 'T% предпл': 79, 'было предпл': 82,
  });
  const result = CALC['ДИНАМИКА'].text(v, toggles());
  assert.equal(result, 'T% в поясничном отделе позвоночника +4,5 п. п., в шейке левой бедренной кости 0 п. п.');
  assert.equal(CALC['ДИНАМИКА'].text(inputs({ 'T% позв': 96.5 }), toggles()), '');
  assert.match(conclusion, /\{\{ДИНАМИКА\}\}/);
  assert.doesNotMatch(conclusion, /значим|разнонаправлен|·/);
});

test('TBS указан в описании у всех, а в заключении интерпретируется по возрасту и менопаузе', () => {
  assert.match(description, /^Костный трабекулярный индекс \(TBS\) L1–L4: \[TBS\]\.$/m);
  assert.match(conclusion, /\{#TBS интерпретация: \|Трабекулярный костный индекс/);
  const classify = (tbs, age, state) => CALC['TBS ИНТЕРПРЕТАЦИЯ']
    .set([tbs, age], toggles(state))['TBS интерпретация'];
  assert.equal(classify(1.31, 40, {}), 1); // постменопауза
  assert.equal(classify(1.31, 40, { менопауза: 1 }), 0);
  assert.equal(classify(1.31, 50, { пол: 1 }), 0);
  assert.equal(classify(1.31, 51, { пол: 1 }), 1);
  assert.equal(classify(NaN, 60, { пол: 1 }), 0);
});
