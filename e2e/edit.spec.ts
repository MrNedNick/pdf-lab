import { expect, test, type Page } from '@playwright/test'
import { FIXTURES } from './fixtures.setup'
import { readPdf } from './read-pdf'

async function open(page: Page) {
  await page.goto('./edit/')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'contract.pdf')
  await expect(page.getByRole('img', { name: 'Page 1' })).toBeVisible()
}

/** A point on the page in PDF points from its top-left corner, as a click position on the overlay. */
async function at(page: Page, x: number, y: number) {
  const box = (await page.getByLabel('Marks on page 1').boundingBox())!
  return { x: (x / 595.28) * box.width, y: (y / 841.89) * box.height }
}

test('correct the date in a contract: the line is covered and retyped', async ({ page }) => {
  await open(page)
  // "Date: 1 March 2026" sits on the baseline at 841.89 - 688 ≈ 154 from the top.
  await page.getByLabel('Marks on page 1').click({ position: await at(page, 100, 150) })
  const field = page.getByLabel('Text on the page')
  await expect(field).toHaveValue('Date: 1 March 2026')
  await field.fill('Date: 2 April 2026')
  await field.press('Escape')
  await expect(page.getByText('Date: 2 April 2026')).toBeVisible()

  // Cyrillic needs the embedded font; a highlight and a stroke come along.
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByLabel('Marks on page 1').click({ position: await at(page, 72, 260) })
  await page.getByLabel('Text on the page').fill('Підписано')
  await page.getByLabel('Text on the page').press('Escape')
  await page.getByRole('button', { name: 'Highlight' }).click()
  const overlay = page.getByLabel('Marks on page 1')
  const from = await at(page, 70, 165)
  const to = await at(page, 180, 182)
  const box = (await overlay.boundingBox())!
  await page.mouse.move(box.x + from.x, box.y + from.y)
  await page.mouse.down()
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 4 })
  await page.mouse.up()

  // Undo takes the highlight away, redo brings it back.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(overlay.locator('rect[opacity]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(overlay.locator('rect[opacity]')).toHaveCount(1)

  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('contract-edited.pdf')
  await download.saveAs(test.info().outputPath('contract-edited.pdf'))
  const [first] = await readPdf(download)
  expect(first!.text).toContain('Date: 2 April 2026')
  expect(first!.text).toContain('Підписано')
})

test('an empty text box is dropped, and a click off the text explains why nothing happened', async ({ page }) => {
  await open(page)
  await page.getByLabel('Marks on page 1').click({ position: await at(page, 400, 600) })
  await expect(page.getByRole('status')).toContainText('No text there')
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByLabel('Marks on page 1').click({ position: await at(page, 300, 400) })
  await page.getByLabel('Text on the page').press('Escape')
  await expect(page.getByLabel('Text on the page')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})

test('a mark can be picked, nudged and deleted from the keyboard', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Box' }).click()
  const overlay = page.getByLabel('Marks on page 1')
  const box = (await overlay.boundingBox())!
  const from = await at(page, 300, 40)
  const to = await at(page, 400, 90)
  await page.mouse.move(box.x + from.x, box.y + from.y)
  await page.mouse.down()
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 4 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Select' }).click()
  const mark = overlay.getByRole('button', { name: 'Box' })
  const x = Number(await mark.getAttribute('x'))
  await mark.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(mark).toHaveAttribute('x', String(x + 10))
  await page.keyboard.press('Delete')
  await expect(overlay.getByRole('button', { name: 'Box' })).toHaveCount(0)
})
