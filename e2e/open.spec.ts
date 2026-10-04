import { expect, test } from '@playwright/test'
import { FIXTURES } from './fixtures.setup'

test.beforeEach(async ({ page }) => {
  // A tool that shows the document as pages to read through.
  await page.goto('./fill/')
})

test('a 200-page PDF opens on its first page and scrolls to the last', async ({ page }) => {
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'long-200.pdf')
  await expect(page.getByText('· 200 pages')).toBeVisible()
  await expect(page.getByText('Page 1 of 200')).toBeVisible()
  // The last page is drawn only once it is reached.
  const last = page.getByRole('img', { name: 'Page 200' })
  await last.scrollIntoViewIfNeeded()
  await expect(page.getByText('Page 200 of 200')).toBeVisible()
  await expect
    .poll(() => last.locator('canvas').evaluate((c: HTMLCanvasElement) => c.width))
    .toBeGreaterThan(100)
})

test('zoom changes the page width and Fit width brings it back', async ({ page }) => {
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'three.pdf')
  const first = page.getByRole('img', { name: 'Page 1' })
  const before = (await first.boundingBox())!.width
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByText('125%')).toBeVisible()
  expect((await first.boundingBox())!.width).toBeGreaterThan(before * 1.2)
  await page.getByRole('button', { name: 'Fit width' }).click()
  expect(Math.abs((await first.boundingBox())!.width - before)).toBeLessThan(2)
})

test('a broken file says so and the next file still opens', async ({ page }) => {
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'broken.pdf')
  await expect(page.getByRole('alert')).toContainText('not a PDF, or it is damaged')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'three.pdf')
  await expect(page.getByText('· 3 pages')).toBeVisible()
})

test('a locked PDF asks for its password', async ({ page }) => {
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'locked.pdf')
  const dialog = page.getByRole('dialog', { name: 'This PDF is protected' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/Password for/).fill('wrong')
  await dialog.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('did not open')
  await page.getByRole('dialog').getByLabel(/Password for/).fill('open sesame')
  await page.getByRole('dialog').getByRole('button', { name: 'Open' }).click()
  await expect(page.getByText('· 2 pages')).toBeVisible()
})
