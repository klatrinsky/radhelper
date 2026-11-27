const { test, expect } = require('@playwright/test');

const report = page => page.locator('#disc-report');
const panel = (page, level) => page.locator('[data-disc-level="' + level + '"]');
const svgZone = (panel, id) => panel.locator('svg [data-disc-zone="' + id + '"]');
const buttonZone = (panel, id) => panel.locator('button[data-disc-zone="' + id + '"]');
const clipboard = page => page.evaluate(() => navigator.clipboard.readText());

test('на схеме семь зон, стороны пациента обозначены, выбор доступен касанием и с клавиатуры', async ({ page }, info) => {
  await page.goto('/pages/disc-location.html');
  const lumbar = panel(page, 'L4–L5');
  const svg = lumbar.locator('svg');
  await expect(svg.locator('[data-disc-zone]')).toHaveCount(7);
  await expect(svg).toContainText('Тело позвонка');
  await expect(svg).toContainText('Межпозвонковый диск');
  await expect(svg).toContainText('Позвоночный канал');
  await expect(svg.locator('.disc-foramen')).toHaveCount(2);
  await expect(svg.getByText('Справа')).toBeVisible();
  await expect(svg.getByText('Слева')).toBeVisible();
  const right = svgZone(lumbar, 'right-foraminal');
  const left = svgZone(lumbar, 'left-foraminal');
  expect((await right.boundingBox()).x).toBeLessThan((await left.boundingBox()).x);
  await expect(right).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Скопировать описание' })).toBeDisabled();
  if (info.project.use.hasTouch) await right.locator('path').tap();
  else await right.press('Enter');
  await expect(right).toHaveAttribute('aria-pressed', 'true');
  await expect(buttonZone(lumbar, 'right-foraminal')).toHaveAttribute('aria-pressed', 'true');
  await expect(left).toHaveAttribute('aria-pressed', 'false');
  const fills = await Promise.all([right, left].map(zone => zone.locator('path').evaluate(path => getComputedStyle(path).fill)));
  expect(fills[0]).not.toBe(fills[1]);
  await left.press('Space');
  await expect(report(page)).toHaveText('На уровне L4–L5 определяется выпячивание диска в правой фораминальной и левой фораминальной зонах.');
  await buttonZone(lumbar, 'right-foraminal').click();
  await expect(right).toHaveAttribute('aria-pressed', 'false');
  await expect(left).toHaveAttribute('aria-pressed', 'true');
  await expect(report(page)).toHaveText('На уровне L4–L5 определяется выпячивание диска в левой фораминальной зоне.');
});

test('размер, миграция, копирование и сброс работают независимо на всех уровнях', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/pages/disc-location.html');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 27, 32)');
  const level = page.getByLabel('Межпозвонковый уровень');
  const copy = page.getByRole('button', { name: 'Скопировать описание' });
  const lumbar = panel(page, 'L4–L5');
  await buttonZone(lumbar, 'central').click();
  const size = lumbar.getByLabel('Размер, мм');
  await size.fill('0');
  await expect(size).toHaveAttribute('aria-invalid', 'true');
  await expect(copy).toBeDisabled();
  await size.fill('4.50');
  await expect(size).toHaveAttribute('aria-invalid', 'false');
  await lumbar.getByLabel('Миграция').selectOption('cranial');
  const lumbarText = 'На уровне L4–L5 определяется выпячивание диска размером 4,50 мм в центральной зоне с краниальной миграцией.';
  await expect(report(page)).toHaveText(lumbarText);
  await copy.click();
  await expect.poll(() => clipboard(page)).toBe(lumbarText);

  await level.selectOption('C5–C6');
  const cervical = panel(page, 'C5–C6');
  await expect(copy).toBeDisabled();
  await expect(cervical.getByLabel('Размер, мм')).toHaveValue('');
  await buttonZone(cervical, 'left-extraforaminal').click();
  await cervical.getByLabel('Характер выпячивания').selectOption('protrusion');
  await cervical.getByLabel('Размер, мм').fill('2,5');
  await cervical.getByLabel('Миграция').selectOption('caudal');
  const cervicalText = 'На уровне C5–C6 определяется протрузия диска размером 2,5 мм в левой экстрафораминальной зоне с каудальной миграцией.';
  await expect(report(page)).toHaveText(cervicalText);

  await level.selectOption('Th7–Th8');
  const thoracic = panel(page, 'Th7–Th8');
  await expect(copy).toBeDisabled();
  await buttonZone(thoracic, 'right-subarticular').click();
  await thoracic.getByLabel('Характер выпячивания').selectOption('hernia');
  await expect(report(page)).toHaveText('На уровне Th7–Th8 определяется грыжа диска в правой субартикулярной зоне.');
  await thoracic.getByRole('button', { name: 'Сбросить уровень' }).click();
  await expect(report(page)).toHaveText('Выберите зону или укажите площадь позвоночного канала.');
  await expect(copy).toBeDisabled();
  await expect(thoracic.getByRole('button', { name: 'Сбросить уровень' })).toBeDisabled();

  await level.selectOption('L4–L5');
  await expect(size).toHaveValue('4.50');
  await expect(report(page)).toHaveText(lumbarText);
  await level.selectOption('C5–C6');
  await expect(report(page)).toHaveText(cervicalText);
  await copy.click();
  await expect.poll(() => clipboard(page)).toBe(cervicalText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('площадь канала копируется отдельно и вместе с выпячиванием', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/pages/disc-location.html');
  const level = page.getByLabel('Межпозвонковый уровень');
  const lumbar = panel(page, 'L4–L5');
  const areaLabel = 'Планиметрическая площадь позвоночного канала, мм²';
  const area = lumbar.getByLabel(areaLabel);
  const copy = page.getByRole('button', { name: 'Скопировать описание' });
  const reset = lumbar.getByRole('button', { name: 'Сбросить уровень' });
  await expect(area).toHaveValue('');
  await expect(copy).toBeDisabled();
  await expect(reset).toBeDisabled();
  await area.fill('0');
  await expect(area).toHaveAttribute('aria-invalid', 'true');
  await expect(copy).toBeDisabled();
  await area.fill('85.50');
  const areaText = 'Планиметрическая площадь позвоночного канала на уровне L4–L5 — 85,50 мм².';
  await expect(area).toHaveAttribute('aria-invalid', 'false');
  await expect(report(page)).toHaveText(areaText);
  await copy.click();
  await expect.poll(() => clipboard(page)).toBe(areaText);

  await level.selectOption('L5–S1');
  await expect(panel(page, 'L5–S1').getByLabel(areaLabel)).toHaveValue('');
  await expect(copy).toBeDisabled();
  await level.selectOption('L4–L5');
  await expect(area).toHaveValue('85.50');
  await buttonZone(lumbar, 'central').click();
  const combined = 'На уровне L4–L5 определяется выпячивание диска в центральной зоне. ' + areaText;
  await expect(report(page)).toHaveText(combined);
  await copy.click();
  await expect.poll(() => clipboard(page)).toBe(combined);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await reset.click();
  await expect(area).toHaveValue('');
  await expect(copy).toBeDisabled();
});

for (const [region, initial, other] of [
  ['cervical', 'C5–C6', 'C6–C7'], ['thoracic', 'Th7–Th8', 'Th10–Th11'], ['lumbar', 'L4–L5', 'L5–S1']
]) {
  test(`схема дисков в протоколе ${region} копирует данные по уровням`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?protocol=ct-spine-' + region);
    await expect(page.locator('#study')).toHaveAttribute('data-src', 'content/templates/ct-spine-' + region + '.md');
    const scheme = page.getByText('Схема дисков', { exact: true });
    const editor = page.locator('.disc-scheme');
    const copy = page.getByRole('button', { name: 'Скопировать протокол', exact: true });
    const conclusion = page.getByRole('button', { name: 'Скопировать заключение', exact: true });
    const clip = () => clipboard(page);
    const areaLabel = 'Планиметрическая площадь позвоночного канала, мм²';
    if (region === 'cervical') await page.locator('input[data-name="ADI"]').fill('2');

    await expect(editor).not.toHaveAttribute('open', '');
    await expect(editor.locator('svg')).toHaveCount(0);
    await copy.click();
    await expect.poll(clip).not.toBe('');
    expect(await clip()).not.toMatch(/СХЕМА ДИСКОВ|ДИСКИ ОПИСАНИЕ|Планиметрическая площадь/);
    if (region === 'cervical') expect(await clip()).toContain('Экструзий дисков, значительно вдающихся в позвоночный канал, нет.');
    if (region === 'lumbar') expect(await clip()).toContain('L4–L5: выраженной протрузии');

    await scheme.click();
    const levels = editor.getByLabel('Межпозвонковый уровень');
    await expect(levels).toHaveValue(initial);
    const first = panel(page, initial);
    const area = first.getByLabel(areaLabel);
    await expect(area).toHaveValue('');
    await buttonZone(first, 'central').click();
    await first.getByLabel('Характер выпячивания').selectOption('hernia');
    await first.getByLabel('Размер, мм').fill('4.5');
    await first.getByLabel('Миграция').selectOption('caudal');
    await area.fill('85.50');
    await levels.selectOption(other);
    await expect(panel(page, other).getByLabel(areaLabel)).toHaveValue('');
    await panel(page, other).getByLabel(areaLabel).fill('71');
    await levels.selectOption(initial);
    await expect(area).toHaveValue('85.50');

    const describedDisc = 'грыжа диска размером 4,5 мм в центральной зоне с каудальной миграцией.';
    const describedArea = region === 'lumbar' ? 'Планиметрическая площадь позвоночного канала — 85,50 мм².' :
      'Планиметрическая площадь позвоночного канала на уровне ' + initial + ' — 85,50 мм².';
    await copy.click();
    await expect.poll(clip).toContain(describedDisc);
    const description = await clip();
    expect(description).toContain(describedArea);
    expect(description).toContain('71 мм².');
    expect(description.split(describedDisc)).toHaveLength(2);
    if (region === 'cervical') expect(description).not.toContain('Экструзий дисков');
    if (region === 'lumbar') {
      expect(description).toContain('L4–L5: ' + describedDisc);
      expect(description).toContain('L5–S1: выраженной протрузии');
    }
    await conclusion.click();
    await expect.poll(clip).toContain('Грыжа диска ' + initial + ' в центральной зоне.');
    expect(await clip()).not.toMatch(/мм²|стеноз позвоночного канала/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

    if (region === 'lumbar') {
      await page.getByText('+ стеноз канала L4–L5', { exact: true }).click();
      await page.locator('input[data-name="S L4–L5"]').fill('74');
      await copy.click();
      await expect.poll(clip).toContain('Площадь поперечного сечения дурального мешка 74 мм².');
      expect(await clip()).toContain(describedArea);
      await conclusion.click();
      await expect.poll(clip).toContain('Абсолютный стеноз позвоночного канала на уровне L4–L5 (площадь дурального мешка 74 мм²).');
      expect(await clip()).not.toContain('85,50');
    }

    await area.fill('0');
    await levels.selectOption(other);
    await scheme.click();
    await copy.click();
    await expect(editor).toHaveAttribute('open', '');
    await expect(levels).toHaveValue(initial);
    await expect(area).toBeFocused();
    await expect(page.getByRole('button', { name: 'Всё равно скопировать' })).toBeVisible();

    await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
    await expect(editor).not.toHaveAttribute('open', '');
    await scheme.click();
    await expect(panel(page, initial).getByLabel(areaLabel)).toHaveValue('');
  });
}
