import { readFileSync } from 'node:fs'
import { expect, test } from './clean-console'
import { FIXTURES } from './fixtures.setup'
import { readPdf } from './read-pdf'

test('a scanned PDF gets much smaller and keeps its pages', async ({ page }) => {
  await page.goto('./compress/')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'scan.pdf')
  await page.getByRole('button', { name: /^Compress/ }).click()
  await expect(page.getByRole('status').getByText(/MB → /)).toBeVisible({ timeout: 20_000 })
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download smaller PDF' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('scan-compressed.pdf')
  const before = readFileSync(FIXTURES + 'scan.pdf').length
  const after = readFileSync(await download.path()).length
  expect(after).toBeLessThan(before * 0.6)
  const pages = await readPdf(download)
  expect(pages.map((p) => p.images)).toEqual([1, 1, 1])
})

test('a text PDF gets an honest "nothing to gain" instead of a fake win', async ({ page }) => {
  await page.goto('./compress/')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'contract.pdf')
  await page.getByRole('button', { name: /^Compress/ }).click()
  await expect(page.getByRole('status')).toContainText('no pictures to shrink')
  await expect(page.getByRole('button', { name: 'Download smaller PDF' })).toHaveCount(0)
})
