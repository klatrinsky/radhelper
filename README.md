# RadHelper

[Врачу](https://radhelper.ru/) — шаблоны описаний и заключений, классификации и калькуляторы. [Лаборанту](https://radhelper.ru/?lab) — расчёт контраста и дозы, памятки по КТ.

## Структура

- `index.html` — HTML-каркас входов врача и лаборанта. `lab/` перенаправляет на `/?lab`.
- `content/` — новости, [шаблоны](content/templates/), [памятки и подсказки](content/guides/), [находки](content/findings/). Новый шаблон, памятку или находку добавьте в `order.txt` своей папки. [Формат файлов](docs/SYNTAX.md).
- `assets/` — стили, скрипты, значки и изображения сайта. `assets/js/app.js` запускает приложение и связывает модули. Движок шаблонов находится в `assets/js/template-engine.js`.
- `pages/` — конструктор переломов, демонстрационные схемы и условия использования.
- `tests/` — проверки Node.js, браузерные сценарии в `tests/browser/` и ручные проверки в `tests/manual/`.

## Проверки

- Для проверки расчётов и содержимого используйте Node.js 22 и выполните `npm ci && npm test`.
- Для браузерных тестов нужны Python 3 и Chromium. Установите браузер командой `npx playwright install chromium` и запустите `npm run test:browser`. Playwright сам поднимет локальный сервер.
- GitHub Actions запускает оба набора проверок для pull request в `main` и изменений в `main`. GitHub Pages публикует только успешно проверенную версию из `main`. В настройках репозитория выберите **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Репозиторий публичный. Данные пациентов не добавлять. Условия использования — в [LICENSE](LICENSE).
