(function () {
  // Вход для лаборантов: адрес с ?lab (короткий вход /lab/ перекидывает сюда же).
  // Свой заголовок и подсказка в поле, только разделы с «Для: лаборант» или «Для: оба», без шаблонов заключений.
  window.RH_LAB = /(^|[?&])lab(=|&|$)/i.test(location.search.slice(1));
  if (window.RH_LAB) document.body.classList.add("lab");
  const hasProtocol = !window.RH_LAB && new URLSearchParams(location.search).has("protocol");
  if (hasProtocol) document.body.classList.add("protocol-view");
  else if (!location.hash) document.body.classList.add("home");

  function configureEntry() {
    if (window.RH_LAB) {
      document.title = "Помощник лаборанта";
      document.getElementById("q").removeAttribute("autofocus");
      document.querySelector("#homeBtn img").src = "img/doctor-cat.jpg";
      document.querySelector("footer p").textContent = "Справочный материал для рентгенолаборантов, не клиническая рекомендация. Решения о введении контраста принимает врач.";
      const side = document.getElementById("sideLink");
      side.href = "./"; side.textContent = "Помощник рентгенолога →";
    } else if (hasProtocol) {
      document.getElementById("q").removeAttribute("autofocus");
    }
  }

  function bindLabSections(secs, q, none) {
    // Лаборант: на главной — кнопки всех разделов, чтобы не набирать слова руками
    if (!window.RH_LAB) return;

    // показать только выбранные разделы, раскрытыми
    const only = ids => {
      q.value = "";
      document.body.classList.remove("home");
      secs.forEach(s => { s.hidden = !ids.includes(s.id); s.open = !s.hidden; });
      none.hidden = true;
      history.replaceState(null, "", "#" + ids[0]);
      window.scrollTo(0, 0);
    };
    const btns = list => list.map(s => '<button type="button" data-id="' + s.id + '">' +
      s.querySelector("summary .t").innerHTML + "</button>").join("");
    const sos = secs.filter(s => s.classList.contains("sos"));
    const nav = document.getElementById("labLinks");
    nav.innerHTML = btns(secs.filter(s => !s.classList.contains("sos") && !s.dataset.nobtn));
    nav.hidden = false;
    const sosNav = document.getElementById("sosLinks");
    sosNav.innerHTML = btns(sos);
    sosNav.hidden = !sos.length;
    [nav, sosNav].forEach(n => n.addEventListener("click", e => {
      const b = e.target.closest("button"); if (b) only([b.dataset.id]);
    }));
    // SOS в углу на всех страницах, кроме главной: сразу все экстренные разделы
    document.getElementById("sosFab").addEventListener("click", () => only(sos.map(s => s.id)));

    // Прямые ссылки из новостей и переходы по истории внутри входа лаборанта.
    const openLinkedSection = () => {
      const id = location.hash.slice(1);
      if (secs.some(s => s.id === id)) only([id]);
      else if (!id) document.getElementById("homeBtn").click();
    };
    if (location.hash) openLinkedSection();
    window.addEventListener("hashchange", openLinkedSection);
  }

  function bindSectionLinks(secs, q) {
    // открытый раздел попадает в адрес — ссылкой можно поделиться
    secs.forEach(s => s.addEventListener("toggle", () => {
      if (s.open && !q.value) history.replaceState(null, "", "#" + s.id);
    }));
    if (!window.RH_LAB) {
      const findSection = hash => secs.find(s => "#" + s.id === hash);
      const openLinkedSection = () => {
        const target = findSection(location.hash);
        if (!target || document.body.classList.contains("protocol-view")) return;
        document.body.classList.remove("home");
        target.open = true;
        target.scrollIntoView();
      };
      openLinkedSection();
      window.addEventListener("hashchange", e => {
        if (findSection(location.hash)) openLinkedSection();
        else if (!location.hash && !q.value && findSection(new URL(e.oldURL).hash)) {
          document.getElementById("homeBtn").click();
        }
      });
      document.getElementById("catalog").addEventListener("click", e => {
        const link = e.target.closest('a[href^="#"]');
        if (link && link.hash === location.hash && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          openLinkedSection();
        }
      });
    }
  }

  /* Кот слева от поиска или Esc в строке поиска очищает запрос и возвращает на пустую главную.
     Esc работает только в строке поиска: в полях шаблона он стёр бы всё, что врач уже набрал. */
  function bindHome() {
    const q = document.getElementById("q");
    const fine = window.matchMedia && matchMedia("(pointer: fine)").matches;   // мышь, а не палец: ставить курсор в поиск

    function home() {
      q.value = "";
      q.dispatchEvent(new Event("input"));
      document.body.classList.add("home");
      history.replaceState(null, "", location.pathname + location.search);  // убрать #раздел, ?lab оставить
      window.scrollTo(0, 0);
      if (fine && !window.RH_LAB) q.focus();
    }
    document.getElementById("homeBtn").addEventListener("click", home);
    q.addEventListener("keydown", e => { if (e.key === "Escape" && (q.value || document.body.classList.contains("protocol-view"))) { e.preventDefault(); home(); } });
  }

  window.RH_NAVIGATION = { configureEntry, bindLabSections, bindSectionLinks, bindHome };
})();
