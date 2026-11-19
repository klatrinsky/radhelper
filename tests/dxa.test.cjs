'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const template = fs.readFileSync(path.join(root, 'templates/dxa.md'), 'utf8');
const start = html.indexOf('  const DXA = [');
const end = html.indexOf('  /* Точка терапевтического вмешательства FRAX', start);
assert.ok(start > -1 && end > start, 'DXA calculations found in index.html');
const context = {};
const prelude = 'const CALC = {}, PH_MM = []; const fmt = (x, n) => x.toFixed(n).replace(".", ",");';
vm.runInNewContext(prelude + html.slice(start, end) + '\nglobalThis.api = { DXA_IN, dxa, dxaChanges, CALC };', context);
const { DXA_IN, dxa, dxaChanges, CALC } = context.api;

function patient({ age, woman = false, menopause = true, t = 95, z = 110, prev = 90, bmdMode = false } = {}) {
  const vals = new Array(DXA_IN.length).fill(NaN);
  const put = (key, value) => { vals[DXA_IN.indexOf(key)] = value; };
  put('Возраст', age);
  put('T% позв', t);
  put('Z% позв', z);
  put('было позв', prev);
  put('BMD позв', 0.9);
  put('BMD было позв', 1.0);
  const states = {
    'пол': woman ? 0 : 1,
    'менопауза': menopause ? 0 : 1,
    'поясничный отдел': 0,
    'шейка бедра': 1,  // выключена для чистоты теста
    'контралатеральная шейка': 0,
    'предплечье': 0,
    'режим динамики': bmdMode ? 1 : 0
  };
  const tg = key => states[key] ?? 0;
  return { vals, tg };
}

test('Критерий для женщин определяется менопаузой, для мужчин границей 50 лет', () => {
  for (const [patientData, expected] of [
    [{ age: 42, woman: true, menopause: false }, 'Z'],
    [{ age: 42, woman: true, menopause: true }, 'T'],
    [{ age: 49 }, 'Z'],
    [{ age: 50 }, 'T'],
    [{ age: 74 }, 'T']
  ]) {
    const p = patient(patientData);
    assert.equal(dxa(p.vals, p.tg).crit, expected);
    assert.equal(CALC['КРИТЕРИЙ'].text(p.vals, p.tg), expected + '-критерий');
  }
});

test('Процентная динамика действительно берётся из T% или Z%, а не всегда из T%', () => {
  let p = patient({ age: 70, t: 93, z: 112, prev: 90 });
  assert.equal(dxaChanges(p.vals, p.tg)[0].d, 3);
  assert.match(CALC['ДИНАМИКА'].text(p.vals, p.tg), /T-критерия/);
  p = patient({ age: 35, t: 93, z: 112, prev: 90 });
  assert.equal(dxaChanges(p.vals, p.tg)[0].d, 22);
  assert.match(CALC['ДИНАМИКА'].text(p.vals, p.tg), /Z-критерия/);
});

test('Режим BMD остаётся независимым от T/Z', () => {
  for (const age of [30, 68]) {
    const p = patient({ age, bmdMode: true });
    assert.ok(Math.abs(dxaChanges(p.vals, p.tg)[0].d + 10) < 1e-9);
    assert.match(CALC['ДИНАМИКА'].text(p.vals, p.tg), /МПК \(BMD\)/);
  }
});

test('Контроль размещён в описании, показатели прошлого исследования не повторяются в заключении', () => {
  const [protocol, conclusion] = template.split('\nЗаключение:\n');
  assert.ok(conclusion, 'Заключение присутствует');
  assert.match(protocol, /\{#контроль: Первичное обследование\.\|Контрольное обследование\.\}/);
  assert.match(protocol, /Прошлое исследование от/);
  assert.match(protocol, /% \(\{\{КРИТЕРИЙ\}\}\)/);
  assert.doesNotMatch(conclusion, /Прошлое исследование от|BMD позв|было позв|было шейка/);
  assert.match(conclusion, /В сравнении с предыдущими рентген-денситометрическими данными/);
});

test('При смене критерия ранее введённые T/Z проценты не смешиваются', () => {
  assert.match(html, /const dxaPrevious = \{ T: \{\}, Z: \{\} \}/);
  assert.match(html, /dxaPrevious\[dxaPreviousCrit\]\[r\.k\] = fields\[0\]\.value/);
  assert.match(html, /dxaPrevious\[crit\]\[r\.k\]/);
});
