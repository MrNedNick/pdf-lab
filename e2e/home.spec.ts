import { readFileSync } from 'node:fs'
import { expect, test } from './clean-console'
import { FIXTURES } from './fixtures.setup'

test('six tasks on the home page, each one click away', async ({ page }) => {
  await page.goto('./')
  const tiles = page.getByRole('list').first().getByRole('link')
  await expect(tiles).toHaveText([/^Sign/, /^Add text and marks/, /^Merge PDFs/, /^Split a PDF/, /^Compress/, /^Convert images and PDF/])
  await page.getByRole('link', { name: /^Compress/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Compress' })).toBeVisible()
  await expect(page).toHaveTitle('Compress — PDF Lab')
})

test('a PDF dropped on the home page opens in the tool chosen next', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('Choose PDFs or photos').setInputFiles(FIXTURES + 'contract.pdf')
  await expect(page.getByText('What should happen to contract.pdf?')).toBeVisible()
  await page.getByRole('button', { name: 'Sign' }).click()
  await expect(page).toHaveURL(/\/sign\/$/)
  await expect(page.getByText('contract.pdf · 1 page')).toBeVisible()
})

test('several PDFs go to Merge, photos go to Convert, a mix is refused', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('Choose PDFs or photos').setInputFiles([FIXTURES + 'alpha.pdf', FIXTURES + 'beta.pdf'])
  await page.getByRole('button', { name: 'Merge 2 PDFs' }).click()
  await expect(page.getByRole('list', { name: 'Files in order' }).getByRole('listitem')).toHaveCount(2)

  await page.goto('./')
  await page.getByLabel('Choose PDFs or photos').setInputFiles([FIXTURES + 'phone-photo.jpg', FIXTURES + 'diagram.png'])
  await page.getByRole('button', { name: 'Make a PDF from 2 photos' }).click()
  await expect(page.getByRole('list', { name: 'Images in order' }).getByRole('listitem')).toHaveCount(2)

  await page.goto('./')
  await page.getByLabel('Choose PDFs or photos').setInputFiles([FIXTURES + 'alpha.pdf', FIXTURES + 'diagram.png'])
  await expect(page.getByText('Drop either PDFs or photos')).toBeVisible()
})

test('every address of the build has its own title and link preview', async () => {
  const dist = new URL('../dist/', import.meta.url)
  const head = (path: string) => readFileSync(new URL(path, dist), 'utf8')
  expect(head('index.html')).toContain('<title>PDF Lab — free PDF tools in your browser</title>')
  const sign = head('sign/index.html')
  expect(sign).toContain('<title>Sign — PDF Lab</title>')
  expect(sign).toContain('<meta property="og:url" content="https://mrnednick.github.io/pdf-lab/sign/"')
  expect(sign).toContain('<link rel="canonical" href="https://mrnednick.github.io/pdf-lab/sign/"')
  expect(sign).toMatch(/<meta name="description" content="Sign a PDF in your browser/)
})

test('the home page fits a 360 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('./')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await page.screenshot({ path: test.info().outputPath('home-360.png'), fullPage: true })
})
