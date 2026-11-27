/* «Что нового»: content/news.md у врача, content/news_lab.md у лаборанта. «# …» — дата, «- …» — новость.
   [[слово]] подставляет запрос в поиск врача; [текст](?lab#раздел) открывает раздел у лаборанта.
   Записи идут от новых к старым. В новых датах указываем год; для старых он выводится из предыдущей даты. */
(function () {
  const box = document.getElementById("news");
  const q = document.getElementById("q");
  const dlg = document.getElementById("newsArchive");
  const all = document.getElementById("newsArchiveBody");
  if (!box || location.protocol === "file:") return;
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const line = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="try" role="button" tabindex="0" data-q="$1">«$1»</span>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\(((?:\?|\/)[^)\s]*)\)/g, '<a href="$2">$1</a>');   // ссылка внутри сайта, например ?lab
  const list = items => "<ul>" + items.map(i => "<li>" + line(i) + "</li>").join("") + "</ul>";
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  function parseDate(heading, previous) {
    const match = heading.match(/(?:^| · )(\d{1,2}) ([а-я]+)(?: (\d{4}))?$/i);
    if (!match) return null;
    const day = Number(match[1]);
    const month = months.indexOf(match[2].toLowerCase());
    if (month === -1) return null;
    let year = match[3] ? Number(match[3]) : previous.getFullYear();
    if (!match[3] && (month > previous.getMonth() || (month === previous.getMonth() && day > previous.getDate()))) year--;
    const date = new Date(year, month, day);
    return date.getMonth() === month && date.getDate() === day ? date : null;
  }

  function markNew(item, date) {
    if (!date) return;
    const expires = new Date(date);
    expires.setDate(expires.getDate() + 7);
    const now = Date.now();
    if (now < date || now >= expires) return;
    const badge = document.createElement("span");
    badge.className = "news-badge";
    badge.textContent = "Новое";
    const space = document.createTextNode(" ");
    item.prepend(badge, space);
    setTimeout(() => { badge.remove(); space.remove(); }, expires - now);
  }

  // [[слово]] — подставить в поиск (из архива — сначала закрыть окно)
  function tryHandlers(root, before) {
    const go = el => { if (before) before(); q.value = el.dataset.q; q.dispatchEvent(new Event("input")); q.focus(); };
    root.addEventListener("click", e => { const el = e.target.closest(".try"); if (el) go(el); });
    root.addEventListener("keydown", e => { const el = e.target.closest(".try"); if (el && e.key === "Enter") go(el); });
  }
  const close = () => {
    if (!dlg.open) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  };

  fetch(window.RH_LAB ? "content/news_lab.md" : "content/news.md", { cache: "no-cache" }).then(r => r.ok ? r.text() : "").then(t => {
    let blocks = [], previousDate = new Date();
    t.replace(/\r/g, "").split("\n").forEach(l => {
      l = l.trim();
      if (/^# /.test(l)) {
        const h = l.slice(2);
        const date = parseDate(h, previousDate);
        if (date) previousDate = date;
        blocks.push({ h, date, items: [] });
      } else if (/^[-*] /.test(l)) {
        if (!blocks.length) blocks.push({ h: "", date: null, items: [] });
        blocks[blocks.length - 1].items.push(l.slice(2));
      }
    });
    blocks = blocks.filter(b => b.items.length);
    if (!blocks.length) return;

    const recent = blocks.flatMap(b => b.items.map(text => ({ text, date: b.date }))).slice(0, 7);
    box.innerHTML = "<h2>Что нового</h2>" + list(recent.map(item => item.text));
    box.querySelectorAll("li").forEach((item, index) => markNew(item, recent[index].date));
    box.hidden = false;
    tryHandlers(box);

    const latestDate = blocks.find(b => b.date)?.date;
    if (latestDate) {
      const footer = document.getElementById("lastUpdate");
      footer.textContent = "Последнее обновление: " + latestDate.toLocaleDateString("ru-RU", {
        day: "2-digit", month: "2-digit", year: "numeric"
      });
      footer.hidden = false;
    }

    const heading = box.querySelector("h2");
    if (!dlg) return;
    all.innerHTML = blocks.map(b => (b.h ? "<h2>" + line(b.h) + "</h2>" : "") + list(b.items)).join("");
    tryHandlers(all, close);
    all.addEventListener("click", e => {
      if (e.target.closest('a[href^="?lab#"]')) close();
    });
    const link = document.createElement("a");
    link.href = "#newsArchive";
    link.textContent = heading.textContent;
    link.setAttribute("aria-haspopup", "dialog");
    heading.replaceChildren(link);
    const openArchive = () => {
      if (dlg.open) return;
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      dlg.scrollTop = 0;
    };
    link.addEventListener("click", event => { event.preventDefault(); openArchive(); });
    if (location.hash === link.hash) openArchive();
    dlg.querySelector(".news-arch-x").addEventListener("click", close);
    dlg.addEventListener("click", e => { if (e.target === dlg) close(); });   // клик мимо окна
  }).catch(() => {});
})();
