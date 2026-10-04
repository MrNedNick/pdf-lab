import { readFileSync } from 'node:fs'
import { PDFDocument } from '@cantoo/pdf-lib'
import type { Download, Page } from '@playwright/test'
import { expect, test } from './clean-console'
import { FIXTURES } from './fixtures.setup'
import { readPdf } from './read-pdf'

async function fill(page: Page) {
  await page.goto('./fill/')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'form.pdf')
  await expect(page.getByText('0 of 5 fields filled')).toBeVisible()
  await page.getByLabel('full name').fill('Олена Коваль')
  await page.getByLabel('country').selectOption('Poland')
  await page.getByLabel('plan: pro').check()
  await page.getByLabel('about').fill('Frontend developer.\nLikes long PDFs.')
  await page.getByLabel('agree').check()
  await expect(page.getByText('5 of 5 fields filled')).toBeVisible()
}

async function save(page: Page) {
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('form-filled.pdf')
  return download
}

const bytesOf = async (download: Download) => new Uint8Array(readFileSync(await download.path()))

test('fill every kind of field and save: the values are in the form', async ({ page }) => {
  await fill(page)
  const form = (await PDFDocument.load(await bytesOf(await save(page)))).getForm()
  expect(form.getTextField('full_name').getText()).toBe('Олена Коваль')
  expect(form.getDropdown('country').getSelected()).toEqual(['Poland'])
  expect(form.getRadioGroup('plan').getSelected()).toBe('pro')
  expect(form.getTextField('about').getText()).toBe('Frontend developer.\nLikes long PDFs.')
  expect(form.getCheckBox('agree').isChecked()).toBe(true)
})

test('"make it final" turns the answers into page text', async ({ page }) => {
  await fill(page)
  await page.getByLabel('Make it final').check()
  const download = await save(page)
  expect((await PDFDocument.load(await bytesOf(download))).getForm().getFields()).toHaveLength(0)
  const [first] = await readPdf(download)
  expect(first!.text).toContain('Олена Коваль')
  expect(first!.text).toContain('Poland')
})

test('a PDF without fields says so and points to typing over it', async ({ page }) => {
  await page.goto('./fill/')
  await page.getByLabel('Choose a PDF').setInputFiles(FIXTURES + 'contract.pdf')
  await expect(page.getByText('This PDF has no fields to fill in.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add text and marks' })).toHaveAttribute('href', /\/edit\/$/)
})
