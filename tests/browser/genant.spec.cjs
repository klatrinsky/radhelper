const { test, expect } = require('@playwright/test');

for (const [protocol, level] of [
  ['ct-spine-thoracic', 'Th12'],
  ['ct-spine-lumbar', 'L1'],
  ['xr-spine-thoracic', 'Th12'],
  ['xr-spine-lumbar', 'L1'],
]) {
  test(`в ${protocol} процент снижения высоты не меняет выбранную морфологию`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?protocol=' + protocol);
    const study = page.locator('#study');
    const height = study.locator('input[data-name="h 1"]');
    const reference = study.locator('input[data-name="H 1"]');
    const fracture = study.getByRole('button', { name: /^— компрессионный перелом/ });
    const schmorl = study.getByRole('button', { name: '— нельзя исключить грыжу Шморля', exact: true });
    const copy = async (selector, expected) => {
      await page.evaluate(() => navigator.clipboard.writeText(''));
      const button = study.locator(selector);
      await button.click();
      if (await button.innerText() === 'Всё равно скопировать') await button.click();
      const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
      await expect.poll(clipboard).toContain(expected);
      return clipboard();
    };

    await expect(study).toHaveAttribute('data-src', 'content/templates/' + protocol + '.md');
    await expect(height).toBeHidden();
    await study.getByRole('button', { name: /^Высота тел позвонков сохранена,/ }).click();
    await expect(height).toHaveValue('');
    await reference.fill('20');
    await height.fill('16,2');
    await expect(fracture).toBeVisible();
    await expect(schmorl).toBeHidden();
    const initial = await copy('.copy', 'на 19%');
    expect(initial).not.toContain('нельзя исключить грыжу Шморля');

    await fracture.click();
    await expect(schmorl).toBeVisible();
    await height.fill('14');
    await expect(schmorl).toBeVisible();
    await height.clear();
    await expect(schmorl).toBeVisible();
    await height.fill('14');
    const description = await copy('.copy', 'на 30% — нельзя исключить грыжу Шморля');
    expect(description).toContain('Снижение высоты тела ' + level + ' позвонка');
    await copy('.copy-conclusion', 'Нельзя исключить грыжу Шморля в теле ' + level + ' позвонка (снижение высоты 30%)');

    await schmorl.click();
    await expect(fracture).toBeVisible();
    await copy('.copy-conclusion', 'Компрессионный перелом тела ' + level + ' позвонка, 2 степень по Genant.');
    await height.fill('16,2');
    await expect(fracture).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  });
}
