/* «Поправить»: выделение открывает кнопку Яндекс Формы. В форму передаётся только источник.
   Ответы формы приходят автору на почту (включается в настройках формы: «Уведомления» / «Письмо»).

   Настройка — только тут:
     FORM — адрес формы (forms.yandex.ru/u/…/). Пустая строка — кнопка выключена, сайт работает как раньше.
     SOURCE_FIELD — идентификатор вопроса «Шаблон / раздел» в настройках формы. */
(function () {
  const FORM = "https://forms.yandex.ru/u/6af97c1c28697b37675d7d79/";
  const SOURCE_FIELD = "Source";

  if (!FORM) return;

  // Кроме шаблонов и справочных карточек, отдельные страницы могут пометить свои блоки.
  const ZONES = "#study .tpl, #study .fx, #study .hints .body, #list details.sec .body, [data-feedback-source]";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fb-btn";
  btn.textContent = "✎ Поправить";
  btn.hidden = true;
  document.body.appendChild(btn);

  let source = null;                                  // сохраняем источник до нажатия, пока видно выделение

  // Откуда кусок: файл шаблона и вкладка — или файл карточки
  function whereOf(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    const study = el.closest("#study");
    if (study) {
      const tab = study.querySelector('.tab[aria-selected="true"]');
      return [study.dataset.src,
              tab ? tab.textContent : "",
              el.closest(".hints") ? "подсказка: " + (el.closest("details")?.querySelector("summary .t")?.textContent || "") : ""]
        .filter(Boolean).join(" · ");
    }
    const sec = el.closest("details.sec");
    return sec && sec.id ? "ru/" + sec.id + ".md" : null;
  }

  function hide() { btn.hidden = true; source = null; }

  function update() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hide();
    const range = sel.getRangeAt(0);
    const a = range.startContainer, b = range.endContainer;
    const za = (a.nodeType === 1 ? a : a.parentElement).closest(ZONES);
    const zb = (b.nodeType === 1 ? b : b.parentElement).closest(ZONES);
    if (!za || za !== zb) return hide();             // выделили мимо или через два блока — молчим
    source = za.dataset.feedbackSource || whereOf(range.commonAncestorContainer);
    if (!source) return hide();

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
    if (!source) return;
    const url = new URL(FORM);
    url.searchParams.set(SOURCE_FIELD, source);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    window.getSelection().removeAllRanges();
    hide();
  });
})();
