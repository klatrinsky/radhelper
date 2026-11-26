/* Контекстные подсказки КТ брюшной полости. Не входят в копируемый протокол. */
(function () {
  "use strict";
  const GUIDES = {
    liver: {
      title: "Размеры печени",
      html: '<p>Одиночный краниокаудальный размер без указания плоскости и уровня измерения не является универсальным критерием гепатомегалии.</p><p>Указание около <b>16 см по среднеключичной линии</b> встречается в практике, но максимальный размер на корональных МПР измеряется иначе. Учитывайте рост, телосложение, форму и методику.</p>',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8786943/', label: 'CT/MRI: reference liver dimensions'
    },
    gallbladder: {
      title: "Стенка желчного пузыря",
      html: '<p>Ориентир для хорошо растянутого пузыря: <b>до 3 мм</b>. При недостаточном наполнении возможно ложное утолщение стенки.</p><p>Оценивайте сочетание с перихолецистической инфильтрацией, жидкостью и конкрементами; утолщение стенки само по себе неспецифично.</p>',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7596646/', label: 'Обзор утолщения стенки'
    },
    bile: {
      title: "Калибр желчных протоков",
      html: '<p>На КТ общий желчный проток ориентировочно <b>до 7–8 мм</b> у взрослых с сохранённым желчным пузырём; возраст может увеличивать диаметр. После холецистэктомии расширение <b>до 10 мм</b> нередко физиологично.</p><p>Это ориентиры, а не абсолютная граница. Оценивайте внутрипечёночные протоки, динамику, билирубин и причину обструкции. Измеряйте диаметр перпендикулярно ходу протока.</p>',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11166583/', label: 'КТ после холецистэктомии'
    },
    pancreas: {
      title: "Главный панкреатический проток",
      html: '<p>Классический ориентир: <b>головка / тело / хвост ≈ 3 / 2 / 1 мм</b>. С возрастом проток может быть шире, без обструкции.</p><p>Особенно важны резкий обрыв протока, нарастающее расширение, атрофия паренхимы дистальнее предполагаемого препятствия и сочетанное расширение холедоха.</p>',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10237600/', label: 'Панкреатический проток и возраст'
    },
    spleen: {
      title: "Размеры селезёнки",
      html: '<p>Часто используемый ориентир длины у взрослого — <b>до 12 см</b>. Размер зависит от роста и телосложения. Изолированная длина не всегда отражает истинный объём органа.</p><p>При пограничном размере полезно оценивать объём/другие оси и сравнивать с предыдущими исследованиями.</p>',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK554559/', label: 'Spleen Imaging (NCBI)'
    },
    kidneys: {
      title: "Размеры почек",
      html: '<p>Средняя длина почки взрослого приблизительно <b>10–12 см</b>. Паренхима обычно около <b>15–20 мм</b>, корковый слой <b>7–10 мм</b>; значения зависят от методики.</p><p>Учитывайте возраст, рост, асимметрию, гидронефроз и толщину паренхимы, а не только длину.</p>',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2813848/', label: 'MDCT: размер почек'
    },
    adrenal: {
      title: "Инциденталома надпочечника",
      html: '<p><b>Однородное образование с плотностью ≤10 HU на нативной КТ</b> имеет признаки доброкачественного липид-богатого образования; дополнительные изображения обычно не нужны.</p><p>Плотность после контрастирования нельзя подставлять вместо нативной. При неоднородности, HU &gt;10 и подозрительных признаках необходима отдельная оценка по рекомендациям.</p>',
      url: 'https://academic.oup.com/ejendo/article/189/1/G1/7198474', label: 'ESE/ENSAT 2023'
    }
  };
  const LONG = [
    ['Контуры печени ровные, структура паренхимы однородная.', 'liver'],
    ['Желчный пузырь обычных размеров.', 'gallbladder'],
    ['Внутрипечёночные и внепечёночные желчные протоки обычного калибра.', 'bile'],
    ['Главный панкреатический проток обычного калибра.', 'pancreas'],
    ['Селезёнка обычных размеров.', 'spleen'],
    ['Почки обычного положения и формы.', 'kidneys'],
    ['Надпочечники обычной формы, без особенностей.', 'adrenal']
  ];
  const SHORT = [
    ['Желчевыводящие и мочевыводящие пути обычного калибра.', 'bile'],
    ['Паренхиматозные органы брюшной полости без грубых структурных изменений.', 'kidneys']
  ];
  function insertAtText(line, needle, button) {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('.tg, .fld, .calc, .measure-help')) continue;
      const pos = node.textContent.indexOf(needle);
      if (pos < 0) continue;
      const after = node.splitText(pos + needle.length);
      after.parentNode.insertBefore(button, after);
      return true;
    }
    return false;
  }
  function addGuide(line, needle, key, serial) {
    const guide = GUIDES[key];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'measure-help-toggle abdominal-help-toggle';
    button.textContent = '? Нормы';
    button.setAttribute('aria-label', 'Справка: ' + guide.title);
    button.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div');
    panel.id = 'abdomen-guide-' + serial;
    panel.className = 'measure-help abdominal-help';
    panel.hidden = true;
    panel.innerHTML = '<div class="measure-help-copy"><strong>' + guide.title + '</strong>' + guide.html +
      '<p><a href="' + guide.url + '" target="_blank" rel="noopener noreferrer">Источник: ' + guide.label + '</a></p></div>';
    button.setAttribute('aria-controls', panel.id);
    if (!insertAtText(line, needle, button)) return false;
    line.after(panel);
    button.addEventListener('click', () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
    });
    return true;
  }
  window.RH_ABDOMEN_GUIDES = {
    add(text, el) {
      if (!text.includes('Свободные пространства брюшной полости без особенностей.')) return;
      if (el.querySelector('.abdominal-help-toggle')) return;
      const lines = [...el.querySelectorAll('.ln')];
      let serial = 0;
      for (const [needle, key] of [...LONG, ...SHORT]) {
        const line = lines.find(x => x.textContent.includes(needle));
        if (line) addGuide(line, needle, key, ++serial);
      }
    }
  };
})();
