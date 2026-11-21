/* Проверка содержимого: опечатки в .md, которые не роняют сайт, а молча выключают расчёт или вывод.
   Пример: в условии «aphe = гиперваскуляризаця» — правило никогда не сработает, и никто не заметит. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { openSite, read, list, ROOT } = require("./env");

let W;
test.before(async () => { W = await openSite(); });

const order = dir => read(dir + "/order.txt").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"));
const body = f => read(f).replace(/\r/g, "").split("\n---\n").slice(1).join("\n---\n");
const head = f => read(f).replace(/\r/g, "").split("\n---\n")[0];
const lower = s => s.toLowerCase().replace(/ё/g, "е");

test("сайт открывается без ошибок — у врача и у лаборанта", async () => {
  for (const lab of [false, true]) {
    const w = lab ? await openSite({ lab: true }) : W;
    const who = lab ? "лаборант" : "врач";
    assert.deepEqual(w.__errors, [], who + ": ошибки JavaScript");
    assert.deepEqual([...w.document.querySelectorAll(".err")].map(e => e.textContent), [], who + ": сообщения об ошибке на странице");
    assert.ok(w.document.querySelectorAll("details.sec").length > 0, who + ": нет разделов");
  }
});

test("все файлы из order.txt существуют", () => {
  for (const dir of ["ru", "templates", "tools"])
    for (const f of order(dir)) assert.ok(fs.existsSync(path.join(ROOT, dir, f)), dir + "/order.txt → нет файла " + f);
});

test("«Подсказки:» в шаблонах и находках ссылаются на существующие разделы", () => {
  for (const dir of ["templates", "tools"])
    for (const f of order(dir)) {
      const m = head(dir + "/" + f).match(/^Подсказки:(.*)$/mi);
      if (!m) continue;
      for (const h of m[1].split(/[,\s]+/).filter(Boolean))
        assert.ok(fs.existsSync(path.join(ROOT, "ru", h.replace(/\.md$/i, "") + ".md")), dir + "/" + f + ": нет подсказки ru/" + h + ".md");
    }
});

test("каждый «Виджет:» есть в widgets.js", () => {
  for (const f of list("ru").filter(f => f.endsWith(".md")))
    for (const m of read("ru/" + f).matchAll(/^Виджет:\s*(.+)$/gmi))
      assert.ok(W.RH_WIDGETS[m[1].trim()], "ru/" + f + ": нет виджета «" + m[1].trim() + "»");
});

/* ---------- Шаблоны ↔ калькуляторы ---------- */
// Эти команды разбирает интерактивная схема. Её вывод проверяется в calc.test.js.
const willisDirectives = new Set(["ВИЛЛИЗИЕВ КРУГ", "ВИЛЛИЗИЕВ ОПИСАНИЕ", "ВИЛЛИЗИЕВ ЗАКЛЮЧЕНИЕ"]);

// максимальный номер варианта, который калькулятор может поставить переключателю
function maxPick(def) {
  let m = 0;
  for (let x = -50; x <= 2000; x += 0.01 * (x < 5 && x > -5 ? 1 : 100)) m = Math.max(m, def.pick(Math.round(x * 100) / 100));
  return m;
}
// варианты именованного переключателя {#имя: а|б|в} (вложенные {…} не делят)
function toggleOptions(text, name) {
  const res = [];
  const re = new RegExp("\\{#\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:", "gi");
  let m;
  while ((m = re.exec(text))) {
    let depth = 1, i = m.index + m[0].length, n = 1;
    for (; i < text.length && depth; i++) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === "|" && depth === 1) n++;
    }
    res.push(n);
  }
  return res;
}

test("шаблоны: каждый {{КАЛЬКУЛЯТОР}} существует, его поля есть в шаблоне, переключатель — тоже и с нужным числом вариантов", () => {
  const C = W.RH_CALC;
  for (const f of order("templates")) {
    const text = body("templates/" + f);
    const fields = new Set([...text.matchAll(/\[([^\[\]\n]*)\]/g)].map(m => m[1].trim()));
    for (const [, raw] of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
      if (/^(ПЕРЕЧЕНЬ|ВСЕ)\s*:/.test(raw) || willisDirectives.has(raw)) continue;
      const def = C[raw];
      assert.ok(def, f + ": нет калькулятора {{" + raw + "}}");
      if (def.raw) continue;                                   // такие считают и по неполным данным
      for (const n of def.inputs) assert.ok(fields.has(n), f + ": {{" + raw + "}} не получит поле [" + n + "]");
      if (def.toggle) {
        const sizes = toggleOptions(text, def.toggle);
        assert.ok(sizes.length, f + ": {{" + raw + "}} ставит {#" + def.toggle + ": …}, а его нет в шаблоне");
        const need = maxPick(def) + 1;
        for (const n of sizes) assert.ok(n >= need, f + ": у {#" + def.toggle + "} " + n + " вариантов, а калькулятор ставит до " + need);
      }
    }
  }
});

test("шаблоны: невидимые калькуляторы ставят переключатели, которые есть в шаблоне", () => {
  const C = W.RH_CALC;
  for (const f of order("templates")) {
    const text = body("templates/" + f);
    const fields = new Set([...text.matchAll(/\[([^\[\]\n]*)\]/g)].map(m => m[1].trim()));
    for (const [name, def] of Object.entries(C)) {
      if (!def.set || !def.inputs.every(n => fields.has(n))) continue;   // сайт включает его, только если все поля на месте
      const out = def.set(def.inputs.map(() => NaN), () => 0);
      for (const t of Object.keys(out))
        if (t !== "TBS")                                                 // TBS — необязательная строка, может не быть
          assert.ok(toggleOptions(text, t).length, f + ": «" + name + "» ставит {#" + t + ": …}, а его нет в шаблоне");
    }
  }
});

/* ---------- Находки: условия ссылаются на существующие параметры и варианты ---------- */
test("находки: файлы разбираются без ошибок, в условиях нет опечаток", () => {
  const F = W.RH_FINDINGS;
  for (const f of order("tools")) {
    const tool = F.parse(body("tools/" + f));
    assert.deepEqual([...tool.errors], [], "tools/" + f + ": не разобраны строки");
    const params = Object.fromEntries(tool.params.map(p => [p.id, p]));
    const calcs = new Set(tool.calcs.map(c => c.id));
    const conds = [
      ...tool.params.filter(p => p.when).map(p => p.when),
      ...tool.rules.map(r => r.cond), ...tool.notes.map(r => r.cond),
      ...tool.ddx.flatMap(d => d.signs.map(s => s.cond)),
      ...tool.calcs.flatMap(c => [...c.expr.matchAll(/\[([^\]]+)\]/g)].map(m => m[1])),
    ];
    for (const cond of conds)
      for (const any of cond.split(/\s+или\s+/))
        for (const one of any.split(/\s+и\s+/)) {
          const s = one.trim();
          if (lower(s) === "иначе") continue;
          const m = s.match(/^([\wа-яё]+)\s*(<=|>=|!=|=|<|>)\s*(.+)$/i);
          const id = m ? m[1] : s;
          const where = "tools/" + f + ": «" + s + "»";
          assert.ok(params[id] || calcs.has(id), where + " — нет параметра или расчёта " + id);
          if (!m || !params[id]) continue;
          const p = params[id], want = m[3].trim();
          if (p.kind === "pick") {
            assert.ok(["=", "!="].includes(m[2]), where + " — у кнопок только = и !=");
            assert.ok(p.options.some(o => lower(o) === lower(want)), where + " — у " + id + " нет варианта «" + want + "»");
          } else assert.ok(isFinite(parseFloat(want.replace(",", "."))) || params[want] || calcs.has(want),
            where + " — число сравнивается не с числом и не с параметром");
        }
    // формулы расчётов: только параметры, расчёты и арифметика
    for (const c of tool.calcs) {
      const names = c.expr.replace(/\[[^\]]+\]/g, " ").match(/[a-zа-яё_][\wа-яё]*/gi) || [];
      for (const n of names) assert.ok(params[n] || calcs.has(n), "tools/" + f + ": в формуле " + c.id + " неизвестное имя " + n);
    }
  }
});
