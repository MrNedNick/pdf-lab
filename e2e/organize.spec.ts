import { expect, test } from './clean-console'
import { FIXTURES } from './fixtures.setup'
import { readPdf } from './read-pdf'

test.beforeEach(async ({ page }) => {
  await page.goto('./organize/')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'three.pdf')
  await expect(page.getByRole('checkbox', { name: /^Page 3/ })).toBeVisible()
})

const tile = (page: import('@playwright/test').Page, n: number) => page.getByRole('checkbox', { name: new RegExp(`^Page ${n}(,|$| )`) })

test('reorder with the keyboard, rotate, save — the file has the new order', async ({ page }) => {
  // Page 3 to the front: focus it, Alt+Left twice.
  await tile(page, 3).focus()
  await page.keyboard.press('Alt+ArrowLeft')
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(tile(page, 3)).toHaveAttribute('aria-label', /position 1$/)
  // Focus follows the moved page on the next frame; let it land before moving on.
  await expect(tile(page, 3)).toBeFocused()
  // Turn page 1 to the right.
  await tile(page, 1).focus()
  await page.keyboard.press('r')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('three-organized.pdf')
  const pages = await readPdf(download)
  expect(pages.map((p) => p.text)).toEqual(['Page 3', 'Page 1', 'Page 2'])
  expect(pages.map((p) => p.rotation)).toEqual([0, 90, 0])
})

test('drag a page, delete one, extract the selection', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag; touch uses the same pointer events')
  const from = (await tile(page, 1).boundingBox())!
  const to = (await tile(page, 3).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(tile(page, 1)).toHaveAttribute('aria-label', /position 3$/)
  // Select page 2 and delete it.
  await tile(page, 2).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(2)
  // Shift-click selects both remaining pages; extract them.
  await tile(page, 3).click()
  await tile(page, 1).click({ modifiers: ['Shift'] })
  await expect(page.getByText('2 selected')).toBeVisible()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Extract selected' }).click()
  const pages = await readPdf(await downloadEvent)
  expect(pages.map((p) => p.text)).toEqual(['Page 3', 'Page 1'])
})

test('keyboard focus stays with the page it acts on', async ({ page }) => {
  await tile(page, 1).focus()
  await page.keyboard.press('Alt+ArrowRight')
  await page.keyboard.press('Alt+ArrowRight')
  await expect(tile(page, 1)).toHaveAttribute('aria-label', /position 3$/)
  await expect(tile(page, 1)).toBeFocused()
  // Deleting the last page hands focus to its new neighbour.
  await page.keyboard.press('Delete')
  await expect(page.getByRole('checkbox')).toHaveCount(2)
  await expect(tile(page, 3)).toBeFocused()
})
