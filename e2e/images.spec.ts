import { expect, test, type Download } from '@playwright/test'
import { FIXTURES } from './fixtures.setup'
import { readPdf } from './read-pdf'

async function bytesOf(download: Download) {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('a sideways phone photo and a diagram become a tidy A4 PDF', async ({ page }) => {
  await page.goto('./images/')
  await page.getByLabel('Choose images').setInputFiles([FIXTURES + 'phone-photo.jpg', FIXTURES + 'diagram.png'])
  const list = page.getByRole('list', { name: 'Images in order' })
  // The phone stored it 1600 × 1200 with "turn 90°" in EXIF; it is read upright.
  await expect(list.getByText('1200 × 1600')).toBeVisible()
  await expect(list.getByText('900 × 600')).toBeVisible()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Make a 2-page PDF' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('images.pdf')
  const pages = await readPdf(download)
  // Portrait A4 for the photo, landscape A4 for the wide diagram, one picture each.
  expect(pages.map(({ width, height, images }) => [width, height, images])).toEqual([
    [595, 842, 1],
    [842, 595, 1],
  ])
})

test('pages of a PDF become images: one PNG, or a ZIP of JPEGs', async ({ page }) => {
  await page.goto('./images/')
  await page.getByRole('tab', { name: 'PDF → images' }).click()
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'three.pdf')
  await page.getByLabel('Screen · 72 dpi').check()
  await page.getByLabel('Only some').check()
  await page.getByLabel('Pages, like 1-3, 5').fill('2')
  await expect(page.getByText('page 2 comes out at 595 × 842 px')).toBeVisible()
  let downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save as PNG' }).click()
  let download = await downloadEvent
  expect(download.suggestedFilename()).toBe('three-page-2.png')
  const png = await bytesOf(download)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([595, 842])

  await page.getByLabel('All 3').check()
  await page.getByLabel('JPEG — smaller photos').check()
  downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save 3 images (ZIP)' }).click()
  download = await downloadEvent
  expect(download.suggestedFilename()).toBe('three-images.zip')
  const archive = (await bytesOf(download)).toString('latin1')
  for (const n of [1, 2, 3]) expect(archive).toContain(`three-page-${n}.jpg`)

  // Switching tabs keeps what was open.
  await page.getByRole('tab', { name: 'Images → PDF' }).click()
  await page.getByRole('tab', { name: 'PDF → images' }).click()
  await expect(page.getByText('three.pdf')).toBeVisible()
})
