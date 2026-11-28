const { test, expect } = require('@playwright/test');

const protocol = '/?protocol=ct-brain-stroke';
const noIschemia = 'Ранние КТ-признаки ишемии в бассейнах средних мозговых артерий не выявлены.';
const negative = 'Внутричерепное кровоизлияние и ранние КТ-признаки ишемии в бассейнах средних мозговых артерий не выявлены.';
const absenceOfBleeding = 'Внутричерепное кровоизлияние не выявлено.';
const intactBones = 'Костно-травматических повреждений костей черепа в зоне исследования не выявлено.';
const quick = page => page.getByRole('button', { name: 'Подтвердить норму по нативной КТ' });

async function copyText(page, buttonName) {
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe('');
  return page.evaluate(() => navigator.clipboard.readText());
}

test('ОНМК открывается по ссылке и копирует нативное описание и заключение отдельно', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(protocol);
  await expect(page.getByRole('tab', { name: 'ОНМК', selected: true })).toBeVisible();
  const conclusion = page.getByRole('region', { name: 'Заключение' });
  const ischemia = page.getByRole('combobox', { name: 'Ранние КТ-признаки ишемии', exact: true });
  const bleeding = page.getByRole('combobox', { name: 'Внутричерепное кровоизлияние', exact: true });
  await expect(ischemia).toHaveValue('');
  await expect(bleeding).toHaveValue('');
  await expect(conclusion).not.toContainText('не выявлены');
  await expect(page.getByText('Схема ASPECTS', { exact: true })).toBeVisible();
  await expect(page.locator('[data-aspects-mode]')).toBeHidden();
  await expect(page.getByText(/КТ-ангиография головы и шеи/)).toHaveCount(0);

  await expect(page.locator('.tpl')).toContainText('Срединные структуры не смещены.');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await quick(page).click();
  await expect(ischemia).toHaveValue('no');
  await expect(bleeding).toHaveValue('no');
  const description = await copyText(page, 'Скопировать протокол');
  expect(description).toBe('Исследование выполнено без внутривенного контрастирования.\n\n' +
    absenceOfBleeding + '\nРанние КТ-признаки ишемии в бассейнах средних мозговых артерий не определяются.\n' +
    'Срединные структуры не смещены. КТ-признаков объёмного образования и масс-эффекта не выявлено.\n' +
    'Желудочковая система не расширена. Базальные цистерны прослеживаются, не сдавлены.\n' + intactBones);
  expect(await copyText(page, 'Скопировать заключение')).toBe(negative);

  await ischemia.selectOption('doubtful');
  await expect(conclusion).not.toContainText(negative);
  await page.getByLabel('Сторона ишемических изменений').selectOption('слева');
  await page.getByLabel('Локализация ишемических изменений').fill('в островковой коре');
  await page.getByLabel('Наблюдаемые признаки').fill('сглаженность границы серого и белого вещества');
  const doubtful = 'Сомнительные ранние КТ-признаки ишемии в островковой коре слева.';
  expect(await copyText(page, 'Скопировать заключение')).toBe(doubtful + '\n' + absenceOfBleeding);

  await bleeding.selectOption('yes');
  await page.getByLabel('Тип кровоизлияния').selectOption('Внутримозговое кровоизлияние');
  await page.getByLabel('Сторона кровоизлияния').selectOption('справа');
  await page.getByLabel('Локализация кровоизлияния').fill('в лобной доле');
  await page.getByLabel('Размеры, мм').fill('18 × 12');
  const hematoma = 'Внутримозговое кровоизлияние в лобной доле справа.';
  expect(await copyText(page, 'Скопировать заключение')).toBe(hematoma + '\n' + doubtful);
  const positiveDescription = await copyText(page, 'Скопировать протокол');
  expect(positiveDescription).toContain('размеры 18 x 12 мм');
  expect(positiveDescription).toContain('сглаженность границы серого и белого вещества');
  expect(positiveDescription).not.toContain(absenceOfBleeding);
  expect(positiveDescription).toContain('масс-эффекта не выявлено');
  expect(positiveDescription).toContain(intactBones);

  await ischemia.selectOption('yes');
  const ischemicFinding = 'Ранние КТ-признаки ишемии в островковой коре слева.';
  expect(await copyText(page, 'Скопировать заключение')).toBe(hematoma + '\n' + ischemicFinding);
  await bleeding.selectOption('no');
  expect(await copyText(page, 'Скопировать заключение')).toBe(ischemicFinding + '\n' + absenceOfBleeding);
  await bleeding.selectOption('yes');
  await ischemia.selectOption('no');
  expect(await copyText(page, 'Скопировать заключение')).toBe(hematoma + '\n' + noIschemia);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('ASPECTS на двух уровнях оценивается вручную и отдельно для каждой стороны', async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(protocol);
  await quick(page).click();
  await page.getByText('Схема ASPECTS', { exact: true }).click();
  const scheme = page.locator('.aspects-picker');
  const status = scheme.getByRole('status');
  const guidance = scheme.getByText('Рекомендации с учётом ASPECTS', { exact: true });
  const copyGuidance = scheme.getByRole('checkbox', { name: 'Добавить рекомендацию в протокол' });
  const mode = scheme.getByLabel('Отметка зоны');
  const zone = (side, code) => scheme.locator(`[data-side="${side}"][data-zone="${code}"]`);
  const conclude = page.getByRole('region', { name: 'Заключение' });
  await expect(scheme.locator('figure')).toHaveCount(2);
  await expect(scheme.locator('[data-zone]')).toHaveCount(20);
  await expect(status).toContainText('Слева — оценено 0 из 10');
  await expect(conclude).not.toContainText('ASPECTS');
  await expect(guidance).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  const island = zone('left', 'I');
  if (info.project.use.hasTouch) await island.locator('circle').tap();
  else await island.press('Enter');
  await expect(island).toHaveAttribute('data-state', 'affected');
  await expect(conclude).not.toContainText(negative);
  await page.getByRole('combobox', { name: 'Ранние КТ-признаки ишемии', exact: true }).selectOption('yes');
  await page.getByLabel('Сторона ишемических изменений').selectOption('слева');
  await page.getByLabel('Локализация ишемических изменений').fill('в бассейне левой СМА');
  await mode.selectOption('doubtful');
  await zone('left', 'M4').press('Space');
  const confirm = scheme.getByRole('button', { name: 'Подтвердить отсутствие изменений в остальных зонах' });
  await confirm.click();
  await expect(status).toContainText('Слева — оценено 9 из 10');
  await expect(conclude).not.toContainText('ASPECTS');
  await expect(guidance).toBeHidden();
  await expect(zone('left', 'M4')).toHaveAttribute('data-state', 'doubtful');

  await mode.selectOption('affected');
  await zone('left', 'M4').press('Enter');
  await expect(status).toContainText('ASPECTS слева — 8/10');
  await expect(guidance).toBeVisible();
  const withoutRecommendation = await copyText(page, 'Скопировать протокол');
  expect(withoutRecommendation).toContain('ASPECTS слева — 8 баллов (I, M4).');
  expect(withoutRecommendation).not.toContain('Рекомендации:');
  await copyGuidance.check();
  const withRecommendation = await copyText(page, 'Скопировать протокол');
  expect(withRecommendation).toContain('Рекомендации: Срочная консультация невролога.');
  expect(withRecommendation).toContain('МРТ головного мозга с DWI');
  const conclusionText = await copyText(page, 'Скопировать заключение');
  expect(conclusionText).toContain('МСКТ-признаки гиподенсивных изменений в зонах I, M4 слева (ASPECTS слева — 8 баллов).');
  expect(conclusionText).not.toContain('Рекомендации:');
  const signs = page.getByLabel('Наблюдаемые признаки');
  await signs.fill('сглаженность борозд');
  await expect(conclude).toContainText('МСКТ-признаки ранних ишемических изменений в зонах I, M4 слева');
  await signs.fill('');

  const extraZones = ['M1', 'M2', 'M3', 'C', 'L', 'IC'];
  for (const code of extraZones.slice(0, 3)) await zone('left', code).press('Enter');
  await expect(status).toContainText('ASPECTS слева — 5/10');
  await expect(scheme.getByText(/изменениями слева — 5 из 10/)).toBeVisible();
  for (const code of extraZones.slice(3)) await zone('left', code).press('Enter');
  await expect(status).toContainText('ASPECTS слева — 2/10');
  await expect(scheme.getByText(/изменениями слева — 8 из 10/)).toBeVisible();
  const bleeding = page.getByRole('combobox', { name: 'Внутричерепное кровоизлияние', exact: true });
  await bleeding.selectOption('yes');
  await expect(scheme.getByText(/Срочная консультация невролога в связи с внутричерепным кровоизлиянием/)).toBeVisible();
  await expect(scheme.getByText(/МРТ головного мозга/)).toBeHidden();
  await bleeding.selectOption('no');
  await mode.selectOption('normal');
  for (const code of extraZones) await zone('left', code).press('Enter');
  await expect(status).toContainText('ASPECTS слева — 8/10');

  await scheme.getByLabel('Сторона для подтверждения').selectOption('right');
  await confirm.click();
  await expect(status).toContainText('ASPECTS справа — 10/10');
  await expect(status).toContainText('ASPECTS слева — 8/10');
  await mode.selectOption('affected');
  await zone('right', 'C').press('Enter');
  await expect(conclude).toContainText('МСКТ-признаки гиподенсивных изменений в зоне C справа (ASPECTS справа — 9 баллов).');
  await mode.selectOption('normal');
  await zone('right', 'C').press('Enter');
  await page.getByRole('tab', { name: 'Кратко' }).click();
  await page.getByRole('tab', { name: 'ОНМК' }).click();
  await expect(page).toHaveURL(protocol);
  await expect(status).toContainText('ASPECTS слева — 8/10');
  await quick(page).click();
  await expect(conclude).toContainText(negative);
  await expect(status).toContainText('Слева — оценено 8 из 10');
  await expect(conclude).not.toContainText('ASPECTS слева');
  await expect(conclude).toContainText('ASPECTS справа — 10 баллов');
  await expect(scheme.getByText(/Ранние изменения в оценённых зонах СМА справа не видны/)).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(conclude).not.toContainText('ASPECTS');
  await page.getByText('Схема ASPECTS', { exact: true }).click();
  await expect(status).toContainText('Слева — оценено 0 из 10');
  await expect(status).toContainText('Справа — оценено 0 из 10');
});
