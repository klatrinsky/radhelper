# RadHelper

[Врачу](https://radhelper.ru/) — шаблоны описаний и заключений, классификации и калькуляторы. [Лаборанту](https://radhelper.ru/?lab) — расчёт контраста и дозы, памятки по КТ.

- Шаблоны — в `templates/`, подсказки — в `ru/`, находки — в `tools/`. Новый файл добавь в `order.txt` своей папки. [Формат файлов](docs/SYNTAX.md).
- Новости и примеры поиска — в `content/`. Ресурсы сайта — в `assets/`, иллюстрации к памяткам — в `img/`.
- Для проверки расчётов и содержимого используйте Node.js 22 и выполните `npm ci && npm test`.
- Для браузерных тестов нужны Python 3 и Chromium. Установите браузер командой `npx playwright install chromium` и запустите `npm run test:browser`. Playwright сам поднимет локальный сервер.
- GitHub Actions запускает оба набора проверок для pull request в `main` и изменений в `main`. GitHub Pages публикует только успешно проверенную версию из `main`. В настройках репозитория выберите **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Репозиторий публичный. Данные пациентов не добавлять. Условия использования — в [LICENSE](LICENSE).
