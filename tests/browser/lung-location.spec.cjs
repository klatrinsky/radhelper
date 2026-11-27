const { test, expect } = require('@playwright/test');

const form = page => page.locator('[data-lung-finding]');
const report = page => page.locator('#location-report');
const figure = (page, projection) => page.locator('figure[data-projection="' + projection + '"]');
const area = (page, projection, type, id) => figure(page, projection).locator('[data-choice="' + type + '"][data-region="' + id + '"]');
const save = page => form(page).getByRole('button', { name: 'Добавить находку' }).click();

test('сначала выбирается сегмент, затем сохраняется находка и копируется текст', async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/lung-segments.html');
  await expect(page.getByRole('heading', { name: 'Рентгенография ОГК' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'КТ ОГК', exact: true })).toHaveCount(0);
  const copy = page.getByRole('button', { name: 'Скопировать фрагмент' });
  await expect(copy).toBeDisabled();
  await expect(form(page)).toBeHidden();

  const rightS3 = area(page, 'front', 'segments', 'right-s3');
  if (info.project.use.hasTouch) await rightS3.locator('path').tap();
  else await rightS3.press('Enter');
  await expect(rightS3).toHaveAttribute('aria-pressed', 'true');
  await expect(area(page, 'rightLateral', 'segments', 'right-s3')).toHaveAttribute('aria-pressed', 'true');
  await expect(form(page)).toBeVisible();
  await expect(form(page).getByRole('status')).toHaveText('В сегменте S3 верхней доли правого лёгкого');
  await expect(form(page).getByRole('button', { name: 'Добавить находку' })).toBeDisabled();
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('opacity');
  await rightS3.press('Enter');
  await expect(form(page)).toBeHidden();
  await rightS3.press('Enter');
  await expect(form(page).getByRole('combobox', { name: 'Находка', exact: true })).toHaveValue('');
  const second = area(page, 'front', 'segments', 'right-s2');
  await second.press('Space');
  await expect(form(page).getByRole('status')).toHaveText('В сегментах S2 и S3 верхней доли правого лёгкого');
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('focus');
  await save(page);
  await expect(form(page)).toBeHidden();
  await expect(rightS3).toHaveAttribute('aria-pressed', 'false');
  await expect(rightS3).toHaveAttribute('data-recorded', '');
  const expected = 'В сегментах S2 и S3 верхней доли правого легкого определяется очаговая тень.';
  await expect(report(page)).toHaveText(expected);
  await copy.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
});

test('три проекции, доли и поля на узкой ширине и в тёмной теме', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/lung-segments.html');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 28, 32)');
  const right = figure(page, 'rightLateral');
  const front = figure(page, 'front');
  const left = figure(page, 'leftLateral');
  await expect(front).toBeVisible();
  await expect(front.locator('svg [data-side]')).toHaveCount(2);
  await expect(right.locator('svg [data-side="left"]')).toHaveCount(0);
  await expect(left.locator('svg [data-side="right"]')).toHaveCount(0);
  if (info.project.use.hasTouch) {
    await expect(right).toBeHidden();
    await expect(left).toBeHidden();
    await page.getByRole('button', { name: 'Правая боковая' }).click();
  } else {
    expect((await right.boundingBox()).x).toBeLessThan((await front.boundingBox()).x);
    expect((await front.boundingBox()).x).toBeLessThan((await left.boundingBox()).x);
  }
  await expect(right).toBeVisible();
  await area(page, 'rightLateral', 'segments', 'right-s6').press('Enter');
  await expect(form(page).getByRole('status')).toHaveText('В сегменте S6 нижней доли правого лёгкого');
  if (info.project.use.hasTouch) await page.getByRole('button', { name: 'Левая боковая' }).click();
  await expect(left).toBeVisible();
  await area(page, 'leftLateral', 'segments', 'left-s6').press('Enter');
  await expect(form(page).getByRole('status')).toHaveText('В сегменте S6 нижней доли правого лёгкого и в сегменте S6 нижней доли левого лёгкого');
  await form(page).getByRole('button', { name: 'Снять выбор' }).click();
  await expect(form(page)).toBeHidden();
  await page.getByRole('button', { name: 'Доли', exact: true }).click();
  await area(page, 'leftLateral', 'lobes', 'left-lower').press('Enter');
  await expect(form(page).getByRole('status')).toHaveText('В нижней доле левого лёгкого');
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('atelectasis');
  await save(page);
  await page.getByRole('button', { name: 'Лёгочные поля' }).click();
  await expect(right).toHaveCount(0);
  await expect(left).toHaveCount(0);
  await area(page, 'front', 'fields', 'right-middle').press('Enter');
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('opacity');
  await save(page);
  await expect(report(page)).toHaveText('В нижней доле левого легкого определяется ателектаз. В проекции среднего поля правого легкого определяется затемнение.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('сохранённые находки можно менять независимо и выбирать сегменты из списка', async ({ page }) => {
  await page.goto('/lung-segments.html');
  await area(page, 'front', 'segments', 'left-s1+2').press('Enter');
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('other');
  await expect(form(page).getByRole('button', { name: 'Добавить находку' })).toBeDisabled();
  await form(page).getByRole('textbox', { name: 'Описание находки' }).fill('Определяются линейные тени');
  await save(page);
  await page.getByText('Выбрать из списка', { exact: true }).click();
  await page.locator('.lung-choice-list').getByRole('button', { name: /S7 медиальный базальный/ }).click();
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('focus');
  await save(page);
  await expect(report(page)).toContainText('В сегменте S7 нижней доли правого легкого определяется очаговая тень.');
  await page.getByRole('button', { name: /Изменить находку «.*определяются линейные тени/ }).click();
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('opacity');
  await form(page).getByRole('button', { name: 'Сохранить находку' }).click();
  await expect(report(page)).toHaveText('В сегменте S1+2 верхней доли левого легкого определяется затемнение. В сегменте S7 нижней доли правого легкого определяется очаговая тень.');
  await page.getByRole('button', { name: /Удалить находку «.*определяется затемнение/ }).click();
  await expect(report(page)).toHaveText('В сегменте S7 нижней доли правого легкого определяется очаговая тень.');
  await expect(area(page, 'front', 'segments', 'left-s1+2')).not.toHaveAttribute('data-recorded');
});

test('подписи сегментов находятся внутри собственных контуров во всех проекциях', async ({ page }, info) => {
  await page.goto('/lung-segments.html');
  for (const [projection, label, count] of [['front', 'Прямая', 13], ['rightLateral', 'Правая боковая', 8], ['leftLateral', 'Левая боковая', 8]]) {
    if (info.project.use.hasTouch) await page.getByRole('button', { name: label, exact: true }).click();
    const regions = figure(page, projection).locator('svg [data-choice="segments"]');
    await expect(regions).toHaveCount(count);
    const outside = await regions.evaluateAll(groups => groups.flatMap(group => {
      const path = group.querySelector('path');
      const label = group.querySelector('text');
      const anchor = new DOMPoint(Number(label.getAttribute('x')), Number(label.getAttribute('y')));
      const point = anchor.matrixTransform(label.getCTM()).matrixTransform(path.getCTM().inverse());
      return path.isPointInFill(point) ? [] : [group.dataset.region];
    }));
    expect(outside).toEqual([]);
  }
});

test('характеристики образования и лёгочного рисунка сохраняются раздельно и копируются', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/lung-segments.html');
  await area(page, 'front', 'segments', 'right-s3').press('Enter');
  const chooser = form(page);
  const kind = chooser.getByRole('combobox', { name: 'Находка', exact: true });
  const intensity = chooser.getByLabel('Интенсивность тени');
  const structure = chooser.getByLabel('Соседняя структура');
  const relation = chooser.getByLabel('Отношение к структуре');
  await expect(intensity).toBeHidden();
  await kind.selectOption('mass');
  await intensity.selectOption({ label: 'Умеренная' });
  await chooser.getByLabel('Максимальный размер, мм').fill('0');
  await save(page);
  await expect(report(page)).toHaveText('Добавьте находку, чтобы сформировать фрагмент.');
  await chooser.getByLabel('Максимальный размер, мм').fill('27.5');
  await chooser.getByLabel('Форма тени').selectOption({ label: 'Овальная' });
  await chooser.getByRole('combobox', { name: 'Контуры', exact: true }).selectOption({ label: 'Чёткие, неровные' });
  await chooser.getByLabel('Структура тени').selectOption({ label: 'Однородная' });
  await expect(relation).toBeHidden();
  await structure.selectOption('hilum');
  await expect(chooser.getByRole('button', { name: 'Добавить находку' })).toBeDisabled();
  await relation.selectOption('linked');
  await structure.selectOption('pleura');
  await expect(relation).toHaveValue('');
  await relation.selectOption('overlaps');
  await chooser.getByLabel('Дополнительное описание').fill('В динамике без изменений');
  await save(page);
  const first = 'В сегменте S3 верхней доли правого легкого определяется образование. ' +
    'Интенсивность тени умеренная. Максимальный размер 27,5 мм. Форма тени овальная. ' +
    'Контуры чёткие, неровные. Структура тени однородная. Проекционно накладывается на плевру. В динамике без изменений.';
  await expect(report(page)).toHaveText(first);

  await area(page, 'front', 'segments', 'left-s5').press('Enter');
  await kind.selectOption('crowding');
  await expect(intensity).toBeHidden();
  await expect(structure).toBeHidden();
  await chooser.getByLabel('Степень выраженности').selectOption({ label: 'Выраженная' });
  await save(page);
  const second = 'В сегменте S5 верхней доли левого легкого определяется выраженное сближение легочного рисунка.';
  await expect(report(page)).toHaveText(first + ' ' + second);

  await page.getByRole('button', { name: /Изменить находку «.*определяется образование/ }).click();
  await expect(intensity).toHaveValue('умеренная');
  await expect(chooser.getByLabel('Максимальный размер, мм')).toHaveValue('27.5');
  await expect(relation).toHaveValue('overlaps');
  await relation.selectOption('noLink');
  await chooser.getByRole('button', { name: 'Сохранить находку' }).click();
  const updated = first.replace('Проекционно накладывается на плевру.', 'Связь с плеврой не прослеживается.');
  await page.getByRole('button', { name: 'Скопировать фрагмент' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(updated + '\n' + second);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('все варианты ОГК включают схему в описание и заключение и восстанавливаются после сброса', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('https://mc.yandex.ru/**', route => route.abort());
  const variants = ['xr-chest', 'xr-chest-full', 'xr-chest-age', 'xr-chest-supine', 'xr-chest-portable'];
  const template = page.locator('.tpl');
  const toggle = template.getByText('Схема лёгких', { exact: true });
  const copyProtocol = page.getByRole('button', { name: 'Скопировать протокол', exact: true });
  const copyConclusion = page.getByRole('button', { name: 'Скопировать заключение', exact: true });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const clearClipboard = () => page.evaluate(() => navigator.clipboard.writeText(''));
  const finding = 'В сегменте S8 нижней доли правого легкого определяется очаговая тень.';
  const summary = 'Рентгенологические признаки очаговой тени S8 правого легкого.';
  const details = 'Интенсивность тени умеренная.';
  const negative = /очагов[а-яё]* (?:и|или) инфильтративн[а-яё]* изменени[а-яё]*/i;

  for (const variant of variants) {
    await test.step(variant, async () => {
      await page.goto('/?protocol=' + variant);
      await expect(toggle).toBeVisible();
      await expect(template.locator('.lung-picker')).toHaveCount(0);
      await clearClipboard();
      await copyProtocol.click();
      await expect.poll(clipboard).toMatch(negative);
      const initialDescription = await clipboard();
      await clearClipboard();
      await copyConclusion.click();
      const initialPattern = variant === 'xr-chest-portable' ? /пневмоторакса/ : negative;
      await expect.poll(clipboard).toMatch(initialPattern);
      const initialConclusion = await clipboard();

      await toggle.click();
      await area(page, 'front', 'segments', 'right-s8').press('Enter');
      await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('focus');
      await form(page).getByLabel('Интенсивность тени').selectOption({ label: 'Умеренная' });
      await save(page);
      await expect(template.locator('.ln').filter({ hasText: finding }).first()).toBeVisible();
      await copyProtocol.click();
      await expect.poll(clipboard).toContain(finding + ' ' + details);
      const description = await clipboard();
      expect(description.split(finding)).toHaveLength(2);
      expect(description).not.toContain(summary);
      expect(description).not.toMatch(negative);
      await copyConclusion.click();
      await expect.poll(clipboard).toContain(summary);
      const conclusion = await clipboard();
      expect(conclusion.split(summary)).toHaveLength(2);
      expect(conclusion).not.toContain(finding);
      expect(conclusion).not.toContain(details);
      expect(conclusion).not.toMatch(negative);
      if (variant === 'xr-chest-portable') expect(conclusion).toContain(initialConclusion);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

      await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
      await expect(template.locator('.lung-picker')).toHaveCount(0);
      await copyProtocol.click();
      await expect.poll(clipboard).toBe(initialDescription);
      await copyConclusion.click();
      await expect.poll(clipboard).toBe(initialConclusion);
    });
  }
});

test('формулировка начинается с локализации, а находки и сброс привязаны к текущей вкладке', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('https://mc.yandex.ru/**', route => route.abort());
  await page.goto('/?protocol=xr-chest');
  const toggle = page.getByText('Схема лёгких', { exact: true });
  const normal = page.getByRole('tab', { name: 'Норма', exact: true });
  const detailed = page.getByRole('tab', { name: 'Подробно', exact: true });
  const copyConclusion = page.getByRole('button', { name: 'Скопировать заключение', exact: true });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const summary = 'Рентгенологические признаки умеренного усиления легочного рисунка S3 правого легкого.';
  await toggle.click();
  await area(page, 'front', 'segments', 'right-s3').press('Enter');
  await form(page).getByRole('combobox', { name: 'Находка', exact: true }).selectOption('markings');
  await form(page).getByLabel('Степень выраженности').selectOption({ label: 'Умеренная' });
  await save(page);
  await copyConclusion.click();
  await expect.poll(clipboard).toBe(
    'На момент текущего исследования очаговых и инфильтративных изменений не выявлено.\n' + summary
  );
  await detailed.click();
  await expect(page).toHaveURL(/\?protocol=xr-chest-full$/);
  await expect(page.locator('.lung-picker')).toHaveCount(0);
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await normal.click();
  await expect(area(page, 'front', 'segments', 'right-s3')).toHaveAttribute('data-recorded', '');
  await page.getByRole('button', { name: /Удалить находку/ }).click();
  await copyConclusion.click();
  await expect.poll(clipboard).toBe('На момент текущего исследования очаговых и инфильтративных изменений не выявлено.');
});

test('заключение различает долю, лёгочное поле и находку со свободным текстом', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('https://mc.yandex.ru/**', route => route.abort());
  await page.goto('/?protocol=xr-chest');
  await page.getByText('Схема лёгких', { exact: true }).click();
  const kind = form(page).getByRole('combobox', { name: 'Находка', exact: true });

  await page.getByRole('button', { name: 'Доли', exact: true }).click();
  await area(page, 'front', 'lobes', 'left-lower').press('Enter');
  await kind.selectOption('atelectasis');
  await save(page);

  await page.getByRole('button', { name: 'Лёгочные поля', exact: true }).click();
  await area(page, 'front', 'fields', 'right-upper').press('Enter');
  await kind.selectOption('opacity');
  await save(page);

  await page.getByRole('button', { name: 'Сегменты', exact: true }).click();
  await area(page, 'front', 'segments', 'left-s5').press('Enter');
  await kind.selectOption('other');
  await form(page).getByRole('textbox', { name: 'Описание находки' }).fill('Определяются линейные тени.');
  await save(page);

  await page.getByRole('button', { name: 'Скопировать заключение', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe([
    'Рентгенологические признаки ателектаза в нижней доле левого легкого.',
    'Рентгенологические признаки затемнения в проекции верхнего поля правого легкого.',
    'Рентгенологическая находка в сегменте S5 верхней доли левого легкого — определяются линейные тени.'
  ].join('\n'));
});
