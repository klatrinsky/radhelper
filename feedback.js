/* «Поправить»: выделил кусок шаблона или подсказки → кнопка → Яндекс Форма с уже заполненными полями.
   Ответы формы приходят автору на почту (включается в настройках формы: «Уведомления» / «Письмо»).

   Настройка — только тут:
     FORM — адрес формы (forms.yandex.ru/u/…/). Пустая строка — кнопка выключена, сайт работает как раньше.
     F    — идентификаторы вопросов формы («Показать настройки» в блоке вопроса).
            Поле «Что не так» пользователь заполняет сам — его id здесь не нужен. */
(function () {
  const FORM = "https://forms.yandex.ru/u/6af97c1c28697b37675d7d79/";
  const F = {
    text:  "Fragment",                                      // «Выделенный фрагмент» (длинный текст)
    where: "Source",                                      // «Шаблон / раздел» (короткий текст), например templates/ct-brain.md · Норма
    page:  "Page"                                       // «Страница» (короткий текст), адрес
  };
  const MAX = 1200;                                   // символов фрагмента: длиннее — режем, иначе ссылка не влезет

  if (!FORM) return;

  // Где можно выделять: шаблон, находка, подсказки под шаблоном, карточки разделов
  const ZONES = "#study .tpl, #study .fx, #study .hints .body, #list details.sec .body";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fb-btn";
  btn.textContent = "✎ Поправить";
  btn.hidden = true;
  document.body.appendChild(btn);

  let picked = null;                                  // { text, where } — запоминаем сразу: выделение может слететь при тапе

  // Текст выделения с учётом полей [__]: toString() их значения теряет, а скрытые варианты {а|б} — наоборот, тащит
  // (клон поля не помнит, что в него вбили, — поэтому перед клонированием кладём значение в data-fb)
  function selText(range) {
    const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const inputs = Array.from(root.querySelectorAll("input, textarea, select"));
    inputs.forEach(n => n.dataset.fb = n.tagName === "SELECT" ? (n.selectedOptions[0] || {}).text || "" : n.value || "[" + (n.placeholder || "__") + "]");
    const box = document.createElement("div");
    box.appendChild(range.cloneContents());
    inputs.forEach(n => delete n.dataset.fb);
    box.querySelectorAll("[hidden]").forEach(n => n.remove());
    box.querySelectorAll("input, textarea, select").forEach(n => n.replaceWith(n.dataset.fb || ""));
    return box.textContent.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Откуда кусок: файл шаблона и вкладка — или файл карточки
  function whereOf(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    const study = el.closest("#study");
    if (study) {
      const tab = study.querySelector('.tab[aria-selected="true"]');
      const h = study.querySelector("h2");
      return [study.dataset.src || (h ? h.firstChild.textContent : "шаблон"),
              tab ? tab.textContent : "",
              el.closest(".hints") ? "подсказка: " + (el.closest("details")?.querySelector("summary .t")?.textContent || "") : ""]
        .filter(Boolean).join(" · ");
    }
    const sec = el.closest("details.sec");
    return sec && sec.id ? "ru/" + sec.id + ".md" : "?";
  }

  function hide() { btn.hidden = true; picked = null; }

  function update() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hide();
    const range = sel.getRangeAt(0);
    const a = range.startContainer, b = range.endContainer;
    const za = (a.nodeType === 1 ? a : a.parentElement).closest(ZONES);
    const zb = (b.nodeType === 1 ? b : b.parentElement).closest(ZONES);
    if (!za || za !== zb) return hide();             // выделили мимо или через два блока — молчим
    const text = selText(range);
    if (text.length < 2) return hide();
    picked = { text, where: whereOf(range.commonAncestorContainer) };

    // Кнопка — под выделением: сверху на телефоне висит системное меню «Копировать / Выделить всё»
    const r = range.getBoundingClientRect();
    btn.hidden = false;
    const w = btn.offsetWidth;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 8);
    let top = r.bottom + 8;
    if (top + 44 > window.innerHeight) top = Math.max(8, r.top - 52);   // у нижнего края — над выделением
    btn.style.left = left + "px";
    btn.style.top = top + "px";
  }

  let t;
  document.addEventListener("selectionchange", () => { clearTimeout(t); t = setTimeout(update, 250); });
  window.addEventListener("scroll", () => { if (!btn.hidden) update(); }, { passive: true });
  window.addEventListener("resize", () => { if (!btn.hidden) update(); });

  // Не даём клику по кнопке сбросить выделение раньше времени
  btn.addEventListener("pointerdown", e => e.preventDefault());
  btn.addEventListener("mousedown", e => e.preventDefault());

  btn.addEventListener("click", () => {
    if (!picked) return;
    const url = new URL(FORM);
    let text = picked.text;
    if (text.length > MAX) text = text.slice(0, MAX) + " […]";
    if (F.text) url.searchParams.set(F.text, text);
    if (F.where) url.searchParams.set(F.where, picked.where);
    if (F.page) url.searchParams.set(F.page, location.href);
    window.open(url.toString(), "_blank", "noopener");
    window.getSelection().removeAllRanges();
    hide();
  });
})();
