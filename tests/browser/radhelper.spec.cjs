const { test, expect } = require('@playwright/test');

const brainProtocol = '/?protocol=ct-brain-short';
const findingsLabel = 'Дополнительные находки';

test('страницы загружаются и работают без запросов к сторонним доменам', async ({ page, context, baseURL }) => {
  const siteOrigin = new URL(baseURL).origin;
  const externalRequests = [];
  await context.route(url => ['http:', 'https:'].includes(url.protocol) && url.origin !== siteOrigin, route => {
    externalRequests.push(route.request().url());
    return route.abort();
  });

  await page.goto('/');
  await expect(page.locator('#catalog')).toBeVisible();
  await page.goto('/lab/');
  await expect(page).toHaveURL('/?lab');
  await expect(page.locator('#labLinks')).toBeVisible();

  await page.goto(brainProtocol);
  await expect(page.getByRole('tab', { name: 'Кратко', selected: true })).toBeVisible();
  await page.getByLabel(findingsLabel).fill('Тестовая находка');
  await page.getByRole('searchbox').fill('денситометрия');
  await expect(page.locator('#study')).toHaveAttribute('data-src', 'content/templates/dxa.md');

  for (const slug of ['disc-location', 'fractures', 'leg-arteries', 'lung-segments', 'terms']) {
    await page.goto('/pages/' + slug + '.html');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }

  expect(externalRequests).toEqual([]);
});

test('каталог свёрнут, группы открываются независимо, а поиск скрывает каталог', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const catalog = page.locator('#catalog');
  await expect(catalog).toBeVisible();
  await expect(catalog).toHaveJSProperty('open', false);
  await catalog.getByText('Все инструменты', { exact: true }).press('Enter');
  await expect(catalog.locator('.search-group > summary')).toHaveText([
    'Компьютерная томография и ангиография',
    'Рентгенография',
    'Маммография',
    'Денситометрия',
    'Интерактивные конструкторы',
    'Калькуляторы и классификации',
    'Справочники и памятки'
  ]);
  await expect(catalog.locator('.search-group[open]')).toHaveCount(0);
  await catalog.getByText('Компьютерная томография и ангиография', { exact: true }).click();
  await catalog.locator('summary').getByText('Маммография', { exact: true }).click();
  await expect(catalog.locator('.search-group[open]')).toHaveCount(2);
  const brain = catalog.getByRole('link', { name: 'КТ головного мозга', exact: true });
  await expect(brain).toHaveCount(1);
  await expect(brain).toBeVisible();
  await expect(catalog.getByRole('link', { name: 'Маммография', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  const search = page.getByRole('searchbox');
  await search.fill('денситометрия');
  await expect(catalog).toBeHidden();
  await expect(page.locator('#study')).toHaveAttribute('data-src', 'content/templates/dxa.md');
  await search.clear();
  await brain.click();
  await expect(page).toHaveURL(/\?protocol=ct-brain$/);
  await expect(page.getByRole('tab', { name: 'Подробно', selected: true })).toBeVisible();
});

test('каталог ведёт прямо к справочным разделам и обоим типам конструкторов', async ({ page }) => {
  await page.goto('/');
  const catalog = page.locator('#catalog');
  await catalog.getByText('Все инструменты', { exact: true }).click();
  await catalog.getByText('Калькуляторы и классификации', { exact: true }).click();
  await catalog.getByRole('link', { name: /Bosniak 2019/ }).click();
  await expect(page).toHaveURL(/#bosniak$/);
  await expect(page.locator('#bosniak')).toHaveJSProperty('open', true);
  await expect(page.locator('#bosniak .body')).toBeVisible();
  await expect(catalog).toBeHidden();
  await page.goBack();
  await expect(catalog).toBeVisible();
  await page.goForward();
  await expect(page.locator('#bosniak .body')).toBeVisible();
  await page.reload();
  await expect(page.locator('#bosniak .body')).toBeVisible();

  await page.getByRole('button', { name: 'На главную', exact: true }).click();
  await catalog.getByText('Все инструменты', { exact: true }).click();
  await catalog.getByText('Интерактивные конструкторы', { exact: true }).click();
  await catalog.getByRole('link', { name: 'Образование печени', exact: true }).click();
  await expect(page).toHaveURL(/\?protocol=liver-mass$/);
  await expect(page.locator('#study .finding')).toBeVisible();

  await page.goto('/');
  await catalog.getByText('Все инструменты', { exact: true }).click();
  await catalog.getByText('Интерактивные конструкторы', { exact: true }).click();
  await catalog.getByRole('link', { name: 'Конструктор переломов', exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/fractures\.html$/);
});

test('отдельные страницы открываются напрямую и с них можно вернуться на главную', async ({ page }) => {
  const pages = {
    'disc-location': 'Локализация выпячивания диска',
    fractures: 'Конструктор переломов',
    'leg-arteries': 'Артерии нижних конечностей',
    'lung-segments': 'Рентгенография ОГК',
    terms: 'Условия использования RadHelper',
  };
  for (const [slug, title] of Object.entries(pages)) {
    await page.goto('/pages/' + slug + '.html');
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await page.locator('a[href="../"]').first().click();
    await expect(page).toHaveURL('/');
  }
});

test('поиск открывает подходящий шаблон', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Поиск' });
  await search.fill('денситометрия');

  await expect(page.getByRole('heading', { name: 'Рентгеновская денситометрия (DXA)' })).toBeVisible();
  await expect(page.locator('#study')).toHaveAttribute('data-src', 'content/templates/dxa.md');
  await expect(page.getByLabel(findingsLabel)).toBeEditable();
});

test('подсказка «Поправить» видна под открытым шаблоном и в конструкторе переломов', async ({ page }) => {
  const help = page.locator('.feedback-help:visible');
  const message = 'Нашли ошибку или хотите предложить изменение? Выделите текст и нажмите «Поправить».';

  await page.goto(brainProtocol);
  const studyHelp = page.locator('#study + .feedback-help');
  await expect(studyHelp).toBeVisible();
  await expect(help).toHaveText([message]);
  await page.getByRole('tab', { name: 'Подробно', exact: true }).click();
  await expect(studyHelp).toBeVisible();

  const search = page.getByRole('searchbox');
  await search.fill('коронарный кальций');
  await expect(page.locator('#study')).toHaveAttribute('data-src', 'content/templates/ct-coronary-calcium.md');
  await expect(studyHelp).toBeVisible();
  await expect(help).toHaveText([message]);
  const helpBox = await studyHelp.boundingBox();
  expect(helpBox.x).toBeGreaterThanOrEqual(0);
  expect(helpBox.x + helpBox.width).toBeLessThanOrEqual(page.viewportSize().width);

  const fragment = await page.locator('#study .tpl').getByText('Сканирование выполнено с ЭКГ-синхронизацией без внутривенного контрастирования.', { exact: true }).evaluate(line => {
    line.scrollIntoView({ block: 'center', behavior: 'instant' });
    const range = document.createRange();
    range.selectNodeContents(line);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString().trim();
  });
  expect(fragment).toBeTruthy();
  await page.getByRole('button', { name: /Поправить/ }).click();
  await expect(page.getByLabel('Текст для Яндекс Формы')).toHaveValue(fragment);
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();

  await search.fill('переломы');
  await expect(studyHelp).toBeVisible();
  await page.getByRole('link', { name: /Открыть конструктор переломов/ }).click();
  await expect(help).toHaveText([message]);
});

test('прямая ссылка открывает выбранную вкладку с доступными кнопками', async ({ page }) => {
  await page.goto(brainProtocol);
  await expect(page.getByRole('heading', { name: 'КТ головного мозга' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Кратко', selected: true })).toBeVisible();
  await expect(page).toHaveURL(/\?protocol=ct-brain-short$/);

  const reset = page.getByRole('button', { name: 'Сбросить', exact: true });
  const copy = page.getByRole('button', { name: 'Скопировать протокол', exact: true });
  await expect(reset).toBeVisible();
  await expect(copy).toBeVisible();

  const viewport = page.viewportSize();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(viewport.width);

  const resetBox = await reset.boundingBox();
  const copyBox = await copy.boundingBox();
  const overlaps = resetBox.x < copyBox.x + copyBox.width && copyBox.x < resetBox.x + resetBox.width
    && resetBox.y < copyBox.y + copyBox.height && copyBox.y < resetBox.y + resetBox.height;
  expect(overlaps).toBe(false);
  for (const box of [resetBox, copyBox]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
});

test('заполнение размеров обновляет описание и заключение', async ({ page }) => {
  await page.goto(brainProtocol);
  const horns = page.getByRole('textbox', { name: 'Рога', exact: true });
  const skull = page.getByRole('textbox', { name: 'Череп', exact: true });
  const conclusion = page.locator('#study .tpl-conclusion');
  await expect(horns).toHaveValue('');
  await expect(skull).toHaveValue('');
  await expect(conclusion).not.toContainText('Вентрикуломегалия', { useInnerText: true });

  await horns.fill('32');
  await skull.fill('100');

  await expect(page.locator('#study .tpl')).toContainText('Боковые желудочки расширены, индекс Эванса 0,32', { useInnerText: true });
  await expect(conclusion).toContainText('Вентрикуломегалия (индекс Эванса 0,32).', { useInnerText: true });
});

test('атлас GCA и схема Эванса загружаются при открытии своей подсказки', async ({ page }) => {
  const imageRequests = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/^\/assets\/img\/(gca-ct\.webp|evans-index\.svg)$/.test(path)) imageRequests.push(path);
  });
  await page.goto(brainProtocol);
  const atlas = page.locator('.gca-figure img');
  const evans = page.locator('#evans-guide img');
  await expect(atlas).toHaveJSProperty('src', '');
  await expect(evans).toHaveJSProperty('src', '');
  expect(imageRequests).toEqual([]);

  const summary = page.getByText('Степени атрофии по GCA на КТ', { exact: true });
  await summary.click();
  await expect(atlas).toHaveJSProperty('naturalWidth', 1773);
  await expect(evans).toHaveJSProperty('src', '');
  await page.getByRole('button', { name: 'Увеличить рисунок GCA' }).click();
  const dialog = page.getByRole('dialog', { name: 'Увеличенный рисунок GCA на КТ' });
  await expect(dialog.locator('img')).toHaveJSProperty('naturalWidth', 1773);
  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  await summary.click();
  await summary.click();
  await expect(atlas).toBeVisible();

  await page.getByRole('button', { name: 'Как измерить индекс Эванса?' }).click();
  await expect.poll(() => evans.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  expect(imageRequests).toEqual(['/assets/img/gca-ct.webp', '/assets/img/evans-index.svg']);
});

test('памятка лаборанта загружает только свои иллюстрации при открытии', async ({ page }) => {
  const imageRequests = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/^\/assets\/img\/(retrieve-|topo-|roi-)/.test(path)) imageRequests.push(path);
  });
  await page.goto('/?lab');
  await expect(page.locator('#catalog')).toBeHidden();
  const retrieve = page.locator('#retrieve img').first();
  const roi = page.locator('#roi img').first();
  await expect(retrieve).toHaveJSProperty('src', '');
  await expect(roi).toHaveJSProperty('src', '');
  expect(imageRequests).toEqual([]);

  await page.getByRole('button', { name: 'Как подтянуть старое исследование' }).click();
  await expect.poll(() => retrieve.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(roi).toHaveJSProperty('src', '');
  expect(imageRequests).toContain('/assets/img/retrieve-1.jpg');
  expect(imageRequests.every(path => path.startsWith('/assets/img/retrieve-'))).toBe(true);
});

test('на обоих входах печатается выбранная экстренная памятка', async ({ page }) => {
  let printCalls = 0;
  await page.exposeFunction('recordPrint', () => { printCalls++; });
  await page.addInitScript(() => { window.print = () => window.recordPrint(); });
  await page.emulateMedia({ media: 'print' });

  for (const [url, id] of [['/#sos-anaphylaxis', 'sos-anaphylaxis'], ['/?lab', 'sos-extravasation']]) {
    await page.goto(url);
    if (url === '/?lab') {
      await page.locator('#sosLinks').getByRole('button', { name: 'Экстравазация' }).click();
    }
    const guide = page.locator('#' + id);
    const print = guide.getByRole('button', { name: /Распечатать на стену/ });
    await expect(print).toBeVisible();
    const expectedCalls = printCalls + 1;
    await print.click();
    await expect.poll(() => printCalls).toBe(expectedCalls);
    await expect(page.locator('body')).toHaveClass(/\bprint-sos\b/);
    await expect(page.locator('.print-me')).toHaveCount(1);
    await expect(guide).toHaveClass(/\bprint-me\b/);
    await expect(guide.locator('.body')).toBeVisible();
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('details.sec.sos:not(.print-me)')).toBeHidden();
    await expect(print).toBeHidden();

    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('body')).not.toHaveClass(/\bprint-sos\b/);
    await expect(page.locator('.print-me')).toHaveCount(0);
    await expect(print).toBeVisible();
  }
});

test('вложенная подсказка ждёт открытия всех родительских разделов', async ({ page }) => {
  await page.route('**/content/guides/knee-jsw.md', route => route.fulfill({
    contentType: 'text/plain; charset=utf-8', body: '# Суставная щель\n\n![Схема суставной щели](img/evans-index.svg)',
  }));
  await page.route('**/content/guides/kellgren.md', route => route.fulfill({
    contentType: 'text/plain; charset=utf-8', body: '# Степени артроза\n\n![Рентгенограмма колена](assets/img/kellgren-knee/kl-1.jpg)',
  }));
  await page.goto('/?protocol=xr-knee');
  const hints = page.locator('.study-hints');
  const first = hints.getByAltText('Схема суставной щели');
  const second = hints.getByAltText('Рентгенограмма колена');
  await expect(first).toHaveJSProperty('src', '');
  await expect(second).toHaveJSProperty('src', '');
  await hints.locator(':scope > summary').click();
  await expect(first).toHaveAttribute('src', 'assets/img/evans-index.svg');
  await expect(second).toHaveJSProperty('src', '');
  await hints.getByText('Степени артроза', { exact: true }).click();
  await expect(second).toHaveAttribute('src', 'assets/img/kellgren-knee/kl-1.jpg');
});

test('протокол и заключение копируются отдельно в буфер обмена', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?protocol=mmg-ds');
  const finding = 'Дополнительная находка для проверки копирования.';
  await page.getByLabel(findingsLabel).fill(finding);
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  await page.getByRole('button', { name: 'Скопировать протокол', exact: true }).click();
  await expect.poll(clipboard).toContain(finding);
  const protocol = await clipboard();
  expect(protocol).toContain('Рекомендации: контрольная маммография через 12 месяцев.');
  expect(protocol).not.toContain('Нашли ошибку');
  expect(protocol).not.toMatch(/заключение:/i);

  await page.getByRole('button', { name: 'Скопировать заключение', exact: true }).click();
  await expect.poll(clipboard).toBe('Левая молочная железа: BI-RADS 1.\nПравая молочная железа: BI-RADS 1.');
});

test('сброс очищает текущую вкладку и сохраняет ввод в соседней', async ({ page }) => {
  await page.goto(brainProtocol);
  const horns = page.getByRole('textbox', { name: 'Рога', exact: true });
  const findings = page.getByLabel(findingsLabel);
  const short = page.getByRole('tab', { name: 'Кратко' });
  const detailed = page.getByRole('tab', { name: 'Подробно' });

  await horns.fill('23');
  await findings.fill('Ввод в кратком варианте.');
  await detailed.click();
  await horns.fill('28');
  await findings.fill('Ввод в подробном варианте.');
  await short.click();

  await expect(horns).toHaveValue('23');
  await expect(findings).toHaveValue('Ввод в кратком варианте.');
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(horns).toHaveValue('');
  await expect(findings).toHaveValue('');
  await expect(page).toHaveURL(/\?protocol=ct-brain-short$/);

  await detailed.click();
  await expect(horns).toHaveValue('28');
  await expect(findings).toHaveValue('Ввод в подробном варианте.');
});
