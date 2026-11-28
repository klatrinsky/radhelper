(function () {
  if (location.protocol === "file:") return;

  const { addKellgrenGuide, addPostopGuide, addTemporalGuide, addGcaGuide, addEvansGuide } = window.RH_TEMPLATE_GUIDES;
  const lower = s => s.toLowerCase().replace(/ё/g, "е");

  /* ---------- Умные шаблоны: переключатели, поля, калькуляторы ----------
     В тексте шаблона:
       {нет|умеренный|выраженный}  — переключатель, первый вариант по умолчанию
       {#сердце: а|б}              — именованный: все {#сердце: ...} переключаются вместе
       {|фраза}                    — пустой вариант; строка из одних пустых при копировании убирается
       [__]                        — пустое поле
       [правой]                    — поле с текстом по умолчанию
       [Dмин]                      — поле для калькулятора (имя из списка CALC в assets/js/calculators.js)
       {{NASCET}}                  — посчитанное значение; можно и внутри переключателя:
                                     {норма|расширена, КТИ {{КТИ}}%}
       {{ПЕРЕЧЕНЬ: L4–L5, L5–S1 | 2 | Протрузия диска *. | Протрузии дисков *.}}
                                   — склейка: имена переключателей {#L4–L5: ...}, у которых выбран вариант №2,
                                     через запятую вместо *; одно — первая фраза, несколько — вторая; ни одного — строки нет
                                     (5-я фраза — ни одного, 6-я — все; «имя=подпись» — в текст идёт подпись)
       {{ВСЕ: а, б | 1 | фраза}}   — фраза, только если у всех переключателей выбран вариант №1
       {#позвонок: L1|L2|L3|L4|L5} — 5+ коротких вариантов без полей — выпадающий список; «+L3» — по умолчанию
       {*имя: +L4–L5|L5–S1}        — выбор нескольких, в текст через запятую
       [#имя] / [#имя = текст]     — связанное поле: все [#имя] заполняются вместе
       ((текст [поле]))            — видно на экране, в копию не идёт
  */

  const { CALC, DXA, PH, num, fmt } = window.RH_CALCULATORS;
  window.RH_CALC = CALC;
  window.RH_TEMPLATE = (text, el) => buildTemplate(text, el);
  const INPUT_NAMES = new Set(Object.values(CALC).flatMap(c => c.inputs).concat(["T total", "T% total", "Z total", "Z% total"]));

  function buildTemplate(text, el) {
    el.innerHTML = "";
    const parts = [], calcs = [], named = {}, linked = {}, toggles = {}, lists = [], lineEls = [];
    const willisFields = new Map();
    const lungFields = [];
    let lungReport;
    const discFields = [];
    let discScheme;
    let refreshArteries;
    const visibleWhen = new Map();
    const PH_OF = new Map();                    // «+ имя» пустого варианта → { group, inst }
    let missing = [];                           // незаполненное в копируемом тексте: [{ label, el }] — собирается при каждом text()
    // В DXA предыдущие проценты храним отдельно для T и Z. При смене пациента не подменяем один критерий другим.
    const dxaPrevious = { T: {}, Z: {} };
    let dxaPreviousCrit = null;
    const EMPTY = "\u0000";                     // пустой вариант: строка, где только он, при копировании исчезает
    // {{калькулятор}} | {переключатель} — внутри него можно {{калькулятор}} и ещё один {переключатель} (одна вложенность) | [поле]
    const CALC_RE = String.raw`\{\{[^{}\n]*\}\}`;
    const INNER_RE = String.raw`\{(?:[^{}\n]|${CALC_RE})*\}`;                 // вложенный переключатель
    const PART_RE = String.raw`(?:[^{}\n]|${CALC_RE}|${INNER_RE})*`;
    // ((…)) — видно на экране, но не копируется: поля для расчётов прямо внутри фразы
    const re = new RegExp(String.raw`\{\{\s*([^{}]+?)\s*\}\}|\{(${PART_RE}\|${PART_RE})\}|\[([^\[\]\n]*)\]|\(\(((?:(?!\)\))[^\n])*)\)\)`, "g");
    // делит варианты по | только снаружи вложенных {…}
    function splitTop(str) {
      const res = []; let depth = 0, cur = "";
      for (const ch of str) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
        if (ch === "|" && depth === 0) { res.push(cur); cur = ""; } else cur += ch;
      }
      res.push(cur);
      return res;
    }

    // номер выбранного варианта именованного переключателя (0, если такого нет)
    const tg = n => { const g = toggles["#" + lower(n)]; return g ? g.i % Math.max(...g.insts.map(x => x.views.length)) : 0; };
    function recalc() {
      // Переключение T ↔ Z меняет и текущую базу сравнения, и поля прошлого исследования.
      if (named["Возраст"] && named["было позв"] && toggles["#пол"]) {
        const age = num(named["Возраст"][0].value);
        const crit = tg("пол") === 0 ? (tg("менопауза") === 0 ? "T" : "Z")
          : Number.isFinite(age) ? (age >= 50 ? "T" : "Z") : null;
        if (crit && dxaPreviousCrit && crit !== dxaPreviousCrit) {
          DXA.forEach(r => {
            const fields = named["было " + r.k];
            if (!fields) return;
            dxaPrevious[dxaPreviousCrit][r.k] = fields[0].value;
            const remembered = dxaPrevious[crit][r.k] || "";
            fields.forEach(f => { f.value = remembered; sizeField(f); });
          });
        }
        if (crit) dxaPreviousCrit = crit;
      }
      calcs.forEach(c => {
        const def = CALC[c.name];
        const parseInput = def.parseInput || num;
        const vals = def.inputs.map(n => parseInput(named[n]?.[0]?.value ?? ""));
        if (def.raw) {                                             // текст из любых значений (пустые — NaN) и переключателей
          c.value = def.text(vals, tg) || "";
          c.el.textContent = c.value || (def.optional ? "" : "__");
          return;
        }
        if (def.text) {                                            // калькулятор, который пишет текст, а не число
          c.value = vals.every(x => isFinite(x) && x > 0) ? def.text(...vals) : "";
          c.el.textContent = c.value || "__";
          return;
        }
        const x = vals.every(isFinite) ? def.f(...vals) : NaN;
        c.value = isFinite(x) && x >= 0 ? fmt(x, def.digits) : "";
        c.el.textContent = c.value || "__";
        // порог: сравниваем уже округлённое значение, чтобы 0,30 на экране не считалось расширением
        const g = def.toggle && toggles["#" + lower(def.toggle)];
        if (g && c.value) { g.i = def.pick(def.pickRaw ? x : num(c.value)); g.show(); }
        else if (g && def.reset) { g.i = 0; g.show(); }
      });
      // невидимые калькуляторы: сами ставят переключатели, если все их поля есть в шаблоне
      Object.values(CALC).forEach(def => {
        if (!def.set || !def.inputs.every(n => named[n])) return;
        const vals = def.inputs.map(n => num(named[n][0].value));
        Object.entries(def.set(vals, tg)).forEach(([n, i]) => {
          const g = toggles["#" + lower(n)];
          if (g) { g.i = i; g.show(); }
        });
      });
      if (calcs.some(c => CALC[c.name].optional)) tidy();
    }
    // переключатели, от которых зависят невидимые калькуляторы (uses), при нажатии пересчитывают
    const USED = new Set(Object.values(CALC).flatMap(d => (d.uses || []).map(n => "#" + lower(n))));
    function sizeField(f) { f.style.width = Math.max(3, (f.value || f.placeholder).length + 1) + "ch"; }

    function moveBetweenNumericFields(event) {
      if (event.defaultPrevented || event.isComposing || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const forward = event.key === "ArrowRight";
      if (!forward && event.key !== "ArrowLeft") return;
      const field = event.currentTarget;
      const edge = forward ? field.value.length : 0;
      if (field.selectionStart !== edge || field.selectionEnd !== edge) return;

      const fields = [...el.querySelectorAll('.fld[inputmode="decimal"]:enabled:not([readonly])')]
        .filter(input => !input.closest("[hidden], details:not([open])") && input.getClientRects().length);
      const next = fields[fields.indexOf(field) + (forward ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      next.focus();
      const caret = forward ? 0 : next.value.length;
      next.setSelectionRange(caret, caret);
    }

    // подпись пустого поля [__] для «Не заполнено: …»: до 3 слов перед ним в пределах фразы
    // («Атрофия по шкале GCA [__]» → «по шкале GCA»); у именованных полей и калькуляторов подпись — имя
    function labelOf(before) {
      const clause = before.replace(/\{\{[^{}]*\}\}/g, " ").replace(/\[[^\[\]]*\]/g, " ").replace(/[{}|#]/g, " ")
        .split(/[.;:,(=]/).pop();
      const w = clause.split(/\s+/).filter(x => /[A-Za-zА-Яа-яЁё0-9]/.test(x));
      while (w.length && w[w.length - 1].length <= 2) w.pop();            // «…позвонка на» → «…позвонка»
      return w.slice(-3).join(" ") || "поле";
    }

    function field(inner, target, out, before) {                  // [поле]
      inner = inner.trim();
      const f = document.createElement("input");
      f.className = "fld"; f.type = "text"; f.autocomplete = "off";
      const lk = inner.match(/^#\s*([^=]+?)\s*(?:=\s*(.*))?$/);    // [#имя] или [#имя = текст] — связанное поле: все [#имя] заполняются вместе
      if (INPUT_NAMES.has(inner)) {
        f.placeholder = PH[inner] || inner; f.inputMode = "decimal"; f.dataset.name = inner;
        f.addEventListener("keydown", moveBetweenNumericFields);
        (named[inner] = named[inner] || []).push(f);
        f.addEventListener("input", () => {
          named[inner].forEach(o => { if (o !== f) { o.value = f.value; sizeField(o); } });
          recalc();
        });
      } else if (lk) {
        const k = lower(lk[1].trim());
        f.placeholder = ["дата предыдущего исследования", "дата операции"].includes(k) ? "дд.мм.гггг" : "__";
        if (lk[2]) f.value = lk[2].trim();
        (linked[k] = linked[k] || []).push(f);
        f.addEventListener("input", () => linked[k].forEach(o => { if (o !== f) { o.value = f.value; sizeField(o); } }));
      } else if (!inner || /^_+$/.test(inner)) {
        f.placeholder = "__";
      } else {
        f.value = inner;
      }
      f.addEventListener("input", () => sizeField(f));
      sizeField(f);
      const label = INPUT_NAMES.has(inner) ? inner : labelOf(before || "");
      out.push(() => {
        if (f.value.trim()) return f.value.trim();
        missing.push({ label, el: f });
        return "[__]";
      });
      target.append(f);
    }

    function toggle(inner, target, out, depth) {                         // {а|б|в} или {#имя: а|б|в}
      let name = null, multi = false;
      const ms = inner.match(/^\s*\*([^:|]*):\s*/);                       // {*имя: +а|б|в} — выбор нескольких
      const explicitSelect = inner.trimStart().startsWith("!");
      const nm = inner.match(/^\s*[#!]([^:|]+):\s*/);
      if (ms) { multi = true; name = ms[1].trim() || null; inner = inner.slice(ms[0].length); }
      else if (nm) { name = nm[1].trim(); inner = inner.slice(nm[0].length); }
      let opts = splitTop(inner).map(x => x.trim());
      // список: 5 и больше коротких вариантов без полей и скобок (позвонки) — выпадающий список; «+» — выбран по умолчанию
      const pick = explicitSelect || multi || (opts.length >= 5 && opts.every(o => /^\+?[^\[\]{}()]{1,8}$/.test(o)));
      const def = pick ? opts.map((o, k) => o.startsWith("+") ? k : -1).filter(k => k >= 0) : [];
      if (pick) opts = opts.map(o => o.replace(/^\+\s*/, ""));
      // связаны переключатели с одним именем или с одинаковыми вариантами
      const key = (multi ? "*" : name ? "#" : "") + (name ? lower(name) : opts.join("|"));
      const fresh = !toggles[key];
      const group = toggles[key] = toggles[key] || { i: 0, insts: [], sel: new Set() };
      if (fresh && def.length) { group.i = def[0]; def.forEach(k => group.sel.add(k)); }
      if (multi) return multiPick(opts, group, target, out);
      if (pick) return dropdown(opts, group, key, target, out);

      const wrap = document.createElement("span");
      wrap.className = "tg"; wrap.tabIndex = 0; wrap.setAttribute("role", "button");
      const replacedByDisc = () => discScheme?.replaces(name);
      const updateVisibility = () => {
        wrap.hidden = replacedByDisc() || Boolean(wrap.dataset.autoHideEmpty && group.i % views.length === 0);
      };
      if (discScheme && name) discFields.push(updateVisibility);
      // Автоматическая строка TBS не должна показывать служебное «+ TBS интерпретация».
      if (name === "TBS интерпретация") wrap.dataset.autoHideEmpty = "1";
      wrap.title = "Нажмите, чтобы сменить вариант";
      const views = opts.map(o => {
        const span = document.createElement("span");
        const p = [];
        if (!o) { span.className = "opt-empty"; span.textContent = name ? "+ " + name : "—"; }
        else parse(o, span, p, depth + 1);
        wrap.append(span);
        return { span, p, empty: !o };
      });
      const inst = { views, update: () => {
        views.forEach((v, k) => { v.span.hidden = k !== group.i % views.length; });
        updateVisibility();
      } };
      views.forEach(v => { if (v.empty) PH_OF.set(v.span, { group, inst }); });
      group.insts.push(inst);
      const show = groupShow(group);
      const next = () => {
        group.i = (group.i + 1) % Math.max(...group.insts.map(g => g.views.length));
        group.edited = true;
        show();
        if (USED.has(key)) recalc();
      };
      // клик по вложенному переключателю меняет только его
      wrap.addEventListener("click", e => { if (!e.target.closest("input, select") && e.target.closest(".tg") === wrap) next(); });
      wrap.addEventListener("keydown", e => {
        if (e.target === wrap && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); }
      });
      show();
      out.push(() => {
        if (replacedByDisc()) return EMPTY;
        const v = views[group.i % views.length];
        return v.empty ? EMPTY : v.p.map(f => f()).join("");
      });
      target.append(wrap);
    }
    function groupShow(group) {
      return group.show = () => {
        group.insts.forEach(g => g.update());
        lists.forEach(f => f());                                  // переключатель сменился — пересобрать перечни
        tidy();
        refreshArteries?.();
      };
    }
    // Строка, где видно только «+ имя», а тот же переключатель уже показан выше с текстом (описание → заключение),
    // или только пустой перечень, на экране прячется: нажимать там нечего, а пустые строки мешают читать.
    function hasContent(node) {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) { if (c.textContent.trim()) return true; continue; }
        if (c.nodeType !== 1 || c.hidden || PH_OF.has(c)) continue;
        if (c.tagName === "INPUT" || c.tagName === "SELECT" || hasContent(c)) return true;
      }
      return false;
    }
    function tidy() {
      lineEls.forEach(ln => {
        if (visibleWhen.has(ln) && !visibleWhen.get(ln)()) { ln.hidden = true; return; }
        if (!ln.children.length) { ln.hidden = false; return; }                        // пустая строка-разделитель из шаблона остаётся
        const phs = [...ln.querySelectorAll(".opt-empty")].filter(x => PH_OF.has(x) && !x.hidden);
        const echo = phs.every(x => {
          const { group, inst } = PH_OF.get(x);
          return group.insts.some(g => {
            if (g === inst || g.views.length < 2) return false;
            const v = g.views[group.i % g.views.length];
            // тот же переключатель уже виден выше: с текстом или своим «+ имя» — второй «+ имя» не нужен
            return !v.empty || !!(v.span.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
          });
        });
        // Скрываем пустые автоматические строки, оставляя обычные «+ ...» для ручного выбора.
        ln.hidden = (echo || !!ln.querySelector("[data-auto-hide-empty]")) && !hasContent(ln);
      });
    }

    // выпадающий список: {#позвонок: L1|L2|L3|L4|L5} — варианты те же, что у переключателя, только выбираются из списка
    function dropdown(opts, group, key, target, out) {
      const sel = document.createElement("select");
      sel.className = "tg sel"; sel.title = "Выберите из списка";
      if (key.startsWith("#")) sel.setAttribute("aria-label", key.slice(1));
      opts.forEach(o => sel.add(new Option(o)));
      const inst = { views: opts.map(() => ({})), update: () => { sel.selectedIndex = group.i % opts.length; } };
      group.insts.push(inst);
      const show = groupShow(group);
      sel.addEventListener("change", () => {
        group.i = sel.selectedIndex; group.edited = true; show(); if (USED.has(key)) recalc();
      });
      show();
      out.push(() => opts[group.i % opts.length]);
      target.append(sel);
    }

    // выбор нескольких: {*имя: +L1|L2|L3} — тап раскрывает варианты, каждый включается и выключается; в текст — через запятую
    function multiPick(opts, group, target, out) {
      const wrap = document.createElement("span");
      wrap.className = "tg ms"; wrap.tabIndex = 0; wrap.setAttribute("role", "button");
      wrap.title = "Нажмите, чтобы выбрать";
      const val = document.createElement("span");
      const box = document.createElement("span");
      box.className = "ms-box"; box.hidden = true;
      const chips = opts.map((o, k) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "ms-chip"; b.textContent = o;
        b.addEventListener("click", e => {
          e.stopPropagation();
          group.sel.has(k) ? group.sel.delete(k) : group.sel.add(k);
          group.show();
        });
        box.append(b);
        return b;
      });
      const done = document.createElement("button");
      done.type = "button"; done.className = "ms-done"; done.textContent = "готово";
      done.addEventListener("click", e => { e.stopPropagation(); close(); });
      box.append(done);
      wrap.append(val, box);
      const text = () => opts.filter((o, k) => group.sel.has(k)).join(", ");
      const inst = { views: [{}], update: () => {
        const t = text();
        val.textContent = t || "выбрать";
        val.className = t ? "" : "opt-empty ms-ph";
        chips.forEach((b, k) => b.setAttribute("aria-pressed", group.sel.has(k)));
      } };
      group.insts.push(inst);
      groupShow(group)();
      const outside = e => { if (!wrap.contains(e.target)) close(); };
      function close() { box.hidden = true; val.hidden = false; document.removeEventListener("click", outside, true); }
      function open() { box.hidden = false; val.hidden = true; document.addEventListener("click", outside, true); }
      wrap.addEventListener("click", e => { if (e.target.closest(".tg") === wrap && box.hidden) open(); });
      wrap.addEventListener("keydown", e => {
        if (e.target === wrap && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); box.hidden ? open() : close(); }
      });
      out.push(() => {
        const t = text();
        if (t) return t;
        missing.push({ label: "выбрать", el: wrap });
        return "[__]";
      });
      target.append(wrap);
    }

    // {{ПЕРЕЧЕНЬ: имена | № | одно | несколько | ни одного | все}} и {{ВСЕ: имена | № | текст}}
    // В ПЕРЕЧНЕ имя=подпись заменяет подпись. Во ВСЕ имя=1/3 задаёт допустимые варианты для этого переключателя.
    function list(spec, target, out, all) {
      const p = spec.split("|").map(x => x.trim());
      const n = +p[1];
      const items = p[0].split(",").map(x => x.trim()).filter(Boolean).map(x => {
        const [name, value] = x.split("=").map(s => s.trim());
        return { name, label: value || name, variants: all && value ? value.split("/").map(Number) : [n] };
      });
      const span = document.createElement("span");
      span.className = "calc";
      let text = "";
      lists.push(() => {
        const on = items.filter(({ name, variants }) => {
          const group = toggles["#" + lower(name)];
          return group && !discScheme?.replaces(name) && variants.includes(group.i + 1);
        }).map(x => x.label);
        if (all) text = on.length === items.length ? p[2] || "" : "";
        else if (on.length === items.length && p[5] !== undefined) text = p[5];
        else if (!on.length) text = p[4] || "";
        else text = (on.length > 1 ? p[3] : p[2]).replace("*", on.join(", "));
        span.textContent = text;
      });
      out.push(() => text || EMPTY);
      target.append(span);
    }

    function parse(str, target, out, depth) {          // depth: 0 — текст шаблона, 1 — внутри переключателя, 2 — внутри вложенного
      re.lastIndex = 0;
      const found = [];
      let m;
      while ((m = re.exec(str))) found.push([m.index, re.lastIndex, m[1], m[2], m[3], m[4], m[0]]);
      let last = 0;
      for (const [start, end, calc, tg, fld, hid, raw] of found) {
        if (start > last) { const t = str.slice(last, start); target.append(t); out.push(() => t); }
        last = end;
        if (hid !== undefined) {                                  // ((…)) — на экране есть, в копию не идёт
          const span = document.createElement("span");
          span.className = "hid"; span.title = "Не копируется";
          parse(hid, span, [], depth);
          target.append(span);
        } else if (calc === "ВИЛЛИЗИЕВ ОПИСАНИЕ" || calc === "ВИЛЛИЗИЕВ ЗАКЛЮЧЕНИЕ") {
          const span = document.createElement("span");
          const key = calc.endsWith("ОПИСАНИЕ") ? "description" : "conclusion";
          willisFields.set(key, span);
          if (key === "conclusion") span.setAttribute("aria-live", "polite");
          target.append(span);
          out.push(() => span.textContent || EMPTY);
        } else if (calc === "ЛЁГКИЕ ОПИСАНИЕ" || calc === "ЛЁГКИЕ ЗАКЛЮЧЕНИЕ" || calc?.startsWith("ЛЁГКИЕ БЕЗ НАХОДОК:")) {
          const span = document.createElement("span");
          const read = calc === "ЛЁГКИЕ ОПИСАНИЕ" ? () => lungReport?.description :
            calc === "ЛЁГКИЕ ЗАКЛЮЧЕНИЕ" ? () => lungReport?.conclusion :
            () => lungReport?.hideNegative ? "" : calc.slice("ЛЁГКИЕ БЕЗ НАХОДОК:".length).trim();
          const update = () => { span.textContent = read() || ""; };
          lungFields.push(update);
          update();
          target.append(span);
          out.push(() => read() || EMPTY);
        } else if (calc === "ДИСКИ ЗАКЛЮЧЕНИЕ" || calc === "ДИСКИ ОПИСАНИЕ" || calc?.startsWith("ДИСКИ ОПИСАНИЕ:")) {
          const span = document.createElement("span");
          const level = calc.split(":")[1]?.trim();
          const read = calc === "ДИСКИ ЗАКЛЮЧЕНИЕ" ? () => discScheme?.conclusion() : () => discScheme?.description(level);
          discFields.push(() => { span.textContent = read() || ""; });
          target.append(span);
          out.push(() => read() || EMPTY);
        } else if (calc !== undefined && /^перечень\s*:/i.test(calc)) {  // {{ПЕРЕЧЕНЬ: имена | № варианта | одно | несколько}}
          list(calc.replace(/^перечень\s*:/i, ""), target, out);
        } else if (calc !== undefined && /^все\s*:/i.test(calc)) {       // {{ВСЕ: имена | № варианта | текст}}
          list(calc.replace(/^все\s*:/i, ""), target, out, true);
        } else if (calc !== undefined) {                          // {{КАЛЬКУЛЯТОР}}, в том числе внутри переключателя
          const key = Object.keys(CALC).find(k => lower(k) === lower(calc));
          const span = document.createElement("span");
          span.className = "calc";
          if (!key) {
            span.classList.add("bad"); span.textContent = raw;
            span.title = "Нет такого калькулятора. Есть: " + Object.keys(CALC).join(", ");
            out.push(() => raw);
          } else {
            const def = CALC[key];
            const c = { name: key, el: span, value: "" };
            calcs.push(c);
            out.push(() => {
              if (c.value) return c.value;
              if (def.optional) return EMPTY;
              // Подсветить пустое или некорректно заполненное поле калькулятора.
              const invalid = input => !input.value.trim() || (def.parseInput && def.parseInput(input.value) === undefined);
              const n = def.inputs.find(n => named[n]?.some(invalid));
              missing.push(n ? { label: n, el: named[n].find(invalid) } : { label: key, el: span });
              return "[__]";
            });
          }
          target.append(span);
        } else if (tg !== undefined && depth < 2) {
          toggle(tg, target, out, depth);
        } else if (fld !== undefined) {
          field(fld, target, out, str.slice(0, start));
        } else {                                                  // скобки, которые здесь не работают, — как текст
          target.append(raw); out.push(() => raw);
        }
      }
      if (last < str.length) { const t = str.slice(last); target.append(t); out.push(() => t); }
    }

    function addAdditionalFindings() {
      const label = document.createElement("label");
      label.className = "additional-findings";
      label.textContent = "Дополнительные находки";
      const field = document.createElement("textarea");
      field.className = "fld";
      field.rows = 2;
      label.append(field);
      el.append(label);
      parts.push(() => {
        const findings = field.value.trim();
        return findings ? "\n" + findings + "\n\n" : "";
      });
    }

    // строка «> …» — пульт: поля и переключатели для расчётов (пол, возраст…); видна, но в копируемый текст не попадает
    const lines = text.split("\n");
    let reportSection = el;
    let conclusionSection, conclusionHeading, conclusionStart, conclusionEnd;
    lines.forEach((line, i) => {
      const conclusionTitle = line.match(/^Заключение:[ \t]*/i)?.[0];
      if (conclusionTitle) {
        if (!conclusionSection) addAdditionalFindings();
        conclusionHeading = parts.length;
        conclusionSection = reportSection = document.createElement("section");
        reportSection.className = "tpl-conclusion";
        reportSection.setAttribute("aria-label", "Заключение");
        el.append(reportSection);
      } else if (conclusionSection && reportSection === conclusionSection &&
        /^(?:\{(?:#[^:]+:\s*)?(?:\|\s*)?)?Рекомендации:/i.test(line)) {
        conclusionEnd = parts.length;
        reportSection = el;
      }
      const condition = line.match(/^\?([^=]+)=(\d+)>\s*/);
      const active = () => {
        const name = lower(condition[1]);
        const index = Number(condition[2]) - 1;
        return toggles["*" + name]?.sel.has(index) || toggles["#" + name]?.i === index;
      };
      if (condition) line = line.slice(condition[0].length);
      const ctl = line.match(/^>\s?(.*)$/);
      const folded = ctl?.[1].match(/^\[([^\]]+)\]\s+(.*)$/);
      const kl = ctl?.[1].match(/^Келлгрен — Лоуренс: (колено|ТБС)$/);
      const disc = ctl?.[1].match(/^\{\{СХЕМА ДИСКОВ: (cervical|thoracic|lumbar)\}\}$/);
      if (ctl?.[1] === "Атлас: чашка" || ctl?.[1] === "Атлас: стопа") {
        addPostopGuide(el, ctl[1] === "Атлас: чашка");
      } else if (ctl?.[1] === "Атлас: височная кость") {
        addTemporalGuide(el);
      } else if (ctl?.[1] === "Атлас: GCA") {
        addGcaGuide(reportSection);
      } else if (kl) {
        addKellgrenGuide(el, kl[1]);
      } else if (disc) {
        const details = document.createElement("details");
        reportSection.append(details);
        discScheme = window.createDiscLocationTemplate(details, disc[1], () => {
          discFields.forEach(update => update());
          lists.forEach(update => update());
          tidy();
        });
      } else if (line.trim() === "> {{ВИЛЛИЗИЕВ КРУГ}}") {
        const panel = document.createElement("section");
        if (condition) visibleWhen.set(panel, active);
        reportSection.append(panel);
        lineEls.push(panel);
        window.createWillisDiagram(panel, result => {
          for (const [key, span] of willisFields) span.textContent = result ? result[key] : "";
          tidy();
        });
      } else if (line.trim() === "> {{СХЕМА ЛЁГКИХ}}") {
        const details = document.createElement("details");
        details.className = "lung-findings-toggle";
        const summary = document.createElement("summary");
        summary.textContent = "Схема лёгких";
        const panel = document.createElement("div");
        details.append(summary, panel);
        reportSection.append(details);
        const mount = () => {
          if (!details.open) return;
          details.removeEventListener("toggle", mount);
          window.createLungFindings(panel, report => {
            lungReport = report;
            lungFields.forEach(update => update());
            tidy();
          });
        };
        details.addEventListener("toggle", mount);
      } else if (line.trim() === "> {{СХЕМА АРТЕРИЙ}}") {
        const details = document.createElement("details");
        details.className = "leg-arteries-toggle";
        const summary = document.createElement("summary");
        summary.textContent = "Схема артерий";
        const panel = document.createElement("div");
        details.append(summary, panel);
        reportSection.append(details);
        const mount = () => {
          if (!details.open) return;
          details.removeEventListener("toggle", mount);
          const group = name => toggles["#" + lower(name)];
          const inputs = name => linked[lower(name)];
          const state = window.bindLegArteriesTemplate({
            group,
            setGroup(name, i, edited = true) {
              const control = group(name);
              control.i = i;
              control.edited = edited;
              control.show();
            },
            field: name => inputs(name)[0].value,
            setField(name, value) {
              for (const field of inputs(name)) { field.value = value; sizeField(field); }
            }
          });
          const render = window.createLegArteriesDiagram(panel, state);
          let scheduled = false;
          refreshArteries = () => {
            if (!details.open || scheduled) return;
            scheduled = true;
            queueMicrotask(() => { scheduled = false; if (details.open && panel.isConnected) render(); });
          };
          details.addEventListener("toggle", refreshArteries);
          el.addEventListener("input", event => { if (!panel.contains(event.target)) refreshArteries(); });
        };
        details.addEventListener("toggle", mount);
      } else if (ctl) {
        const box = document.createElement(folded ? "details" : "div");
        box.className = "ctl";
        if (folded) {
          const summary = document.createElement("summary");
          summary.textContent = folded[1];
          box.append(summary);
        }
        parse(folded ? folded[2] : ctl[1], box, [], 0);
        if (condition) {
          visibleWhen.set(box, active);
          lineEls.push(box);
        }
        reportSection.append(box);
      } else {
        const ln = document.createElement("span");
        ln.className = "ln";
        // ?группа=номер> показывает и копирует строку только для выбранного варианта.
        const output = condition ? [] : parts;
        if (condition) {
          visibleWhen.set(ln, active);
          parts.push(() => active() ? output.map(read => read()).join("") : "");
        }
        if (conclusionTitle) {
          output.push(() => conclusionTitle);
          conclusionStart = parts.length;
          line = line.slice(conclusionTitle.length);
          if (!line) {
            if (i < lines.length - 1) output.push(() => "\n");
            return;
          }
        }
        parse(line + (i < lines.length - 1 ? "\n" : ""), ln, output, 0);
        reportSection.append(ln);
        lineEls.push(ln);
      }
    });
    if (conclusionSection) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "copy-conclusion";
      button.textContent = "Скопировать заключение";
      conclusionSection.append(button);
    } else addAdditionalFindings();
    if (window.RH_ABDOMEN_GUIDES) window.RH_ABDOMEN_GUIDES.add(text, el);
    if (named["Рога"] && named["Череп"]) addEvansGuide(named["Рога"]);
    recalc();
    lists.forEach(f => f());
    tidy();
    function copyParts(section) {
      if (section === "conclusion" || section === true) return parts.slice(conclusionStart, conclusionEnd);
      if (section === "protocol" && conclusionHeading !== undefined) {
        return parts.slice(0, conclusionHeading).concat(parts.slice(conclusionEnd ?? parts.length));
      }
      return parts;
    }
    return {
      // что осталось незаполненным в том тексте, который уйдёт при копировании (скрытые варианты {а|б} не считаются)
      missing: section => {
        missing = []; copyParts(section).forEach(p => p());
        const invalidDisc = section === "protocol" ? discScheme?.firstInvalid() : undefined;
        if (invalidDisc) missing.unshift(invalidDisc);
        const seen = new Set(), m = missing.filter(x => !seen.has(x.el) && seen.add(x.el));   // поле и его калькулятор — один раз
        missing = []; return m;
      },
      text: section => copyParts(section).map(p => p()).join("")
        .split("\n").filter(l => !(l.includes(EMPTY) && !l.replace(/\u0000/g, "").trim())).join("\n")
        .replace(/\u0000/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n")
        .replace(/ +([.,;:])/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    };
  }
})();
