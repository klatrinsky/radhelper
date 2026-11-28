(function () {
  const navigation = window.RH_NAVIGATION;
  navigation.configureEntry();

  function start() {
    const listEl = document.getElementById("list");
    const noteEl = document.getElementById("note");
    const q = document.getElementById("q");
    const none = document.getElementById("none");

    if (location.protocol === "file:") {
      listEl.innerHTML = '<p class="err">Страница открыта как файл с диска, а браузер не даёт ей читать соседние файлы. ' +
        'Смотрите опубликованный сайт или откройте репозиторий через github.dev.</p>';
      return;
    }

    const { esc, inline, parse: parseMarkdown, loadHintImages } = window.RH_MARKDOWN;
    const { GUIDE_DIR: DIR, TEMPLATE_DIR: TDIR, FINDINGS_DIR: FDIR, loadGuides, loadVariants, createHintReader } = window.RH_LOADER;
    const { bindGuideSearch, groupStudies, queryWords, rankStudies, bestVariant, groupResults } = window.RH_SEARCH;
    const { copy, bindForm, bindTemplate } = window.RH_CLIPBOARD;
    const { RH_TEMPLATE: buildTemplate } = window;

    document.addEventListener("toggle", event => {
      if (event.target instanceof HTMLDetailsElement && event.target.open) loadHintImages(event.target);
    }, true);

    q.addEventListener("input", () => {
      if (!document.body.classList.contains("protocol-view")) return;
      document.body.classList.remove("protocol-view");
      const url = new URL(location.href);
      url.searchParams.delete("protocol");
      history.replaceState(null, "", url);
    });

    /* ---------- Загрузка ---------- */
    loadGuides().then(items => {
      listEl.innerHTML = "";
      const parsed = {};
      const references = [];
      items.forEach(({ f, t }) => {
        if (t !== null) parsed[f.replace(/\.md$/i, "")] = t;
        if (t === null) {
          listEl.insertAdjacentHTML("beforeend", '<p class="err">Не найден файл ' + esc(DIR + f) + ' — проверьте имя в order.txt</p>');
          return;
        }
        const d = parseMarkdown(t);
        // «Для:» врач (по умолчанию) / лаборант / оба — на чужом входе раздел не показываем
        if (d.who !== "оба" && d.who !== (window.RH_LAB ? "лаборант" : "врач")) return;
        if (f === "about.md") {
          noteEl.innerHTML = '<div class="note">' + d.html + "</div>";
          loadHintImages(noteEl);
          return;
        }
        const sec = document.createElement("details");
        sec.className = d.sos ? "sec sos" : "sec";
        if (!d.btn) sec.dataset.nobtn = "1";
        sec.id = f.replace(/\.md$/i, "");
        sec.dataset.words = d.words;
        sec.innerHTML = "<summary><span class=\"t\">" + inline(d.title || f) + "</span>" +
          (d.sub ? '<span class="s">' + inline(d.sub) + "</span>" : "") + "</summary>" +
          '<div class="body">' + d.html +
          (d.sos ? '<button type="button" class="print-btn">🖨 Распечатать на стену</button>' : "") + "</div>";
        listEl.appendChild(sec);
        if (!window.RH_LAB) {
          references.push({
            title: sec.querySelector(".t").textContent,
            href: "#" + sec.id,
            category: d.classification || sec.querySelector(".widget") ? "calculations" : "references"
          });
        }
      });
      listEl.querySelectorAll(".widget").forEach(el => {
        const fn = (window.RH_WIDGETS || {})[el.dataset.widget];
        if (fn) fn(el); else el.innerHTML = '<p class="err">Нет виджета «' + esc(el.dataset.widget) + '» в assets/js/widgets.js</p>';
      });
      setup();
      if (!window.RH_LAB) templates(parsed, references);   // шаблоны заключений лаборанту не нужны
    }).catch(() => {
      listEl.innerHTML = '<p class="err">Не удалось прочитать content/guides/order.txt.</p>';
      if (document.body.classList.contains("protocol-view")) templates({});
    });

    /* ---------- Поиск, «раскрыть всё», ссылки на раздел ---------- */
    function setup() {
      const secs = Array.from(document.querySelectorAll("details.sec"));
      bindGuideSearch(secs, q, none);

      navigation.bindLabSections(secs, q, none);

      // «Распечатать на стену»: печатается только этот раздел, раскрытым и крупно
      document.querySelectorAll("details.sec.sos .print-btn").forEach(b => b.addEventListener("click", () => {
        const sec = b.closest("details.sec");
        sec.open = true;
        sec.classList.add("print-me");
        document.body.classList.add("print-sos");
        window.print();
      }));
      window.addEventListener("afterprint", () => {
        document.body.classList.remove("print-sos");
        document.querySelectorAll(".print-me").forEach(s => s.classList.remove("print-me"));
      });

      navigation.bindSectionLinks(secs, q);
    }

    /* ---------- Шаблоны заключений ---------- */
    const studyEl = document.getElementById("study");

    const protocolId = v => v.f.replace(/\.md$/i, "");
    function protocolUrl(v) {
      if (v.kind === "page") return new URL(v.page, location.href);
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set("protocol", protocolId(v));
      return url;
    }

    function templates(sections, references = []) {
      loadVariants().then(([tl, fl]) => {
        const studies = groupStudies(tl.concat(fl));
        window.RH_RENDER_CATALOG(studies, references, protocolUrl);
        const hint = createHintReader(sections);

        // Keep the live form and its calculation state together for each variant.
        const forms = new Map();
        let current = null;
        function searchChoices(found, active) {
          if (found.length <= 3) {
            return found.length > 1 ? '<div class="picks">' + found.map((x, i) =>
              '<button type="button" class="pick" data-i="' + i + '" aria-pressed="' + (x === active) + '">' + esc(x.title) + "</button>").join("") + "</div>" : "";
          }
          const groups = groupResults(found);
          return '<div class="search-groups"><div class="search-groups-head">Найдено: ' +
            found.length + ' · наиболее подходящий протокол открыт ниже.</div>' +
            [...groups].map(([category, items]) =>
              '<details class="search-group"><summary><span>' + esc(category) +
              '</span><span>' + items.length + '</span></summary><div class="search-group-list">' +
              items.map(({ x, i }) =>
                '<button type="button" class="pick" data-i="' + i +
                '" aria-pressed="' + (x === active) + '">' + esc(x.title) + '</button>'
              ).join("") + '</div></details>'
            ).join("") + "</div>";
        }
        function show(found, words, keep) {
          if (!found.length) { studyEl.hidden = true; studyEl.innerHTML = ""; current = null; return; }
          if (!keep || !found.includes(current)) current = found[0];
          const s = current;
          render(found, s, bestVariant(s, words));
        }
        function render(found, s, vi) {
          current = s;
          const v = s.variants[vi];
          studyEl.hidden = false;
          if (document.body.classList.contains("protocol-view") && v.kind === "template") {
            const url = new URL(location.href);
            url.searchParams.set("protocol", protocolId(v));
            history.replaceState(null, "", url);
          }
          studyEl.dataset.src = (v.kind === "tool" ? FDIR : TDIR) + v.f;
          studyEl.innerHTML =
            searchChoices(found, s) +
            '<div><h2>' + esc(s.title) + "</h2>" +
            (s.modality || v.kind !== "tool" ? '<div class="study-meta">' +
              (s.modality ? "<span>" + esc(s.modality) + "</span>" : "") +
              (v.kind === "tool" ? "" : '<button type="button" class="share-protocol">Скопировать ссылку</button>') +
              "</div>" : "") + "</div>" +
            (s.variants.length > 1 ? '<div class="tabs" role="tablist">' + s.variants.map((x, i) =>
              '<button type="button" class="tab" role="tab" data-v="' + i + '" aria-selected="' + (i === vi) + '">' + esc(x.variant) + "</button>").join("") + "</div>" : "") +
            (v.kind === "tool"
              ? '<div class="sheet finding"><div class="sheet-bar"><span>Повод задуматься · в заключение не копируется</span>' +
                '<span class="btns"><button type="button" class="reset">Сбросить</button></span></div><div class="fx"></div></div>'
              : v.kind === "page"
              ? '<div class="sheet"><div class="sheet-bar"><span>Интерактивный конструктор · отдельная страница Radhelper</span></div>' +
                '<div class="app-entry"><p>' + inline(v.text) + '</p><a href="' + esc(v.page) + '">Открыть конструктор переломов →</a></div></div>'
              : (v.alert ? '<div class="alert">' + esc(v.alert) + '</div>' : "") +
                '<div class="sheet"><div class="sheet-bar actions">' +
                '<span class="btns"><button type="button" class="reset">Сбросить</button>' +
                '<button type="button" class="copy">Скопировать протокол</button></span></div><div class="tpl"></div></div>') +
            (v.hints.length ? '<details class="study-hints"><summary>Подсказки</summary><div class="hints"></div></details>' : "");
          const share = studyEl.querySelector(".share-protocol");
          if (share) share.onclick = () => copy(protocolUrl(v).href);
          if (v.kind === "tool") window.RH_FINDINGS.render(v.tool, studyEl.querySelector(".fx"));
          let tpl = null;
          const slot = studyEl.querySelector(".tpl");
          if (slot) {
            let form = forms.get(v);
            if (form) slot.replaceWith(form.root);
            else {
              form = { root: slot, api: buildTemplate(v.text, slot) };
              bindForm(form.root);
              forms.set(v, form);
            }
            tpl = form.api;
          }
          studyEl.querySelectorAll(".pick").forEach(b => b.onclick = () => render(found, found[+b.dataset.i], 0));
          studyEl.querySelectorAll(".tab").forEach(b => b.onclick = () => render(found, s, +b.dataset.v));
          if (tpl) bindTemplate(studyEl, tpl);
          const reset = studyEl.querySelector(".reset");
          if (reset) reset.onclick = () => {
            if (tpl) forms.delete(v);
            render(found, s, vi);
          };
          const box = studyEl.querySelector(".hints");
          if (box) Promise.all(v.hints.map(hint)).then(texts => {
            if (current !== s || !box.isConnected) return;
            texts.forEach((t, i) => {
              const d = document.createElement("details");
              d.className = "sec";
              if (t === null) { box.insertAdjacentHTML("beforeend", '<p class="err">Нет подсказки ' + esc(DIR + v.hints[i]) + '.md — проверьте строку «Подсказки:» в ' + esc(TDIR + v.f) + "</p>"); return; }
              const p = parseMarkdown(t);
              d.innerHTML = "<summary><span class=\"t\">" + inline(p.title || v.hints[i]) + "</span>" +
                (p.sub ? '<span class="s">' + inline(p.sub) + "</span>" : "") + "</summary>" +
                '<div class="body">' + p.html + "</div>";
              if (i === 0) d.open = true;
              box.appendChild(d);
            });
            loadHintImages(box);
          });
        }

        q.addEventListener("input", () => {
          if (!q.value.trim()) forms.clear();
          const words = queryWords(q.value);
          if (!words.length) { show([], words); return; }
          const found = rankStudies(studies, words);
          show(found, words, true);
          if (found.length) none.hidden = true;
        });
        if (q.value) q.dispatchEvent(new Event("input"));
        else if (document.body.classList.contains("protocol-view")) {
          const id = new URLSearchParams(location.search).get("protocol");
          const study = studies.find(s => s.variants.some(v => protocolId(v) === id));
          if (study) {
            const vi = study.variants.findIndex(v => protocolId(v) === id);
            render([study], study, vi);
          } else {
            studyEl.innerHTML = '<p class="empty" role="status">Шаблон по этой ссылке не найден. Воспользуйтесь поиском.</p>';
            studyEl.hidden = false;
          }
        }
      }).catch(() => { /* нет папки templates — сайт работает как раньше */ });
    }
  }

  window.RH_APP = { start, bindHome: navigation.bindHome };
})();
