const { test, expect } = require('@playwright/test');

test('SVG открывает независимые правый и левый сосуды мышью, касанием и с клавиатуры', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/leg-arteries.html');
  const segments = page.locator('#artery-diagram [data-vessel]');
  const right = segments.filter({ has: page.locator('title', { hasText: /Подколенная артерия · справа/ }) });
  const left = page.locator('[data-vessel="left-popliteal"]');
  const editor = page.getByRole('dialog');
  const status = editor.getByLabel('Состояние');
  await expect(segments).toHaveCount(23);
  await expect(page.locator('#artery-diagram [data-visual="unassessed"]')).toHaveCount(23);
  await expect(segments.filter({ hasText: /ТАС|ЛПА|МПА/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Скопировать описание' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  const hit = right.locator('.vessel-hit');
  await hit.scrollIntoViewIfNeeded();
  const point = await hit.evaluate(path => {
    const centre = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM());
    return { x: centre.x + 8, y: centre.y };
  });
  if (testInfo.project.use.hasTouch) {
    await page.touchscreen.tap(point.x, point.y);
  } else {
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('#vessel-caption')).toContainText('Подколенная артерия · справа');
    await expect(right.locator('.vessel-highlight')).toHaveCSS('opacity', '1');
    await page.mouse.click(point.x, point.y);
  }
  await expect(editor).toHaveAccessibleName('Подколенная артерия · справа');
  await expect(status).toHaveValue('');
  await status.selectOption('stenosis');
  const degree = editor.getByLabel('Стеноз, %');
  await expect(right).toHaveAttribute('data-visual', 'stenosis-pending');
  await degree.fill('100');
  await expect(degree).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#description')).not.toContainText('100%');
  for (const [value, color] of [['49', 'low'], ['50', 'middle'], ['70', 'high']]) {
    await degree.fill(value);
    await expect(right).toHaveAttribute('data-visual', 'stenosis-' + color);
  }
  const location = editor.getByRole('group', { name: 'Локализация в сосуде' });
  await expect(location.getByRole('button', { name: 'Без уточнения' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#description')).toHaveText(/Справа:\s+Подколенная артерия — стеноз 70%\./);
  await location.getByRole('button', { name: 'Средняя треть' }).click();
  await location.getByRole('button', { name: 'Верхняя треть' }).click();
  await expect(location.locator('[aria-pressed="true"]')).toHaveText(['Верхняя треть', 'Средняя треть']);
  await editor.getByLabel('Протяжённость, мм').fill('12.5');
  await editor.getByLabel('Характер бляшки').selectOption('soft');
  await editor.getByRole('button', { name: 'Готово' }).click();
  await expect(editor).toBeHidden();
  await expect(right).toBeFocused();

  await left.press('Enter');
  await expect(editor).toHaveAccessibleName('Подколенная артерия · слева');
  await expect(status).toHaveValue('');
  await status.selectOption('occlusion');
  await expect(location.locator('[aria-pressed="true"]')).toHaveText('Без уточнения');
  await location.getByRole('button', { name: 'Средняя треть' }).click();
  await editor.getByLabel('Восстановление контрастирования дистальнее окклюзии').selectOption('no');
  await editor.getByRole('button', { name: 'Готово' }).click();
  await expect(left).toHaveAttribute('data-visual', 'occlusion');
  await expect(left.locator('.vessel-line')).toHaveCSS('stroke', 'rgb(8, 9, 10)');
  await expect(left.locator('.vessel-line')).toHaveCSS('stroke-dasharray', '8px, 6px');

  await expect(page.locator('#description')).toHaveText(
    /Справа:\s+Подколенная артерия — стеноз 70%, локализация — верхняя и средняя трети, протяжённость 12,5 мм, некальцинированная бляшка.\s+Слева:\s+Подколенная артерия — окклюзия, локализация — средняя треть, дистальнее контрастирование не восстанавливается./
  );
  await right.press('Space');
  await expect(degree).toHaveValue('70');
  await expect(location.locator('[aria-pressed="true"]')).toHaveText(['Верхняя треть', 'Средняя треть']);
  await location.getByRole('button', { name: 'Верхняя треть' }).click();
  await expect(location.locator('[aria-pressed="true"]')).toHaveText('Средняя треть');
  await location.getByRole('button', { name: 'Средняя треть' }).click();
  await expect(location.locator('[aria-pressed="true"]')).toHaveText('Без уточнения');
  await expect(page.locator('#description')).toContainText('Подколенная артерия — стеноз 70%, протяжённость');
  await editor.getByRole('button', { name: 'Сбросить сосуд' }).click();
  await expect(status).toHaveValue('');
  await expect(degree).toHaveCount(0);
  await expect(right).toHaveAttribute('data-visual', 'unassessed');
  await expect(left).toHaveAttribute('data-visual', 'occlusion');
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
});

test('описание и заключение копируются отдельно, норма и сброс обновляют только нужные сосуды', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/leg-arteries.html');
  const aorta = page.locator('[data-vessel="aorta"]');
  const rightTibial = page.locator('[data-vessel="right-posterior-tibial"]');
  const editor = page.getByRole('dialog');
  const status = editor.getByLabel('Состояние');
  const close = editor.getByRole('button', { name: 'Готово' });
  await aorta.locator('.vessel-chip').click();
  await status.selectOption('aneurysm');
  await editor.getByRole('button', { name: 'Верхняя треть' }).click();
  await editor.getByRole('button', { name: 'Средняя треть' }).click();
  await editor.getByRole('button', { name: 'Без уточнения' }).click();
  await expect(page.locator('#description')).not.toContainText('локализация');
  await editor.getByRole('button', { name: 'Нижняя треть' }).click();
  await editor.getByRole('button', { name: 'Средняя треть' }).click();
  await editor.getByLabel('Максимальный диаметр, мм').fill('38.2');
  await editor.getByLabel('Протяжённость, мм').fill('47');
  await editor.getByLabel('Пристеночные тромботические массы').selectOption('yes');
  await close.click();
  await expect(aorta).toHaveAttribute('data-visual', 'aneurysm');

  await rightTibial.locator('.vessel-chip').click();
  await status.selectOption('limited');
  await close.click();
  await expect(rightTibial).toHaveAttribute('data-visual', 'limited');
  await expect(rightTibial.locator('.vessel-line')).toHaveCSS('stroke-dasharray', '8px, 6px');
  const leftTibial = page.locator('[data-vessel="left-posterior-tibial"]');
  await leftTibial.locator('.vessel-chip').click();
  await status.selectOption('unassessed');
  await close.click();
  await expect(leftTibial).toHaveAttribute('data-visual', 'unassessed');

  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const description = await page.locator('#description').textContent();
  const conclusion = await page.locator('#conclusion').textContent();
  expect(description).toContain('протяжённость 47 мм');
  expect(conclusion).toContain('максимальный диаметр 38,2 мм');
  expect(description).toContain('локализация — средняя и нижняя трети');
  expect(conclusion).toContain('локализация — средняя и нижняя трети');
  expect(conclusion).not.toContain('47 мм');
  await page.getByRole('button', { name: 'Скопировать описание' }).click();
  await expect.poll(clipboard).toBe(description);
  await page.getByRole('button', { name: 'Скопировать заключение' }).click();
  await expect.poll(clipboard).toBe(conclusion);

  await page.getByRole('button', { name: 'Подтвердить норму для неотмеченных' }).click();
  await expect(page.locator('#progress')).toHaveText('Отмечено 23 из 23 сосудов');
  await expect(page.locator('#artery-diagram [data-visual="normal"]')).toHaveCount(20);
  await expect(aorta).toHaveAttribute('data-visual', 'aneurysm');
  await expect(leftTibial).toHaveAccessibleName(/Не оценивался/);
  await page.getByRole('button', { name: 'Сбросить схему' }).click();
  await expect(page.locator('#artery-diagram [data-visual="unassessed"]')).toHaveCount(23);
  await expect(page.locator('#conclusion')).toHaveText('Нет отмеченных сосудов.');
  await expect(page.getByRole('button', { name: 'Скопировать заключение' })).toBeDisabled();

  await aorta.locator('.vessel-chip').click();
  await status.selectOption('normal');
  await close.click();
  await page.reload();
  await expect(page.locator('#progress')).toHaveText('Отмечено 0 из 23 сосудов');
});
