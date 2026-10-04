import type { Page } from '@playwright/test'
import { expect, test } from './clean-console'
import { FIXTURES } from './fixtures.setup'
import { readPdf } from './read-pdf'

async function open(page: Page) {
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'contract.pdf')
  await expect(page.getByRole('img', { name: 'Page 1' })).toBeVisible()
}

test('sign in three steps: make a signature, click the page, download', async ({ page }) => {
  await page.goto('./sign/')
  await open(page)
  // 1 — type it.
  await page.getByRole('tab', { name: 'Type' }).click()
  await page.getByLabel('Your name').fill('Alex Morgan')
  await page.getByRole('button', { name: 'Use this signature' }).click()
  await expect(page.getByRole('img', { name: 'Your signature' })).toBeVisible()
  // 2 — click where it goes.
  const overlay = page.getByLabel('Marks on page 1')
  const box = (await overlay.boundingBox())!
  await overlay.click({ position: { x: box.width * 0.6, y: box.width * 0.45 } })
  await expect(page.getByRole('status')).toContainText('Signature placed on page 1')
  // Bigger, from the keyboard.
  const placed = overlay.getByRole('button', { name: 'Signature' })
  const width = Number(await placed.getAttribute('width'))
  await placed.focus()
  await page.keyboard.press('+')
  await expect.poll(async () => Number(await placed.getAttribute('width'))).toBeCloseTo(width * 1.1)
  // 3 — download.
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('contract-signed.pdf')
  await download.saveAs(test.info().outputPath('contract-signed.pdf'))
  const [first] = await readPdf(download)
  expect(first!.images).toBe(1)
  expect(first!.text).toContain('Date: 1 March 2026')
})

test('the signature is remembered on this device until it is forgotten', async ({ page }) => {
  await page.goto('./sign/')
  await open(page)
  await page.getByRole('tab', { name: 'Type' }).click()
  await page.getByLabel('Your name').fill('A. M.')
  await page.getByRole('button', { name: 'Use this signature' }).click()
  await expect(page.getByRole('img', { name: 'Your signature' })).toBeVisible()

  await page.reload()
  await open(page)
  await expect(page.getByRole('img', { name: 'Your signature' })).toBeVisible()
  await page.getByRole('button', { name: 'Forget on this device' }).click()
  await page.reload()
  await open(page)
  await expect(page.getByRole('tab', { name: 'Draw' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Your signature' })).toHaveCount(0)
})

test('a drawn signature works with a mouse, and nothing is placed without one', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drawing; touch uses the same pointer events')
  await page.goto('./sign/')
  await open(page)
  const overlay = page.getByLabel('Marks on page 1')
  await overlay.click({ position: { x: 200, y: 200 } })
  await expect(page.getByRole('status')).toContainText('Make your signature first')
  await page.getByLabel(/^Signature pad/).scrollIntoViewIfNeeded()
  const pad = (await page.getByLabel(/^Signature pad/).boundingBox())!
  await page.mouse.move(pad.x + 40, pad.y + 100)
  await page.mouse.down()
  await page.mouse.move(pad.x + 160, pad.y + 30, { steps: 6 })
  await page.mouse.move(pad.x + 260, pad.y + 110, { steps: 6 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Use this signature' }).click()
  await overlay.click({ position: { x: 300, y: 300 } })
  await expect(overlay.getByRole('button', { name: 'Signature' })).toHaveCount(1)
})

for (const tool of ['sign', 'edit'])
  test(`${tool}: fits a 360 px screen without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await page.goto(`./${tool}/`)
    await open(page)
    if (tool === 'sign') {
      await page.getByRole('tab', { name: 'Type' }).click()
      await expect(page.getByRole('tab', { name: 'Type' })).toHaveAttribute('aria-selected', 'true')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    await page.screenshot({ path: test.info().outputPath(`${tool}-360.png`), fullPage: false })
  })
