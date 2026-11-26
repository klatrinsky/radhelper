const { test, expect } = require('@playwright/test');

const detailed = '/?protocol=cta-legs';
const short = '/?protocol=cta-legs-short';
const findings = 'Дополнительные находки';

test.beforeEach(async ({ page }) => {
  await page.route('https://mc.yandex.ru/**', route => route.abort());
});

function diagram(page) {
  const toggle = page.getByText('Схема артерий', { exact: true });
  const editor = page.getByRole('dialog', { name: /артерия|аорты|ствол/i });
  const vessel = id => page.locator('[data-vessel="' + id + '"]');
  return {
    toggle, editor, vessel,
    async select(id, mode) {
      await vessel(id).locator('.vessel-chip').click();
      const control = editor.getByLabel('Состояние');
      if (mode) await control.selectOption(mode);
      return control;
    },
    async close() {
      await editor.getByRole('button', { name: 'Готово' }).click();
      await expect(editor).toBeHidden();
    }
  };
}

test('подробная КТА синхронизирует схему и поля и копирует каждый результат один раз', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(detailed);
  const d = diagram(page);
  await expect(d.toggle).toBeVisible();
  await expect(page.locator('#artery-diagram')).toHaveCount(0);
  const description = page.getByRole('button', { name: 'Скопировать протокол', exact: true });
  const conclusion = page.getByRole('button', { name: 'Скопировать заключение', exact: true });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  await description.click();
  await expect.poll(clipboard).toContain('ОПА проходима, без гемодинамически значимых стенозов');

  await d.toggle.click();
  await expect(page.locator('#artery-diagram [data-visual="unassessed"]')).toHaveCount(23);
  await d.select('right-common-iliac', 'stenosis');
  await d.editor.getByLabel('Стеноз, %').fill('55');
  await d.editor.getByLabel('Протяжённость, мм').fill('16');
  await d.editor.getByLabel('Характер бляшки').selectOption('mixed');
  await d.close();
  await expect(d.vessel('right-common-iliac')).toHaveAttribute('data-visual', 'stenosis-middle');
  await expect(d.vessel('left-common-iliac')).toHaveAttribute('data-visual', 'unassessed');

  const rightIliac = page.locator('.tpl .ln').filter({ hasText: /^Подвздошные артерии — ОПА/ }).first();
  const rightOpa = rightIliac.locator(':scope > .tg').first();
  const measurements = rightOpa.locator('input:visible');
  await expect(measurements.nth(0)).toHaveValue('55');
  await expect(measurements.nth(1)).toHaveValue('16');
  await d.toggle.click();
  await measurements.nth(0).fill('70,5');
  await measurements.nth(1).fill('18');
  await rightOpa.getByText('комбинированной', { exact: true }).filter({ visible: true }).click();
  await d.toggle.click();
  await expect(d.vessel('right-common-iliac')).toHaveAttribute('data-visual', 'stenosis-high');
  await d.select('right-common-iliac');
  await expect(d.editor.getByLabel('Стеноз, %')).toHaveValue('70,5');
  await expect(d.editor.getByLabel('Протяжённость, мм')).toHaveValue('18');
  await expect(d.editor.getByLabel('Характер бляшки')).toHaveValue('calcified');
  await d.close();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  await description.click();
  await expect.poll(clipboard).toContain('ОПА — стеноз до 70,5% за счёт кальцинированной бляшки, протяжённость 18 мм');
  expect((await clipboard()).match(/стеноз до 70,5%/g)).toHaveLength(1);
  await conclusion.click();
  await expect.poll(clipboard).toContain('Стеноз ОПА справа до 70,5%.');
  expect((await clipboard()).match(/Стеноз ОПА справа до 70,5%/g)).toHaveLength(1);
});

test('поля без эквивалента, сброс, вкладки и прямые ссылки остаются согласованными', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(short);
  await expect(page.getByRole('tab', { name: 'Кратко', selected: true })).toBeVisible();
  const d = diagram(page);
  await expect(d.toggle).toHaveCount(0);
  await page.getByLabel(findings).fill('Заметка краткого варианта.');
  await page.getByRole('tab', { name: 'Подробно' }).click();
  await expect(page).toHaveURL(/\?protocol=cta-legs$/);
  await page.getByLabel(findings).fill('Заметка подробного варианта.');
  await d.toggle.click();

  await d.select('aorta', 'aneurysm');
  await d.editor.getByLabel('Максимальный диаметр, мм').fill('42');
  await d.editor.getByLabel('Протяжённость, мм').fill('47');
  await d.close();
  const location = page.getByLabel(/^локализация ааа$/i).filter({ visible: true }).first();
  await location.selectOption({ index: 1 });
  await expect(d.vessel('aorta')).toHaveAccessibleName(/Юкстаренальная аневризма/);

  const unsupported = await d.select('left-tibioperoneal');
  await expect(unsupported).toBeDisabled();
  await expect(d.editor.getByText('В шаблоне нет отдельного поля для этого сосуда.')).toBeVisible();
  await d.close();
  await d.select('left-anterior-tibial', 'occlusion');
  await d.editor.getByRole('button', { name: 'Средняя треть' }).click();
  await d.close();
  const leftCalf = page.locator('.tpl .ln').filter({ hasText: /^Артерии голени/ }).last();
  await expect(leftCalf.locator('input:visible')).toHaveValue('средней трети голени');
  await leftCalf.locator('input:visible').fill('дистального отдела');
  await d.select('left-anterior-tibial');
  await expect(d.editor.getByText('Начало окклюзии по шаблону — от дистального отдела.')).toBeVisible();
  await d.close();

  await d.select('right-superficial-femoral', 'multiple-stenosis');
  await d.editor.getByRole('button', { name: 'Нижняя треть' }).click();
  await d.editor.getByLabel('Стеноз, %').fill('60');
  await d.close();
  const copyConclusion = page.getByRole('button', { name: 'Скопировать заключение', exact: true });
  await copyConclusion.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Множественные стенозы ПБА справа в нижней трети до 60%.');

  await page.getByRole('tab', { name: 'Кратко' }).click();
  await expect(page).toHaveURL(/\?protocol=cta-legs-short$/);
  await expect(page.getByLabel(findings)).toHaveValue('Заметка краткого варианта.');
  await page.getByRole('tab', { name: 'Подробно' }).click();
  await expect(d.vessel('right-superficial-femoral')).toHaveAccessibleName(/Множественные стенозы 60%/);
  await d.select('right-superficial-femoral');
  await d.editor.getByRole('button', { name: 'Сбросить сосуд' }).click();
  await d.close();
  await expect(d.vessel('right-superficial-femoral')).toHaveAttribute('data-visual', 'unassessed');
  await expect(d.vessel('left-anterior-tibial')).toHaveAttribute('data-visual', 'occlusion');
  await page.getByRole('button', { name: 'Сбросить схему' }).click();
  await expect(d.vessel('left-anterior-tibial')).toHaveAttribute('data-visual', 'unassessed');
  await expect(d.vessel('aorta')).toHaveAccessibleName(/Юкстаренальная аневризма/);
  await expect(page.getByLabel(findings)).toHaveValue('Заметка подробного варианта.');
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByLabel(findings)).toHaveValue('');
  await expect(page.locator('#artery-diagram')).toHaveCount(0);
  await expect(page).toHaveURL(/\?protocol=cta-legs$/);
});
