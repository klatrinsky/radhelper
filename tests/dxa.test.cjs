'use strict';

// Проверки актуального шаблона DXA (изменения от 19.11.2026).
// Запуск из корня репозитория: node --test tests/*.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const template = fs.readFileSync(path.join(root, 'templates', 'dxa.md'), 'utf8');

// Выполняем реальные функции DXA из index.html, а не их копии в тесте.
// Отрезаем только участок с DXA-калькуляторами, не требующий браузерного DOM.
function loadDxa() {
  const start = index.indexOf('  const DXA = [');
  const end = index.indexOf('  /* Точка терапевтического вмешательства FRAX', start);
  assert.ok(start >= 0 && end > start, 'Не найден участок DXA-калькуляторов в index.html');
  const sandbox = {
    CALC: {},
    PH_MM: [],
    fmt: (x, digits) => x.toFixed(digits).replace('.', ','),
  };
  vm.runInNewContext(
    index.slice(start, end) + '\n globalThis.TEST_DXA = { DXA_IN, dxa, dxaChanges, CALC };',
    sandbox,
    { filename: 'index.html:DXA' },
  );
  return sandbox.TEST_DXA;
}

const { DXA_IN, dxa, dxaChanges, CALC } = loadDxa();

function inputs(fields = {}) {
  return DXA_IN.map(name => Object.hasOwn(fields, name) ? fields[name] : NaN);
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
  assert.equal(dxa(inputs({ Возраст: 42 }), toggles()).crit, 'T');
  assert.equal(dxa(inputs({ Возраст: 42 }), toggles({ менопауза: 1 })).crit, 'Z');
  assert.equal(dxa(inputs({ Возраст: 49 }), toggles({ пол: 1 })).crit, 'Z');
  assert.equal(dxa(inputs({ Возраст: 50 }), toggles({ пол: 1 })).crit, 'T');
});

test('Процентная динамика действительно берётся из T% или Z%, а не всегда из T%', () => {
  const v = inputs({ Возраст: 45, 'T% позв': 91, 'Z% позв': 107, 'было позв': 90 });
  assert.equal(dxaChanges(v, toggles())[0].d, 1);
  assert.equal(dxaChanges(v, toggles({ менопауза: 1 }))[0].d, 17);
  const result = CALC['ДИНАМИКА'].text(v, toggles({ менопауза: 1 }));
  assert.match(result, /Z-критерия на 17%/);
  assert.doesNotMatch(result, /·/);
});

test('Режим BMD остаётся независимым от T/Z', () => {
  const v = inputs({
    Возраст: 45, 'T% позв': 91, 'Z% позв': 107, 'было позв': 90,
    'BMD позв': 0.92, 'BMD было позв': 0.80,
  });
  const t = dxaChanges(v, toggles({ 'режим динамики': 1 }))[0];
  const z = dxaChanges(v, toggles({ 'режим динамики': 1, менопауза: 1 }))[0];
  assert.ok(Math.abs(t.d - 15) < 1e-9);
  assert.ok(Math.abs(z.d - 15) < 1e-9);
  assert.equal(t.bmdMode, true);
  assert.match(CALC['ДИНАМИКА'].text(v, toggles({ 'режим динамики': 1 })), /МПК \(BMD\) на 15%/);
});

test('Служебный переключатель не копируется; контроль расположен первой строкой заключения', () => {
  assert.match(description, /^> Тип исследования: \{#контроль: Первичное исследование\|Контрольное исследование\./m);
  const copyableDescription = description.split('\n').filter(line => !line.startsWith('>')).join('\n');
  assert.doesNotMatch(copyableDescription, /Контрольное исследование/);
  assert.doesNotMatch(copyableDescription, /\[было (?:позв|шейка 1|шейка 2|предпл)\]/);
  assert.match(conclusion.trimStart(), /^\{#контроль: \|Контрольное исследование\.\}/);
  assert.match(conclusion, /от \[#дата предыдущего исследования\]/);
  assert.doesNotMatch(conclusion, /\[было (?:позв|шейка 1|шейка 2|предпл)\]/);
});

test('При смене критерия ранее введённые T/Z проценты не смешиваются', () => {
  assert.match(index, /const dxaPrevious = \{ T: \{\}, Z: \{\} \}/);
  assert.match(index, /dxaPrevious\[dxaPreviousCrit\]\[r\.k\] = fields\[0\]\.value/);
  assert.match(index, /dxaPrevious\[crit\]\[r\.k\]/);
});

test('Символ процента присутствует в тексте динамики, разделитель «·» не попадает в копию', () => {
  const v = inputs({ Возраст: 70, 'T% позв': 96.5, 'было позв': 92.0 });
  const result = CALC['ДИНАМИКА'].text(v, toggles());
  assert.match(result, /4,5%/);
  assert.doesNotMatch(result, /·/);
  assert.match(conclusion, /\{\{ДИНАМИКА\}\}/);
  assert.doesNotMatch(conclusion, /·/);
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
