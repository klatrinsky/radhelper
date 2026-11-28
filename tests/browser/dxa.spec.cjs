const { test, expect } = require('@playwright/test');

test('контрольная DXA выводит динамику только для сопоставимых исследований', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?protocol=dxa');
  const study = page.locator('#study');
  const apparatus = study.getByRole('combobox', { name: 'аппарат сравнения', exact: true });
  const previous = study.locator('details.ctl').filter({ hasText: 'Данные предыдущего исследования' });
  const date = previous.getByPlaceholder('дд.мм.гггг');
  const field = name => study.locator(`input[data-name="${name}"]:visible`);
  const conclusion = study.getByRole('region', { name: 'Заключение' });
  const readClipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const copy = async button => {
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await button.click();
    if (await button.innerText() === 'Всё равно скопировать') await button.click();
    await expect.poll(readClipboard).not.toBe('');
    return readClipboard();
  };
  const copyConclusion = () => copy(study.locator('.copy-conclusion'));
  const limitation = 'Кросс-калибровка не подтверждена. Количественная динамика МПК не оценивается.';
  const bmdChange = 'Изменение МПК (BMD) в поясничном отделе позвоночника +15%.';

  await expect(study).toHaveAttribute('data-src', 'content/templates/dxa.md');
  await expect(apparatus).toBeHidden();
  await expect(previous).toBeHidden();
  await field('Возраст').fill('68');
  await field('T позв').fill('-1');
  await field('T% позв').fill('90');
  await study.getByText('Первичное исследование', { exact: true }).click();
  await expect(apparatus).toHaveValue('Тот же аппарат');
  await previous.getByText('Данные предыдущего исследования', { exact: true }).click();
  await date.fill('13.03.2025');
  await field('было позв').fill('80');
  expect(await copyConclusion()).toContain('Изменение T% в поясничном отделе позвоночника +10 п. п.');

  await previous.getByRole('button', { name: /T-критерий/ }).click();
  await field('BMD позв').fill('0,92');
  await field('BMD было позв').fill('0,80');
  expect(await copyConclusion()).toContain(bmdChange);

  await apparatus.selectOption({ label: 'Другой, не подтверждена' });
  await expect(conclusion).toContainText(limitation, { useInnerText: true });
  await expect(conclusion).not.toContainText(bmdChange, { useInnerText: true });
  const limited = await copyConclusion();
  expect(limited).toContain('13.03.2025');
  expect(limited).toContain(limitation);
  expect(limited).not.toMatch(/Изменение|\+15%|0,92|0,80/);
  await expect(field('BMD позв')).toHaveValue('0,92');
  await expect(field('BMD было позв')).toHaveValue('0,80');
  await expect(date).toHaveValue('13.03.2025');

  await previous.getByRole('button', { name: /BMD, г\/см²/ }).click();
  await expect(field('было позв')).toHaveValue('80');
  expect(await copyConclusion()).not.toMatch(/Изменение|\+10 п\. п\./);
  const protocol = await copy(study.locator('.copy'));
  expect(protocol).toContain('Ткр = -1 (90%)');
  expect(protocol).not.toMatch(/13\.03\.2025|Аппарат \/ кросс-калибровка|0,92|0,80/);

  await previous.getByRole('button', { name: /T-критерий/ }).click();
  await apparatus.selectOption({ label: 'Другой, подтверждена' });
  const calibrated = await copyConclusion();
  expect(calibrated).toContain('Кросс-калибровка подтверждена.');
  expect(calibrated).toContain(bmdChange);
  await apparatus.selectOption({ label: 'Тот же аппарат' });
  expect(await copyConclusion()).toContain(bmdChange);
  await expect(field('BMD позв')).toHaveValue('0,92');
  await expect(field('BMD было позв')).toHaveValue('0,80');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});
