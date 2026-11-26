const { test, expect } = require('@playwright/test');

const brainProtocol = '/?protocol=ct-brain-short';
const findingsLabel = 'Дополнительные находки';

test.beforeEach(async ({ page }) => {
  await page.route('https://mc.yandex.ru/**', route => route.abort());
});

test('поиск открывает подходящий шаблон', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Поиск' });
  await search.fill('денситометрия');

  await expect(page.getByRole('heading', { name: 'Рентгеновская денситометрия (DXA)' })).toBeVisible();
  await expect(page.locator('#study')).toHaveAttribute('data-src', 'templates/dxa.md');
  await expect(page.getByLabel(findingsLabel)).toBeEditable();
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
