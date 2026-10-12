const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const artifacts = path.resolve(__dirname, '../../artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  let createdId;
  try {
    await page.goto(process.env.APP_URL || 'http://localhost:3000');
    await page.getByText('Product inventory', { exact: true }).waitFor();
    await page.getByText('Connecting to your inventory…').waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(artifacts, 'dashboard-desktop.png'), fullPage: true });
    await page.getByText('＋ Add product', { exact: true }).click();
    const sku = `BROWSER-${Date.now()}`;
    await page.getByLabel('SKU', { exact: true }).fill(sku);
    await page.getByLabel('Category', { exact: true }).fill('Demo');
    await page.getByLabel('Product name', { exact: true }).fill('Browser verification item');
    await page.getByLabel('Unit price (INR)', { exact: true }).fill('125.50');
    const created = page.waitForResponse(response => response.url().endsWith('/api/products') && response.request().method() === 'POST');
    await page.getByText('Save product', { exact: true }).click();
    const response = await created;
    assert.equal(response.status(), 201);
    createdId = (await response.json()).id;
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const row = page.getByRole('row').filter({ hasText: sku });
    await row.getByText('Stock ⇄', { exact: true }).click();
    await page.getByLabel('Units', { exact: true }).fill('8');
    await page.getByLabel('Reason', { exact: true }).fill('Browser test receipt');
    await page.getByText('Record movement', { exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await row.getByText('Stock ⇄', { exact: true }).click();
    await page.getByLabel('Movement type').selectOption('ISSUE');
    await page.getByLabel('Units', { exact: true }).fill('3');
    await page.getByLabel('Reason', { exact: true }).fill('Browser test issue');
    await page.getByText('Record movement', { exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(sku => [...document.querySelectorAll('tbody tr')].some(row => row.textContent.includes(sku) && row.querySelector('.quantity')?.textContent.trim() === '5'), sku);
    page.once('dialog', dialog => dialog.accept());
    await row.getByText('Archive', { exact: true }).click();
    await row.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Stock history', exact: true }).click();
    await page.getByRole('row').filter({ hasText: sku }).filter({ hasText: 'Browser test issue' }).waitFor();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflows mobile viewport');
    await page.screenshot({ path: path.join(artifacts, 'dashboard-mobile.png'), fullPage: true });
    assert.deepEqual(errors, [], 'Unexpected browser JavaScript errors');
    console.log('Browser CRUD, stock receipt/issue, history retention, desktop and mobile checks passed.');
  } finally {
    if (createdId) await page.request.delete(`${process.env.APP_URL || 'http://localhost:3000'}/api/products/${createdId}`);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
