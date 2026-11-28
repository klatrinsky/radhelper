(function () {
  "use strict";

  /* ---------- Мини-разметка: подмножество Markdown ---------- */
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function inline(s) {
    s = esc(s).replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  const cells = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());

  function parse(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const out = { title: "", sub: "", html: "", who: "врач", words: "", sos: false, btn: true, classification: false };
    let html = "", para = [], list = [], ltag = "ul";
    const flushP = () => { if (para.length) { html += "<p>" + inline(para.join(" ")) + "</p>"; para = []; } };
    const flushL = () => { if (list.length) { html += "<" + ltag + ">" + list.map(x => "<li>" + inline(x) + "</li>").join("") + "</" + ltag + ">"; list = []; } };
    const flush = () => { flushP(); flushL(); };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i], t = raw.trim();
      if (!t) { flush(); continue; }
      if (/^# /.test(t) && !out.title) { flush(); out.title = t.slice(2).trim(); continue; }
      // служебные строки раздела: на экран не выводятся
      if (/^Для:/i.test(t)) { flush(); out.who = t.replace(/^Для:\s*/i, "").trim().toLowerCase().replace(/ё/g, "е"); continue; }
      if (/^Слова:/i.test(t)) { flush(); out.words += " " + t.replace(/^Слова:\s*/i, ""); continue; }
      if (/^Каталог:\s*классификация$/i.test(t)) { flush(); out.classification = true; continue; }
      // «Срочно: да» — экстренный раздел: красная рамка, у лаборанта — красная кнопка вверху главной и кнопка SOS
      if (/^Срочно:/i.test(t)) { flush(); out.sos = true; continue; }
      // «Кнопка: нет» — раздел без кнопки на главной лаборанта; находится только поиском
      if (/^Кнопка:/i.test(t)) { flush(); out.btn = !/^Кнопка:\s*нет/i.test(t); continue; }
      // «Позвонить: Код синий | +7 985 954-11-40» — большая кнопка звонка в одно касание
      if (/^Позвонить:/i.test(t)) {
        flush();
        const [who, num] = t.replace(/^Позвонить:\s*/i, "").split("|").map(s => s.trim());
        const tel = (num || who).replace(/[^\d+]/g, "");
        html += '<a class="call" href="tel:' + tel + '">📞 ' + (num ? esc(who) + ' · <span class="nw">' + esc(num) + "</span>" : '<span class="nw">' + esc(who) + "</span>") + "</a>";
        continue;
      }
      // калькулятор из assets/js/widgets.js: «Виджет: имя»
      if (/^Виджет:/i.test(t)) { flush(); html += '<div class="widget" data-widget="' + esc(t.replace(/^Виджет:\s*/i, "").trim()) + '"></div>'; continue; }
      if (/^##+ /.test(t)) { flush(); html += "<h3>" + inline(t.replace(/^##+ /, "")) + "</h3>"; continue; }
      if (/^> ?/.test(t) && !out.sub && !html) { flush(); out.sub = t.replace(/^> ?/, ""); continue; }
      if (t.startsWith("|")) {
        flush();
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i].trim()); i++; }
        i--;
        const head = cells(rows[0]);
        const body = rows.slice(1).filter(r => !/^\|?[\s:|-]+\|?$/.test(r)).map(cells);
        html += "<table><thead><tr>" + head.map(h => "<th>" + inline(h) + "</th>").join("") + "</tr></thead><tbody>" +
          body.map(r => "<tr>" + head.map((h, k) =>
            '<td data-label="' + esc(h) + '">' + inline(r[k] || "") + "</td>").join("") + "</tr>").join("") +
          "</tbody></table>";
        continue;
      }
      if (/^[-*] /.test(t)) { flushP(); if (ltag !== "ul") flushL(); ltag = "ul"; list.push(t.slice(2)); continue; }
      // нумерованный список: «1. Остановить введение»
      const ol = t.match(/^\d+[.)] (.*)$/);
      if (ol) { flushP(); if (ltag !== "ol") flushL(); ltag = "ol"; list.push(ol[1]); continue; }
      // картинка: ![подпись](assets/img/файл.svg) — отдельной строкой
      const im = t.match(/^!\[([^\]]*)\]\(((?:assets\/img\/|img\/|https:\/\/)[^)\s]+)\)$/);
      if (im) {
        flush();
        const src = im[2].replace(/^img\//, "assets/img/");
        html += '<img class="pic" data-hint-src="' + esc(src) + '" alt="' + esc(im[1]) + '" loading="lazy">';
        continue;
      }
      if (/^`[^`]+`$/.test(t)) { flush(); html += '<code class="formula">' + esc(t.slice(1, -1)) + "</code>"; continue; }
      if (/^(Источник|Radiopaedia):/.test(t)) { flush(); html += '<p class="src">' + inline(t) + "</p>"; continue; }
      flushL(); para.push(t);
    }
    flush();
    // две и больше картинок подряд — в ряд (на узком экране тоже)
    out.html = html.replace(/(?:<img class="pic"[^>]*>){2,}/g, m => '<div class="pics">' + m + "</div>");
    return out;
  }

  function loadHintImages(root) {
    root.querySelectorAll("img[data-hint-src]").forEach(image => {
      if (image.closest("details:not([open]), [hidden]")) return;
      image.src = image.dataset.hintSrc;
      delete image.dataset.hintSrc;
    });
  }

  window.RH_MARKDOWN = { esc, inline, parse, loadHintImages };
})();
