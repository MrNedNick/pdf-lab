import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'

/** Test files are generated, not committed: a long document, a locked one, a broken one, two small ones to merge and two images. */
export const FIXTURES = new URL('../test-results/fixtures/', import.meta.url).pathname

async function numbered(pages: number, size: [number, number] = [595, 842], prefix = 'Page') {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage(size)
    page.drawRectangle({ x: 40, y: 40, width: size[0] - 80, height: size[1] - 80, borderColor: rgb(0.2, 0.4, 0.9), borderWidth: 2 })
    page.drawText(`${prefix} ${n}`, { x: 60, y: size[1] - 100, size: 36, font, color: rgb(0.1, 0.1, 0.15) })
  }
  return doc
}

/** An EXIF block with only the Orientation tag, big-endian. */
function exifOrientation(value: number): Buffer {
  const tiff = Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, value, 0, 0, 0, 0, 0, 0])
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff])
  const head = Buffer.from([0xff, 0xe1, 0, 0])
  head.writeUInt16BE(body.length + 2, 2)
  return Buffer.concat([head, body])
}

/** Photos drawn by the browser: a phone shot stored sideways with EXIF rotation, and a PNG. */
async function images() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const draw = (w: number, h: number, type: string) =>
    page.evaluate(
      async ({ w, h, type }) => {
        const canvas = new OffscreenCanvas(w, h)
        const context = canvas.getContext('2d')!
        context.fillStyle = '#f4efe6'
        context.fillRect(0, 0, w, h)
        context.fillStyle = '#c0392b' // a red corner shows which way is up
        context.fillRect(0, 0, w / 4, h / 4)
        context.fillStyle = '#222'
        context.font = `${h / 10}px sans-serif`
        context.fillText('Document photo', w / 8, h / 2)
        const blob = await canvas.convertToBlob({ type, quality: 0.9 })
        return [...new Uint8Array(await blob.arrayBuffer())]
      },
      { w, h, type },
    )
  const sideways = Buffer.from(await draw(1600, 1200, 'image/jpeg'))
  writeFileSync(FIXTURES + 'phone-photo.jpg', Buffer.concat([sideways.subarray(0, 2), exifOrientation(6), sideways.subarray(2)]))
  writeFileSync(FIXTURES + 'diagram.png', Buffer.from(await draw(900, 600, 'image/png')))
  await browser.close()
}

/** A one-page agreement set in Times, with a date to correct. */
async function contract() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.TimesRoman)
  const page = doc.addPage([595.28, 841.89])
  const lines = ['Service Agreement', '', 'Between Alpha Studio and Beta Ltd.', 'Date: 1 March 2026', 'Total: 1,200 EUR']
  lines.forEach((text, index) => page.drawText(text, { x: 72, y: 760 - index * 24, size: index ? 13 : 20, font }))
  return doc.save()
}

/** An application form with every kind of field: text, multi-line, checkbox, dropdown and radio buttons. */
async function applicationForm() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595.28, 841.89])
  const form = doc.getForm()
  const label = (text: string, y: number) => page.drawText(text, { x: 72, y: y + 6, size: 11, font })
  page.drawText('Membership application', { x: 72, y: 770, size: 20, font })
  label('Full name', 700)
  form.createTextField('full_name').addToPage(page, { x: 180, y: 696, width: 300, height: 22 })
  label('Country', 660)
  const country = form.createDropdown('country')
  country.addOptions(['Ukraine', 'Poland', 'Germany'])
  country.addToPage(page, { x: 180, y: 656, width: 160, height: 22 })
  label('Plan', 620)
  const plan = form.createRadioGroup('plan')
  plan.addOptionToPage('basic', page, { x: 180, y: 620, width: 14, height: 14 })
  plan.addOptionToPage('pro', page, { x: 260, y: 620, width: 14, height: 14 })
  page.drawText('Basic', { x: 198, y: 622, size: 11, font })
  page.drawText('Pro', { x: 278, y: 622, size: 11, font })
  label('About you', 560)
  const about = form.createTextField('about')
  about.enableMultiline()
  about.addToPage(page, { x: 180, y: 500, width: 300, height: 76 })
  form.createCheckBox('agree').addToPage(page, { x: 72, y: 460, width: 14, height: 14 })
  page.drawText('I agree to the rules', { x: 92, y: 462, size: 11, font })
  return doc.save()
}

export default async function setup() {
  if (existsSync(FIXTURES + 'form.pdf')) return
  mkdirSync(FIXTURES, { recursive: true })
  writeFileSync(FIXTURES + 'long-200.pdf', await (await numbered(200)).save())
  writeFileSync(FIXTURES + 'three.pdf', await (await numbered(3)).save())
  const locked = await numbered(2)
  locked.encrypt({ userPassword: 'open sesame', ownerPassword: 'owner' })
  writeFileSync(FIXTURES + 'locked.pdf', await locked.save())
  writeFileSync(FIXTURES + 'alpha.pdf', await (await numbered(2, [595, 842], 'Alpha')).save())
  writeFileSync(FIXTURES + 'beta.pdf', await (await numbered(1, [842, 595], 'Beta')).save())
  writeFileSync(FIXTURES + 'broken.pdf', 'This is a text file pretending to be a PDF.')
  await images()
  writeFileSync(FIXTURES + 'contract.pdf', await contract())
  writeFileSync(FIXTURES + 'form.pdf', await applicationForm())
}
