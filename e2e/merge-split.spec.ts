import { expect, test } from './clean-console'
import { FIXTURES } from './fixtures.setup'
import { readPdf } from './read-pdf'

test('merge three files, one of them locked, in a chosen order', async ({ page }) => {
  await page.goto('./merge/')
  await page.getByLabel('Choose PDFs').setInputFiles([FIXTURES + 'alpha.pdf', FIXTURES + 'beta.pdf', FIXTURES + 'locked.pdf'])
  const files = page.getByRole('list', { name: 'Files in order' })
  await expect(files.getByRole('listitem')).toHaveCount(3)
  // The locked one asks for its password in place.
  const merge = page.getByRole('button', { name: 'Merge 3 files' })
  await expect(merge).toBeDisabled()
  await page.getByLabel('Password for locked.pdf').fill('nope')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText('did not open')
  await page.getByLabel('Password for locked.pdf').fill('open sesame')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(files.getByText('2 pages')).toHaveCount(2)
  await expect(merge).toBeEnabled()
  // Beta first.
  await page.getByRole('button', { name: 'Move beta.pdf up' }).click()
  await expect(files.getByRole('listitem').first()).toContainText('beta.pdf')
  const downloadEvent = page.waitForEvent('download')
  await merge.click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('merged.pdf')
  const pages = await readPdf(download)
  expect(pages.map((p) => p.text)).toEqual(['Beta 1', 'Alpha 1', 'Alpha 2', 'Page 1', 'Page 2'])
})

test('a broken file is named and can be removed', async ({ page }) => {
  await page.goto('./merge/')
  await page.getByLabel('Choose PDFs').setInputFiles([FIXTURES + 'alpha.pdf', FIXTURES + 'broken.pdf', FIXTURES + 'beta.pdf'])
  await expect(page.getByRole('alert')).toContainText('not a PDF')
  await expect(page.getByRole('button', { name: 'Merge 3 files' })).toBeDisabled()
  await page.getByRole('button', { name: 'Remove broken.pdf' }).click()
  await expect(page.getByRole('button', { name: 'Merge 2 files' })).toBeEnabled()
})

test('split by ranges: mistakes are shown, two parts come as a ZIP', async ({ page }) => {
  await page.goto('./split/')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'three.pdf')
  const ranges = page.getByLabel(/^Pages — for example/)
  await ranges.fill('1-2, 7')
  await expect(page.getByRole('alert')).toContainText('This PDF has 3 pages')
  await expect(ranges).toHaveAttribute('aria-invalid', 'true')
  await ranges.fill('3')
  let downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download' }).click()
  let download = await downloadEvent
  expect(download.suggestedFilename()).toBe('three-pages-3.pdf')
  expect((await readPdf(download)).map((p) => p.text)).toEqual(['Page 3'])

  await page.getByLabel('Every page as its own file').check()
  await expect(page.getByRole('list', { name: 'Files you will get' }).getByRole('listitem')).toHaveCount(3)
  downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Split into 3 files (ZIP)' }).click()
  download = await downloadEvent
  expect(download.suggestedFilename()).toBe('three-split.zip')
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk))
  const archive = Buffer.concat(chunks).toString('latin1')
  for (const n of [1, 2, 3]) expect(archive).toContain(`three-pages-${n}.pdf`)
})
