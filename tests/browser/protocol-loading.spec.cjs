const { test, expect } = require('@playwright/test');

const brain = '/?protocol=ct-brain-short';
const brainFile = '**/content/templates/ct-brain-short.md';

test('прямая ссылка открывает форму до каталога и сохраняет ввод при появлении вкладок', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/content/{guides,findings}/order.txt', async route => {
    await pending;
    await route.continue();
  });
  await page.route('**/content/templates/ct-brain.md', async route => {
    await pending;
    await route.continue();
  });
  await page.goto(brain);
  const field = page.getByLabel('Дополнительные находки');
  const short = page.getByRole('tab', { name: 'Кратко', selected: true });
  try {
    await expect(page.locator('#study')).toHaveAttribute('data-src', 'content/templates/ct-brain-short.md');
    await expect(field).toBeEditable();
    await expect(short).toBeHidden();
    await field.fill('Тестовый ввод до загрузки каталога.');
  } finally {
    release();
  }
  await expect(short).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Тестовый ввод до загрузки каталога.');
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(short).toBeVisible();
  await expect(field).toHaveValue('');
  await page.getByRole('tab', { name: 'Подробно' }).click();
  await expect(page).toHaveURL('/?protocol=ct-brain');
});

test('для неизвестного протокола показано сообщение, поиск остаётся доступен', async ({ page }) => {
  await page.goto('/?protocol=unknown-protocol');
  const study = page.locator('#study');
  await expect(study.getByRole('status')).toHaveText(/Шаблон по этой ссылке не найден/);
  await expect(study.getByRole('button', { name: 'Повторить', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox').fill('денситометрия');
  await expect(study).toHaveAttribute('data-src', 'content/templates/dxa.md');
  await expect(page).toHaveURL('/');
});

for (const [resource, path] of [
  ['файла протокола', brainFile],
  ['списка шаблонов', '**/content/templates/order.txt'],
]) {
  test(`HTTP 429 при загрузке ${resource} позволяет повторить запрос`, async ({ page }) => {
    let requests = 0;
    await page.route(path, route => ++requests === 1
      ? route.fulfill({ status: 429, body: 'Too Many Requests' })
      : route.continue());
    await page.goto(brain);
    const study = page.locator('#study');
    await expect(study.getByRole('status')).toHaveText(/Не удалось загрузить шаблон/);
    await expect(study.getByRole('status')).not.toContainText('не найден');
    await expect(page).toHaveURL(brain);
    expect(requests).toBe(1);
    const retry = study.getByRole('button', { name: 'Повторить', exact: true });
    await expect(retry).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
    await retry.click();
    await expect(study).toHaveAttribute('data-src', 'content/templates/ct-brain-short.md');
    await expect(page.getByRole('tab', { name: 'Кратко', selected: true })).toBeVisible();
    await expect(retry).toHaveCount(0);
    await expect(page).toHaveURL(brain);
    expect(requests).toBe(2);
  });
}
