(function () {
  const { loadHintImages } = window.RH_MARKDOWN;

  function addKellgrenGuide(el, joint) {
    const knee = joint === "колено";
    const folder = knee ? "kellgren-knee" : "kellgren-hip";
    const anatomy = knee ? "коленного сустава" : "тазобедренного сустава";
    const source = knee
      ? 'D. J. Solomon, P. McLoughlin. <a href="https://assets.cureus.com/uploads/original_article/pdf/420801/20251029-207681-fherkc.pdf#page=3" target="_blank" rel="noopener">Cureus, 2025, рис. 1–5</a> · Размер снимков уменьшен.'
      : 'R. M. Huzum и соавт. <a href="https://mdpi-res.com/d_attachment/diagnostics/diagnostics-15-01932/article_deploy/diagnostics-15-01932.pdf?version=1753970717#page=5" target="_blank" rel="noopener">Diagnostics, 2025, рис. 2</a> · Панели разделены на отдельные снимки.';
    const figures = Array.from({ length: 5 }, (_, grade) => {
      const src = "assets/img/" + folder + "/kl-" + grade + ".jpg";
      const alt = "Рентгенограмма " + anatomy + ", степень " + grade;
      return '<figure><button type="button" class="kl-zoom" aria-haspopup="dialog" aria-label="Увеличить снимок: степень ' + grade +
        '"><img data-hint-src="' + src + '" loading="lazy" alt="' + alt + '"></button><figcaption>Степень ' + grade + '</figcaption></figure>';
    }).join("");
    addImageGuide(el, "Сравнить степени Келлгрена — Лоуренса", figures, source);
  }

  function addPostopGuide(el, hip) {
    const images = hip ? [
      ["hip-7.jpg", "Цементная чашка. Треугольные метки указывают на цементную мантию вокруг вертлужного компонента."],
      ["hip-4.jpg", "Бесцементная чашка (press-fit). Металлическая оболочка прилежит к ложу без цементной мантии."],
      ["hip-6.jpg", "Бесцементная чашка с винтом. Винт проходит из чашки в подвздошную кость. Цемент вокруг ножки относится к бедренному компоненту."]
    ] : [
      ["scarf-akin.jpg", "Scarf и Akin на одном снимке. Чёрные стрелки указывают на фиксацию I плюсневой кости после Scarf, белая — на остеотомию проксимальной фаланги I пальца по Akin."],
      ["weil.jpg", "Пример подголовчатой остеотомии по Weil. Чёрные стрелки указывают на винты в дистальном отделе II плюсневой кости. Белая стрелка отмечает отдельное вмешательство на пальце."]
    ];
    const figures = images.map(([file, caption]) =>
      '<figure><button type="button" class="kl-zoom" aria-haspopup="dialog" aria-label="Увеличить: ' +
      caption + '"><img data-hint-src="assets/img/postop/' + file + '" loading="lazy" alt="' + caption +
      '"></button><figcaption>' + caption + '</figcaption></figure>').join("");
    const source = hip
      ? 'J. Vanrusselt и соавт. <a href="https://doi.org/10.1007/s13244-015-0438-5" target="_blank" rel="noopener">Insights into Imaging, 2015, рис. 7, 4 и 6</a>.'
      : 'M. Soltanolkotabi и соавт. <a href="https://doi.org/10.3390/diagnostics12051090" target="_blank" rel="noopener">Diagnostics, 2022, рис. 3B и 4B</a>. Панели выделены и уменьшены.';
    addImageGuide(el, hip ? "Как различить фиксацию чашки?" : "Как выглядят остеотомии?", figures, source);
  }

  function addTemporalGuide(el) {
    const images = [
      ["middle-ear.png", "Среднее ухо. A–C: сохранная шпора, воздушный эпитимпанум и сочленение наковальни со стременем. D–I: примеры холестеатомы и хронического отита."],
      ["inner-ear.jpg", "Внутреннее ухо и канал лицевого нерва. На аксиальных срезах отмечены улитка, преддверие, полукружные каналы, внутренний слуховой проход (IAC) и сегменты канала VII нерва."],
      ["tegmen-labyrinth.png", "Эрозии при холестеатоме. A–B: латеральный полукружный канал, C: крыша барабанной полости, D: базальный завиток улитки."]
    ];
    const figures = images.map(([file, caption]) =>
      '<figure><button type="button" class="kl-zoom" aria-haspopup="dialog" aria-label="Увеличить: ' +
      caption + '"><img data-hint-src="assets/img/temporal/' + file + '" loading="lazy" alt="' + caption +
      '"></button><figcaption>' + caption + '</figcaption></figure>').join("");
    const source = 'P. Touska, S. E. J. Connor. <a href="https://link.springer.com/article/10.1007/s00330-024-11021-x#Fig1" target="_blank" rel="noopener">European Radiology, 2025, рис. 1</a> и <a href="https://link.springer.com/article/10.1007/s00330-024-11021-x#Fig3" target="_blank" rel="noopener">рис. 3</a>. ' +
      'P. Feraco, S. Piccinini, C. Gagliardo. <a href="https://link.springer.com/article/10.1007/s11547-021-01387-z#Fig3" target="_blank" rel="noopener">La Radiologia Medica, 2021, рис. 3</a>.';
    addImageGuide(el, "Ориентиры на КТ височных костей", figures, source, "Увеличенный снимок КТ");
  }

  function addImageGuide(el, title, figures, source, imageLabel = "Увеличенная рентгенограмма") {
    const guide = document.createElement("details");
    guide.className = "kl-guide";
    guide.innerHTML = '<summary class="measure-help-toggle">' + title + '</summary>' +
      '<div class="kl-panel"><div class="kl-images">' + figures + '</div>' +
      '<p class="kl-source">' + source + ' <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></p></div>' +
      '<dialog class="kl-viewer" aria-label="' + imageLabel + '">' +
      '<div class="kl-viewer-bar"><strong></strong><button type="button" class="measure-help-toggle" autofocus>Закрыть</button></div><img alt=""></dialog>';
    const dialog = guide.querySelector("dialog");
    const enlarged = dialog.querySelector("img");
    guide.querySelectorAll(".kl-zoom").forEach(button => {
      button.addEventListener("click", () => {
        const image = button.querySelector("img");
        dialog.querySelector("strong").textContent = button.parentElement.querySelector("figcaption").textContent;
        const src = image.getAttribute("src") || image.dataset.hintSrc;
        if (enlarged.getAttribute("src") !== src) enlarged.src = src;
        enlarged.alt = image.alt;
        dialog.showModal();
      });
    });
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    enlarged.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    el.append(guide);
  }

  function addGcaGuide(el) {
    const caption = "Корковая атрофия от 0 до 3 степени слева направо. Аксиальные срезы бесконтрастной КТ.";
    const figure = '<figure class="gca-figure"><button type="button" class="kl-zoom" aria-haspopup="dialog" aria-label="Увеличить рисунок GCA">' +
      '<img data-hint-src="assets/img/gca-ct.webp" width="1773" height="691" loading="lazy" alt="' + caption + '"></button>' +
      '<figcaption>' + caption + '</figcaption></figure>';
    const source = '© 2023 Brugnara и соавт. <a href="https://link.springer.com/article/10.1007/s00330-023-10107-2#Fig1" ' +
      'target="_blank" rel="noopener">European Radiology, рис. 1</a>. Показан верхний ряд оригинала.';
    addImageGuide(el, "Степени атрофии по GCA на КТ", figure, source, "Увеличенный рисунок GCA на КТ");
  }

  function addEvansGuide(fields) {
    // Кнопка стоит снаружи переключателя «Желудочки».
    const control = fields[0].closest(".tg");
    const line = control?.closest(".ln");
    if (!line) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "measure-help-toggle";
    button.textContent = "Как измерить?";
    button.setAttribute("aria-label", "Как измерить индекс Эванса?");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "evans-guide");
    control.after(button);

    const panel = document.createElement("div");
    panel.id = "evans-guide";
    panel.className = "measure-help";
    panel.hidden = true;
    panel.innerHTML = '<img data-hint-src="assets/img/evans-index.svg" width="210" height="175" loading="lazy" alt="Схема аксиального среза с линиями A и B">' +
      '<div class="measure-help-copy"><p><strong>Индекс Эванса = A / B</strong></p>' +
      '<p><b>A</b> — максимальная ширина передних рогов боковых желудочков.</p>' +
      '<p><b>B</b> — максимальный внутренний поперечник черепа на том же аксиальном срезе.</p>' +
      '<p><a href="https://doi.org/10.2176/nmc.st.2020-0292">Источник методики</a></p></div>';
    line.after(panel);
    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) loadHintImages(panel);
    });
  }

  window.RH_TEMPLATE_GUIDES = { addKellgrenGuide, addPostopGuide, addTemporalGuide, addGcaGuide, addEvansGuide };
})();
