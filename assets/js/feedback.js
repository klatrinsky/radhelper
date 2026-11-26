/* «Поправить»: пользователь проверяет фрагмент перед открытием Яндекс Формы.
   Ответы формы приходят автору на почту (включается в настройках формы: «Уведомления» / «Письмо»).

   Настройка — только тут:
     FORM — адрес формы (forms.yandex.ru/u/…/). Пустая строка — кнопка выключена, сайт работает как раньше.
     SOURCE_FIELD и FRAGMENT_FIELD — идентификаторы вопросов в настройках формы. */
(function () {
  const FORM = "https://forms.yandex.ru/u/6af97c1c28697b37675d7d79/";
  const SOURCE_FIELD = "Source";
  const FRAGMENT_FIELD = "Fragment";
  const MAX_FRAGMENT_LENGTH = 1200;

  if (!FORM) return;

  document.querySelectorAll("#study, #list, [data-feedback-help]").forEach(target => {
    const tip = document.createElement("p");
    tip.className = "feedback-help";
    tip.textContent = "Нашли ошибку или хотите предложить изменение? Выделите текст и нажмите «Поправить».";
    target.insertAdjacentElement("afterend", tip);
  });

  // Кроме шаблонов и справочных карточек, отдельные страницы могут пометить свои блоки.
  const ZONES = "#study .tpl, #study .fx, #study .app-entry, #study .hints .body, #list details.sec .body, [data-feedback-source]";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fb-btn";
  btn.textContent = "✎ Поправить";
  btn.hidden = true;
  document.body.appendChild(btn);

  const dialog = document.createElement("dialog");
  dialog.className = "fb-review";
  dialog.setAttribute("aria-labelledby", "fb-review-title");
  dialog.setAttribute("aria-describedby", "fb-review-help");
  dialog.innerHTML = `
    <form method="dialog">
      <h2 id="fb-review-title" tabindex="-1" autofocus>Проверьте фрагмент</h2>
      <p id="fb-review-help">Удалите ФИО, даты рождения и другие данные, по которым можно узнать пациента. Чтобы открыть форму без фрагмента, очистите поле.</p>
      <label for="fb-review-text">Текст для Яндекс Формы</label>
      <textarea id="fb-review-text" rows="5" maxlength="${MAX_FRAGMENT_LENGTH}" autocomplete="off" spellcheck="false"></textarea>
      <div class="fb-review-actions">
        <button type="submit">Отмена</button>
        <button type="button" class="fb-continue">Открыть Яндекс Форму</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const reviewText = dialog.querySelector("textarea");
  let reviewSource = "";
  let source = null, fragment = "";                  // сохраняем выделение до нажатия

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

  function hide() { btn.hidden = true; source = null; fragment = ""; }

  function update() {
    if (dialog.open) return hide();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hide();
    const range = sel.getRangeAt(0);
    const a = range.startContainer, b = range.endContainer;
    const za = (a.nodeType === 1 ? a : a.parentElement).closest(ZONES);
    const zb = (b.nodeType === 1 ? b : b.parentElement).closest(ZONES);
    if (!za || za !== zb) return hide();             // выделили мимо или через два блока — молчим
    source = za.dataset.feedbackSource || whereOf(range.commonAncestorContainer);
    if (!source) return hide();
    fragment = [...sel.toString().trim()].slice(0, MAX_FRAGMENT_LENGTH).join("");
    if (!fragment) return hide();

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
    reviewSource = source;
    reviewText.value = fragment;
    dialog.showModal();
    window.getSelection().removeAllRanges();
    hide();
  });

  dialog.querySelector(".fb-continue").addEventListener("click", () => {
    const text = reviewText.value.trim();
    const url = new URL(FORM);
    url.searchParams.set(SOURCE_FIELD, reviewSource);
    if (text) url.searchParams.set(FRAGMENT_FIELD, text);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    dialog.close();
  });

  dialog.addEventListener("close", () => {
    reviewText.value = "";
    reviewSource = "";
  });
})();
